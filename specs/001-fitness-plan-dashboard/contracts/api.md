# Local API Contract: Fitness Plan Dashboard

> **Updated during `/speckit-implement`**: the two real customer files
> (`customers/jaqueline-orellano/feedback.md`, `customers/topiltzin-flores/feedback.md`)
> turned out to use two *different*, richer field sets than the generic CLAUDE.md template
> this contract originally assumed (9 Spanish fields vs. 7 English fields, at different
> heading levels). The feedback endpoints below were made **data-driven**: each customer's
> own template is extracted from their file (see `research.md` §4) and returned by
> `GET /api/customers/:slug` as `feedback.template`; the write form is generated from that
> template rather than a fixed `felt`/`completed`/`difficulty`/`notes` shape. The sections
> below reflect the as-built contract.

The frontend (`app/src/`) talks only to this local API, served on the same origin (mounted
into the Vite dev server in development; served by a plain Node HTTP server in `npm start`
for regular use). There is no external network access, no auth headers, and no CORS
concerns — single user, single machine (constitution "Local-only" scope).

All responses are JSON except where noted. All endpoints are read-only except
`POST /api/customers/:slug/feedback`.

## `GET /api/customers`

Backs User Story 1 (overview).

**Response `200`**:

```json
{
  "customers": [
    {
      "slug": "jaqueline-orellano",
      "displayName": "Jaqueline Orellano",
      "hasProgram": true,
      "hasNotes": true,
      "programGoal": "Ganancia de masa muscular, incremento de fuerza y mejora de movilidad y skills",
      "lastFeedbackDate": null
    }
  ]
}
```

- Always `200`, even if `customers/` is empty (`"customers": []"`) — never errors due to
  missing or partial customer data (spec FR-010).
- Served from the SQLite index, re-synced against disk mtimes just before responding.

## `GET /api/customers/:slug`

Backs User Story 2 (plan + feedback + notes detail view).

**Response `200`**:

```json
{
  "slug": "jaqueline-orellano",
  "displayName": "Jaqueline Orellano",
  "program": {
    "present": true,
    "goal": "...",
    "fitnessLevel": "Activo (5 días/semana)",
    "sessionDuration": "55-65 min/sesión",
    "planDuration": "4 semanas",
    "weeklySchedule": [
      { "day": "Lunes", "focus": "Piernas A — Cuádriceps + Glúteos + Abdomen", "html": "<p>...</p>" }
    ],
    "progressionHtml": "<h2>Progresión...</h2>..."
  },
  "notes": {
    "present": true,
    "html": "<h1>Notas del Entrenador...</h1>..."
  },
  "feedback": {
    "entries": [
      {
        "id": 12,
        "date": "2026-09-21",
        "label": "Lunes - Piernas A",
        "felt": "Alta",
        "completed": true,
        "difficulty": "Moderada",
        "notes": "...",
        "rawMatched": true
      }
    ],
    "trend": {
      "completionRate": 0.8,
      "points": [
        { "date": "2026-09-21", "completed": true, "difficultyScore": 2 }
      ]
    },
    "template": { "headingLevel": 2, "fields": ["Completó", "Energía", "Dificultad", "..."] }
  },
  "attachments": [
    { "relativePath": "plans/semana1.pdf", "sizeBytes": 149846, "modifiedAt": "2026-09-14T19:57:00Z" }
  ]
}
```

- **Response `404`** only when `slug` does not correspond to any folder under `customers/`
  at all (unknown customer) — an *existing* folder missing some of its files still returns
  `200` with `program.present`/`notes.present` as `false` and `feedback.entries: []` (spec
  FR-010, edge case: empty folder).
- `program` and `notes` are omitted from rendering (not editing) — this endpoint never
  accepts a body and never writes `program.md`/`notes.md` (spec FR-009).
- `trend.difficultyScore` is a small fixed mapping (e.g. Fácil=1, Moderada=2, Difícil=3)
  used only for chart rendering; the source field `difficulty` is preserved verbatim
  alongside it.
- `feedback.entries[]` items only surface the 4 canonical semantic fields the index tracks
  (`felt`/`completed`/`difficulty`/`notes`, matched from whichever of the customer's own
  template labels map to them) plus `notes` and `rawMatched` — a customer template's other
  fields (e.g. Jaqueline's "Ejercicio más difícil", Topiltzin's "Elbow status") are written
  correctly to `feedback.md` on submission but are not individually indexed/displayed back;
  this was a scope trade-off made during implementation to keep the SQLite schema and UI to
  the "minimum" the feature calls for.
- `feedback.template` is included so the frontend can render a submission form with exactly
  that customer's own field labels, in order (`POST` body's `fields` keys must match these).

## `POST /api/customers/:slug/feedback`

Backs User Story 3 (log a new feedback entry). This is the **only** write endpoint in the
system.

**Request body** (as-built — `fields` keys are exactly the labels from that customer's own
`feedback.template.fields`, obtained from a prior `GET /api/customers/:slug` call):

```json
{
  "date": "2026-09-21",
  "label": "Lunes - Piernas A",
  "fields": {
    "Completó": "Sí",
    "Energía": "Alta",
    "Dificultad": "Moderada",
    "Ejercicio más difícil": "Pull-up progression",
    "Ejercicio que mejor se sintió": "Hip thrust",
    "Dolor articular": "No",
    "Ardor muscular": "No",
    "Observaciones": "Buena sesión, un poco de fatiga en la última serie.",
    "Impresión general": "Moderada"
  }
}
```

**Validation (constitution Principle II, NON-NEGOTIABLE — enforced before any write)**:

- `date` is required and must be a valid calendar date; the app always normalizes/writes it
  as `YYYY-MM-DD` regardless of client-side format, per constitution Principle III.
- Every field named in that customer's `feedback.template.fields` is required and non-empty
  (`label` is optional).
- Whichever template field is completion-like (label matching /complet/i) must read as
  Yes/No (`Sí`/`No`/`Yes`/`No`, case-insensitive prefix).

**Response `201`** on success — returns the created entry in the same shape as the
`feedback.entries[]` items above, plus updates the customer's `lastFeedbackDate`.

**Response `422`** on validation failure:

```json
{
  "error": "validation_failed",
  "fields": {
    "difficulty": "required"
  }
}
```

No partial write occurs on `422` — nothing is appended to `feedback.md` or SQLite (spec
FR-007 acceptance scenario 2).

**Response `404`** if `slug` does not correspond to an existing customer folder.

**Side effects on success**:

1. A new entry block is appended to `customers/:slug/feedback.md`, matching that file's
   existing entry template exactly (field labels/order as already used in the target file —
   see `data-model.md` → Feedback Entry). If `feedback.md` does not exist yet, it is created
   with a minimal header plus the new entry (spec edge case).
2. The `feedback_entries` and `customers` SQLite rows for that customer are re-indexed from
   the updated file (not incrementally patched), keeping the index and file guaranteed
   consistent (research.md §5).
3. `feedback.notes.md`/`program.md` are never touched by this or any endpoint.
