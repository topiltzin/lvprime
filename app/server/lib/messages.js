import { getSupabaseClient } from './database-client.js';
import { CustomerNotFoundError, DatabaseError } from './customer-data.js';

// The old coach-client conversation (specs/016-coach-client-messaging), read-only since the
// welcome message replaced it (specs/018). One conversation per customer = every
// customer_messages row with that customer_slug. Nothing writes to the table any more.
// Message text is never logged.

export const LIST_LIMIT = 100;

const COLUMNS = 'id, sender_role, body, created_at, read_at';

export function shapeMessage(row) {
  return { id: row.id, senderRole: row.sender_role, body: row.body, createdAt: row.created_at, readAt: row.read_at ?? null };
}

function dbError(context, error) {
  return new DatabaseError(`${context}: ${error.message}`, error);
}

// Test-only: replaces the queries below with an in-memory store ({ exists, list }); pass null to restore.
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
