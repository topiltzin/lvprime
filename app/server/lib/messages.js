import { getSupabaseClient } from './database-client.js';
import { CustomerNotFoundError, DatabaseError } from './customer-data.js';

// Coach-client messages (specs/016-coach-client-messaging data-model.md). One private
// conversation per customer = every customer_messages row with that customer_slug.
// Only the API server (service key) touches the table; the sender role always comes from
// the session, never from a request body. Message text is never logged.

export const MAX_MESSAGE_CHARS = 1000;
export const LIST_LIMIT = 100;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const COLUMNS = 'id, sender_role, body, created_at, read_at';

/** { ok: true, value: { body, clientId } } or { ok: false, fields } (same shape as validateChatQuestion). */
export function validateMessage(input) {
  const fields = {};
  const body = typeof input?.body === 'string' ? input.body.trim() : '';
  if (!body) fields.body = 'Write a message.';
  // Characters, not UTF-16 units or bytes: an emoji counts once, like the database CHECK.
  else if ([...body].length > MAX_MESSAGE_CHARS) fields.body = `Keep messages under ${MAX_MESSAGE_CHARS} characters.`;
  const clientId = typeof input?.clientId === 'string' ? input.clientId : '';
  if (!UUID.test(clientId)) fields.clientId = 'A valid clientId is required.';
  return Object.keys(fields).length ? { ok: false, fields } : { ok: true, value: { body, clientId } };
}

export function shapeMessage(row) {
  return { id: row.id, senderRole: row.sender_role, body: row.body, createdAt: row.created_at, readAt: row.read_at ?? null };
}

function dbError(context, error) {
  return new DatabaseError(`${context}: ${error.message}`, error);
}

// Test-only: replaces the queries below with an in-memory store
// ({ exists, list, insert, hasCoachMessage, markRead, countUnread, latestCoachMessageRead,
//   deleteCoachMessage, unreadByCustomer }); pass null to restore.
let override = null;
export function setMessagesForTests(impl) {
  override = impl || null;
}

const db = () => getSupabaseClient().from('customer_messages');

async function assertCustomerExists(slug) {
  if (override) {
    if (!(await override.exists(slug))) throw new CustomerNotFoundError(slug);
    return;
  }
  const { data, error } = await getSupabaseClient().from('customers').select('slug').eq('slug', slug).maybeSingle();
  if (error) throw dbError(`customers(${slug})`, error);
  if (!data) throw new CustomerNotFoundError(slug);
}

/** The latest LIST_LIMIT messages of a customer's conversation, oldest first. Throws CustomerNotFoundError for an unknown slug. */
export async function listMessages(slug) {
  await assertCustomerExists(slug);
  if (override) return override.list(slug, LIST_LIMIT);
  const { data, error } = await db().select(COLUMNS).eq('customer_slug', slug).order('id', { ascending: false }).limit(LIST_LIMIT);
  if (error) throw dbError(`customer_messages(${slug})`, error);
  return data.reverse();
}

/** Stores a message; a repeated clientId returns the existing row with created:false. */
export async function insertMessage(slug, senderRole, body, clientId) {
  await assertCustomerExists(slug);
  if (override) return override.insert(slug, senderRole, body, clientId);
  const { data, error } = await db()
    .insert({ customer_slug: slug, sender_role: senderRole, body, client_id: clientId })
    .select(COLUMNS)
    .single();
  if (!error) return { row: data, created: true };
  // 23505: this clientId was already stored (double tap, or a retry after a lost response).
  if (error.code === '23505') {
    const { data: existing, error: findError } = await db()
      .select(COLUMNS)
      .eq('customer_slug', slug)
      .eq('client_id', clientId)
      .single();
    if (findError) throw dbError(`customer_messages(${slug})`, findError);
    return { row: existing, created: false };
  }
  throw dbError(`customer_messages insert(${slug})`, error);
}

export async function hasCoachMessage(slug) {
  if (override) return override.hasCoachMessage(slug);
  const { count, error } = await db()
    .select('id', { count: 'exact', head: true })
    .eq('customer_slug', slug)
    .eq('sender_role', 'coach');
  if (error) throw dbError(`customer_messages(${slug})`, error);
  return count > 0;
}

const otherRole = (viewerRole) => (viewerRole === 'coach' ? 'customer' : 'coach');

/** Marks the OTHER role's unread messages as read for `viewerRole`; returns how many changed. */
export async function markRead(slug, viewerRole) {
  if (override) return override.markRead(slug, viewerRole);
  const { data, error } = await db()
    .update({ read_at: new Date().toISOString() })
    .eq('customer_slug', slug)
    .eq('sender_role', otherRole(viewerRole))
    .is('read_at', null)
    .select('id');
  if (error) throw dbError(`customer_messages(${slug})`, error);
  return data.length;
}

/** Unread messages waiting for `viewerRole` in this conversation. */
export async function countUnread(slug, viewerRole) {
  if (override) return override.countUnread(slug, viewerRole);
  const { count, error } = await db()
    .select('id', { count: 'exact', head: true })
    .eq('customer_slug', slug)
    .eq('sender_role', otherRole(viewerRole))
    .is('read_at', null);
  if (error) throw dbError(`customer_messages(${slug})`, error);
  return count;
}

/** Whether the newest coach message has been read; null when the coach has sent nothing. */
export async function latestCoachMessageRead(slug) {
  if (override) return override.latestCoachMessageRead(slug);
  const { data, error } = await db()
    .select('read_at')
    .eq('customer_slug', slug)
    .eq('sender_role', 'coach')
    .order('id', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw dbError(`customer_messages(${slug})`, error);
  return data ? data.read_at != null : null;
}

/** Deletes one coach-authored message of this conversation; false when there is no such message. */
export async function deleteCoachMessage(slug, id) {
  if (override) return override.deleteCoachMessage(slug, id);
  const { data, error } = await db()
    .delete()
    .eq('customer_slug', slug)
    .eq('sender_role', 'coach')
    .eq('id', id)
    .select('id');
  if (error) throw dbError(`customer_messages(${slug})`, error);
  return data.length > 0;
}

/** Map slug → unread customer replies, for every customer, in one query (the coach's overview). */
export async function unreadByCustomer() {
  if (override) return override.unreadByCustomer();
  const { data, error } = await db().select('customer_slug').eq('sender_role', 'customer').is('read_at', null);
  if (error) throw dbError('customer_messages unread', error);
  const counts = new Map();
  for (const { customer_slug: slug } of data) counts.set(slug, (counts.get(slug) ?? 0) + 1);
  return counts;
}

/** countUnread that never fails the page it rides on: a count is a hint, not data. */
export async function countUnreadOrZero(slug, viewerRole) {
  try {
    return await countUnread(slug, viewerRole);
  } catch (err) {
    console.error('Unread messages count failed:', err.message);
    return 0;
  }
}
