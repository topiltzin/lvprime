/**
 * Verifies that 014-customer-archive.sql has been applied (the SQL itself must be
 * run in the Supabase SQL Editor — the service key can't run DDL here).
 *
 * Run: node --env-file=.env.local server/migrations/014-customer-archive.js
 */
import { getSupabaseClient } from '../lib/database-client.js';

async function main() {
  const { data, error } = await getSupabaseClient().from('customers').select('slug, archived_at');
  if (error) {
    throw new Error(`customers: ${error.message} — run server/migrations/014-customer-archive.sql in the Supabase SQL Editor first.`);
  }
  const archived = data.filter((c) => c.archived_at).length;
  console.log(`Migration applied. ${data.length} client(s), ${archived} archived.`);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
