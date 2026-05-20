import { app, BrowserWindow, shell } from 'electron';
import path from 'node:path';
import fs from 'node:fs';
import type { ChildProcess } from 'node:child_process';
import { createRendererServer, parseShoreUrl, type ApiTarget } from './server';
import { spawnApiVessel, waitForPort, getFreePort } from './child';

const isDev = !app.isPackaged;
const VITE_DEV_URL = process.env['VITE_DEV_SERVER_URL'] ?? 'http://localhost:5342';

let mainWindow: BrowserWindow | null = null;
let rendererUrl = '';
let vesselChild: ChildProcess | null = null;

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    title: 'FleetOps',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  mainWindow.loadURL(rendererUrl).catch((err: unknown) => {
    process.stderr.write(`[desktop] failed to load ${rendererUrl}: ${String(err)}\n`);
  });

  if (isDev) {
    mainWindow.webContents.openDevTools();
  }

  // Open external links in the system browser, not inside Electron.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

/**
 * Decides where /api/* should be proxied to.
 *
 *   1. SHORE_URL env var (or `shore_url` file in userData) — remote override.
 *   2. SHORE_PORT env var — legacy: assume API on 127.0.0.1:<port>.
 *   3. Default: spawn the bundled api-vessel as a child process.
 */
async function resolveApiTarget(): Promise<ApiTarget> {
  // (1) explicit remote shore URL
  const envShoreUrl = process.env['SHORE_URL'];
  const userDataShoreUrlPath = path.join(app.getPath('userData'), 'shore_url');
  let shoreUrl = envShoreUrl;
  if (!shoreUrl && fs.existsSync(userDataShoreUrlPath)) {
    shoreUrl = fs.readFileSync(userDataShoreUrlPath, 'utf8').trim() || undefined;
  }
  if (shoreUrl) {
    const target = parseShoreUrl(shoreUrl);
    process.stdout.write(
      `[desktop] proxying /api/* to remote SHORE_URL=${shoreUrl} (${target.hostname}:${target.port})\n`,
    );
    return target;
  }

  // (2) legacy SHORE_PORT (assumes an external shore API on this machine)
  const legacyShorePort = process.env['SHORE_PORT'];
  if (legacyShorePort) {
    const port = Number(legacyShorePort);
    process.stdout.write(`[desktop] proxying /api/* to legacy SHORE_PORT=${port}\n`);
    return { protocol: 'http:', hostname: '127.0.0.1', port };
  }

  // (3) self-contained: spawn the bundled api-vessel
  const port = await getFreePort();
  const userData = app.getPath('userData');
  fs.mkdirSync(userData, { recursive: true });
  const databaseUrl = path.join(userData, 'vessel.db');
  const migrationsDir = path.join(process.resourcesPath, 'api-vessel', 'drizzle');
  const jwtKey = path.join(process.resourcesPath, 'api-vessel', 'jwt-public.pem');

  // First-launch seed: if userData has no vessel.db yet, copy the bundled
  // seed-vessel.db over. This is what gives a freshly-installed .exe a
  // working tenant + vessel + login-ready users with zero configuration.
  if (!fs.existsSync(databaseUrl)) {
    const seedDb = path.join(process.resourcesPath, 'api-vessel', 'seed-vessel.db');
    if (fs.existsSync(seedDb)) {
      fs.copyFileSync(seedDb, databaseUrl);
      process.stdout.write(`[desktop] seeded fresh vessel.db from ${seedDb}\n`);
    } else {
      process.stdout.write(
        `[desktop] no seed-vessel.db bundled — vessel will start with an empty DB\n`,
      );
    }
  }

  process.stdout.write(
    `[desktop] spawning bundled api-vessel on :${port}\n  db=${databaseUrl}\n  migrations=${migrationsDir}\n`,
  );

  vesselChild = spawnApiVessel({
    port,
    databaseUrl,
    migrationsDir,
    ...(fs.existsSync(jwtKey) ? { jwtPublicKeyPath: jwtKey } : {}),
  });

  await waitForPort(port);
  process.stdout.write(`[desktop] api-vessel ready on :${port}\n`);

  return { protocol: 'http:', hostname: '127.0.0.1', port };
}

app.on('ready', () => {
  void (async () => {
    try {
      if (isDev) {
        // Dev mode: load Vite dev server (which already proxies /api/* to api-shore).
        rendererUrl = VITE_DEV_URL;
      } else {
        const apiTarget = await resolveApiTarget();
        const rendererDir = path.join(process.resourcesPath, 'renderer');
        const serverPort = await createRendererServer(rendererDir, apiTarget);
        rendererUrl = `http://127.0.0.1:${serverPort}`;
        process.stdout.write(`[desktop] renderer on :${serverPort}\n`);
      }
      createWindow();
    } catch (err) {
      process.stderr.write(`[desktop] startup failed: ${String(err)}\n`);
      app.quit();
    }
  })();
});

app.on('before-quit', () => {
  if (vesselChild && !vesselChild.killed) {
    process.stdout.write('[desktop] stopping api-vessel child\n');
    vesselChild.kill();
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (!mainWindow && rendererUrl) createWindow();
});
