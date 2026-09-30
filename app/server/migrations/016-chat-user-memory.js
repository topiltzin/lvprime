/**
 * Verifies that 016-chat-user-memory.sql has been applied (the SQL itself must be
 * run in the Supabase SQL Editor — the service key can't run DDL here).
 *
 * Run: node --env-file=.env.local server/migrations/016-chat-user-memory.js
 */
import { getSupabaseClient } from '../lib/database-client.js';

async function main() {
  const db = getSupabaseClient();
  const memory = await db.from('chat_user_memory').select('user_id', { count: 'exact', head: true });
  const conversations = await db.from('chat_conversations').select('summarized_at').limit(1);
  const error = memory.error || conversations.error;
  if (error) {
    throw new Error(`chat user memory: ${error.message} — run server/migrations/016-chat-user-memory.sql in the Supabase SQL Editor first.`);
  }
  console.log(`Migration applied. ${memory.count} user(s) with memory notes.`);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
