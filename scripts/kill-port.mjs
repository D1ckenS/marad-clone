#!/usr/bin/env node
// Kills any process occupying a TCP port so the dev server can always bind it.
// Usage: node scripts/kill-port.mjs <port>
import { execSync } from 'child_process';
import net from 'net';

const port = parseInt(process.argv[2] ?? '5173', 10);

const inUse = await new Promise((resolve) => {
  const s = net.createServer();
  s.once('listening', () => {
    s.close();
    resolve(false);
  });
  s.once('error', () => resolve(true));
  s.listen(port);
});

if (!inUse) process.exit(0);

try {
  if (process.platform === 'win32') {
    const out = execSync('netstat -ano', { encoding: 'utf8' });
    const procId = out
      .split('\n')
      .find((l) => l.includes(`:${port}`) && l.includes('LISTENING'))
      ?.trim()
      .split(/\s+/)
      .at(-1);
    if (procId) {
      execSync(`taskkill /F /PID ${procId}`, { stdio: 'ignore' });
      console.log(`kill-port: freed :${port} (PID ${procId})`);
    }
  } else {
    execSync(`lsof -ti:${port} | xargs kill -9`, { stdio: 'ignore', shell: true });
    console.log(`kill-port: freed :${port}`);
  }
} catch {
  // port was freed by the time we tried — that's fine
}
