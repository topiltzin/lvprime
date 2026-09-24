import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';

/**
 * Sets up a temporary fixture customers/ directory and an in-memory DB, then
 * starts a real local HTTP server wrapping the app's route handler — per
 * quickstart.md's testing guidance ("Integration tests must not touch the real
 * customers/ directory"). Must be called before importing server/index.js in
 * the same process (it sets the env vars those modules read at import time).
 */
export async function startTestServer(fixtureBuilder) {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fitness-dashboard-fixture-'));
  fixtureBuilder(tmpDir);

  process.env.FITNESS_DASHBOARD_CUSTOMERS_DIR = tmpDir;
  // Data tests exercise routes, not sign-in: leave the coach gate open unless a
  // test (coach-auth.test.js) has set it explicitly.
  process.env.COACH_AUTH_DISABLED ??= 'true';
  process.env.FITNESS_DASHBOARD_DB_PATH = ':memory:';

  // server/index.js is imported once per process and caches a DB singleton;
  // reset it so each test server gets its own fresh in-memory DB rather than
  // reusing whatever a previous test in this file already opened.
  const { handleApiRequest, resetDbForTests } = await import('../../server/index.js');
  resetDbForTests();

  const server = http.createServer(async (req, res) => {
    try {
      await handleApiRequest(req, res);
    } catch (err) {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: 'internal_error', message: err.message }));
    }
  });
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;

  return {
    tmpDir,
    baseUrl: `http://localhost:${port}`,
    async close() {
      await new Promise((resolve) => server.close(resolve));
      fs.rmSync(tmpDir, { recursive: true, force: true });
    },
  };
}

export function writeCustomer(tmpDir, slug, files) {
  const dir = path.join(tmpDir, slug);
  fs.mkdirSync(dir, { recursive: true });
  for (const [relPath, content] of Object.entries(files)) {
    const full = path.join(dir, relPath);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, content);
  }
}
