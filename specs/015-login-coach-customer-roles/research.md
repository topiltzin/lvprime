# Research: Login with Coach and Customer Profiles

## R1. Reuse the existing sign-in
- **Decision**: Extend the current Supabase Auth + signed-cookie flow; do not build a new password store.
- **Rationale**: It already ships (`server/auth.js`), is stateless, and handles hashing, rate limiting (Supabase 429), and secure cookies. Passwords never touch app tables (FR-013).
- **Alternatives**: Own users table with bcrypt/scrypt (more code and risk, duplicates Supabase); magic links (out of scope, needs email).

## R2. Customer accounts as Supabase Auth users
- **Decision**: Create via `auth.admin.createUser({ email, password, email_confirm: true })` using the secret key. Link with `customers.auth_user_id`. Reset via `auth.admin.updateUserById`.
- **Rationale**: Coach-set default password without email delivery; the admin API is already reachable because the server holds `SUPABASE_SECRET_KEY`.
- **Alternatives**: Invite emails (needs deliverability, contradicts the default-password flow).

## R3. Role resolution
- **Decision**: A user is a **customer** iff a `customers` row has `auth_user_id = user.id`; otherwise **coach** (preserves the current single-coach setup). Role is never read from anything the browser can edit.
- **Rationale**: No migration for the existing coach user. Requires Supabase public sign-ups to be disabled, otherwise a self-registered user would become coach. Documented as a deployment prerequisite and verified in the quickstart.
- **Alternatives**: `app_metadata.role` on every user (needs a one-off coach update; adopt later if more coaches are added).

## R4. Session content and freshness
- **Decision**: Cookie payload adds `role`, `slug` (customers). For customer requests, `access.js` does one lookup by `auth_user_id` to read `archived_at`, `slug`, `must_change_password` authoritatively.
- **Rationale**: The cookie is stateless, so archive (FR-019) and coach reset (FR-007) would otherwise wait up to 30 days. The lookup makes them immediate without a session table. Coach requests stay lookup-free.
- **Alternatives**: Session table (more state to manage); short cookie TTL (annoying for customers).

## R5. Forced password change
- **Decision**: While `must_change_password` is true, a customer session may call only `POST /api/password`, `GET /api/session` and `POST /api/logout`; everything else returns 403 `password_change_required`. The client shows the set-password screen on that code. Saving updates the Supabase password, clears the flag, and re-issues the cookie.
- **Rationale**: Enforced server-side so it can't be bypassed from the browser. The new password must differ from the old one (FR-006); "same as default" is detected by `signInWithPassword` with the new value failing the change check, or simply by comparing to the submitted current password.
- **Password rules**: at least 8 characters, one letter and one number; confirmation match checked on client and server.

## R6. Authorization enforcement
- **Decision**: Every route in `server/index.js` declares `access: 'coach' | 'customer-own'`. `access.js` rejects with 401/403 before the handler runs. `customer-own` routes require the URL slug to equal the session's slug; a mismatch returns 404 `customer_not_found` (does not reveal that other customers exist).
- **Customer-allowed routes** (own slug only): `GET /api/customers/:slug`, `GET .../program/weeks[/:n]`, `GET .../nutrition`, `POST .../feedback`, `POST .../feedback/quick-complete`, `GET /customer-files/:slug/*`.
- **Coach-only**: the day notepad (`PUT .../feedback/day-notes`; a customer cannot read the notes it would overwrite), customer list, create, content read/write, archive/restore, measurements, attachment upload/delete, chat, sync, and the new access endpoints.
- **Rationale**: One table, one check, easy to test exhaustively (SC-004).

## R7. Notas and Seguimiento never reach customers
- **Decision**: For customer sessions `GET /api/customers/:slug` omits `notes`, `measurements` stays (Progreso is allowed), and replaces `feedback.entries` with a minimal `completedDays` projection (date, label, completed only), because the Program tab's "done" marks (spec 012) depend on it. Notas and Seguimiento tabs render disabled client-side.
- **Open point for tasks**: `measurements` is parsed from the notes row, so Progreso must read measurements without exposing the note text. The customer payload sends only the parsed measurements. Whether customers may add measurements stays coach-only for now.
- **Alternatives**: Hiding tabs in CSS only (rejected: data would still be delivered, violates FR-011).

## R8. Rate limiting and error messaging
- **Decision**: Rely on Supabase's built-in sign-in rate limit (already mapped to 429) and keep the single "Email or password is incorrect" message. No separate limiter.

## R9. Dev bypass
- **Decision**: `COACH_AUTH_DISABLED=true` continues to act as an authenticated coach, so existing tests keep passing. New tests set it to `false` and stub Supabase.
