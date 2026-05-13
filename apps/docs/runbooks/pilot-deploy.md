# FleetOps — Pilot Deployment Runbook

> **Audience:** System integrator or IT officer setting up the first pilot vessel.
> **Scope:** Shore server + one vessel (Windows workstation) + initial sync.
> **Time estimate:** 2–4 hours for a clean environment.

---

## Table of Contents

1. [Prerequisites](#1-prerequisites)
2. [Shore Server Setup](#2-shore-server-setup)
3. [Generate JWT Keypair](#3-generate-jwt-keypair)
4. [Configure Shore Environment](#4-configure-shore-environment)
5. [Run Shore Migrations & Seed](#5-run-shore-migrations--seed)
6. [Vessel Workstation Setup](#6-vessel-workstation-setup)
7. [Configure Vessel Environment](#7-configure-vessel-environment)
8. [Run Vessel Migrations](#8-run-vessel-migrations)
9. [Enable gRPC Sync](#9-enable-grpc-sync)
10. [Smoke-Test Checklist](#10-smoke-test-checklist)
11. [Day-2 Operations](#11-day-2-operations)
12. [Adding a Second Vessel](#12-adding-a-second-vessel)
13. [Rollback Procedure](#13-rollback-procedure)

---

## 1. Prerequisites

### Shore Server (Linux VPS / cloud VM / on-prem server)

| Requirement      | Minimum                            | Notes                                  |
| ---------------- | ---------------------------------- | -------------------------------------- |
| OS               | Ubuntu 22.04 LTS                   | Debian 12 also tested                  |
| CPU              | 2 vCPU                             | 4 recommended                          |
| RAM              | 4 GB                               | 8 GB for >3 vessels                    |
| Disk             | 40 GB SSD                          | Photos grow; plan for 1 GB/vessel/year |
| Node.js          | 24.x LTS                           | Install via `nvm` or NodeSource        |
| pnpm             | 10.x                               | `npm install -g pnpm@latest`           |
| Docker + Compose | 24.x                               | For Postgres, MinIO, Meilisearch       |
| Open ports       | 3000 (HTTP API), 50051 (gRPC sync) | Firewall rules must allow vessel IPs   |

### Vessel Workstation (Windows)

| Requirement                | Minimum                             | Notes                                          |
| -------------------------- | ----------------------------------- | ---------------------------------------------- |
| OS                         | Windows 10 64-bit                   | Windows 11 recommended                         |
| RAM                        | 4 GB                                |                                                |
| Disk                       | 10 GB free                          | For app + SQLite DB + logs                     |
| Network                    | Ship Wi-Fi (LAN) to the workstation | Sync only when connectivity to shore available |
| No Flutter / Node required |                                     | The Electron installer bundles everything      |

### Connectivity

- Shore server must be reachable from the vessel on **TCP 50051** (gRPC sync) when the vessel has internet / satellite connectivity.
- On-vessel LAN access: crew tablets / phones connect to the vessel workstation on **TCP 3001** (vessel API) via ship Wi-Fi.

---

## 2. Shore Server Setup

### 2.1 Clone the repository and install dependencies

```bash
git clone <repo-url> /opt/fleetops
cd /opt/fleetops
pnpm install
```

### 2.2 Start infrastructure services

```bash
docker compose -f infra/docker-compose.dev.yml up -d
# Wait for healthy status (takes ~20 s):
docker compose -f infra/docker-compose.dev.yml ps
```

Expected output: all three services (`postgres`, `minio`, `meilisearch`) show **healthy**.

### 2.3 Create the MinIO photo bucket

```bash
# Option A — MinIO web console (http://<SHORE_IP>:9001)
#   Login: marad_minio / marad_minio_dev  →  Buckets → Create Bucket → "fleetops-photos"

# Option B — mc CLI
docker run --rm --network host minio/mc \
  alias set local http://localhost:9000 marad_minio marad_minio_dev && \
  mc mb local/fleetops-photos
```

---

## 3. Generate JWT Keypair

The keypair is generated **once per fleet**. The private key stays on shore; the public key is copied to every vessel.

```bash
# From repo root (shore server):
pnpm run gen:jwt-keys
```

Output:

```
Wrote:
  /opt/fleetops/keys/jwt-private.pem  (mode 600 — keep secret on shore)
  /opt/fleetops/keys/jwt-public.pem   (distribute to every vessel)
```

> **Security:** Never copy `jwt-private.pem` to a vessel. If it is ever compromised, rotate the keypair and redistribute the new public key to all vessels.

---

## 4. Configure Shore Environment

Create `/opt/fleetops/apps/api-shore/.env.production` (never commit this file):

```dotenv
# ── Database ──────────────────────────────────────────────────────────────────
DATABASE_URL="postgresql://fleetops:<STRONG_PASSWORD>@localhost:5433/fleetops_shore"

# ── JWT (RS256 keypair generated in step 3) ───────────────────────────────────
JWT_PRIVATE_KEY_PATH=/opt/fleetops/keys/jwt-private.pem
JWT_PUBLIC_KEY_PATH=/opt/fleetops/keys/jwt-public.pem
JWT_ACCESS_TTL_MS=86400000       # 24 h
JWT_REFRESH_TTL_MS=2592000000    # 30 d

# ── S3 / MinIO photo storage ──────────────────────────────────────────────────
S3_ENDPOINT=http://localhost:9000
S3_ACCESS_KEY_ID=marad_minio
S3_SECRET_ACCESS_KEY=marad_minio_dev
S3_BUCKET=fleetops-photos
S3_FORCE_PATH_STYLE=1
S3_REGION=us-east-1

# ── API ───────────────────────────────────────────────────────────────────────
PORT=3000
NODE_ENV=production

# ── Sync gRPC ─────────────────────────────────────────────────────────────────
SYNC_ENABLED=1
SYNC_GRPC_PORT=50051
```

Update the Postgres password in Docker Compose to match:

```bash
# infra/docker-compose.dev.yml — change POSTGRES_PASSWORD and POSTGRES_USER/DB
# to match DATABASE_URL above, then:
docker compose -f infra/docker-compose.dev.yml up -d postgres
```

---

## 5. Run Shore Migrations & Seed

### 5.1 Apply Prisma migrations

```bash
cd /opt/fleetops
NODE_ENV=production \
  DATABASE_URL="postgresql://fleetops:<STRONG_PASSWORD>@localhost:5433/fleetops_shore" \
  pnpm --filter api-shore prisma migrate deploy
```

Expected: `6 migrations applied` with no errors.

### 5.2 Start api-shore

```bash
# Build once:
pnpm --filter api-shore run build

# Start (use a process manager in production — systemd example below):
NODE_ENV=production \
  ENV_FILE=/opt/fleetops/apps/api-shore/.env.production \
  node apps/api-shore/dist/main.js
```

**systemd service** (`/etc/systemd/system/fleetops-shore.service`):

```ini
[Unit]
Description=FleetOps Shore API
After=network.target docker.service
Requires=docker.service

[Service]
Type=simple
WorkingDirectory=/opt/fleetops
EnvironmentFile=/opt/fleetops/apps/api-shore/.env.production
ExecStart=/usr/bin/node apps/api-shore/dist/main.js
Restart=always
RestartSec=5s
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
```

```bash
systemctl daemon-reload
systemctl enable --now fleetops-shore
systemctl status fleetops-shore
```

### 5.3 Seed initial tenant, vessel, and users

```bash
# The seed script requires api-shore running on http://localhost:3000
cd /opt/fleetops
pnpm run seed
```

**Copy and save the output** — it contains the **tenant ID**, **vessel ID**, and credentials:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Organisation ID : 01JXXXXXXXXXXXXXXXXXXXXXXX   ← TENANT_ID
  Vessel ID       : 01JXXXXXXXXXXXXXXXXXXXXXXX   ← VESSEL_ID

  Master / Captain
    Email    : master@demo.local
    Password : Master1234!
  ...
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

> Replace the demo passwords immediately after first login. The seed script is idempotent for development but should be run **once** in production.

### 5.4 Verify shore is healthy

```bash
curl -s http://localhost:3000/api/v1/auth/login \
  -X POST -H 'Content-Type: application/json' \
  -d "{\"tenantId\":\"<TENANT_ID>\",\"email\":\"master@demo.local\",\"password\":\"Master1234!\"}" \
  | jq .access_token
```

Expected: a JWT string (not `null`).

---

## 6. Vessel Workstation Setup

### 6.1 Build the Electron installer (on a developer machine or CI)

```bash
# On a Windows machine with Node 24 + pnpm installed:
cd /path/to/fleetops

# Build api-vessel and web-shore first:
pnpm --filter api-vessel run build
pnpm --filter web-shore run build

# Package the Electron installer:
pnpm --filter desktop-vessel run dist
```

Output: `apps/desktop-vessel/release/FleetOps Setup <version>.exe` (NSIS installer, ~200 MB).

### 6.2 Transfer installer to the vessel workstation

Copy the `.exe` installer to the vessel workstation via USB stick or ship LAN file share.

### 6.3 Install the application

Run `FleetOps Setup <version>.exe` on the vessel workstation. Default install path: `C:\Program Files\FleetOps\`.

### 6.4 Copy the JWT public key to the vessel

```bash
# From shore server — transfer jwt-public.pem to the vessel
scp /opt/fleetops/keys/jwt-public.pem crew@<VESSEL_IP>:C:/ProgramData/FleetOps/keys/
```

Or copy via USB. The key file must be placed at the path that `JWT_PUBLIC_KEY_PATH` points to.

---

## 7. Configure Vessel Environment

Create `C:\ProgramData\FleetOps\.env` (or configure via the Electron app's settings panel once that is built — Phase 4):

```dotenv
# ── Database (SQLite) ─────────────────────────────────────────────────────────
DATABASE_URL=C:\ProgramData\FleetOps\vessel.db

# ── JWT (copy of shore public key, step 6.4) ──────────────────────────────────
JWT_PUBLIC_KEY_PATH=C:\ProgramData\FleetOps\keys\jwt-public.pem

# ── Vessel-local auth (crew use when offline, no internet required) ───────────
VESSEL_LOCAL_JWT_SECRET=<GENERATE_A_RANDOM_32_CHAR_SECRET>
VESSEL_LOCAL_JWT_TTL_MS=28800000     # 8 h

# ── API ───────────────────────────────────────────────────────────────────────
PORT=3001
NODE_ENV=production

# ── Sync (fill in after shore is confirmed reachable) ─────────────────────────
SYNC_ENABLED=1
SYNC_TENANT_ID=<TENANT_ID from seed output>
SYNC_VESSEL_ID=<VESSEL_ID from seed output>
SHORE_SYNC_URL=<SHORE_PUBLIC_IP>:50051
SYNC_AUTH_TOKEN=<SHARED_SECRET — same value set on shore side>
SYNC_DRAIN_INTERVAL_MS=5000

# ── S3 / MinIO (same MinIO as shore, for photo upload) ────────────────────────
S3_ENDPOINT=http://<SHORE_PUBLIC_IP>:9000
S3_ACCESS_KEY_ID=marad_minio
S3_SECRET_ACCESS_KEY=marad_minio_dev
S3_BUCKET=fleetops-photos
S3_FORCE_PATH_STYLE=1
S3_REGION=us-east-1
```

> `VESSEL_LOCAL_JWT_SECRET` must be a strong random value. Generate with:
> `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`

---

## 8. Run Vessel Migrations

The Electron app runs migrations automatically on first launch. To run them manually (e.g., from a terminal for troubleshooting):

```powershell
# From the FleetOps install directory:
cd "C:\Program Files\FleetOps"
$env:DATABASE_URL = "C:\ProgramData\FleetOps\vessel.db"
node resources\api-vessel\dist\main.js --migrate-only
# Or via pnpm during development:
# pnpm --filter api-vessel run db:migrate
```

Verify the DB was created:

```powershell
# SQLite quick check (install sqlite3 CLI if not present):
sqlite3 "C:\ProgramData\FleetOps\vessel.db" ".tables"
```

Expected: tables including `tenants`, `vessels`, `users`, `components`, `job_instances`, `parts`, `stock_movements`, `requisitions`, etc.

---

## 9. Enable gRPC Sync

### 9.1 Confirm shore gRPC port is reachable from the vessel

```powershell
# From vessel workstation PowerShell:
Test-NetConnection -ComputerName <SHORE_PUBLIC_IP> -Port 50051
```

Expected: `TcpTestSucceeded : True`.

### 9.2 Start the Electron app

Launch FleetOps from the Start Menu or desktop shortcut. The app:

1. Starts api-vessel on port 3001.
2. Runs database migrations (first launch only).
3. Opens a browser window pointed at `http://127.0.0.1:<random port>`.
4. With `SYNC_ENABLED=1`, initiates gRPC connection to shore.

### 9.3 Verify initial sync

Check vessel logs (Windows Event Viewer or the Electron dev tools console):

```
[SyncClientService] Connected to shore at <SHORE_IP>:50051
[SyncClientService] Outbox drained: 0 records sent
```

Check shore logs:

```
[SyncGatewayService] Vessel connected: tenantId=<X> vesselId=<Y>
```

### 9.4 Seed vessel-side users (first login)

The seed script creates users on the shore DB. The sync engine will replicate the `users` table to the vessel within one drain cycle (default 5 s). Verify by logging in to the Electron app using the master credentials from step 5.3.

If sync has not yet run, create a vessel-local user directly:

```bash
# From shore — POST to vessel API if LAN-reachable:
curl -s http://<VESSEL_IP>:3001/api/v1/auth/login \
  -X POST -H 'Content-Type: application/json' \
  -d '{"tenantId":"<TENANT_ID>","email":"master@demo.local","password":"Master1234!"}'
```

---

## 10. Smoke-Test Checklist

Perform these checks in order after each new installation. Check off each item before handing over to the crew.

### 10.1 Authentication

- [ ] **Shore web login** — open `http://<SHORE_IP>:3000` (or load-balanced URL) in a browser; log in as `master@demo.local` → redirected to maintenance dashboard.
- [ ] **Vessel app login** — launch FleetOps Electron app; log in with same credentials → job list appears.
- [ ] **Offline login** — disconnect vessel workstation from internet; close and reopen FleetOps; log in → succeeds with cached JWT.

### 10.2 Maintenance (PMS)

- [ ] **Create component** — Maintenance → Components → New → `Main Engine / 4-stroke diesel, SFI 230` → save.
- [ ] **Create job** — select the component → Add Job → `Oil Change`, interval `90 days`, priority `HIGH` → save.
- [ ] **Create job instance** — due today; assign to Chief Engineer.
- [ ] **Sign off job** — Chief Engineer logs in → open assigned job → attach one photo from camera/gallery → enter hours worked → Sign Off → status changes to DONE.
- [ ] **ROB updated** — if parts were consumed in sign-off, open Inventory and confirm ROB decreased.

### 10.3 Inventory

- [ ] **Create part** — Inventory → New Part → `Engine Oil SAE 40`, part no `OIL-001`, unit `L`.
- [ ] **Create stock level** — select part → Locations → Engine Room store → min 20 L, reorder 40 L, max 200 L.
- [ ] **Post stock receipt** — Stock Movement → RECEIPT → 100 L → ROB shows 100, status chip green.
- [ ] **Consume stock** — CONSUMPTION → 80 L → ROB shows 20, status chip amber (at min stock).
- [ ] **Trigger reorder** — CONSUMPTION → 5 L → ROB 15 < reorder 40 → draft Requisition auto-created.

### 10.4 Purchase

- [ ] **View requisition** — Purchase → Requisitions → draft requisition from 10.3 visible.
- [ ] **Submit requisition** — click Submit → status SUBMITTED.
- [ ] **Approve requisition** — log in as admin → approve → status APPROVED.
- [ ] **Create PO** — assign supplier, send → status SENT.
- [ ] **Receive goods** — GRN modal → enter received quantity → ROB updated.

### 10.5 Barcode scan (mobile)

- [ ] **Install FleetOps mobile APK** on a crew Android phone.
- [ ] **Connect to vessel Wi-Fi** — phone should reach `http://<VESSEL_LAN_IP>:3001`.
- [ ] **Log in** — enter tenant ID, email, password, vessel API URL → home screen.
- [ ] **Bind barcode** — In shore web → Inventory → select part OIL-001 → Barcodes → bind barcode `OIL001-BIN-A`.
- [ ] **Scan barcode** — mobile app → Inventory tab → Scan → point at barcode → part name resolved → Adjust Stock.

### 10.6 Sync verification

- [ ] **Shore → vessel**: create a new Component on shore; within 10 s it appears on the vessel app (after app refresh).
- [ ] **Vessel → shore**: sign off a job on the vessel; JobHistory entry appears on shore within 10 s.
- [ ] **Offline write**: disconnect vessel from internet; post a stock movement; reconnect; within 30 s the movement appears on shore.

---

## 11. Day-2 Operations

### Log locations

| Component  | Log path                                                      |
| ---------- | ------------------------------------------------------------- |
| api-shore  | `journalctl -u fleetops-shore -f` (systemd)                   |
| Postgres   | `docker logs fleetops-postgres-1 -f`                          |
| MinIO      | `docker logs fleetops-minio-1 -f`                             |
| api-vessel | Windows Event Log → Application; or Electron DevTools console |

### Database backup

**Shore (Postgres):**

```bash
# Cron entry (daily at 02:00):
0 2 * * * docker exec fleetops-postgres-1 pg_dump -U fleetops fleetops_shore \
  | gzip > /backups/fleetops-shore-$(date +%Y%m%d).sql.gz
```

**Vessel (SQLite):**

```powershell
# Run before any upgrade or weekly via Task Scheduler:
Copy-Item "C:\ProgramData\FleetOps\vessel.db" `
  "C:\ProgramData\FleetOps\backups\vessel-$(Get-Date -Format yyyyMMdd).db"
```

### Upgrading FleetOps

1. Build new installer on the CI / dev machine.
2. Run `pnpm --filter api-shore prisma migrate deploy` on the shore server.
3. Stop the Electron app on the vessel, install the new `.exe` over the existing one (NSIS in-place upgrade), restart.
4. Vessel migrations run automatically on first launch.
5. Verify sync is re-established (`SyncClientService Connected` in logs).

### MinIO bucket lifecycle (photo storage)

Photos accumulate over time. Set an expiration policy via the MinIO console (`http://<SHORE_IP>:9001`) → Buckets → `fleetops-photos` → Lifecycle → add a rule to transition objects to Glacier/cold storage after 1 year, or consult your cloud provider.

---

## 12. Adding a Second Vessel

1. **Create the vessel** on shore:

   ```bash
   curl -s http://localhost:3000/api/v1/vessels \
     -X POST -H "Authorization: Bearer <ADMIN_TOKEN>" \
     -H 'Content-Type: application/json' \
     -d '{"name":"MV Second Vessel","imoNumber":"7654321"}'
   ```

   Note the returned `id` — this is `VESSEL_ID` for the second vessel.

2. **Create crew users** bound to the new vessel (POST `/users` with `vesselId`).

3. Repeat **steps 6–9** on the second vessel workstation, substituting the new `VESSEL_ID`.

4. Use a **different `VESSEL_LOCAL_JWT_SECRET`** per vessel — each vessel's offline token must be unique.

---

## 13. Rollback Procedure

### Shore rollback (bad migration)

```bash
# Revert the last Prisma migration:
pnpm --filter api-shore prisma migrate resolve --rolled-back <migration_name>
# Restore from backup if data was altered:
gunzip -c /backups/fleetops-shore-<YYYYMMDD>.sql.gz | \
  docker exec -i fleetops-postgres-1 psql -U fleetops fleetops_shore
# Redeploy the previous build:
git checkout <previous_tag>
pnpm --filter api-shore run build
systemctl restart fleetops-shore
```

### Vessel rollback (bad Electron update)

1. Uninstall FleetOps from Programs & Features.
2. Restore the SQLite backup:
   ```powershell
   Copy-Item "C:\ProgramData\FleetOps\backups\vessel-<YYYYMMDD>.db" `
     "C:\ProgramData\FleetOps\vessel.db" -Force
   ```
3. Reinstall the previous installer version.
4. Restart and verify sync reconnects.

---

_Last updated: 2026-05-13 — covers FleetOps Phase 1 (P1-1 through P1-11)._
