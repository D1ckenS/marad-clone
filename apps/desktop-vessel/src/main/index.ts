import { app, BrowserWindow, shell } from 'electron';
import path from 'node:path';
import { createRendererServer } from './server';

const isDev = !app.isPackaged;
const VITE_DEV_URL = process.env['VITE_DEV_SERVER_URL'] ?? 'http://localhost:5342';

// In packaged (shore-desktop) mode the app wraps the shore web UI and
// proxies API calls to api-shore. Override with SHORE_PORT env var if needed.
const SHORE_API_PORT = Number(process.env['SHORE_PORT'] ?? 3000);

let mainWindow: BrowserWindow | null = null;
let rendererUrl = '';

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

app.on('ready', () => {
  void (async () => {
    if (isDev) {
      // Dev mode: load Vite dev server (which already proxies /api/* to api-shore).
      rendererUrl = VITE_DEV_URL;
    } else {
      // Packaged mode: serve the bundled web-shore SPA and proxy /api/* to api-shore.
      const rendererDir = path.join(process.resourcesPath, 'renderer');
      const serverPort = await createRendererServer(rendererDir, SHORE_API_PORT);
      rendererUrl = `http://127.0.0.1:${serverPort}`;
      process.stdout.write(`[desktop] renderer on :${serverPort} → api-shore on :${SHORE_API_PORT}\n`);
    }

    createWindow();
  })();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (!mainWindow && rendererUrl) createWindow();
});

// Reserved for future vessel-onboard mode that spawns api-vessel as a child process.
