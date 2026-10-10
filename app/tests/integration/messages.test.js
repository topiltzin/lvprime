import test from 'node:test';
import assert from 'node:assert/strict';
import { startTestServer } from './helpers.js';
import { setAdminForTests, setSignInForTests } from '../../server/auth.js';
import { CustomerNotFoundError, setAccountsForTests } from '../../server/lib/customer-data.js';
import { setMessagesForTests } from '../../server/lib/messages.js';

// The old coach-client conversation (specs/016) is read-only history since feature 018.
// Supabase Auth, the customers table and customer_messages are replaced by in-memory fakes.

const COACH = { id: 'coach-1', email: 'coach@example.com', password: 'Coach-pass1' };
const ANA = { id: 'user-ana', email: 'ana@example.com', slug: 'ana-lopez', password: 'Ana-pass123' };
const LUIS = { id: 'user-luis', email: 'luis@example.com', slug: 'luis-perez', password: 'Luis-pass12' };

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

  const rows = [
    { id: 1, customer_slug: ANA.slug, sender_role: 'coach', body: 'Great week!', client_id: 'a', created_at: '2026-10-01T10:00:00Z', read_at: null },
    { id: 2, customer_slug: ANA.slug, sender_role: 'customer', body: 'Thanks!', client_id: 'b', created_at: '2026-10-01T11:00:00Z', read_at: null },
  ];
  setMessagesForTests({
    async exists(slug) {
      return customers.has(slug);
    },
    async list(slug, limit) {
      return rows.filter((m) => m.customer_slug === slug).slice(-limit).map((m) => ({ ...m }));
    },
  });
  return { rows, customers };
}

async function setup(t) {
  process.env.COACH_AUTH_DISABLED = 'false';
  process.env.SESSION_SECRET = 'test-session-secret';
  makeWorld();
  const server = await startTestServer(() => {});
  t.after(() => {
    setSignInForTests(null);
    setAdminForTests(null);
    setAccountsForTests(null);
    setMessagesForTests(null);
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
  return { call, cookies: { coach: await login(COACH), ana: await login(ANA) } };
}

test('the coach reads the old conversation, oldest first', async (t) => {
  const { call, cookies } = await setup(t);
  const res = await call(`/api/customers/${ANA.slug}/messages`, { cookie: cookies.coach });
  assert.equal(res.status, 200);
  const { messages } = await res.json();
  assert.deepEqual(messages.map((m) => [m.id, m.senderRole, m.body]), [[1, 'coach', 'Great week!'], [2, 'customer', 'Thanks!']]);
});

test('customers cannot read the conversation, and signed-out gets nothing', async (t) => {
  const { call, cookies } = await setup(t);
  assert.equal((await call(`/api/customers/${ANA.slug}/messages`, { cookie: cookies.ana })).status, 403);
  assert.equal((await call(`/api/customers/${ANA.slug}/messages`)).status, 401);
});

test('an unknown customer is a 404', async (t) => {
  const { call, cookies } = await setup(t);
  assert.equal((await call('/api/customers/nobody/messages', { cookie: cookies.coach })).status, 404);
});

test('nobody can write to the conversation any more', async (t) => {
  const { call, cookies } = await setup(t);
  for (const cookie of [cookies.coach, cookies.ana]) {
    assert.equal((await call(`/api/customers/${ANA.slug}/messages`, { method: 'POST', cookie, body: { body: 'hi' } })).status, 404);
    assert.equal((await call(`/api/customers/${ANA.slug}/messages/read`, { method: 'POST', cookie })).status, 404);
    assert.equal((await call(`/api/customers/${ANA.slug}/messages/1`, { method: 'DELETE', cookie })).status, 404);
  }
});
