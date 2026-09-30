import * as hashUtils from '../hash-utils.js';
import { parseMeasurements, slugifyName, upsertMeasurementText, validateMeasurement } from '../measurements.js';
import { readJsonBodyOr422, sendJson } from '../http.js';
import { parseWeekNumber } from './customers.js';
import {
  getCustomer,
  getCustomerProgram,
  getCustomerNotes,
  getCustomerNutritionPlan,
  createCustomer,
  setCustomerArchived,
  syncCoachWrite,
  ArchiveUnavailableError,
  CustomerExistsError,
  WeekNotFoundError,
  WeekLockedError,
  WeekNumberGapError,
} from '../lib/customer-data.js';

// ---- Coach editing (create client, save program week / notes / nutrition, log measurements) ----

const EDITABLE_FILE_TYPES = ['program', 'notes', 'nutrition_plan'];

export async function handleCreateCustomer(req, res) {
  const body = await readJsonBodyOr422(req, res);
  if (body === undefined) return;
  const name = typeof body?.name === 'string' ? body.name.trim() : '';
  if (!name || name.length > 255) {
    return sendJson(res, 422, { error: 'validation_failed', fields: { name: 'Enter the client\'s name.' } });
  }
  const slug = slugifyName(name);
  if (!slug) {
    return sendJson(res, 422, { error: 'validation_failed', fields: { name: 'Use at least 3 letters or numbers.' } });
  }
  try {
    const customer = await createCustomer(slug, name);
    sendJson(res, 201, { slug: customer.slug, displayName: customer.name });
  } catch (err) {
    if (err instanceof CustomerExistsError) {
      return sendJson(res, 409, { error: 'customer_exists', slug, message: 'A client with that name already exists.' });
    }
    throw err;
  }
}

// POST /api/customers/<slug>/archive and /restore. Archived clients drop out of
// the overview's working filters and the sidebar; nothing is deleted.
export async function handleSetArchived(req, res, slug, archived) {
  try {
    const archivedAt = await setCustomerArchived(slug, archived);
    sendJson(res, 200, { slug, archivedAt });
  } catch (err) {
    if (err instanceof ArchiveUnavailableError) {
      return sendJson(res, 503, {
        error: 'archive_unavailable',
        message: 'Archiving needs a database update (server/migrations/014-customer-archive.sql).',
      });
    }
    throw err;
  }
}

// Saves one file. The server hashes the content, so the browser needn't. Same
// coach-wins versioning and week lock as /api/sync/upload.
export async function handlePutContent(req, res, slug) {
  const body = await readJsonBodyOr422(req, res);
  if (body === undefined) return;

  const fileType = body?.file_type;
  const fields = {};
  if (!EDITABLE_FILE_TYPES.includes(fileType)) fields.file_type = `must be one of ${EDITABLE_FILE_TYPES.join(', ')}`;
  if (typeof body?.content !== 'string' || !body.content.trim()) fields.content = 'Content cannot be empty.';
  const weekNumber = parseWeekNumber(body?.week_number);
  if (Number.isNaN(weekNumber)) fields.week_number = 'must be a positive integer';
  const version = Number.isInteger(body?.version) && body.version >= 0 ? body.version : 0;
  if (Object.keys(fields).length) return sendJson(res, 422, { error: 'validation_failed', fields });

  const customer = await getCustomer(slug);
  try {
    const result = await syncCoachWrite(slug, fileType, {
      weekNumber: fileType === 'program' ? weekNumber : null,
      currentVersion: version,
      content: body.content,
      contentHash: hashUtils.computeContentHash(body.content),
    }, { customer });
    sendJson(res, 200, {
      file_type: fileType,
      week_number: result.weekNumber,
      version: result.newVersion,
      conflicted: result.conflicted,
    });
  } catch (err) {
    if (err instanceof WeekLockedError) {
      return sendJson(res, 423, { error: 'week_locked', weekNumber: err.weekNumber, currentWeek: err.currentWeek,
        message: `Week ${err.weekNumber} is closed. Only week ${err.currentWeek} can be edited.` });
    }
    if (err instanceof WeekNumberGapError) {
      return sendJson(res, 400, { error: 'week_number_gap', expected: err.expected,
        message: `The next week you can add is week ${err.expected}.` });
    }
    throw err;
  }
}

// Raw Markdown + version, for the editor.
export async function handleGetContent(req, res, slug) {
  const url = new URL(req.url, 'http://localhost');
  const fileType = url.searchParams.get('file_type');
  const weekNumber = parseWeekNumber(url.searchParams.get('week_number'));
  if (!EDITABLE_FILE_TYPES.includes(fileType) || Number.isNaN(weekNumber)) {
    return sendJson(res, 422, { error: 'validation_failed', fields: { file_type: `must be one of ${EDITABLE_FILE_TYPES.join(', ')}` } });
  }
  const customer = await getCustomer(slug);
  let row = null;
  if (fileType === 'program') {
    try {
      row = await getCustomerProgram(slug, weekNumber, { customer });
    } catch (err) {
      if (!(err instanceof WeekNotFoundError)) throw err;
    }
  } else if (fileType === 'notes') {
    row = await getCustomerNotes(slug, { customer });
  } else {
    row = await getCustomerNutritionPlan(slug, { customer });
  }
  sendJson(res, 200, {
    file_type: fileType,
    week_number: row?.week_number ?? weekNumber,
    content: row?.content ?? '',
    version: row?.version ?? 0,
    exists: !!row,
  });
}

// Adds (or replaces, for the same date) one row of the notes.md measurements table.
export async function handlePostMeasurement(req, res, slug) {
  const body = await readJsonBodyOr422(req, res);
  if (body === undefined) return;
  const result = validateMeasurement(body);
  if (!result.ok) return sendJson(res, 422, { error: 'validation_failed', fields: result.fields });

  const customer = await getCustomer(slug);
  const notesRow = await getCustomerNotes(slug, { customer });
  const content = upsertMeasurementText(notesRow?.content ?? '', result);
  await syncCoachWrite(slug, 'notes', {
    currentVersion: notesRow?.version ?? 0,
    content,
    contentHash: hashUtils.computeContentHash(content),
  }, { customer });
  sendJson(res, 201, { measurements: parseMeasurements(content) });
}
