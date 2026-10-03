# Quickstart: Validating Login with Coach and Customer Profiles

## Prerequisites
- `app/.env.local` with `SUPABASE_URL`, `SUPABASE_SECRET_KEY`, `SUPABASE_PUBLISHABLE_KEY`, and `COACH_AUTH_DISABLED` unset or `false`.
- Supabase Auth: **public sign-ups disabled** (role resolution depends on it, see research R3).
- Run the migration in the Supabase SQL editor: `app/server/migrations/017-customer-accounts.sql`, then `node --env-file=.env.local server/migrations/017-customer-accounts.js` to check it.
- `cd app && npm run dev`.

## Automated
`cd app && npm test` — includes `customer-auth.test.js` (matrix in contracts/auth-api.md), `access.test.js`, `passwords.test.js`.

## Manual scenarios
1. **Signed out**: open the app in a private window → only the login page. Direct request to `/api/customers` → 401. (SC-001)
2. **Coach**: sign in → customer list. Open a customer → "Dar acceso" with email and default password → success. (US2)
3. **Duplicate email**: repeat with the same email on another customer → "email taken", nothing created.
4. **First sign-in**: new private window, customer email + default password → forced set-password screen; try the default, a short password and a mismatch → each rejected; set a valid one → lands on own page. (US3)
5. **Default no longer works**: sign out, sign in with the default → incorrect; with the new password → works.
6. **Customer scope**: Notas and Seguimiento visible but disabled; Program, Nutrición, Progreso open. Browser devtools: the `/api/customers/<slug>` response has no `notes` and no `feedback.entries`. Edit the URL hash to another slug, or request `/api/customers` → denied, returned to own page. (US4, SC-004)
7. **Reset**: coach resets the password → customer's next request returns `password_change_required`; next sign-in forces a new password.
8. **Archive**: coach archives the customer → customer's next request is rejected and sign-in shows "contact your coach".
9. **Coach unchanged**: all six tabs work for the coach as before; chat panel only appears for the coach.
