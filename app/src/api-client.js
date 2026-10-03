// Thin fetch() wrapper for the API (server/index.js). Same-origin, no CORS. Auth is
// a coach session cookie (server/auth.js): on a 401, the handler registered via
// setUnauthorizedHandler (the login screen) takes over the page.

import { getLang, hasString, t } from './lib/i18n.js';

class ApiError extends Error {
  constructor(message, status, fields) {
    super(message);
    this.status = status;
    this.fields = fields || null;
  }
}

let onUnauthorized = null;
let pendingLogin = null;
let onPasswordRequired = null;
let pendingPassword = null;

export function setUnauthorizedHandler(handler) {
  onUnauthorized = handler;
}

// A customer still on the coach's default password gets 403 password_change_required
// from every route; the handler (the set-password screen) takes over the page.
export function setPasswordRequiredHandler(handler) {
  onPasswordRequired = handler;
}

// skipAuthHandler: login() itself answers 401 for a wrong password.
async function request(path, options = {}, skipAuthHandler = false) {
  let res;
  try {
    res = await fetch(path, {
      headers: { 'Content-Type': 'application/json' },
      ...options,
    });
  } catch (err) {
    // A caller's own abort/timeout (askCoach's signal) is not "server unreachable".
    if (err.name === 'AbortError' || err.name === 'TimeoutError') throw err;
    throw new ApiError(t('api.unreachable'), 0);
  }

  let body = null;
  try {
    body = await res.json();
  } catch {
    body = null;
  }

  if (res.status === 401 && onUnauthorized && !skipAuthHandler) {
    // Several requests can 401 at once; they share one login screen.
    pendingLogin ??= onUnauthorized();
    await pendingLogin;
  }

  if (res.status === 403 && body?.error === 'password_change_required' && onPasswordRequired && !skipAuthHandler) {
    pendingPassword ??= onPasswordRequired();
    await pendingPassword;
  }

  if (!res.ok) {
    throw new ApiError(errorMessage(body, res.status), res.status, body?.fields || null);
  }
  return body;
}

// The server's messages are English; outside English, a known error code gets the
// translated message (filled from the response body, e.g. week numbers).
function errorMessage(body, status) {
  const key = body?.error ? `error.${body.error}` : null;
  if (key && getLang() !== 'en' && hasString(key)) return t(key, body);
  return body?.message || body?.error || t('api.failed', { status });
}

export function getCustomers() {
  return request('/api/customers');
}

export function getCustomer(slug) {
  return request(`/api/customers/${encodeURIComponent(slug)}`);
}

export function getProgramWeek(slug, weekNumber) {
  return request(`/api/customers/${encodeURIComponent(slug)}/program/weeks/${weekNumber}`);
}

export function submitFeedback(slug, data) {
  return request(`/api/customers/${encodeURIComponent(slug)}/feedback`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

/** "Mark done" on a Program day: { created, entry } (specs/012 contracts/feedback-api.md). */
export function quickCompleteSession(slug, { date, label }) {
  return request(`/api/customers/${encodeURIComponent(slug)}/feedback/quick-complete`, {
    method: 'POST',
    body: JSON.stringify({ date, label }),
  });
}

/** Saves a Program day's notepad as that session's single entry: { created, entry }. */
export function saveDayNotes(slug, { date, label, notes }) {
  return request(`/api/customers/${encodeURIComponent(slug)}/feedback/day-notes`, {
    method: 'PUT',
    body: JSON.stringify({ date, label, notes }),
  });
}

/** POST /api/chat → { answer } (specs/013 contracts/chat-api.md). Throws ApiError on any non-2xx. */
export function askCoach(message, { signal } = {}) {
  return request('/api/chat', { method: 'POST', body: JSON.stringify({ message }), signal });
}

/** GET /api/chat/history → { messages: [{ role: 'user'|'assistant', content, createdAt }] }. */
export function getChatHistory() {
  return request('/api/chat/history');
}

/** DELETE /api/chat/history: the assistant forgets the conversation. */
export function clearChatHistory() {
  return request('/api/chat/history', { method: 'DELETE' });
}

/** POST /api/customers → { slug, displayName }. 409 customer_exists when the name is taken. */
export function createCustomer(name) {
  return request('/api/customers', { method: 'POST', body: JSON.stringify({ name }) });
}

/** Raw Markdown + version of program (a week), notes or nutrition_plan → { content, version, exists }. */
export function getContent(slug, { fileType, weekNumber } = {}) {
  const params = new URLSearchParams({ file_type: fileType });
  if (weekNumber) params.set('week_number', String(weekNumber));
  return request(`/api/customers/${encodeURIComponent(slug)}/content?${params}`);
}

/** Saves Markdown for program (a week; the next week number creates it), notes or nutrition_plan. */
export function saveContent(slug, { fileType, weekNumber, content, version }) {
  return request(`/api/customers/${encodeURIComponent(slug)}/content`, {
    method: 'PUT',
    body: JSON.stringify({ file_type: fileType, week_number: weekNumber ?? null, content, version }),
  });
}

/** Adds or replaces one dated row of the client's measurements → { measurements }. */
export function addMeasurement(slug, { date, values }) {
  return request(`/api/customers/${encodeURIComponent(slug)}/measurements`, {
    method: 'POST',
    body: JSON.stringify({ date, values }),
  });
}

/** POST /api/customers/<slug>/archive or /restore → { slug, archivedAt }. */
export function setCustomerArchived(slug, archived) {
  return request(`/api/customers/${encodeURIComponent(slug)}/${archived ? 'archive' : 'restore'}`, { method: 'POST' });
}

/** Uploads one file (raw bytes) as a client attachment → { relativePath, sizeBytes, contentType, modifiedAt }. */
export function uploadAttachment(slug, file) {
  const params = new URLSearchParams({ name: file.name });
  return request(`/api/customers/${encodeURIComponent(slug)}/attachments?${params}`, {
    method: 'POST',
    headers: { 'Content-Type': file.type || 'application/octet-stream' },
    body: file,
  });
}

export function deleteAttachment(slug, relativePath) {
  return request(`/api/customers/${encodeURIComponent(slug)}/attachments/${attachmentPath(relativePath)}`, {
    method: 'DELETE',
  });
}

/** "plans/semana 1.pdf" → "plans/semana%201.pdf": each segment encoded, slashes kept. */
export function attachmentPath(relativePath) {
  return relativePath.split('/').map(encodeURIComponent).join('/');
}

/** The download link for an attachment (the server redirects to a short-lived Storage URL). */
export function attachmentUrl(slug, relativePath) {
  return `/customer-files/${encodeURIComponent(slug)}/${attachmentPath(relativePath)}`;
}

export function login(email, password) {
  return request('/api/login', { method: 'POST', body: JSON.stringify({ email, password }) }, true);
}

export function changePassword({ currentPassword, newPassword, confirmPassword }) {
  return request(
    '/api/password',
    { method: 'POST', body: JSON.stringify({ currentPassword, newPassword, confirmPassword }) },
    true
  );
}

export function requestPasswordReset(email) {
  return request('/api/password/forgot', { method: 'POST', body: JSON.stringify({ email }) }, true);
}

export function resetPasswordWithToken({ token, newPassword, confirmPassword }) {
  return request('/api/password/reset', { method: 'POST', body: JSON.stringify({ token, newPassword, confirmPassword }) }, true);
}

export function createCustomerAccess(slug, { email, defaultPassword }) {
  return request(`/api/customers/${encodeURIComponent(slug)}/access`, {
    method: 'POST',
    body: JSON.stringify({ email, defaultPassword }),
  });
}

export function resetCustomerPassword(slug, { defaultPassword }) {
  return request(`/api/customers/${encodeURIComponent(slug)}/access/reset`, {
    method: 'POST',
    body: JSON.stringify({ defaultPassword }),
  });
}

export function logout() {
  return request('/api/logout', { method: 'POST' }, true);
}

/** { authenticated, authDisabled, email, role, slug, mustChangePassword } for routing and the header. */
export function getSession() {
  return request('/api/session', {}, true);
}

export { ApiError };
