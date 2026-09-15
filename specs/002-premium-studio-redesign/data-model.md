# Data Model: Premium Studio Visual Redesign

**Feature**: [spec.md](./spec.md) | **Research**: [research.md](./research.md)

This feature adds no new persistence and no new database tables or columns. Every entity below
is either an existing record (from `customers/*.md` via `app/server/db.js`) rendered
differently, or a value derived in memory from existing fields. Fields marked **(new)** are new
*response* fields added to the existing `GET /api/customers/:slug` payload — no schema
migration is required since `app/data/index.sqlite` remains a disposable cache rebuilt from the
Markdown files.

## Client

Represents one coached individual, unchanged in source but newly carrying a derived triage
`Status` for display.

| Field | Type | Source | Notes |
|---|---|---|---|
| `slug` | string | `customers.slug` | unchanged |
| `displayName` | string | `customers.display_name` | unchanged |
| `hasProgram` | boolean | `customers.has_program` | unchanged |
| `hasNotes` | boolean | `customers.has_notes` | unchanged |
| `programGoal` | string \| null | `customers.program_goal` | unchanged; overview card truncates to 2 lines in CSS, not by mutating the string |
| `lastFeedbackDate` | string (ISO date) \| null | `customers.last_feedback_date` | unchanged |
| `status` **(derived, not persisted)** | `"no-feedback" \| "needs-checkin" \| "on-track"` | computed client-side from `lastFeedbackDate` | see Status below |

**Validation / derivation rule (FR-001, FR-002)**:
- `lastFeedbackDate == null` → `status = "no-feedback"`
- `daysSince(lastFeedbackDate) > 7` → `status = "needs-checkin"`
- otherwise → `status = "on-track"`

**Sort order (FR-001)**: `no-feedback` first, then `needs-checkin`/`on-track` ordered by
`lastFeedbackDate` ascending (oldest first) among clients that have a date, with `displayName`
(alphabetical) as the stable tiebreaker for equal status/date.

## Program

A client's current training plan. Unchanged fields plus one new nested field on each day.

| Field | Type | Source | Notes |
|---|---|---|---|
| `present` | boolean | `customers.has_program` | unchanged |
| `goal` | string \| null | `customers.program_goal` | unchanged |
| `fitnessLevel` | string \| null | parsed from `program.md` | unchanged |
| `sessionDuration` | string \| null | parsed from `program.md` | unchanged |
| `planDuration` | string \| null | parsed from `program.md` | unchanged |
| `weeklySchedule` | `TrainingDay[]` | parsed from `program.md` | see TrainingDay below |
| `progressionHtml` | string (HTML) \| null | parsed from `program.md` | unchanged, rendered as-is |

## TrainingDay

One day-of-week section within a Program.

| Field | Type | Notes |
|---|---|---|
| `day` | string | e.g. `"LUNES"`, `"Monday"` — authored language preserved verbatim (FR-011) |
| `focus` | string | e.g. `"Piernas A (Cuádriceps + Glúteos + Abdomen)"` |
| `html` | string (HTML) | unchanged — the whole-day rendered Markdown, kept as the fallback render path |
| `exercises` **(new)** | `Exercise[]` | structured rows extracted from the same day body; **empty array** when no line in the day matches the exercise pattern (in which case the Program tab falls back to rendering `html` for that day — research.md §1) |

## Exercise (new)

One movement row within a TrainingDay, extracted (not authored separately) from the day's
Markdown body.

| Field | Type | Example | Notes |
|---|---|---|---|
| `name` | string | `"Sentadilla libre / Goblet squat"`, `"Barbell Bench Press"` | text inside the leading `**bold**` of a numbered list item |
| `setsReps` | string | `"3 x 8-10"`, `"4 × 6-8 reps"` | kept as authored text, not decomposed into numeric sets/reps — values vary too much (ranges, "por lado/pierna" suffixes) to force into a stricter numeric shape without risking misrepresentation |
| `rest` | string \| null | `"90-120 seg"`, `"2 min"` | text following `Descanso`/`Rest`; `null` if the line has no rest segment |
| `formTip` | string \| null | `"Rodillas alineadas con tobillos, bajar controlado"` | from the immediately following `- Forma:`/`- Form tip:` line, if present; otherwise `null` (Program tab shows no tip row rather than an empty one) |

**Validation rule (FR-009, FR-010)**: An `Exercise` is only ever produced from a line that
matches the numbered-list-with-bold-name-and-dash-separated-metrics pattern documented in
research.md §1; any day content that doesn't match this pattern is left out of `exercises` and
is still fully visible to the coach via that day's unchanged `html` field.

## Feedback Entry

A single logged session record. Unchanged — no new fields; the stat tiles and trend chart
consume the existing shape.

| Field | Type | Source | Notes |
|---|---|---|---|
| `id` | number | `feedback_entries.id` | unchanged |
| `date` | string | `feedback_entries.entry_date` | unchanged |
| `label` | string \| null | `feedback_entries.label` | unchanged |
| `felt` | string \| null | `feedback_entries.felt` | unchanged |
| `completed` | boolean \| null | `feedback_entries.completed` | unchanged |
| `difficulty` | string \| null | `feedback_entries.difficulty` | unchanged, authored language preserved |
| `notes` | string \| null | `feedback_entries.notes` | unchanged |

## Feedback Stats (derived, not persisted)

The Feedback tab's top strip (FR-013), computed entirely from existing `feedback.trend` and
`feedback.entries` — no new field needed on the wire, only new *client-side* aggregation of
data already returned:

| Stat | Derivation |
|---|---|
| Completion % | `trend.completionRate` (already computed server-side in `getFeedbackTrend()`), rendered as `Math.round(rate * 100)}%`, or an explicit "not enough data" empty state when `null` |
| Last session | `entries[entries.length - 1].date` (entries are already sort-order ascending), or an empty state when `entries.length === 0` |
| Average difficulty | Mean of `trend.points[].difficultyScore` (already computed, bilingual-aware — see `DIFFICULTY_SCORE` in `app/server/db.js`), mapped back to the nearest label (`Easy`/`Moderate`/`Hard`/`Brutal`), or an empty state when no point has a score |

**Validation rule (FR-013, FR-017, FR-018)**: Every one of these three tiles, and the Notes
tab, MUST render an explicit empty state when the underlying data is absent — never a
hardcoded/example string standing in for real content.

## Coach Note

Unchanged — the Notes tab now renders `notes.html` (already returned by the API, already
Markdown-rendered) directly, with no synthetic `observations`/`recommendations` wrapper object.
The previous `notes-view` shape (`{ observations: [...], recommendations: [...] }` in
`app/src/views/customer-view.js`) is deleted along with its hardcoded placeholder strings — it
was never populated from real data to begin with.

| Field | Type | Source | Notes |
|---|---|---|---|
| `present` | boolean | `customers.has_notes` | unchanged |
| `html` | string (HTML) \| null | rendered from `notes.md` | unchanged; rendered verbatim when `present`, empty state shown otherwise |

## Status (value object, derived)

A coach-facing triage label. Not a stored entity — a pure function of `lastFeedbackDate` (see
Client above), used for both the status pill and the overview sort order.

| Value | Meaning | Visual treatment |
|---|---|---|
| `on-track` | Feedback logged within the last 7 days | green tint pill |
| `needs-checkin` | Most recent feedback is older than 7 days | amber pill |
| `no-feedback` | No feedback ever logged | dashed/muted pill |
