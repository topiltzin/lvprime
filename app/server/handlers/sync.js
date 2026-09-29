import * as hashUtils from '../hash-utils.js';
import { isMappedError, readJsonBody, sendJson } from '../http.js';
import { parseWeekNumber } from './customers.js';
import {
  getCustomer,
  getCustomerProgram,
  getCustomerFeedback,
  getCustomerNotes,
  getCustomerNutritionPlan,
  syncCoachWrite,
  getSyncState,
  WeekLockedError,
  WeekNumberGapError,
} from '../lib/customer-data.js';

// Sync API endpoints (T018-T020: Coach Local Sync; DB-backed per
// specs/006-customer-data-storage tasks.md Phase 6 — sync-state.js's JSON
// file and offline-queue.js's embedded queue didn't survive Vercel
// redeployments, same problem as the customer .md files)
export async function handleSyncUpload(req, res) {
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

    const customer = await getCustomer(customer_id);

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
      }, { customer });
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

export async function handleSyncDownload(req, res) {
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

    const customer = await getCustomer(customer_id);

    const state = await getSyncState(customer_id, file_type, weekNumber, { customer });
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
        ? await getCustomerProgram(customer_id, weekNumber, { customer })
        : file_type === 'nutrition_plan'
          ? await getCustomerNutritionPlan(customer_id, { customer })
          : await getCustomerNotes(customer_id, { customer });
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

export async function handleSyncStatus(req, res) {
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

    const customer = await getCustomer(customer_id);

    // Status for program/notes (version-tracked, per sync-engine.js), plus feedback, fetched in parallel.
    const [programState, notesState, feedback] = await Promise.all([
      getSyncState(customer_id, 'program', weekNumber, { customer }),
      getSyncState(customer_id, 'notes', null, { customer }),
      getCustomerFeedback(customer_id, { customer }),
    ]);
    const toFileStatus = (state) =>
      state
        ? { status: state.syncStatus, current_version: state.version, last_sync_timestamp: state.updatedAt }
        : { status: 'not_initialized' };
    const files = { program: toFileStatus(programState), notes: toFileStatus(notesState) };

    // Feedback was never version-tracked by sync-engine.js either (upload
    // only accepts file_type program/notes); kept as 'not_initialized' to
    // match, but entry_count now reflects the real parsed count instead of
    // the original heading-regex count (which never matched real dated
    // headings and always returned 0 for actual customer files).
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
