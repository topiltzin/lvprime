import { createAuthUser, deleteAuthUser, isStrongPassword, PASSWORD_RULE_MESSAGE, setAuthPassword } from '../auth.js';
import { readJsonBodyOr422, sendJson } from '../http.js';
import {
  AccessExistsError,
  AccountsUnavailableError,
  getCustomerAccess,
  linkCustomerAccount,
  setMustChangePassword,
} from '../lib/customer-data.js';

// Coach gives a customer sign-in access, or resets their password
// (specs/015-login-coach-customer-roles contracts/auth-api.md).

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function accountsUnavailable(res, err) {
  console.error('Customer accounts unavailable:', err.message);
  sendJson(res, 503, {
    error: 'accounts_unavailable',
    message: 'Customer sign-in needs a database update (server/migrations/017-customer-accounts.sql).',
  });
}

export async function handleCreateAccess(req, res, slug) {
  const body = await readJsonBodyOr422(req, res);
  if (body === undefined) return;
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const defaultPassword = typeof body.defaultPassword === 'string' ? body.defaultPassword : '';

  const fields = {};
  if (!EMAIL_PATTERN.test(email)) fields.email = 'Enter a valid email address.';
  if (!isStrongPassword(defaultPassword)) fields.defaultPassword = PASSWORD_RULE_MESSAGE;
  if (Object.keys(fields).length) {
    return sendJson(res, 422, { error: 'validation_failed', message: 'Check the highlighted fields.', fields });
  }

  // getCustomerAccess answers 404 for an unknown client before Auth is touched.
  try {
    const access = await getCustomerAccess(slug);
    if (access.hasAccess) {
      return sendJson(res, 409, { error: 'access_exists', message: 'This client already has sign-in access.' });
    }
  } catch (err) {
    if (err instanceof AccountsUnavailableError) return accountsUnavailable(res, err);
    throw err;
  }

  const created = await createAuthUser(email, defaultPassword);
  if (created.error === 'email_taken') {
    return sendJson(res, 409, { error: 'email_taken', message: 'That email already has an account.', fields: { email: 'That email already has an account.' } });
  }
  if (created.error) {
    console.error('Create account error:', created.error);
    return sendJson(res, 502, { error: 'auth_unavailable', message: 'Could not create the account. Try again shortly.' });
  }

  try {
    await linkCustomerAccount(slug, created.user.id);
  } catch (err) {
    // Don't leave a sign-in that belongs to no customer.
    await deleteAuthUser(created.user.id).catch((e) => console.error('Cleanup failed:', e));
    if (err instanceof AccessExistsError) {
      return sendJson(res, 409, { error: 'access_exists', message: 'This client already has sign-in access.' });
    }
    if (err instanceof AccountsUnavailableError) return accountsUnavailable(res, err);
    throw err;
  }

  sendJson(res, 201, { slug, email: created.user.email, mustChangePassword: true });
}

export async function handleResetAccess(req, res, slug) {
  const body = await readJsonBodyOr422(req, res);
  if (body === undefined) return;
  const defaultPassword = typeof body.defaultPassword === 'string' ? body.defaultPassword : '';
  if (!isStrongPassword(defaultPassword)) {
    return sendJson(res, 422, {
      error: 'validation_failed',
      message: 'Check the highlighted fields.',
      fields: { defaultPassword: PASSWORD_RULE_MESSAGE },
    });
  }

  let access;
  try {
    access = await getCustomerAccess(slug);
  } catch (err) {
    if (err instanceof AccountsUnavailableError) return accountsUnavailable(res, err);
    throw err;
  }
  if (!access.hasAccess) {
    return sendJson(res, 404, { error: 'no_access', message: 'This client has no sign-in access yet.' });
  }

  const updated = await setAuthPassword(access.authUserId, defaultPassword);
  if (updated.error) {
    console.error('Reset password error:', updated.error);
    return sendJson(res, 502, { error: 'auth_unavailable', message: 'Could not reset the password. Try again shortly.' });
  }
  await setMustChangePassword(slug, true);
  sendJson(res, 200, { slug, mustChangePassword: true });
}
