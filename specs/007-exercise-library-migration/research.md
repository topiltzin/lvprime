# Phase 0: Research — Exercise Library Migration & Video Linking

**Date**: 2026-09-21
**Status**: Complete — no NEEDS CLARIFICATION markers remain (spec had none, and no technical
unknowns surfaced during planning; this project's existing 006/002 specs already established the
storage and parsing patterns this feature extends).

---

## 1. Where the reference data should live

**Decision**: A new `exercises` table in the same Supabase PostgreSQL database already used for
`customers`/`programs`/`feedbacks`/`notes`/`nutrition_plans` (specs/006-customer-data-storage).

**Rationale**: The user explicitly asked for "a new Table." It also matches the project's own
established trajectory: specs/006 already moved every other piece of flat-file customer data off
the filesystem and into Supabase specifically to have one queryable source of truth instead of
files a human has to open and read. Reference data like the exercise library benefits from the
same property — one place to look up or update a video link, used by every customer program.

**Alternatives considered**:
- *Keep `exercise.md` as a bundled static asset (e.g., JSON in the frontend build)* — rejected:
  reintroduces exactly the flat-file drift problem 006 eliminated, and the user asked for it to be
  removed locally, not just converted format.
- *Store each exercise's video link inline inside every customer's `program.md` content* —
  rejected: duplicates the same URL across every customer program that uses that exercise, each
  copy driftable independently, and would require rewriting program content instead of just
  reading it (violates the existing "no write-back" rule from exercise-row-parsing.md).

---

## 2. When linking is applied — read time vs. write time

**Decision**: Resolve `name -> videoUrl` at render/API-response time, in the same place
`parseProgramDetail()` already builds each day's `exercises` array. `programs.content` is never
rewritten.

**Rationale**: Consistent with the existing exercise-row-parsing.md contract's rule 5 ("No
write-back... `program.md` on disk is never modified by this parsing"). It also directly delivers
spec SC-005 for free: updating one exercise's video link in the central library is reflected in
every program that references it the next time it's viewed, with zero per-program edits, because
nothing was ever written into program content in the first place.

**Alternatives considered**:
- *Rewrite `programs.content` at migration time to inject Markdown links directly into the text* —
  rejected: breaks "no write-back," requires a re-run against every customer's content whenever a
  library video link is added or corrected, and permanently couples stored program text to the
  exercise library's current state at the time of the rewrite.

---

## 3. Name-matching strategy

**Decision**: Case-insensitive exact match only, via one in-memory lookup keyed by
`name.toLowerCase()`, built from a single `exercises` query per program-detail load (not one query
per exercise line).

**Rationale**: Matches spec FR-007 and the documented Assumption that near-miss variants (e.g.
"Push Up" vs "Push-up") are out of scope and should render unlinked rather than guessed. At ~40
reference rows, loading the whole table once and matching in memory is trivial and keeps the
customer-profile load within its existing <500ms budget (specs/006 SC-004) — the same
parallel-`Promise.all` pattern `getCustomerFullProfile()` already uses for programs/notes/feedback/
nutrition_plans extends naturally to one more parallel query.

**Alternatives considered**:
- *Fuzzy/substring matching* — rejected per spec's explicit scope boundary (Edge Cases /
  Assumptions): a near-miss is treated as no-match, not resolved automatically, to avoid linking
  the wrong exercise with false confidence.
- *Per-exercise-line DB lookup* — rejected: unnecessary round-trip multiplication in a
  performance-sensitive path for no accuracy benefit over one bulk query.

---

## 4. Retiring `exercise.md`

**Decision**: Delete `exercise.md` immediately once the migration is run and verified (every row
present in `exercises` with name + video link intact — spec SC-001), no retention window.

**Rationale**: The user's request ("so we remove it locally") is explicit and immediate. This
differs from the precedent set by specs/006's customer-data migration, which kept a 30-day
filesystem backup (`customers/README-BACKUP-NOTICE.md`) — but that data was high-value,
hand-authored coaching history (irreplaceable if lost). `exercise.md`'s ~40 rows are low-risk
reference data: fully re-derivable from this feature's own `data-model.md`, and once the
`exercises` table has been verified to contain everything, the flat file adds no safety value —
only staleness risk if someone edits one copy and not the other.

**Alternatives considered**:
- *Mirror the 30-day backup-notice pattern used for customer data* — rejected as unneeded caution
  for this low-risk, non-customer-specific, fully-documented dataset, and contrary to the user's
  explicit instruction to remove it now.

---

## 5. Migration script shape

**Decision**: `app/server/migrations/migrate-exercises.js`, mirroring `migrate-data.js`'s existing
pattern: idempotent, upserts by a unique key (`name`, case-insensitively, instead of customer
`slug`), safe to re-run after a partial failure, run manually via
`node server/migrations/migrate-exercises.js` from `app/`.

**Rationale**: Consistency with the one existing migration script in this codebase rather than
inventing a new convention; idempotency matters here too since a first run could partially fail
partway through ~40 rows.

**Alternatives considered**: None seriously considered — this is a small, low-risk script and the
existing pattern fits directly.
