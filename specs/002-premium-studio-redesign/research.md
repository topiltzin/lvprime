# Research: Premium Studio Visual Redesign

**Feature**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md)

This feature's Technical Context had no unresolved `NEEDS CLARIFICATION` markers — the source
brief and the existing `app/` codebase together supplied enough grounding to make every
decision below directly. Each decision was checked against the actual current implementation
(cited by file/line) rather than assumed.

## 1. Structured exercise rows from freeform, bilingual Markdown

**Decision**: Extend `parseProgramDetail()` (`app/server/markdown-parser.js`) to additionally
emit an `exercises: [{ name, setsReps, rest, formTip }]` array per day, parsed with a regex
over the existing numbered-list pattern, while still keeping today's `html` field on each day
as a fallback.

**Rationale**: Both real customer files already follow one consistent pattern regardless of
authored language:

```
1. **Exercise Name** (optional parenthetical) - 3 x 8-10 - Descanso 90-120 seg
   - Forma: <tip>
```
```
1. **Barbell Bench Press** - 4 × 6-8 reps - Rest 2 min
   - Form tip: <tip>
```

(see `customers/jaqueline-orellano/program.md` lines 46–54 and
`customers/topiltzin-flores/program.md` lines 22–29). `markdown-parser.js` already solves the
"same file family, different authored fields" problem this way for feedback entries
(`extractFeedbackTemplate`/`SYNONYMS`), so extending the same regex-plus-fallback philosophy to
exercises is consistent with the file's existing design, not a new approach.

**Alternatives considered**:
- *Require coaches to re-author programs in a stricter structured format* — rejected: violates
  Constitution Principle I/III (existing customer files must not be forced to change) and adds
  coaching friction for no user-facing benefit.
- *Parse the already-rendered HTML string on the client* — rejected: duplicates parsing logic
  in two places and is fragile to incidental Markdown-renderer output changes; parsing the
  source Markdown once, server-side, is strictly simpler.
- *Full NLP/LLM-based extraction* — rejected: non-deterministic and unnecessary given the
  existing pattern is already regular and machine-parseable.

**Fallback rule**: If a day's body contains zero lines matching the exercise pattern, the
Program tab renders that day's existing `html` block unchanged (never an empty card) —
satisfies the "unusually large/irregular program" edge case and Principle I ("never lose
content").

## 2. Client urgency/status derivation

**Decision**: Compute the three-state status (`no-feedback` / `needs-checkin` / `on-track`)
purely from the `lastFeedbackDate` string already present on the customer summary
(`toCustomerSummary()` in `app/server/index.js` line 55; sourced from `customers.last_feedback_date`
in `app/server/db.js`). No new column, index, or endpoint.

**Rationale**: The 7-day threshold (spec FR-002) is a presentation rule, not a data-layer
concern — keeping it in the overview view code (as a pure function of "now" and the existing
date string) means it can be read and adjusted without touching the SQLite schema or the
indexer.

**Alternatives considered**:
- *Precompute and store a `status` column server-side* — rejected as premature indirection; the
  raw date is already returned on every `GET /api/customers` call, and computing status from it
  is O(1) per card.

## 3. Collapsing "History" into the Feedback tab

**Decision**: The Feedback tab's stat strip (completion %, last session, average difficulty)
is computed directly from the already-returned `feedback.trend` (`completionRate`,
`points[].difficultyScore`) and `feedback.entries` (most recent `date`) — see
`getFeedbackTrend()` in `app/server/db.js` lines 148–161. The separate History tab, and its
hardcoded `historyData.highlights` array (`['Program is progressing well', 'Consistent session
completion']` in `app/src/views/customer-view.js` line 116), are deleted outright.

**Rationale**: This is the direct fix for both "merge History stats into Feedback" (Step 4) and
"no fake highlights" (ship checklist) in one move — the underlying numbers already exist, only
the tab that displayed fabricated prose around them goes away.

**Alternatives considered**: Keep History as a tab but strip only its fake highlights —
rejected; the brief caps the IA at 4 tabs (Program, Feedback, Log Session, Notes) and a
stats-only History tab would just duplicate the Feedback tab's top strip.

## 4. Self-hosting the type system

**Decision**: Self-host Inter (variable weights 400–700) and Inter Tight (700, for the
logo/H1 display treatment) as static font files under `app/fonts/`, served by Vite, and remove
the `@import url('https://fonts.googleapis.com/css2?family=Inter...&family=Clash+Display...')`
line currently at `app/src/styles/main.css` line 2 entirely.

**Rationale**: The brief explicitly reports that the Clash Display Google Fonts import "often
fails," and this is a local-only tool (per the existing `api-client.js` "no auth, no CORS —
same-origin local tool" comment) — a runtime dependency on an external font CDN is both
unreliable and inconsistent with that local-only posture.

**Alternatives considered**:
- *Keep Google Fonts for Inter only, drop just Clash Display* — rejected; still leaves a
  network dependency for something that should work fully offline.
- *System font stack only, no display face* — rejected; the brief specifies a distinct
  tracked/bold logo and H1 treatment (Inter Tight, −0.02em tracking) that generic system stacks
  can't reproduce consistently across OSes.

## 5. Tab default + keyboard navigation fix

**Decision**: Change `TabContainer`'s hardcoded `this.activeTabId = 'program'`
(`app/src/components/tab-container.js` line 11) to select the first tab in `tabs` whose
`isEnabled` is `true`. Add a `keydown` listener on the `role="tablist"` header that moves
selection to the previous/next *enabled* tab on `ArrowLeft`/`ArrowRight` (wrapping at the ends)
and moves focus to match, reusing the `role="tab"`/`aria-selected` markup already in place
(lines 58–60).

**Rationale**: Today, if the Program tab is disabled (no program yet) but other tabs are
enabled, `setActiveTab('program')` silently leaves every tab unselected and every panel
hidden — a real bug the brief calls out ("Default to first enabled tab (bug fix + polish)").
Arrow-key support is the other explicit requirement and fits directly into the existing
`attachEventListeners()` method.

**Alternatives considered**: None seriously — this is a scoped, named bug fix plus a named
missing behavior, not a design choice with real alternatives.

## 6. Removing the nested-scroll trap

**Decision**: Remove the `max-height: calc(100vh - 200px); overflow-y: auto` rule (and its
responsive variants at `calc(100vh - 180px)` / `calc(100vh - 160px)`) currently applied to the
tab-panels container in `app/src/styles/tabs.css` (lines 64–66, 271, 288), so the customer
detail page scrolls as a single surface. The Program tab's day sub-navigation (spec FR-012)
jumps via in-page anchors/`scrollIntoView` rather than scrolling an inner panel.

**Rationale**: This is the literal, present-in-code version of the brief's "kill nested-scroll
panels ... let the page scroll once" requirement — confirmed by inspecting `tabs.css` directly
rather than assumed.

**Alternatives considered**: Raise the `max-height` ceiling instead of removing it — rejected;
that only delays the trap, it doesn't eliminate it, and doesn't satisfy "the page scrolls once."

## 7. Implementing the locked visual system

**Decision**: Add a new `app/src/styles/tokens.css` defining the brief's full palette
(`--bg`, `--surface`, `--ink`, `--muted`, `--border`, `--accent`/`--accent-deep`/`--accent-tint`,
`--danger`), type scale, spacing/radius/shadow, and motion-duration custom properties on
`:root`; `main.css` imports it and is updated to consume these names in place of its current
placeholder grays (`--bg: #f5f5f5`, `--accent: #333333`, etc. — `main.css` lines 4–19). The
existing `@media (prefers-color-scheme: dark)` block (lines 22–32) is kept as the mechanism for
dark mode, only its `--accent` value changes to `#3DDC97` per the brief.

**Rationale**: The app already uses exactly this `:root` + dark-media-override token pattern —
extending it keeps the change additive and avoids introducing a second theming mechanism (e.g.,
a CSS-in-JS layer or a design-system package) for what a dozen custom properties already cover.

**Alternatives considered**: Adopt a UI/design-system library — rejected as disproportionate
for a small local vanilla-JS tool, and not requested by the brief.

## 8. Trend chart upgrade

**Decision**: Extend the existing hand-drawn inline SVG in `app/src/components/trend-chart.js`
(no charting library) — widen the bar rectangles, add a small `<g>` legend mapping the two bar
colors to "Completed"/"Missed", and increase the date-label font size/spacing so labels stay
readable as bars widen.

**Rationale**: The file already documents "no charting library" as a deliberate choice; the
brief's ask (thicker bars, legend, readable labels) is additive styling on the same SVG
structure, not a reason to introduce a dependency.

**Alternatives considered**: Adopt a charting library (e.g., Chart.js) — rejected; unnecessary
for one simple bar-per-session view and against the file's stated design intent.

## 9. Save-session confirmation + tab hand-off

**Decision**: On a successful `submitFeedback()` call, show a small dependency-free toast
(a `role="status"` element appended to the DOM and auto-removed after ~2s) and explicitly set
`TabContainer`'s active tab to `feedback` (rather than re-constructing with the default tab),
reusing the existing `onFeedbackAdded` success callback in `app/src/views/customer-view.js`
(lines 197–215).

**Rationale**: The data-refresh flow (`onFeedbackAdded` → re-fetch → rebuild `TabContainer`)
already exists and works; only the post-success UI behavior (confirmation + which tab ends up
active) needs to change, so no new dependency or endpoint is justified.

**Alternatives considered**: A full toast/notification library — rejected; one transient,
auto-dismissing message doesn't warrant a dependency.

## 10. Test strategy for a UI-heavy, DOM-test-free codebase

**Decision**: New automated tests are added only where the codebase already has test
infrastructure — `app/tests/unit/markdown-parser.test.js` gets cases for the new
exercise-extraction logic (Spanish and English input, and the no-match fallback), and
`app/tests/integration/customer-detail.test.js` gets an assertion that `exercises[]` is present
per day in the API response. Tab-default/keyboard-nav, motion timing, and visual-token
requirements (which have no DOM test harness to attach to — `app/tests/` has no jsdom/happy-dom
dependency today) are verified manually via the scenarios in `quickstart.md`.

**Rationale**: Introducing a browser/DOM test framework is out of scope for a visual redesign
brief and would be a disproportionate new dependency; the parts of this feature that are
genuinely data/logic (exercise parsing, status derivation) are exactly the parts the existing
`node --test` setup can cover.

**Alternatives considered**: Add jsdom/happy-dom + a DOM assertion library to unit-test
`TabContainer` — rejected for this feature; flagged as a reasonable *future* improvement but not
required to satisfy this spec's acceptance scenarios, which quickstart.md can verify manually.
