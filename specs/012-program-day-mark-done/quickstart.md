# Quickstart: validate Program Day "Mark done"

## Prerequisites

- `app/.env.local` with Supabase credentials (as for every feature since 006).
- A test customer with a current program week that has structured training days (e.g. `test-alice`).

```bash
cd app
npm install
npm test          # unit + integration (Supabase-backed tests skip without credentials)
npm run dev       # http://localhost:5173
```

## Automated checks

| Test file | Proves |
|---|---|
| `tests/unit/markdown-parser.test.js` | the sentinel parses to `null`; `upsertFeedbackEntryText` replaces the last match, appends otherwise, ignores fenced examples, matches labels case-insensitively |
| `tests/unit/day-completion.test.js` | `sessionLabel`, the 7-day window edges (today, today-6, today-7), completed=No ignored, newest match wins |
| `tests/integration/quick-complete.test.js` | 201 on first call, 200 and no duplicate on second, completed=No gets flipped with other lines kept, 422 on bad date/label, Spanish template gets `Sí` / `No reportado` |
| `tests/integration/customer-data.test.js` | Log Session with the same date+label replaces instead of appending |

## Manual scenarios (map to spec acceptance scenarios)

1. **US1 happy path**: Program tab, current week, click **Mark done** on a training day. Expect "Saving..." briefly, then a "Done today" chip, a volt border, the toast "Session logged", and you stay on Program. On the Feedback tab: one new Completed entry with no Felt/Difficulty shown; completion % updated.
2. **US1 double click**: double-click Mark done quickly. Exactly one entry is created.
3. **US1 error**: stop the dev server and click Mark done. The inline "Could not save. Try again." appears and the button is usable again.
4. **US2 persistence**: reload. The card still shows done. Switch to a past week: no buttons appear, and done chips (if any) are read-only.
5. **US3 enrich**: click **Add details**. Log Session opens with date and label filled in. Fill the fields and save. Feedback shows **one** entry for that session, with the new values.
6. **US3 correct a mistake**: Add details, set Completed = No, save. Back on Program the card shows Mark done again, and completion % dropped.
7. **Rest day**: no footer.
8. **Themes / a11y**: check light and dark themes, reduced motion (no chip pop), keyboard Tab/Enter on both buttons, and phone width (full-width button).
