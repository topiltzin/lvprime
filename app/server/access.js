import { getSession, isAuthDisabled } from './auth.js';
import { AccountsUnavailableError, getCustomerByAuthUserId } from './lib/customer-data.js';

// Per-request authorization (specs/015-login-coach-customer-roles research R4-R6).
//
// Routes in server/index.js carry an `access` tag:
//   'coach'         coach sessions only (the default for an untagged route)
//   'customer-own'  coach, or the customer whose slug is in the URL
//   'signed-in'     any signed-in user, even a customer who must still set a password
//
// Coach sessions need no lookup. A customer session is re-checked against the
// customers row on every request, so archiving or a password reset takes effect
// immediately rather than when the 30-day cookie expires.

const DENY = {
  unauthorized: { status: 401, body: { error: 'unauthorized', message: 'Sign in to continue.' } },
  forbidden: { status: 403, body: { error: 'forbidden', message: 'You do not have access to this.' } },
  disabled: { status: 403, body: { error: 'account_disabled', message: 'This account is disabled. Contact your coach.' } },
  passwordRequired: {
    status: 403,
    body: { error: 'password_change_required', message: 'Set your own password to continue.' },
  },
  notFound: { status: 404, body: { error: 'customer_not_found' } },
};

const deny = (reason) => ({ ok: false, ...DENY[reason] });

/**
 * The customer row for a customer session; null when the account no longer
 * resolves to a customer (treated as signed out by the caller).
 */
export async function loadCustomerActor(session) {
  const row = await getCustomerByAuthUserId(session.sub);
  return row ? { role: 'customer', email: session.email, userId: session.sub, customer: row, slug: row.slug } : null;
}

/** Actor for a session: coach, or customer with their current row. null when signed out. */
export async function resolveActor(req) {
  if (isAuthDisabled()) return { role: 'coach', email: null, userId: null };
  const session = getSession(req);
  if (!session) return null;
  if (session.role !== 'customer') return { role: 'coach', email: session.email, userId: session.sub };
  try {
    return await loadCustomerActor(session);
  } catch (err) {
    if (err instanceof AccountsUnavailableError) return null;
    throw err;
  }
}

/** Decides whether `req` may run `route` (slug = URL slug for customer-scoped routes). */
export async function authorize(req, route, slug = null) {
  const actor = await resolveActor(req);
  if (!actor) return deny('unauthorized');
  if (actor.role === 'coach') return { ok: true, actor };

  if (actor.customer.archived_at) return deny('disabled');
  const access = route.access || 'coach';
  if (access === 'signed-in') return { ok: true, actor };
  if (actor.customer.must_change_password) return deny('passwordRequired');
  if (access === 'customer-own') {
    // 404, not 403: don't reveal that other customers exist.
    return slug === actor.slug ? { ok: true, actor } : deny('notFound');
  }
  return deny('forbidden');
}
