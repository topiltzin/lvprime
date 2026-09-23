# Data Model: Independent Weekly Routines with History Tracking

Builds on the existing schema in `specs/006-customer-data-storage/contracts/database-schema.md`
(v1.2). This document specifies only the delta: what changes on `programs`, `sync_events`, and
`offline_queue_entries`, plus the two entities from `spec.md`'s Key Entities section mapped onto
that schema. `notes`, `nutrition_plans`, `feedbacks`, `customers`, and `exercises` are unchanged
and out of scope.

## Entity: Weekly Routine

One customer's independent, self-contained day-by-day exercise schedule for exactly one week.
Maps onto one row of the (modified) `programs` table.

| Field | Type | Constraints | Notes |
|---|---|---|---|
| `id` | UUID | PK | Unchanged from today's `programs.id`. |
| `customer_id` | UUID | FK → `customers(id)`, `ON DELETE CASCADE` | Unchanged. |
| `week_number` | INTEGER | **NEW.** `NOT NULL`, `CHECK (week_number >= 1)` | Identifies which week this routine belongs to. Sequential per customer, no gaps (research.md Decision 3). |
| `content` | TEXT | `NOT NULL`, max 500KB (unchanged limit, now per week rather than per customer) | Full Markdown for that week's routine — same format `program.md` uses today (goal/level/duration header, day-by-day exercises, form tips, etc., per Constitution Principle I — applies per week now, not just once). |
| `version` | INTEGER | `NOT NULL DEFAULT 0` | Unchanged mechanism, now scoped per (customer, week) instead of per customer. |
| `content_hash` | VARCHAR(64) | `NOT NULL` | Unchanged (sync integrity check), scoped per row. |
| `last_writer` | VARCHAR(20) | `CHECK IN ('coach','customer')` | Unchanged. |
| `sync_status` | VARCHAR(20) | `CHECK IN ('synced','pending','conflicted')`, `DEFAULT 'synced'` | Unchanged. |
| `updated_at` | TIMESTAMPTZ | `NOT NULL DEFAULT now()` | Unchanged. |

**Constraint change**: `UNIQUE(customer_id)` → `UNIQUE(customer_id, week_number)`.

**Derived state** (not stored — computed at read/write time, research.md Decision 2):
- `is_current` = `week_number = MAX(week_number) FOR THAT customer_id`
- `is_locked` = `NOT is_current`

**Validation rules** (from spec Functional Requirements):
- FR-001/FR-002: `content` for a given `(customer_id, week_number)` is independent of every
  other week's `content` for that customer — enforced structurally by one row per week, never by
  merging/concatenating rows.
- FR-003/FR-008/FR-008a: a write to a row where `is_locked = true` MUST be rejected before any
  version/conflict resolution runs (new check, ahead of the existing `resolveCoachSync` call).
- FR-004: rows are never deleted or overwritten across weeks — creating week N+1 always inserts
  a new row, never mutates week N's row.
- FR-009: no application-level cap on `week_number`; the only constraint is `>= 1` and
  sequential creation (research.md Decision 3).

**State transitions**:

```
(no row for week N+1 yet)
        │  coach/customer creates week N+1
        ▼
 week N+1 row inserted, week_number = N+1
        │
        ▼
 week N+1 becomes "current" (is_current=true) automatically,
 because it is now MAX(week_number) for this customer
        │
        ▼
 week N (previously current) becomes "locked" (is_locked=true) automatically,
 same computation, no row mutation needed
```

There is no transition that un-locks a week or decreases `MAX(week_number)` — locking is
one-directional per the spec (FR-008 never describes unlocking).

## Entity: Customer Program

The umbrella per-customer coaching plan (goal, fitness level, session duration, frequency,
limitations). **Unchanged in shape** by this feature — still represented by whatever the
customer-level metadata already is (today, embedded as header fields inside each week's own
`program.md`-style content, per the existing format in `CLAUDE.md`/Constitution Principle I).
What changes is only its relationship: a Customer Program now relates to **many** independent
Weekly Routine rows (one per week) instead of the single `programs` row it related to before.

## Schema deltas: `sync_events` and `offline_queue_entries`

Both gain:

| Field | Type | Constraints | Notes |
|---|---|---|---|
| `week_number` | INTEGER | `NULL` | Set for `file_type = 'program'` rows; left `NULL` for `'notes'`/`'nutrition_plan'`/`'feedback'`, which remain single-row and unaffected by this feature (research.md Decision 7). |

No other columns change on these two tables. Existing rows (all pre-dating this feature) are
backfilled with `week_number = NULL`, which is safe because they only ever referred to
`file_type` values that stay single-row (the historical `'program'` rows predate week-scoping
entirely and are treated as that customer's week 1 during migration — see Assumptions in
`spec.md`).

## Out of scope for this feature

- `notes` table / `notes.md` — unchanged, single-row per customer.
- `nutrition_plans` table / `nutrition_plan.md` — unchanged, single-row per customer.
- `feedbacks` table / `feedback.md` — unchanged, single-row per customer (feedback is logged
  against the customer generally, not tied to a specific week's routine by this feature).
- `exercises` table — unchanged; a Weekly Routine's content still references exercise names by
  string, resolved to video links the same way `getExerciseVideoLinkMap()` already does today.
