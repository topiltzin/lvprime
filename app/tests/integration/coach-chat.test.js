// POST /api/chat (specs/013-fitness-coach-chatbot contracts/chat-api.md). A local stub
// HTTP server stands in for the Lightning AI chatbot, so nothing leaves the machine
// and no Supabase is needed.
import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { startTestServer } from './helpers.js';
import { COACH_INSTRUCTION, setChatTimeoutForTests } from '../../server/lib/coach-chat.js';

const UNAVAILABLE = 'The coach assistant is unavailable right now. Try again.';

async function startStubChatbot(handler) {
  const received = [];
  const server = http.createServer((req, res) => {
    let data = '';
    req.on('data', (chunk) => (data += chunk));
    req.on('end', () => {
      received.push(JSON.parse(data));
      handler(req, res);
    });
  });
  await new Promise((resolve) => server.listen(0, resolve));
  return {
    received,
    url: `http://localhost:${server.address().port}/chat`,
    close: () => new Promise((resolve) => {
      server.closeAllConnections();
      server.close(resolve);
    }),
  };
}

function reply(status, body) {
  return (req, res) => {
    res.statusCode = status;
    res.setHeader('Content-Type', 'application/json');
    res.end(typeof body === 'string' ? body : JSON.stringify(body));
  };
}

// One app server + one stub per test; CHATBOT_URL points at the stub.
async function setup(t, handler) {
  const stub = await startStubChatbot(handler);
  process.env.CHATBOT_URL = stub.url;
  const app = await startTestServer(() => {});
  t.after(async () => {
    delete process.env.CHATBOT_URL;
    await app.close();
    await stub.close();
  });
  const ask = (body) =>
    fetch(`${app.baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: typeof body === 'string' ? body : JSON.stringify(body),
    });
  return { stub, ask };
}

test('answers with the trimmed upstream response and sends the coaching instruction', async (t) => {
  const { stub, ask } = await setup(t, reply(200, { response: '  Eat protein at every meal.  ' }));

  const res = await ask({ message: 'Beginner diet tips?' });
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { answer: 'Eat protein at every meal.' });
  assert.deepEqual(stub.received[0], {
    message: COACH_INSTRUCTION + 'Beginner diet tips?',
    max_tokens: 200,
  });

  await ask({ message: 'Warm-up for squats?', max_tokens: 5000 });
  assert.equal(stub.received[1].max_tokens, 200);
});

test('rejects blank questions with 422 without calling the chatbot', async (t) => {
  const { stub, ask } = await setup(t, reply(200, { response: 'x' }));

  const res = await ask({ message: '   ' });
  assert.equal(res.status, 422);
  assert.deepEqual(await res.json(), { error: 'validation_failed', fields: { message: 'Enter a question.' } });

  const invalid = await ask('{not json');
  assert.equal(invalid.status, 422);
  assert.deepEqual(await invalid.json(), { error: 'validation_failed', fields: { body: 'invalid JSON' } });

  assert.equal(stub.received.length, 0);
});

test('maps upstream failures to 502 chatbot_unavailable', async (t) => {
  const cases = [
    ['upstream 500', reply(500, { detail: 'boom' })],
    ['blank response', reply(200, { response: '   ' })],
    ['missing response', reply(200, {})],
    ['non-string response', reply(200, { response: 42 })],
    ['non-JSON body', reply(200, 'oops')],
  ];
  for (const [name, handler] of cases) {
    await t.test(name, async (st) => {
      const { ask } = await setup(st, handler);
      const res = await ask({ message: 'hi' });
      assert.equal(res.status, 502);
      assert.deepEqual(await res.json(), { error: 'chatbot_unavailable', message: UNAVAILABLE });
    });
  }
});

test('an unreachable chatbot is 502 chatbot_unavailable', async (t) => {
  const { ask } = await setup(t, reply(200, {}));
  process.env.CHATBOT_URL = 'http://localhost:9/chat';

  const res = await ask({ message: 'hi' });
  assert.equal(res.status, 502);
  assert.deepEqual(await res.json(), { error: 'chatbot_unavailable', message: UNAVAILABLE });
});

test('a missing CHATBOT_URL is 503 chatbot_not_configured', async (t) => {
  const { stub, ask } = await setup(t, reply(200, {}));
  delete process.env.CHATBOT_URL;

  const res = await ask({ message: 'hi' });
  assert.equal(res.status, 503);
  assert.deepEqual(await res.json(), {
    error: 'chatbot_not_configured',
    message: 'The coach assistant is not set up yet.',
  });
  assert.equal(stub.received.length, 0);
});

test('a slow chatbot is 504 chatbot_timeout', async (t) => {
  setChatTimeoutForTests(200);
  t.after(() => setChatTimeoutForTests(null));
  const { ask } = await setup(t, (req, res) => setTimeout(reply(200, { response: 'late' }), 1000, req, res));

  const res = await ask({ message: 'hi' });
  assert.equal(res.status, 504);
  assert.deepEqual(await res.json(), {
    error: 'chatbot_timeout',
    message: 'The coach assistant took too long to answer. Try again.',
  });
});

test('signed-out requests get 401 and never reach the chatbot', async (t) => {
  const { stub, ask } = await setup(t, reply(200, { response: 'x' }));
  const previous = process.env.COACH_AUTH_DISABLED;
  process.env.COACH_AUTH_DISABLED = 'false';
  process.env.SESSION_SECRET = 'test-session-secret';
  t.after(() => {
    process.env.COACH_AUTH_DISABLED = previous;
    delete process.env.SESSION_SECRET;
  });

  const res = await ask({ message: 'hi' });
  assert.equal(res.status, 401);
  assert.equal(stub.received.length, 0);
});
