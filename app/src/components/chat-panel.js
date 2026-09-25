import { askCoach } from '../api-client.js';
import { icon } from '../lib/icons.js';

// Floating "Coach assistant" chat (specs/013-fitness-coach-chatbot contracts/chat-panel-ui.md).
// Mounted once on <body>, outside #app, so the conversation survives route changes.
// It lives in memory for the page load only: nothing is stored. Answers are untrusted
// model output and only ever reach the DOM through textContent.

const MAX_CHARS = 1000; // mirrors MAX_QUESTION_CHARS in server/lib/coach-chat.js
const COUNTER_FROM = 900;
const CLIENT_TIMEOUT_MS = 130000; // the server gives up at 120 s; this only covers a lost response
const GREETING = "Hi! I'm your fitness coach assistant. Ask me anything about training or nutrition.";
const ERROR_TEXT = 'The coach assistant is unavailable right now. Try again.';

/** ChatMessage: { id, role: 'coach'|'assistant', text, status?: 'pending'|'answered'|'failed', sentAt } */
const messages = [];
let nextId = 1;
/** { msg, controller } while a question is waiting for its answer. */
let pending = null;
let mounted = false;

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function iconButton(className, iconName, label) {
  const button = el('button', className);
  button.type = 'button';
  button.setAttribute('aria-label', label);
  button.appendChild(icon(iconName));
  return button;
}

export function mountChatPanel(root) {
  if (mounted) return;
  mounted = true;

  const launcher = iconButton('chat-launcher', 'chat', 'Open coach assistant');
  launcher.setAttribute('aria-controls', 'chat-panel');
  launcher.setAttribute('aria-expanded', 'false');

  const panel = el('section', 'chat-panel');
  panel.id = 'chat-panel';
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-label', 'Coach assistant');
  panel.hidden = true;

  const header = el('header', 'chat-header');
  const title = el('h2', 'chat-title', 'Coach assistant');
  const clearButton = el('button', 'chat-clear', 'Clear chat');
  clearButton.type = 'button';
  const closeButton = iconButton('chat-close', 'close', 'Close');
  header.append(title, clearButton, closeButton);

  const log = el('div', 'chat-log');
  log.setAttribute('role', 'log');
  log.setAttribute('aria-live', 'polite');

  const form = el('form', 'chat-form');
  const textarea = el('textarea', 'chat-input');
  textarea.rows = 1;
  textarea.maxLength = MAX_CHARS;
  textarea.placeholder = 'Ask about training or nutrition...';
  textarea.setAttribute('aria-label', 'Ask the coach assistant');
  const sendButton = iconButton('chat-send', 'send', 'Send');
  sendButton.type = 'submit';
  const counter = el('p', 'chat-counter');
  counter.hidden = true;
  counter.setAttribute('aria-live', 'polite');
  form.append(textarea, sendButton, counter);

  panel.append(header, log, form);
  root.append(panel, launcher);

  function updateForm() {
    sendButton.disabled = !textarea.value.trim() || !!pending;
    const length = textarea.value.length;
    counter.hidden = length < COUNTER_FROM;
    counter.textContent = `${length} / ${MAX_CHARS}`;
    // Grow with the text up to the CSS max-height (4 rows), then scroll.
    textarea.style.height = 'auto';
    textarea.style.height = `${textarea.scrollHeight}px`;
  }

  function scrollToEnd() {
    log.scrollTop = log.scrollHeight;
  }

  function renderLog() {
    log.replaceChildren(el('p', 'chat-greeting', GREETING));
    for (const msg of messages) {
      log.appendChild(el('p', `chat-msg chat-msg--${msg.role}`, msg.text));
      if (msg.status === 'failed') log.appendChild(errorRow(msg));
    }
    if (pending) {
      const thinking = el('p', 'chat-thinking', 'Thinking');
      thinking.appendChild(el('span', 'chat-dots'));
      log.appendChild(thinking);
    }
    clearButton.hidden = messages.length === 0;
    updateForm();
    scrollToEnd();
  }

  function errorRow(msg) {
    const row = el('div', 'chat-error');
    row.appendChild(icon('warning-circle'));
    row.appendChild(el('span', 'chat-error-text', ERROR_TEXT));
    const retry = el('button', 'chat-retry');
    retry.type = 'button';
    retry.append(icon('retry'), el('span', '', 'Retry'));
    retry.disabled = !!pending;
    retry.addEventListener('click', () => {
      // The same message goes back to pending: no duplicate bubble.
      msg.status = 'pending';
      msg.sentAt = new Date();
      send(msg);
    });
    row.appendChild(retry);
    return row;
  }

  async function send(msg) {
    const controller = new AbortController();
    pending = { msg, controller };
    renderLog();
    const signal = AbortSignal.any([AbortSignal.timeout(CLIENT_TIMEOUT_MS), controller.signal]);
    try {
      const result = await askCoach(msg.text, { signal });
      if (pending?.msg !== msg) return; // cleared while waiting
      if (!result?.answer) throw new Error('empty answer');
      msg.status = 'answered';
      messages.push({ id: nextId++, role: 'assistant', text: result.answer, sentAt: new Date() });
    } catch {
      if (pending?.msg !== msg) return; // Clear chat aborted it; nothing to show
      msg.status = 'failed';
    }
    pending = null;
    renderLog();
  }

  function setOpen(open) {
    panel.hidden = !open;
    launcher.setAttribute('aria-expanded', String(open));
    launcher.setAttribute('aria-label', open ? 'Close coach assistant' : 'Open coach assistant');
    if (open) {
      scrollToEnd();
      textarea.focus();
    } else {
      launcher.focus();
    }
  }

  launcher.addEventListener('click', () => setOpen(panel.hidden));
  closeButton.addEventListener('click', () => setOpen(false));
  panel.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') setOpen(false);
  });

  clearButton.addEventListener('click', () => {
    if (pending) {
      const { controller } = pending;
      pending = null;
      controller.abort();
    }
    messages.length = 0;
    renderLog();
    textarea.focus();
  });

  textarea.addEventListener('input', updateForm);
  textarea.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
      event.preventDefault();
      form.requestSubmit();
    }
  });

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const text = textarea.value.trim();
    if (!text || pending) return;
    const msg = { id: nextId++, role: 'coach', text, status: 'pending', sentAt: new Date() };
    messages.push(msg);
    textarea.value = '';
    send(msg);
  });

  renderLog();
}
