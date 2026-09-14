import { defineConfig } from 'vite';
import { handleApiRequest } from './server/index.js';

// Mounts the local API (server/index.js) into the Vite dev server under /api,
// so the frontend and backend share a single process/port in development.
// See research.md §6 ("Local API architecture: Vite middleware, no separate framework").
function localApiPlugin() {
  return {
    name: 'local-api-middleware',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url || !(req.url.startsWith('/api') || req.url.startsWith('/customer-files'))) {
          next();
          return;
        }
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
      });
    },
  };
}

export default defineConfig({
  root: '.',
  plugins: [localApiPlugin()],
  build: {
    outDir: 'dist',
  },
});
