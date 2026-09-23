-- specs/010-weekly-routine-versioning/contracts/database-schema-delta.md
-- Run in Supabase dashboard -> SQL Editor. Safe to re-run.
-- Existing programs rows become week 1 (content unchanged).

BEGIN;

ALTER TABLE programs DROP CONSTRAINT IF EXISTS programs_customer_id_key;

ALTER TABLE programs
  ADD COLUMN IF NOT EXISTS week_number INTEGER NOT NULL DEFAULT 1;

ALTER TABLE programs ALTER COLUMN week_number DROP DEFAULT;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'programs_week_number_check') THEN
    ALTER TABLE programs ADD CONSTRAINT programs_week_number_check CHECK (week_number >= 1);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'programs_customer_id_week_number_key') THEN
    ALTER TABLE programs
      ADD CONSTRAINT programs_customer_id_week_number_key UNIQUE (customer_id, week_number);
  END IF;
END $$;

ALTER TABLE sync_events ADD COLUMN IF NOT EXISTS week_number INTEGER NULL;
ALTER TABLE offline_queue_entries ADD COLUMN IF NOT EXISTS week_number INTEGER NULL;

COMMIT;
