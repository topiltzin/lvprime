import { getCustomersDir, scanAttachments } from './customers-repo.js';
import { parseProgramDetail, parseProgramGoal } from './markdown-parser.js';
import { renderMarkdown } from './markdown-render.js';
import { validateFeedbackSubmission, validateQuickCompleteSubmission } from './feedback-writer.js';
import * as hashUtils from './hash-utils.js';
import { getSession, isAuthDisabled, isAuthorized, logoutCookie, sessionCookie, signIn } from './auth.js';
import {
  getCustomer,
  getCustomerProgram,
  getCustomerFeedback,
  getCustomerNotes,
  getCustomerNutritionPlan,
  getCustomerFullProfile,
  getCustomerProgramWeek,
  listCustomerProgramWeeks,
  getExerciseVideoLinkMap,
  addFeedbackEntry,
  quickCompleteFeedbackEntry,
  listAllCustomers,
  computeFeedbackTrend,
  syncCoachWrite,
  getSyncState,
  CustomerNotFoundError,
  ValidationError,
  WeekNotFoundError,
  WeekLockedError,
  WeekNumberGapError,
} from './lib/customer-data.js';
import { askCoachChatbot, ChatbotError, validateChatQuestion } from './lib/coach-chat.js';
import fs from 'node:fs';
import path from 'node:path';

/** Test-only, kept for compatibility with existing integration test helpers.
 * No-op now that reads/writes go through Supabase rather than a per-process
 * SQLite handle. See specs/006-customer-data-storage/tasks.md T054 — the
 * fixture-filesystem-based integration tests need reworking against a
 * Supabase test project; that's tracked separately, not done here. */
export function resetDbForTests() {}

function sendJson(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(body));
}

// Largest legitimate body is a 500KB program sync upload (customer-data.js
// MAX_CONTENT_BYTES) plus JSON overhead.
const MAX_BODY_BYTES = 1024 * 1024;

class PayloadTooLargeError extends Error {}

// Errors handleApiRequest translates into specific 4xx/503 responses; the sync
// handlers' catch-alls rethrow these instead of flattening them to 500.
function isMappedError(err) {
  return (
    err instanceof PayloadTooLargeError ||
    err instanceof ValidationError ||
    err instanceof URIError ||
    err.code === 'DATABASE_ERROR'
  );
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    let size = 0;
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        // Drain and discard the rest (not destroy) so the 413 still reaches the client.
        req.removeAllListeners('data');
        req.resume();
        reject(new PayloadTooLargeError('request body too large'));
        return;
      }
      data += chunk;
    });
    req.on('end', () => {
      if (!data) return resolve({});
      try {
        resolve(JSON.parse(data));
      } catch (err) {
        reject(err);
      }
    });
    req.on('error', reject);
  });
}

function toFeedbackEntryJson(row) {
  return {
    id: row.sort_order,
    date: row.entry_date,
    label: row.label,
    felt: row.felt,
    completed: row.completed,
    difficulty: row.difficulty,
    notes: row.notes,
    rawMatched: !!row.raw_matched,
  };
}

// One week's parsed routine (specs/010 contracts/weekly-routine-api.md).
function programWeekJson(row, videoLinkMap, { isCurrent, isLocked }) {
  return {
    present: true,
    goal: parseProgramGoal(row.content),
    ...parseProgramDetail(row.content, renderMarkdown, videoLinkMap),
    weekNumber: row.week_number,
    isCurrent,
    isLocked,
    version: row.version,
    updatedAt: row.updated_at,
  };
}

// Optional ?week_number= / body week_number. Returns null when absent,
// NaN when present but not a positive integer.
function parseWeekNumber(value) {
  if (value === undefined || value === null || value === '') return null;
  const n = Number(value);
  return Number.isInteger(n) && n >= 1 ? n : NaN;
}

async function handleGetProgramWeeks(req, res, slug) {
  try {
    const weeks = await listCustomerProgramWeeks(slug);
    sendJson(res, 200, { weeks });
  } catch (err) {
    if (err instanceof CustomerNotFoundError) return sendJson(res, 404, { error: 'customer_not_found' });
    throw err;
  }
}

async function handleGetProgramWeek(req, res, slug, weekParam) {
  const weekNumber = parseWeekNumber(weekParam);
  if (!weekNumber) return sendJson(res, 422, { error: 'validation_failed', fields: { week: 'must be a positive integer' } });
  try {
    const [row, videoLinkMap] = await Promise.all([getCustomerProgramWeek(slug, weekNumber), getExerciseVideoLinkMap()]);
    sendJson(res, 200, programWeekJson(row, videoLinkMap, row));
  } catch (err) {
    if (err instanceof CustomerNotFoundError) return sendJson(res, 404, { error: 'customer_not_found' });
    if (err instanceof WeekNotFoundError) return sendJson(res, 404, { error: 'week_not_found', weekNumber });
    throw err;
  }
}

async function handleGetCustomers(req, res) {
  const rows = await listAllCustomers();
  sendJson(res, 200, { customers: rows });
}

async function handleGetCustomer(req, res, slug) {
  let profile, videoLinkMap;
  try {
    // Runs the 4 related-table queries in parallel instead of resolving the
    // customer 5 times sequentially (per-slug getCustomer* calls) — that was
    // ~9 sequential Supabase round trips and blew past the <500ms target
    // (spec SC-004). getExerciseVideoLinkMap() isn't customer-scoped, so it
    // runs alongside rather than inside that per-customer Promise.all
    // (specs/007-exercise-library-migration plan.md Performance Goals).
    [profile, videoLinkMap] = await Promise.all([getCustomerFullProfile(slug), getExerciseVideoLinkMap()]);
  } catch (err) {
    if (err instanceof CustomerNotFoundError) {
      sendJson(res, 404, { error: 'customer_not_found' });
      return;
    }
    throw err;
  }
  const {
    customer,
    program: programRow,
    programWeeks,
    notes: notesRow,
    nutritionPlan: nutritionRow,
    feedback,
  } = profile;

  // programRow is the current (highest) week — see getCustomerFullProfile.
  const program = programRow
    ? programWeekJson(programRow, videoLinkMap, { isCurrent: true, isLocked: false })
    : { present: false };

  let notes = { present: !!notesRow };
  if (notesRow) {
    notes = { present: true, html: renderMarkdown(notesRow.content) };
  }

  let nutrition = { present: false, content: '', isEmpty: true };
  if (nutritionRow) {
    nutrition = {
      present: true,
      content: nutritionRow.content,
      isEmpty: nutritionRow.content.trim().length === 0,
    };
  }

  const entries = feedback.entries.map(toFeedbackEntryJson);
  const trend = computeFeedbackTrend(feedback.entries);

  // Attachments (PDFs etc.) stay filesystem-based — out of scope for this
  // migration (spec covers program/feedback/notes/nutrition_plan only).
  const attachmentDir = path.join(getCustomersDir(), slug);
  const attachments = scanAttachments(slug, attachmentDir).map((a) => ({
    relativePath: a.relative_path,
    sizeBytes: a.size_bytes,
    modifiedAt: a.modified_at ? new Date(a.modified_at).toISOString() : null,
  }));

  sendJson(res, 200, {
    slug: customer.slug,
    displayName: customer.name,
    program,
    programWeeks,
    notes,
    nutrition,
    feedback: { entries, trend, template: feedback.template },
    attachments,
  });
}

async function handleGetNutrition(req, res, slug) {
  try {
    await getCustomer(slug);
  } catch (err) {
    if (err instanceof CustomerNotFoundError) {
      sendJson(res, 404, { error: 'customer_not_found' });
      return;
    }
    throw err;
  }

  // Nutrition plans are written outside the app (nutrition specialist skill
  // or manual creation, per specs/005-nutrition-plan-tab Assumption 2), so
  // there's no in-app write path to re-check here — the 100KB limit is
  // enforced at migration/write time in customer-data.js. This defensive
  // re-check just guards against any future out-of-band insert.
  const nutritionRow = await getCustomerNutritionPlan(slug);
  if (!nutritionRow) {
    sendJson(res, 200, { content: '', isEmpty: true, lastModified: null });
    return;
  }

  const maxSize = 100 * 1024; // 100KB, per specs/005-nutrition-plan-tab FR-008
  if (Buffer.byteLength(nutritionRow.content, 'utf8') > maxSize) {
    sendJson(res, 413, {
      error: 'file_too_large',
      message: 'Nutrition plan file exceeds maximum size (100KB)',
    });
    return;
  }

  sendJson(res, 200, {
    content: nutritionRow.content,
    isEmpty: nutritionRow.content.trim().length === 0,
    lastModified: nutritionRow.updated_at ? new Date(nutritionRow.updated_at).toISOString() : null,
  });
}

async function handlePostFeedback(req, res, slug) {
  let customer;
  try {
    customer = await getCustomer(slug);
  } catch (err) {
    if (err instanceof CustomerNotFoundError) {
      sendJson(res, 404, { error: 'customer_not_found' });
      return;
    }
    throw err;
  }

  let body;
  try {
    body = await readJsonBody(req);
  } catch (err) {
    if (err instanceof PayloadTooLargeError) throw err;
    sendJson(res, 422, { error: 'validation_failed', fields: { body: 'invalid JSON' } });
    return;
  }

  const existingFeedback = await getCustomerFeedback(slug);
  const result = validateFeedbackSubmission(existingFeedback.template, body);
  if (!result.valid) {
    sendJson(res, 422, { error: 'validation_failed', fields: result.fields });
    return;
  }

  // Same date + label replaces the existing entry (specs/012 FR-009): 200, not 201.
  const { entry, created } = await addFeedbackEntry(slug, customer.name, {
    date: body.date,
    label: body.label || null,
    fields: body.fields,
  });

  sendJson(res, created ? 201 : 200, toFeedbackEntryJson(entry));
}

// "Mark done" on a Program day (specs/012-program-day-mark-done contracts/feedback-api.md).
async function handlePostQuickComplete(req, res, slug) {
  let customer;
  try {
    customer = await getCustomer(slug);
  } catch (err) {
    if (err instanceof CustomerNotFoundError) {
      sendJson(res, 404, { error: 'customer_not_found' });
      return;
    }
    throw err;
  }

  let body;
  try {
    body = await readJsonBody(req);
  } catch (err) {
    if (err instanceof PayloadTooLargeError) throw err;
    sendJson(res, 422, { error: 'validation_failed', fields: { body: 'invalid JSON' } });
    return;
  }

  const result = validateQuickCompleteSubmission(body);
  if (!result.valid) {
    sendJson(res, 422, { error: 'validation_failed', fields: result.fields });
    return;
  }

  const { entry, created } = await quickCompleteFeedbackEntry(slug, customer.name, {
    date: body.date,
    label: body.label.trim(),
  });
  sendJson(res, created ? 201 : 200, { created, entry: toFeedbackEntryJson(entry) });
}

/**
 * Serves an attachment file (e.g. a plans/*.pdf) directly out of customers/ so
 * it's openable from the customer detail view (spec edge case: attachments are
 * listed/linkable, not rendered inline). Never serves the three standard .md
 * files through this route — those only ever go through the JSON endpoints.
 */
async function handleCustomerFile(req, res, encodedRelPath) {
  const relPath = decodeURIComponent(encodedRelPath);
  const customersDir = getCustomersDir();
  const resolved = path.resolve(customersDir, relPath);
  if (!resolved.startsWith(customersDir + path.sep) || /\.md$/i.test(resolved)) {
    sendJson(res, 404, { error: 'not_found' });
    return;
  }
  fs.readFile(resolved, (err, data) => {
    if (err) {
      sendJson(res, 404, { error: 'not_found' });
      return;
    }
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/octet-stream');
    res.end(data);
  });
}

// Sync API endpoints (T018-T020: Coach Local Sync; DB-backed per
// specs/006-customer-data-storage tasks.md Phase 6 — sync-state.js's JSON
// file and offline-queue.js's embedded queue didn't survive Vercel
// redeployments, same problem as the customer .md files)
async function handleSyncUpload(req, res) {
  // POST /api/sync/upload - Coach uploads program/notes to server
  try {
    const body = await readJsonBody(req);
    const { customer_id, file_type, current_version, content, content_hash } = body;
    const weekNumber = parseWeekNumber(body.week_number);
    if (Number.isNaN(weekNumber)) {
      return sendJson(res, 422, { error: 'validation_failed', fields: { week_number: 'must be a positive integer' } });
    }

    // Validate required fields
    if (!customer_id || !file_type || current_version === undefined || !content || !content_hash) {
      return sendJson(res, 422, {
        error: 'validation_failed',
        fields: {
          customer_id: !customer_id ? 'required' : null,
          file_type: !file_type ? 'required' : null,
          current_version: current_version === undefined ? 'required' : null,
          content: !content ? 'required' : null,
          content_hash: !content_hash ? 'required' : null
        }
      });
    }

    try {
      await getCustomer(customer_id);
    } catch (err) {
      if (err instanceof CustomerNotFoundError) return sendJson(res, 404, { error: 'customer_not_found' });
      throw err;
    }

    // Validate file_type
    if (!['program', 'notes', 'nutrition_plan'].includes(file_type)) {
      return sendJson(res, 422, {
        error: 'validation_failed',
        fields: { file_type: `must be 'program', 'notes', or 'nutrition_plan'` }
      });
    }

    // Verify content hash (also re-checked inside syncCoachWrite; checked
    // here first so the original integrity_check_failed response shape with
    // expected/received hashes is preserved exactly)
    if (!hashUtils.verifyContentHash(content, content_hash)) {
      return sendJson(res, 422, {
        error: 'integrity_check_failed',
        expected_hash: hashUtils.computeContentHash(content),
        received_hash: content_hash
      });
    }

    let result;
    try {
      result = await syncCoachWrite(customer_id, file_type, {
        weekNumber: file_type === 'program' ? weekNumber : null,
        currentVersion: current_version,
        content,
        contentHash: content_hash,
      });
    } catch (err) {
      if (err instanceof WeekLockedError) {
        return sendJson(res, 423, { error: 'week_locked', weekNumber: err.weekNumber, currentWeek: err.currentWeek });
      }
      if (err instanceof WeekNumberGapError) {
        return sendJson(res, 400, { error: 'week_number_gap', expected: err.expected });
      }
      throw err;
    }

    sendJson(res, 201, {
      status: 'synced',
      customer_id,
      file_type,
      week_number: result.weekNumber,
      new_version: result.newVersion,
      server_version: result.serverVersion,
      last_sync_timestamp: new Date().toISOString(),
      message: result.conflicted
        ? `Version mismatch resolved: coach changes applied (${current_version} → ${result.newVersion})`
        : 'Sync successful'
    });
  } catch (err) {
    if (isMappedError(err)) throw err;
    console.error('Sync upload error:', err);
    sendJson(res, 500, { error: 'sync_error', message: err.message });
  }
}

async function handleSyncDownload(req, res) {
  // GET /api/sync/download - Coach downloads latest feedback/program
  try {
    const url = new URL(req.url, 'http://localhost');
    const customer_id = url.searchParams.get('customer_id');
    const file_type = url.searchParams.get('file_type');
    const current_version = url.searchParams.get('current_version');
    const weekNumber = parseWeekNumber(url.searchParams.get('week_number'));
    if (Number.isNaN(weekNumber)) {
      return sendJson(res, 422, { error: 'validation_failed', fields: { week_number: 'must be a positive integer' } });
    }

    if (!customer_id || !file_type) {
      return sendJson(res, 422, {
        error: 'validation_failed',
        fields: {
          customer_id: !customer_id ? 'required' : null,
          file_type: !file_type ? 'required' : null
        }
      });
    }

    try {
      await getCustomer(customer_id);
    } catch (err) {
      if (err instanceof CustomerNotFoundError) return sendJson(res, 404, { error: 'customer_not_found' });
      throw err;
    }

    const state = await getSyncState(customer_id, file_type, weekNumber);
    if (!state) {
      return sendJson(res, 404, { error: 'not_found', message: 'File never synced' });
    }

    // Check if already has latest version (304 Not Modified)
    if (current_version && parseInt(current_version, 10) === state.version) {
      res.statusCode = 304;
      res.end();
      return;
    }

    const row =
      file_type === 'program'
        ? await getCustomerProgram(customer_id, weekNumber)
        : file_type === 'nutrition_plan'
          ? await getCustomerNutritionPlan(customer_id)
          : await getCustomerNotes(customer_id);
    if (!row) {
      return sendJson(res, 404, { error: 'not_found', message: 'File missing from database' });
    }

    sendJson(res, 200, {
      status: 'download',
      customer_id,
      file_type,
      current_version: state.version,
      content: row.content,
      content_hash: state.contentHash || hashUtils.computeContentHash(row.content),
      last_sync_timestamp: state.updatedAt,
      last_writer: state.lastWriter,
      message: 'Latest version available'
    });
  } catch (err) {
    if (isMappedError(err)) throw err;
    console.error('Sync download error:', err);
    sendJson(res, 500, { error: 'sync_error', message: err.message });
  }
}

async function handleSyncStatus(req, res) {
  // GET /api/sync/status - Check sync status for customer
  try {
    const url = new URL(req.url, 'http://localhost');
    const customer_id = url.searchParams.get('customer_id');
    const weekNumber = parseWeekNumber(url.searchParams.get('week_number'));

    if (!customer_id) {
      return sendJson(res, 422, {
        error: 'validation_failed',
        fields: { customer_id: 'required' }
      });
    }
    if (Number.isNaN(weekNumber)) {
      return sendJson(res, 422, { error: 'validation_failed', fields: { week_number: 'must be a positive integer' } });
    }

    try {
      await getCustomer(customer_id);
    } catch (err) {
      if (err instanceof CustomerNotFoundError) return sendJson(res, 404, { error: 'customer_not_found' });
      throw err;
    }

    // Get status for program/notes (version-tracked, per sync-engine.js)
    const files = {};
    for (const fileType of ['program', 'notes']) {
      const state = await getSyncState(customer_id, fileType, fileType === 'program' ? weekNumber : null);
      files[fileType] = state
        ? { status: state.syncStatus, current_version: state.version, last_sync_timestamp: state.updatedAt }
        : { status: 'not_initialized' };
    }

    // Feedback was never version-tracked by sync-engine.js either (upload
    // only accepts file_type program/notes); kept as 'not_initialized' to
    // match, but entry_count now reflects the real parsed count instead of
    // the original heading-regex count (which never matched real dated
    // headings and always returned 0 for actual customer files).
    const feedback = await getCustomerFeedback(customer_id);
    files.feedback = { status: 'not_initialized', entry_count: feedback.entries.length };

    const allSynced = Object.values(files).every(f => !f.status || f.status === 'synced');

    sendJson(res, 200, {
      customer_id,
      files,
      overall_status: allSynced ? 'synced' : 'pending',
      message: allSynced ? 'All files in sync' : 'Some files pending sync'
    });
  } catch (err) {
    if (isMappedError(err)) throw err;
    console.error('Sync status error:', err);
    sendJson(res, 500, { error: 'sync_error', message: err.message });
  }
}

// Fitness coach chatbot (specs/013-fitness-coach-chatbot contracts/chat-api.md).
const CHATBOT_ERRORS = {
  chatbot_unavailable: [502, 'The coach assistant is unavailable right now. Try again.'],
  chatbot_timeout: [504, 'The coach assistant took too long to answer. Try again.'],
  chatbot_not_configured: [503, 'The coach assistant is not set up yet.'],
};

async function handlePostChat(req, res) {
  let body;
  try {
    body = await readJsonBody(req);
  } catch (err) {
    if (err instanceof PayloadTooLargeError) throw err;
    return sendJson(res, 422, { error: 'validation_failed', fields: { body: 'invalid JSON' } });
  }

  const result = validateChatQuestion(body);
  if (!result.ok) return sendJson(res, 422, { error: 'validation_failed', fields: result.fields });

  try {
    const answer = await askCoachChatbot(result.question);
    sendJson(res, 200, { answer });
  } catch (err) {
    if (!(err instanceof ChatbotError)) throw err;
    // Outcome only; never the question or answer text.
    console.error('Chatbot error:', err.code, err.cause?.name || '', err.cause?.message || '');
    const [status, message] = CHATBOT_ERRORS[err.code];
    sendJson(res, status, { error: err.code, message });
  }
}

const EMAIL_PATTERN =/^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function handleLogin(req, res) {
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
function handleSession(req, res) {
  const session = getSession(req);
  sendJson(res, 200, {
    authenticated: isAuthDisabled() || !!session,
    authDisabled: isAuthDisabled(),
    email: session?.email || null,
  });
}

function handleLogout(req, res) {
  res.setHeader('Set-Cookie', logoutCookie(req));
  sendJson(res, 200, { ok: true });
}

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
