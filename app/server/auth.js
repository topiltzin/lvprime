import crypto from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

// Coach-only access gate. The API runs with SUPABASE_SECRET_KEY (full DB access),
// so every /api/* and /customer-files/* route sits behind a signed-in coach.
//
// Sign-in checks email + password against the project's Supabase Auth users
// (signInWithPassword). On success the server issues its own session: an HttpOnly
// cookie holding `payload.signature`, where payload = {sub, email, exp} and the
// signature is an HMAC with SESSION_SECRET (or, when unset, a key derived from
// SUPABASE_SECRET_KEY, so rotating that key logs every browser out). Stateless:
// Supabase is only called at sign-in, not on every request, so removing a user in
// Supabase takes effect when their cookie expires or the secret rotates.
//
// A cookie (not an Authorization header) so plain <a href> links to
// /customer-files/* keep working; SameSite=Strict keeps other sites from riding
// on it (CSRF).
//
// COACH_AUTH_DISABLED=true turns the gate off (local dev only).

const COOKIE_NAME = 'coach_session';
const SESSION_MAX_AGE_S = 30 * 24 * 60 * 60;

let warnedOpen = false;

export function isAuthDisabled() {
  return process.env.COACH_AUTH_DISABLED === 'true';
}

function sessionSecret() {
  if (process.env.SESSION_SECRET) return process.env.SESSION_SECRET;
  if (process.env.SUPABASE_SECRET_KEY) {
    return crypto.createHmac('sha256', process.env.SUPABASE_SECRET_KEY).update('lvprime-coach-session').digest('hex');
  }
  throw new Error('Set SESSION_SECRET or SUPABASE_SECRET_KEY to sign coach sessions.');
}

function sign(data) {
  return crypto.createHmac('sha256', sessionSecret()).update(data).digest('base64url');
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

/** The signed-in user ({ sub, email, role, slug }) for this request, or null. */
export function getSession(req) {
  const raw = readCookie(req, COOKIE_NAME);
  if (!raw) return null;
  const dot = raw.indexOf('.');
  if (dot === -1) return null;
  const data = raw.slice(0, dot);
  if (!safeEqual(raw.slice(dot + 1), sign(data))) return null;
  try {
    const payload = JSON.parse(Buffer.from(data, 'base64url').toString('utf8'));
    if (typeof payload.exp !== 'number' || payload.exp * 1000 < Date.now()) return null;
    // Cookies issued before customer accounts existed carry no role: they are the coach's.
    return {
      sub: payload.sub,
      email: payload.email,
      role: payload.role === 'customer' ? 'customer' : 'coach',
      slug: payload.slug || null,
    };
  } catch {
    return null;
  }
}

/** True when the gate is disabled (local dev) or the request carries a valid session. */
export function isAuthorized(req) {
  if (isAuthDisabled()) {
    if (!warnedOpen) {
      warnedOpen = true;
      console.warn('COACH_AUTH_DISABLED=true: the API is open to anyone who can reach it.');
    }
    return true;
  }
  return getSession(req) !== null;
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

/** Set-Cookie value starting a session for a Supabase user ({ id, email }) and their role. */
export function sessionCookie(req, user, { role = 'coach', slug = null } = {}) {
  const exp = Math.floor(Date.now() / 1000) + SESSION_MAX_AGE_S;
  const payload = { sub: user.id, email: user.email, role, exp };
  if (role === 'customer' && slug) payload.slug = slug;
  const data = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return cookieHeader(req, `${data}.${sign(data)}`, SESSION_MAX_AGE_S);
}

export function logoutCookie(req) {
  return cookieHeader(req, '', 0);
}

async function supabaseSignIn(email, password) {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) throw new Error('SUPABASE_URL and a Supabase key must be set to sign in.');
  // A fresh client per attempt: a shared one would hold the last user's session in memory.
  const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error) return { error };
  return { user: { id: data.user.id, email: data.user.email } };
}

let signInImpl = supabaseSignIn;

/**
 * Checks credentials against Supabase Auth. Resolves { user } or { error } where
 * error.status is Supabase's (400 for bad credentials, 429 when rate limited).
 */
export function signIn(email, password) {
  return signInImpl(email, password);
}

/** Test-only: replaces the Supabase call; pass null to restore it. */
export function setSignInForTests(fn) {
  signInImpl = fn || supabaseSignIn;
}

// ---- Passwords (specs/015-login-coach-customer-roles data-model.md "Validation rules") ----

const MIN_PASSWORD_LENGTH = 8;
export const PASSWORD_RULE_MESSAGE = 'Use at least 8 characters, with a letter and a number.';

/** True when a password has at least 8 characters, one letter and one number. */
export function isStrongPassword(password) {
  return (
    typeof password === 'string' &&
    password.length >= MIN_PASSWORD_LENGTH &&
    /\p{L}/u.test(password) &&
    /\d/.test(password)
  );
}

/**
 * Field errors for a password change (empty object when valid). The client makes the
 * same checks in Spanish first; these are the server's own backstop.
 */
export function validateNewPassword({ currentPassword, newPassword, confirmPassword }) {
  const fields = {};
  if (!isStrongPassword(newPassword)) fields.newPassword = PASSWORD_RULE_MESSAGE;
  else if (newPassword === currentPassword) fields.newPassword = 'The new password must be different from the current one.';
  if (newPassword !== confirmPassword) fields.confirmPassword = 'The passwords do not match.';
  return fields;
}

// ---- Supabase Auth admin (customer accounts) ----

function adminClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) throw new Error('SUPABASE_URL and SUPABASE_SECRET_KEY must be set to manage accounts.');
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

const ALREADY_REGISTERED = /already (been )?registered|already exists/i;

const supabaseAdmin = {
  /** Resolves { user: { id, email } } or { error: 'email_taken' | Error }. */
  async createUser(email, password) {
    const { data, error } = await adminClient().auth.admin.createUser({ email, password, email_confirm: true });
    if (error) {
      if (error.code === 'email_exists' || ALREADY_REGISTERED.test(error.message || '')) return { error: 'email_taken' };
      return { error };
    }
    return { user: { id: data.user.id, email: data.user.email } };
  },
  async setPassword(userId, password) {
    const { error } = await adminClient().auth.admin.updateUserById(userId, { password });
    return error ? { error } : {};
  },
  async getEmail(userId) {
    const { data, error } = await adminClient().auth.admin.getUserById(userId);
    return error ? { error } : { email: data.user?.email || null };
  },
  async deleteUser(userId) {
    const { error } = await adminClient().auth.admin.deleteUser(userId);
    return error ? { error } : {};
  },
};

let adminImpl = supabaseAdmin;

export function createAuthUser(email, password) {
  return adminImpl.createUser(email, password);
}

export function setAuthPassword(userId, password) {
  return adminImpl.setPassword(userId, password);
}

export function getAuthUserEmail(userId) {
  return adminImpl.getEmail(userId);
}

export function deleteAuthUser(userId) {
  return adminImpl.deleteUser(userId);
}

/** Test-only: replaces the Supabase admin calls; pass null to restore them. */
export function setAdminForTests(impl) {
  adminImpl = impl || supabaseAdmin;
}
