# Research: Program Day "Mark done" Quick-Complete

All findings below come from reading the current code (`app/`). The spec left no NEEDS CLARIFICATION markers; these are the technical unknowns the plan had to resolve.

## R1. How to keep "not reported" defaults out of stats and display (FR-003, SC-004)

- **Finding**: `parseFeedbackEntries()` (`app/server/markdown-parser.js`) runs every field value through `isPlaceholder()`, which returns `null` only for empty strings, `[...]` and `pending`. A literal "Not reported" would come through as `felt = "Not reported"`, `difficulty = "Not reported"`. Difficulty would score `null` (not in `DIFFICULTY_SCORE`), but the Felt/Difficulty facts would still render on the feedback card.
- **Decision**: Add a `NOT_REPORTED` sentinel set to the parser (`Not reported`, `No reportado`, matched case-insensitively) and have `isPlaceholder()` treat it as absent. Export one `notReportedValue(template)` helper that picks the right language.
- **Rationale**: The sentinel is handled in the one place every reader already goes through (`getCustomerFeedback` → `parseFeedbackEntries` → API → Feedback tab, trend, sidebar). `raw_matched` stays true because `completed` is a real value, so the entry still counts toward completion %.
- **Alternatives rejected**: `N/A` (the client already hides it, but the server would still score/pass it, and it reads as "not applicable" rather than "not reported"). `[Not reported]` (bracket placeholders are the template-example convention and would make the entry look unfilled in the raw .md). Leaving fields empty (fails the validator and constitution Principle II's "all required fields" rule).

## R2. Where the default entry is built (FR-002, spec edge case on custom templates)

- **Finding**: Templates are per customer and extracted from each `feedback.md` (`extractFeedbackTemplate`). Field labels vary by language (e.g. `Completado`, `Energía`). `validateFeedbackSubmission` accepts `Sí/Yes/No` for completed-like fields.
- **Decision**: Add a server endpoint, `POST /api/customers/:slug/feedback/quick-complete` with body `{ date, label }`. The server builds the field values from that customer's template: completed-like field → `Sí` if the template reads Spanish, else `Yes`; every other field → the `notReportedValue(template)`.
- **Rationale**: Language detection and the sentinel stay server-side, next to the parser that has to recognise them. The client stays a thin caller. The endpoint is easy to cover with `node --test`.
- **Alternatives rejected**: Building fields on the client and reusing the plain POST. That duplicates the template/sentinel knowledge in the browser, and a stale click could overwrite an enriched entry (see R4).

## R3. Enriching an existing entry instead of appending (FR-009, SC-003)

- **Finding**: `addFeedbackEntry()` (`app/server/lib/customer-data.js`) always appends formatted text to the single `feedbacks.content` Markdown blob. It then returns the last parsed entry. The parser already knows each entry's heading line, but it doesn't expose line ranges.
- **Decision**: Add a pure function `upsertFeedbackEntryText(content, template, { date, label, fieldValues })` to `markdown-parser.js`. It returns `{ content, replaced }`. It scans headings outside code fences, as the parser does, and finds the **last** entry whose ISO date equals `date` and whose label equals `label` (trimmed, case-insensitive; a null label only matches a null label). If it finds one, it replaces that entry's block (heading up to the next heading or `---`) with the newly formatted entry. Otherwise it appends, exactly as today. `addFeedbackEntry` uses it for the regular POST. The response is `200` when replaced and `201` when created.
- **Rationale**: This keeps the Markdown file the source of truth (constitution: `feedback.md` format fidelity). It needs no schema change, and the pure function can be unit-tested.
- **Alternatives rejected**: A structured entries table with a unique (date, label) key would be a large migration (feature 006 deliberately stored the Markdown blob). Soft-deleting then appending would leave history noise in `feedback.md`.

## R4. Quick-complete when an entry already exists (spec edge case: stale page, SC-003)

- **Decision**: For quick-complete, if a matching (date, label) entry exists, only its completed-like field is set to the yes value. All other field lines are kept verbatim. If it already reads yes, nothing is written. Responses are `200 { entry, created: false }` for an existing entry and `201 { entry, created: true }` for a new one.
- **Rationale**: A double click or a second tab can never duplicate the session or wipe details the coach added through Log Session.

## R5. "Done" state source and window (FR-006, SC-005)

- **Finding**: `GET /api/customers/:slug` already returns every parsed entry with `date`, `label` and `completed`. Program weeks have no calendar dates (`programs.week_number` only).
- **Decision**: Add a pure client helper `app/src/lib/day-completion.js`:
  - `sessionLabel(day)` returns `"<day> - <focus>"`, or `"<day>"` when there is no focus.
  - `findDoneEntry(entries, label, today)` returns the newest entry with `completed === true`, a matching label (trimmed, case-insensitive) and an ISO date in `[today - 6 days, today]`.

  `today` is the coach's local date (same as `todayIso()` in the Log Session form).
- **Rationale**: No extra request is needed. It is deterministic and unit-testable without a DOM, and it matches the spec's 7-day assumption.

## R6. Refreshing without leaving or re-animating the Program tab (FR-007)

- **Finding**: `onFeedbackAdded` in `customer-view.js` rebuilds the whole `TabContainer` and switches to Feedback. A rebuild would also replay the cards' `rise-in` entrance animation and reset the scroll position.
- **Decision**: After quick-complete succeeds, the card switches to the done state from the response in place. `customer-view.js` gets a new `onSessionLogged` callback. It refetches the customer, updates `tabContainer.data`, re-renders **only** the Feedback panel (new `TabContainer#rerenderPanel(id)`), stores the new entries for later done-state checks, invalidates and re-renders the sidebar, and shows the toast "Session logged". The active tab and scroll position stay the same. If the refetch fails, the card stays done and the stats catch up on the next load (spec edge case).
- **Alternatives rejected**: Reusing `onFeedbackAdded` would jump to Feedback, contradicting FR-007.

## R7. "Add details" prefill (FR-008)

- **Decision**: `renderFeedbackForm` gains a `prefill({ date, label })` method, exposed on the returned wrapper element. `TabContainer` keeps a reference to the form wrapper. `TabContainer#openLogSession({ date, label })` calls `prefill`, activates `add-entry`, and focuses the first template field. Saving goes through the existing `submitFeedback`, and the upsert (R3) handles enrichment. The existing `onFeedbackAdded` still moves to Feedback after a manual save, which is the correct behaviour there.

## R8. Visual/motion implementation

- **Decision**: Reuse the primary button rule by adding `.day-done-button` to the `.empty-state-cta, form.feedback-form button` selector group. Reuse `.completion-chip.is-done`. Add `.program-day-footer`, `.program-day-card--done { border-color: var(--accent); }`, `.day-add-details` (quiet text button), and a `chip-pop` keyframe (scale 0.6 → 1 + opacity) with its duration bound to `--motion-base`, so the existing reduced-motion override (0ms) turns it off. Icons: `check-circle` and `note-pencil` are already registered in `app/src/lib/icons.js`. No new dependencies.
