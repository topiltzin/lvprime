-- Coach-client messages (specs/016-coach-client-messaging).
-- One private conversation per customer = all rows sharing a customer_slug.
-- Run in Supabase dashboard -> SQL Editor. Safe to re-run.
-- Then check it with: node --env-file=.env.local server/migrations/018-customer-messages.js
--
-- Only the API server (SUPABASE_SECRET_KEY, which bypasses RLS) reads or writes this
-- table. RLS is on with no policies, so the publishable key can't reach it.
-- read_at is set when the RECIPIENT opens the thread. client_id makes a resend (double
-- tap, retry after a lost response) idempotent.

CREATE TABLE IF NOT EXISTS customer_messages (
  id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  customer_slug VARCHAR(255) NOT NULL REFERENCES customers (slug) ON DELETE CASCADE,
  sender_role   TEXT NOT NULL CHECK (sender_role IN ('coach', 'customer')),
  body          TEXT NOT NULL CHECK (length(btrim(body)) BETWEEN 1 AND 1000),
  client_id     UUID NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  read_at       TIMESTAMPTZ NULL,
  UNIQUE (customer_slug, client_id)
);

CREATE INDEX IF NOT EXISTS customer_messages_thread_idx
  ON customer_messages (customer_slug, id);

CREATE INDEX IF NOT EXISTS customer_messages_unread_idx
  ON customer_messages (customer_slug, sender_role) WHERE read_at IS NULL;

ALTER TABLE customer_messages ENABLE ROW LEVEL SECURITY;
