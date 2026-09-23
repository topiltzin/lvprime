# Phase 0 Research: Independent Weekly Routines with History Tracking

Source facts for this research come from: `specs/006-customer-data-storage/contracts/database-schema.md`,
`app/server/lib/customer-data.js`, `app/server/sync-engine.js`, `app/server/index.js`,
`app/src/components/{tab-container,program-day,program-pdf,week-subnav}.js`,
`app/server/markdown-parser.js`, and existing test conventions in `app/tests/`.

## Decision 1: Extend the existing `programs` table rather than create a new table

**Decision**: Add a `week_number INTEGER NOT NULL CHECK (week_number >= 1)` column to the
existing `programs` table, replace its `UNIQUE(customer_id)` constraint with
`UNIQUE(customer_id, week_number)`, and treat each row as one "Weekly Routine" (the spec's
entity). Keep the table named `programs`.

**Rationale**: `programs` already carries every column a Weekly Routine needs per-row —
`content`, `version`, `content_hash`, `last_writer`, `sync_status`, `updated_at` — and the
coach-always-wins sync machinery (`syncCoachWrite`, `resolveCoachSync`, `recordSyncEvent`) is
already built around exactly this shape, just scoped to one row per customer today. Reusing it
means the write path, conflict/version semantics, and audit trail (`sync_events`) all carry over
with one added dimension (`week_number`) instead of being rebuilt for a new table. A rename to
`weekly_routines` was considered but rejected as pure churn: every reference
(`SYNC_TABLE_BY_FILE_TYPE`, `file_type='program'` checks, route names, tests) would need updating
for no behavioral gain.

**Alternatives considered**:
- New `weekly_routines` table, `programs` kept as a legacy single-row view: rejected — two
  sources of truth for the same data is worse than one table with a new key column.
- Storing all weeks as JSON blocks inside a single `programs.content` value: rejected — breaks
  the existing per-row version/conflict/audit machinery entirely, and content size (currently
  capped <500KB per row) would have to cover a customer's entire history instead of one week.

## Decision 2: A week is locked if and only if a higher `week_number` row exists for that customer

**Decision**: "Locked" (FR-008) is a computed property, not a stored flag:
`is_locked = week_number < MAX(week_number) WHERE customer_id = X`. The single highest
`week_number` row per customer is always the only writable one ("current"). Creating a new
week (`week_number = MAX + 1`) is the only action that changes which row is current — it
implicitly and atomically locks the previous one, since the lock condition is derived, not
toggled.

**Rationale**: A derived invariant can't drift out of sync the way a mutable `status` column
could (e.g. a bug or manual edit leaving two rows both marked "current"). It also directly
matches the spec's own trigger condition: FR-008 says a week locks *because* "a newer week's
routine exists" — that's precisely `MAX(week_number)` changing. It resolves the spec's
Assumptions note ("this spec does not define the exact rule for when a week automatically
transitions... beyond requiring that a newer week's existence is what triggers locking the
prior one") with the simplest rule that satisfies it.

**Alternatives considered**: An explicit `status ENUM('current','locked')` column, updated via a
trigger or application logic whenever a new week is created: rejected — adds a second source of
truth (the enum could disagree with `week_number` ordering after a bug or manual DB edit) for no
capability the derived rule doesn't already provide. Week numbers are also never expected to be
deleted or reordered, so the derived rule is stable.

## Decision 3: Week numbers are created sequentially, no gaps

**Decision**: A customer's next week must be `MAX(week_number) + 1`. There is no supported way
to jump from week 3 directly to week 5.

**Rationale**: The spec's user stories describe ordinary week-by-week progression, never
skipping ahead. Allowing gaps would force every consumer (week selector, lock-check, PDF export)
to handle "week 4 doesn't exist yet but week 5 does" as a real case for no described benefit.
This is a plan-level implementation default (not scope-affecting enough to need a user
clarification), consistent with the spec's Assumption that "current week" tracks ordinary
calendar progression.

**Alternatives considered**: Arbitrary week numbers (coach picks any integer): rejected — no
user story needs it, and it multiplies edge cases (gap detection in the selector, "week N
doesn't exist" handling) for zero described value.

## Decision 4: Retire the 4-slot progression-note mechanism; each week's own content replaces it

**Decision**: `parseWeeklyProgression`/`weeklyProgression`/`resolveProgressionText` and the
hardcoded `WEEK_NUMBERS = [1,2,3,4]` progression-note system (specs/003) are superseded, not
extended. A week's own markdown content (its exercises, sets/reps, and any notes the coach
writes into it) *is* what's shown for that week — there is no separate short "progression text"
layered on top of a shared schedule, because there is no longer a shared schedule to annotate.

**Rationale**: That mechanism existed specifically to fake per-week variation on top of one
identical schedule (specs/003's explicit design: "day-by-day schedule stays identical across
every week... only the progression-note area updates"). Once routines are genuinely independent
per week (this feature's whole point), the workaround it provided is no longer needed — keeping
it alongside real per-week content would mean two different, redundant ways to express "what's
different about this week," inviting them to drift apart.

**Implementation note (2026-09-23)**: `progressionHtml` is kept. It is not part of the 4-slot
mechanism — it renders the week's own "Progression" section (e.g. pull-up/push-up progressions),
and removing it would have hidden real program content from the UI.

**Alternatives considered**: Keep `weeklyProgression` as an optional supplementary note per week
(e.g. a short "focus" line shown above that week's full routine): rejected as unnecessary scope
— a coach can already put such a note directly in that week's own markdown content (e.g. under a
short heading), the same way `customers/jaqueline-orellano/program.md` already writes prose
notes inline. No FR asks for a separate structured note field.

## Decision 5: Frontend lazily fetches each week's content on first view, cached per session

**Decision**: The week selector (`week-subnav.js`) is populated from a lightweight
metadata-only endpoint (week numbers + locked/current + last-updated, no exercise content).
Selecting a week fetches that week's full parsed routine on first view only; once fetched, it's
kept in an in-memory map for the rest of that page visit so re-selecting an already-viewed week
does not re-fetch.

**Rationale**: specs/003 guaranteed zero network requests on week switch, which this feature
must give up — the whole point is that weeks now hold genuinely different content, so it can't
all be precomputed client-side from one initial fetch the way a shared schedule could. Fetching
lazily (not all weeks up front) keeps the initial page load cheap regardless of how many weeks
of history exist (FR-009, open-ended), directly serving the "selector must remain usable... as
week count grows well past today's fixed 4" edge case. Session-level caching keeps repeat
switches between already-viewed weeks free, which is the closest practical match to
Constitution Principle IV's "without redundant re-reads" once "one shared blob for everything"
is no longer available as an option. This trade-off is called out explicitly in this plan's
Constitution Check (Complexity Tracking) as a deliberate, justified change to specs/003's
contract guarantee.

**Alternatives considered**: Fetch every week's full content up front in the initial customer
page load: rejected — does not scale as history grows unbounded (FR-009 explicitly removes the
4-week cap), and most of that content would go unviewed in a typical session (a coach usually
looks at the current week, occasionally one past week).

## Decision 6: Default the active week on page load to the current (latest) week, not "Week 1"

**Decision**: Opening a customer's page selects their current (highest `week_number`) week by
default, not a hardcoded "Week 1".

**Rationale**: specs/003 defaulted to Week 1 because every week showed identical content anyway
— it didn't matter which one was "selected" by default. Once weeks genuinely differ and can
number in the dozens (FR-009), defaulting to week 1 would show a coach or customer stale,
long-locked history on every page load instead of what's actually being trained right now. This
is a small, clearly beneficial behavior change flagged here because it explicitly reverses a
specs/003 acceptance criterion ("Week 1 is selected on first render").

**Alternatives considered**: Keep defaulting to Week 1: rejected as actively unhelpful once
history is long-lived — every visit would require manually navigating to the current week first.

## Decision 7: `sync_events` and `offline_queue_entries` gain a nullable `week_number` column

**Decision**: Both tables add `week_number INTEGER NULL` (null for `file_type` values other than
`'program'`, since notes/nutrition_plan/feedback stay single-row and out of this feature's
scope) so sync history and offline-queue entries stay attributable to the correct week.

**Rationale**: These tables already key on `(customer_id, file_type)`; without `week_number`,
sync events for two different weeks' edits would be indistinguishable in the audit trail, and an
offline-queued program edit couldn't say which week it targets. Nullable (rather than required)
keeps the existing notes/nutrition_plan/feedback rows and code paths completely unaffected.

**Alternatives considered**: A separate `program_sync_events` table: rejected — duplicates the
existing table's columns and the `recordSyncEvent`/`getRecentSyncEvents` functions for one
additional nullable column's worth of benefit.

## Resolved unknowns

No `[NEEDS CLARIFICATION]` markers remain in `plan.md`'s Technical Context — all values are
drawn directly from the existing, already-running system (`app/package.json`,
`app/server/lib/customer-data.js`, `app/tests/` conventions), not assumptions.
