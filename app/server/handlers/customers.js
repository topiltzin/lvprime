import { parseProgramDetail, parseProgramGoal } from '../markdown-parser.js';
import { renderMarkdown } from '../markdown-render.js';
import { parseMeasurements } from '../measurements.js';
import {
  validateDayNotesSubmission,
  validateFeedbackSubmission,
  validateQuickCompleteSubmission,
  withNotReported,
} from '../feedback-writer.js';
import { readJsonBodyOr422, sendJson } from '../http.js';
import {
  getCustomer,
  getCustomerFeedback,
  getCustomerNutritionPlan,
  getCustomerFullProfile,
  getCustomerProgramWeek,
  listCustomerProgramWeeks,
  getExerciseVideoLinkMap,
  addFeedbackEntry,
  quickCompleteFeedbackEntry,
  saveDayNotes,
  listAllCustomers,
  computeFeedbackTrend,
  getCustomerAccess,
  AccountsUnavailableError,
  WeekNotFoundError,
} from '../lib/customer-data.js';
import { listAttachments } from '../lib/attachments.js';
import { getAuthUserEmail } from '../auth.js';

// Customer reads and feedback writes.

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
export function parseWeekNumber(value) {
  if (value === undefined || value === null || value === '') return null;
  const n = Number(value);
  return Number.isInteger(n) && n >= 1 ? n : NaN;
}

export async function handleGetProgramWeeks(req, res, slug) {
  const weeks = await listCustomerProgramWeeks(slug);
  sendJson(res, 200, { weeks });
}

export async function handleGetProgramWeek(req, res, slug, weekParam) {
  const weekNumber = parseWeekNumber(weekParam);
  if (!weekNumber) return sendJson(res, 422, { error: 'validation_failed', fields: { week: 'must be a positive integer' } });
  try {
    const [row, videoLinkMap] = await Promise.all([getCustomerProgramWeek(slug, weekNumber), getExerciseVideoLinkMap()]);
    sendJson(res, 200, programWeekJson(row, videoLinkMap, row));
  } catch (err) {
    if (err instanceof WeekNotFoundError) return sendJson(res, 404, { error: 'week_not_found', weekNumber });
    throw err;
  }
}

export async function handleGetCustomers(req, res) {
  const rows = await listAllCustomers();
  sendJson(res, 200, { customers: rows });
}

export async function handleGetCustomer(req, res, slug) {
  // Runs the 4 related-table queries in parallel instead of resolving the
  // customer 5 times sequentially (per-slug getCustomer* calls) — that was
  // ~9 sequential Supabase round trips and blew past the <500ms target
  // (spec SC-004). getExerciseVideoLinkMap() isn't customer-scoped, so it
  // runs alongside rather than inside that per-customer Promise.all
  // (specs/007-exercise-library-migration plan.md Performance Goals).
  const [profile, videoLinkMap, attachmentList] = await Promise.all([
    getCustomerFullProfile(slug),
    getExerciseVideoLinkMap(),
    listAttachmentsOrNull(slug),
  ]);
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
  if (notesRow && req.actor?.role !== 'customer') {
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

  const base = {
    slug: customer.slug,
    displayName: customer.name,
    archivedAt: customer.archived_at ?? null,
    program,
    programWeeks,
    nutrition,
    measurements: parseMeasurements(notesRow?.content),
    // null when Storage couldn't be read; the page still loads and says so.
    attachments: attachmentList,
  };

  const view = shapeCustomerView(req.actor?.role, {
    base,
    notes,
    feedbackRows: feedback.entries,
    template: feedback.template,
  });
  if (view.role === 'coach') view.access = await loadAccessSummary(slug);
  sendJson(res, 200, view);
}

/**
 * The customer page payload for a role. Customers get no coach notes and no tracking
 * detail (Notas / Seguimiento are coach only, specs/015 FR-011): only which days they
 * completed, for the Program tab's done marks, plus the form template for Registrar sesión.
 */
export function shapeCustomerView(role, { base, notes, feedbackRows, template }) {
  if (role === 'customer') {
    const completedDays = feedbackRows.map((row) => ({
      date: row.entry_date,
      label: row.label,
      completed: row.completed,
    }));
    return { ...base, role: 'customer', notes: { present: false }, feedback: { completedDays, template } };
  }
  return {
    ...base,
    role: 'coach',
    notes,
    feedback: { entries: feedbackRows.map(toFeedbackEntryJson), trend: computeFeedbackTrend(feedbackRows), template },
  };
}

// Whether the client can sign in (coach view). Never fails the page: before the 017
// migration, or if Auth is down, the summary just reads as "no access".
async function loadAccessSummary(slug) {
  try {
    const access = await getCustomerAccess(slug);
    let email = null;
    if (access.authUserId) email = (await getAuthUserEmail(access.authUserId)).email ?? null;
    return { hasAccess: access.hasAccess, email, mustChangePassword: access.mustChangePassword };
  } catch (err) {
    if (!(err instanceof AccountsUnavailableError)) console.error('Access summary unavailable:', err.message);
    return { hasAccess: false, email: null, mustChangePassword: false, unavailable: true };
  }
}

// Attachments are secondary to the program: a Storage outage (or a bucket that
// hasn't been created yet) shouldn't take the whole client page down.
async function listAttachmentsOrNull(slug) {
  try {
    return await listAttachments(slug);
  } catch (err) {
    console.error('Attachments unavailable:', err.message);
    return null;
  }
}

export async function handleGetNutrition(req, res, slug) {
  const nutritionRow = await getCustomerNutritionPlan(slug);
  // Nutrition plans are written outside the app (nutrition specialist skill
  // or manual creation, per specs/005-nutrition-plan-tab Assumption 2), so
  // there's no in-app write path to re-check here — the 100KB limit is
  // enforced at migration/write time in customer-data.js. This defensive
  // re-check just guards against any future out-of-band insert.
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

export async function handlePostFeedback(req, res, slug) {
  const customer = await getCustomer(slug);

  const body = await readJsonBodyOr422(req, res);
  if (body === undefined) return;

  const existingFeedback = await getCustomerFeedback(slug, { customer });
  const result = validateFeedbackSubmission(existingFeedback.template, body);
  if (!result.valid) {
    sendJson(res, 422, { error: 'validation_failed', fields: result.fields });
    return;
  }

  // Same date + label replaces the existing entry (specs/012 FR-009): 200, not 201.
  const { entry, created } = await addFeedbackEntry(slug, customer.name, {
    date: body.date,
    label: body.label || null,
    fields: withNotReported(existingFeedback.template, body.fields),
  }, { customer, feedback: existingFeedback });

  sendJson(res, created ? 201 : 200, toFeedbackEntryJson(entry));
}

// "Mark done" on a Program day (specs/012-program-day-mark-done contracts/feedback-api.md).
export async function handlePostQuickComplete(req, res, slug) {
  const customer = await getCustomer(slug);

  const body = await readJsonBodyOr422(req, res);
  if (body === undefined) return;

  const result = validateQuickCompleteSubmission(body);
  if (!result.valid) {
    sendJson(res, 422, { error: 'validation_failed', fields: result.fields });
    return;
  }

  const { entry, created } = await quickCompleteFeedbackEntry(slug, customer.name, {
    date: body.date,
    label: body.label.trim(),
  }, { customer });
  sendJson(res, created ? 201 : 200, { created, entry: toFeedbackEntryJson(entry) });
}

// The per-day notepad: one free-text note for the whole session, saved as that day's
// single feedback entry (created when missing, otherwise only its notes change).
export async function handlePutDayNotes(req, res, slug) {
  const customer = await getCustomer(slug);

  const body = await readJsonBodyOr422(req, res);
  if (body === undefined) return;

  const result = validateDayNotesSubmission(body);
  if (!result.valid) {
    sendJson(res, 422, { error: 'validation_failed', fields: result.fields });
    return;
  }

  const { entry, created } = await saveDayNotes(slug, customer.name, {
    date: body.date,
    label: body.label.trim(),
    notes: body.notes,
  }, { customer });
  sendJson(res, created ? 201 : 200, { created, entry: toFeedbackEntryJson(entry) });
}
