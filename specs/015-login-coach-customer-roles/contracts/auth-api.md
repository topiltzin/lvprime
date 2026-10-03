# Contract: Auth and Access API

All bodies are JSON. Errors use the existing shape `{ error, message?, fields? }`. Cookie: `coach_session` (name kept for compatibility), HttpOnly, SameSite=Strict, 30 days.

## Public

### POST /api/login
Body `{ email, password }`.
- 200 `{ email, role: "coach"|"customer", slug?: string, mustChangePassword: boolean }` and sets the cookie.
- 401 `invalid_credentials` (same message for unknown email and wrong password).
- 403 `account_disabled` when the customer is archived ("Contact your coach.").
- 422 field errors, 429 `rate_limited`, 502 `auth_unavailable`. (Existing behavior.)

### GET /api/session
200 `{ authenticated, authDisabled, email, role, slug?, mustChangePassword }`.

### POST /api/logout
200 `{ ok: true }`, clears the cookie.

## Customer or coach (signed in)

### POST /api/password
Body `{ currentPassword, newPassword, confirmPassword }`. Allowed while `mustChangePassword` is true.
- 200 `{ ok: true }`, new cookie, flag cleared.
- 401 `invalid_credentials` when `currentPassword` is wrong.
- 422 `fields`: `newPassword` (too weak / same as current), `confirmPassword` (mismatch).

## Coach only

### POST /api/customers/:slug/access
Body `{ email, defaultPassword }`. Creates the Supabase user, links it, sets `must_change_password = true`.
- 201 `{ slug, email, mustChangePassword: true }`.
- 409 `email_taken`, 409 `access_exists`, 422 field errors, 404 `customer_not_found`.

### POST /api/customers/:slug/access/reset
Body `{ defaultPassword }`. Sets a new default password and `must_change_password = true`.
- 200 `{ slug, mustChangePassword: true }`; 404 `no_access` when the customer has no account.

### GET /api/customers/:slug (extended)
Adds `access: { hasAccess, email, mustChangePassword }` for coach sessions only.

## Authorization matrix

| Route group | Signed out | Customer (own slug) | Customer (other slug) | Coach |
|-------------|-----------|---------------------|-----------------------|-------|
| `/api/customers` list, create, archive, content, measurements, attachments, day-notes, chat, sync, access | 401 | 403 | 403 | allowed |
| `GET /api/customers/:slug` | 401 | allowed, **without notes and feedback entries** | 404 | full |
| program weeks, nutrition, feedback POST, quick-complete, customer files | 401 | allowed | 404 | allowed |
| any route except password/session/logout while `mustChangePassword` | n/a | 403 `password_change_required` | 403 | n/a |
