import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import type { AddressInfo } from 'node:net';

const MIME: Record<string, string> = {
  html: 'text/html; charset=utf-8',
  js: 'application/javascript; charset=utf-8',
  mjs: 'application/javascript; charset=utf-8',
  css: 'text/css; charset=utf-8',
  json: 'application/json; charset=utf-8',
  png: 'image/png',
  svg: 'image/svg+xml',
  ico: 'image/x-icon',
  woff2: 'font/woff2',
  woff: 'font/woff',
  map: 'application/json',
};

/**
 * Binds a local HTTP server on a random port that:
 *   - proxies /api/* requests to the api-vessel child on `apiPort`
 *   - serves built SPA files from `staticDir` with SPA index fallback
 *
 * Returns the bound port so the BrowserWindow can load from it.
 */
export function createRendererServer(staticDir: string, apiPort: number): Promise<number> {
  const server = http.createServer((req, res) => {
    const url = req.url ?? '/';

    if (url.startsWith('/api/')) {
      const proxyOpts: http.RequestOptions = {
        hostname: '127.0.0.1',
        port: apiPort,
        path: url,
        headers: { ...req.headers, host: `127.0.0.1:${apiPort}` },
      };
      if (req.method !== undefined) {
        proxyOpts.method = req.method;
      }

      const proxyReq = http.request(proxyOpts, (proxyRes) => {
        res.writeHead(proxyRes.statusCode ?? 502, proxyRes.headers);
        proxyRes.pipe(res, { end: true });
      });

      proxyReq.on('error', () => {
        if (!res.headersSent) {
          res.writeHead(502);
          res.end('api-vessel unavailable');
        }
      });

      req.pipe(proxyReq, { end: true });
      return;
    }

    const reqPath = url.split('?')[0] ?? '/';
    let filePath = path.join(staticDir, reqPath);

    // Guard against path traversal
    if (!filePath.startsWith(staticDir)) {
      filePath = path.join(staticDir, 'index.html');
    }

    try {
      if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
        filePath = path.join(staticDir, 'index.html');
      }
      const content = fs.readFileSync(filePath);
      const ext = path.extname(filePath).slice(1).toLowerCase();
      res.writeHead(200, { 'Content-Type': MIME[ext] ?? 'application/octet-stream' });
      res.end(content);
    } catch {
      res.writeHead(404);
      res.end('Not found');
    }
  });

  return new Promise<number>((resolve, reject) => {
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address() as AddressInfo;
      resolve(addr.port);
    });
    server.once('error', reject);
  });
}
