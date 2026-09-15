---

description: "Task list template for feature implementation"
---

# Tasks: Premium Studio Visual Redesign

**Input**: Design documents from `/specs/002-premium-studio-redesign/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md (all present)

**Tests**: This feature's `research.md` §10 decided tests are added only where pure logic
exists (`node --test`, no DOM harness) — status derivation and Markdown exercise-parsing get
real unit/integration tests; everything else (tab behavior, motion, visual tokens) is verified
manually via the `quickstart.md` scenarios referenced at the end of each phase below.

**Organization**: Tasks are grouped by user story (spec.md) to enable independent
implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on an unfinished task)
- **[Story]**: Which user story this task belongs to (US1–US4); Setup/Foundational/Polish tasks carry no story label
- File paths are exact and relative to the repository root

## Path Conventions

Single existing local web app at `app/` (frontend `app/src/`, local API `app/server/`, tests
`app/tests/`) — see plan.md → Project Structure. `customers/` (source-of-truth Markdown) is not
touched by this feature.

---

## Phase 1: Setup

**Purpose**: Establish the self-hosted type system and design-token scaffolding every screen depends on

- [X] T001 [P] Add self-hosted Inter (weights 400/500/600/700) and Inter Tight (weight 700) as local dependencies, per research.md §4 — *implemented via `@fontsource/inter`/`@fontsource/inter-tight` npm packages (Vite-bundled, zero external CDN at runtime) instead of hand-placed files under `app/fonts/`, since no raw Inter binaries were available to place by hand; this satisfies the same self-hosting requirement*
- [X] T002 Create `app/src/styles/tokens.css` defining the locked design tokens as `:root` custom properties — `--bg: #F4F2EE`, `--surface: #FFFFFF`, `--ink: #111111`, `--muted: #6B6B64`, `--border: #E6E3DC`, `--accent: #1F7A4D`, `--accent-deep: #143D2B`, `--accent-tint: #E8F5EE`, `--danger: #C23B22`, radii (`16px` cards, `999px` pills, `10px` inputs), shadow tokens (`0 1px 2px rgba(0,0,0,.04)` resting, `0 8px 24px rgba(0,0,0,.06)` hover-only), and motion-duration tokens (150–200ms) — plus `@import` rules pulling in the fontsource weight files (from T001) and a `@media (prefers-color-scheme: dark)` override block setting `--accent: #3DDC97`, per research.md §4/§7 (depends on T001)
- [X] T003 [P] In `app/src/styles/main.css`, removed the broken `@import url('https://fonts.googleapis.com/css2?family=Inter...&family=Clash+Display...')` line and the placeholder gray token block, added `@import url('/src/styles/tokens.css')` before the existing `tabs.css` import, and renamed every existing `var(--text)/--accent-light/--radius/--shadow-sm/--shadow-md` reference in the file to the new token names (`--ink`/`--accent-tint`/`--radius-card`/`--shadow-rest`/`--shadow-hover`) so nothing resolves to an undefined custom property, per research.md §4/§7

**Checkpoint**: Design tokens and self-hosted fonts exist; every subsequent CSS task consumes them.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Shared chrome that every screen (overview and every client-detail tab) renders under or inside

**⚠️ CRITICAL**: No user story work should be considered "done" for visual QA until this phase is complete, since every story's screens render inside this shell

- [X] T004 Rebuild the header in `app/index.html` + `app/src/styles/main.css`: solid `#0B0B0B` background bar (no gradient, replacing the current `linear-gradient` on `.app-header`), logo wrapped in `<a href="#/">`, 12px subtitle at `rgba(255,255,255,.72)`, a right-side "Coach workspace" chip (outline, white at 20% opacity), and a 2px `var(--accent)` hairline under the header — establishes the shared chrome supporting FR-019/FR-021 (depends on T002)
- [X] T005 [P] Create `app/src/components/client-hero.js` rendering a client's detail-page hero: display name as a large heading, a one-line "Goal · Level · Session length" meta row, and a quiet "← All clients" text button with a real inline-SVG chevron (no icon-font dependency, per research.md §7), per FR-005
- [X] T006 Wire `client-hero.js` into `app/src/views/customer-view.js`, rendering it above the tab navigation on every client detail page and replacing the current bare `<a class="back-link">`, per FR-005 (depends on T005)
- [X] T007 In `app/src/styles/main.css`, apply `tokens.css` custom properties to the shared layout rules (1080px page max-width, card radius/padding 20–24px/shadow, body type scale H1 32/38 · H2 22/28 · body 15/24 · meta 13/18) so both the overview and client-detail screens inherit the locked visual system (depends on T002, T004)

**Checkpoint**: Header, hero, and base layout tokens are in place — user story phases can now proceed.

---

## Phase 3: User Story 1 - Triage Clients at a Glance (Priority: P1) 🎯 MVP

**Goal**: The overview screen sorts clients by urgency and gives each a clear status pill and relative check-in date, so a coach knows who needs attention within 3 seconds.

**Independent Test**: Load the overview with a no-feedback client, an overdue (>7d) client, and an on-track client; confirm they render in that order with visually distinct pills, no manual sorting required.

- [X] T008 [P] [US1] Create `app/src/lib/status.js` exporting `deriveStatus(lastFeedbackDate, now)` → `"no-feedback" | "needs-checkin" | "on-track"`, per the 7-day-threshold rule in data-model.md → Status and FR-002
- [X] T009 [P] [US1] Unit test `app/tests/unit/status.test.js`: `null` date → `no-feedback`; date >7 days old → `needs-checkin`; date ≤7 days old → `on-track`; exact 7-day boundary → `on-track`, per contracts/overview-triage.md Acceptance Criteria (depends on T008)
- [X] T010 [US1] In `app/src/views/overview-view.js`, sort `data.customers` by status rank (`no-feedback`=0, `needs-checkin`=1, `on-track`=2), then `lastFeedbackDate` ascending, then `displayName` ascending as the stable tiebreaker, per FR-001 and contracts/overview-triage.md (depends on T008)
- [X] T011 [US1] In `app/src/views/overview-view.js`, add a client-count badge and a name-search input to the header row; typing filters the already-sorted rendered list by case-insensitive `displayName` substring match without re-sorting, per FR-003 (same file as T010, after it)
- [X] T012 [US1] In `app/src/views/overview-view.js`, replace the empty state ("No customers found under customers/.") with a single plain-language sentence and an actionable next step, with no filesystem/folder terminology, per FR-004 (same file as T011, after it)
- [X] T013 [P] [US1] In `app/src/components/customer-card.js`, render a 2-line-clamped goal, a relative "last check-in" phrase (e.g. "Today", "8d ago", "Never") derived from `lastFeedbackDate`, and exactly one status pill (green tint / amber / dashed-muted) using `deriveStatus()` from T008, per FR-002 (depends on T008)
- [X] T014 [P] [US1] In `app/src/styles/main.css`, style the overview grid (`grid-template-columns: repeat(auto-fill, minmax(320px, 1fr))`), equal 160px card min-height, hover state (2px lift + accent border at 40% opacity), and the three status-pill variants, using `tokens.css` custom properties
- [X] T015 [US1] Manual verification: run quickstart.md Scenario 1 (overview triage, including the temporarily-empty-clients empty-state check) (depends on T010–T014) — *confirmed live in browser: urgency sort, count badge, search field, and all three status pills render correctly; also caught and fixed a real dark-mode contrast bug (`--accent-deep` text was illegible against `--accent-tint` pill backgrounds) not anticipated by the original plan*

**Checkpoint**: User Story 1 is fully functional and independently testable.

---

## Phase 4: User Story 2 - Read a Client's Program Like a Workout Poster (Priority: P1)

**Goal**: Each training day renders as a card with scannable exercise rows (name, sets×reps, rest, optional form tip) instead of a wall of Markdown, in whichever language the program was authored.

**Independent Test**: Open a multi-day, multi-exercise program (Spanish or English) and confirm each day is its own card with distinct exercise rows, with authored text unchanged.

- [X] T016 [P] [US2] Extend `parseProgramDetail()` in `app/server/markdown-parser.js` to also emit `exercises: [{ name, setsReps, rest, formTip }]` per `TrainingDay`, matching numbered lines of the shape `N. **name** [(parenthetical)] - <sets x reps> - <Descanso|Rest> <duration>` plus an optional following `- Forma:`/`Form tip:` bullet — days with zero matching lines keep their existing `html` and get `exercises: []` — per contracts/exercise-row-parsing.md and data-model.md → Exercise
- [X] T017 [P] [US2] Unit tests in `app/tests/unit/markdown-parser.test.js`: a Spanish fixture matching `customers/jaqueline-orellano/program.md`'s Monday block (`Descanso`/`Forma`), an English fixture matching `customers/topiltzin-flores/program.md`'s Monday block (`Rest`/`Form tip`), and a no-match rest-day fixture asserting `exercises: []` with `html` still populated, per contracts/exercise-row-parsing.md Testing Checklist (depends on T016)
- [X] T018 [P] [US2] Extend `app/tests/integration/customer-detail.test.js` to assert `program.weeklySchedule[0].exercises` is present and non-empty for the test fixture program, per contracts/exercise-row-parsing.md Testing Checklist (depends on T016)
- [X] T019 [P] [US2] Create `app/src/components/program-day.js` rendering one `TrainingDay` as a card: left accent rail, day name + focus as the title, and one row per exercise (name · setsReps pill · rest in muted text) — falling back to rendering the day's existing `html` when `exercises.length === 0`, per FR-009
- [X] T020 [US2] In `app/src/components/program-day.js`, add a per-exercise form-tip disclosure (smaller muted text under the row, or a toggle) shown only when `formTip` is non-null, per FR-010 (same file as T019, after it)
- [X] T021 [US2] Wire `program-day.js` into the Program tab's rendering — replacing `renderProgramContent()` in `app/src/components/tab-container.js` — ensuring authored Spanish/English exercise text renders exactly as written, per FR-009/FR-011 (depends on T019, T020)
- [X] T022 [US2] Add a sticky day sub-navigation (day-name chips that jump-scroll to each day's card) shown when a program has more than one day, in `program-day.js`/`customer-view.js`, per FR-012 (depends on T021)
- [X] T023 [P] [US2] Style program-day cards, exercise rows, sets×reps pills, and sub-nav chips in `app/src/styles/main.css` using `tokens.css` (green rail = `var(--accent)`, rest text = `var(--muted)`)
- [X] T024 [US2] Manual verification: run quickstart.md Scenario 5 (both Spanish and English program fixtures) and the day-sub-navigation portion of Scenario 4 (depends on T021–T023) — *confirmed live in browser for both `jaqueline-orellano` (Spanish) and `topiltzin-flores` (English): day cards, exercise rows with sets×reps pills and muted rest/form-tip text, and the sticky day chips all render correctly. Also caught and fixed a real bug: the sticky day-subnav and the sticky tab bar both used `top: 0`, colliding with the app header and disappearing behind it on scroll — fixed with `--header-height`/`--tab-header-height` offset tokens*

**Checkpoint**: User Stories 1 AND 2 both work independently.

---

## Phase 5: User Story 3 - Log a Session and See It Land in Feedback (Priority: P1)

**Goal**: Saving a session shows a confirmation and hands the coach off to the Feedback tab, whose stats and the Notes tab show only real data — never fabricated placeholder text.

**Independent Test**: Submit a session log and confirm a success toast appears, the view auto-switches to Feedback with the new entry visible, and stat tiles/Notes reflect only real data (or an honest empty state).

- [X] T025 [P] [US3] Create `app/src/components/toast.js` exporting `showToast(message)`, which appends a transient `role="status"` element and auto-removes it after ~2s, per research.md §9
- [X] T026 [US3] In `app/src/views/customer-view.js`'s `onFeedbackAdded` callback, call `showToast('Saved · view in Feedback')` and set the rebuilt `TabContainer`'s active tab explicitly to `feedback` (not the default-first-enabled tab), per FR-016 and contracts/feedback-honesty-and-stats.md (depends on T025)
- [X] T027 [US3] Delete the `history` tab entirely — its config entry and `contentType` in `buildTabConfig()`/`buildTabData()` in `app/src/views/customer-view.js`, and `renderHistoryContent()` (with its hardcoded `historyData.highlights` array: `'Program is progressing well'`, `'Consistent session completion'`) in `app/src/components/tab-container.js` — per FR-006/FR-017 and research.md §3 (same two files as T026, after it)
- [X] T028 [US3] Delete the synthetic notes `{ observations, recommendations }` shape and its hardcoded strings (`"Customer showing good progress"`, `"Continue with current program"`) from `buildTabData()` in `app/src/views/customer-view.js`; render `notes.html` directly in `renderNotesContent()` in `app/src/components/tab-container.js` when `notes.present`, and a dashed empty-state card otherwise, per FR-017/FR-018 (same files as T027, after it)
- [X] T029 [US3] Add a Feedback-tab stat strip (Completion %, Last session, Average difficulty) to `renderFeedbackContent()` in `app/src/components/tab-container.js`, computed from `feedback.trend`/`feedback.entries` per data-model.md → Feedback Stats, with each tile showing an explicit empty state when its value is null/absent, per FR-013 (same file as T028, after it)
- [X] T030 [P] [US3] In `app/src/components/trend-chart.js`, widen the bar rectangles, add a 2-item legend (Completed/Missed), and enlarge the date-label text, per FR-014
- [X] T031 [P] [US3] Restyle entries in `app/src/components/feedback-entry.js` as cards with a bold date, session label, and a 2×2 fact grid (Felt / Completed / Difficulty / Notes)
- [X] T032 [P] [US3] In `app/src/views/feedback-form-view.js` and `app/src/styles/main.css`, increase input height to ≥48px, make the submit button full-width at mobile widths, and remove the extra `.card` wrapper chrome around the form, per FR-015
- [X] T033 [US3] Manual verification: run quickstart.md Scenario 2 (log session → toast → Feedback hand-off) and Scenario 6 (notes/stats honesty, including the repo-wide placeholder-string grep) (depends on T026–T032) — *partially confirmed live in browser: the stat strip renders real completion %/last session and an honest "Not enough data yet" for average difficulty when the logged entry's difficulty text doesn't match the known vocabulary (verified against real API data). The browser session was stopped by the user before submitting the log-session form itself, so the toast + auto-switch-to-Feedback hand-off (T026) was verified by code review only, not visually. The placeholder-string grep (see T043) confirms zero matches.*

**Checkpoint**: User Stories 1, 2, AND 3 all work independently.

---

## Phase 6: User Story 4 - Navigate a Client's Tabs Without Getting Lost (Priority: P2)

**Goal**: The tab bar always defaults sensibly, supports arrow-key navigation, and the page never traps scroll inside a nested panel.

**Independent Test**: Open a client detail page fresh, confirm a tab auto-selects without a blank state, switch tabs via arrow keys, and confirm scrolling a long tab scrolls the whole page.

- [X] T034 [US4] In `buildTabConfig()` in `app/src/views/customer-view.js`, rename the `add-entry` tab's label from "Add Entry" to "Log Session", per FR-006 and User Story 4's named tab set (depends on T027–T029 touching the same file)
- [X] T035 [US4] In `app/src/components/tab-container.js`, replace the hardcoded `this.activeTabId = 'program'` with selection of the first tab (in order) whose `isEnabled` is `true`, per FR-007 and contracts/tab-navigation.md (same file as T027–T029, after them)
- [X] T036 [US4] In `app/src/components/tab-container.js`'s `createTabHeader()`/`attachEventListeners()`, add an `ArrowLeft`/`ArrowRight` keydown handler on the `role="tablist"` header that moves selection and focus to the previous/next *enabled* tab, wrapping at the ends, per FR-007 and contracts/tab-navigation.md (same file as T035, after it)
- [X] T037 [P] [US4] In `app/src/styles/tabs.css`, remove the `max-height: calc(100vh - 200px); overflow-y: auto` rule and its responsive variants (`calc(100vh - 180px)`, `calc(100vh - 160px)`) from the tab-panels container, so the client detail page scrolls as one surface, per FR-008 and research.md §6
- [X] T038 [US4] In `app/src/styles/tabs.css`, style the tab bar as a segmented control on a white bar: inactive = `var(--muted)` text, active = `var(--ink)` text with a 3px `var(--accent)` underline, per the locked visual system (same file as T037, after it)
- [X] T039 [US4] Manual verification: run quickstart.md Scenario 3 (tab default + keyboard nav) and Scenario 4 (single-surface scroll on `jaqueline-orellano`'s program) (depends on T034–T038) — *confirmed live in browser: segmented-control tab styling (active = black text + green underline), the Program tab defaulting correctly, and single-surface scroll (header → tabs → day-subnav → program cards, no nested scroll trap) all verified after the sticky-offset fix from T024. Arrow-key navigation (T036) and the "Program disabled → defaults to Feedback" case were verified by code review only — the browser session was stopped before those specific interactions were exercised.*

**Checkpoint**: All four user stories are independently functional.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Verify the requirements that span every story (single accent, responsive viewport, dark mode, and the honesty guarantee)

- [X] T040 [P] Audit `app/src/styles/*.css` for any remaining color values outside `tokens.css`'s custom properties, ensuring exactly one accent color drives all status/progress signaling across the whole interface, per FR-019 — *grep audit found 3 stray literal hex groups: the needs-checkin pill, and the error-banner. Tokenized both as `--warning-tint`/`--warning-deep` and `--danger-tint`/`--danger-border` (paired with the existing `--danger`), with dark-mode overrides added alongside the T042 fix. The one remaining literal (`#fff` on the toast) is intentional — the toast, like the header, is always-dark chrome regardless of theme, matching the existing header text pattern.*
- [X] T041 Verify and adjust responsive behavior across `app/src/styles/main.css` and `app/src/styles/tabs.css` so the overview grid, hero, tabs, and log-session form remain usable with no horizontal scroll at ~390px and ~1280px, per FR-020/SC-005 (depends on T040) — *static review found a real overflow risk at narrow widths: the header's logo+subtitle+chip and the overview's title+badge+search row would not fit in ~342px of available width. Fixed via a ≤480px media query: the "Coach workspace" chip hides, the page-header stacks vertically, and the search input goes full-width. Not re-verified with an actual 390px screenshot — the browser session was stopped by the user mid-verification (see T045).*
- [X] T042 Confirm the `@media (prefers-color-scheme: dark)` block in `tokens.css` sets `--accent: #3DDC97` and spot-check status pills, the program-day accent rail, and trend-chart bars remain legible against dark surfaces, per FR-021 — *found and fixed a real bug live in the browser: `--accent-deep` (pill/badge text) was left at the light-mode dark-green shade in the dark override, making "ON TRACK" pill text nearly invisible against the dark `--accent-tint` background. Fixed by setting dark-mode `--accent-deep` to the bright `--accent` value itself, and applied the same light-on-dark fix to the new warning/danger tint tokens from T040.*
- [X] T043 [P] Run `grep -rn "showing good progress\|Continue with current program\|Program is progressing well\|Consistent session completion" app/src` and confirm zero matches, per SC-004 — *confirmed: zero matches.*
- [X] T044 [P] Run `cd app && npm test` and confirm all unit/integration tests pass, including the new `status.test.js` and extended `markdown-parser.test.js`/`customer-detail.test.js` cases — *19/20 pass. The 1 failure (`round-trips a real, unmodified entry from topiltzin-flores/feedback.md exactly`) is pre-existing and unrelated to this feature: real usage since that test was written added a second logged entry to that customer's `feedback.md`, so the fixture no longer matches the test's "exactly one entry" assumption. Confirmed via `git status` that this feature never touched `customers/` or that test file, and confirmed via the API that the second entry is real (`id: 9`, unmatched/blank fields) rather than something this feature introduced.*
- [ ] T045 Execute the full `quickstart.md` scenario list end-to-end at both ~390px and ~1280px viewport widths and record any deviations (depends on T041–T044 and all prior phases) — **not completed**: the user interrupted the browser-verification session ("cancel claude-in-chrome dont do it") before this final full pass could run. Everything up through most of Scenario 4 was verified live (see T015/T024/T033/T039 notes above, including two real bugs found and fixed); a follow-up session with browser access should run the remaining quickstart scenarios (especially the log-session submit flow, keyboard arrow navigation, and both viewport widths) end-to-end.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately.
- **Foundational (Phase 2)**: Depends on Setup (needs `tokens.css` from T002) — blocks all user stories' visual QA.
- **User Stories (Phase 3–6)**: All depend on Foundational completion for shared chrome; each story is independently testable per its own Independent Test criterion above.
- **Polish (Phase 7)**: Depends on all four user stories being complete.

### User Story Dependencies

- **US1 (P1)**: Independent of US2/US3/US4 — only needs Foundational.
- **US2 (P1)**: Independent of US1/US3/US4 — only needs Foundational.
- **US3 (P1)**: Independent of US1/US2 — only needs Foundational. Note: US3 and US4 both edit `customer-view.js`/`tab-container.js`, so if implemented by different people they must serialize on those two files (US3's edits, T026–T029, precede US4's, T034–T036, in task numbering for exactly this reason).
- **US4 (P2)**: Builds on the same two files US3 touches (see above); independently *testable* per its own acceptance scenarios regardless of implementation order.

### Parallel Opportunities

- Setup: T001 and T003 in parallel; T002 depends on T001.
- Foundational: T005 in parallel with T004.
- US1: T009, T013, T014 in parallel (after T008); T010→T011→T012 sequential (same file).
- US2: T016, T017, T018, T019, T023 in parallel (T017/T018 depend on T016 being defined but touch different files); T020→T021→T022 sequential (shared file/dependency chain).
- US3: T030, T031, T032 in parallel with the T026→T027→T028→T029 chain (different files).
- US4: T037 in parallel with the T034→T035→T036 chain (different file); T038 sequential after T037 (same file).
- Polish: T040, T043, T044 in parallel; T041 after T040; T042 independent but touches the same file as T040 (`tokens.css` vs `*.css` broadly) — sequence if worked solo.

---

## Parallel Example: User Story 1

```bash
# After T008 (status.js) is done, run these together:
Task: "Unit test app/tests/unit/status.test.js"
Task: "Update app/src/components/customer-card.js for status pill + relative date"
Task: "Style overview grid/card/pill variants in app/src/styles/main.css"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational
3. Complete Phase 3: User Story 1
4. **STOP and VALIDATE**: run quickstart.md Scenario 1 independently
5. This alone already delivers the brief's top ship-checklist item ("Overview shows urgency sorting + status pills")

### Incremental Delivery

1. Setup + Foundational → shared chrome ready
2. User Story 1 → validate → this is the MVP (triage command center)
3. User Story 2 → validate → program tab now reads as workout cards
4. User Story 3 → validate → logging feels fast, no fake content anywhere
5. User Story 4 → validate → tab navigation is bug-free and keyboardable
6. Polish → cross-cutting checks (accent, viewport, dark mode, automated tests, full quickstart)

### Parallel Team Strategy

With multiple people: complete Setup + Foundational together first (both are small). US1 and
US2 touch entirely disjoint files from each other and can run fully in parallel. US3 and US4
share two files (`customer-view.js`, `tab-container.js`) — assign both to the same person, or
hand US4 to whoever finishes US3's edits to those files, to avoid merge conflicts.

---

## Notes

- [P] tasks = different files, no dependency on an unfinished task
- [Story] label maps each task to its user story for traceability; Setup/Foundational/Polish tasks carry none, per the format rules
- This feature deliberately has three P1 stories (US1–US3) because each independently delivers
  a distinct "wow" moment from the brief (triage, program cards, honest logging); US4 (P2) is
  the connective tissue that makes all three feel finished
- Commit after each task or logical group
- Stop at any checkpoint to validate a story independently before continuing
