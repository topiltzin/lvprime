import test from 'node:test';
import assert from 'node:assert/strict';
import { startTestServer } from './helpers.js';

// server/auth.js. No Supabase needed: every request that gets past the gate
// here is one that fails before touching the DB (malformed %-escape → 400).
const TOKEN = 'test-coach-token';
const PAST_AUTH = '/api/customers/%E0%A4%A';

test('with COACH_ACCESS_TOKEN set, the API requires a session from /api/login', async (t) => {
  process.env.COACH_ACCESS_TOKEN = TOKEN;
  const server = await startTestServer(() => {});
  t.after(() => {
    delete process.env.COACH_ACCESS_TOKEN;
    return server.close();
  });

  assert.equal((await fetch(`${server.baseUrl}${PAST_AUTH}`)).status, 401);
  assert.equal((await fetch(`${server.baseUrl}/customer-files/x/plan.pdf`)).status, 401);

  const login = (password) =>
    fetch(`${server.baseUrl}/api/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    });

  const wrong = await login('nope');
  assert.equal(wrong.status, 401);
  assert.equal(wrong.headers.get('set-cookie'), null);

  const right = await login(TOKEN);
  assert.equal(right.status, 200);
  const setCookie = right.headers.get('set-cookie');
  assert.match(setCookie, /HttpOnly/);
  assert.match(setCookie, /SameSite=Strict/);
  const cookie = setCookie.split(';')[0];

  assert.equal((await fetch(`${server.baseUrl}${PAST_AUTH}`, { headers: { cookie } })).status, 400);
  assert.equal(
    (await fetch(`${server.baseUrl}${PAST_AUTH}`, { headers: { cookie: 'coach_session=forged' } })).status,
    401
  );
});

test('without COACH_ACCESS_TOKEN the API stays open (local dev)', async (t) => {
  delete process.env.COACH_ACCESS_TOKEN;
  const server = await startTestServer(() => {});
  t.after(() => server.close());

  assert.equal((await fetch(`${server.baseUrl}${PAST_AUTH}`)).status, 400);
});
