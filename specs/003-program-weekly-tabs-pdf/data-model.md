# Data Model: Weekly Program Tabs with PDF Download

**Feature**: [spec.md](./spec.md) | **Research**: [research.md](./research.md)

This feature adds no new persistence and no new database tables or columns. `weeklyProgression`
is a new *response* field on the existing program payload (parsed from `program.md`, the same
way `progressionHtml` already is) — no schema migration is required, since
`app/data/index.sqlite` remains a disposable cache rebuilt from the Markdown files. The PDF
content model and the "active week" selection are both derived, in-memory, client-side values —
never persisted.

## Program (extended)

Unchanged fields plus one new parsed field.

| Field | Type | Source | Notes |
|---|---|---|---|
| `present` | boolean | `customers.has_program` | unchanged |
| `goal` | string \| null | `customers.program_goal` | unchanged |
| `fitnessLevel` | string \| null | parsed from `program.md` | unchanged |
| `sessionDuration` | string \| null | parsed from `program.md` | unchanged |
| `planDuration` | string \| null | parsed from `program.md` | unchanged |
| `weeklySchedule` | `TrainingDay[]` | parsed from `program.md` | unchanged — the single shared day-by-day schedule shown under every week selector (spec.md FR-003) |
| `progressionHtml` | string (HTML) \| null | parsed from `program.md` | unchanged — the full progression section rendered as-is (independent of per-week matching) |
| `weeklyProgression` **(new)** | `WeeklyProgressionEntry[]` | parsed from `program.md` | see below; **empty array** when the program has no weekly progression section at all |

`TrainingDay` and `Exercise` are unchanged from `specs/002-premium-studio-redesign/data-model.md`
— this feature does not modify how days or exercises are parsed or shaped.

## WeeklyProgressionEntry (new)

One "what changes this week" note, extracted from the program's existing weekly progression
section (e.g. `**Semana 2:** Aumentar progresivamente las repeticiones...`).

| Field | Type | Example | Notes |
|---|---|---|---|
| `weekNumber` | number (1–4) | `2` | parsed from `Semana N:` / `Week N:` — entries outside 1–4 are dropped (out of scope per the fixed 4-week structure) |
| `text` | string | `"Aumentar progresivamente las repeticiones dentro del rango indicado."` | authored text verbatim, not reworded |

**Validation rule (FR-004, FR-005)**: `weeklyProgression` may contain 0–4 entries and is not
required to be contiguous or complete. For any week number 1–4 with no matching entry, the
client renders the explicit fallback message "No specific guidance for this week." — this
message is never written into `weeklyProgression` itself; it is a client-side rendering
decision applied at lookup time so the fallback text stays in one place (the UI) rather than
being duplicated into parsed data.

## Program Week (derived, not persisted)

A client-side view-model combining the (week-independent) schedule with one week's progression
note, computed fresh whenever the active week selector changes.

| Field | Type | Derivation |
|---|---|---|
| `weekNumber` | number (1–4) | the currently selected week selector |
| `weekLabel` | string | `"Week " + weekNumber` (or the equivalent localized label already used elsewhere in the UI) |
| `schedule` | `TrainingDay[]` | `program.weeklySchedule`, unchanged, reused for every week |
| `progressionText` | string | `weeklyProgression.find(e => e.weekNumber === weekNumber)?.text`, or the fallback message from FR-005 when no match exists |

## Program PDF Document (derived, not persisted)

The content model handed to the PDF-generation layer (research.md §4), built by the pure
function `buildProgramWeekPdfContent(weekNumber, programDetail)`.

| Field | Type | Notes |
|---|---|---|
| `weekLabel` | string | same as Program Week's `weekLabel` |
| `days` | `TrainingDay[]` | same schedule shown on screen for the active week |
| `progressionText` | string | same resolved text (real note or fallback message) shown on screen for the active week |

**Validation rule (FR-007, spec.md Edge Cases)**: When `program.weeklySchedule` is empty, `days`
is an empty array and the PDF still renders `weekLabel` plus an explicit "no schedule available"
message — the same empty-state convention already used elsewhere in the Program tab, applied to
the PDF output rather than silently producing a broken/blank file.
