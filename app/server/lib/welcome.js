import { getSupabaseClient } from './database-client.js';
import { CustomerNotFoundError, DatabaseError } from './customer-data.js';

// Welcome motivation message (specs/018-welcome-motivation-popup data-model.md): one
// coach-written message per customer, shown as a popup after sign-in. Only the API server
// (service key) touches the table. Message text is never logged.

export const MAX_WELCOME_CHARS = 300;
const COLUMNS = 'customer_slug, body, delivery_weekday, repeat_weekly, updated_at, last_seen_week, last_seen_at';
const DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const DAY_MS = 86_400_000;

/** { ok: true, value: { body, deliveryWeekday, repeatWeekly } } or { ok: false, fields }. */
export function validateWelcome(input) {
  const fields = {};
  const body = typeof input?.body === 'string' ? input.body.trim() : '';
  if (!body) fields.body = 'Write a message.';
  // Characters, not UTF-16 units: an emoji counts once, like the database CHECK.
  else if ([...body].length > MAX_WELCOME_CHARS) fields.body = `Keep messages under ${MAX_WELCOME_CHARS} characters.`;

  const day = input?.deliveryWeekday ?? 1;
  if (!Number.isInteger(day) || day < 1 || day > 7) fields.deliveryWeekday = 'Choose a day from Monday to Sunday.';

  const repeat = input?.repeatWeekly ?? true;
  if (typeof repeat !== 'boolean') fields.repeatWeekly = 'repeatWeekly must be true or false.';

  return Object.keys(fields).length ? { ok: false, fields } : { ok: true, value: { body, deliveryWeekday: day, repeatWeekly: repeat } };
}

/** Milliseconds (UTC midnight) of a real YYYY-MM-DD date, or null for anything else. */
function parseDate(str) {
  const m = typeof str === 'string' ? DATE.exec(str) : null;
  if (!m) return null;
  const ms = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const d = new Date(ms);
  // Date.UTC rolls 2026-02-30 over to March; reject anything that did not round-trip.
  return d.getUTCFullYear() === Number(m[1]) && d.getUTCMonth() === Number(m[2]) - 1 && d.getUTCDate() === Number(m[3]) ? ms : null;
}

const toDateString = (ms) => new Date(ms).toISOString().slice(0, 10);

/** ISO weekday of a YYYY-MM-DD date: 1 = Monday ... 7 = Sunday. */
export function isoWeekday(dateStr) {
  const day = new Date(parseDate(dateStr)).getUTCDay();
  return day === 0 ? 7 : day;
}

/** True for a real YYYY-MM-DD date that is a Monday. */
export function isMondayDate(dateStr) {
  return parseDate(dateStr) !== null && isoWeekday(dateStr) === 1;
}

/** The Monday (YYYY-MM-DD) of the week containing a YYYY-MM-DD date. */
export function weekStart(dateStr) {
  return toDateString(parseDate(dateStr) - (isoWeekday(dateStr) - 1) * DAY_MS);
}

/** True when `dateStr` is a real date within one day of the server's UTC date (time zones span ±1 day). */
export function validateToday(dateStr, nowMs = Date.now()) {
  const ms = parseDate(dateStr);
  if (ms === null) return false;
  const serverDay = Date.UTC(new Date(nowMs).getUTCFullYear(), new Date(nowMs).getUTCMonth(), new Date(nowMs).getUTCDate());
  return Math.abs(ms - serverDay) <= DAY_MS;
}

/** True when the week's message is due on `today` and has not been shown yet. */
export function isDue(row, today) {
  if (!row || isoWeekday(today) < row.delivery_weekday) return false;
  const lastSeen = row.last_seen_week ?? null;
  return row.repeat_weekly ? lastSeen !== weekStart(today) : lastSeen === null;
}

/** API shape for the coach (contracts/welcome-api.md). `today` is the server's UTC date. */
export function shapeWelcome(row, today = toDateString(Date.now())) {
  const seen = (row.last_seen_week ?? null) === weekStart(today);
  return {
    body: row.body,
    deliveryWeekday: row.delivery_weekday,
    repeatWeekly: row.repeat_weekly,
    updatedAt: row.updated_at,
    status: seen ? 'seen' : 'scheduled',
    lastSeenAt: row.last_seen_at ?? null,
  };
}

function dbError(context, error) {
  return new DatabaseError(`${context}: ${error.message}`, error);
}

// Test-only: replaces the four queries below with an in-memory store
// ({ exists, get, put, remove, markSeen }); pass null to restore.
let override = null;
export function setWelcomeForTests(impl) {
  override = impl || null;
}

const db = () => getSupabaseClient().from('welcome_messages');

async function assertCustomerExists(slug) {
  if (override) {
    if (!(await override.exists(slug))) throw new CustomerNotFoundError(slug);
    return;
  }
  const { data, error } = await getSupabaseClient().from('customers').select('slug').eq('slug', slug).maybeSingle();
  if (error) throw dbError(`customers(${slug})`, error);
  if (!data) throw new CustomerNotFoundError(slug);
}

/** The customer's welcome row, or null. */
export async function getWelcome(slug) {
  if (override) return override.get(slug);
  const { data, error } = await db().select(COLUMNS).eq('customer_slug', slug).maybeSingle();
  if (error) throw dbError(`welcome_messages(${slug})`, error);
  return data;
}

/**
 * Creates or replaces the message. Seen state is reset only when the text changed (a new
 * message should show); changing just the day or the repeat setting keeps it.
 */
export async function saveWelcome(slug, { body, deliveryWeekday, repeatWeekly }) {
  await assertCustomerExists(slug);
  const existing = await getWelcome(slug);
  const textChanged = !existing || existing.body !== body;
  const row = {
    customer_slug: slug,
    body,
    delivery_weekday: deliveryWeekday,
    repeat_weekly: repeatWeekly,
    updated_at: new Date().toISOString(),
    last_seen_week: textChanged ? null : existing.last_seen_week ?? null,
    last_seen_at: textChanged ? null : existing.last_seen_at ?? null,
  };
  if (override) return override.put(slug, row);
  const { data, error } = await db().upsert(row).select(COLUMNS).single();
  if (error) throw dbError(`welcome_messages upsert(${slug})`, error);
  return data;
}

export async function deleteWelcome(slug) {
  if (override) return override.remove(slug);
  const { error } = await db().delete().eq('customer_slug', slug);
  if (error) throw dbError(`welcome_messages delete(${slug})`, error);
}

/** Records that the customer dismissed the week's popup. Returns whether a message existed. */
export async function markWelcomeSeen(slug, weekStartStr) {
  if (override) return override.markSeen(slug, weekStartStr);
  const { data, error } = await db()
    .update({ last_seen_week: weekStartStr, last_seen_at: new Date().toISOString() })
    .eq('customer_slug', slug)
    .select('customer_slug');
  if (error) throw dbError(`welcome_messages seen(${slug})`, error);
  return data.length > 0;
}
