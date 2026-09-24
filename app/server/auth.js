import crypto from 'node:crypto';

// Coach-only access gate. The API runs with SUPABASE_SECRET_KEY (full DB
// access), so on a public deployment every /api/* and /customer-files/* route
// must be behind the coach password in COACH_ACCESS_TOKEN.
//
// Session = an HttpOnly cookie holding HMAC(token, 'coach-session') — stateless,
// never stores the password itself, and changing COACH_ACCESS_TOKEN logs every
// browser out. A cookie (not an Authorization header) so plain <a href> links to
// /customer-files/* keep working; SameSite=Strict keeps other sites from
// riding on it (CSRF).

const COOKIE_NAME = 'coach_session';
const SESSION_MAX_AGE_S = 30 * 24 * 60 * 60;

let warnedOpen = false;

function getAccessToken() {
  return process.env.COACH_ACCESS_TOKEN || '';
}

function sessionValue(token) {
  return crypto.createHmac('sha256', token).update('coach-session').digest('hex');
}

function safeEqual(a, b) {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  return bufA.length === bufB.length && crypto.timingSafeEqual(bufA, bufB);
}

function readCookie(req, name) {
  const header = req.headers.cookie || '';
  for (const part of header.split(';')) {
    const eq = part.indexOf('=');
    if (eq !== -1 && part.slice(0, eq).trim() === name) return part.slice(eq + 1).trim();
  }
  return null;
}

/** True when COACH_ACCESS_TOKEN is unset (local dev) or the request carries a valid session. */
export function isAuthorized(req) {
  const token = getAccessToken();
  if (!token) {
    if (!warnedOpen) {
      warnedOpen = true;
      console.warn('COACH_ACCESS_TOKEN is not set — the API is open to anyone who can reach it.');
    }
    return true;
  }
  const cookie = readCookie(req, COOKIE_NAME);
  return !!cookie && safeEqual(cookie, sessionValue(token));
}

function cookieHeader(req, value, maxAge) {
  // Secure only over HTTPS, so the session still works on http://localhost.
  const secure = req.headers['x-forwarded-proto'] === 'https' || req.socket?.encrypted;
  return [
    `${COOKIE_NAME}=${value}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Strict',
    `Max-Age=${maxAge}`,
    ...(secure ? ['Secure'] : []),
  ].join('; ');
}

/** Returns the Set-Cookie value for a login attempt, or null if the password is wrong. */
export function loginCookie(req, password) {
  const token = getAccessToken();
  if (!token) return cookieHeader(req, '', 0);
  if (typeof password !== 'string' || !safeEqual(sessionValue(password), sessionValue(token))) return null;
  return cookieHeader(req, sessionValue(token), SESSION_MAX_AGE_S);
}

export function logoutCookie(req) {
  return cookieHeader(req, '', 0);
}
