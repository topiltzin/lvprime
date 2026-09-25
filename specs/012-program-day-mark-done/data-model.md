# Data Model: Program Day "Mark done" Quick-Complete

No new tables or columns. Everything lives in the existing `feedbacks.content` Markdown blob (one per customer), which is parsed on read.

## Training Day (derived, read-only)

From `parseProgramDetail()` → `weeklySchedule[]` of the current program week.

| Field | Source | Notes |
|---|---|---|
| `day` | day heading | e.g. `Lunes` |
| `focus` | heading text after the day | may be empty |
| `exercises[]` | structured rows | the footer is shown only when non-empty |
| **sessionLabel** | derived | `"<day> - <focus>"`, or `"<day>"` when focus is empty. Identical to what the card shows. |

Eligibility for the Mark done action: `exercises.length > 0` AND the week detail has `isLocked === false`.

## Session Entry (existing, extended semantics)

A Markdown block in `feedback.md`:

```markdown
## 2026-09-25 - Lunes - Piernas A
- How customer felt: Not reported
- Completed: Yes
- Notes: Not reported
- Overall impression: Not reported
```

| Field | Rule |
|---|---|
| date | ISO `YYYY-MM-DD`, the coach's local "today" for quick-complete |
| label | the session label; compared trimmed and case-insensitive |
| fields | exactly the customer's template fields, all present (constitution Principle II) |
| completed | `Yes`/`Sí`/`No` |

**Identity**: `(date, lower(trim(label)))`. At most one entry per identity is *written* from now on. Legacy duplicates are left alone; writes target the last match.

## "Not reported" sentinel

| Template language | Value |
|---|---|
| English / fallback | `Not reported` |
| Spanish (any template field label containing `á é í ó ú ñ`, or matching `completad|energ[íi]a|nota|dificultad`) | `No reportado` |

The parser treats either value (case-insensitive) as a placeholder, so the parsed field is `null`. That means:
- API `felt` / `difficulty` / `notes` are `null`. The card hides those facts.
- `difficultyScore` is `null`, so the entry doesn't count toward average difficulty.
- `raw_matched` stays `true` because `completed` is real, so the entry counts toward completion %.

## Day completion state (client-derived)

```
done(day) = newest entry e where
  e.completed === true
  && norm(e.label) === norm(sessionLabel(day))
  && e.date is ISO && today-6d <= e.date <= today
```

State transitions for one card:

```
idle --click--> saving --201/200--> done
                  \--error--> error --click--> saving
done --Add details + Log Session Completed=No (same date+label)--> idle   (on next render)
```

Locked week: `done` renders read-only (no Add details); otherwise there is no footer.
