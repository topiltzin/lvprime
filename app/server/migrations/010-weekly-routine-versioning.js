/**
 * Verifies that 010-weekly-routine-versioning.sql has been applied (the SQL itself
 * must be run in the Supabase SQL Editor — the service key can't run DDL here).
 *
 * Run: node --env-file=.env.local server/migrations/010-weekly-routine-versioning.js
 */
import { getSupabaseClient } from '../lib/database-client.js';

async function main() {
  const supabase = getSupabaseClient();
  const checks = [
    ['programs', 'customer_id, week_number, content'],
    ['sync_events', 'week_number'],
    ['offline_queue_entries', 'week_number'],
  ];
  for (const [table, columns] of checks) {
    const { error } = await supabase.from(table).select(columns).limit(1);
    if (error) {
      throw new Error(
        `${table}: ${error.message} — run server/migrations/010-weekly-routine-versioning.sql in the Supabase SQL Editor first.`
      );
    }
  }

  const { data: programs, error } = await supabase.from('programs').select('customer_id, week_number');
  if (error) throw new Error(`programs: ${error.message}`);
  const bad = programs.filter((p) => !Number.isInteger(p.week_number) || p.week_number < 1);
  if (bad.length) throw new Error(`${bad.length} programs row(s) have an invalid week_number`);

  console.log(`Migration applied. ${programs.length} program row(s), all with a valid week_number.`);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
