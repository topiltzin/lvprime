/**
 * Verifies that 015-chat-memory.sql has been applied (the SQL itself must be
 * run in the Supabase SQL Editor — the service key can't run DDL here).
 *
 * Run: node --env-file=.env.local server/migrations/015-chat-memory.js
 */
import { getSupabaseClient } from '../lib/database-client.js';

async function main() {
  const db = getSupabaseClient();
  const conversations = await db.from('chat_conversations').select('id', { count: 'exact', head: true });
  const messages = await db.from('chat_messages').select('id', { count: 'exact', head: true });
  const error = conversations.error || messages.error;
  if (error) {
    throw new Error(`chat memory: ${error.message} — run server/migrations/015-chat-memory.sql in the Supabase SQL Editor first.`);
  }
  console.log(`Migration applied. ${conversations.count} conversation(s), ${messages.count} message(s).`);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
