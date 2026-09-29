import { askCoachChatbot, ChatbotError, validateChatQuestion } from '../lib/coach-chat.js';
import { readJsonBodyOr422, sendJson } from '../http.js';

// Fitness coach chatbot (specs/013-fitness-coach-chatbot contracts/chat-api.md).
const CHATBOT_ERRORS = {
  chatbot_unavailable: [502, 'The coach assistant is unavailable right now. Try again.'],
  chatbot_timeout: [504, 'The coach assistant took too long to answer. Try again.'],
  chatbot_not_configured: [503, 'The coach assistant is not set up yet.'],
};

export async function handlePostChat(req, res) {
  const body = await readJsonBodyOr422(req, res);
  if (body === undefined) return;

  const result = validateChatQuestion(body);
  if (!result.ok) return sendJson(res, 422, { error: 'validation_failed', fields: result.fields });

  try {
    const answer = await askCoachChatbot(result.question);
    sendJson(res, 200, { answer });
  } catch (err) {
    if (!(err instanceof ChatbotError)) throw err;
    // Outcome only; never the question or answer text.
    console.error('Chatbot error:', err.code, err.cause?.name || '', err.cause?.message || '');
    const [status, message] = CHATBOT_ERRORS[err.code];
    sendJson(res, status, { error: err.code, message });
  }
}
