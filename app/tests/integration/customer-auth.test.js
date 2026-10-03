import test from 'node:test';
import assert from 'node:assert/strict';
import { startTestServer } from './helpers.js';
import { setEmailSenderForTests } from '../../server/lib/email.js';
import { setAdminForTests, setSignInForTests } from '../../server/auth.js';
import { CustomerNotFoundError, AccessExistsError, setAccountsForTests } from '../../server/lib/customer-data.js';

// Customer profiles (specs/015-login-coach-customer-roles). Supabase Auth and the
// customers table are replaced by an in-memory fake, so no network is needed. "Allowed"
// routes are asserted as "not refused by the gate": past it they reach the (absent)
// database and fail with 500, which is not an authorization answer.

const COACH = { id: 'coach-1', email: 'coach@example.com', password: 'Coach-pass1' };
const ANA = { id: 'user-ana', email: 'ana@example.com', slug: 'ana-lopez' };
const GATE_STATUSES = [401, 403, 404];

function makeWorld() {
  // auth users: id -> { id, email, password }
  const users = new Map([[COACH.id, { ...COACH }]]);
  // customers: slug -> row
  const customers = new Map([
    ['ana-lopez', { slug: 'ana-lopez', name: 'Ana Lopez', auth_user_id: null, must_change_password: false, archived_at: null, updated_at: 'v0' }],
    ['luis-perez', { slug: 'luis-perez', name: 'Luis Perez', auth_user_id: null, must_change_password: false, archived_at: null, updated_at: 'v0' }],
  ]);
  let nextId = 1;
  let version = 0;
  const byEmail = (email) => [...users.values()].find((u) => u.email === email);

  setSignInForTests(async (email, password) => {
    const user = byEmail(email);
    return user && user.password === password
      ? { user: { id: user.id, email: user.email } }
      : { error: { status: 400, message: 'Invalid login credentials' } };
  });
  setAdminForTests({
    async createUser(email, password) {
      if (byEmail(email)) return { error: 'email_taken' };
      const user = { id: `user-${nextId++}`, email, password };
      users.set(user.id, user);
      return { user: { id: user.id, email } };
    },
    async setPassword(id, password) {
      users.get(id).password = password;
      return {};
    },
    async findUserByEmail(email) {
      const u = byEmail(email);
      return { user: u ? { id: u.id, email: u.email } : null };
    },
    async getEmail(id) {
      return { email: users.get(id)?.email ?? null };
    },
    async deleteUser(id) {
      users.delete(id);
      return {};
    },
  });
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
    async link(slug, id) {
      const r = row(slug);
      if (r.auth_user_id) throw new AccessExistsError(slug);
      r.auth_user_id = id;
      r.must_change_password = true;
      r.updated_at = `v${++version}`;
    },
    async setMustChange(slug, value) {
      const r = row(slug);
      r.must_change_password = value;
      r.updated_at = `v${++version}`; // like the real table, any change moves updated_at
    },
  });
  return { users, customers };
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
  const login = async (email, password) => {
    const res = await call('/api/login', { method: 'POST', body: { email, password } });
    return { res, body: await res.json(), cookie: res.headers.get('set-cookie')?.split(';')[0] };
  };
  return { world, call, login };
}

// A customer account the coach just created, with its default password.
async function giveAccess({ call, login }, coachCookie, slug, email, defaultPassword) {
  const res = await call(`/api/customers/${slug}/access`, {
    method: 'POST',
    cookie: coachCookie,
    body: { email, defaultPassword },
  });
  return res;
}

test('sign-in tells the coach and a customer apart', async (t) => {
  const ctx = await setup(t);
  assert.equal((await ctx.call('/api/customers')).status, 401);

  const coach = await ctx.login(COACH.email, COACH.password);
  assert.equal(coach.body.role, 'coach');
  assert.equal((await giveAccess(ctx, coach.cookie, ANA.slug, ANA.email, 'Default123')).status, 201);

  const ana = await ctx.login(ANA.email, 'Default123');
  assert.equal(ana.res.status, 200);
  assert.deepEqual(ana.body, { email: ANA.email, role: 'customer', slug: ANA.slug, mustChangePassword: true });

  const wrong = await ctx.login(ANA.email, 'nope');
  const unknown = await ctx.login('nobody@example.com', 'nope');
  assert.equal(wrong.res.status, 401);
  assert.equal(unknown.res.status, 401);
  assert.equal(wrong.body.message, unknown.body.message); // FR-015
});

test('coach creates access: duplicates and bad input are refused', async (t) => {
  const ctx = await setup(t);
  const coach = await ctx.login(COACH.email, COACH.password);

  const weak = await giveAccess(ctx, coach.cookie, ANA.slug, ANA.email, 'short');
  assert.equal(weak.status, 422);
  assert.ok((await weak.json()).fields.defaultPassword);
  assert.equal((await giveAccess(ctx, coach.cookie, ANA.slug, 'not-an-email', 'Default123')).status, 422);

  assert.equal((await giveAccess(ctx, coach.cookie, ANA.slug, ANA.email, 'Default123')).status, 201);
  const again = await giveAccess(ctx, coach.cookie, ANA.slug, 'other@example.com', 'Default123');
  assert.equal(again.status, 409);
  assert.equal((await again.json()).error, 'access_exists');

  const taken = await giveAccess(ctx, coach.cookie, 'luis-perez', ANA.email, 'Default123');
  assert.equal(taken.status, 409);
  assert.equal((await taken.json()).error, 'email_taken');
  assert.equal(ctx.world.customers.get('luis-perez').auth_user_id, null); // nothing created

  assert.equal((await giveAccess(ctx, coach.cookie, 'nobody-here', 'x@example.com', 'Default123')).status, 404);
});

test('a customer must set their own password before anything else', async (t) => {
  const ctx = await setup(t);
  const coach = await ctx.login(COACH.email, COACH.password);
  await giveAccess(ctx, coach.cookie, ANA.slug, ANA.email, 'Default123');
  const ana = await ctx.login(ANA.email, 'Default123');

  for (const path of [`/api/customers/${ANA.slug}`, `/api/customers/${ANA.slug}/nutrition`, '/api/customers']) {
    const res = await ctx.call(path, { cookie: ana.cookie });
    assert.equal(res.status, 403, path);
    assert.equal((await res.json()).error, 'password_change_required', path);
  }
  const session = await (await ctx.call('/api/session', { cookie: ana.cookie })).json();
  assert.equal(session.mustChangePassword, true);

  const change = (body) => ctx.call('/api/password', { method: 'POST', cookie: ana.cookie, body });
  const base = { currentPassword: 'Default123', newPassword: 'Mine4ever', confirmPassword: 'Mine4ever' };
  assert.equal((await change({ ...base, newPassword: 'short1', confirmPassword: 'short1' })).status, 422);
  assert.equal((await change({ ...base, newPassword: 'Default123', confirmPassword: 'Default123' })).status, 422);
  assert.equal((await change({ ...base, confirmPassword: 'Different1' })).status, 422);
  assert.equal((await change({ ...base, currentPassword: 'wrong-one1' })).status, 401);
  assert.equal(ctx.world.customers.get(ANA.slug).must_change_password, true);

  const done = await change(base);
  assert.equal(done.status, 200);
  assert.equal(ctx.world.customers.get(ANA.slug).must_change_password, false);

  // Gate lifted: the route now runs (and fails past the gate on the absent database).
  const after = await ctx.call(`/api/customers/${ANA.slug}/nutrition`, { cookie: ana.cookie });
  assert.ok(!GATE_STATUSES.includes(after.status));

  // The default no longer signs in; the new password does.
  assert.equal((await ctx.login(ANA.email, 'Default123')).res.status, 401);
  const again = await ctx.login(ANA.email, 'Mine4ever');
  assert.equal(again.body.mustChangePassword, false);
});

test('a customer reaches only their own data and no coach routes', async (t) => {
  const ctx = await setup(t);
  const coach = await ctx.login(COACH.email, COACH.password);
  await giveAccess(ctx, coach.cookie, ANA.slug, ANA.email, 'Default123');
  const first = await ctx.login(ANA.email, 'Default123');
  await ctx.call('/api/password', {
    method: 'POST',
    cookie: first.cookie,
    body: { currentPassword: 'Default123', newPassword: 'Mine4ever', confirmPassword: 'Mine4ever' },
  });
  const { cookie } = await ctx.login(ANA.email, 'Mine4ever');

  // Own slug passes the gate.
  for (const [method, path] of [
    ['GET', `/api/customers/${ANA.slug}`],
    ['GET', `/api/customers/${ANA.slug}/program/weeks`],
    ['GET', `/api/customers/${ANA.slug}/nutrition`],
    ['POST', `/api/customers/${ANA.slug}/feedback`],
  ]) {
    const res = await ctx.call(path, { method, cookie, body: method === 'GET' ? undefined : {} });
    assert.ok(!GATE_STATUSES.includes(res.status), `${method} ${path} → ${res.status}`);
  }

  // The chat assistant is open to customers too (no 401/403; past the gate it needs the chatbot).
  for (const [method, path] of [['POST', '/api/chat'], ['GET', '/api/chat/history']]) {
    const res = await ctx.call(path, { method, cookie, body: method === 'GET' ? undefined : { message: 'hola' } });
    assert.ok(![401, 403].includes(res.status), `${method} ${path} → ${res.status}`);
  }

  // Another customer: 404, same as a customer that does not exist.
  for (const slug of ['luis-perez', 'nobody-here']) {
    const res = await ctx.call(`/api/customers/${slug}`, { cookie });
    assert.equal(res.status, 404, slug);
    assert.equal((await res.json()).error, 'customer_not_found');
  }

  // Coach-only routes.
  for (const [method, path] of [
    ['GET', '/api/customers'],
    ['POST', '/api/customers'],
    ['GET', `/api/customers/${ANA.slug}/content`],
    ['PUT', `/api/customers/${ANA.slug}/content`],
    ['POST', `/api/customers/${ANA.slug}/archive`],
    ['POST', `/api/customers/${ANA.slug}/measurements`],
    ['POST', `/api/customers/${ANA.slug}/attachments`],
    ['POST', `/api/customers/${ANA.slug}/access`],
    ['POST', `/api/customers/${ANA.slug}/access/reset`],
    ['PUT', `/api/customers/${ANA.slug}/feedback/day-notes`], // the coach's notepad
    ['POST', '/api/sync/upload'],
    ['GET', '/api/sync/status'],
  ]) {
    const res = await ctx.call(path, { method, cookie, body: method === 'GET' ? undefined : {} });
    assert.equal(res.status, 403, `${method} ${path}`);
  }
});

test('archiving a customer cuts them off at once; a coach reset forces a new password', async (t) => {
  const ctx = await setup(t);
  const coach = await ctx.login(COACH.email, COACH.password);
  await giveAccess(ctx, coach.cookie, ANA.slug, ANA.email, 'Default123');
  const first = await ctx.login(ANA.email, 'Default123');
  await ctx.call('/api/password', {
    method: 'POST',
    cookie: first.cookie,
    body: { currentPassword: 'Default123', newPassword: 'Mine4ever', confirmPassword: 'Mine4ever' },
  });
  const ana = await ctx.login(ANA.email, 'Mine4ever');
  const ownPath = `/api/customers/${ANA.slug}/nutrition`;
  assert.ok(!GATE_STATUSES.includes((await ctx.call(ownPath, { cookie: ana.cookie })).status));

  // Reset: the existing session is gated again straight away.
  const reset = await ctx.call(`/api/customers/${ANA.slug}/access/reset`, {
    method: 'POST',
    cookie: coach.cookie,
    body: { defaultPassword: 'Fresh12345' },
  });
  assert.equal(reset.status, 200);
  assert.equal((await ctx.call(ownPath, { cookie: ana.cookie })).status, 403);
  assert.equal((await ctx.login(ANA.email, 'Mine4ever')).res.status, 401);
  assert.equal((await ctx.login(ANA.email, 'Fresh12345')).body.mustChangePassword, true);

  // Reset for a client without access.
  const none = await ctx.call('/api/customers/luis-perez/access/reset', {
    method: 'POST',
    cookie: coach.cookie,
    body: { defaultPassword: 'Fresh12345' },
  });
  assert.equal(none.status, 404);

  // Archive: sign-in is refused and the old session stops working.
  ctx.world.customers.get(ANA.slug).must_change_password = false;
  ctx.world.customers.get(ANA.slug).archived_at = new Date().toISOString();
  const refused = await ctx.login(ANA.email, 'Fresh12345');
  assert.equal(refused.res.status, 403);
  assert.equal(refused.body.error, 'account_disabled');
  const old = await ctx.call(ownPath, { cookie: ana.cookie });
  assert.equal(old.status, 403);
  assert.equal((await old.json()).error, 'account_disabled');
});

test('a customer can reset a forgotten password from an emailed link, once', async (t) => {
  const ctx = await setup(t);
  const sent = [];
  setEmailSenderForTests(async (message) => {
    sent.push(message);
  });
  t.after(() => setEmailSenderForTests(null));

  const coach = await ctx.login(COACH.email, COACH.password);
  await giveAccess(ctx, coach.cookie, ANA.slug, ANA.email, 'Default123');
  const post = (path, body) => ctx.call(path, { method: 'POST', body });

  // Same answer for a customer, the coach and a stranger; only the customer is emailed.
  assert.equal((await post('/api/password/forgot', { email: 'bad' })).status, 422);
  for (const email of ['nobody@example.com', COACH.email, ANA.email]) {
    const res = await post('/api/password/forgot', { email });
    assert.equal(res.status, 200, email);
    assert.deepEqual(await res.json(), { ok: true });
  }
  assert.equal(sent.length, 1);
  assert.equal(sent[0].to, ANA.email);
  const token = decodeURIComponent(sent[0].text.match(/token=([^\s]+)/)[1]);

  // Asking again straight away does not send another email.
  await post('/api/password/forgot', { email: ANA.email });
  assert.equal(sent.length, 1);

  const reset = (body) => post('/api/password/reset', { token, newPassword: 'Brand9new', confirmPassword: 'Brand9new', ...body });
  assert.equal((await reset({ token: 'forged.token' })).status, 400);
  assert.equal((await reset({ newPassword: 'short', confirmPassword: 'short' })).status, 422);
  assert.equal((await reset({ confirmPassword: 'Other1234' })).status, 422);

  assert.equal((await reset({})).status, 200);
  assert.equal(ctx.world.customers.get(ANA.slug).must_change_password, false);
  assert.equal((await ctx.login(ANA.email, 'Default123')).res.status, 401);
  assert.equal((await ctx.login(ANA.email, 'Brand9new')).body.mustChangePassword, false);

  // The link is spent.
  assert.equal((await reset({ newPassword: 'Again8pass', confirmPassword: 'Again8pass' })).status, 400);

  // A reset token is not a session.
  const asCookie = await ctx.call('/api/customers', { cookie: `coach_session=${token}` });
  assert.equal(asCookie.status, 401);
});
