import { openDb, getCustomerRow, listFeedbackEntries, listAttachments, getFeedbackTrend } from './db.js';
import { listCustomers, reindexIfStale, customerFolderExists, customerPaths, getCustomersDir } from './customers-repo.js';
import { parseProgramDetail } from './markdown-parser.js';
import { renderMarkdown } from './markdown-render.js';
import { validateFeedbackSubmission, appendFeedbackEntry, getFeedbackTemplate } from './feedback-writer.js';
import * as syncEngine from './sync-engine.js';
import * as syncState from './sync-state.js';
import * as offlineQueue from './offline-queue.js';
import * as hashUtils from './hash-utils.js';
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

  let nutrition = { present: false, content: '', isEmpty: true };
  if (fs.existsSync(paths.nutrition)) {
    try {
      const nutritionText = fs.readFileSync(paths.nutrition, 'utf8');
      const isEmpty = nutritionText.trim().length === 0;
      nutrition = {
        present: true,
        content: nutritionText,
        isEmpty: isEmpty
      };
    } catch (err) {
      console.error(`Error reading nutrition plan for ${slug}:`, err);
      nutrition = { present: false, content: '', isEmpty: true, error: 'Could not read nutrition file' };
    }
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
    nutrition,
    feedback: { entries, trend, template: feedbackTemplate },
    attachments,
  });
}

async function handleGetNutrition(req, res, slug) {
  if (!customerFolderExists(slug)) {
    sendJson(res, 404, { error: 'customer_not_found' });
    return;
  }
  const paths = customerPaths(slug);
  const nutritionPath = paths.nutrition;

  // Check if nutrition plan file exists
  if (!fs.existsSync(nutritionPath)) {
    sendJson(res, 200, {
      content: '',
      isEmpty: true,
      lastModified: null,
    });
    return;
  }

  // Read nutrition plan file
  try {
    const content = fs.readFileSync(nutritionPath, 'utf8');
    const stats = fs.statSync(nutritionPath);

    // Check file size (max 100KB per spec FR-008)
    const maxSize = 100 * 1024; // 100KB
    if (stats.size > maxSize) {
      sendJson(res, 413, {
        error: 'file_too_large',
        message: 'Nutrition plan file exceeds maximum size (100KB)',
      });
      return;
    }

    sendJson(res, 200, {
      content: content,
      isEmpty: content.trim().length === 0,
      lastModified: stats.mtime ? new Date(stats.mtime).toISOString() : null,
    });
  } catch (err) {
    console.error('Error reading nutrition plan:', err);
    sendJson(res, 500, {
      error: 'unable_to_read',
      message: 'Unable to read nutrition plan file',
    });
  }
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

// Sync API endpoints (T018-T020: Coach Local Sync)
async function handleSyncUpload(req, res) {
  // POST /api/sync/upload - Coach uploads program/notes to server
  try {
    const body = await readJsonBody(req);
    const { customer_id, file_type, current_version, content, content_hash, offline_queue } = body;

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

    // Validate customer exists
    if (!customerFolderExists(customer_id)) {
      return sendJson(res, 404, { error: 'customer_not_found' });
    }

    // Validate file_type
    if (!['program', 'notes'].includes(file_type)) {
      return sendJson(res, 422, {
        error: 'validation_failed',
        fields: { file_type: `must be 'program' or 'notes'` }
      });
    }

    // Verify content hash
    if (!hashUtils.verifyContentHash(content, content_hash)) {
      return sendJson(res, 422, {
        error: 'integrity_check_failed',
        expected_hash: hashUtils.computeContentHash(content),
        received_hash: content_hash
      });
    }

    // Get current server version
    let syncState = syncState.getSyncState(customer_id, file_type);
    const serverVersion = syncState ? syncState.current_version : 0;

    // Detect conflict (coach-always-wins per FR-007)
    const conflicted = syncEngine.detectVersionMismatch(current_version, serverVersion);

    // Write file to filesystem
    const paths = customerPaths(customer_id);
    const filePath = file_type === 'program' ? paths.program : paths.notes;
    fs.writeFileSync(filePath, content, 'utf8');

    // Update sync metadata
    const newVersion = serverVersion + 1;
    if (!syncState) {
      syncState.initializeSyncState(customer_id, file_type);
    }
    syncState.updateSyncMetadata(customer_id, file_type, newVersion, 'coach', content_hash);

    // Log sync event
    syncState.recordSyncEvent(customer_id, file_type, 'sync_success', {
      source: 'coach',
      version_from: serverVersion,
      version_to: newVersion,
      content_hash: content_hash
    });

    if (conflicted) {
      syncState.recordSyncEvent(customer_id, file_type, 'sync_conflict', {
        source: 'coach',
        conflict_description: `Coach version ${current_version}, server version ${serverVersion}. Coach changes applied.`
      });
    }

    // Return success
    sendJson(res, 201, {
      status: 'synced',
      customer_id,
      file_type,
      new_version: newVersion,
      server_version: serverVersion,
      last_sync_timestamp: new Date().toISOString(),
      message: conflicted ? `Version mismatch resolved: coach changes applied (${current_version} → ${newVersion})` : 'Sync successful'
    });
  } catch (err) {
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

    if (!customer_id || !file_type) {
      return sendJson(res, 422, {
        error: 'validation_failed',
        fields: {
          customer_id: !customer_id ? 'required' : null,
          file_type: !file_type ? 'required' : null
        }
      });
    }

    if (!customerFolderExists(customer_id)) {
      return sendJson(res, 404, { error: 'customer_not_found' });
    }

    // Get sync state
    const state = syncState.getSyncState(customer_id, file_type);
    if (!state) {
      return sendJson(res, 404, { error: 'not_found', message: 'File never synced' });
    }

    // Check if already has latest version (304 Not Modified)
    if (current_version && parseInt(current_version) === state.current_version) {
      res.statusCode = 304;
      res.end();
      return;
    }

    // Read file content
    const paths = customerPaths(customer_id);
    const filePath = file_type === 'program' ? paths.program : paths.notes;

    if (!fs.existsSync(filePath)) {
      return sendJson(res, 404, { error: 'not_found', message: 'File missing from filesystem' });
    }

    const content = fs.readFileSync(filePath, 'utf8');
    const contentHash = hashUtils.computeContentHash(content);

    sendJson(res, 200, {
      status: 'download',
      customer_id,
      file_type,
      current_version: state.current_version,
      content,
      content_hash: contentHash,
      last_sync_timestamp: state.last_sync_timestamp,
      last_writer: state.last_writer,
      message: 'Latest version available'
    });
  } catch (err) {
    console.error('Sync download error:', err);
    sendJson(res, 500, { error: 'sync_error', message: err.message });
  }
}

async function handleSyncStatus(req, res) {
  // GET /api/sync/status - Check sync status for customer
  try {
    const url = new URL(req.url, 'http://localhost');
    const customer_id = url.searchParams.get('customer_id');

    if (!customer_id) {
      return sendJson(res, 422, {
        error: 'validation_failed',
        fields: { customer_id: 'required' }
      });
    }

    if (!customerFolderExists(customer_id)) {
      return sendJson(res, 404, { error: 'customer_not_found' });
    }

    // Get status for all file types
    const files = {};
    ['program', 'feedback', 'notes'].forEach(fileType => {
      const state = syncState.getSyncState(customer_id, fileType);
      if (state) {
        files[fileType] = {
          status: state.sync_status,
          current_version: state.current_version,
          last_sync_timestamp: state.last_sync_timestamp
        };
        if (fileType === 'feedback') {
          // Count feedback entries
          const paths = customerPaths(customer_id);
          if (fs.existsSync(paths.feedback)) {
            const content = fs.readFileSync(paths.feedback, 'utf8');
            const entryCount = (content.match(/^## \[/gm) || []).length;
            files[fileType].entry_count = entryCount;
          }
        }
      } else {
        files[fileType] = { status: 'not_initialized' };
      }
    });

    const allSynced = Object.values(files).every(f => !f.status || f.status === 'synced');

    sendJson(res, 200, {
      customer_id,
      files,
      overall_status: allSynced ? 'synced' : 'pending',
      message: allSynced ? 'All files in sync' : 'Some files pending sync'
    });
  } catch (err) {
    console.error('Sync status error:', err);
    sendJson(res, 500, { error: 'sync_error', message: err.message });
  }
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
    method: 'GET',
    pattern: /^\/api\/customers\/([^/]+)\/nutrition\/?$/,
    handler: (req, res, m) => handleGetNutrition(req, res, decodeURIComponent(m[1])),
  },
  {
    method: 'POST',
    pattern: /^\/api\/customers\/([^/]+)\/feedback\/?$/,
    handler: (req, res, m) => handlePostFeedback(req, res, decodeURIComponent(m[1])),
  },
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
