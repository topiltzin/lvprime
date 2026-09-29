import { isAuthorized } from './auth.js';
import { PayloadTooLargeError, sendJson } from './http.js';
import {
  handleCustomerFile,
  handleGetCustomer,
  handleGetCustomers,
  handleGetNutrition,
  handleGetProgramWeek,
  handleGetProgramWeeks,
  handlePostFeedback,
  handlePostQuickComplete,
} from './handlers/customers.js';
import { handleCreateCustomer, handleGetContent, handlePostMeasurement, handlePutContent } from './handlers/editing.js';
import { handleSyncDownload, handleSyncStatus, handleSyncUpload } from './handlers/sync.js';
import { handlePostChat } from './handlers/chat.js';
import { handleLogin, handleLogout, handleSession } from './handlers/auth.js';
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
  { method: 'GET', pattern: /^\/api\/session\/?$/, handler: (req, res) => handleSession(req, res) },
];

const ROUTES = [
  {
    method: 'GET',
    pattern: /^\/customer-files\/(.+)$/,
    handler: (req, res, m) => handleCustomerFile(req, res, m[1]),
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
    pattern: /^\/api\/customers\/([^/]+)\/measurements\/?$/,
    handler: (req, res, m) => handlePostMeasurement(req, res, decodeURIComponent(m[1])),
  },
  {
    method: 'GET',
    pattern: /^\/api\/customers\/([^/]+)\/?$/,
    handler: (req, res, m) => handleGetCustomer(req, res, decodeURIComponent(m[1])),
  },
  {
    method: 'GET',
    pattern: /^\/api\/customers\/([^/]+)\/program\/weeks\/?$/,
    handler: (req, res, m) => handleGetProgramWeeks(req, res, decodeURIComponent(m[1])),
  },
  {
    method: 'GET',
    pattern: /^\/api\/customers\/([^/]+)\/program\/weeks\/([^/]+)\/?$/,
    handler: (req, res, m) => handleGetProgramWeek(req, res, decodeURIComponent(m[1]), decodeURIComponent(m[2])),
  },
  {
    method: 'GET',
    pattern: /^\/api\/customers\/([^/]+)\/nutrition\/?$/,
    handler: (req, res, m) => handleGetNutrition(req, res, decodeURIComponent(m[1])),
  },
  {
    method: 'POST',
    pattern: /^\/api\/customers\/([^/]+)\/feedback\/quick-complete\/?$/,
    handler: (req, res, m) => handlePostQuickComplete(req, res, decodeURIComponent(m[1])),
  },
  {
    method: 'POST',
    pattern: /^\/api\/customers\/([^/]+)\/feedback\/?$/,
    handler: (req, res, m) => handlePostFeedback(req, res, decodeURIComponent(m[1])),
  },
  { method: 'POST', pattern: /^\/api\/chat\/?$/, handler: (req, res) => handlePostChat(req, res) },
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

/** Routes a single HTTP request under /api/*. Used both by the Vite dev middleware
 * (vite.config.js) and the standalone server (server.js). */
export async function handleApiRequest(req, res) {
  const url = new URL(req.url, 'http://localhost');
  const pathname = url.pathname;

  try {
    for (const route of PUBLIC_ROUTES) {
      const match = req.method === route.method && pathname.match(route.pattern);
      if (match) {
        await route.handler(req, res, match);
        return;
      }
    }

    if (!isAuthorized(req)) {
      sendJson(res, 401, { error: 'unauthorized', message: 'Sign in to continue.' });
      return;
    }

    for (const route of ROUTES) {
      if (route.method !== req.method) continue;
      const match = pathname.match(route.pattern);
      if (match) {
        await route.handler(req, res, match);
        return;
      }
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
