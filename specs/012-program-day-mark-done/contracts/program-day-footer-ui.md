# Contract: Program day footer UI

Visual reference: [design.md](../design.md).

## Rendering rules (`renderProgramDay(day, index, options)`)

`options = { editable: boolean, doneEntry: Entry|null, onMarkDone(day) => Promise<Entry>, onAddDetails(entry) }`

| Condition | Footer |
|---|---|
| `day.exercises` empty | none |
| `!editable && !doneEntry` | none |
| `!editable && doneEntry` | done chip only |
| `editable && !doneEntry` | Mark done button |
| `editable && doneEntry` | done chip + Add details |

## DOM contract

```html
<footer class="program-day-footer">
  <div class="program-day-status" role="status"><!-- done chip lands here --></div>
  <!-- idle -->
  <button type="button" class="day-done-button"> [check-circle] Mark done </button>
  <p class="field-error"></p>
  <!-- done -->
  <span class="completion-chip is-done"> [check-circle] Done today </span>
  <button type="button" class="day-add-details"> [note-pencil] Add details </button>
</footer>
```

- The card gets the extra class `program-day-card--done` in the done state.
- Saving: `button.disabled = true`, `aria-busy="true"`, text `Saving...`. The handler bails out while a save is in flight.
- Error: `.field-error` text is `Could not save. Try again.`; the button is re-enabled.
- Chip text: `Done today` when `entry.date === today`, else `Done ${formatDayDate(entry.date)}`.
- All user-derived text is set via `textContent` (existing safe-DOM rule).

## Styling

- `.day-done-button` joins the existing primary button selector group (volt pill, 48px min height). `width: 100%` at the 480px phone breakpoint (same as the other primary buttons); right-aligned (`justify-content: flex-end` on the footer) above that.
- `.day-add-details`: transparent background, `--accent-deep` text, underline on hover, min-height 44px.
- `.program-day-footer`: `margin-top: 1rem; padding-top: 1rem; border-top: 1px solid var(--border); display: flex; flex-wrap: wrap; align-items: center; gap: .75rem;`
- `.program-day-card--done`: `border-color: var(--accent)`.
- The chip entrance `chip-pop` (only when the card turns done after a click, `.is-new`) runs for `var(--motion-base)` with `var(--motion-out)` easing and is 0ms under reduced motion (existing token override).

## TabContainer additions

- `openLogSession({ date, label })`: prefills the Log Session form, activates `add-entry`, and focuses the first field.
- `rerenderPanel(tabId)`: rebuilds one panel's content from `this.data` without touching the active tab.
- `setFeedbackEntries(entries)`: updates the entries used for done-state checks on later week renders.
