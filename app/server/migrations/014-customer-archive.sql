-- Client archive (archive + restore; nothing is deleted).
-- Run in Supabase dashboard -> SQL Editor. Safe to re-run.
-- Then check it with: node --env-file=.env.local server/migrations/014-customer-archive.js

ALTER TABLE customers ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ NULL;
