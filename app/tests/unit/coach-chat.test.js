import test from 'node:test';
import assert from 'node:assert/strict';
import {
  COACH_INSTRUCTION,
  COACH_SYSTEM_PROMPT,
  MAX_MEMORY_CHARS,
  SUMMARY_PROMPT,
  askCoachChatbot,
  buildCoachMessage,
  buildSummaryBody,
  buildSystemPrompt,
  buildTranscript,
  buildUpstreamBody,
  validateChatQuestion,
} from '../../server/lib/coach-chat.js';

// Fitness coach chatbot (specs/013-fitness-coach-chatbot contracts/chat-api.md).

test('buildCoachMessage prepends the coaching instruction and keeps the question verbatim', () => {
  const message = buildCoachMessage('Beginner diet tips?');
  assert.equal(message, COACH_INSTRUCTION + 'Beginner diet tips?');
  assert.ok(message.startsWith(COACH_SYSTEM_PROMPT));
});

test('buildUpstreamBody sends earlier turns before the question, plus the single-turn message', () => {
  const history = [
    { role: 'user', content: 'I train 3 days a week.', createdAt: '2026-09-30T10:00:00Z' },
    { role: 'assistant', content: 'Great, full body each day.', createdAt: '2026-09-30T10:00:05Z' },
  ];
  assert.deepEqual(buildUpstreamBody('And on day 2?', history), {
    system: COACH_SYSTEM_PROMPT,
    messages: [
      { role: 'user', content: 'I train 3 days a week.' },
      { role: 'assistant', content: 'Great, full body each day.' },
      { role: 'user', content: 'And on day 2?' },
    ],
    message: COACH_INSTRUCTION + 'And on day 2?',
    max_tokens: 200,
  });
});

test('validateChatQuestion trims a valid question', () => {
  assert.deepEqual(validateChatQuestion({ message: '  hi  ' }), { ok: true, question: 'hi' });
});

test('validateChatQuestion rejects missing, blank and non-string messages', () => {
  for (const body of [{}, { message: '' }, { message: '   ' }, { message: 42 }, null]) {
    assert.deepEqual(validateChatQuestion(body), { ok: false, fields: { message: 'Enter a question.' } });
  }
});

test('validateChatQuestion enforces the 1000-character limit', () => {
  assert.equal(validateChatQuestion({ message: 'a'.repeat(1000) }).ok, true);
  assert.deepEqual(validateChatQuestion({ message: 'a'.repeat(1001) }), {
    ok: false,
    fields: { message: 'Keep questions under 1000 characters.' },
  });
});

test('validateChatQuestion ignores extra fields such as max_tokens', () => {
  assert.deepEqual(validateChatQuestion({ message: 'hi', max_tokens: 5000 }), { ok: true, question: 'hi' });
});

test('buildUpstreamBody adds memory notes to the system prompt only', () => {
  const body = buildUpstreamBody('Hi', [], '- Knee pain: avoid deep lunges');
  assert.equal(body.system, buildSystemPrompt('- Knee pain: avoid deep lunges'));
  assert.ok(body.system.startsWith(COACH_SYSTEM_PROMPT));
  assert.ok(body.system.endsWith('\n- Knee pain: avoid deep lunges'));
  assert.equal(body.message, COACH_INSTRUCTION + 'Hi');
  assert.equal(buildSystemPrompt(null), COACH_SYSTEM_PROMPT);
});

test('memory notes at the cap keep the system prompt under the chatbot limit of 2000', () => {
  assert.ok(buildSystemPrompt('x'.repeat(MAX_MEMORY_CHARS)).length <= 2000);
});

test('buildTranscript labels turns and keeps the most recent ones that fit', () => {
  assert.equal(
    buildTranscript([
      { role: 'user', content: 'Train 3 days?' },
      { role: 'assistant', content: 'Yes, full body.' },
    ]),
    'Coach: Train 3 days?\nAssistant: Yes, full body.'
  );
  const long = Array.from({ length: 40 }, (_, i) => ({ role: 'user', content: `${i} ${'a'.repeat(600)}` }));
  const transcript = buildTranscript(long);
  assert.ok(transcript.length <= 5500);
  assert.ok(transcript.endsWith('a'.repeat(100)) && transcript.includes('Coach: 39 '));
  assert.ok(!transcript.includes('Coach: 0 '));
});

test('buildSummaryBody merges current notes with the conversation in one message', () => {
  const body = buildSummaryBody('- Beginner', [{ role: 'user', content: 'Knee hurts' }]);
  assert.equal(body.system, SUMMARY_PROMPT);
  assert.deepEqual(body.messages, [
    { role: 'user', content: 'Current notes:\n- Beginner\n\nNew conversation:\nCoach: Knee hurts' },
  ]);
  assert.equal(body.max_tokens, 300);
  assert.ok(body.messages[0].content.length <= 8000);
  assert.match(buildSummaryBody(null, []).messages[0].content, /Current notes:\n\(none\)/);
});

// Gemini provider (specs/014-gemini-chatbot-option contracts/provider-config.md).
async function withGemini(reply, run) {
  const realFetch = globalThis.fetch;
  const saved = { ...process.env };
  process.env.CHATBOT_PROVIDER = 'gemini';
  process.env.GEMINI_API_KEY = 'k';
  const calls = [];
  globalThis.fetch = async (url, init) => {
    calls.push({ url, init });
    return { ok: true, json: async () => reply };
  };
  try {
    return await run(calls);
  } finally {
    globalThis.fetch = realFetch;
    for (const key of ['CHATBOT_PROVIDER', 'GEMINI_API_KEY']) {
      if (saved[key] === undefined) delete process.env[key];
      else process.env[key] = saved[key];
    }
  }
}

test('gemini answers join model_output text and ignore thought steps', async () => {
  const reply = {
    steps: [
      { type: 'thought', signature: 'abc' },
      { type: 'model_output', content: [{ type: 'text', text: ' Hola ' }, { type: 'text', text: 'coach ' }] },
    ],
  };
  await withGemini(reply, async (calls) => {
    assert.equal(await askCoachChatbot('hi'), 'Hola coach');
    assert.equal(calls[0].init.headers['x-goog-api-key'], 'k');
    assert.equal(JSON.parse(calls[0].init.body).model, 'gemini-3.8-flash');
  });
});

test('gemini replies without model_output text are chatbot_unavailable', async () => {
  await withGemini({ steps: [{ type: 'thought' }] }, async () => {
    await assert.rejects(askCoachChatbot('hi'), { code: 'chatbot_unavailable' });
  });
});
