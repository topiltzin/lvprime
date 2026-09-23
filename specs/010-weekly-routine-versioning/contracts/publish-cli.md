# Contract: Publish CLI (week-aware)

**Component**: `app/server/scripts/publish.js`
**Requirement Refs**: FR-001, FR-003, FR-008, FR-009

---

## Interface

```
node --env-file=.env.local server/scripts/publish.js <slug> program [--week <N> | --new-week]
node --env-file=.env.local server/scripts/publish.js <slug> <notes|nutrition_plan>
```

`notes`/`nutrition_plan` are unchanged — single file, no week flags accepted or needed
(out of scope for this feature).

For `program`:
- **No flag** (default): publishes `customers/<slug>/program.md` to the customer's **current**
  week (equivalent to the existing behavior today, once "current" always resolves to the one
  week that exists for an unmigrated/single-week customer — FR-007). This is the common case: a
  coach revising the routine the customer is actively on (User Story 2).
- **`--new-week`**: publishes `customers/<slug>/program.md` as a **new** week
  (`current max + 1`), locking whatever was previously current (User Story 1). Fails loudly if
  the customer has no existing weeks yet — use the no-flag form to create week 1 for a brand new
  customer, same as today.
- **`--week <N>`**: explicit target, for scripted/non-interactive use. Behaves exactly like the
  API's `POST /api/sync/upload` `week_number` rules (`weekly-routine-api.md`): `N = current` →
  same as no flag; `N = current + 1` → same as `--new-week`; `N < current` → fails with a
  `Week N is locked (current week is <current>)` error, non-zero exit, no write; `N > current+1`
  → fails with a `Week N would leave a gap (next available is <current+1>)` error.

## Local file convention

`customers/<slug>/program.md` continues to hold whatever week the coach is actively drafting —
there is no new local multi-file convention introduced by this feature (e.g. no
`program-week-2.md`). The coach (or coach-assistant) edits `program.md` in place for whichever
week they intend to publish next, then runs the CLI with the appropriate flag. This keeps the
existing single-file editing workflow (`CLAUDE.md`'s documented flow) unchanged; only the publish
step gains a week-targeting choice.

## Output

```
Published <slug>/program (week <N>): version <from> -> <to>
```

or, for `--new-week`:

```
Published <slug>/program: created week <N> (was week <N-1>, now locked): version 0 -> 1
```

or, on a locked-week rejection:

```
Publish failed: week <N> is locked (current week is <M>). Use --new-week to start a new week, or omit --week to update the current one.
```
(non-zero exit, mirrors the existing `Publish failed: <message>` pattern in `publish.js`'s
top-level `.catch`)

The existing exercise-coverage report (`reportProgramCoverage`, unaffected by this feature —
still runs against whichever week's content was just published) continues to print after a
successful `program` publish, unchanged.

## Acceptance Criteria

- [ ] Running with no flag against a customer whose current week is 2 updates week 2's content
      and leaves week 1 untouched.
- [ ] Running with `--new-week` creates week 3 and a subsequent `--week 2` attempt is rejected as
      locked.
- [ ] Running with `--week 5` when current is 2 is rejected as a gap, no row created.
- [ ] Running against a brand-new customer with no flag still creates their week 1, matching
      today's `publish.js` "customer not found → create" behavior (unchanged).
