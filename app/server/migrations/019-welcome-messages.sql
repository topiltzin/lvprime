-- Welcome motivation message (specs/018-welcome-motivation-popup).
-- One coach-written message per customer, shown as a popup after sign-in.
-- Run in Supabase dashboard -> SQL Editor. Safe to re-run.
-- Then check it with: node --env-file=.env.local server/migrations/019-welcome-messages.js
--
-- Only the API server (SUPABASE_SECRET_KEY, which bypasses RLS) reads or writes this
-- table. RLS is on with no policies, so the publishable key can't reach it.
-- delivery_weekday is ISO (1 = Monday ... 7 = Sunday). last_seen_week is the Monday of
-- the week the customer last dismissed the popup.

CREATE TABLE IF NOT EXISTS welcome_messages (
  customer_slug    VARCHAR(255) PRIMARY KEY REFERENCES customers (slug) ON DELETE CASCADE,
  body             TEXT NOT NULL CHECK (length(btrim(body)) BETWEEN 1 AND 300),
  delivery_weekday SMALLINT NOT NULL DEFAULT 1 CHECK (delivery_weekday BETWEEN 1 AND 7),
  repeat_weekly    BOOLEAN NOT NULL DEFAULT true,
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_week   DATE NULL,
  last_seen_at     TIMESTAMPTZ NULL
);

ALTER TABLE welcome_messages ENABLE ROW LEVEL SECURITY;
