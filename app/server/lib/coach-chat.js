// Fitness coach chatbot proxy (specs/013-fitness-coach-chatbot contracts/chat-api.md).
// The browser sends only the coach's question; the coaching instruction and the
// length cap are added here so they can't be changed from the client, and the
// upstream URL (CHATBOT_URL) never reaches the browser. The question/answer text is
// never logged; the conversation itself is kept in Supabase (lib/chat-memory.js) and
// sent back upstream as `messages` so the model remembers it.

export const COACH_SYSTEM_PROMPT =
  'You are a fitness coach in spanish ready to help. Answer in 2-4 short sentences in spanish or at most 4 short bullet points.';
export const COACH_INSTRUCTION = `${COACH_SYSTEM_PROMPT} Question: `;
export const MAX_TOKENS = 200;
export const UPSTREAM_TIMEOUT_MS = 120000;
export const MAX_QUESTION_CHARS = 1000;

/** code: 'chatbot_unavailable' | 'chatbot_timeout' | 'chatbot_not_configured' */
export class ChatbotError extends Error {
  constructor(code, options) {
    super(code, options);
    this.code = code;
  }
}

let timeoutOverrideMs = null;

/** Test-only: shorter upstream timeout; pass null to reset. */
export function setChatTimeoutForTests(ms) {
  timeoutOverrideMs = ms;
}

/** { ok: true, question } with the question trimmed, or { ok: false, fields }. Other body fields are ignored. */
export function validateChatQuestion(body) {
  const message = body?.message;
  const question = typeof message === 'string' ? message.trim() : '';
  if (!question) return { ok: false, fields: { message: 'Enter a question.' } };
  if (question.length > MAX_QUESTION_CHARS) {
    return { ok: false, fields: { message: `Keep questions under ${MAX_QUESTION_CHARS} characters.` } };
  }
  return { ok: true, question };
}

export function buildCoachMessage(question) {
  return COACH_INSTRUCTION + question;
}

/**
 * The upstream body. `system` + `messages` carry the conversation; `message` is the
 * single-turn form older chatbot deployments read, so either side can deploy first.
 * history: [{ role: 'user'|'assistant', content }], oldest first.
 */
export function buildUpstreamBody(question, history = []) {
  return {
    system: COACH_SYSTEM_PROMPT,
    messages: [
      ...history.map(({ role, content }) => ({ role, content })),
      { role: 'user', content: question },
    ],
    message: buildCoachMessage(question),
    max_tokens: MAX_TOKENS,
  };
}

/** Sends one question (plus earlier turns) upstream and returns the trimmed answer, or throws ChatbotError. No retries. */
export async function askCoachChatbot(question, history = []) {
  const url = process.env.CHATBOT_URL;
  if (!url) throw new ChatbotError('chatbot_not_configured');

  const headers = { 'Content-Type': 'application/json' };
  if (process.env.CHATBOT_API_KEY) headers.Authorization = `Bearer ${process.env.CHATBOT_API_KEY}`;

  let res;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(buildUpstreamBody(question, history)),
      signal: AbortSignal.timeout(timeoutOverrideMs ?? UPSTREAM_TIMEOUT_MS),
    });
  } catch (err) {
    const timedOut = err.name === 'TimeoutError' || err.name === 'AbortError';
    throw new ChatbotError(timedOut ? 'chatbot_timeout' : 'chatbot_unavailable', { cause: err });
  }

  if (!res.ok) {
    throw new ChatbotError('chatbot_unavailable', { cause: new Error(`upstream status ${res.status}`) });
  }

  let data;
  try {
    data = await res.json();
  } catch (err) {
    // The body can also time out mid-read.
    // A parse error's message quotes the body, which may hold answer text: don't keep it.
    const timedOut = err.name === 'TimeoutError' || err.name === 'AbortError';
    if (timedOut) throw new ChatbotError('chatbot_timeout', { cause: err });
    throw new ChatbotError('chatbot_unavailable', { cause: new Error('invalid JSON body') });
  }

  const answer = typeof data?.response === 'string' ? data.response.trim() : '';
  if (!answer) throw new ChatbotError('chatbot_unavailable', { cause: new Error('empty response') });
  return answer;
}
