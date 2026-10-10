# Quickstart: Validate Welcome Motivation Popup

## Prerequisites
- `cd app && npm install`; apply `server/migrations/019-welcome-messages.sql` in the Supabase SQL Editor, then `node --env-file=.env.local server/migrations/019-welcome-messages.js` (prints "Migration applied").
- A coach login and a customer login (see feature 015); `npm run dev`.
- Automated: `npm test` (see `tests/unit/welcome.test.js`, `tests/integration/welcome.test.js`).

## Scenarios
1. **Author (US2)**: As coach open a customer → "Welcome message" tab → write text, pick today's weekday, Save. Expect status "Scheduled for {day}". Empty text → inline "A message is required".
2. **Preview**: Click Preview → popup with effect and "Preview" ribbon. Close; status stays "Scheduled" (not seen).
3. **Popup on sign-in (US1)**: Sign in as that customer. Expect the page to render, then the popup with firework burst; text readable immediately. Close with button, Esc and backdrop click (each once) → exit effect, focus returns, page usable.
4. **Once per week**: Sign out/in, and also open a second browser. Expect no popup. Coach tab shows "Seen on YYYY-MM-DD".
5. **Catch-up (US3)**: Set delivery day to yesterday and clear seen (edit text) → customer sign-in today still shows it once. Set delivery day to tomorrow → no popup today.
6. **Next week**: The server only accepts a `today` within a day of its own date, so simulate a new week in the database: set the row's `last_seen_week` to the previous Monday. A weekly message is due again on the next sign-in; a "once" message (`repeat_weekly = false`) is not. (Covered by the integration test "a weekly message returns the next week; a one-time message does not".)
7. **Reduced motion**: Enable OS/browser reduced motion → popup appears with a plain fade; no canvas element in the DOM.
8. **Mobile 360 px**: DevTools 360 px wide → no horizontal scroll, close button reachable, long (300 char) text scrolls inside the card.
9. **Isolation**: Customer A calling `/api/customers/<B>/welcome/due` → 404; signed-out → 401; customer calling PUT → 403.
10. **No replies / history**: Customer has no Messages tab, no unread badges; coach sees old 016 conversation read-only.
11. **Dark mode & contrast**: Popup text contrast ≥ 4.5:1 in light and dark.

See [contracts/welcome-api.md](contracts/welcome-api.md) and [data-model.md](data-model.md) for exact shapes.
