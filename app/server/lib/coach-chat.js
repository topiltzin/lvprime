// Fitness coach chatbot proxy (specs/013-fitness-coach-chatbot contracts/chat-api.md).
// The browser sends only the coach's question; the coaching instruction and the
// length cap are added here so they can't be changed from the client, and the
// upstream URL (CHATBOT_URL / GEMINI_API_URL) and keys never reaches the browser. The question/answer text is
// never logged; the conversation itself is kept in Supabase (lib/chat-memory.js) and
// sent back upstream as `messages`, with notes from earlier conversations in `system`.

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

/** The coach prompt, plus what the assistant remembers from earlier conversations (lib/chat-memory.js). */
export function buildSystemPrompt(memory) {
  if (!memory) return COACH_SYSTEM_PROMPT;
  return `${COACH_SYSTEM_PROMPT}\n\nWhat you know about this user from earlier conversations:\n${memory}`;
}

/**
 * The upstream body. `system` + `messages` carry the conversation; `message` is the
 * single-turn form older chatbot deployments read, so either side can deploy first.
 * history: [{ role: 'user'|'assistant', content }], oldest first. memory: notes text or null.
 */
export function buildUpstreamBody(question, history = [], memory = null) {
  return {
    system: buildSystemPrompt(memory),
    messages: [
      ...history.map(({ role, content }) => ({ role, content })),
      { role: 'user', content: question },
    ],
    message: buildCoachMessage(question),
    max_tokens: MAX_TOKENS,
  };
}

/** Sends one question (plus earlier turns and memory notes) upstream and returns the trimmed answer, or throws ChatbotError. No retries. */
export function askCoachChatbot(question, history = [], memory = null) {
  return callChatbot(buildUpstreamBody(question, history, memory));
}

// Memory notes: when a conversation ends, the same chatbot merges it into the notes.
export const SUMMARY_PROMPT =
  'You keep short memory notes about a fitness coach who talks with an assistant. ' +
  'Merge the current notes with the new conversation. Keep only lasting facts: goals, fitness level, ' +
  'injuries or limitations, preferences, and advice already given. Write at most 8 bullet points in spanish, ' +
  'each starting with "- ". Output only the bullet points.';
export const SUMMARY_MAX_TOKENS = 300;
// The Lightning endpoint accepts `system` up to 2000 chars and each message up to
// 8000: the notes go into the coach `system`, notes + transcript into one message.
export const MAX_MEMORY_CHARS = 1500;
const MAX_TRANSCRIPT_CHARS = 5500;
const MAX_TRANSCRIPT_LINE_CHARS = 600;

/** messages: [{ role, content }], oldest first. Keeps the most recent lines that fit. */
export function buildTranscript(messages) {
  const lines = [];
  let length = 0;
  for (const { role, content } of [...messages].reverse()) {
    const line = `${role === 'user' ? 'Coach' : 'Assistant'}: ${content.slice(0, MAX_TRANSCRIPT_LINE_CHARS)}`;
    if (length + line.length > MAX_TRANSCRIPT_CHARS) break;
    lines.unshift(line);
    length += line.length + 1;
  }
  return lines.join('\n');
}

export function buildSummaryBody(currentNotes, messages) {
  const content = `Current notes:\n${currentNotes || '(none)'}\n\nNew conversation:\n${buildTranscript(messages)}`;
  return {
    system: SUMMARY_PROMPT,
    messages: [{ role: 'user', content }],
    message: `${SUMMARY_PROMPT}\n\n${content}`,
    max_tokens: SUMMARY_MAX_TOKENS,
    temperature: 0.3,
  };
}

/** The updated memory notes (trimmed, capped), or throws ChatbotError. */
export async function summarizeIntoNotes(currentNotes, messages) {
  const notes = await callChatbot(buildSummaryBody(currentNotes, messages));
  return notes.slice(0, MAX_MEMORY_CHARS);
}

const GEMINI_DEFAULT_URL = 'https://generativelanguage.googleapis.com/v1beta/interactions';
const GEMINI_DEFAULT_MODEL = 'gemini-3.8-flash';
const GEMINI_API_REVISION = '2026-05-20';

/** CHATBOT_PROVIDER: 'lightning' (default, CHATBOT_URL) or 'gemini' (Interactions API). */
function chatbotProvider() {
  const provider = (process.env.CHATBOT_PROVIDER || 'lightning').trim().toLowerCase();
  if (provider !== 'lightning' && provider !== 'gemini') throw new ChatbotError('chatbot_not_configured');
  return provider;
}

/** The request for the selected provider, built from the shared upstream body. */
function buildRequest(provider, body) {
  if (provider === 'gemini') {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new ChatbotError('chatbot_not_configured');
    // The Interactions API takes one `input`: fold the system prompt and turns into it.
    const turns = body.messages.map(({ role, content }) => `${role === 'user' ? 'User' : 'Assistant'}: ${content}`);
    const input = `${body.system}\n\n${turns.join('\n')}\nAssistant:`;
    return {
      url: process.env.GEMINI_API_URL || GEMINI_DEFAULT_URL,
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey,
        'Api-Revision': GEMINI_API_REVISION,
      },
      body: { model: process.env.GEMINI_MODEL || GEMINI_DEFAULT_MODEL, input },
    };
  }

  const url = process.env.CHATBOT_URL;
  if (!url) throw new ChatbotError('chatbot_not_configured');
  const headers = { 'Content-Type': 'application/json' };
  if (process.env.CHATBOT_API_KEY) headers.Authorization = `Bearer ${process.env.CHATBOT_API_KEY}`;
  return { url, headers, body };
}

/** The answer text from a provider's JSON reply ('' when there is none). */
function extractAnswer(provider, data) {
  if (provider === 'gemini') {
    const texts = [];
    for (const step of Array.isArray(data?.steps) ? data.steps : []) {
      if (step?.type !== 'model_output') continue;
      for (const part of Array.isArray(step.content) ? step.content : []) {
        if (part?.type === 'text' && typeof part.text === 'string') texts.push(part.text);
      }
    }
    return texts.join('').trim();
  }
  return typeof data?.response === 'string' ? data.response.trim() : '';
}

async function callChatbot(body) {
  const provider = chatbotProvider();
  const request = buildRequest(provider, body);

  let res;
  try {
    res = await fetch(request.url, {
      method: 'POST',
      headers: request.headers,
      body: JSON.stringify(request.body),
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

  const answer = extractAnswer(provider, data);
  if (!answer) throw new ChatbotError('chatbot_unavailable', { cause: new Error('empty response') });
  return answer;
}
