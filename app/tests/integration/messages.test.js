import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { startTestServer } from './helpers.js';
import { setAdminForTests, setSignInForTests } from '../../server/auth.js';
import { CustomerNotFoundError, setAccountsForTests } from '../../server/lib/customer-data.js';
import { setMessagesForTests } from '../../server/lib/messages.js';

// Coach-client messages (specs/016-coach-client-messaging). Supabase Auth, the customers
// table and customer_messages are replaced by in-memory fakes, so no network is needed.

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

  const rows = [];
  let nextId = 1;
  const forSlug = (slug) => rows.filter((m) => m.customer_slug === slug);
  const other = (role) => (role === 'coach' ? 'customer' : 'coach');
  setMessagesForTests({
    async exists(slug) {
      return customers.has(slug);
    },
    async list(slug, limit) {
      return forSlug(slug).slice(-limit).map((m) => ({ ...m }));
    },
    async insert(slug, senderRole, body, clientId) {
      const existing = forSlug(slug).find((m) => m.client_id === clientId);
      if (existing) return { row: { ...existing }, created: false };
      const m = { id: nextId++, customer_slug: slug, sender_role: senderRole, body, client_id: clientId, created_at: new Date().toISOString(), read_at: null };
      rows.push(m);
      return { row: { ...m }, created: true };
    },
    async hasCoachMessage(slug) {
      return forSlug(slug).some((m) => m.sender_role === 'coach');
    },
    async markRead(slug, viewerRole) {
      const pending = forSlug(slug).filter((m) => m.sender_role === other(viewerRole) && !m.read_at);
      for (const m of pending) m.read_at = new Date().toISOString();
      return pending.length;
    },
    async countUnread(slug, viewerRole) {
      return forSlug(slug).filter((m) => m.sender_role === other(viewerRole) && !m.read_at).length;
    },
    async latestCoachMessageRead(slug) {
      const coach = forSlug(slug).filter((m) => m.sender_role === 'coach');
      return coach.length ? coach[coach.length - 1].read_at != null : null;
    },
    async deleteCoachMessage(slug, id) {
      const i = rows.findIndex((m) => m.customer_slug === slug && m.sender_role === 'coach' && m.id === id);
      if (i < 0) return false;
      rows.splice(i, 1);
      return true;
    },
    async unreadByCustomer() {
      const counts = new Map();
      for (const m of rows) if (m.sender_role === 'customer' && !m.read_at) counts.set(m.customer_slug, (counts.get(m.customer_slug) ?? 0) + 1);
      return counts;
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
  const send = (cookie, slug, body, clientId = randomUUID()) =>
    call(`/api/customers/${slug}/messages`, { method: 'POST', cookie, body: { body, clientId } });
  const thread = async (cookie, slug) => (await call(`/api/customers/${slug}/messages`, { cookie })).json();
  const markRead = (cookie, slug) => call(`/api/customers/${slug}/messages/read`, { method: 'POST', cookie });
  const cookies = { coach: await login(COACH), ana: await login(ANA), luis: await login(LUIS) };
  return { world, call, send, thread, markRead, cookies, ANA, LUIS };
}

// ---- US1: the coach sends, the customer reads ----

test('coach sends a message and the customer reads it', async (t) => {
  const { cookies, send, thread, markRead } = await setup(t);
  const res = await send(cookies.coach, ANA.slug, '  Great week!  ');
  assert.equal(res.status, 201);
  const { message } = await res.json();
  assert.equal(message.senderRole, 'coach');
  assert.equal(message.body, 'Great week!');
  assert.equal(message.readAt, null);

  const seen = await thread(cookies.ana, ANA.slug);
  assert.deepEqual(seen.messages.map((m) => m.body), ['Great week!']);
  assert.equal(seen.unread, 1);

  const marked = await (await markRead(cookies.ana, ANA.slug)).json();
  assert.deepEqual(marked, { marked: 1, unread: 0 });
  assert.equal((await thread(cookies.ana, ANA.slug)).unread, 0);
});

test('messages come back oldest first', async (t) => {
  const { cookies, send, thread } = await setup(t);
  for (const text of ['one', 'two', 'three']) await send(cookies.coach, ANA.slug, text);
  assert.deepEqual((await thread(cookies.coach, ANA.slug)).messages.map((m) => m.body), ['one', 'two', 'three']);
});

test('empty, whitespace-only and over-long messages are refused with a field error', async (t) => {
  const { cookies, send, world } = await setup(t);
  for (const text of ['', '   \n ']) {
    const res = await send(cookies.coach, ANA.slug, text);
    assert.equal(res.status, 422);
    assert.ok((await res.json()).fields.body);
  }
  assert.equal((await send(cookies.coach, ANA.slug, 'a'.repeat(1001))).status, 422);
  assert.equal((await send(cookies.coach, ANA.slug, 'a'.repeat(1000))).status, 201);
  const noId = await send(cookies.coach, ANA.slug, 'hi', 'not-a-uuid');
  assert.equal(noId.status, 422);
  assert.ok((await noId.json()).fields.clientId);
  assert.equal(world.rows.length, 1);
});

test('a customer only reaches their own conversation; signed-out gets nothing', async (t) => {
  const { cookies, send, thread, call } = await setup(t);
  await send(cookies.coach, LUIS.slug, 'for Luis only');

  assert.equal((await call(`/api/customers/${LUIS.slug}/messages`, { cookie: cookies.ana })).status, 404);
  assert.equal((await send(cookies.ana, LUIS.slug, 'hi')).status, 404);
  assert.equal((await call(`/api/customers/${LUIS.slug}/messages/read`, { method: 'POST', cookie: cookies.ana })).status, 404);
  assert.equal((await call(`/api/customers/${LUIS.slug}/messages/1`, { method: 'DELETE', cookie: cookies.ana })).status, 404);
  assert.deepEqual((await thread(cookies.ana, ANA.slug)).messages, []); // Ana's own thread has none of Luis's

  assert.equal((await call(`/api/customers/${ANA.slug}/messages`)).status, 401);
  assert.equal((await call(`/api/customers/${ANA.slug}/messages`, { method: 'POST', body: { body: 'x', clientId: randomUUID() } })).status, 401);
});

test('the coach gets 404 for a customer that does not exist', async (t) => {
  const { cookies, send, call } = await setup(t);
  assert.equal((await call('/api/customers/nobody-here/messages', { cookie: cookies.coach })).status, 404);
  assert.equal((await send(cookies.coach, 'nobody-here', 'hi')).status, 404);
});

test('only the coach deletes, and only their own messages', async (t) => {
  const { cookies, send, thread, call } = await setup(t);
  const coachMsg = (await (await send(cookies.coach, ANA.slug, 'mine')).json()).message;
  const replyMsg = (await (await send(cookies.ana, ANA.slug, 'reply')).json()).message;

  const asCustomer = await call(`/api/customers/${ANA.slug}/messages/${coachMsg.id}`, { method: 'DELETE', cookie: cookies.ana });
  assert.equal(asCustomer.status, 403);
  const reply = await call(`/api/customers/${ANA.slug}/messages/${replyMsg.id}`, { method: 'DELETE', cookie: cookies.coach });
  assert.equal(reply.status, 404);
  assert.equal((await reply.json()).error, 'message_not_found');
  assert.equal((await call(`/api/customers/${ANA.slug}/messages/9999`, { method: 'DELETE', cookie: cookies.coach })).status, 404);
  assert.equal((await call(`/api/customers/${ANA.slug}/messages/abc`, { method: 'DELETE', cookie: cookies.coach })).status, 404);

  const ok = await call(`/api/customers/${ANA.slug}/messages/${coachMsg.id}`, { method: 'DELETE', cookie: cookies.coach });
  assert.equal(ok.status, 200);
  assert.deepEqual(await ok.json(), { deleted: true });
  assert.deepEqual((await thread(cookies.coach, ANA.slug)).messages.map((m) => m.body), ['reply']);
});

// ---- US2: the customer replies ----

test('a customer cannot write before the coach has, then can', async (t) => {
  const { cookies, send, thread } = await setup(t);
  assert.equal((await thread(cookies.ana, ANA.slug)).canReply, false);
  const early = await send(cookies.ana, ANA.slug, 'hello?');
  assert.equal(early.status, 409);
  assert.equal((await early.json()).error, 'no_coach_message');

  await send(cookies.coach, ANA.slug, 'Hi Ana');
  assert.equal((await thread(cookies.ana, ANA.slug)).canReply, true);
  const reply = await send(cookies.ana, ANA.slug, 'Hi coach');
  assert.equal(reply.status, 201);
  assert.equal((await reply.json()).message.senderRole, 'customer');

  const seen = await thread(cookies.coach, ANA.slug);
  assert.deepEqual(seen.messages.map((m) => [m.senderRole, m.body]), [['coach', 'Hi Ana'], ['customer', 'Hi coach']]);
  assert.equal(seen.canReply, true);
});

test('the sender is the session role, whatever the body claims', async (t) => {
  const { cookies, call, send } = await setup(t);
  await send(cookies.coach, ANA.slug, 'start');
  const res = await call(`/api/customers/${ANA.slug}/messages`, {
    method: 'POST',
    cookie: cookies.ana,
    body: { body: 'sneaky', clientId: randomUUID(), senderRole: 'coach', sender_role: 'coach' },
  });
  assert.equal((await res.json()).message.senderRole, 'customer');
});

test('the coach sees unread customer replies, and opening the thread clears them', async (t) => {
  const { cookies, send, thread, markRead } = await setup(t);
  await send(cookies.coach, ANA.slug, 'Hi');
  await send(cookies.ana, ANA.slug, 'reply 1');
  await send(cookies.ana, ANA.slug, 'reply 2');
  assert.equal((await thread(cookies.coach, ANA.slug)).unread, 2);
  assert.equal((await thread(cookies.coach, LUIS.slug)).unread, 0);

  assert.deepEqual(await (await markRead(cookies.coach, ANA.slug)).json(), { marked: 2, unread: 0 });
  assert.equal((await thread(cookies.coach, ANA.slug)).unread, 0);
  // The coach opening the thread must not mark the coach's own message as read.
  assert.equal((await thread(cookies.ana, ANA.slug)).unread, 1);
});

test('a repeated clientId stores exactly one message', async (t) => {
  const { cookies, send, world } = await setup(t);
  const id = randomUUID();
  const first = await send(cookies.coach, ANA.slug, 'once', id);
  const second = await send(cookies.coach, ANA.slug, 'once', id);
  assert.equal(first.status, 201);
  assert.equal(second.status, 200);
  assert.equal((await first.json()).message.id, (await second.json()).message.id);
  assert.equal(world.rows.length, 1);
});

test('messages follow the customer: they are gone when the conversation row is removed', async (t) => {
  const { cookies, send, world, thread } = await setup(t);
  await send(cookies.coach, ANA.slug, 'bye');
  // ON DELETE CASCADE in the real table; the fake mirrors it.
  world.rows.splice(0, world.rows.length);
  assert.deepEqual((await thread(cookies.coach, ANA.slug)).messages, []);
});

// ---- US3: read state ----

test('the coach can tell whether the customer has read the latest message', async (t) => {
  const { cookies, send, thread, markRead } = await setup(t);
  assert.equal((await thread(cookies.coach, ANA.slug)).latestCoachMessageRead, null);

  await send(cookies.coach, ANA.slug, 'first');
  assert.equal((await thread(cookies.coach, ANA.slug)).latestCoachMessageRead, false);

  await markRead(cookies.ana, ANA.slug);
  assert.equal((await thread(cookies.coach, ANA.slug)).latestCoachMessageRead, true);

  await send(cookies.coach, ANA.slug, 'second');
  assert.equal((await thread(cookies.coach, ANA.slug)).latestCoachMessageRead, false);
});

test('marking read twice changes nothing the second time', async (t) => {
  const { cookies, send, markRead } = await setup(t);
  await send(cookies.coach, ANA.slug, 'x');
  assert.equal((await (await markRead(cookies.ana, ANA.slug)).json()).marked, 1);
  assert.equal((await (await markRead(cookies.ana, ANA.slug)).json()).marked, 0);
});
