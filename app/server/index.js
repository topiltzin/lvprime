import { openDb, getCustomerRow, listFeedbackEntries, listAttachments, getFeedbackTrend } from './db.js';
import { listCustomers, reindexIfStale, customerFolderExists, customerPaths, getCustomersDir } from './customers-repo.js';
import { parseProgramDetail } from './markdown-parser.js';
import { renderMarkdown } from './markdown-render.js';
import { validateFeedbackSubmission, appendFeedbackEntry, getFeedbackTemplate } from './feedback-writer.js';
import fs from 'node:fs';
import path from 'node:path';

let _db = null;
function db() {
  if (!_db) {
    // FITNESS_DASHBOARD_DB_PATH lets integration tests use a throwaway DB
    // instead of the real app/data/index.sqlite.
    _db = process.env.FITNESS_DASHBOARD_DB_PATH ? openDb(process.env.FITNESS_DASHBOARD_DB_PATH) : openDb();
  }
  return _db;
}

/** Test-only: closes and forgets the cached DB handle so a new one (e.g.
 * pointed at a fresh temp path) is opened on the next request. */
export function resetDbForTests() {
  _db = null;
}

function sendJson(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(body));
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => {
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

function toCustomerSummary(row) {
  return {
    slug: row.slug,
    displayName: row.display_name,
    hasProgram: !!row.has_program,
    hasNotes: !!row.has_notes,
    programGoal: row.program_goal,
    lastFeedbackDate: row.last_feedback_date,
  };
}

function toFeedbackEntryJson(row) {
  return {
    id: row.id,
    date: row.entry_date,
    label: row.label,
    felt: row.felt,
    completed: row.completed == null ? null : !!row.completed,
    difficulty: row.difficulty,
    notes: row.notes,
    rawMatched: !!row.raw_matched,
  };
}

async function handleGetCustomers(req, res) {
  const rows = listCustomers(db());
  sendJson(res, 200, { customers: rows.map(toCustomerSummary) });
}

async function handleGetCustomer(req, res, slug) {
  if (!customerFolderExists(slug)) {
    sendJson(res, 404, { error: 'customer_not_found' });
    return;
  }
  const row = reindexIfStale(db(), slug);
  const paths = customerPaths(slug);

  let program = { present: !!row.has_program };
  if (row.has_program) {
    const programText = fs.readFileSync(paths.program, 'utf8');
    const detail = parseProgramDetail(programText, renderMarkdown);
    program = { present: true, goal: row.program_goal, ...detail };
  }

  let notes = { present: !!row.has_notes };
  if (row.has_notes) {
    const notesText = fs.readFileSync(paths.notes, 'utf8');
    notes = { present: true, html: renderMarkdown(notesText) };
  }

  const entries = listFeedbackEntries(db(), slug).map(toFeedbackEntryJson);
  const trend = getFeedbackTrend(db(), slug);
  const attachments = listAttachments(db(), slug).map((a) => ({
    relativePath: a.relative_path,
    sizeBytes: a.size_bytes,
    modifiedAt: a.modified_at ? new Date(a.modified_at).toISOString() : null,
  }));
  const feedbackTemplate = getFeedbackTemplate(slug);

  sendJson(res, 200, {
    slug: row.slug,
    displayName: row.display_name,
    program,
    notes,
    feedback: { entries, trend, template: feedbackTemplate },
    attachments,
  });
}

async function handlePostFeedback(req, res, slug) {
  if (!customerFolderExists(slug)) {
    sendJson(res, 404, { error: 'customer_not_found' });
    return;
  }
  let body;
  try {
    body = await readJsonBody(req);
  } catch {
    sendJson(res, 422, { error: 'validation_failed', fields: { body: 'invalid JSON' } });
    return;
  }

  const template = getFeedbackTemplate(slug);
  const result = validateFeedbackSubmission(template, body);
  if (!result.valid) {
    sendJson(res, 422, { error: 'validation_failed', fields: result.fields });
    return;
  }

  const row = getCustomerRow(db(), slug) || reindexIfStale(db(), slug);
  appendFeedbackEntry(slug, row.display_name, {
    date: body.date,
    label: body.label || null,
    fields: body.fields,
  });

  reindexIfStale(db(), slug);
  const entries = listFeedbackEntries(db(), slug);
  const created = entries[entries.length - 1];

  sendJson(res, 201, toFeedbackEntryJson(created));
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
    method: 'POST',
    pattern: /^\/api\/customers\/([^/]+)\/feedback\/?$/,
    handler: (req, res, m) => handlePostFeedback(req, res, decodeURIComponent(m[1])),
  },
];

/** Routes a single HTTP request under /api/*. Used both by the Vite dev middleware
 * (vite.config.js) and the standalone server (server/serve.js). */
export async function handleApiRequest(req, res) {
  const url = new URL(req.url, 'http://localhost');
  const pathname = url.pathname;

  for (const route of ROUTES) {
    if (route.method !== req.method) continue;
    const match = pathname.match(route.pattern);
    if (match) {
      await route.handler(req, res, match);
      return;
    }
  }

  sendJson(res, 404, { error: 'not_found' });
}
