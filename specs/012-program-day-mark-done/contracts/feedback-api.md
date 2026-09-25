# Contract: Feedback API changes

Both routes require the coach session (existing auth). Error shapes are unchanged: `404 customer_not_found`, `422 validation_failed { fields }`, `503 unable_to_load`.

## NEW `POST /api/customers/:slug/feedback/quick-complete`

Request:
```json
{ "date": "2026-09-25", "label": "Lunes - Piernas A" }
```

| Field | Rule | 422 message |
|---|---|---|
| `date` | valid ISO `YYYY-MM-DD` | `required (YYYY-MM-DD)` |
| `label` | non-empty after trim, max 200 chars | `required` |

Behaviour:
1. Find the last entry with the same ISO date and label (trimmed, case-insensitive).
2. **No match**: append a new entry. Every template field gets the "not reported" sentinel, except the completed-like field, which gets `Yes` (or `Sí`). Respond `201`.
3. **Match, completed already yes**: no write. Respond `200`.
4. **Match, completed no or missing**: rewrite only that entry's completed-like line to the yes value and keep every other line. Respond `200`.

Response (201 / 200):
```json
{
  "created": true,
  "entry": { "id": 7, "date": "2026-09-25", "label": "Lunes - Piernas A",
             "felt": null, "completed": true, "difficulty": null, "notes": null, "rawMatched": true }
}
```

## CHANGED `POST /api/customers/:slug/feedback` (Log Session)

The request and validation are unchanged. The write is now an **upsert** on (date, label):

| Case | Effect | Status |
|---|---|---|
| no entry with same date + label | append (as today) | `201` |
| entry with same date + label exists (last one wins) | its block is replaced by the submitted entry | `200` |

The response body is the same entry JSON as today (no wrapper), so the existing client keeps working. A `null`/empty label only matches entries with no label.

## Parser contract change

`parseFeedbackEntries()` treats `Not reported` / `No reportado` (case-insensitive, trimmed) as a placeholder, which parses to `null`, the same as `[...]` and `pending`.
