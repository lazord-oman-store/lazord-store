import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import dotenv from 'dotenv';
import { createServer as createViteServer } from 'vite';
import { handleApiRequest } from './src/server/apiHandler';
import { readStoreState } from './src/server/storePersistence';

dotenv.config();

const PORT = Number(process.env.PORT) || 3000;

const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
};

async function startServer(): Promise<void> {
  await readStoreState();

  const vite =
    process.env.NODE_ENV !== 'production'
      ? await createViteServer({
          server: { middlewareMode: true },
          appType: 'spa',
        })
      : null;

  const distDir = path.resolve(process.cwd(), 'dist');

  const server = http.createServer((req, res) => {
    const reqUrl = req.url || '/';
    const pathname = new URL(reqUrl, 'http://localhost').pathname;

    if (pathname === '/api' || pathname.startsWith('/api/')) {
      void handleApiRequest(req, res);
      return;
    }

    if (vite) {
      vite.middlewares(req, res, () => {
        res.statusCode = 404;
        res.end('Not found');
      });
      return;
    }

    const cleanRel = decodeURIComponent(pathname).replace(/^\/+/, '');
    const candidate = path.resolve(distDir, cleanRel || 'index.html');
    const targetFile =
      candidate.startsWith(distDir + path.sep) &&
      fs.existsSync(candidate) &&
      fs.statSync(candidate).isFile()
        ? candidate
        : path.join(distDir, 'index.html');

    const ext = path.extname(targetFile).toLowerCase();
    res.statusCode = 200;
    res.setHeader('Content-Type', MIME_TYPES[ext] || 'application/octet-stream');
    fs.createReadStream(targetFile).pipe(res);
  });

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`LAZORD server running on http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start LAZORD server:', err);
  process.exit(1);
});
