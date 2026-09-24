---

description: "Task list for the LvPrime rebrand"
---

# Tasks: LvPrime Rebrand

**Input**: Design documents from `/specs/011-lvprime-rebrand/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/ (brand-tokens.md, header-lockup.md, pdf-brand.md), quickstart.md

**Tests**: Included. The plan (research R8, contracts/pdf-brand.md "Tests") calls for `app/tests/unit/brand.test.js`; visual checks follow quickstart.md.

**Organization**: Tasks are grouped by user story so each can be implemented and verified on its own.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: US1 to US4 from spec.md
- All paths are relative to the repository root. The web app lives in `app/`.

## Design references (read before any task)

- Visual master: `design/brand/brand-sheet.png` and `design/brand/brand-sheet.html`
- Mark geometry (64 grid): L polyline (18,16)→(18,46)→(34,46); V left arm (25,26)→(34,46); rising stroke (34,46)→(47,16) in Brass; stroke width 5, round caps and joins; tile radius 15. Masters: `design/brand/mark.svg`, `mark-on-dark.svg`, `mark-mono.svg`
- Palette and remap tables: `specs/011-lvprime-rebrand/data-model.md`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Dependencies and folders

- [X] T001 Add `@fontsource/fraunces@^5.3.0` and remove `@fontsource/inter-tight` in `app/package.json`, then run `npm install` in `app/` so `app/package-lock.json` updates
- [X] T002 [P] Create the static assets folder `app/public/` (Vite serves it at `/`; no config change needed since `vite.config.js` uses `root: '.'`)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Tokens and font every story depends on (contract: `contracts/brand-tokens.md`)

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T003 In `app/src/styles/tokens.css`, replace `@import '@fontsource/inter-tight/700.css';` with `@import '@fontsource/fraunces/500.css';`, `@import '@fontsource/fraunces/600.css';` and `@import '@fontsource/fraunces/500-italic.css';`, and set `--font-display: 'Fraunces', Georgia, 'Times New Roman', serif;`
- [X] T004 In `app/src/styles/tokens.css` `:root`, add `--brand-evergreen: #16352A; --brand-evergreen-deep: #0E231C; --brand-brass: #C9A46A; --brand-brass-on-light: #9C7A43; --brand-ivory: #F5F1EA; --brand-stone: #E6E0D5;`
- [X] T005 In `app/src/styles/tokens.css` `:root`, remap light values: `--bg: var(--brand-ivory)`, `--ink: #141412`, `--muted: #6B675E`, `--border: var(--brand-stone)`, `--muted-bg: #EDE8DF`, `--header-bg: var(--brand-evergreen)`. Do NOT change `--accent*`, `--danger*`, `--warning*` or `--chart-*` ("Values of `--accent*`, `--danger*`, `--warning*`, `--chart-*` are unchanged in both schemes")
- [X] T006 In the `@media (prefers-color-scheme: dark)` block of `app/src/styles/tokens.css`, set `--bg: #121614; --surface: #1B201D; --ink: #F0EDE6; --muted: #A9ADA6; --border: #2C332F; --muted-bg: #242A26; --brand-brass-on-light: #C9A46A;`, leaving every accent, danger and warning override exactly as it is

**Checkpoint**: `npm run dev` shows the Ivory page and the Evergreen header with the old text; status colours unchanged

---

## Phase 3: User Story 1 - Coach sees the LvPrime identity in the app shell (Priority: P1) 🎯 MVP

**Goal**: Header lock-up, tab title and icons show LvPrime; no "Lv Fitness" remains in the shell (contract: `contracts/header-lockup.md`)

**Independent Test**: Load overview, customer and feedback views; header matches the brand sheet "App header" panel; tab reads "LvPrime · Coach workspace" with the LvPrime icon

### Tests for User Story 1

- [X] T007 [P] [US1] Create `app/tests/unit/brand.test.js` with a test that reads `app/index.html` and every `.js`/`.css` file under `app/src/` (via `node:fs` and `node:path`, relative to `import.meta.url`) and asserts none contains "Lv Fitness", "Personalized Training" or "Lili Trainer"; also assert `app/index.html` contains `<title>LvPrime` (expected to fail until T008 and T025)

### Implementation for User Story 1

- [X] T008 [US1] In `app/index.html`, set `<title>LvPrime · Coach workspace</title>` and add in `<head>`: `<link rel="icon" href="/favicon.svg" type="image/svg+xml">`, `<link rel="icon" href="/favicon-32.png" sizes="32x32" type="image/png">`, `<link rel="apple-touch-icon" href="/apple-touch-icon.png">`, `<link rel="manifest" href="/site.webmanifest">`, `<meta name="theme-color" content="#16352A">`
- [X] T009 [US1] In `app/index.html`, replace the `.logo` anchor contents with the markup in `contracts/header-lockup.md`: `aria-label="LvPrime, go to overview"`; inline `<svg class="logo-mark" viewBox="0 0 64 64" aria-hidden="true" focusable="false">` containing a `rect` (x=1 y=1 w=62 h=62 rx=14, class `mark-tile`), path `M18 16V46H34` and path `M25 26L34 46` (class `mark-ink`), path `M34 46L47 16` (class `mark-rise`), all strokes width 5 with round caps and joins; then `<span class="logo-lockup"><span class="logo-text">Lv<em>Prime</em></span><span class="logo-subtitle">Personal training · 40+</span></span>`. Keep `<span class="header-chip">Coach workspace</span>`
- [X] T010 [US1] In `app/src/styles/main.css`, add mark styling driven by variables: `.logo-mark { --mark-tile: var(--brand-evergreen-deep); --mark-hairline: var(--brand-brass); --mark-ink: var(--brand-ivory); --mark-rise: var(--brand-brass); width: 40px; height: 40px; flex: none; }`, `.mark-tile { fill: var(--mark-tile); stroke: var(--mark-hairline); stroke-opacity: .55; stroke-width: 1.5; }`, `.mark-ink { stroke: var(--mark-ink); fill: none; }`, `.mark-rise { stroke: var(--mark-rise); fill: none; }`
- [X] T011 [US1] In `app/src/styles/main.css`, update the brand shell: `.app-header` `border-bottom: 2px solid var(--brand-brass)`; `.logo` becomes `flex-direction: row; align-items: center; gap: 0.75rem`; add `.logo-lockup { display: flex; flex-direction: column; gap: 0.25rem; }`; `.logo-text` uses `var(--font-display)`, weight 600, `font-size: 1.875rem`, `line-height: 1`, colour `var(--brand-ivory)`; `.logo-text em { font-style: italic; font-weight: 500; color: var(--brand-brass); }`; `.logo-subtitle` Inter 600, `font-size: 0.625rem`, `text-transform: uppercase`, `letter-spacing: 0.26em`, `color: rgba(245, 241, 234, 0.72)`; `.header-chip` colour `rgba(245, 241, 234, 0.72)`. Keep `--header-height` so the header cannot shift on font load
- [X] T012 [US1] In the existing `@media (max-width: 480px)` block at ~line 467 of `app/src/styles/main.css`, add: `.logo-mark { width: 32px; height: 32px; }`, `.logo-text { font-size: 1.375rem; }`, `.logo-subtitle, .header-chip { display: none; }`
- [X] T013 [P] [US1] Create `app/public/favicon.svg`: small-size mark on a 64 grid: `rect` 0,0,64,64 rx 15 fill #16352A; path `M18 14V48H34` stroke #F5F1EA; path `M34 48L48 14` stroke #C9A46A; stroke-width 7, round caps and joins; no V left arm (research R4)
- [X] T014 [P] [US1] Create `app/public/site.webmanifest` with `{"name":"LvPrime","short_name":"LvPrime","icons":[{"src":"/icon-192.png","sizes":"192x192","type":"image/png"},{"src":"/icon-512.png","sizes":"512x512","type":"image/png"}],"theme_color":"#16352A","background_color":"#F5F1EA","display":"standalone","start_url":"/"}`
- [X] T015 [US1] Rasterise PNG icons into `app/public/`: `favicon-32.png` from `app/public/favicon.svg`; `apple-touch-icon.png` (180), `icon-192.png`, `icon-512.png` from `design/brand/mark.svg`. Use a throwaway HTML page per size rendered with headless Chrome (`--screenshot --window-size=N,N --default-background-color=00000000`); in this WSL environment use `/mnt/c/Program Files/Google/Chrome/Application/chrome.exe` with a `wslpath -w` output path. Open each PNG and confirm dimensions and a crisp mark

**Checkpoint**: US1 fully visible; T007 passes except the PDF author string (fixed in T025)

---

## Phase 4: User Story 2 - Pages use the LvPrime palette and type without changing meaning (Priority: P1)

**Goal**: Serif headings, Ivory/Stone/Ink everywhere, dark mode legible, status colours unchanged (contract: `contracts/brand-tokens.md`)

**Independent Test**: Compare overview, customer and feedback views before and after in light and dark; chart and badge colours identical

### Implementation for User Story 2

- [X] T016 [US2] In `app/src/styles/main.css` heading rules (~lines 88 to 105): set `h1, h2 { font-family: var(--font-display); font-weight: 500; letter-spacing: -0.01em; }`, keeping `h1` size/line tokens (remove its `font-weight: 700`) and leaving `h3` on the body font
- [X] T017 [P] [US2] Audit `app/src/styles/tabs.css`: `.nutrition-body h1` and `.nutrition-body h2` (~lines 110 and 126) use `var(--font-display)` weight 500; replace any hard-coded hex colour with the matching semantic token from `tokens.css`
- [X] T018 [US2] Audit hard-coded colours in `app/src/styles/main.css`: the `rgba(255,255,255,0.72)` values at ~lines 59 and 69 are already handled by T011; leave the chart hatch `rgba(255,255,255,0.7)` (~line 630) unchanged; `.toast` (~line 783) keeps `color: #fff` on `--header-bg` (now Evergreen, 12:1). Confirm no rule uses `--brand-brass` or `--brand-brass-on-light` outside `.app-header`, `.logo*`, `.logo-mark`, `.login-brand` ("Brass tokens MUST NOT be referenced by any selector for buttons, links, tabs, chips, form controls, status badges or charts")
- [X] T019 [US2] Add a test to `app/tests/unit/brand.test.js` that parses `app/src/styles/tokens.css` and asserts the `:root` and dark-scheme values of `--accent`, `--accent-hover`, `--accent-deep`, `--accent-tint`, `--accent-contrast`, `--danger`, `--danger-tint`, `--danger-border`, `--warning-deep`, `--warning-tint` equal their pre-change values (light `#1f7a4d`, `#186a42`, `#143d2b`, `#e8f5ee`, `#ffffff`, `#c23b22`, `#fee2e2`, `#fca5a5`, `#8a5a1c`, `#fdf0e2`; dark per current file), guarding SC-003

**Checkpoint**: US1 and US2 together deliver the full on-screen rebrand

---

## Phase 5: User Story 3 - Sign-in view carries the brand (Priority: P2)

**Goal**: On-light lock-up and tagline above the sign-in form

**Independent Test**: Sign out, reload; lock-up and "Strength for the decades ahead." visible; wrong password still shows "Wrong password."

### Implementation for User Story 3

- [X] T020 [US3] In `app/src/views/login-view.js`, before the `Coach sign-in` heading, build a `div.login-brand` containing: an SVG created with `document.createElementNS('http://www.w3.org/2000/svg', …)` with class `logo-mark login-mark`, same geometry and classes as T009; `p.login-wordmark` with text "Lv" plus an `em` "Prime" (use `textContent`, never `innerHTML`); `p.login-tagline` "Strength for the decades ahead." Do not change form, error or submit logic
- [X] T021 [US3] In `app/src/styles/main.css` near `.login-wrap` (~line 694), add `.login-brand { display: flex; flex-direction: column; align-items: center; gap: 0.5rem; margin-bottom: 1.5rem; text-align: center; }`, `.login-mark { --mark-tile: var(--brand-evergreen); --mark-hairline: transparent; width: 56px; height: 56px; }`, `.login-wordmark { font-family: var(--font-display); font-weight: 600; font-size: 2.25rem; line-height: 1; color: var(--ink); margin: 0; }`, `.login-wordmark em { font-style: italic; font-weight: 500; color: var(--brand-brass-on-light); }` ("`--brand-brass-on-light` ... ≥24px only"), `.login-tagline { font-family: var(--font-display); font-style: italic; font-weight: 500; font-size: 1.125rem; color: var(--muted); margin: 0; }`

**Checkpoint**: Sign-in branded; behaviour unchanged

---

## Phase 6: User Story 4 - Exported PDFs are branded (Priority: P2)

**Goal**: Both PDFs show the LvPrime lock-up on page 1 and a footer on every page (contract: `contracts/pdf-brand.md`)

**Independent Test**: Export a multi-page program PDF and a nutrition PDF; header on page 1, "LvPrime · Page i of n" footer on every page, no overlap, Evergreen instead of blue

### Tests for User Story 4

- [X] T022 [P] [US4] Add tests to `app/tests/unit/brand.test.js` importing `markSegments`, `BRAND_RGB`, `BRAND_NAME` from `app/src/lib/pdf-brand.js`: `markSegments(64)` returns tile `{x:0,y:0,w:64,h:64,r:15}`, strokes `[(18,16)→(18,46)], [(18,46)→(34,46)], [(25,26)→(34,46)], [(34,46)→(47,16)]` with the last coloured `BRAND_RGB.brass`, `strokeWidth: 5`; `markSegments(32)` halves every number; `BRAND_RGB` equals the hex tokens parsed from `app/src/styles/tokens.css`; `BRAND_NAME === 'LvPrime'` (expected to fail until T023)

### Implementation for User Story 4

- [X] T023 [US4] Create `app/src/lib/pdf-brand.js` per `contracts/pdf-brand.md`: export `BRAND_NAME = 'LvPrime'`; `BRAND_RGB = { evergreen:[22,53,42], evergreenDeep:[14,35,28], brass:[201,164,106], brassOnLight:[156,122,67], ivory:[245,241,234], stone:[230,224,213], ink:[20,20,18], muted:[107,103,94] }`; pure `markSegments(size)`; `footerReserve(unit)` (40pt converted; 1 mm = 2.8346 pt); `drawBrandHeader(doc, { x, y, unit })` drawing the tile with `doc.roundedRect(..., 'F')` in evergreen, strokes via `doc.setLineCap('round')`, `doc.setLineWidth`, `doc.line`, then "Lv" in `times` bold and "Prime" in `times` bolditalic `brassOnLight` at 20pt beside a 28pt mark, restoring font, size, text/draw colours and line width afterwards and returning the y below the lock-up; `drawBrandFooter(doc, { unit })` looping `doc.getNumberOfPages()` with `doc.setPage(i)` to draw a Stone rule plus "LvPrime" left and "Page i of n" right in 8pt muted. Must not import DOM code so `markSegments` stays testable under `node --test`
- [X] T024 [US4] In `app/src/components/program-pdf.js`: import from `../lib/pdf-brand.js`; set `PAGE_BOTTOM_MARGIN` to at least `footerReserve('pt') + 20`; call `drawBrandHeader(doc, { x: MARGIN_X, y: <top margin>, unit: 'pt' })` before the week title (~line 91) and continue from its returned y; call `doc.setProperties({ title: <existing or "LvPrime · Week N">, author: BRAND_NAME })`; call `drawBrandFooter(doc, { unit: 'pt' })` immediately before save. Keep `buildProgramWeekPdfContent` unchanged so `tests/unit/program-pdf.test.js` still passes
- [X] T025 [US4] In `app/src/components/nutrition-pdf.js`: import from `../lib/pdf-brand.js`; set `COLORS.headerBg = BRAND_RGB.evergreen` and `COLORS.sectionText = BRAND_RGB.evergreen` (replacing the blue and slate), `COLORS.tableBorder = BRAND_RGB.stone`; change `author: 'Lili Trainer'` to `author: BRAND_NAME`; draw `drawBrandHeader(doc, { x: MARGIN_X, y: MARGIN_Y, unit: 'mm' })` and shift the customer name, subtitle and underline below its returned y; set `PAGE_BOTTOM` to `PAGE_HEIGHT - footerReserve('mm')`; call `drawBrandFooter(doc, { unit: 'mm' })` before save
- [X] T026 [US4] Verify both PDFs render (constitution Principle IV): run `npm run dev` in `app/`, export a program PDF for a customer whose week spans 2+ pages and a nutrition PDF, open each, and confirm the quickstart §5 table (header, footer on every page, no overlap, no blue, author "LvPrime", selectable text)

**Checkpoint**: All four stories complete

---

## Phase 7: Polish & Cross-Cutting Concerns

- [X] T027 Run `npm test` in `app/`; all existing tests and `app/tests/unit/brand.test.js` pass
- [X] T028 Run `npm run build` in `app/`; confirm `app/dist/` has Fraunces woff2 files, `favicon.svg`, icon PNGs and `site.webmanifest`, and no Inter Tight files
- [X] T029 Walk through `specs/011-lvprime-rebrand/quickstart.md` §2 to §4 in light and dark scheme and at 360px width; compare the header against `design/brand/brand-sheet.png`; run a contrast check (DevTools or axe) with zero AA failures (SC-002, SC-006, SC-007)
- [X] T030 Scope guard: `git diff --stat` shows only the paths listed in quickstart §6 and nothing under `customers/` (FR-020)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: none
- **Foundational (Phase 2)**: after T001 (Fraunces must be installed for T003)
- **US1 (Phase 3)**: after Phase 2
- **US2 (Phase 4)**: after Phase 2; T018 should follow T011 (both touch header colours in `main.css`)
- **US3 (Phase 5)**: after Phase 2; reuses `.logo-mark` classes from T010
- **US4 (Phase 6)**: after Phase 2 only (PDFs do not read CSS); independent of US1 to US3
- **Polish (Phase 7)**: after all stories

### Within-story order

- T007 before T008/T009 (test first); T013 before T015 (favicon PNG rasterises from it)
- T022 before T023; T023 before T024 and T025; T026 last
- `main.css` tasks (T010, T011, T012, T016, T018, T021) touch one file: run them sequentially

### Parallel Opportunities

- T002 alongside T001
- In US1: T007, T013, T014 in parallel, then T008 to T012 sequentially
- US4 (T022 to T026) can run in parallel with US1 to US3 once Phase 2 is done
- T017 (`tabs.css`) in parallel with any `main.css` task

## Parallel Example: User Story 1

```text
Task: "T007 Create app/tests/unit/brand.test.js legacy-string test"
Task: "T013 Create app/public/favicon.svg small-size mark"
Task: "T014 Create app/public/site.webmanifest"
```

## Parallel Example: US1 and US4 together

```text
Developer A: T008 to T015 (header, icons)
Developer B: T022 to T026 (pdf-brand.js, both PDFs)
```

## Implementation Strategy

### MVP (User Story 1)

1. Phase 1 and Phase 2
2. Phase 3 (US1)
3. Stop and validate: header, title and icons match the brand sheet. This alone replaces "Lv Fitness" on every screen.

### Incremental delivery

1. MVP above
2. US2: headings and palette sweep, verify status colours unchanged
3. US3: sign-in
4. US4: PDFs, verified by opening exports
5. Polish: full test, build and quickstart run
