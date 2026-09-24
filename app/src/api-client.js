// Thin fetch() wrapper for the API (server/index.js). Same-origin, no CORS. Auth is
// a coach session cookie (server/auth.js): on a 401, the handler registered via
// setUnauthorizedHandler (the login screen) takes over the page.

class ApiError extends Error {
  constructor(message, status, fields) {
    super(message);
    this.status = status;
    this.fields = fields || null;
  }
}

let onUnauthorized = null;
let pendingLogin = null;

export function setUnauthorizedHandler(handler) {
  onUnauthorized = handler;
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
    throw new ApiError('Cannot reach the local server. Is `npm run dev` running?', 0);
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

  if (!res.ok) {
    throw new ApiError(
      body?.message || body?.error || `Request failed (${res.status})`,
      res.status,
      body?.fields || null
    );
  }
  return body;
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

export function login(email, password) {
  return request('/api/login', { method: 'POST', body: JSON.stringify({ email, password }) }, true);
}

export function logout() {
  return request('/api/logout', { method: 'POST' }, true);
}

/** { authenticated, authDisabled, email } for the header's account area. */
export function getSession() {
  return request('/api/session', {}, true);
}

export { ApiError };
