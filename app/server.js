import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { handleApiRequest } from './server/index.js';

// Used locally for `npm start` (production preview of the built app).
// NOT used on Vercel: this project already has a detected frontend
// framework (Vite), so Vercel does a static dist/ deploy and doesn't
// auto-capture this file as a server. On Vercel, api/index.js + the
// vercel.json rewrites serve the same handleApiRequest logic instead.

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIST_DIR = path.join(__dirname, 'dist');
const PORT = process.env.PORT || 4173;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
};

function serveStatic(req, res) {
  let reqPath = new URL(req.url, 'http://localhost').pathname;
  if (reqPath === '/') reqPath = '/index.html';
  let filePath = path.join(DIST_DIR, reqPath);
  if (!filePath.startsWith(DIST_DIR)) {
    res.statusCode = 403;
    res.end('Forbidden');
    return;
  }
  fs.readFile(filePath, (err, data) => {
    if (err) {
      // SPA fallback: unknown routes serve index.html
      fs.readFile(path.join(DIST_DIR, 'index.html'), (err2, indexData) => {
        if (err2) {
          res.statusCode = 404;
          res.end('Not found. Run `npm run build` first.');
          return;
        }
        res.setHeader('Content-Type', MIME['.html']);
        res.end(indexData);
      });
      return;
    }
    res.setHeader('Content-Type', MIME[path.extname(filePath)] || 'application/octet-stream');
    res.end(data);
  });
}

const server = http.createServer(async (req, res) => {
  if (req.url.startsWith('/api') || req.url.startsWith('/customer-files')) {
    try {
      await handleApiRequest(req, res);
    } catch (err) {
      console.error('API error:', err);
      if (!res.headersSent) {
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ error: 'internal_error' }));
      }
    }
    return;
  }
  serveStatic(req, res);
});

server.listen(PORT, () => {
  console.log(`Fitness Plan Dashboard running at http://localhost:${PORT}`);
});
