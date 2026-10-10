/**
 * Verifies that 019-welcome-messages.sql has been applied (the SQL itself must be
 * run in the Supabase SQL Editor — the service key can't run DDL here).
 *
 * Run: node --env-file=.env.local server/migrations/019-welcome-messages.js
 */
import { getSupabaseClient } from '../lib/database-client.js';

async function main() {
  const { count, error } = await getSupabaseClient()
    .from('welcome_messages')
    .select('customer_slug, body, delivery_weekday, repeat_weekly, updated_at, last_seen_week, last_seen_at', { count: 'exact', head: true });
  if (error) {
    throw new Error(`welcome_messages: ${error.message} — run server/migrations/019-welcome-messages.sql in the Supabase SQL Editor first.`);
  }
  console.log(`Migration applied. ${count ?? 0} welcome message(s).`);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
