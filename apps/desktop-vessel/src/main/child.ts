import { spawn } from 'node:child_process';
import type { ChildProcess } from 'node:child_process';
import path from 'node:path';

/**
 * Spawns the api-vessel NestJS server as a child of the Electron process.
 *
 * In a packaged app `process.resourcesPath` points to the extraResources
 * directory created by electron-builder.  We run it with ELECTRON_RUN_AS_NODE
 * so that the Electron binary acts as a plain Node.js runtime.
 */
export function spawnApiVessel(port: number): ChildProcess {
  const serverScript = path.join(process.resourcesPath, 'api-vessel', 'dist', 'main.js');

  const child = spawn(process.execPath, [serverScript], {
    env: {
      ...process.env,
      PORT: String(port),
      NODE_ENV: 'production',
      ELECTRON_RUN_AS_NODE: '1',
    },
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
