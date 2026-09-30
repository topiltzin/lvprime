import { getSession } from '../auth.js';
import { askCoachChatbot, ChatbotError, validateChatQuestion } from '../lib/coach-chat.js';
import { endConversation, HISTORY_MESSAGES, loadConversation, MEMORY_MESSAGES, saveTurn } from '../lib/chat-memory.js';
import { readJsonBodyOr422, sendJson } from '../http.js';

// Fitness coach chatbot (specs/013-fitness-coach-chatbot contracts/chat-api.md).
// Memory is per signed-in user (session.sub). With COACH_AUTH_DISABLED there is no
// user, so the chat works without memory and never touches Supabase.
const CHATBOT_ERRORS = {
  chatbot_unavailable: [502, 'The coach assistant is unavailable right now. Try again.'],
  chatbot_timeout: [504, 'The coach assistant took too long to answer. Try again.'],
  chatbot_not_configured: [503, 'The coach assistant is not set up yet.'],
};

function userIdOf(req) {
  return getSession(req)?.sub || null;
}

export async function handlePostChat(req, res) {
  const body = await readJsonBodyOr422(req, res);
  if (body === undefined) return;

  const result = validateChatQuestion(body);
  if (!result.ok) return sendJson(res, 422, { error: 'validation_failed', fields: result.fields });

  const userId = userIdOf(req);
  // Memory is best effort: if Supabase is down the coach still gets an answer.
  let history = [];
  if (userId) {
    try {
      history = await loadConversation(userId, MEMORY_MESSAGES);
    } catch (err) {
      console.error('Chat memory load failed:', err.message);
    }
  }

  let answer;
  try {
    answer = await askCoachChatbot(result.question, history);
  } catch (err) {
    if (!(err instanceof ChatbotError)) throw err;
    // Outcome only; never the question or answer text.
    console.error('Chatbot error:', err.code, err.cause?.name || '', err.cause?.message || '');
    const [status, message] = CHATBOT_ERRORS[err.code];
    return sendJson(res, status, { error: err.code, message });
  }

  if (userId) {
    try {
      await saveTurn(userId, result.question, answer);
    } catch (err) {
      console.error('Chat memory save failed:', err.message);
    }
  }
  sendJson(res, 200, { answer });
}

/** GET /api/chat/history → { messages: [{ role, content, createdAt }] } of the open conversation. */
export async function handleGetChatHistory(req, res) {
  const userId = userIdOf(req);
  const messages = userId ? await loadConversation(userId, HISTORY_MESSAGES) : [];
  sendJson(res, 200, { messages });
}

/** DELETE /api/chat/history → { ok: true }. Ends the open conversation; the model forgets it. */
export async function handleDeleteChatHistory(req, res) {
  const userId = userIdOf(req);
  if (userId) await endConversation(userId);
  sendJson(res, 200, { ok: true });
}
