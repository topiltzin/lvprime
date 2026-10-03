import {
  isAuthDisabled,
  logoutCookie,
  sessionCookie,
  setAuthPassword,
  signIn,
  validateNewPassword,
} from '../auth.js';
import { resolveActor } from '../access.js';
import { PayloadTooLargeError, readJsonBody, readJsonBodyOr422, sendJson } from '../http.js';
import { AccountsUnavailableError, getCustomerByAuthUserId, setMustChangePassword } from '../lib/customer-data.js';

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

  // A user linked to a customer row is a customer; anyone else is the coach. Without
  // the 017 migration no customer can exist, so the lookup failing means coach.
  let customer = null;
  try {
    customer = await getCustomerByAuthUserId(result.user.id);
  } catch (err) {
    if (!(err instanceof AccountsUnavailableError)) throw err;
  }

  if (!customer) {
    res.setHeader('Set-Cookie', sessionCookie(req, result.user));
    return sendJson(res, 200, { email: result.user.email, role: 'coach', mustChangePassword: false });
  }
  if (customer.archived_at) {
    return sendJson(res, 403, { error: 'account_disabled', message: 'This account is disabled. Contact your coach.' });
  }
  res.setHeader('Set-Cookie', sessionCookie(req, result.user, { role: 'customer', slug: customer.slug }));
  sendJson(res, 200, {
    email: result.user.email,
    role: 'customer',
    slug: customer.slug,
    mustChangePassword: !!customer.must_change_password,
  });
}

// Who is signed in, for the header. Public so the client can ask before any 401.
export async function handleSession(req, res) {
  const actor = await resolveActor(req);
  const customer = actor?.role === 'customer';
  sendJson(res, 200, {
    authenticated: !!actor,
    authDisabled: isAuthDisabled(),
    email: actor?.email || null,
    role: actor?.role || null,
    slug: customer ? actor.slug : null,
    mustChangePassword: customer ? !!actor.customer.must_change_password : false,
    disabled: customer ? !!actor.customer.archived_at : false,
  });
}

// POST /api/password: a signed-in user replaces their password (specs/015 contracts/auth-api.md).
// Allowed while a customer still has the coach's default password.
export async function handleChangePassword(req, res) {
  const body = await readJsonBodyOr422(req, res);
  if (body === undefined) return;
  const currentPassword = typeof body.currentPassword === 'string' ? body.currentPassword : '';
  const newPassword = typeof body.newPassword === 'string' ? body.newPassword : '';
  const confirmPassword = typeof body.confirmPassword === 'string' ? body.confirmPassword : '';

  const actor = req.actor;
  if (!actor?.email || !actor.userId) {
    return sendJson(res, 400, { error: 'password_unavailable', message: 'Sign in with an account to change its password.' });
  }

  const fields = validateNewPassword({ currentPassword, newPassword, confirmPassword });
  if (!currentPassword) fields.currentPassword = 'Enter your current password.';
  if (Object.keys(fields).length) {
    return sendJson(res, 422, { error: 'validation_failed', message: 'Check the highlighted fields.', fields });
  }

  let check;
  try {
    check = await signIn(actor.email, currentPassword);
  } catch (err) {
    console.error('Password check error:', err);
    return sendJson(res, 502, { error: 'auth_unavailable', message: 'Sign-in is unavailable right now. Try again shortly.' });
  }
  if (check.error) {
    if (check.error.status === 429) {
      return sendJson(res, 429, { error: 'rate_limited', message: 'Too many attempts. Wait a minute and try again.' });
    }
    return sendJson(res, 401, { error: 'invalid_credentials', message: 'Your current password is incorrect.' });
  }

  const updated = await setAuthPassword(actor.userId, newPassword);
  if (updated.error) {
    console.error('Password update error:', updated.error);
    return sendJson(res, 502, { error: 'auth_unavailable', message: 'Could not change the password. Try again shortly.' });
  }

  if (actor.role === 'customer') {
    await setMustChangePassword(actor.slug, false);
    res.setHeader('Set-Cookie', sessionCookie(req, { id: actor.userId, email: actor.email }, { role: 'customer', slug: actor.slug }));
  }
  sendJson(res, 200, { ok: true });
}

export function handleLogout(req, res) {
  res.setHeader('Set-Cookie', logoutCookie(req));
  sendJson(res, 200, { ok: true });
}
