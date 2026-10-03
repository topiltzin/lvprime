import { authorize } from './access.js';
import { PayloadTooLargeError, sendJson } from './http.js';
import { applySecurityHeaders } from './security-headers.js';
import {
  handleGetCustomer,
  handleGetCustomers,
  handleGetNutrition,
  handleGetProgramWeek,
  handleGetProgramWeeks,
  handlePostFeedback,
  handlePostQuickComplete,
  handlePutDayNotes,
} from './handlers/customers.js';
import {
  handleCreateCustomer,
  handleGetContent,
  handlePostMeasurement,
  handlePutContent,
  handleSetArchived,
} from './handlers/editing.js';
import { handleSyncDownload, handleSyncStatus, handleSyncUpload } from './handlers/sync.js';
import { handleDeleteChatHistory, handleGetChatHistory, handlePostChat } from './handlers/chat.js';
import { handleCustomerFile, handleDeleteAttachment, handleUploadAttachment } from './handlers/attachments.js';
import { handleChangePassword, handleLogin, handleLogout, handleSession } from './handlers/auth.js';
import { handleForgotPassword, handleResetPassword } from './handlers/password-reset.js';
import { handleCreateAccess, handleResetAccess } from './handlers/customer-access.js';
import { CustomerNotFoundError, ValidationError } from './lib/customer-data.js';

// Route tables and dispatch only; each handler lives under handlers/ (shared HTTP helpers in http.js).

/** Test-only, kept for compatibility with existing integration test helpers.
 * No-op now that reads/writes go through Supabase rather than a per-process
 * SQLite handle. See specs/006-customer-data-storage/tasks.md T054 — the
 * fixture-filesystem-based integration tests need reworking against a
 * Supabase test project; that's tracked separately, not done here. */
export function resetDbForTests() {}

// Reachable without a session; everything else goes through isAuthorized().
const PUBLIC_ROUTES = [
  { method: 'POST', pattern: /^\/api\/login\/?$/, handler: (req, res) => handleLogin(req, res) },
  { method: 'POST', pattern: /^\/api\/logout\/?$/, handler: (req, res) => handleLogout(req, res) },
  { method: 'POST', pattern: /^\/api\/password\/forgot\/?$/, handler: (req, res) => handleForgotPassword(req, res) },
  { method: 'POST', pattern: /^\/api\/password\/reset\/?$/, handler: (req, res) => handleResetPassword(req, res) },
  { method: 'GET', pattern: /^\/api\/session\/?$/, handler: (req, res) => handleSession(req, res) },
];

const ROUTES = [
  {
    access: 'customer-own',
    method: 'GET',
    pattern: /^\/customer-files\/([^/]+)\/(.+)$/,
    handler: (req, res, m) => handleCustomerFile(req, res, decodeURIComponent(m[1]), decodeURIComponent(m[2])),
  },
  {
    method: 'POST',
    pattern: /^\/api\/customers\/([^/]+)\/attachments\/?$/,
    handler: (req, res, m) => handleUploadAttachment(req, res, decodeURIComponent(m[1])),
  },
  {
    method: 'DELETE',
    pattern: /^\/api\/customers\/([^/]+)\/attachments\/(.+)$/,
    handler: (req, res, m) => handleDeleteAttachment(req, res, decodeURIComponent(m[1]), decodeURIComponent(m[2])),
  },
  { method: 'GET', pattern: /^\/api\/customers\/?$/, handler: (req, res) => handleGetCustomers(req, res) },
  { method: 'POST', pattern: /^\/api\/customers\/?$/, handler: (req, res) => handleCreateCustomer(req, res) },
  {
    method: 'GET',
    pattern: /^\/api\/customers\/([^/]+)\/content\/?$/,
    handler: (req, res, m) => handleGetContent(req, res, decodeURIComponent(m[1])),
  },
  {
    method: 'PUT',
    pattern: /^\/api\/customers\/([^/]+)\/content\/?$/,
    handler: (req, res, m) => handlePutContent(req, res, decodeURIComponent(m[1])),
  },
  {
    method: 'POST',
    pattern: /^\/api\/customers\/([^/]+)\/(archive|restore)\/?$/,
    handler: (req, res, m) => handleSetArchived(req, res, decodeURIComponent(m[1]), m[2] === 'archive'),
  },
  {
    method: 'POST',
    pattern: /^\/api\/customers\/([^/]+)\/measurements\/?$/,
    handler: (req, res, m) => handlePostMeasurement(req, res, decodeURIComponent(m[1])),
  },
  {
    access: 'customer-own',
    method: 'GET',
    pattern: /^\/api\/customers\/([^/]+)\/?$/,
    handler: (req, res, m) => handleGetCustomer(req, res, decodeURIComponent(m[1])),
  },
  {
    access: 'customer-own',
    method: 'GET',
    pattern: /^\/api\/customers\/([^/]+)\/program\/weeks\/?$/,
    handler: (req, res, m) => handleGetProgramWeeks(req, res, decodeURIComponent(m[1])),
  },
  {
    access: 'customer-own',
    method: 'GET',
    pattern: /^\/api\/customers\/([^/]+)\/program\/weeks\/([^/]+)\/?$/,
    handler: (req, res, m) => handleGetProgramWeek(req, res, decodeURIComponent(m[1]), decodeURIComponent(m[2])),
  },
  {
    access: 'customer-own',
    method: 'GET',
    pattern: /^\/api\/customers\/([^/]+)\/nutrition\/?$/,
    handler: (req, res, m) => handleGetNutrition(req, res, decodeURIComponent(m[1])),
  },
  {
    access: 'customer-own',
    method: 'POST',
    pattern: /^\/api\/customers\/([^/]+)\/feedback\/quick-complete\/?$/,
    handler: (req, res, m) => handlePostQuickComplete(req, res, decodeURIComponent(m[1])),
  },
  {
    access: 'customer-own',
    method: 'PUT',
    pattern: /^\/api\/customers\/([^/]+)\/feedback\/day-notes\/?$/,
    handler: (req, res, m) => handlePutDayNotes(req, res, decodeURIComponent(m[1])),
  },
  {
    access: 'customer-own',
    method: 'POST',
    pattern: /^\/api\/customers\/([^/]+)\/feedback\/?$/,
    handler: (req, res, m) => handlePostFeedback(req, res, decodeURIComponent(m[1])),
  },
  {
    method: 'POST',
    access: 'signed-in',
    pattern: /^\/api\/password\/?$/,
    handler: (req, res) => handleChangePassword(req, res),
  },
  {
    method: 'POST',
    pattern: /^\/api\/customers\/([^/]+)\/access\/?$/,
    handler: (req, res, m) => handleCreateAccess(req, res, decodeURIComponent(m[1])),
  },
  {
    method: 'POST',
    pattern: /^\/api\/customers\/([^/]+)\/access\/reset\/?$/,
    handler: (req, res, m) => handleResetAccess(req, res, decodeURIComponent(m[1])),
  },
  { method: 'POST', access: 'any', pattern: /^\/api\/chat\/?$/, handler: (req, res) => handlePostChat(req, res) },
  { method: 'GET', access: 'any', pattern: /^\/api\/chat\/history\/?$/, handler: (req, res) => handleGetChatHistory(req, res) },
  { method: 'DELETE', access: 'any', pattern: /^\/api\/chat\/history\/?$/, handler: (req, res) => handleDeleteChatHistory(req, res) },
  {
    method: 'POST',
    pattern: /^\/api\/sync\/upload\/?$/,
    handler: (req, res) => handleSyncUpload(req, res),
  },
  {
    method: 'GET',
    pattern: /^\/api\/sync\/download\/?$/,
    handler: (req, res) => handleSyncDownload(req, res),
  },
  {
    method: 'GET',
    pattern: /^\/api\/sync\/status\/?$/,
    handler: (req, res) => handleSyncStatus(req, res),
  },
];

// A malformed %-escape is answered 400 by the handler once the caller is authorized;
// until then it can only name no customer.
function safeDecode(value) {
  try {
    return decodeURIComponent(value);
  } catch {
    return '';
  }
}

/** Routes a single HTTP request under /api/*. Used both by the Vite dev middleware
 * (vite.config.js) and the standalone server (server.js). */
export async function handleApiRequest(req, res) {
  const url = new URL(req.url, 'http://localhost');
  const pathname = url.pathname;
  applySecurityHeaders(res);

  try {
    for (const route of PUBLIC_ROUTES) {
      const match = req.method === route.method && pathname.match(route.pattern);
      if (match) {
        await route.handler(req, res, match);
        return;
      }
    }

    // First matching route wins; its access tag decides who may run it.
    for (const route of ROUTES) {
      if (route.method !== req.method) continue;
      const match = pathname.match(route.pattern);
      if (!match) continue;
      const slug = route.access === 'customer-own' ? safeDecode(match[1]) : null;
      const decision = await authorize(req, route, slug);
      if (!decision.ok) {
        sendJson(res, decision.status, decision.body);
        return;
      }
      req.actor = decision.actor;
      await route.handler(req, res, match);
      return;
    }

    // Unknown path: signed-out callers learn nothing about which routes exist.
    const decision = await authorize(req, {});
    if (!decision.ok && decision.status === 401) {
      sendJson(res, 401, decision.body);
      return;
    }

    sendJson(res, 404, { error: 'not_found' });
  } catch (err) {
    if (res.headersSent) throw err;
    // Malformed %-escapes in the path (decodeURIComponent).
    if (err instanceof URIError) return sendJson(res, 400, { error: 'bad_request' });
    if (err instanceof PayloadTooLargeError) return sendJson(res, 413, { error: 'payload_too_large' });
    if (err instanceof CustomerNotFoundError) return sendJson(res, 404, { error: 'customer_not_found' });
    // A slug that fails assertValidSlug can't name an existing customer.
    if (err instanceof ValidationError && err.field === 'slug') {
      return sendJson(res, 404, { error: 'customer_not_found' });
    }
    if (err instanceof ValidationError) {
      return sendJson(res, 422, { error: 'validation_failed', fields: { [err.field]: err.message } });
    }
    // Supabase connection/query failures surface here as DatabaseError from
    // customer-data.js (per T048); translate to a friendly message instead of
    // letting vite.config.js/server.js's outer catch return a bare
    // "internal_error" (T049 — customer-view.js already displays err.message
    // from the API response in its error banner).
    if (err.code === 'DATABASE_ERROR') {
      console.error('Database error:', err.message, err.cause || '');
      if (!res.headersSent) {
        sendJson(res, 503, { error: 'unable_to_load', message: 'Unable to load customer data. Please try again.' });
      }
      return;
    }
    throw err;
  }
}
