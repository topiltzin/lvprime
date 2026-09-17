# Backup notice — do not delete before 2026-10-17

As of 2026-09-17, customer data (program.md, feedback.md, notes.md, nutrition_plan.md)
was migrated to Supabase PostgreSQL — see `specs/006-customer-data-storage/`. The app
no longer reads from this directory for that data (only for attachments, e.g. PDFs
under a customer's own subfolder, which stay filesystem-based).

This directory is retained as a migration backup for 30 days from the migration date
(per spec Assumption 7), i.e. **do not delete before 2026-10-17**. After that date,
once the Supabase-backed app has been running in production without issues, this
directory can be removed (or archived elsewhere) — the migrated data in Supabase is
the source of truth from now on.
