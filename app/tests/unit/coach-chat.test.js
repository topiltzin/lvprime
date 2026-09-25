import test from 'node:test';
import assert from 'node:assert/strict';
import { COACH_INSTRUCTION, buildCoachMessage, validateChatQuestion } from '../../server/lib/coach-chat.js';

// Fitness coach chatbot (specs/013-fitness-coach-chatbot contracts/chat-api.md).

test('buildCoachMessage prepends the coaching instruction and keeps the question verbatim', () => {
  const message = buildCoachMessage('Beginner diet tips?');
  assert.equal(message, COACH_INSTRUCTION + 'Beginner diet tips?');
  assert.ok(message.startsWith('You are a fitness coach ready to help.'));
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
