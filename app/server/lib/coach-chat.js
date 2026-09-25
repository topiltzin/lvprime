// Fitness coach chatbot proxy (specs/013-fitness-coach-chatbot contracts/chat-api.md).
// The browser sends only the coach's question; the coaching instruction and the
// length cap are added here so they can't be changed from the client, and the
// upstream URL (CHATBOT_URL) never reaches the browser. Nothing is stored, and the
// question/answer text is never logged.

export const COACH_INSTRUCTION =
  'You are a fitness coach in spanish ready to help. Answer in 2-4 short sentences in spanish or at most 4 short bullet points. Question: ';
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

/** Sends one question upstream and returns the trimmed answer, or throws ChatbotError. No retries. */
export async function askCoachChatbot(question) {
  const url = process.env.CHATBOT_URL;
  if (!url) throw new ChatbotError('chatbot_not_configured');

  let res;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: buildCoachMessage(question), max_tokens: MAX_TOKENS }),
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
