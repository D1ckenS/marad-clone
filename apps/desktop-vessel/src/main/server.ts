import http from 'node:http';
import https from 'node:https';
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

export interface ApiTarget {
  protocol: 'http:' | 'https:';
  hostname: string;
  port: number;
  basePath?: string;
}

/**
 * Binds a local HTTP server on a random port that:
 *   - proxies /api/* requests to the configured API target
 *   - serves built SPA files from `staticDir` with SPA index fallback
 *
 * Returns the bound port so the BrowserWindow can load from it.
 */
export function createRendererServer(staticDir: string, api: ApiTarget): Promise<number> {
  const httpModule = api.protocol === 'https:' ? https : http;

  const server = http.createServer((req, res) => {
    const url = req.url ?? '/';

    if (url.startsWith('/api/')) {
      const proxyPath = (api.basePath ?? '') + url;
      const proxyOpts: http.RequestOptions = {
        hostname: api.hostname,
        port: api.port,
        path: proxyPath,
        headers: { ...req.headers, host: `${api.hostname}:${api.port}` },
      };
      if (req.method !== undefined) {
        proxyOpts.method = req.method;
      }

      const proxyReq = httpModule.request(proxyOpts, (proxyRes) => {
        res.writeHead(proxyRes.statusCode ?? 502, proxyRes.headers);
        proxyRes.pipe(res, { end: true });
      });

      proxyReq.on('error', (err) => {
        if (!res.headersSent) {
          res.writeHead(502, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ error: 'api_unavailable', detail: err.message }));
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

/**
 * Parses a SHORE_URL like `http://192.168.1.5:3000` or `https://api.foo.com`
 * into an ApiTarget. Throws on malformed input.
 */
export function parseShoreUrl(raw: string): ApiTarget {
  const u = new URL(raw);
  if (u.protocol !== 'http:' && u.protocol !== 'https:') {
    throw new Error(`SHORE_URL must be http(s), got ${u.protocol}`);
  }
  const port = u.port ? Number(u.port) : u.protocol === 'https:' ? 443 : 80;
  const basePath = u.pathname.replace(/\/$/, '');
  return {
    protocol: u.protocol,
    hostname: u.hostname,
    port,
    ...(basePath ? { basePath } : {}),
  };
}
