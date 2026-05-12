import { app, BrowserWindow, shell } from 'electron';
import path from 'node:path';
import type { ChildProcess } from 'node:child_process';
import { spawnApiVessel } from './child';
import { createRendererServer } from './server';

const isDev = !app.isPackaged;
const VITE_DEV_URL = process.env['VITE_DEV_SERVER_URL'] ?? 'http://localhost:5173';
const VESSEL_PORT = Number(process.env['VESSEL_PORT'] ?? 3001);

let mainWindow: BrowserWindow | null = null;
let apiVesselProcess: ChildProcess | null = null;
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
      // Assumes api-vessel and web-shore Vite dev server are already running
      // (start them with: pnpm run dev:vessel in a separate terminal).
      rendererUrl = VITE_DEV_URL;
    } else {
      apiVesselProcess = spawnApiVessel(VESSEL_PORT);

      // Allow api-vessel 1.5 s to bind its port before opening the window.
      await new Promise<void>((resolve) => {
        const t = setTimeout(resolve, 1500);
        // Don't hold the event loop open just for this timer.
        if (typeof (t as NodeJS.Timeout).unref === 'function') {
          (t as NodeJS.Timeout).unref();
        }
      });

      const rendererDir = path.join(process.resourcesPath, 'renderer');
      const serverPort = await createRendererServer(rendererDir, VESSEL_PORT);
      rendererUrl = `http://127.0.0.1:${serverPort}`;
    }

    createWindow();
  })();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  // macOS: re-open window when clicking the dock icon.
  if (!mainWindow && rendererUrl) createWindow();
});

app.on('before-quit', () => {
  // SIGTERM triggers NestJS graceful shutdown on the child process.
  if (apiVesselProcess && !apiVesselProcess.killed) {
    apiVesselProcess.kill('SIGTERM');
  }
});
