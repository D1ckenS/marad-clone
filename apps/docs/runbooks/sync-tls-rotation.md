# Sync gRPC TLS — rotation runbook

> Audience: shore IT. Frequency: at least once a year (cert validity), or
> immediately on suspected key compromise.

The sync gateway runs mutual TLS (B1). Both ends present a cert signed by a
shared CA. Three env vars per process:

- `SYNC_TLS_CA_PATH` — trust root
- `SYNC_TLS_CERT_PATH` — own leaf cert (server on shore, client on vessel)
- `SYNC_TLS_KEY_PATH` — private key matching the leaf cert

`api-shore` and `api-vessel` refuse to boot in `NODE_ENV=production` when any
of those three are unset. In dev they fall through to plaintext loopback.

---

## 1. Routine renewal — leaf certs only (most common)

The CA is long-lived. Rotate the leaf certs annually before they expire.

### Shore

1. Issue a new shore leaf cert from your CA. CN should match the public
   hostname vessels dial; SANs should include all reachable hostnames + IPs.
2. Copy `shore.crt` + `shore.key` to the shore host. Key file `mode 0600`,
   owned by the api-shore service user.
3. On the shore host, swap the env paths or atomically replace the files at
   the existing paths.
4. Restart `api-shore`. The gateway re-binds with the new cert on the next
   bind. Existing client streams hold the old cert for the lifetime of the
   TCP connection — verify rotation by `openssl s_client -connect
shore.fleetops.com:50051 -CAfile ca.crt -showcerts` and check the
   `notAfter` date.

### Vessel

The vessel has the same three env vars but with vessel-specific files. Two
provisioning paths:

**A. Sysadmin pushes the new cert dockside.** Same physical machine
(`%APPDATA%\FleetOps\` or wherever `vessel.db` lives). Replace cert + key
atomically (write to `vessel.crt.new` then rename), then restart the
Electron app or the `api-vessel` service. The bundled api-vessel reads the
env at boot.

**B. Remote rotate via shore.** Out of scope for B1 — would need an admin
endpoint that pushes the new cert via the existing authenticated channel.
Tracked under Phase 5 deployment work.

### Verification

```powershell
# Shore — confirm the leaf chain validates and notAfter is correct
openssl s_client -connect shore.fleetops.com:50051 -CAfile ca.crt -servername shore.fleetops.com -showcerts < /dev/null

# Vessel — confirm api-vessel accepted the new env and is talking to shore
# (the api-vessel log line "connected to shore.fleetops.com:50051" appears
# once per successful TLS handshake)
```

---

## 2. CA rotation — full chain (rare)

Only needed on CA compromise or 5+ years out from the original issue date.
Rotating the CA forces every vessel + shore to swap simultaneously, so it's
a coordinated maintenance window.

### Procedure

1. Generate the new CA on an offline machine. Key never leaves that machine.
2. Issue new leaf certs for shore + every vessel, signed by the new CA.
3. Maintenance window: vessels in port, shore traffic paused.
4. Configure shore to **temporarily** trust both old and new CAs (concat the
   two PEMs into the file at `SYNC_TLS_CA_PATH`). Restart shore.
5. Push new vessel certs out-of-band; restart each vessel one at a time.
6. After every vessel reports `connected to ...` with the new chain, swap
   the shore CA file back to just the new CA. Restart shore.
7. Destroy the old CA private key (it shouldn't have a copy on shore anyway
   if you followed step 1).

### Why this works

Phase 4–5 is the dual-trust window. Shore trusts both CAs, so it accepts
old-CA-signed vessel certs alongside new-CA-signed ones, allowing
per-vessel rolling cutover. Vessels never trust both — they're upgraded
atomically to the new CA + new cert + new shore CA reference.

---

## 3. Dev path

`pnpm -w run gen:sync-tls` writes a self-signed CA + shore.crt + vessel.crt
into `keys/sync-tls/`. The script prints the three env var lines for shore
and vessel to copy into their respective `.env` files. Validity is 1 year.

Regenerating overwrites — the script refuses if `keys/sync-tls/` already
exists, so you have to `rm -rf` it first. That's intentional: deleting dev
certs invalidates every running dev shore/vessel, and the explicit step
keeps that from happening by accident.

---

## 4. Recovery scenarios

| Symptom                                                    | Likely cause                                                   | Action                                                                                                        |
| ---------------------------------------------------------- | -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `api-shore` startup throws "required in prod"              | Missing or empty env var                                       | Set all three `SYNC_TLS_*_PATH` vars or roll back to a config that does                                       |
| Shore logs `UNAVAILABLE: TLS handshake failed`             | Vessel cert expired, or wrong CA bundle on vessel              | Re-issue vessel cert; verify `SYNC_TLS_CA_PATH` on vessel points at the current CA                            |
| Vessel logs `connect failed (attempt N)`                   | Shore unreachable, or vessel cert revoked, or clock skew >24 h | Check shore reachability first (VSAT); then check vessel system clock; then re-issue cert                     |
| `unable to verify certificate chain` on `openssl s_client` | `SYNC_TLS_CA_PATH` doesn't match the issuer of the leaf        | Concat the issuing CA into the bundle (chained PEM) or replace the bundle entirely with the right CA          |
| Sync silent — no logs at all                               | `SYNC_ENABLED` isn't 1 on the side that should be talking      | Confirm `SYNC_ENABLED=1`, `SYNC_TENANT_ID`, `SYNC_VESSEL_ID`. TLS config has no effect when sync is disabled. |

---

## 5. Test plan after rotation

Run from a shore admin laptop with `pnpm` available:

```bash
# 1. Confirm shore presents the expected cert
openssl s_client -connect shore.fleetops.com:50051 -CAfile new-ca.crt -servername shore.fleetops.com -showcerts < /dev/null | openssl x509 -noout -dates -subject -issuer

# 2. Confirm shore rejects plaintext
nc -v shore.fleetops.com 50051   # should connect but get TLS-only errors when sending plaintext

# 3. Run the sync soak test against the rotated chain
SYNC_TLS_CA_PATH=… SYNC_TLS_CERT_PATH=… SYNC_TLS_KEY_PATH=… pnpm run soak:sync
```

The soak test exercises the production `startSyncServer` + `GrpcSyncTransport`
code paths — if the handshake works there, the same code in `api-shore` and
`api-vessel` works too.
