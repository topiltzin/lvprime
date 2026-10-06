import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MAX_MESSAGE_CHARS, countUnreadOrZero, setMessagesForTests, shapeMessage, unreadByCustomer, validateMessage } from '../../server/lib/messages.js';

const ID = '3f2b8c1e-5a47-4c0e-9d2a-7b1f6e8a9c10';

test('validateMessage trims the text and accepts a valid clientId', () => {
  const r = validateMessage({ body: '  Great week!  ', clientId: ID });
  assert.deepEqual(r, { ok: true, value: { body: 'Great week!', clientId: ID } });
});

test('validateMessage rejects empty and whitespace-only text', () => {
  for (const body of ['', '   ', '\n\t ', undefined, null, 42]) {
    const r = validateMessage({ body, clientId: ID });
    assert.equal(r.ok, false);
    assert.ok(r.fields.body);
  }
});

test('validateMessage allows exactly 1000 characters and rejects 1001', () => {
  assert.equal(validateMessage({ body: 'a'.repeat(MAX_MESSAGE_CHARS), clientId: ID }).ok, true);
  const r = validateMessage({ body: 'a'.repeat(MAX_MESSAGE_CHARS + 1), clientId: ID });
  assert.equal(r.ok, false);
  assert.ok(r.fields.body);
});

test('validateMessage counts characters, not UTF-16 units or bytes', () => {
  assert.equal(validateMessage({ body: '💪'.repeat(MAX_MESSAGE_CHARS), clientId: ID }).ok, true);
  assert.equal(validateMessage({ body: 'ñ'.repeat(MAX_MESSAGE_CHARS), clientId: ID }).ok, true);
});

test('validateMessage requires a UUID clientId', () => {
  for (const clientId of [undefined, '', 'abc', 123, `${ID}x`]) {
    const r = validateMessage({ body: 'hi', clientId });
    assert.equal(r.ok, false);
    assert.ok(r.fields.clientId);
  }
  assert.deepEqual(Object.keys(validateMessage({ body: '', clientId: 'x' }).fields).sort(), ['body', 'clientId']);
});

test('shapeMessage exposes only the contract fields', () => {
  const row = { id: 7, customer_slug: 'ana', sender_role: 'coach', body: 'Hola', client_id: ID, created_at: '2026-10-06T14:02:11Z', read_at: null };
  assert.deepEqual(shapeMessage(row), { id: 7, senderRole: 'coach', body: 'Hola', createdAt: '2026-10-06T14:02:11Z', readAt: null });
  assert.equal(shapeMessage({ ...row, read_at: undefined }).readAt, null);
});

test('countUnreadOrZero returns the count, and 0 (not an error) when counting fails', async (t) => {
  t.after(() => setMessagesForTests(null));
  setMessagesForTests({ countUnread: async (slug, role) => (role === 'coach' ? 3 : 1) });
  assert.equal(await countUnreadOrZero('ana-lopez', 'coach'), 3);
  assert.equal(await countUnreadOrZero('ana-lopez', 'customer'), 1);

  const errors = [];
  const original = console.error;
  console.error = (...args) => errors.push(args.join(' '));
  t.after(() => { console.error = original; });
  setMessagesForTests({ countUnread: async () => { throw new Error('database down'); } });
  assert.equal(await countUnreadOrZero('ana-lopez', 'coach'), 0);
  assert.equal(errors.length, 1);
});

test('unreadByCustomer is the per-customer map the coach overview uses', async (t) => {
  t.after(() => setMessagesForTests(null));
  setMessagesForTests({ unreadByCustomer: async () => new Map([['ana-lopez', 2]]) });
  assert.equal((await unreadByCustomer()).get('ana-lopez'), 2);
});
