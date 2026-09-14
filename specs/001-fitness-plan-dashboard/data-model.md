# Phase 1 Data Model: Fitness Plan Dashboard

Source of truth for each entity is called out explicitly — see `research.md` §5. SQLite
columns marked **(indexed)** are a derived cache of Markdown content; they are never the
authoritative value and are rebuilt from disk whenever a file's mtime moves past what's
indexed.

## Customer

**Source of truth**: existence of `customers/[slug]/` on disk. SQLite caches a summary row
for fast listing (spec FR-001/FR-002).

| Field | Type | Source | Notes |
|---|---|---|---|
| `slug` | string | folder name | Primary key. e.g. `jaqueline-orellano`. |
| `display_name` | string | derived from `slug` | Title-cased, hyphens → spaces (e.g. "Jaqueline Orellano"), unless `program.md`'s H1 provides a more specific name, which takes precedence. |
| `has_program` | boolean **(indexed)** | `program.md` exists? | Drives the "not yet created" empty state (spec FR-010). |
| `has_notes` | boolean **(indexed)** | `notes.md` exists? | Same. |
| `program_goal` | string \| null **(indexed)** | parsed from `program.md`'s "Objetivo/Goal" line | Shown in the overview summary (FR-002). Null if unparseable or file missing. |
| `last_feedback_date` | string (ISO date) \| null **(indexed)** | most recent parsed `feedback.md` entry date | Shown in the overview summary (FR-002). Null if no entries yet. |
| `program_mtime` | timestamp **(indexed)** | filesystem mtime of `program.md` | Used to decide whether to re-parse before serving. |
| `feedback_mtime` | timestamp **(indexed)** | filesystem mtime of `feedback.md` | Same, for feedback entries. |
| `notes_mtime` | timestamp **(indexed)** | filesystem mtime of `notes.md` | Same, for notes. |

**Validation rules**: A folder under `customers/` is a valid Customer regardless of which of
the three files it contains (spec FR-010, edge case: empty folder). No field is required to
exist for the customer to appear in the overview list.

## Program

**Source of truth**: `customers/[slug]/program.md` in full. Never written by the app
(constitution Principle I, spec FR-009). Not persisted into SQLite beyond the summary fields
on Customer above — the full program is parsed and rendered on demand when a customer's
detail view is requested (small file, no need to cache the full parse).

| Field | Type | Notes |
|---|---|---|
| `goal` | string | From the header metadata line(s). |
| `fitness_level` | string \| null | e.g. "Activo (5 días/semana)". |
| `session_duration` | string \| null | e.g. "55-65 min/sesión". |
| `plan_duration` | string \| null | e.g. "4 semanas". |
| `weekly_schedule` | ordered list of `{ day, focus, sections: HTML }` | One entry per day-of-week heading found in the file; `sections` is the `marked`-rendered HTML for that day's block (warm-up, exercises with sets/reps/rest/form tips, cool-down), displayed as-is rather than re-modeled field-by-field, since exercise detail formatting varies per customer. |
| `progression_notes` | HTML | Rendered from any "Progresión"/"Progression" sections found after the weekly schedule. |

**Validation rules**: None enforced by the app (read-only, display-only content) — display
whatever sections are present; a missing expected section is simply omitted from the
rendered view, never an error (spec FR-010's file-tolerance principle extended to
within-file section tolerance).

## Feedback Entry

**Source of truth**: `customers/[slug]/feedback.md`. The app both reads (for display/trend)
and writes (appends new entries) this file. SQLite fully indexes parsed entries for fast
trend queries (spec FR-006) and chronological display (FR-004).

| Field | Type | Source | Notes |
|---|---|---|---|
| `id` | integer | SQLite-assigned | Index-only identity; not written into the Markdown file. |
| `customer_slug` | string | — | Foreign key to Customer. |
| `entry_date` | string (ISO date) | parsed heading, or app-written on create | New entries are always written `YYYY-MM-DD` (constitution Principle III); older entries display whatever date string was found, normalized to ISO only when parseable. |
| `label` | string \| null | parsed heading remainder | Free text after the date in the `## [Date] - [...]` heading (day/session/muscle-group label), preserved as-is. |
| `felt` | string \| null | "Energía"/"How customer felt" field | e.g. "Alta", "Normal", "Baja". |
| `completed` | boolean \| null | "Completó"/"Completed" field | Null only for malformed entries the parser couldn't read (edge case), never for app-created entries, which require it. |
| `difficulty` | string \| null | "Dificultad"/"Overall impression" field | e.g. "Fácil", "Moderada", "Difícil" — the field used to compute the difficulty trend. |
| `notes` | string \| null | "Notas"/"Observaciones" field | Free text. |
| `raw_matched` | boolean **(indexed only)** | parser outcome | `false` when an entry didn't fully match the expected field set (edge case: manually-edited entry). Such entries still get `entry_date`/whatever fields were found; `raw_matched=false` just flags them for a subtler UI treatment (e.g. a small "partial entry" indicator), never hidden. |

**Validation rules (write path, constitution Principle II — NON-NEGOTIABLE)**: A new entry
submitted through the feedback form MUST have `entry_date`, `felt`, `completed`, `notes`,
and `difficulty`/overall-impression all present before the app appends anything to
`feedback.md` or SQLite; the submission is rejected with a field-specific error otherwise
(spec FR-007 acceptance scenario 2). The app-generated Markdown block for a new entry
follows the customer file's existing entry template exactly (see `contracts/api.md` for the
exact shape written).

**State**: No workflow/state-machine — an entry is simply present once written. No update or
delete path exists in this feature (out of scope; matches "read + log feedback" scope, which
covers creating new entries, not editing/removing past ones).

## Coach Note

**Source of truth**: `customers/[slug]/notes.md` in full. Never written by the app
(constitution Principle I, spec FR-009). Rendered on demand via `marked`, same as Program —
not decomposed into structured fields, since `notes.md` content varies more freely
(profile info, nutrition observations, progression phases, alerts, action items) than the
fixed feedback template.

| Field | Type | Notes |
|---|---|---|
| `rendered_html` | HTML | Full `marked`-rendered content of `notes.md`, displayed as one continuous readable section. |

**Validation rules**: None (read-only, display-only).

## Attachment

**Source of truth**: any file found in a customer's folder that isn't one of the three
standard `.md` files (e.g. `customers/jaqueline-orellano/plans/semana1.pdf`). SQLite indexes
metadata only — file bytes are never copied or uploaded anywhere (per the user's "images
are not uploaded anywhere" instruction, generalized to all attachment types found).

| Field | Type | Source | Notes |
|---|---|---|---|
| `customer_slug` | string | — | Foreign key to Customer. |
| `relative_path` | string | filesystem scan | e.g. `plans/semana1.pdf`, used to build a link/open action. |
| `size_bytes` | integer **(indexed)** | filesystem stat | Displayed next to the attachment link. |
| `modified_at` | timestamp **(indexed)** | filesystem stat | Displayed next to the attachment link. |

**Validation rules**: None — purely informational metadata (spec edge case: attachments are
listed/linkable, not rendered inline).

## SQLite Schema (index/cache layer)

```sql
CREATE TABLE customers (
  slug TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  has_program INTEGER NOT NULL,
  has_notes INTEGER NOT NULL,
  program_goal TEXT,
  last_feedback_date TEXT,
  program_mtime INTEGER,
  feedback_mtime INTEGER,
  notes_mtime INTEGER
);

CREATE TABLE feedback_entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_slug TEXT NOT NULL REFERENCES customers(slug),
  entry_date TEXT,
  label TEXT,
  felt TEXT,
  completed INTEGER,
  difficulty TEXT,
  notes TEXT,
  raw_matched INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL
);
CREATE INDEX idx_feedback_customer ON feedback_entries(customer_slug, sort_order);

CREATE TABLE attachments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_slug TEXT NOT NULL REFERENCES customers(slug),
  relative_path TEXT NOT NULL,
  size_bytes INTEGER,
  modified_at INTEGER
);
CREATE INDEX idx_attachments_customer ON attachments(customer_slug);
```

`feedback_entries` and `attachments` for a given `customer_slug` are fully deleted and
re-inserted whenever that customer's `feedback.md` (or folder listing, for attachments) is
re-indexed — simpler and safer than diffing individual rows, and cheap at this data scale
(see Technical Context "Scale/Scope").
