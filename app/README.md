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
   CHATBOT_URL=https://8000-<id>.cloudspaces.litng.ai/chat
   ```
   `CHATBOT_URL` is the Lightning AI fitness coach chatbot's `/chat` endpoint; without it the chat panel shows "unavailable". Find the Supabase values in Supabase Dashboard → **Settings → API**. Use the **secret** key (full server-side access), not the publishable key — this app has no client-side Supabase calls, everything goes through `app/server/lib/customer-data.js`. Never commit `.env.local` (already gitignored) or paste the secret key into chat/logs.

5. **Migrate existing customer data** (one-time, only needed if you have existing `customers/[slug]/*.md` files to bring in):
   ```bash
   node --env-file=.env.local server/migrations/migrate-data.js
   ```
   Idempotent — safe to re-run; already-migrated customers are skipped.

   Attachments (PDF plans etc.) go to a private Supabase Storage bucket instead; this creates the `customer-attachments` bucket if needed and copies the files, skipping ones already there:
   ```bash
   node --env-file=.env.local server/migrations/migrate-attachments.js [--dry-run]
   ```

   Client archiving needs one column: run `server/migrations/014-customer-archive.sql` in the Supabase **SQL Editor**, then check it with `node --env-file=.env.local server/migrations/014-customer-archive.js`. Until then everything else works and the Archive button reports that the update is missing.

   Client sign-in (specs/015) needs two more columns: run `server/migrations/017-customer-accounts.sql` in the SQL Editor, then check it with `node --env-file=.env.local server/migrations/017-customer-accounts.js`. Until then only the coach can sign in, and "Dar acceso" on a client page reports that the update is missing.

6. **Run the dev server**:
   ```bash
   npm run dev
   ```

## Deploying to Vercel

1. Add `SUPABASE_URL`, `SUPABASE_SECRET_KEY`, `SUPABASE_PUBLISHABLE_KEY` and `CHATBOT_URL` to the Vercel project's **Environment Variables** (Production and Preview scopes) — Vercel dashboard → Project → Settings → Environment Variables. Coaches sign in with a Supabase Auth user (email + password) from the same project; create them in Supabase → Authentication → Users, and turn off public sign-ups there so nobody can create their own account. Optionally set `SESSION_SECRET` (a long random value) to sign sessions independently of the Supabase secret key. Never set `COACH_AUTH_DISABLED` in a deployment. `vercel.json` gives the API function `maxDuration: 130` so a slow chatbot answer (up to 120 s) can finish; that needs Fluid compute on (Project → Settings → Functions).
2. Deploy as usual (`vercel` CLI or git push, depending on your setup).
3. Verify a customer profile loads correctly on the deployed URL, then trigger a redeploy and confirm the same data still loads (this is the point of the whole migration — the filesystem/SQLite approach this app used before did not survive Vercel's stateless serverless functions between deployments).

## Architecture notes

- **Source of truth**: Supabase PostgreSQL. The `customers/` filesystem directory is kept only as a 30-day migration backup (see note in that directory) — the app does not read from it.
- **Attachments**: a private Supabase Storage bucket, `customer-attachments`, one folder per client slug (`app/server/lib/attachments.js`). `GET /customer-files/<slug>/<path>` answers with a redirect to a 5-minute signed URL, so files never pass through the API function (Vercel caps function responses at 4.5 MB); PDFs and images open in the browser, other types download. Coaches upload and remove files from the client page (`POST`/`DELETE /api/customers/<slug>/attachments…`, 4 MB per file because uploads go through the function).
- **Archive**: `POST /api/customers/<slug>/archive` and `/restore` set or clear `customers.archived_at`. Archived clients leave the sidebar and the overview's filters and appear only under the Archived filter; nothing is deleted.
- **Security headers**: `server/security-headers.js` (CSP, `X-Frame-Options`, `nosniff`, …) is applied to every API and `npm start` response; `vercel.json` repeats the same list for Vercel's static files, and `tests/unit/security-headers.test.js` fails if the two drift apart. The Vite dev server doesn't send them.
- **Interface language**: Spanish by default, English from the ES/EN switch in the header (saved per browser). Strings live in `src/lib/strings.js` (both languages; `tests/unit/i18n.test.js` checks they match) and are read with `t()` from `src/lib/i18n.js`. Coach content is never translated. The server's error messages stay English; `src/api-client.js` shows the Spanish text for known error codes.
- **API layout**: `server/index.js` holds only the route tables and dispatch (`handleApiRequest`). Handlers live in `server/handlers/` (`customers`, `editing`, `sync`, `chat`, `auth`), and the shared JSON/body helpers in `server/http.js`.
- **Roles** (specs/015): there are two profiles. A Supabase Auth user linked to a `customers` row (`auth_user_id`) is a **customer**; any other user is the **coach**, so public sign-ups must stay off. The coach gives a client access from the client page ("Dar acceso": email + default password, created through the Auth admin API) and `must_change_password` forces the client to set their own password at first sign-in (`POST /api/password`). Every route in `server/index.js` carries an `access` tag (`coach` by default, `customer-own`, `signed-in`) enforced by `server/access.js`; customers are limited to their own slug, get no coach notes or feedback detail from `GET /api/customers/<slug>` (`shapeCustomerView`), and see Notas and Seguimiento disabled. Customer requests re-read the `customers` row, so archiving or a password reset applies immediately.
- **Access control**: `app/server/auth.js` gates every `/api/*` and `/customer-files/*` route behind a signed-in user. `POST /api/login` checks email + password against Supabase Auth (`signInWithPassword`) and sets an HttpOnly, SameSite=Strict session cookie (30 days) signed with `SESSION_SECRET`, or a key derived from `SUPABASE_SECRET_KEY`. Supabase is only called at sign-in, so removing a user takes effect when their cookie expires or the secret rotates. `GET /api/session` returns the signed-in email for the header; the frontend shows the sign-in page on any 401. Set `COACH_AUTH_DISABLED=true` in `.env.local` for open local development.
- **Data access layer**: `app/server/lib/customer-data.js` is the only module that should touch Supabase tables directly (`server/lib/attachments.js` does the same for Storage). It's server-only (imports the secret key) — never import it from `app/src/`, which is Vite's browser-bundled root.
- **Sync**: `app/server/sync-engine.js` still holds the pure conflict-resolution logic (no filesystem/DB dependency); `customer-data.js`'s `syncCoachWrite` uses it against the `programs`/`notes` tables' `version`/`content_hash`/`sync_status` columns instead of the old JSON-file-backed `sync-state.js` (removed).
- **Coach chatbot**: `POST /api/chat` (`app/server/lib/coach-chat.js`) sits behind the coach gate and proxies to `CHATBOT_URL` (or Gemini when `CHATBOT_PROVIDER=gemini`, see `specs/014-gemini-chatbot-option/`), adding the fitness-coach instruction and a 200-token cap on the server. The URL never reaches the browser, and nothing is stored or logged beyond the outcome. See `specs/013-fitness-coach-chatbot/`.
- **Tests**: `npm test` runs everything under `tests/`. Tests that need Supabase (integration tests, and `tests/unit/database.test.js`'s validation-only tests which don't but live alongside them) read `SUPABASE_URL`/`SUPABASE_SECRET_KEY` from the environment — run with `node --env-file=.env.local --test 'tests/**/*.test.js'` to include them.
