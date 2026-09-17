# Lili Trainer — App

Coach-only fitness/nutrition dashboard. Customer data (program, feedback, notes, nutrition plan) lives in Supabase PostgreSQL; a "Coach Local Sync" feature layers optimistic-concurrency sync on top of `program`/`notes` for offline-capable coach editing. See `specs/006-customer-data-storage/` for the full design (schema, DAL contract, migration).

## Local development setup

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Create a Supabase project** (or use an existing one) at [supabase.com](https://supabase.com).

3. **Run the schema**: paste the "Full Schema SQL" block from `specs/006-customer-data-storage/contracts/database-schema.md` into Supabase Dashboard → **SQL Editor** and run it once. It creates all 7 tables (`customers`, `programs`, `feedbacks`, `notes`, `nutrition_plans`, `sync_events`, `offline_queue_entries`).

4. **Set credentials**: copy `.env.example` to `.env.local` and fill in:
   ```
   SUPABASE_URL=https://<your-project-ref>.supabase.co
   SUPABASE_SECRET_KEY=sb_secret_...
   ```
   Find these in Supabase Dashboard → **Settings → API**. Use the **secret** key (full server-side access), not the publishable key — this app has no client-side Supabase calls, everything goes through `app/server/lib/customer-data.js`. Never commit `.env.local` (already gitignored) or paste the secret key into chat/logs.

5. **Migrate existing customer data** (one-time, only needed if you have existing `customers/[slug]/*.md` files to bring in):
   ```bash
   node --env-file=.env.local server/migrations/migrate-data.js
   ```
   Idempotent — safe to re-run; already-migrated customers are skipped.

6. **Run the dev server**:
   ```bash
   npm run dev
   ```

## Deploying to Vercel

1. Add `SUPABASE_URL` and `SUPABASE_SECRET_KEY` to the Vercel project's **Environment Variables** (Production and Preview scopes) — Vercel dashboard → Project → Settings → Environment Variables.
2. Deploy as usual (`vercel` CLI or git push, depending on your setup).
3. Verify a customer profile loads correctly on the deployed URL, then trigger a redeploy and confirm the same data still loads (this is the point of the whole migration — the filesystem/SQLite approach this app used before did not survive Vercel's stateless serverless functions between deployments).

## Architecture notes

- **Source of truth**: Supabase PostgreSQL. The `customers/` filesystem directory is kept only as a 30-day migration backup (see note in that directory) — the app does not read from it for program/notes/feedback/nutrition_plan data. Attachments (PDFs etc. under a customer's folder) are the one exception and remain filesystem-based; they were out of scope for this migration.
- **Data access layer**: `app/server/lib/customer-data.js` is the only module that should touch Supabase directly. It's server-only (imports the secret key) — never import it from `app/src/`, which is Vite's browser-bundled root.
- **Sync**: `app/server/sync-engine.js` still holds the pure conflict-resolution logic (no filesystem/DB dependency); `customer-data.js`'s `syncCoachWrite` uses it against the `programs`/`notes` tables' `version`/`content_hash`/`sync_status` columns instead of the old JSON-file-backed `sync-state.js` (removed).
- **Tests**: `npm test` runs everything under `tests/`. Tests that need Supabase (integration tests, and `tests/unit/database.test.js`'s validation-only tests which don't but live alongside them) read `SUPABASE_URL`/`SUPABASE_SECRET_KEY` from the environment — run with `node --env-file=.env.local --test 'tests/**/*.test.js'` to include them.
