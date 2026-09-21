# Phase 1: Data Model — Exercise Library Migration & Video Linking

**Date**: 2026-09-21
**Status**: Complete

## Overview

Adds one new entity (`Exercise`) to the schema established in
specs/006-customer-data-storage/data-model.md, and amends the existing `Program` read-path output
(no schema change to `programs` itself) to carry resolved video links.

---

## Entity: Exercise

**Purpose**: Central reference record for one exercise — its name and a link to a video
demonstrating proper form. Replaces the rows previously kept in the repo-root `exercise.md` file
(spec FR-001, FR-002).

**Storage**: `exercises` table in the same Supabase PostgreSQL database as `customers`/`programs`/
etc.

**Structure**:

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | UUID | PRIMARY KEY, DEFAULT gen_random_uuid() | Unique exercise ID |
| `name` | VARCHAR(255) | NOT NULL, unique case-insensitively (see index below) | Matched against workout exercise names case-insensitively, exactly (spec FR-007) |
| `category` | VARCHAR(100) | NULLABLE | e.g. "Strength — Upper Body", "Cardio" — inherited from `exercise.md`'s existing table groupings; informational only, not used for matching |
| `video_url` | TEXT | NULLABLE | Link to a demonstration video. NULL means this exercise is currently unlinked (spec FR-005, Edge Cases) |
| `created_at` | TIMESTAMP | NOT NULL, DEFAULT NOW() | |
| `updated_at` | TIMESTAMP | NOT NULL, DEFAULT NOW() | Bumped on every video-link edit (spec FR-010) |

**Indexes**:
- `UNIQUE INDEX idx_exercises_name_lower ON exercises (LOWER(name))` — enforces spec FR-008
  (uniqueness) case-insensitively, and is the same index a case-insensitive lookup query would use
  (spec FR-007).

**Validation Rules**:
- `name` MUST be a non-empty string, 1-255 characters.
- `name` MUST be unique case-insensitively — attempting to insert/rename to a name that only
  differs by case from an existing row is rejected (spec FR-008).
- `video_url`, when present, MUST be an `http://` or `https://` URL. Absent (`NULL`) is valid and
  represents "not yet linked," not an error.
- `category` is free text, unconstrained (matches the five informal groupings already used in
  `exercise.md`: Strength — Upper Body, Strength — Lower Body, Core, Cardio, Flexibility &
  Mobility).

**Example Row**:
```json
{
  "id": "8a1e...uuid",
  "name": "Push-up",
  "category": "Strength — Upper Body",
  "video_url": "https://www.youtube.com/watch?v=WDIpL0pjun0",
  "created_at": "2026-09-21T10:00:00Z",
  "updated_at": "2026-09-21T10:00:00Z"
}
```

**Relationship to Program**: Logical only, by matching text — not a foreign key. A customer's
`programs.content` is unstructured Markdown; exercise names inside it are free text extracted by
`extractExercises()` (specs/002 exercise-row-parsing.md), the same way `Feedback`/`Notes` already
store raw Markdown rather than normalized rows (specs/006 data-model.md). Linking an `Exercise` to
a workout line is therefore resolved at read time by name match, never stored as a row-level
reference.

---

## Amendment: Program (existing entity) — read-path output only

**No schema change.** `programs` table itself is unchanged. The **API response shape** produced by
`parseProgramDetail()` (specs/002 exercise-row-parsing.md's `weeklySchedule[].exercises[]`) gains
one field per exercise:

```
{
  name: string,
  setsReps: string,
  rest: string | null,
  formTip: string | null,
  videoUrl: string | null   // NEW — resolved by case-insensitive match against Exercise.name;
                             //       null if no match, or a match with video_url = NULL
}
```

This is strictly additive — every field exercise-row-parsing.md already documents is unchanged;
`videoUrl` is the only new field, and its absence (`null`) never removes or blocks rendering of the
other fields (spec FR-005: unmatched exercises still render as plain text, program rendering never
fails).

---

## Full Schema SQL Addition (Run Once in Supabase SQL Editor)

Extends the block in specs/006-customer-data-storage/contracts/database-schema.md — this is the
one new table, in the same style:

```sql
CREATE TABLE exercises (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  category VARCHAR(100),
  video_url TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX idx_exercises_name_lower ON exercises (LOWER(name));
```
