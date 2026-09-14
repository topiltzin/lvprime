// Thin fetch() wrapper for the local API (server/index.js). No auth, no CORS —
// same-origin local tool (constitution "Local-only" scope).

class ApiError extends Error {
  constructor(message, status, fields) {
    super(message);
    this.status = status;
    this.fields = fields || null;
  }
}

async function request(path, options = {}) {
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

  if (!res.ok) {
    throw new ApiError(
      body?.error || `Request failed (${res.status})`,
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

export function submitFeedback(slug, data) {
  return request(`/api/customers/${encodeURIComponent(slug)}/feedback`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export { ApiError };
