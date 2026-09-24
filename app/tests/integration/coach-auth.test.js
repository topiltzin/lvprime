import test from 'node:test';
import assert from 'node:assert/strict';
import { startTestServer } from './helpers.js';
import { setSignInForTests } from '../../server/auth.js';

// server/auth.js. No Supabase needed: signIn is stubbed, and every request that
// gets past the gate here fails before touching the DB (malformed %-escape → 400).
const PAST_AUTH = '/api/customers/%E0%A4%A';
const COACH = { id: 'user-1', email: 'coach@example.com' };

function stubSupabase() {
  setSignInForTests(async (email, password) =>
    email === COACH.email && password === 'right-password'
      ? { user: COACH }
      : { error: { status: 400, message: 'Invalid login credentials' } });
}

test('the API requires a session from /api/login (Supabase email + password)', async (t) => {
  process.env.COACH_AUTH_DISABLED = 'false';
  process.env.SESSION_SECRET = 'test-session-secret';
  stubSupabase();
  const server = await startTestServer(() => {});
  t.after(() => {
    setSignInForTests(null);
    delete process.env.COACH_AUTH_DISABLED;
    delete process.env.SESSION_SECRET;
    return server.close();
  });

  assert.equal((await fetch(`${server.baseUrl}${PAST_AUTH}`)).status, 401);
  assert.equal((await fetch(`${server.baseUrl}/customer-files/x/plan.pdf`)).status, 401);

  const login = (body) =>
    fetch(`${server.baseUrl}/api/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

  const invalid = await login({ email: 'not-an-email', password: '' });
  assert.equal(invalid.status, 422);
  assert.deepEqual(Object.keys((await invalid.json()).fields).sort(), ['email', 'password']);

  const wrong = await login({ email: COACH.email, password: 'nope' });
  assert.equal(wrong.status, 401);
  assert.equal(wrong.headers.get('set-cookie'), null);

  const right = await login({ email: ' Coach@Example.com ', password: 'right-password' });
  assert.equal(right.status, 200);
  assert.deepEqual(await right.json(), { email: COACH.email });
  const setCookie = right.headers.get('set-cookie');
  assert.match(setCookie, /HttpOnly/);
  assert.match(setCookie, /SameSite=Strict/);
  const cookie = setCookie.split(';')[0];

  assert.equal((await fetch(`${server.baseUrl}${PAST_AUTH}`, { headers: { cookie } })).status, 400);
  const session = await (await fetch(`${server.baseUrl}/api/session`, { headers: { cookie } })).json();
  assert.equal(session.email, COACH.email);
  assert.equal(session.authenticated, true);

  // A signature that doesn't match the payload is rejected.
  const [data] = cookie.slice('coach_session='.length).split('.');
  const forged = `coach_session=${data}.AAAA`;
  assert.equal((await fetch(`${server.baseUrl}${PAST_AUTH}`, { headers: { cookie: forged } })).status, 401);
  assert.equal(
    (await fetch(`${server.baseUrl}${PAST_AUTH}`, { headers: { cookie: 'coach_session=forged' } })).status,
    401
  );

  const loggedOut = await fetch(`${server.baseUrl}/api/logout`, { method: 'POST', headers: { cookie } });
  assert.match(loggedOut.headers.get('set-cookie'), /Max-Age=0/);
});

test('Supabase outages and rate limits are reported, not treated as wrong passwords', async (t) => {
  process.env.COACH_AUTH_DISABLED = 'false';
  process.env.SESSION_SECRET = 'test-session-secret';
  const server = await startTestServer(() => {});
  t.after(() => {
    setSignInForTests(null);
    delete process.env.COACH_AUTH_DISABLED;
    delete process.env.SESSION_SECRET;
    return server.close();
  });

  const login = () =>
    fetch(`${server.baseUrl}/api/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: COACH.email, password: 'x' }),
    });

  setSignInForTests(async () => ({ error: { status: 429, message: 'rate limited' } }));
  assert.equal((await login()).status, 429);

  setSignInForTests(async () => {
    throw new Error('network down');
  });
  assert.equal((await login()).status, 502);
});

test('with COACH_AUTH_DISABLED=true the API stays open (local dev)', async (t) => {
  process.env.COACH_AUTH_DISABLED = 'true';
  const server = await startTestServer(() => {});
  t.after(() => {
    delete process.env.COACH_AUTH_DISABLED;
    return server.close();
  });

  assert.equal((await fetch(`${server.baseUrl}${PAST_AUTH}`)).status, 400);
  const session = await (await fetch(`${server.baseUrl}/api/session`)).json();
  assert.equal(session.authDisabled, true);
});
