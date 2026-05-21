import { spawn, type ChildProcess } from 'node:child_process';
import net from 'node:net';
import path from 'node:path';
import fs from 'node:fs';

export interface SpawnVesselOptions {
  /** TCP port to bind api-vessel on (caller picks a free port). */
  port: number;
  /** Path to a writable SQLite file (e.g. <userData>/vessel.db). */
  databaseUrl: string;
  /** Absolute path to the bundled drizzle/ migrations folder. */
  migrationsDir: string;
  /** Absolute path to the JWT public key PEM (for shore-issued JWT verification). */
  jwtPublicKeyPath?: string;
  /** Working directory for the child (defaults to api-vessel script's parent). */
  cwd?: string;
}

/**
 * Spawns the api-vessel NestJS server as a child of the Electron process.
 *
 * In a packaged app `process.resourcesPath` points to the extraResources
 * directory created by electron-builder. We run it with ELECTRON_RUN_AS_NODE
 * so the Electron binary acts as a plain Node.js runtime.
 */
export function spawnApiVessel(opts: SpawnVesselOptions): ChildProcess {
  const serverScript = path.join(process.resourcesPath, 'api-vessel', 'dist', 'main.js');

  if (!fs.existsSync(serverScript)) {
    throw new Error(`api-vessel main script not found at ${serverScript}`);
  }

  const cwd = opts.cwd ?? path.join(process.resourcesPath, 'api-vessel');

  const env: NodeJS.ProcessEnv = {
    ...process.env,
    PORT: String(opts.port),
    NODE_ENV: 'production',
    ELECTRON_RUN_AS_NODE: '1',
    DATABASE_URL: opts.databaseUrl,
    MIGRATIONS_DIR: opts.migrationsDir,
    // Sync disabled by default in standalone desktop mode — the operator can
    // turn it on later via env once a shore endpoint is configured.
    SYNC_ENABLED: process.env['SYNC_ENABLED'] ?? '0',
    SMTP_SYNC_ENABLED: process.env['SMTP_SYNC_ENABLED'] ?? '0',
  };
  if (opts.jwtPublicKeyPath !== undefined) {
    env['JWT_PUBLIC_KEY_PATH'] = opts.jwtPublicKeyPath;
  }
  // First-launch provisioning gate — must be set in the desktop environment
  // for the SPA setup wizard to be functional. Inherited from process.env so
  // shore IT can provision it via the Windows installer's user-env or a
  // FleetOps.cmd wrapper on the laptop.
  if (process.env['VESSEL_BOOTSTRAP_KEY'] !== undefined) {
    env['VESSEL_BOOTSTRAP_KEY'] = process.env['VESSEL_BOOTSTRAP_KEY'];
  }
  if (process.env['VESSEL_LOCAL_JWT_SECRET'] !== undefined) {
    env['VESSEL_LOCAL_JWT_SECRET'] = process.env['VESSEL_LOCAL_JWT_SECRET'];
  }

  const child = spawn(process.execPath, [serverScript], {
    cwd,
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  child.stdout?.on('data', (chunk: Buffer) => {
    process.stdout.write(`[api-vessel] ${chunk.toString()}`);
  });
  child.stderr?.on('data', (chunk: Buffer) => {
    process.stderr.write(`[api-vessel] ${chunk.toString()}`);
  });
  child.on('exit', (code: number | null) => {
    if (code !== 0 && code !== null) {
      process.stderr.write(`[api-vessel] exited with code ${code}\n`);
    }
  });

  return child;
}

/**
 * Polls `127.0.0.1:port` until the port accepts a TCP connection or the
 * deadline elapses. Used after spawnApiVessel to gate the BrowserWindow open.
 */
export async function waitForPort(port: number, timeoutMs = 20_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const ok = await new Promise<boolean>((resolve) => {
      const sock = net.connect({ host: '127.0.0.1', port }, () => {
        sock.end();
        resolve(true);
      });
      sock.on('error', () => resolve(false));
      sock.setTimeout(500, () => {
        sock.destroy();
        resolve(false);
      });
    });
    if (ok) return;
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`api-vessel did not start within ${timeoutMs}ms (port ${port})`);
}

/**
 * Returns an OS-assigned free port by briefly binding a server.
 */
export function getFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.unref();
    srv.on('error', reject);
    srv.listen(0, '127.0.0.1', () => {
      const addr = srv.address();
      if (typeof addr === 'object' && addr) {
        const port = addr.port;
        srv.close(() => resolve(port));
      } else {
        srv.close(() => reject(new Error('failed to bind a free port')));
      }
    });
  });
}
