import {
  deleteWelcome,
  getWelcome,
  isDue,
  markWelcomeSeen,
  saveWelcome,
  shapeWelcome,
  validateToday,
  validateWelcome,
  isMondayDate,
  weekStart,
} from '../lib/welcome.js';
import { readJsonBodyOr422, sendJson } from '../http.js';

// Welcome motivation message (specs/018-welcome-motivation-popup contracts/welcome-api.md).
// The due check and "seen" are tagged access: 'customer-own'; everything else is coach-only
// (the default tag), so a customer can never write a message.

const invalid = (res, field, message) => sendJson(res, 422, { error: 'validation_failed', fields: { [field]: message } });

export async function handleGetWelcomeDue(req, res, slug) {
  // The coach never sees a customer popup (the editor has its own preview).
  if (req.actor.role === 'coach') return sendJson(res, 200, { due: false });

  const today = new URL(req.url, 'http://localhost').searchParams.get('today');
  if (!validateToday(today)) return invalid(res, 'today', 'today must be a YYYY-MM-DD date.');

  const row = await getWelcome(slug);
  if (!isDue(row, today)) return sendJson(res, 200, { due: false });
  sendJson(res, 200, { due: true, message: { body: row.body, coachName: null }, weekStart: weekStart(today) });
}

export async function handleMarkWelcomeSeen(req, res, slug) {
  if (req.actor.role === 'coach') return sendJson(res, 200, { recorded: false });
  const body = await readJsonBodyOr422(req, res);
  if (body === undefined) return;

  const week = body?.weekStart;
  if (!isMondayDate(week)) return invalid(res, 'weekStart', 'weekStart must be a Monday as YYYY-MM-DD.');
  sendJson(res, 200, { recorded: await markWelcomeSeen(slug, week) });
}

export async function handleGetWelcome(req, res, slug) {
  const row = await getWelcome(slug);
  sendJson(res, 200, { message: row ? shapeWelcome(row) : null });
}

export async function handlePutWelcome(req, res, slug) {
  const body = await readJsonBodyOr422(req, res);
  if (body === undefined) return;
  const result = validateWelcome(body);
  if (!result.ok) return sendJson(res, 422, { error: 'validation_failed', fields: result.fields });
  const row = await saveWelcome(slug, result.value);
  sendJson(res, 200, { message: shapeWelcome(row) });
}

export async function handleDeleteWelcome(req, res, slug) {
  await deleteWelcome(slug);
  sendJson(res, 200, { deleted: true });
}
