import { deleteWelcome, getMessages, getWelcome, saveWelcome } from '../api-client.js';
import { applyLang } from '../lib/lang.js';
import { getLocale, t } from '../lib/i18n.js';
import { openWelcomePopup } from './welcome-popup.js';
import { showToast } from './toast.js';

// Coach editor for the customer's welcome message (specs/018-welcome-motivation-popup
// contracts/welcome-ui.md): text, delivery day, weekly/once, preview, status, and the
// read-only 016 conversation history. Message text only reaches the DOM via textContent.

const MAX_CHARS = 300; // mirrors MAX_WELCOME_CHARS in server/lib/welcome.js
const WARN_FROM = 270;
// 2024-01-01 is a Monday: index 0..6 → Mon..Sun for localized weekday names.
const MONDAY = Date.UTC(2024, 0, 1);

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

const charCount = (text) => [...text].length;

function weekdayName(weekday, style = 'short') {
  return new Date(MONDAY + (weekday - 1) * 86_400_000).toLocaleDateString(getLocale(), { weekday: style, timeZone: 'UTC' });
}

/** YYYY-MM-DD of an ISO timestamp, in the coach's local time. */
function localDate(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function renderWelcomeEditor(container, { slug, customerName }) {
  let saved = null; // the stored message, or null
  let weekday = 1;

  const root = el('section', 'welcome-editor');

  const field = el('div', 'welcome-field');
  const label = el('label', null, t('welcome.label'));
  label.htmlFor = `welcome-text-${slug}`;
  const hint = el('p', 'welcome-editor-hint', t('welcome.hint'));
  hint.id = `welcome-hint-${slug}`;
  const textarea = el('textarea', 'welcome-textarea');
  textarea.id = label.htmlFor;
  textarea.setAttribute('aria-describedby', hint.id);
  const counter = el('span', 'welcome-counter');
  counter.setAttribute('aria-live', 'polite');
  const error = el('p', 'welcome-error');
  error.setAttribute('role', 'alert');
  field.append(label, hint, textarea, counter, error);

  const dayField = el('fieldset', 'welcome-field');
  const dayLegend = el('legend', null, t('welcome.day'));
  const days = el('div', 'welcome-days');
  days.setAttribute('role', 'radiogroup');
  days.setAttribute('aria-label', t('welcome.day'));
  const dayButtons = [];
  for (let d = 1; d <= 7; d++) {
    const b = el('button', 'welcome-day', weekdayName(d));
    b.type = 'button';
    b.setAttribute('role', 'radio');
    b.setAttribute('aria-label', weekdayName(d, 'long'));
    b.dataset.day = String(d);
    dayButtons.push(b);
    days.appendChild(b);
  }
  dayField.append(dayLegend, days);

  const repeatLabel = el('label', 'welcome-switch');
  const repeat = el('input');
  repeat.type = 'checkbox';
  repeat.checked = true;
  repeatLabel.append(repeat, el('span', null, t('welcome.repeat')));

  const status = el('p', 'welcome-status');
  status.setAttribute('role', 'status');

  const actions = el('div', 'welcome-actions');
  const saveButton = el('button', 'is-primary', t('welcome.save'));
  const previewButton = el('button', null, t('welcome.preview'));
  const removeButton = el('button', null, t('welcome.remove'));
  [saveButton, previewButton, removeButton].forEach((b) => (b.type = 'button'));
  actions.append(saveButton, previewButton, removeButton);

  const history = el('details', 'welcome-history');
  history.hidden = true;

  root.append(field, dayField, repeatLabel, status, actions, history);
  container.appendChild(root);

  function setWeekday(d, { focus = false } = {}) {
    weekday = d;
    dayButtons.forEach((b) => {
      const on = Number(b.dataset.day) === d;
      b.setAttribute('aria-checked', on ? 'true' : 'false');
      b.tabIndex = on ? 0 : -1; // roving tabindex
      if (on && focus) b.focus();
    });
  }

  function updateCounter() {
    const n = charCount(textarea.value);
    counter.textContent = t('welcome.counter', { n, max: MAX_CHARS });
    counter.classList.toggle('is-warning', n >= WARN_FROM && n <= MAX_CHARS);
    counter.classList.toggle('is-over', n > MAX_CHARS);
  }

  function updateStatus() {
    if (!saved) {
      status.textContent = t('welcome.statusNone');
    } else if (saved.status === 'seen' && saved.lastSeenAt) {
      status.textContent = t('welcome.statusSeen', { date: localDate(saved.lastSeenAt) });
    } else {
      status.textContent = t('welcome.statusScheduled', { day: weekdayName(saved.deliveryWeekday, 'long') });
    }
    removeButton.hidden = !saved;
  }

  function fill(message) {
    saved = message;
    textarea.value = message?.body ?? '';
    repeat.checked = message?.repeatWeekly ?? true;
    setWeekday(message?.deliveryWeekday ?? 1);
    updateCounter();
    updateStatus();
  }

  function setBusy(value) {
    [saveButton, previewButton, removeButton].forEach((b) => (b.disabled = value));
    saveButton.textContent = t(value ? 'welcome.saving' : 'welcome.save');
  }

  /** Client-side checks that mirror the server's; returns a message or ''. */
  function problem() {
    const text = textarea.value.trim();
    if (!text) return t('welcome.required');
    if (charCount(text) > MAX_CHARS) return t('welcome.tooLong', { max: MAX_CHARS });
    return '';
  }

  textarea.addEventListener('input', () => {
    error.textContent = '';
    updateCounter();
  });

  days.addEventListener('click', (event) => {
    const button = event.target.closest('.welcome-day');
    if (button) setWeekday(Number(button.dataset.day));
  });
  days.addEventListener('keydown', (event) => {
    const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[event.key];
    if (!step) return;
    event.preventDefault();
    setWeekday(((weekday - 1 + step + 7) % 7) + 1, { focus: true });
  });

  saveButton.addEventListener('click', async () => {
    const issue = problem();
    error.textContent = issue;
    if (issue) return textarea.focus();
    setBusy(true);
    try {
      const { message } = await saveWelcome(slug, { body: textarea.value, deliveryWeekday: weekday, repeatWeekly: repeat.checked });
      fill(message);
      showToast(t('welcome.saved'));
    } catch (err) {
      // The text stays in the box so the coach can retry.
      error.textContent = err.fields?.body || err.message || t('welcome.saveFailed');
    } finally {
      setBusy(false);
    }
  });

  previewButton.addEventListener('click', () => {
    const issue = problem();
    error.textContent = issue;
    if (issue) return textarea.focus();
    // Preview never records "seen": it does not call the API at all.
    openWelcomePopup({ name: customerName ? customerName.split(/\s+/)[0] : '', body: textarea.value.trim(), preview: true });
  });

  removeButton.addEventListener('click', async () => {
    if (!window.confirm(t('welcome.removeConfirm'))) return;
    setBusy(true);
    try {
      await deleteWelcome(slug);
      fill(null);
      showToast(t('welcome.removed'));
    } catch (err) {
      error.textContent = err.message || t('welcome.saveFailed');
    } finally {
      setBusy(false);
    }
  });

  function renderHistory(messages) {
    if (!messages.length) return;
    history.replaceChildren(el('summary', null, t('welcome.history')));
    const list = el('ul', 'welcome-history-list');
    for (const m of messages) {
      const item = el('li', 'welcome-history-item');
      const who = m.senderRole === 'coach' ? t('welcome.historyCoach') : t('welcome.historyCustomer');
      item.append(el('span', 'welcome-history-meta', `${who} · ${localDate(m.createdAt)}`), el('span', null, m.body));
      applyLang(item, m.body);
      list.appendChild(item);
    }
    history.appendChild(list);
    history.hidden = false;
  }

  fill(null);
  setBusy(true);
  getWelcome(slug)
    .then(({ message }) => fill(message))
    .catch((err) => {
      error.textContent = err.message || t('welcome.loadFailed');
    })
    .finally(() => setBusy(false));
  // Old two-way conversation (feature 016): kept for reference, read-only. A failure just hides it.
  getMessages(slug)
    .then(({ messages }) => renderHistory(messages))
    .catch(() => {});
}
