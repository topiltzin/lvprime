import { summarizeIntoNotes } from './coach-chat.js';
import { getSupabaseClient } from './database-client.js';

// Coach chat memory, keyed by the user's Supabase Auth id (session.sub). The chatbot
// on Lightning stays stateless: every /api/chat call sends it
// - the recent turns of the open conversation (migrations/015-chat-memory.sql), and
// - short notes merged from earlier, ended conversations (016-chat-user-memory.sql).

/** Messages sent to the model as memory (6 question/answer pairs). */
export const MEMORY_MESSAGES = 12;
/** Messages shown when the chat panel opens. */
export const HISTORY_MESSAGES = 50;
/** Messages of an ended conversation merged into the notes (the most recent ones). */
const SUMMARY_MESSAGES = 40;
/** Stop starting new summaries after this long, to stay inside the function's time limit. */
const SUMMARY_BUDGET_MS = 60000;

async function findOpenConversationId(userId) {
  const { data, error } = await getSupabaseClient()
    .from('chat_conversations')
    .select('id')
    .eq('user_id', userId)
    .is('ended_at', null)
    .maybeSingle();
  if (error) throw new Error(`chat_conversations: ${error.message}`);
  return data?.id ?? null;
}

async function openConversationId(userId) {
  const existing = await findOpenConversationId(userId);
  if (existing) return existing;
  const { data, error } = await getSupabaseClient()
    .from('chat_conversations')
    .insert({ user_id: userId })
    .select('id')
    .single();
  // 23505: another tab opened one first (one open conversation per user).
  if (error?.code === '23505') return findOpenConversationId(userId);
  if (error) throw new Error(`chat_conversations: ${error.message}`);
  return data.id;
}

/** The last `limit` messages of the user's open conversation, oldest first: [{ role, content, createdAt }]. */
export async function loadConversation(userId, limit) {
  const conversationId = await findOpenConversationId(userId);
  if (!conversationId) return [];
  const { data, error } = await getSupabaseClient()
    .from('chat_messages')
    .select('role, content, created_at')
    .eq('conversation_id', conversationId)
    .order('id', { ascending: false })
    .limit(limit);
  if (error) throw new Error(`chat_messages: ${error.message}`);
  return data.reverse().map((m) => ({ role: m.role, content: m.content, createdAt: m.created_at }));
}

/** Stores one answered question. Failed questions are never stored, so a retry doesn't duplicate them. */
export async function saveTurn(userId, question, answer) {
  const conversationId = await openConversationId(userId);
  const { error } = await getSupabaseClient()
    .from('chat_messages')
    .insert([
      { conversation_id: conversationId, role: 'user', content: question },
      { conversation_id: conversationId, role: 'assistant', content: answer },
    ]);
  if (error) throw new Error(`chat_messages: ${error.message}`);
}

/** "Clear chat": closes the open conversation (kept, not deleted); the next question starts a new one. */
export async function endConversation(userId) {
  const { error } = await getSupabaseClient()
    .from('chat_conversations')
    .update({ ended_at: new Date().toISOString() })
    .eq('user_id', userId)
    .is('ended_at', null);
  if (error) throw new Error(`chat_conversations: ${error.message}`);
}

/** The user's memory notes from earlier conversations, or null. */
export async function loadMemory(userId) {
  const { data, error } = await getSupabaseClient()
    .from('chat_user_memory')
    .select('summary')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw new Error(`chat_user_memory: ${error.message}`);
  return data?.summary ?? null;
}

/**
 * Merges every ended, not yet summarized conversation into the user's notes, oldest
 * first. Throws on the first failure; what's left is picked up on the next call.
 */
export async function rememberEndedConversations(userId) {
  const db = getSupabaseClient();
  const { data: pending, error } = await db
    .from('chat_conversations')
    .select('id')
    .eq('user_id', userId)
    .not('ended_at', 'is', null)
    .is('summarized_at', null)
    .order('created_at', { ascending: true });
  if (error) throw new Error(`chat_conversations: ${error.message}`);

  const deadline = Date.now() + SUMMARY_BUDGET_MS;
  let notes = pending.length ? await loadMemory(userId) : null;
  for (const { id } of pending) {
    if (Date.now() > deadline) break;
    const { data: rows, error: msgError } = await db
      .from('chat_messages')
      .select('role, content')
      .eq('conversation_id', id)
      .order('id', { ascending: false })
      .limit(SUMMARY_MESSAGES);
    if (msgError) throw new Error(`chat_messages: ${msgError.message}`);

    if (rows.length) {
      notes = await summarizeIntoNotes(notes, rows.reverse());
      const { error: saveError } = await db
        .from('chat_user_memory')
        .upsert({ user_id: userId, summary: notes, updated_at: new Date().toISOString() });
      if (saveError) throw new Error(`chat_user_memory: ${saveError.message}`);
    }
    const { error: markError } = await db
      .from('chat_conversations')
      .update({ summarized_at: new Date().toISOString() })
      .eq('id', id);
    if (markError) throw new Error(`chat_conversations: ${markError.message}`);
  }
}
