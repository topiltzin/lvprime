import { getSupabaseClient } from './database-client.js';

// Coach chat memory (migrations/015-chat-memory.sql): the open conversation of each
// signed-in user, keyed by their Supabase Auth id (session.sub). The chatbot on
// Lightning stays stateless: every /api/chat call sends it the recent turns.

/** Messages sent to the model as memory (6 question/answer pairs). */
export const MEMORY_MESSAGES = 12;
/** Messages shown when the chat panel opens. */
export const HISTORY_MESSAGES = 50;

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
