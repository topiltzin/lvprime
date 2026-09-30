import test from 'node:test';
import assert from 'node:assert/strict';
import {
  COACH_INSTRUCTION,
  COACH_SYSTEM_PROMPT,
  buildCoachMessage,
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
