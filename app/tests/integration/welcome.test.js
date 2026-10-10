import test from 'node:test';
import assert from 'node:assert/strict';
import { startTestServer } from './helpers.js';
import { setAdminForTests, setSignInForTests } from '../../server/auth.js';
import { CustomerNotFoundError, setAccountsForTests } from '../../server/lib/customer-data.js';
import { isoWeekday, setWelcomeForTests, weekStart } from '../../server/lib/welcome.js';

// Welcome motivation message (specs/018-welcome-motivation-popup). Supabase Auth, the
// customers table and welcome_messages are replaced by in-memory fakes, so no network is needed.

const COACH = { id: 'coach-1', email: 'coach@example.com', password: 'Coach-pass1' };
const ANA = { id: 'user-ana', email: 'ana@example.com', slug: 'ana-lopez', password: 'Ana-pass123' };
const LUIS = { id: 'user-luis', email: 'luis@example.com', slug: 'luis-perez', password: 'Luis-pass12' };

// The server only accepts a `today` within a day of its own UTC date, so tests use the real one.
const TODAY = new Date().toISOString().slice(0, 10);
const WEEK = weekStart(TODAY);
const WEEKDAY = isoWeekday(TODAY);
const PREV_WEEK = new Date(Date.parse(WEEK) - 7 * 86_400_000).toISOString().slice(0, 10);

function makeWorld() {
  const users = new Map([COACH, ANA, LUIS].map((u) => [u.id, { ...u }]));
  const customers = new Map(
    [ANA, LUIS].map((u) => [u.slug, { slug: u.slug, name: u.slug, auth_user_id: u.id, must_change_password: false, archived_at: null, updated_at: 'v0' }]),
  );
  const byEmail = (email) => [...users.values()].find((u) => u.email === email);
  setSignInForTests(async (email, password) => {
    const user = byEmail(email);
    return user && user.password === password
      ? { user: { id: user.id, email: user.email } }
      : { error: { status: 400, message: 'Invalid login credentials' } };
  });
  setAdminForTests({});
  const row = (slug) => {
    const r = customers.get(slug);
    if (!r) throw new CustomerNotFoundError(slug);
    return r;
  };
  setAccountsForTests({
    async getByAuthUserId(id) {
      return [...customers.values()].find((c) => c.auth_user_id === id) || null;
    },
    async getAccess(slug) {
      const r = row(slug);
      return { hasAccess: !!r.auth_user_id, authUserId: r.auth_user_id, mustChangePassword: r.must_change_password };
    },
  });

  const rows = new Map();
  setWelcomeForTests({
    async exists(slug) {
      return customers.has(slug);
    },
    async get(slug) {
      return rows.has(slug) ? { ...rows.get(slug) } : null;
    },
    async put(slug, r) {
      rows.set(slug, { ...r });
      return { ...r };
    },
    async remove(slug) {
      rows.delete(slug);
    },
    async markSeen(slug, week) {
      const r = rows.get(slug);
      if (!r) return false;
      r.last_seen_week = week;
      r.last_seen_at = new Date().toISOString();
      return true;
    },
  });
  return { rows, customers };
}

async function setup(t) {
  process.env.COACH_AUTH_DISABLED = 'false';
  process.env.SESSION_SECRET = 'test-session-secret';
  const world = makeWorld();
  const server = await startTestServer(() => {});
  t.after(() => {
    setSignInForTests(null);
    setAdminForTests(null);
    setAccountsForTests(null);
    setWelcomeForTests(null);
    delete process.env.COACH_AUTH_DISABLED;
    delete process.env.SESSION_SECRET;
    return server.close();
  });
  const call = (path, { method = 'GET', body, cookie } = {}) =>
    fetch(`${server.baseUrl}${path}`, {
      method,
      headers: { 'Content-Type': 'application/json', ...(cookie ? { cookie } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
  const login = async (user) => {
    const res = await call('/api/login', { method: 'POST', body: { email: user.email, password: user.password } });
    return res.headers.get('set-cookie')?.split(';')[0];
  };
  const cookies = { coach: await login(COACH), ana: await login(ANA), luis: await login(LUIS) };
  const put = (slug, body, cookie = cookies.coach) => call(`/api/customers/${slug}/welcome`, { method: 'PUT', cookie, body });
  const due = (slug, cookie, today = TODAY) => call(`/api/customers/${slug}/welcome/due?today=${today}`, { cookie });
  const seen = (slug, cookie, weekStartStr = WEEK) => call(`/api/customers/${slug}/welcome/seen`, { method: 'POST', cookie, body: { weekStart: weekStartStr } });
  return { world, call, cookies, put, due, seen };
}

// ---- US1: customer popup -------------------------------------------------------------------

test('a customer gets a due message once, then it is marked seen', async (t) => {
  const { cookies, put, due, seen } = await setup(t);
  await put(ANA.slug, { body: '¡Vamos con todo esta semana!', deliveryWeekday: 1 });

  const first = await (await due(ANA.slug, cookies.ana)).json();
  assert.equal(first.due, true);
  assert.equal(first.message.body, '¡Vamos con todo esta semana!');
  assert.equal(first.weekStart, WEEK);

  const mark = await seen(ANA.slug, cookies.ana, first.weekStart);
  assert.equal(mark.status, 200);
  assert.deepEqual(await mark.json(), { recorded: true });
  assert.deepEqual(await (await due(ANA.slug, cookies.ana)).json(), { due: false });
  // Idempotent.
  assert.deepEqual(await (await seen(ANA.slug, cookies.ana, first.weekStart)).json(), { recorded: true });
});

test('no message means nothing is due and seen is a no-op', async (t) => {
  const { cookies, due, seen } = await setup(t);
  assert.deepEqual(await (await due(ANA.slug, cookies.ana)).json(), { due: false });
  assert.deepEqual(await (await seen(ANA.slug, cookies.ana)).json(), { recorded: false });
});

test('a customer cannot reach another customer or act signed out', async (t) => {
  const { call, cookies, put, due, seen } = await setup(t);
  await put(LUIS.slug, { body: 'Hola Luis' });
  assert.equal((await due(LUIS.slug, cookies.ana)).status, 404);
  assert.equal((await seen(LUIS.slug, cookies.ana)).status, 404);
  assert.equal((await call(`/api/customers/${LUIS.slug}/welcome/due?today=${TODAY}`)).status, 401);
});

test('an archived customer is refused', async (t) => {
  const { world, cookies, put, due } = await setup(t);
  await put(ANA.slug, { body: 'Hola' });
  world.customers.get(ANA.slug).archived_at = '2026-10-01T00:00:00Z';
  const res = await due(ANA.slug, cookies.ana);
  assert.equal(res.status, 403);
  assert.equal((await res.json()).error, 'account_disabled');
});

test('the due check validates today', async (t) => {
  const { cookies, put, due } = await setup(t);
  await put(ANA.slug, { body: 'Hola' });
  for (const bad of ['', 'nope', '2026-02-30', '2001-01-01']) {
    const res = await due(ANA.slug, cookies.ana, bad);
    assert.equal(res.status, 422, `today=${bad}`);
    assert.equal((await res.json()).error, 'validation_failed');
  }
});

test('seen rejects a malformed or non-Monday week', async (t) => {
  const { cookies, put, seen } = await setup(t);
  await put(ANA.slug, { body: 'Hola' });
  const notMonday = new Date(Date.parse(WEEK) + 86_400_000).toISOString().slice(0, 10);
  assert.equal((await seen(ANA.slug, cookies.ana, notMonday)).status, 422);
  assert.equal((await seen(ANA.slug, cookies.ana, 'soon')).status, 422);
});

test('the coach never gets a customer popup', async (t) => {
  const { cookies, put, due } = await setup(t);
  await put(ANA.slug, { body: 'Hola' });
  assert.deepEqual(await (await due(ANA.slug, cookies.coach)).json(), { due: false });
});

// ---- US2: coach authoring -------------------------------------------------------------------

test('the coach saves, reads, edits and removes a message', async (t) => {
  const { cookies, call, put } = await setup(t);
  assert.deepEqual(await (await call(`/api/customers/${ANA.slug}/welcome`, { cookie: cookies.coach })).json(), { message: null });

  const saved = await put(ANA.slug, { body: 'Hola Ana' });
  assert.equal(saved.status, 200);
  const { message } = await saved.json();
  assert.equal(message.body, 'Hola Ana');
  assert.equal(message.deliveryWeekday, 1);
  assert.equal(message.repeatWeekly, true);
  assert.equal(message.status, 'scheduled');

  const edited = await (await put(ANA.slug, { body: 'Hola Ana!', deliveryWeekday: 3, repeatWeekly: false })).json();
  assert.equal(edited.message.deliveryWeekday, 3);
  assert.equal(edited.message.repeatWeekly, false);

  const del = await call(`/api/customers/${ANA.slug}/welcome`, { method: 'DELETE', cookie: cookies.coach });
  assert.deepEqual(await del.json(), { deleted: true });
  assert.deepEqual(await (await call(`/api/customers/${ANA.slug}/welcome`, { cookie: cookies.coach })).json(), { message: null });
  assert.equal((await call(`/api/customers/${ANA.slug}/welcome`, { method: 'DELETE', cookie: cookies.coach })).status, 200);
});

test('invalid messages are rejected with field errors', async (t) => {
  const { put } = await setup(t);
  for (const [payload, field] of [
    [{ body: '' }, 'body'],
    [{ body: '   ' }, 'body'],
    [{ body: 'x'.repeat(301) }, 'body'],
    [{ body: 'ok', deliveryWeekday: 0 }, 'deliveryWeekday'],
    [{ body: 'ok', deliveryWeekday: 8 }, 'deliveryWeekday'],
    [{ body: 'ok', repeatWeekly: 'yes' }, 'repeatWeekly'],
  ]) {
    const res = await put(ANA.slug, payload);
    assert.equal(res.status, 422);
    assert.ok((await res.json()).fields[field], field);
  }
});

test('saving for an unknown customer is a 404', async (t) => {
  const { put } = await setup(t);
  assert.equal((await put('nobody', { body: 'Hola' })).status, 404);
});

test('a customer cannot read or write welcome messages', async (t) => {
  const { call, cookies, put } = await setup(t);
  assert.equal((await put(ANA.slug, { body: 'mine' }, cookies.ana)).status, 403);
  assert.equal((await call(`/api/customers/${ANA.slug}/welcome`, { cookie: cookies.ana })).status, 403);
  assert.equal((await call(`/api/customers/${ANA.slug}/welcome`, { method: 'DELETE', cookie: cookies.ana })).status, 403);
});

test('coach status shows seen after the customer dismisses it', async (t) => {
  const { call, cookies, put, seen } = await setup(t);
  await put(ANA.slug, { body: 'Hola Ana' });
  await seen(ANA.slug, cookies.ana);
  const { message } = await (await call(`/api/customers/${ANA.slug}/welcome`, { cookie: cookies.coach })).json();
  assert.equal(message.status, 'seen');
  assert.ok(message.lastSeenAt);
});

// ---- US3: weekly delivery -----------------------------------------------------------------

test('a message whose day has passed this week is still delivered once (catch-up)', async (t) => {
  const { cookies, put, due, seen } = await setup(t);
  await put(ANA.slug, { body: 'Hola', deliveryWeekday: 1 }); // Monday is never after today
  assert.equal((await (await due(ANA.slug, cookies.ana)).json()).due, true);
  await seen(ANA.slug, cookies.ana);
  assert.equal((await (await due(ANA.slug, cookies.ana)).json()).due, false);
});

test('a delivery day later in the week is not due yet', async (t) => {
  if (WEEKDAY === 7) return t.skip('today is Sunday: no later day exists');
  const { cookies, put, due } = await setup(t);
  await put(ANA.slug, { body: 'Hola', deliveryWeekday: WEEKDAY + 1 });
  assert.equal((await (await due(ANA.slug, cookies.ana)).json()).due, false);
});

test('a weekly message returns the next week; a one-time message does not', async (t) => {
  const { world, cookies, put, due } = await setup(t);
  await put(ANA.slug, { body: 'Weekly', deliveryWeekday: 1, repeatWeekly: true });
  await put(LUIS.slug, { body: 'Once', deliveryWeekday: 1, repeatWeekly: false });
  // Both were dismissed last week.
  for (const slug of [ANA.slug, LUIS.slug]) world.rows.get(slug).last_seen_week = PREV_WEEK;
  assert.equal((await (await due(ANA.slug, cookies.ana)).json()).due, true);
  assert.equal((await (await due(LUIS.slug, cookies.luis)).json()).due, false);
});

test('editing the text after it was seen makes it due again; editing only the day does not', async (t) => {
  const { cookies, put, due, seen } = await setup(t);
  await put(ANA.slug, { body: 'First', deliveryWeekday: 1 });
  await seen(ANA.slug, cookies.ana);

  await put(ANA.slug, { body: 'First', deliveryWeekday: 2 }); // same text
  assert.equal((await (await due(ANA.slug, cookies.ana)).json()).due, false);

  await put(ANA.slug, { body: 'Second', deliveryWeekday: 1 }); // new text
  assert.equal((await (await due(ANA.slug, cookies.ana)).json()).due, true);
});

test('seen on one device hides it everywhere', async (t) => {
  const { cookies, put, due, seen } = await setup(t);
  await put(ANA.slug, { body: 'Hola' });
  const deviceA = await (await due(ANA.slug, cookies.ana)).json();
  const deviceB = await (await due(ANA.slug, cookies.ana)).json();
  assert.equal(deviceA.due && deviceB.due, true);
  await seen(ANA.slug, cookies.ana, deviceA.weekStart);
  assert.equal((await (await due(ANA.slug, cookies.ana)).json()).due, false);
});
