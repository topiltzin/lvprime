---

description: "Task list for Program Day Mark done quick-complete"
---

# Tasks: Program Day "Mark done" Quick-Complete

**Input**: Design documents from `/specs/012-program-day-mark-done/`

**Prerequisites**: plan.md, spec.md, design.md, research.md, data-model.md, contracts/ (feedback-api.md, program-day-footer-ui.md), quickstart.md

**Tests**: Included. plan.md and quickstart.md list `tests/unit/markdown-parser.test.js` (extend), `tests/unit/day-completion.test.js` (new), and `tests/integration/quick-complete.test.js` (new). Run them with `npm test` in `app/`.

**Organization**: Tasks are grouped by user story so each can be implemented and verified on its own.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: US1 to US3 from spec.md
- All paths are relative to the repository root. The web app lives in `app/`.

## Design references (read before any task)

- Visual states and copy: `specs/012-program-day-mark-done/design.md`
- API behaviour: `specs/012-program-day-mark-done/contracts/feedback-api.md`
- DOM/CSS contract: `specs/012-program-day-mark-done/contracts/program-day-footer-ui.md`
- Decisions R1-R8: `specs/012-program-day-mark-done/research.md`
- Copy strings (exact): `Mark done`, `Saving...`, `Done today`, `Done <formatDayDate>`, `Add details`, `Could not save. Try again.`, toast `Session logged`. No em-dashes.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Confirm the baseline. No new dependencies are needed (plan.md Technical Context).

- [X] T001 Run `npm test` in `app/` and record the current pass/skip baseline, so regressions from later tasks can be told apart from pre-existing skips (Supabase-gated tests skip without `app/.env.local`)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The pure Markdown functions that every story's server behaviour relies on (research R1, R3, R4).

**CRITICAL**: No user story work can begin until this phase is complete.

- [X] T002 In `app/server/markdown-parser.js`, add a `NOT_REPORTED` regex matching `Not reported` or `No reportado` (trimmed, case-insensitive, whole value) and make `isPlaceholder()` return true for it, so parsed `felt`/`difficulty`/`notes` become `null`. `raw_matched` must stay true when `completed` has a real value.
- [X] T003 In `app/server/markdown-parser.js`, export `isSpanishTemplate(template)` (true when any field label contains `á é í ó ú ñ` or matches `/completad|energ[íi]a|nota|dificultad/i`), `notReportedValue(template)` (returns `No reportado` or `Not reported`), and `completedYesValue(template)` (returns `Sí` or `Yes`)
- [X] T004 In `app/server/markdown-parser.js`, export `findFeedbackEntryBlock(content, { date, label })`. It scans heading lines outside ``` fences with the same `HEADING_LINE`/`DATE_LIKE` rules as `parseFeedbackEntries`, and returns `{ start, end }` line indexes for the **last** entry whose ISO date equals `date` and whose label (text after `date - `) equals `label` (trimmed, case-insensitive; a null/empty label only matches an entry with no label). `end` is exclusive and stops at the next heading or a `---` line. Returns `null` if nothing matches.
- [X] T005 In `app/server/markdown-parser.js`, export `upsertFeedbackEntryText(content, template, { date, label, fieldValues })`. It returns `{ content, replaced }`. On a match (T004), it swaps that block for `formatFeedbackEntry(...)` and keeps one trailing blank line. Otherwise it appends with the same header/separator logic `addFeedbackEntry` uses today (a `# <name> - Feedback & Progress Log` header for empty content is still handled by the caller).
- [X] T006 In `app/server/markdown-parser.js`, export `setEntryCompleted(content, template, { date, label })`. On a match, it rewrites only the completed-like field line (`/^complet/i` label) to `- <label>: <completedYesValue(template)>`, keeps all other lines verbatim, and returns `{ content, changed }`. `changed` is false when the value already parses as yes. It returns `null` when there is no match.
- [X] T007 [P] Extend `app/tests/unit/markdown-parser.test.js`: the sentinel parses to null for both languages; `raw_matched` stays true with completed=Yes; `upsertFeedbackEntryText` replaces the last of two matches, appends when the label differs only by date, matches `lunes - piernas a` against `Lunes - Piernas A`, ignores an entry inside a fenced example block, and a null label never matches a labelled entry; `setEntryCompleted` flips `No`→`Yes`, keeps other lines, reports `changed:false` when already `Sí`

**Checkpoint**: The pure functions are tested. The server and UI stories can start.

---

## Phase 3: User Story 1 - Mark a training day as done in one click (Priority: P1) MVP

**Goal**: One click on a current-week training day logs a completed session with "not reported" defaults and flips the card to Done, without leaving the Program tab.

**Independent Test**: Open the current week, click Mark done on one day. The card shows "Done today", the Feedback tab has exactly one new completed entry with no Felt/Difficulty shown, and completion % went up (quickstart scenarios 1-3).

### Tests for User Story 1

- [X] T008 [P] [US1] Create `app/tests/integration/quick-complete.test.js`, gated on `SUPABASE_URL`/`SUPABASE_SECRET_KEY` like `app/tests/integration/customer-data.test.js`. Cover: first call returns 201 `{ created: true, entry }` with `completed: true` and `felt/difficulty/notes: null`; a second identical call returns 200 `{ created: false }` and the entry count is unchanged; an existing `Completed: No` entry is flipped to yes with its other lines kept; `date: "2026-13-01"` → 422 `{ fields: { date: "required (YYYY-MM-DD)" } }`; empty label → 422 `{ fields: { label: "required" } }`; a Spanish-template customer gets `Sí` and `No reportado`. Restore the test customer's feedback content afterwards.

### Implementation for User Story 1

- [X] T009 [US1] In `app/server/feedback-writer.js`, export `validateQuickCompleteSubmission(body)`. It returns `{ valid: true }` or `{ valid: false, fields }`, with rules `date` "valid ISO `YYYY-MM-DD`" → message `required (YYYY-MM-DD)`, and `label` "non-empty after trim, max 200 chars" → message `required` (use `must be 200 characters or fewer` when too long). Reuse the existing `isValidIsoDate`.
- [X] T010 [US1] In `app/server/lib/customer-data.js`, export `quickCompleteFeedbackEntry(slug, displayName, { date, label })`. Load the existing feedback. If `setEntryCompleted` (T006) finds a match: when `changed`, upsert the new content. Return `{ entry, created: false }`, where entry is the parsed entry for that date+label. With no match, build `fieldValues` from the template (completed-like field → `completedYesValue`, every other field → `notReportedValue`), write via `upsertFeedbackEntryText` (with the same empty-content header as `addFeedbackEntry`), and return `{ entry, created: true }`. Wrap DB errors with `dbError(...)` like the neighbouring functions.
- [X] T011 [US1] In `app/server/index.js`, add `handlePostQuickComplete(req, res, slug)`, modelled on `handlePostFeedback` (404 `customer_not_found`, 422 on invalid JSON or T009 failure). Respond `201` or `200` with `{ created, entry: toFeedbackEntryJson(entry) }`. Register `{ method: 'POST', pattern: /^\/api\/customers\/([^/]+)\/feedback\/quick-complete\/?$/ }` in `ROUTES` **before** the existing `/feedback` route.
- [X] T012 [P] [US1] In `app/src/api-client.js`, export `quickCompleteSession(slug, { date, label })`, which POSTs to `/api/customers/${encodeURIComponent(slug)}/feedback/quick-complete` and returns `{ created, entry }`
- [X] T013 [P] [US1] Create `app/src/lib/day-completion.js` exporting `todayIso()` (the coach's **local** date as `YYYY-MM-DD`, not `toISOString()`), `sessionLabel(day)` (`"<day.day> - <day.focus>"`, or `day.day` when focus is empty), and `findDoneEntry(entries, label, today = todayIso())`. The last returns the newest entry with `completed === true`, a trimmed case-insensitive label match, and an ISO `date` where `today - 6 days <= date <= today`; otherwise `null`.
- [X] T014 [P] [US1] Create `app/tests/unit/day-completion.test.js`: `sessionLabel` with and without focus; `findDoneEntry` includes today and today-6, excludes today-7 and future dates, ignores `completed: false`/`null`, ignores non-ISO dates, returns the newest when two match, and matches labels case-insensitively
- [X] T015 [US1] In `app/src/components/program-day.js`, change the signature to `renderProgramDay(day, index = 0, options = {})` with `options = { editable, doneEntry, onMarkDone, onAddDetails }`. For days with exercises, append `<footer class="program-day-footer" role="status" aria-live="polite">` per the table in `contracts/program-day-footer-ui.md`. Idle state: `button.day-done-button` (`type="button"`, `check-circle` icon + `Mark done`) plus an empty `p.field-error`. On click, if a save is already in flight, return. Otherwise set `disabled`, `aria-busy="true"` and the text `Saving...`, then `await options.onMarkDone(day)`. On success, render the done state. On failure, restore the button and set the error text `Could not save. Try again.` Done state: `span.completion-chip.is-done` (`check-circle` + `Done today`, or `Done ${formatDayDate(entry.date)}` from `app/src/lib/format.js`) and, when `editable`, `button.day-add-details` (`note-pencil` + `Add details`) calling `options.onAddDetails(entry)`. Add the class `program-day-card--done` to the card. Use `textContent` only.
- [X] T016 [US1] In `app/src/components/tab-container.js`, keep `this.feedbackEntries` (the raw API entries, passed in via a new `options.feedbackEntries`) and add `setFeedbackEntries(entries)`. In `renderProgramWeek`, call `renderProgramDay(day, i, { editable: !detail.isLocked, doneEntry: findDoneEntry(this.feedbackEntries, sessionLabel(day)), onMarkDone: (d) => this.markDayDone(d), onAddDetails: (e) => this.onAddDetails?.(e) })`. Add `async markDayDone(day)`, which calls `quickCompleteSession(this.slug, { date: todayIso(), label: sessionLabel(day) })`, awaits `this.onSessionLogged?.(result.entry)` without letting its errors reject, and returns `result.entry`. Add `rerenderPanel(tabId)`, which replaces the panel's children with `this.renderTabContent(tab)` for that tab and leaves `activeTabId` and the other panels untouched.
- [X] T017 [US1] In `app/src/views/customer-view.js`, pass `feedbackEntries: data.feedback?.entries || []` and a new `onSessionLogged` to both `TabContainer` constructions. `onSessionLogged` shows `showToast('Session logged')` right away, then refetches `getCustomer(slug)`. On success, it sets `tabs.data.feedback = buildTabData(updated).feedback`, calls `tabs.setFeedbackEntries(updated.feedback.entries)` and `tabs.rerenderPanel('feedback')`, then `invalidateSidebar()` and `renderSidebar(document.getElementById('sidebar'), slug)`. On failure, it logs with `console.error` and leaves the card done (spec edge case). It must NOT call `setActiveTab`. Keep a reference to the TabContainer instance so the callback can reach it.
- [X] T018 [P] [US1] In `app/src/styles/main.css`, add `.day-done-button` to the primary-button selector groups (base, `:hover`, `:active`, `:disabled`, and the phone-width block near `form.feedback-form button` in the `max-width` media query). Add `.program-day-footer { margin-top: 1rem; padding-top: 1rem; border-top: 1px solid var(--border); display: flex; flex-wrap: wrap; align-items: center; justify-content: flex-end; gap: .75rem; }` and, below 640px, `.day-done-button { width: 100%; }`. Add `.program-day-card--done { border-color: var(--accent); }`, `.day-add-details` (transparent background, no border, `color: var(--accent-deep)`, `font-weight: 600`, `min-height: 44px`, `display: inline-flex; gap: .4rem; align-items: center`, underline on hover, visible `:focus-visible` outline), and `@keyframes chip-pop { from { opacity: 0; transform: scale(.6); } }` applied to `.program-day-footer .completion-chip.is-done .icon` with `animation: chip-pop var(--motion-base) var(--motion-out) both`. In the done state, `.program-day-footer` uses `justify-content: space-between`. No new colors or fonts.

**Checkpoint**: US1 is fully usable. Quickstart scenarios 1-3 pass.

---

## Phase 4: User Story 2 - Done state persists across reloads (Priority: P2)

**Goal**: Cards show the correct done state on every load and on every week, including read-only past weeks.

**Independent Test**: Mark a day done and reload: the card is still done. Past weeks show no button, and a done chip only if one applies (quickstart scenario 4).

- [X] T019 [US2] In `app/src/components/tab-container.js`, make sure that `showWeek` renders of fetched past weeks also pass `doneEntry` (via the same `renderProgramWeek` path) with `editable: false`, and that `program-day.js` (T015) then renders the chip without Add details and no button. Verify that the locked-week `program-week-status` banner still renders above the cards.
- [X] T020 [US2] In `app/src/components/tab-container.js`, after `setFeedbackEntries()` is called, re-apply done state to the **current** week body only if it is showing and not mid-save. The simplest approach: `if (this.activeWeek === currentWeek && weekBody) this.renderProgramWeek(weekBody, detail)` guarded so it does not replay the `rise-in` animation. Add a `program-week-body--static` class that sets `.program-week-body--static .program-day-card { animation: none; }` in `app/src/styles/main.css`, applied for this re-render only.

**Checkpoint**: The done state is correct across reloads and week switches.

---

## Phase 5: User Story 3 - Add details to a quick-logged session (Priority: P2)

**Goal**: "Add details" opens a prefilled Log Session, and saving the same date + label enriches the entry instead of appending (FR-008, FR-009).

**Independent Test**: Quick-mark a day, then use Add details → fill → save. The Feedback tab shows one entry for that session with the new values. Saving with Completed = No returns the card to Mark done (quickstart scenarios 5-6).

### Tests for User Story 3

- [X] T021 [P] [US3] In `app/tests/integration/customer-data.test.js` (Supabase-gated), add: calling `addFeedbackEntry` twice with the same `date` + `label` and different field values leaves the parsed entry count unchanged and holds the second call's values; a different label appends; the return value is `{ entry, created }`

### Implementation for User Story 3

- [X] T022 [US3] In `app/server/lib/customer-data.js`, change `addFeedbackEntry` to write via `upsertFeedbackEntryText` (T005), keeping the empty-content header behaviour. Return `{ entry, created: !replaced }`, where `entry` is the parsed entry matching date+label (not blindly the last one). Update any other callers found with `grep -rn addFeedbackEntry app/` (server, scripts, tests).
- [X] T023 [US3] In `app/server/index.js` `handlePostFeedback`, respond `201` when `created` and `200` when replaced, with the body still `toFeedbackEntryJson(entry)` (no wrapper), per `contracts/feedback-api.md`
- [X] T024 [P] [US3] In `app/src/views/feedback-form-view.js`, attach `wrap.prefill = ({ date, label }) => { dateInput.value = date; labelInput.value = label || ''; clearErrors(); }` and `wrap.focusFirstField = () => Object.values(fieldInputs)[0]?.focus()` before returning `wrap`
- [X] T025 [US3] In `app/src/components/tab-container.js`, store the form element created in `renderAddEntryContent` as `this.feedbackFormEl`. Add `openLogSession({ date, label })`, which calls `this.feedbackFormEl?.prefill({ date, label })`, then `this.setActiveTab('add-entry')`, then `this.feedbackFormEl?.focusFirstField()`. Set the default `this.onAddDetails = (entry) => this.openLogSession({ date: entry.date, label: entry.label })` in the constructor (used by T016).
- [X] T026 [US3] In `app/src/views/customer-view.js`, pass `feedbackEntries` from the refreshed data into the TabContainer rebuilt by `onFeedbackAdded`, so a correction saved with Completed = No shows Mark done again on Program. Keep its existing jump to Feedback and the `Saved · view in Feedback` toast unchanged.

**Checkpoint**: All three stories work independently and together.

---

## Phase 6: Polish & Cross-Cutting Concerns

- [X] T027 [P] Run `npm test` in `app/` and compare with the T001 baseline. All new unit tests pass, and the Supabase-gated ones pass when credentials are present.
- [X] T028 Walk quickstart.md manual scenarios 1-8 via `npm run dev` in `app/`: light and dark theme, `prefers-reduced-motion: reduce` (no chip pop), keyboard-only (Tab to Mark done / Add details, Enter activates, focus visible), 375px width (full-width button, no horizontal scroll), rest day (no footer), past week (read-only)
- [X] T029 [P] Copy audit: grep `app/src` for the new strings and confirm the exact copy from `design.md` with no `—` or `–` characters (`grep -rn "[—–]" app/src/components/program-day.js app/src/styles/main.css`)
- [X] T030 Run `npm run build` in `app/` and confirm the build succeeds with no new warnings

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: none
- **Foundational (Phase 2)**: after Setup. Blocks all stories.
- **US1 (Phase 3)**: after Foundational. This is the MVP.
- **US2 (Phase 4)**: after US1 (reuses the T015/T016 footer and `findDoneEntry`)
- **US3 (Phase 5)**: server tasks T021-T023 need only Foundational and can run in parallel with US1. UI tasks T024-T026 need T016/T017 from US1.
- **Polish (Phase 6)**: after all desired stories

### Within Phases

- T002 → T003 → T004 → T005/T006 (same file, sequential) → T007
- T009 → T010 → T011 (server chain); T012, T013/T014, T018 in parallel with it
- T015 → T016 → T017
- T022 → T023; T024 in parallel; T025 after T016; T026 after T017

### Parallel Opportunities

```text
# After Phase 2, in parallel:
T008 (integration test file)   T012 (api-client)   T013 + T014 (day-completion + tests)   T018 (CSS)
T021 (US3 upsert test)         T022 → T023 (US3 server, different functions from T010)

# US3 UI:
T024 (feedback-form-view.js) in parallel with T025 prep
```

## Implementation Strategy

### MVP First (User Story 1 only)

1. Phase 1 and Phase 2 (pure functions + unit tests)
2. Phase 3 (US1): endpoint, footer, stay-on-Program refresh
3. **Stop and validate** quickstart scenarios 1-3. Shippable: coaches can quick-log completion.

### Incremental Delivery

1. + US2: done state survives reloads and week switches
2. + US3: Add details and upsert, so no double counting and mistakes can be corrected
3. Polish: full quickstart pass, copy audit, build

## Notes

**Implementation notes (2026-09-25)**:
- T020: no re-render was needed. The card updates itself in place after Mark done, `renderProgramWeek` reads `this.feedbackEntries` on every week render, and a Log Session save rebuilds the tabs (T026). So `program-week-body--static` was not added.
- The done chip's `role="status"` sits on an inner `.program-day-status` wrapper, not the whole footer, so the buttons are not inside a live region. After Mark done, focus moves to Add details.
- The chip entrance (`chip-pop`) only plays on the click that marks the day done (`.is-new`), not on every render.
- Full-width button uses the existing 480px phone breakpoint that other primary buttons use (not 640px).
- The Log Session form's `todayIso()` now uses the local date from `src/lib/day-completion.js` (it was UTC), so Mark done and Add details agree on "today".
- T027: with credentials, 100 pass, 6 skipped, 4 fail. The 4 failures are all in `migration-data-integrity.test.js` and fail identically without this feature: Supabase content has drifted from the `customers/` files on disk. Without credentials: 66 pass, 19 skipped, 0 fail.
- T028: automated browser walk-through (Playwright, temporary fixture customer, since deleted). Covered: error path, double-click guard, done chip + stay on Program + focus, reload persistence, Add details prefill + replace, Completed = No back to Mark done, dark theme, 375px with no horizontal overflow.

- There are no DB migrations; everything stays in the `feedbacks.content` Markdown blob.
- Never write a blank template field (constitution Principle II): defaults are always the sentinel.
- Commit after each phase checkpoint.
