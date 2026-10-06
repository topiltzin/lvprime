/**
 * Verifies that 018-customer-messages.sql has been applied (the SQL itself must be
 * run in the Supabase SQL Editor — the service key can't run DDL here).
 *
 * Run: node --env-file=.env.local server/migrations/018-customer-messages.js
 */
import { getSupabaseClient } from '../lib/database-client.js';

async function main() {
  const { count, error } = await getSupabaseClient()
    .from('customer_messages')
    .select('id, customer_slug, sender_role, body, client_id, created_at, read_at', { count: 'exact', head: true });
  if (error) {
    throw new Error(`customer_messages: ${error.message} — run server/migrations/018-customer-messages.sql in the Supabase SQL Editor first.`);
  }
  console.log(`Migration applied. ${count ?? 0} message(s).`);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
