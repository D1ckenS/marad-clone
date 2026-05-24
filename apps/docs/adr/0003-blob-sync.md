# ADR 0003 — Blob (binary) sync vessel → shore

**Date:** 2026-05-24
**Status:** Accepted
**Deciders:** Ziad (product), Claude Code (implementation)
**Builds on:** ADR 0002 (Sync Wire Protocol)

---

## Context

ADR 0002 specified how entity rows (JSON-encoded LWW records) move between
vessel and shore. It deliberately deferred binary payloads. The gap surfaced
in PROGRESS.md (P1-2 follow-up) and was flagged in the recent codebase audit:

> **Photo-byte sync vessel↔shore** — Only S3 keys traverse the wire today.
> If a vessel uploads a sign-off photo offline, shore will never see the
> bytes.

Concretely: when a chief engineer signs off a job and attaches a photo, the
vessel calls `StorageService.putJobHistoryPhoto()` which writes to the
vessel's local MinIO. The resulting S3 key is stored on `JobHistory.photos[]`
and replicated to shore via the existing outbox. Shore can read the row but
the GET against shore's MinIO returns 404 — the bytes only exist on the
vessel.

This ADR specifies how those bytes get from vessel-local storage to shore
storage.

### Constraints

- **Direction (this iteration):** vessel → shore only. Shore-uploaded
  attachments (QHSE controlled documents, etc.) don't have a current
  vessel-side consumer; bidirectional support is a future ADR.
- **Network:** same satellite link as the entity sync stream. Frequently
  high-latency, sometimes single-digit kbps, often interrupted.
- **Payload size:** sign-off photos typically 200 KB – 5 MB. QHSE doc
  attachments may be larger (10–20 MB PDFs).
- **Reliability:** a vessel can be offline for weeks. The byte queue must
  survive process restarts and resume in order on reconnect.
- **Idempotency:** the receiver must tolerate the same blob arriving more
  than once (partial-upload retries, duplicate worker invocations).
- **Same-port deployment:** ops want one gRPC port per shore replica, so
  the blob service should mount on the existing SyncService server.

---

## Decisions

### 1. New gRPC service `BlobService` on the same server as `SyncService`

```proto
service BlobService {
  rpc UploadBlob(stream BlobChunk) returns (BlobUploadAck);
}
```

Client-streaming (not bidi): vessel sends a stream of `BlobChunk`s and
receives one `BlobUploadAck` when the receiver finishes persisting. The
first chunk carries `BlobMeta`; subsequent chunks carry only `body`.

Why a separate RPC rather than reusing `SyncService.Stream`:

- **No head-of-line blocking.** A 20 MB PDF chunked at 256 KiB is 80
  messages. Interleaving them with per-entity deltas would stall
  unrelated updates until the upload completes.
- **Different lifecycle.** SyncService streams stay open for the
  vessel's whole online session. UploadBlob is per-blob — easy to retry
  the whole RPC if the channel drops mid-upload.
- **Cleaner auth boundary.** The receiver can validate the blob's
  declared `tenant_id` / `vessel_id` against the stream metadata
  without touching delta-handling code.

### 2. Chunk size: 256 KiB

A pragmatic middle: large enough that a 5 MB photo fits in 20 frames
(low overhead), small enough that a single chunk loss on a flaky link
re-sends ≤256 KiB. Configurable later if we hit real-world cases that
benefit from tuning.

### 3. Vessel-side queue: `blob_outbox` table

A new SQLite table on the vessel mirrors the entity outbox pattern. Every
successful `StorageService.put*()` writes a `blob_outbox` row in addition
to the local S3 PUT. The columns are:

| Column                   | Notes                                                            |
| ------------------------ | ---------------------------------------------------------------- |
| `id`                     | ULID PK                                                          |
| `key`                    | Full S3 key — same string lives in the entity that references it |
| `content_type`           | for the receiver's PutObject                                     |
| `size_bytes`             | for validation + multipart decision                              |
| `sha256`                 | hex, optional; receiver verifies when set                        |
| `tenant_id`, `vessel_id` | log triage + receiver-side auth                                  |
| `created_at`             | unix-ms                                                          |
| `sent_at`                | NULL until acknowledged; uniquely identifies pending rows        |
| `attempt_count`          | bumped on every try                                              |
| `last_error`             | last failure message, truncated to 500 chars                     |

Indices: `(sent_at, created_at)` for the pending scan; `(key)` for
debugging by key.

### 4. Background worker: `BlobUploaderService`

Mirrors the existing entity-outbox drainer:

1. `setInterval` (default 10s, env `BLOB_SYNC_INTERVAL_MS`)
2. Pick up to 8 pending rows whose backoff window has expired
3. For each: `GetObject` from local S3 → open UploadBlob RPC → write
   chunks → await `BlobUploadAck` → set `sent_at` (or `last_error` on
   failure)

Exponential backoff per row: `BASE_BACKOFF_MS * 2^min(attempt-1, 6)`,
i.e. 5s, 10s, 20s, 40s, …, capped at 320s. Give up after 8 attempts —
that row stays in the table for a future reconciliation pass (operator
visibility into stuck blobs).

### 5. Receiver: `BlobReceiverService` (shore)

Plugged into `startSyncServer({ blob: handler })`. The handler:

1. First chunk supplies `meta`; subsequent chunks append to a `Buffer[]`.
2. On `end`, assemble bytes, verify sha256 if `meta.sha256 !== ""`.
3. `PutObject` to shore S3 under `meta.key`.
4. Reply with `BlobUploadAck { storedBytes, sha256Verified, sessionId }`.

The handler deliberately lives on shore (not in sync-engine) so the
sync package has no S3 dependency.

### 6. Eventual consistency between entity rows and their blobs

A `JobHistory` row arrives on shore via the entity outbox immediately
after sign-off. The associated photos may arrive seconds, minutes, or
hours later depending on link quality. UI consumers must tolerate the
window between "entity present" and "blob fetchable" — a broken-image
placeholder is acceptable. This is much better than the alternative of
blocking entity sync until photos are received: the entity contains the
audit trail (who signed off, when, hours worked, parts consumed), all of
which is independently valuable.

### 7. Out of scope for this ADR

- **Shore → vessel direction.** Same machinery (blob_outbox flipped),
  needed for QHSE controlled-document distribution. A separate ADR.
- **Multipart uploads on the shore receiver.** Single-shot PutObject is
  fine up to ~50 MB. Bigger payloads (rarely seen) will need the
  receiver to switch to multipart by size.
- **Resume of a partial upload.** Today a failed mid-stream upload
  restarts from chunk 0 next tick. For genuinely huge files on
  unstable links we'd add per-blob chunk offset tracking; not needed
  for current payload sizes.
- **Garbage collection of orphan local bytes.** If a `blob_outbox`
  INSERT fails after the S3 PUT succeeded, the bytes remain on local
  MinIO but the queue doesn't know about them. A future reconciliation
  job can scan local S3 against the outbox.

---

## Consequences

**Positive**

- The pilot vessel's primary daily workflow (sign-off with photo
  evidence) works end-to-end over a satellite link.
- One mechanism handles any future binary payload (BDN PDFs, QHSE
  attachments, etc.) — `StorageService.put()` already covers them.
- Receiver is fully idempotent; partial-upload retries are safe.
- Independent of entity sync — a stuck blob doesn't slow down audit
  trail propagation.

**Negative**

- `blob_outbox` rows that never succeed (8 attempts) accumulate. Need a
  manual cleanup story; future reconciliation job will address.
- We now run two gRPC services on the same port. Operationally fine but
  the shore replica needs both wired up; tests must cover both.
- Sha256 is computed twice (once on enqueue, once on shore verify).
  Acceptable — for a 5 MB photo it's ~50ms on modern CPUs, dwarfed by
  the network cost.
- Empty-meta chunks: the `proto-loader` default behaviour materialises
  an empty `BlobMeta` on every chunk. Receiver keys off `meta.key !== ''`
  to detect the real first-chunk meta. Documented in the receiver.

---

## Verification

- `apps/api-vessel/test/blob-sync.e2e.ts` — 4 tests covering enqueue,
  drain success, and drain failure paths.
- The drain test stands up a real in-process gRPC server using
  `startSyncServer({ blob })` and asserts the receiver gets the full
  payload chunk-by-chunk and that the queue row is marked sent.
- Failure test points the uploader at port 9 (discard) and asserts
  `attempt_count` is bumped + `last_error` populated, with the row
  preserved for retry.

`pnpm --filter api-vessel run test:e2e` — 143 ✓ (17 files, +4 from this
ADR).
