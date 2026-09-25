# Design: Program Day "Mark done"

**Design read**: A product-UI control inside the existing LvPrime coach dashboard, used by coaches logging sessions for their clients. It keeps the current graphite + volt performance language. This is a redesign-preserve with no new tokens.
**Dials**: VARIANCE 3 / MOTION 3 / DENSITY 5 (matches the current app; product UI, not a landing page).

## Placement

A footer on each training-day card, mirroring the header divider (`border-top: 1px solid var(--border)`, same spacing as `.program-day-header`'s bottom).

```
┌─ program-day-card ───────────────────────────────────────────┐
│ LUNES                                        [barbell 4 ex.] │
│ Piernas A                                                    │
│ ──────────────────────────────────────────────────────────── │
│ 01  Sentadilla goblet                         3 x 12  60s    │
│ 02  Peso muerto rumano                        3 x 10  60s    │
│ ...                                                          │
│ ──────────────────────────────────────────────────────────── │
│                                         ( ✓  MARK DONE )     │  idle
└──────────────────────────────────────────────────────────────┘
```

## States

| State | Footer content | Notes |
|---|---|---|
| Idle | Volt pill button, `check-circle` icon + "Mark done" | Same style as the existing primary button (`.empty-state-cta`): `--accent-fill` bg, `--accent-contrast` text, Barlow Condensed 700 uppercase, min-height 48px, right-aligned; full width below 640px. |
| Saving | Same button, disabled, "Saving...", `aria-busy="true"` | opacity 0.6; ignores further clicks. |
| Done | `completion-chip is-done` "Done today" (or "Done Mon, Sep 22") + quiet text button `note-pencil` "Add details" | Card gets `border-color: var(--accent)`. Chip icon enters with scale 0.6 to 1 + opacity over `--motion-base` using `--motion-out`; reduced motion makes it 0ms (existing tokens). |
| Error | Idle button + `.field-error` line "Could not save. Try again." under it | Button re-enabled. The error clears on the next click. |
| Locked week | Done chip only (if done), else no footer | Read-only. |
| Rest / free-form day | No footer | |

```
done:
│ ──────────────────────────────────────────────────────────── │
│ [✓ Done today]                              ✎ Add details    │
```

## Behaviour

- **Click Mark done**: POST the regular feedback entry with date = today, label = "<Day> - <Focus>", Completed = Yes (or "Sí"), and other fields = "Not reported". On success, show the toast "Session logged", refresh stats and the sidebar, and **stay on Program**.
- **Add details**: switch to Log Session with date and label prefilled. Saving with the same date and label enriches that entry instead of appending one.
- **Accessibility**: a real `<button>`. The done chip is a status (`role="status"` on the footer, so the change is announced). Add details is a `<button>` with visible text. Contrast uses the existing tokens, which already pass AA in both themes.
- **Copy**: "Mark done", "Saving...", "Done today", "Done Mon, Sep 22", "Add details", "Could not save. Try again.", toast "Session logged". No em-dashes.
