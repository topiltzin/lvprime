-- Coach chat memory: the assistant remembers the conversation per signed-in user.
-- Run in Supabase dashboard -> SQL Editor. Safe to re-run.
-- Then check it with: node --env-file=.env.local server/migrations/015-chat-memory.js
--
-- One open conversation per user (ended_at IS NULL). "Clear chat" ends it, and the
-- next question starts a new one; old conversations are kept, not deleted.
-- Only the API server (SUPABASE_SECRET_KEY, which bypasses RLS) reads or writes these
-- tables. RLS is on with no policies, so the publishable key can't reach them.

CREATE TABLE IF NOT EXISTS chat_conversations (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at   TIMESTAMPTZ NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS chat_conversations_one_open_per_user
  ON chat_conversations (user_id) WHERE ended_at IS NULL;

CREATE TABLE IF NOT EXISTS chat_messages (
  id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  conversation_id UUID NOT NULL REFERENCES chat_conversations (id) ON DELETE CASCADE,
  role            TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content         TEXT NOT NULL CHECK (length(content) BETWEEN 1 AND 8000),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS chat_messages_conversation_id_idx
  ON chat_messages (conversation_id, id);

ALTER TABLE chat_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
