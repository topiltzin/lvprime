# Contract: Weekly Routine API

**Builds on**: `app/server/index.js`'s existing `/api/customers/*` and `/api/sync/*` routes
**Requirement Refs**: FR-001 through FR-010

---

## New: `GET /api/customers/:slug/program/weeks`

Lightweight list for populating the week selector — metadata only, no routine content (research.md
Decision 5, so the selector stays cheap regardless of history length).

**Response** `200`:
```json
{
  "weeks": [
    { "weekNumber": 1, "isCurrent": false, "isLocked": true, "updatedAt": "2026-09-15T10:00:00Z" },
    { "weekNumber": 2, "isCurrent": true, "isLocked": false, "updatedAt": "2026-09-23T14:00:00Z" }
  ]
}
```

Ordered by `weekNumber` ascending. `isCurrent`/`isLocked` computed per data-model.md's derived
rule (`isCurrent` ⟺ `weekNumber = max(weekNumber)`). Exactly one entry has `isCurrent: true`
(never zero, once at least one week exists; never more than one).

A customer with no program at all returns `{ "weeks": [] }`, `200` (not a `404`) — mirrors the
existing "no program yet" empty-state handling in `handleGetCustomer`.

## New: `GET /api/customers/:slug/program/weeks/:week`

Full parsed routine for one specific week (the existing `parseProgramDetail` output shape,
applied to that week's own `content` only — no change to the parser's day-heading scanning logic
itself, since each week's content is now independently one coherent schedule, not a
concatenation).

**Response** `200`: same shape `GET /api/customers/:slug` returns today under its `program` key
(`fitnessLevel`, `sessionDuration`, `planDuration`, `weeklySchedule`, exercises with resolved
`videoUrl`, and `progressionHtml` — that week's own Progression section rendered as HTML) —
**minus** `weeklyProgression`, which is retired (research.md Decision 4) — **plus**:
```json
{ "weekNumber": 2, "isCurrent": true, "isLocked": false, "version": 3, "updatedAt": "..." }
```

**Response** `404`: requested `week` has no row for this customer (edge case from `spec.md`:
"coach tries to view or edit a week number that doesn't exist for that customer yet").

## Changed: `GET /api/customers/:slug`

`program` in the response becomes the **current week's** full detail (same shape as
`GET /api/customers/:slug/program/weeks/:week` above) instead of the single shared blob — no
shape change for existing consumers beyond the removed progression fields, since "the" program
today already meant "the one row," which now means "the current row." Also gains a `programWeeks`
array (same shape as the new list endpoint's `weeks`) so the initial page load can render the
week selector without a second round trip.

## Changed: `POST /api/sync/upload`

Request body gains an optional `week_number`:

```json
{
  "customer_id": "...",
  "file_type": "program",
  "week_number": 2,
  "current_version": 3,
  "content": "...",
  "content_hash": "..."
}
```

**Behavior**:
- `week_number` omitted, `file_type: 'program'` → defaults to the customer's current
  (max) week — equivalent to explicitly passing that week's number. (Matches `publish-cli.md`'s
  default-to-current behavior.)
- `week_number` provided and equals current max → normal write, existing coach-always-wins
  version-conflict resolution applies unchanged.
- `week_number` provided and is **exactly** `max + 1` → creates a new week row; this is the only
  way a new week comes into existence. The previous max week becomes locked as a side effect of
  the new row existing (data-model.md — no separate "lock" write happens).
- `week_number` provided and is **less than** current max (a past, locked week) → rejected,
  `423 Locked`, body `{ "error": "week_locked", "weekNumber": 2, "currentWeek": 4 }`. No write
  occurs; no `sync_events` row is created for the rejected attempt beyond the existing
  error-logging path (`event_type: 'sync_error'`).
- `week_number` provided and is **more than** `max + 1` (a gap) → rejected, `400 Bad Request`,
  body `{ "error": "week_number_gap", "expected": <max + 1> }` (research.md Decision 3).
- `file_type` other than `'program'` → unchanged, `week_number` ignored (notes/nutrition_plan
  stay single-row, out of scope).

## Changed: `GET /api/sync/download`, `GET /api/sync/status`

Both gain the same optional `week_number` query parameter, with the same default-to-current
behavior as upload, for symmetry. Reading a locked week is always allowed (only writes are
gated) — this is what makes history browsing (User Story 3) work.

## Acceptance Criteria

- [ ] Fetching `GET /api/customers/:slug/program/weeks` for a customer with 3 weeks returns all
      3, exactly one marked `isCurrent`, the other two `isLocked: true`.
- [ ] Fetching week 1's detail after week 2 has been created still returns week 1's original
      content, unchanged (User Story 3, FR-005).
- [ ] `POST /api/sync/upload` targeting a locked week returns `423` and does not modify that
      week's row (verified via a follow-up `GET` showing `version` unchanged).
- [ ] `POST /api/sync/upload` with `week_number = max + 1` creates the new row and the
      previously-current week's `isLocked` flips to `true` on the next `GET .../weeks` call.
- [ ] A customer with only one week (today's shape, post-migration) behaves identically to today
      through `GET /api/customers/:slug` (FR-007), with `programWeeks` containing exactly one
      entry.
