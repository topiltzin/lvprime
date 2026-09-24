/**
 * Data Access Layer for customer data on Supabase PostgreSQL.
 * See specs/006-customer-data-storage/contracts/data-api-layer.md for the
 * full contract this module implements.
 *
 * Server-only: imports @supabase/supabase-js with SUPABASE_SECRET_KEY, which
 * must never reach the browser bundle. Only import this from app/server/*.
 */
import { getSupabaseClient } from './database-client.js';
import { computeContentHash, verifyContentHash } from '../hash-utils.js';
import { resolveCoachSync } from '../sync-engine.js';
import { deriveWeekState, validateNextWeekNumber } from './week-lock-rule.js';
import {
  extractFeedbackTemplate,
  parseFeedbackEntries,
  formatFeedbackEntry,
  parseProgramGoal,
} from '../markdown-parser.js';

// ---- Error classes (contracts/data-api-layer.md "Error Handling") ----

export class CustomerNotFoundError extends Error {
  constructor(slug) {
    super(`Customer not found: ${slug}`);
    this.name = 'CustomerNotFoundError';
    this.code = 'CUSTOMER_NOT_FOUND';
  }
}

export class ValidationError extends Error {
  constructor(field, message) {
    super(`Validation error on ${field}: ${message}`);
    this.name = 'ValidationError';
    this.code = 'VALIDATION_ERROR';
    this.field = field;
  }
}

export class WeekNotFoundError extends Error {
  constructor(slug, weekNumber) {
    super(`No program for ${slug} week ${weekNumber}`);
    this.name = 'WeekNotFoundError';
    this.code = 'WEEK_NOT_FOUND';
    this.weekNumber = weekNumber;
  }
}

export { WeekLockedError, WeekNumberGapError } from './week-lock-rule.js';

export class DatabaseError extends Error {
  constructor(message, cause) {
    super(`Database error: ${message}`);
    this.name = 'DatabaseError';
    this.code = 'DATABASE_ERROR';
    this.cause = cause;
  }
}

// ---- Validation helpers ----

// Per contracts/database-schema.md customers table constraint.
const SLUG_REGEX = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/;

function assertValidSlug(slug) {
  if (typeof slug !== 'string' || slug.length < 3 || slug.length > 100 || !SLUG_REGEX.test(slug)) {
    throw new ValidationError('slug', `must be lowercase alphanumeric with hyphens, 3-100 chars, got "${slug}"`);
  }
}

// Programs and Notes: 500KB (data-model.md). NutritionPlan keeps the
// pre-existing 100KB limit from specs/005-nutrition-plan-tab FR-008 so
// this migration doesn't change that feature's behavior.
const MAX_CONTENT_BYTES = 500 * 1024;
const MAX_NUTRITION_BYTES = 100 * 1024;

function assertContentSize(content, field, maxBytes = MAX_CONTENT_BYTES) {
  if (typeof content !== 'string' || content.length === 0) {
    throw new ValidationError(field, 'content must be a non-empty string');
  }
  if (Buffer.byteLength(content, 'utf8') > maxBytes) {
    throw new ValidationError(field, `content MUST NOT exceed ${Math.round(maxBytes / 1024)}KB`);
  }
}

function dbError(context, error) {
  return new DatabaseError(`${context}: ${error.message}`, error);
}

// ---- Core read functions (contracts/data-api-layer.md) ----

export async function getCustomer(slug) {
  assertValidSlug(slug);
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.from('customers').select('*').eq('slug', slug).maybeSingle();
  if (error) throw dbError(`getCustomer(${slug})`, error);
  if (!data) throw new CustomerNotFoundError(slug);
  return data;
}

// "ById" variants take an already-resolved customer_id and skip the slug ->
// customer lookup. Used internally (handleGetCustomer, listAllCustomers) to
// run the 4 per-customer queries in parallel via Promise.all instead of each
// one separately re-resolving the customer — that redundant resolution was
// turning 1 logical "load a customer" into ~9 sequential Supabase round
// trips and blowing past the <500ms target (spec SC-004). The public
// getCustomerXxx(slug) functions below are unchanged for other callers.

// programs holds one row per (customer, week_number); weekNumber = null means
// the current week, i.e. the highest week_number (specs/010 data-model.md).
async function getCustomerProgramById(customerId, weekNumber = null) {
  const supabase = getSupabaseClient();
  let query = supabase.from('programs').select('*').eq('customer_id', customerId);
  query =
    weekNumber == null
      ? query.order('week_number', { ascending: false }).limit(1)
      : query.eq('week_number', weekNumber);
  const { data, error } = await query.maybeSingle();
  if (error) throw dbError(`getCustomerProgramById(${customerId}, ${weekNumber})`, error);
  return data || null;
}

async function listProgramWeeksById(customerId) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('programs')
    .select('week_number, updated_at')
    .eq('customer_id', customerId);
  if (error) throw dbError(`listProgramWeeksById(${customerId})`, error);
  const updatedAtByWeek = new Map((data || []).map((r) => [r.week_number, r.updated_at]));
  return deriveWeekState([...updatedAtByWeek.keys()]).map((w) => ({
    ...w,
    updatedAt: updatedAtByWeek.get(w.weekNumber),
  }));
}

async function getMaxProgramWeek(customerId) {
  const weeks = await listProgramWeeksById(customerId);
  return weeks.length ? weeks[weeks.length - 1].weekNumber : 0;
}

async function getCustomerFeedbackById(customerId) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('feedbacks')
    .select('content, updated_at')
    .eq('customer_id', customerId)
    .maybeSingle();
  if (error) throw dbError(`getCustomerFeedbackById(${customerId})`, error);

  const content = data ? data.content : '';
  return {
    content,
    entries: parseFeedbackEntries(content),
    template: extractFeedbackTemplate(content),
    updatedAt: data ? data.updated_at : null,
  };
}

async function getCustomerNotesById(customerId) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.from('notes').select('*').eq('customer_id', customerId).maybeSingle();
  if (error) throw dbError(`getCustomerNotesById(${customerId})`, error);
  return data || null;
}

async function getCustomerNutritionPlanById(customerId) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('nutrition_plans')
    .select('*')
    .eq('customer_id', customerId)
    .maybeSingle();
  if (error) throw dbError(`getCustomerNutritionPlanById(${customerId})`, error);
  return data || null;
}

export async function getCustomerProgram(slug, weekNumber = null) {
  const customer = await getCustomer(slug);
  return getCustomerProgramById(customer.id, weekNumber);
}

/** [{ weekNumber, isCurrent, isLocked, updatedAt }] ascending; [] when no program. */
export async function listCustomerProgramWeeks(slug) {
  const customer = await getCustomer(slug);
  return listProgramWeeksById(customer.id);
}

/** Program row plus derived lock state for one week; throws WeekNotFoundError if absent. */
export async function getCustomerProgramWeek(slug, weekNumber) {
  const customer = await getCustomer(slug);
  const [row, weeks] = await Promise.all([
    getCustomerProgramById(customer.id, weekNumber),
    listProgramWeeksById(customer.id),
  ]);
  if (!row) throw new WeekNotFoundError(slug, weekNumber);
  const state = weeks.find((w) => w.weekNumber === weekNumber);
  return { ...row, isCurrent: state.isCurrent, isLocked: state.isLocked };
}

/**
 * Feedback is stored as raw markdown (feedbacks.content), not a fixed JSON
 * shape — each customer's feedback.md defines its own field template (see
 * markdown-parser.js). This mirrors what app/server/index.js's
 * handleGetCustomer currently does via fs.readFileSync + parseFeedbackEntries.
 */
export async function getCustomerFeedback(slug) {
  const customer = await getCustomer(slug);
  return getCustomerFeedbackById(customer.id);
}

export async function getCustomerNotes(slug) {
  const customer = await getCustomer(slug);
  return getCustomerNotesById(customer.id);
}

export async function getCustomerNutritionPlan(slug) {
  const customer = await getCustomer(slug);
  return getCustomerNutritionPlanById(customer.id);
}

/**
 * Loads a full customer profile (customer row + program + notes +
 * nutrition_plan + feedback) with the 4 related-table queries run in
 * parallel — this is what handleGetCustomer in server/index.js should call
 * instead of resolving the customer once and then calling getCustomerProgram/
 * getCustomerNotes/getCustomerNutritionPlan/getCustomerFeedback separately
 * (each of which would otherwise redundantly re-resolve the customer).
 */
export async function getCustomerFullProfile(slug) {
  const customer = await getCustomer(slug);
  const [program, programWeeks, notes, nutritionPlan, feedback] = await Promise.all([
    getCustomerProgramById(customer.id),
    listProgramWeeksById(customer.id),
    getCustomerNotesById(customer.id),
    getCustomerNutritionPlanById(customer.id),
    getCustomerFeedbackById(customer.id),
  ]);
  return { customer, program, programWeeks, notes, nutritionPlan, feedback };
}

// ---- List all customers (replaces customers-repo.js's listCustomers + SQLite index) ----

const DIFFICULTY_SCORE = {
  fácil: 1,
  facil: 1,
  easy: 1,
  moderada: 2,
  moderate: 2,
  difícil: 3,
  dificil: 3,
  hard: 3,
  brutal: 4,
};

/**
 * Computes the completion-rate and difficulty/energy trend directly from
 * parseFeedbackEntries() output. Replaces db.js's getFeedbackTrend, which
 * operated on SQLite-indexed rows (completed stored as 1/0/null there vs a
 * real boolean/null here).
 */
export function computeFeedbackTrend(entries) {
  const rows = entries.filter((r) => r.raw_matched);
  const withCompleted = rows.filter((r) => r.completed != null);
  const completionRate = withCompleted.length
    ? withCompleted.filter((r) => r.completed === true).length / withCompleted.length
    : null;
  const points = rows.map((r) => ({
    date: r.entry_date,
    completed: r.completed,
    difficulty: r.difficulty,
    difficultyScore: r.difficulty ? DIFFICULTY_SCORE[r.difficulty.trim().toLowerCase()] ?? null : null,
  }));
  return { completionRate, points };
}

/**
 * Replaces customers-repo.js's listCustomers() (which reindexed from the
 * filesystem into SQLite then read back). Coach-only tool with 10-50
 * customers (per plan.md Scale/Scope) — the 3 queries per customer run in
 * parallel, and all customers are processed in parallel with each other too
 * (not one customer at a time), so this is bounded by one network round
 * trip's worth of latency rather than 3x the customer count.
 */
export async function listAllCustomers() {
  const supabase = getSupabaseClient();
  const { data: customers, error } = await supabase.from('customers').select('*').order('name');
  if (error) throw dbError('listAllCustomers', error);

  return Promise.all(
    customers.map(async (customer) => {
      const [programRes, notesRes, feedbackRes] = await Promise.all([
        supabase
          .from('programs')
          .select('content')
          .eq('customer_id', customer.id)
          .order('week_number', { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase.from('notes').select('id').eq('customer_id', customer.id).maybeSingle(),
        supabase.from('feedbacks').select('content').eq('customer_id', customer.id).maybeSingle(),
      ]);
      if (programRes.error) throw dbError(`listAllCustomers(${customer.slug}) program`, programRes.error);
      if (notesRes.error) throw dbError(`listAllCustomers(${customer.slug}) notes`, notesRes.error);
      if (feedbackRes.error) throw dbError(`listAllCustomers(${customer.slug}) feedback`, feedbackRes.error);

      const programGoal = programRes.data?.content ? parseProgramGoal(programRes.data.content) : null;
      const entries = feedbackRes.data?.content ? parseFeedbackEntries(feedbackRes.data.content) : [];
      const lastMatched = [...entries].reverse().find((e) => e.raw_matched && e.entry_date_iso);

      return {
        slug: customer.slug,
        displayName: customer.name,
        hasProgram: !!programRes.data,
        hasNotes: !!notesRes.data,
        programGoal,
        lastFeedbackDate: lastMatched ? lastMatched.entry_date_iso : null,
      };
    })
  );
}

// ---- Customer upsert (used by the migration script) ----

export async function upsertCustomer(slug, name) {
  assertValidSlug(slug);
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('customers')
    .upsert({ slug, name, updated_at: new Date().toISOString() }, { onConflict: 'slug' })
    .select()
    .single();
  if (error) throw dbError(`upsertCustomer(${slug})`, error);
  return data;
}

// ---- Write functions (contracts/data-api-layer.md) ----

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * DB-backed replacement for feedback-writer.js's appendFeedbackEntry(slug,
 * displayName, {date, label, fields}): reads feedbacks.content, derives that
 * customer's own template, formats + appends the new entry, upserts, and
 * returns the newly parsed entry. Field-level validation (required fields,
 * Completed Yes/No) stays in validateFeedbackSubmission — called by the route
 * handler before this, exactly as today; this function only checks `date`.
 */
export async function addFeedbackEntry(slug, displayName, { date, label, fields }) {
  if (!DATE_RE.test(date)) throw new ValidationError('date', 'must be in YYYY-MM-DD format');

  const customer = await getCustomer(slug);
  const existing = await getCustomerFeedbackById(customer.id);
  const template = existing.template;
  const entryText = formatFeedbackEntry(template, { date, label, fieldValues: fields });

  let newContent;
  if (existing.content.trim() === '') {
    newContent = `# ${displayName} - Feedback & Progress Log\n\n${entryText}\n`;
  } else {
    const separator = existing.content.endsWith('\n\n') ? '' : existing.content.endsWith('\n') ? '\n' : '\n\n';
    newContent = `${existing.content}${separator}${entryText}\n`;
  }

  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from('feedbacks')
    .upsert(
      { customer_id: customer.id, content: newContent, updated_at: new Date().toISOString() },
      { onConflict: 'customer_id' }
    );
  if (error) throw dbError(`addFeedbackEntry(${slug})`, error);

  const parsed = parseFeedbackEntries(newContent);
  return parsed[parsed.length - 1];
}

export async function updateCustomerNotes(slug, content) {
  assertContentSize(content, 'content', MAX_CONTENT_BYTES);
  const customer = await getCustomer(slug);
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('notes')
    .upsert(
      { customer_id: customer.id, content, updated_at: new Date().toISOString() },
      { onConflict: 'customer_id' }
    )
    .select()
    .single();
  if (error) throw dbError(`updateCustomerNotes(${slug})`, error);
  return data;
}

/** weekNumber defaults to the current week (week 1 for a customer with none). */
export async function updateCustomerProgram(slug, content, weekNumber = null) {
  assertContentSize(content, 'content', MAX_CONTENT_BYTES);
  const customer = await getCustomer(slug);
  const maxWeek = await getMaxProgramWeek(customer.id);
  const targetWeek = weekNumber ?? Math.max(maxWeek, 1);
  validateNextWeekNumber(maxWeek, targetWeek);
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('programs')
    .upsert(
      { customer_id: customer.id, week_number: targetWeek, content, updated_at: new Date().toISOString() },
      { onConflict: 'customer_id,week_number' }
    )
    .select()
    .single();
  if (error) throw dbError(`updateCustomerProgram(${slug})`, error);
  return data;
}

export async function updateCustomerNutritionPlan(slug, content) {
  assertContentSize(content, 'content', MAX_NUTRITION_BYTES);
  const customer = await getCustomer(slug);
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('nutrition_plans')
    .upsert(
      { customer_id: customer.id, content, updated_at: new Date().toISOString() },
      { onConflict: 'customer_id' }
    )
    .select()
    .single();
  if (error) throw dbError(`updateCustomerNutritionPlan(${slug})`, error);
  return data;
}

// ---- Sync & offline queue functions (absorbs sync-engine.js/sync-state.js/offline-queue.js) ----

const SYNC_TABLE_BY_FILE_TYPE = { program: 'programs', notes: 'notes', nutrition_plan: 'nutrition_plans' };

function assertSyncFileType(fileType) {
  if (!SYNC_TABLE_BY_FILE_TYPE[fileType]) {
    throw new ValidationError('fileType', `must be 'program', 'notes', or 'nutrition_plan', got "${fileType}"`);
  }
}

/**
 * Coach uploads a new program/notes/nutrition_plan version. Implements the
 * same "coach-always-wins" conflict resolution as sync-engine.js's
 * resolveCoachSync, backed by the target table's version column instead of
 * a JSON file.
 *
 * For 'program', weekNumber picks the week (default: current). Writing to a
 * past week or skipping ahead throws WeekLockedError / WeekNumberGapError
 * before any version resolution — coach-always-wins never overrides a lock.
 */
export async function syncCoachWrite(slug, fileType, { weekNumber = null, currentVersion, content, contentHash }) {
  assertSyncFileType(fileType);
  if (!verifyContentHash(content, contentHash)) {
    throw new ValidationError('contentHash', 'does not match computed hash of content');
  }

  const customer = await getCustomer(slug);
  const table = SYNC_TABLE_BY_FILE_TYPE[fileType];
  const supabase = getSupabaseClient();

  let targetWeek = null;
  if (fileType === 'program') {
    const maxWeek = await getMaxProgramWeek(customer.id);
    targetWeek = weekNumber ?? Math.max(maxWeek, 1);
    validateNextWeekNumber(maxWeek, targetWeek);
  }

  let readQuery = supabase.from(table).select('version').eq('customer_id', customer.id);
  if (targetWeek != null) readQuery = readQuery.eq('week_number', targetWeek);
  const { data: existing, error: readError } = await readQuery.maybeSingle();
  if (readError) throw dbError(`syncCoachWrite(${slug}, ${fileType}) read`, readError);

  const serverVersion = existing ? existing.version : 0;
  const resolution = resolveCoachSync({ current_version: currentVersion }, serverVersion);

  const row = {
    customer_id: customer.id,
    content,
    version: resolution.new_version,
    content_hash: contentHash,
    last_writer: 'coach',
    sync_status: 'synced',
    updated_at: new Date().toISOString(),
  };
  if (targetWeek != null) row.week_number = targetWeek;
  const { error: writeError } = await supabase
    .from(table)
    .upsert(row, { onConflict: targetWeek != null ? 'customer_id,week_number' : 'customer_id' });
  if (writeError) throw dbError(`syncCoachWrite(${slug}, ${fileType}) write`, writeError);

  await recordSyncEvent(slug, fileType, resolution.conflicted ? 'sync_conflict' : 'sync_success', {
    source: 'coach',
    weekNumber: targetWeek,
    versionFrom: serverVersion,
    versionTo: resolution.new_version,
    contentHash,
    conflictDescription: resolution.conflicted ? resolution.message : undefined,
  });

  return {
    status: 'synced',
    weekNumber: targetWeek,
    newVersion: resolution.new_version,
    conflicted: resolution.conflicted,
    serverVersion,
  };
}

/** Replaces sync-state.js's getSyncState. For 'program', weekNumber defaults to the current week. */
export async function getSyncState(slug, fileType, weekNumber = null) {
  assertSyncFileType(fileType);
  const customer = await getCustomer(slug);
  const table = SYNC_TABLE_BY_FILE_TYPE[fileType];
  const supabase = getSupabaseClient();
  let query = supabase
    .from(table)
    .select('version, sync_status, last_writer, content_hash, updated_at')
    .eq('customer_id', customer.id);
  if (fileType === 'program') {
    query =
      weekNumber == null
        ? query.order('week_number', { ascending: false }).limit(1)
        : query.eq('week_number', weekNumber);
  }
  const { data, error } = await query.maybeSingle();
  if (error) throw dbError(`getSyncState(${slug}, ${fileType})`, error);
  if (!data) return null;
  return {
    version: data.version,
    syncStatus: data.sync_status,
    lastWriter: data.last_writer,
    contentHash: data.content_hash,
    updatedAt: data.updated_at,
  };
}

const QUEUE_FILE_TYPES = new Set(['program', 'notes']);
const HASH_RE = /^[a-f0-9]{64}$/i;

function validateOfflineQueueEntry(entry) {
  if (!entry || typeof entry !== 'object') throw new ValidationError('entry', 'must be an object');
  if (!Number.isInteger(entry.sequence)) throw new ValidationError('sequence', 'is required and must be an integer');
  if (!entry.timestamp || isNaN(new Date(entry.timestamp).getTime())) {
    throw new ValidationError('timestamp', `must be a valid ISO8601 string, got "${entry.timestamp}"`);
  }
  if (!entry.action) throw new ValidationError('action', 'is required');
  if (!HASH_RE.test(entry.content_hash || '')) {
    throw new ValidationError('content_hash', `must be a SHA256 hex string (64 chars), got "${entry.content_hash}"`);
  }
  if (!(entry.content_size_bytes > 0)) {
    throw new ValidationError('content_size_bytes', 'must be > 0');
  }
}

/** Replaces offline-queue.js's queueChange. */
export async function queueOfflineChange(slug, fileType, entry) {
  if (!QUEUE_FILE_TYPES.has(fileType)) {
    throw new ValidationError('fileType', `must be 'program' or 'notes', got "${fileType}"`);
  }
  validateOfflineQueueEntry(entry);

  const customer = await getCustomer(slug);
  const supabase = getSupabaseClient();

  const existingQueue = await getOfflineQueue(slug, fileType);
  const maxSequence = existingQueue.length ? Math.max(...existingQueue.map((e) => e.sequence)) : 0;
  const expectedSequence = maxSequence + 1;
  if (entry.sequence !== expectedSequence) {
    if (expectedSequence === 1) {
      throw new ValidationError('sequence', `First sequence must be 1, got ${entry.sequence}`);
    }
    throw new ValidationError('sequence', `Sequence gap: expected ${expectedSequence}, got ${entry.sequence}`);
  }

  const currentWeek = fileType === 'program' ? await getMaxProgramWeek(customer.id) : null;

  const { error: insertError } = await supabase.from('offline_queue_entries').insert({
    customer_id: customer.id,
    file_type: fileType,
    week_number: currentWeek,
    sequence: entry.sequence,
    queued_at: entry.timestamp,
    action: entry.action,
    content_hash: entry.content_hash,
    content_size_bytes: entry.content_size_bytes,
    description: entry.description || null,
  });
  if (insertError) throw dbError(`queueOfflineChange(${slug}, ${fileType})`, insertError);

  const table = SYNC_TABLE_BY_FILE_TYPE[fileType];
  let statusQuery = supabase.from(table).update({ sync_status: 'pending' }).eq('customer_id', customer.id);
  if (currentWeek != null) statusQuery = statusQuery.eq('week_number', currentWeek);
  const { error: statusError } = await statusQuery;
  if (statusError) throw dbError(`queueOfflineChange(${slug}, ${fileType}) status update`, statusError);
}

/** Replaces offline-queue.js's getQueue. */
export async function getOfflineQueue(slug, fileType) {
  const customer = await getCustomer(slug);
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('offline_queue_entries')
    .select('*')
    .eq('customer_id', customer.id)
    .eq('file_type', fileType)
    .order('sequence', { ascending: true });
  if (error) throw dbError(`getOfflineQueue(${slug}, ${fileType})`, error);
  return data || [];
}

/** Replaces offline-queue.js's clearQueue. */
export async function clearOfflineQueue(slug, fileType) {
  const customer = await getCustomer(slug);
  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from('offline_queue_entries')
    .delete()
    .eq('customer_id', customer.id)
    .eq('file_type', fileType);
  if (error) throw dbError(`clearOfflineQueue(${slug}, ${fileType})`, error);
}

/** Replaces sync-state.js's recordSyncEvent. */
export async function recordSyncEvent(slug, fileType, eventType, metadata = {}) {
  const customer = await getCustomer(slug);
  const supabase = getSupabaseClient();
  const { error } = await supabase.from('sync_events').insert({
    customer_id: customer.id,
    file_type: fileType,
    week_number: metadata.weekNumber ?? null,
    event_type: eventType,
    source: metadata.source || null,
    version_from: metadata.versionFrom ?? null,
    version_to: metadata.versionTo ?? null,
    conflict_description: metadata.conflictDescription || null,
    error_message: metadata.errorMessage || null,
    content_hash: metadata.contentHash || null,
  });
  if (error) throw dbError(`recordSyncEvent(${slug}, ${fileType})`, error);
}

/** Replaces sync-state.js's getRecentSyncEvents. */
export async function getRecentSyncEvents(slug, limit = 10) {
  const customer = await getCustomer(slug);
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('sync_events')
    .select('*')
    .eq('customer_id', customer.id)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw dbError(`getRecentSyncEvents(${slug})`, error);
  return data || [];
}

// ---- Exercise library (specs/007-exercise-library-migration) ----

const EXERCISE_NAME_MAX = 255;
const VIDEO_URL_RE = /^https?:\/\//i;

function assertValidExerciseName(name) {
  if (typeof name !== 'string' || name.trim().length === 0 || name.length > EXERCISE_NAME_MAX) {
    throw new ValidationError('name', `must be a non-empty string of at most ${EXERCISE_NAME_MAX} chars, got "${name}"`);
  }
}

function assertValidVideoUrl(videoUrl) {
  if (videoUrl == null) return;
  if (typeof videoUrl !== 'string' || !VIDEO_URL_RE.test(videoUrl)) {
    throw new ValidationError('videoUrl', `must be an http(s) URL, got "${videoUrl}"`);
  }
}

/** Replaces exercise.md — every reference row, alphabetical by name. */
export async function listExercises() {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.from('exercises').select('*').order('name');
  if (error) throw dbError('listExercises', error);
  return data || [];
}

/**
 * One query, returns a Map of trimmed/lowercased exercise name -> video_url,
 * excluding rows with no video_url set (contracts/exercise-data-api.md). This
 * is what parseProgramDetail() uses to resolve each workout exercise's
 * videoUrl without one DB round trip per exercise line.
 */
export async function getExerciseVideoLinkMap() {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.from('exercises').select('name, video_url');
  if (error) throw dbError('getExerciseVideoLinkMap', error);
  const map = new Map();
  for (const row of data || []) {
    if (row.video_url) map.set(row.name.trim().toLowerCase(), row.video_url);
  }
  return map;
}

/**
 * Inserts a new exercise or updates the existing one matched case-insensitively
 * by name (spec FR-008). Looks the table up client-side rather than using
 * Supabase's ilike/onConflict filters — the library is small (~40-90 rows,
 * plan.md Scale/Scope) and this avoids ilike's %/_ wildcard-escaping footgun
 * for arbitrary exercise names.
 */
export async function upsertExercise(name, { category = null, videoUrl = null } = {}) {
  assertValidExerciseName(name);
  assertValidVideoUrl(videoUrl);

  const supabase = getSupabaseClient();
  const { data: rows, error: findError } = await supabase.from('exercises').select('id, name');
  if (findError) throw dbError(`upsertExercise(${name}) lookup`, findError);
  const existing = (rows || []).find((r) => r.name.trim().toLowerCase() === name.trim().toLowerCase());

  const payload = { name, category, video_url: videoUrl, updated_at: new Date().toISOString() };
  const { data, error } = existing
    ? await supabase.from('exercises').update(payload).eq('id', existing.id).select().single()
    : await supabase.from('exercises').insert(payload).select().single();
  if (error) throw dbError(`upsertExercise(${name})`, error);
  return data;
}

export { computeContentHash };
