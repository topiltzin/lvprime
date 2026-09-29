import { getSession, isAuthDisabled, logoutCookie, sessionCookie, signIn } from '../auth.js';
import { PayloadTooLargeError, readJsonBody, sendJson } from '../http.js';

const EMAIL_PATTERN =/^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function handleLogin(req, res) {
  const body = await readJsonBody(req).catch((err) => {
    if (err instanceof PayloadTooLargeError) throw err;
    return {};
  });
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const password = typeof body.password === 'string' ? body.password : '';

  const fields = {};
  if (!EMAIL_PATTERN.test(email)) fields.email = 'Enter a valid email address.';
  if (!password) fields.password = 'Enter your password.';
  if (Object.keys(fields).length) {
    return sendJson(res, 422, { error: 'validation_error', message: 'Check the highlighted fields.', fields });
  }

  let result;
  try {
    result = await signIn(email, password);
  } catch (err) {
    console.error('Sign-in error:', err);
    return sendJson(res, 502, { error: 'auth_unavailable', message: 'Sign-in is unavailable right now. Try again shortly.' });
  }

  if (result.error) {
    if (result.error.status === 429) {
      return sendJson(res, 429, { error: 'rate_limited', message: 'Too many attempts. Wait a minute and try again.' });
    }
    if (result.error.status && result.error.status < 500) {
      return sendJson(res, 401, { error: 'invalid_credentials', message: 'Email or password is incorrect.' });
    }
    console.error('Sign-in error:', result.error);
    return sendJson(res, 502, { error: 'auth_unavailable', message: 'Sign-in is unavailable right now. Try again shortly.' });
  }

  res.setHeader('Set-Cookie', sessionCookie(req, result.user));
  sendJson(res, 200, { email: result.user.email });
}

// Who is signed in, for the header. Public so the client can ask before any 401.
export function handleSession(req, res) {
  const session = getSession(req);
  sendJson(res, 200, {
    authenticated: isAuthDisabled() || !!session,
    authDisabled: isAuthDisabled(),
    email: session?.email || null,
  });
}

export function handleLogout(req, res) {
  res.setHeader('Set-Cookie', logoutCookie(req));
  sendJson(res, 200, { ok: true });
}
