# ADR 0002 — Sync Wire Protocol

**Date:** 2026-05-05
**Status:** Accepted
**Deciders:** Ziad (product), Claude Code (implementation)
**Builds on:** ADR 0001 (Sync Engine Design)

---

## Context

ADR 0001 specified the sync engine's _semantics_ — outbox-driven writes, HLC-based ordering, per-field LWW, PN-Counter for inventory. It deliberately stopped short of the wire protocol. This ADR specifies how vessel and shore actually exchange those `SyncDelta` records over the network.

Constraints:

- **Vessel side:** SQLite + Drizzle, single-tenant, runs inside Electron, may be offline for hours to weeks (sat-window, dry-dock, anchorage).
- **Shore side:** PostgreSQL + Prisma, multi-tenant, cloud-hosted, always reachable from the open internet (HTTP/2 viable).
- **Topology:** N vessels per tenant ⇄ 1 shore. Each vessel's connection is independent.
- **Direction:** Bidirectional. Initial entities (`Tenant`, `Vessel`, `User`) flow shore-to-vessel only, but the protocol must also support vessel-to-shore for upcoming entities (PMS sign-offs, inventory movements, etc.).
- **Auth:** offline-cached JWT issued by shore (per CLAUDE.md §2) — vessel presents it as a stream-level credential.
- **Fallback channel:** some installations are SMTP-only (legacy satellite contracts). The wire format must be encodable as a MIME attachment without re-architecture.

---

## Decisions

### 1. Transport: gRPC bidirectional streaming over HTTP/2

The shore exposes one RPC: `SyncService.Stream(stream ClientMessage) returns (stream ServerMessage)`. Each vessel maintains exactly one open stream while online. Both sides multiplex deltas, acks, and heartbeats over that single stream.

**Why:**

- Bidi streaming is a single TCP+TLS handshake, amortising the cost over a long-lived session.
- gRPC handles framing, length-prefixing, and back-pressure natively. We do not reinvent these.
- HTTP/2 is supported by the satellite ground gateways the maritime industry actually uses (Inmarsat Fleet Xpress, Iridium Certus). QUIC would be marginally better but `@grpc/grpc-js` does not implement it.
- One stream per vessel keeps the server-side context simple: per-stream we know `(tenantId, vesselId, nodeId)` from the opening `Hello`.

**Trade-off accepted:** HTTP/2 over very lossy satellite (>5% packet loss) can collapse into head-of-line blocking. The SMTP fallback addresses this.

### 2. Wire schema: `ClientMessage` / `ServerMessage` envelopes

Each message on the wire is one of:

```proto
message ClientMessage {
  oneof payload {
    Hello hello = 1;            // sent once at stream open
    DeltaBatch deltas = 2;      // outbox drain from vessel
    Ack ack = 3;                // ack for server-sent batches
    Heartbeat heartbeat = 4;    // liveness
  }
}

message ServerMessage {
  oneof payload {
    Welcome welcome = 1;        // resume cursor (last HLC server has from this node)
    DeltaBatch deltas = 2;      // shore writes for this vessel
    Ack ack = 3;                // ack for vessel-sent batches
    Heartbeat heartbeat = 4;
    Error error = 5;            // protocol or auth error; vessel reconnects
  }
}
```

`DeltaBatch` carries `repeated SyncRecord` (the same shape `sync-engine` already uses internally), each tagged with `entity_type` (string), `entity_id` (string), `hlc` (string), `node_id` (string), `payload` (bytes — JSON for now), and `op` (UPSERT|DELETE).

**Why:**

- Two oneof envelopes (one per direction) cleanly express the bidi protocol in a single proto file.
- Reusing `SyncRecord` means the on-wire message is the same shape the engine already produces. No translator layer.
- `payload` is opaque bytes. JSON-encoded today; can switch to proto-typed payloads later without bumping the wire version, because each entity-type already has a discriminator (`entity_type`).

### 3. Resumable streams via `Welcome.cursor`

When a vessel opens a stream, `Hello` includes the highest HLC the vessel has _applied_ from each peer node (a small map `{nodeId → hlc}`). The shore replies with `Welcome` containing the same map from its perspective: the highest HLC the shore has _received_ from this vessel's node.

After the handshake, each side replays only deltas with `hlc > cursor[nodeId]` for that peer.

**Why:** Survives reconnects. After a stream drops and reconnects, neither side resends already-acknowledged data. No global sequence number is needed — HLCs already provide a total order per node.

### 4. Acks: best-effort, batch-level

When a side receives a `DeltaBatch`, it applies all deltas in order, then sends an `Ack` containing the highest HLC applied per peer node. Acks are advisory — the receiver could replay the batch on reconnect using the cursor logic in §3, so a lost ack is recoverable. This means we don't need per-record acks, and we can pipeline batches without waiting.

**Why:** Per-record ack would 2x the message count for no recovery benefit. Cursor-based replay on reconnect already handles loss.

### 5. Reconnect strategy: exponential backoff with jitter

On stream drop the vessel reconnects with delays `1s, 2s, 4s, 8s, ...` capped at `60s`, each delay multiplied by `random(0.5, 1.5)`. After 1 hour of continuous failure, the vessel emits a local log warning ("sync degraded") visible in the UI but does not pause local writes.

**Why:** Fixed-interval reconnect can synchronize across a fleet and DDoS the shore on recovery. Backoff with jitter de-correlates reconnect storms.

### 6. SMTP fallback: same wire shape, MIME-encoded

For SMTP-only installations, each side periodically (configurable, default 1 hour) packs its outbox into a single `DeltaBatch` proto, base64-encodes the serialized bytes, and emails it as an attachment named `marad-sync-{nodeId}-{hlc}.bin`. The receiver's mail-poller unpacks and feeds the same bytes into the same `SyncEngine.applyRemoteDelta` path.

**This ADR scopes the fallback at interface-level only.** The implementation is `SmtpTransport implements SyncTransport` with a no-op body — the wiring exists so a future ticket can drop in a real IMAP poller + SMTP sender without touching call sites.

**Why:** The proto schema is transport-neutral; reusing it for SMTP avoids a second serialization format. By stubbing the transport, we lock in the integration shape early without committing to a satellite-mail integration that needs real-vessel testing.

### 7. Authentication: bearer JWT in stream metadata

The vessel's first `Hello` sends a JWT (signed by shore at provision time, valid up to 30 days) in the gRPC call's metadata under key `authorization: Bearer <token>`. The shore validates signature, expiry, and that `token.tenantId` matches the `Hello.tenantId`. If validation fails the server replies `ServerMessage.Error{code: UNAUTHENTICATED}` and closes the stream.

**This ADR scopes auth at protocol-level only.** P0-9 ships with a dev-mode mode where any non-empty token is accepted; production-grade JWT validation lands in P0-10 (auth task) which already covers signing/rotation.

**Why:** Layering auth on top of a working stream is straightforward; trying to design auth before the protocol works invites scope creep.

### 8. Node IDs: stable per install

Vessel: `01J{ulid}-vessel`. Shore: `01J{ulid}-shore`. Tenants on shore have one shore-side node ID per tenant — different tenants' deltas never share an HLC namespace.

**Why:** Per-tenant node IDs prevent cross-tenant HLC collisions on the shore side without forcing the wire protocol to be tenant-aware. The tenantId on `Hello` is a routing hint for which `SyncEngine` instance handles the stream.

### 9. Server-side architecture: one engine per (tenant, vessel)

The shore runs N `SyncEngine` instances, one per (tenant, vessel) pair, each with its own outbox and its own peer-cursor map. Streams are 1:1 with engines. Engines are created lazily on first connection and held in an LRU cache.

**Why:** Per-vessel isolation on the server matches the per-vessel isolation on the client side (one DB per vessel). It also makes the server stateless w.r.t. the protocol — the engine holds the cursor state.

### 10. Soak test: real gRPC over loopback

`scripts/sync-soak-test.ts` is extended to:

1. Boot a real `@grpc/grpc-js` server bound to `127.0.0.1:0` (kernel-assigned port).
2. Boot two `SyncEngine` instances backed by `InMemoryAdapter` (same engines as P0-6, no DB), one playing "vessel" and one playing "shore".
3. Run the same 30-min simulated-clock workload (1 000 + 1 000 writes, 200 entities) but route every delta through the real gRPC channel using the gRPC-backed `SyncTransport` instead of calling `applyRemoteDelta` directly.
4. Mid-test, simulate disconnection by closing the stream, queue more writes, then reconnect — verify post-reconnect divergence is still zero.

**Why:** "End-to-end" in P0-9's verify command (`pnpm run soak:sync` with zero divergence) requires the real wire to be exercised. Loopback gRPC is the cheapest faithful transport: it covers framing, back-pressure, ack ordering, and reconnect — without depending on a database or a NestJS app being up.

A separate end-to-end test that boots both NestJS apps and uses real Postgres + SQLite is **deferred to P0-9 follow-up** or P1-1; it duplicates the soak's logical coverage at much higher cost-per-run.

---

## Alternatives Rejected

| Option                                    | Reason rejected                                                                             |
| ----------------------------------------- | ------------------------------------------------------------------------------------------- |
| Server-streaming-only (long-poll uploads) | Halves the streams to manage but doubles the connection count and complicates back-pressure |
| WebSockets                                | No first-class proto support; we'd hand-roll framing                                        |
| HTTP/3 / QUIC                             | `@grpc/grpc-js` is HTTP/2-only; switching SDKs is out of scope                              |
| Per-record ack                            | Doubles message count without improving recovery — cursor replay already handles loss       |
| Sequence numbers instead of HLCs on wire  | Adds a second ordering scheme alongside HLC; HLC alone is sufficient                        |
| One stream per entity-type                | Multiplies the connection count without isolation benefit                                   |
| Fixed reconnect interval                  | Causes thundering-herd on shore recovery                                                    |
| Real NestJS+DB end-to-end soak            | Order-of-magnitude slower; logical coverage already provided by in-memory loopback soak     |

---

## Consequences

- `packages/proto/sync.proto` is the source of truth for the wire format. Any change is a protocol bump and requires both sides to re-deploy. (HLC and entity_type are already extensible, so this should be rare.)
- The shore must hold one `SyncEngine` per (tenant, vessel). Memory budget: ~10 KB per engine empty + outbox; for 1000 vessels that is ~10 MB plus outbox depth — acceptable.
- Reconnects on the vessel side are silent up to 1 hour. UI-level signalling of sync health belongs to P1-3 (UI layer), not P0-9.
- SMTP fallback exists as a transport contract but no functional code. A follow-up ticket creates the IMAP poller; until then, satellite-only vessels are not supported.
- JWT validation is dev-mode only (any non-empty token accepted) until P0-10 lands.

---

## Open Questions

- **Compression.** gRPC supports per-message gzip. Default off; turn on for satellite installations? Decision deferred to P5-1.
- **Multi-region shore.** Today shore is one Postgres. If shore goes multi-region, do engines replicate cross-region or are they sticky? Out of scope for P0-9.
- **Backpressure under sustained partition.** If a vessel is offline for months, the outbox grows unboundedly. Adding an outbox compaction step (collapse multiple writes to the same record into one) is a candidate for P3 if needed; until then, vessel disk is large enough to absorb months of outbox.
