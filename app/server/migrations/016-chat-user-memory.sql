-- Coach chat long-term memory: short notes per user, merged from each ended conversation.
-- Needs 015-chat-memory.sql first. Run in Supabase dashboard -> SQL Editor. Safe to re-run.
-- Then check it with: node --env-file=.env.local server/migrations/016-chat-user-memory.js

CREATE TABLE IF NOT EXISTS chat_user_memory (
  user_id    UUID PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  summary    TEXT NOT NULL CHECK (length(summary) BETWEEN 1 AND 2000),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Set once an ended conversation has been merged into chat_user_memory. Ended
-- conversations still NULL here (the chatbot was down when Clear chat ran) are
-- picked up on the next Clear chat.
ALTER TABLE chat_conversations ADD COLUMN IF NOT EXISTS summarized_at TIMESTAMPTZ NULL;

ALTER TABLE chat_user_memory ENABLE ROW LEVEL SECURITY;
