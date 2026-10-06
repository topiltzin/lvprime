import { deleteMessage, getMessages, markMessagesRead, sendMessage } from '../api-client.js';
import { applyLang } from '../lib/lang.js';
import { icon } from '../lib/icons.js';
import { getLocale, t } from '../lib/i18n.js';

// The "Messages" tab: one private conversation between the coach and a customer
// (specs/016-coach-client-messaging contracts/messages-ui.md). Not the AI Coach assistant:
// that one is the floating panel in chat-panel.js. Message text only ever reaches the DOM
// through textContent. No realtime: the open tab refreshes on a light poll.

const MAX_CHARS = 1000; // mirrors MAX_MESSAGE_CHARS in server/lib/messages.js
const COUNTER_FROM = 900;
const POLL_MS = 20000;

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

const charCount = (text) => [...text].length;

function formatSentAt(iso) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString(getLocale(), { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

/**
 * Renders the conversation into `container`. Returns { activate, deactivate }: the tab
 * container calls them as the tab is shown or hidden, so nothing is fetched or polled
 * while it is out of view. `onUnreadChange(n)` keeps the tab badge in step.
 */
export function renderMessagesPanel(container, { slug, role, customerName, onUnreadChange = () => {} }) {
  const isCoach = role === 'coach';

  let messages = [];
  let canReply = isCoach;
  let latestCoachRead = null;
  let loaded = false;
  let loading = false;
  let loadFailed = false;
  let active = false;
  let timer = null;
  /** A message being sent, or one that failed and can be retried: { text, clientId, status }. */
  let outgoing = null;
  let overLimit = false;
  let confirmingId = null;

  const root = el('section', 'messages');
  const title = el('h2', 'messages-title', isCoach ? t('messages.titleCoach', { name: customerName || '' }) : t('messages.titleCustomer'));
  const log = el('div', 'messages-log');
  log.setAttribute('role', 'log');
  log.setAttribute('aria-label', title.textContent);
  log.tabIndex = 0; // keyboard users can scroll the thread
  // Announces a newly arrived message once; not the whole log, so a poll never re-reads it.
  const announcer = el('p', 'sr-only');
  announcer.setAttribute('role', 'status');

  const form = el('form', 'messages-form');
  form.noValidate = true;
  const label = el('label', 'messages-label', t('messages.inputLabel'));
  const inputId = `messages-input-${slug}`;
  label.htmlFor = inputId;
  const textarea = el('textarea', 'messages-input');
  textarea.id = inputId;
  textarea.rows = 2;
  textarea.setAttribute('enterkeyhint', 'send');
  textarea.setAttribute('autocomplete', 'off');
  const sendButton = el('button', 'messages-send');
  sendButton.type = 'submit';
  const sendLabel = el('span', '', t('messages.send'));
  sendButton.append(icon('send'), sendLabel);
  const feedback = el('p', 'messages-feedback');
  const feedbackId = `messages-feedback-${slug}`;
  feedback.id = feedbackId;
  textarea.setAttribute('aria-describedby', feedbackId);
  form.append(label, textarea, sendButton, feedback);

  root.append(title, log, announcer, form);
  container.appendChild(root);

  const isMine = (m) => m.senderRole === role;
  const lastIncomingId = () => messages.filter((m) => !isMine(m)).reduce((max, m) => Math.max(max, m.id), 0);
  const newestCoachId = () => messages.filter((m) => m.senderRole === 'coach').reduce((max, m) => Math.max(max, m.id), 0);

  function senderLabel(m) {
    if (m.senderRole === 'coach') return t('messages.senderCoach');
    return isCoach ? customerName || t('messages.senderYou') : t('messages.senderYou');
  }

  function renderDeleteControls(m, actions) {
    if (confirmingId === m.id) {
      actions.appendChild(el('span', '', t('messages.deleteConfirm')));
      const yes = el('button', 'message-confirm-yes', t('messages.deleteNow'));
      yes.type = 'button';
      yes.addEventListener('click', () => removeMessage(m));
      const no = el('button', 'message-confirm-no', t('messages.cancel'));
      no.type = 'button';
      no.addEventListener('click', () => {
        confirmingId = null;
        renderLog();
      });
      actions.append(yes, no);
      return;
    }
    const del = el('button', 'message-delete');
    del.type = 'button';
    del.setAttribute('aria-label', t('messages.delete'));
    del.appendChild(icon('trash'));
    del.addEventListener('click', () => {
      confirmingId = m.id;
      renderLog();
    });
    actions.appendChild(del);
  }

  function renderMessage(m, isNewestCoach) {
    const wrap = el('article', `message ${isMine(m) ? 'message--mine' : 'message--theirs'}`);
    const meta = el('p', 'message-meta');
    const time = el('time', '', formatSentAt(m.createdAt));
    time.dateTime = m.createdAt;
    meta.append(el('span', 'message-sender', senderLabel(m)), time);
    const bubble = el('p', 'message-bubble', m.body);
    applyLang(bubble, m.body);
    wrap.append(meta, bubble);

    // The coach's own messages: whether the newest one has been read, and delete.
    if (isCoach && m.senderRole === 'coach') {
      const actions = el('div', 'message-actions');
      if (isNewestCoach && latestCoachRead !== null) {
        const read = el('span', 'message-read');
        read.append(icon(latestCoachRead ? 'check-circle' : 'clock'), el('span', '', latestCoachRead ? t('messages.read') : t('messages.notRead')));
        actions.appendChild(read);
      }
      renderDeleteControls(m, actions);
      wrap.appendChild(actions);
    }
    return wrap;
  }

  function renderLog({ stickToEnd = false } = {}) {
    const atEnd = log.scrollHeight - log.scrollTop - log.clientHeight < 40;
    const nodes = [];
    if (!loaded && loadFailed) {
      const row = el('div', 'messages-error');
      row.append(icon('warning-circle'), el('span', '', t('messages.loadFailed')));
      const retry = el('button', 'messages-retry');
      retry.type = 'button';
      retry.append(icon('retry'), el('span', '', t('messages.retry')));
      retry.addEventListener('click', () => refresh({ initial: true }));
      row.appendChild(retry);
      nodes.push(row);
    } else if (!loaded) {
      const sk = el('div', 'skeleton-block messages-skeleton');
      sk.setAttribute('aria-label', t('messages.loading'));
      nodes.push(sk);
    } else if (messages.length === 0) {
      nodes.push(el('p', 'messages-empty', isCoach ? t('messages.emptyCoach', { name: customerName || '' }) : t('messages.emptyCustomer')));
    } else {
      const newest = newestCoachId();
      for (const m of messages) nodes.push(renderMessage(m, m.id === newest));
    }
    log.replaceChildren(...nodes);
    if (stickToEnd || atEnd) log.scrollTop = log.scrollHeight;
    renderForm();
  }

  function renderForm() {
    // A customer can only reply once the coach has written (FR-004): until then, no composer.
    form.hidden = !loaded || !canReply;
    const sending = outgoing?.status === 'sending';
    const length = charCount(textarea.value);
    overLimit = length > MAX_CHARS;
    textarea.setAttribute('aria-invalid', String(overLimit));
    sendButton.disabled = sending || !textarea.value.trim() || overLimit;
    sendLabel.textContent = sending ? t('messages.sending') : t('messages.send');

    feedback.replaceChildren();
    if (outgoing?.status === 'failed') {
      const problem = el('span', 'messages-problem');
      problem.append(icon('warning-circle'), el('span', '', outgoing.error));
      const retry = el('button', 'messages-retry');
      retry.type = 'button';
      retry.append(icon('retry'), el('span', '', t('messages.retry')));
      retry.addEventListener('click', submit);
      problem.appendChild(retry);
      feedback.appendChild(problem);
    } else if (overLimit) {
      feedback.appendChild(el('span', 'messages-problem', t('messages.tooLong', { max: MAX_CHARS })));
    }
    if (length >= COUNTER_FROM) {
      feedback.appendChild(el('span', `messages-counter${overLimit ? ' is-over' : ''}`, t('messages.counter', { n: length, max: MAX_CHARS })));
    }
    // Grow with the text up to the CSS max-height, then scroll.
    textarea.style.height = 'auto';
    textarea.style.height = `${textarea.scrollHeight}px`;
  }

  const pageVisible = () => typeof document === 'undefined' || document.visibilityState !== 'hidden';

  function apply(result, { announce }) {
    const previousIncoming = lastIncomingId();
    messages = result.messages;
    canReply = result.canReply;
    latestCoachRead = result.latestCoachMessageRead;
    return announce && lastIncomingId() > previousIncoming;
  }

  async function markReadIfSeen(unread) {
    if (!active || !pageVisible() || unread === 0) return;
    try {
      const { unread: left } = await markMessagesRead(slug);
      onUnreadChange(left);
    } catch {
      // Still unread: the next refresh tries again.
    }
  }

  async function refresh({ initial = false } = {}) {
    if (loading) return;
    loading = true;
    try {
      const result = await getMessages(slug);
      const arrived = apply(result, { announce: loaded });
      loaded = true;
      loadFailed = false;
      confirmingId = confirmingId !== null && messages.some((m) => m.id === confirmingId) ? confirmingId : null;
      renderLog({ stickToEnd: initial || arrived });
      if (arrived) {
        announcer.textContent = '';
        announcer.textContent = t('messages.newArrived');
      }
      await markReadIfSeen(result.unread);
    } catch {
      // A failed poll keeps what is on screen; only the first load shows an error.
      if (!loaded) {
        loadFailed = true;
        renderLog();
      }
    } finally {
      loading = false;
    }
  }

  async function submit(event) {
    event?.preventDefault();
    const text = textarea.value.trim();
    if (!text || charCount(text) > MAX_CHARS || outgoing?.status === 'sending') return;
    // Same text after a failure: reuse the id, so a lost response can't send it twice.
    const clientId = outgoing?.status === 'failed' && outgoing.text === text ? outgoing.clientId : crypto.randomUUID();
    outgoing = { text, clientId, status: 'sending' };
    renderForm();
    try {
      const { message } = await sendMessage(slug, { body: text, clientId });
      if (!messages.some((m) => m.id === message.id)) messages = [...messages, message];
      outgoing = null;
      if (textarea.value.trim() === text) textarea.value = '';
      renderLog({ stickToEnd: true });
      textarea.focus();
    } catch (err) {
      outgoing = { text, clientId, status: 'failed', error: err.fields?.body || t('messages.sendFailed') };
      renderForm();
    }
  }

  async function removeMessage(m) {
    try {
      await deleteMessage(slug, m.id);
      messages = messages.filter((x) => x.id !== m.id);
      confirmingId = null;
      // The "read" line follows the new newest coach message.
      await refresh();
      renderLog();
    } catch {
      confirmingId = null;
      renderLog();
      announcer.textContent = '';
      announcer.textContent = t('messages.deleteFailed');
    }
  }

  textarea.addEventListener('input', () => {
    if (outgoing?.status === 'failed' && outgoing.text !== textarea.value.trim()) outgoing = null;
    renderForm();
  });
  textarea.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && (event.ctrlKey || event.metaKey) && !event.isComposing) submit(event);
  });
  form.addEventListener('submit', submit);

  function stopPolling() {
    clearInterval(timer);
    timer = null;
  }

  function startPolling() {
    stopPolling();
    timer = setInterval(() => {
      // Gone from the page (route change) or not on screen: stop quietly.
      if (!root.isConnected) return stopPolling();
      if (active && pageVisible()) refresh();
    }, POLL_MS);
  }

  document.addEventListener('visibilitychange', function onVisible() {
    if (!root.isConnected) return document.removeEventListener('visibilitychange', onVisible);
    if (active && pageVisible()) refresh();
  });

  renderLog();

  return {
    activate() {
      active = true;
      refresh({ initial: !loaded });
      startPolling();
    },
    deactivate() {
      active = false;
      stopPolling();
    },
  };
}
