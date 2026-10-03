/**
 * Verifies that 017-customer-accounts.sql has been applied (the SQL itself must be
 * run in the Supabase SQL Editor — the service key can't run DDL here).
 *
 * Run: node --env-file=.env.local server/migrations/017-customer-accounts.js
 */
import { getSupabaseClient } from '../lib/database-client.js';

async function main() {
  const { data, error } = await getSupabaseClient().from('customers').select('slug, auth_user_id, must_change_password');
  if (error) {
    throw new Error(`customers: ${error.message} — run server/migrations/017-customer-accounts.sql in the Supabase SQL Editor first.`);
  }
  const withAccess = data.filter((c) => c.auth_user_id).length;
  console.log(`Migration applied. ${data.length} client(s), ${withAccess} with sign-in access.`);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
