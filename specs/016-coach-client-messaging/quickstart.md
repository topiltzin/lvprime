# Quickstart: Coach–Client Messaging validation

## Prerequisites
- `cd app && npm install`; `.env.local` with the Supabase variables used by feature 015.
- Apply `server/migrations/018-customer-messages.sql` in the Supabase SQL Editor, then verify:
  `node --env-file=.env.local server/migrations/018-customer-messages.js`
- Two accounts: the coach, and one customer with access (feature 015) who has set their own password.

## Automated
```bash
cd app && npm test
```
Expect `tests/unit/messages.test.js` and `tests/integration/messages.test.js` green, covering: coach send; customer read; reply gate (409 before first coach message); empty / whitespace / 1001-char rejection; a customer cannot read or write another slug (404) and signed-out gets 401; mark-read and unread counts for each role; duplicate `clientId` creates one row; coach-only delete of coach messages; `unreadMessages` in both customer payloads; es/en keys present.

## Manual (run `npm run dev`, phone width 360 px and desktop)
1. **US1**: sign in as coach → open a customer → Messages → send "Hola". Sign in as that customer → tab shows a badge "1" → open → message visible with time and "Coach" label; badge clears.
2. **Gate**: as a customer with no coach message, Messages shows the "hasn't written yet" state and no composer.
3. **US2**: customer replies → coach's customer card shows "1 new message" → open → reply in order; badge clears.
4. **US3**: coach sees the latest message "Not read yet" until the customer opens it, then "Read".
5. **Isolation**: while signed in as customer A, request `/api/customers/<B>/messages` → 404; signed out → 401.
6. **Failure**: simulate offline → send → inline error, text kept, Retry sends once (one row in the table).
7. **UI/UX (UI/UX Pro Max pre-delivery check)**: no horizontal scroll at 360 px; tab/Send/Delete targets ≥ 44 px; focus ring visible via keyboard; screen reader announces "3 unread messages"; contrast ≥ 4.5:1 in both bubbles; AI assistant launcher unchanged and not overlapped; Spanish and English both complete; reduced-motion honored.
