---

description: "Task list for In-Page Exercise Video Player"
---

# Tasks: In-Page Exercise Video Player

**Input**: Design documents from `/specs/017-in-page-video-player/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/video-dialog-ui.md, quickstart.md

**Tests**: Included for the pure logic and the CSP (the repo runs `node --test` from `app/`: `cd app && npm test`). The project has no DOM test harness, so dialog behaviour (focus, Esc, Back, mobile) is verified manually with `quickstart.md`.

**Organization**: Grouped by user story. All paths are relative to the repo root. No server API, database, or dependency changes.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: US1 to US3, mapping to spec.md

---

## Phase 1: Setup

- [X] T001 [P] Allow the embed host in the Content-Security-Policy: in `app/server/security-headers.js` add the directive `"frame-src https://www.youtube-nocookie.com"` to the `CONTENT_SECURITY_POLICY` array (place it before `"frame-ancestors 'none'"`), and make the identical change in the `Content-Security-Policy` value in `app/vercel.json`. The string in `vercel.json` must equal `CONTENT_SECURITY_POLICY` exactly (the existing sync test enforces it). Change nothing else in the policy (`script-src 'self'`, `connect-src 'self'`, `frame-ancestors 'none'` stay).
- [X] T002 [P] Extend `app/tests/unit/security-headers.test.js` with a test asserting `SECURITY_HEADERS['Content-Security-Policy']` contains `frame-src https://www.youtube-nocookie.com`, still contains `frame-ancestors 'none'`, and does not contain `frame-src *`. Run `cd app && node --test tests/unit/security-headers.test.js`.
- [X] T003 [P] Add Spanish AND English strings to `app/src/lib/strings.js` (es block near `'day.watchVideo'` at ~line 537, en block near line 174): `video.close` ("Cerrar video" / "Close video"), `video.loading` ("Cargando video…" / "Loading video…"), `video.error` ("No se pudo cargar el video aquí." / "The video could not be loaded here."), `video.openOnYoutube` ("Abrir en YouTube" / "Open on YouTube"). Run `cd app && node --test tests/unit/i18n.test.js` to confirm es/en key parity.

---

## Phase 2: Foundational (blocks all user stories)

**Purpose**: The pure link parser every story depends on.

- [X] T004 Create `app/src/lib/video-embed.js` exporting `parseVideoUrl(url)` and `buildEmbedUrl({ id, start })` exactly per `data-model.md`: accept hosts `youtube.com`, `www.youtube.com`, `m.youtube.com`, `youtu.be`, `youtube-nocookie.com`; shapes `/watch?v=ID`, `/embed/ID`, `/shorts/ID`, `youtu.be/ID`; `id` must match `^[A-Za-z0-9_-]{11}$` else return `null`; `start` from `t` or `start` query param (`90`, `90s`, `1m30s`) as integer seconds >= 0, default 0; return `null` for non-strings, unparseable URLs, non-https schemes, and any other host. `buildEmbedUrl` returns `https://www.youtube-nocookie.com/embed/<id>?autoplay=1&playsinline=1&rel=0&modestbranding=1` plus `&start=N` only when `start > 0`. Use `new URL()` in a try/catch; no DOM access (must run under plain Node).
- [X] T005 [P] Create `app/tests/unit/video-embed.test.js` (node:test + assert/strict) covering: `https://www.youtube.com/watch?v=dQw4w9WgXcQ`, `youtu.be/dQw4w9WgXcQ?t=90`, `/embed/` and `/shorts/` forms, `1m30s` start parsing = 90, 10-char and 12-char ids return `null`, `https://evil.example/watch?v=dQw4w9WgXcQ` returns `null`, `javascript:` and `http:` URLs return `null`, `null`/`undefined`/non-string input returns `null`, and `buildEmbedUrl` output (host `www.youtube-nocookie.com`, `autoplay=1`, `start` omitted when 0). Run `cd app && node --test tests/unit/video-embed.test.js`.

**Checkpoint**: CSP allows the embed host, strings exist, parser is tested.

---

## Phase 3: User Story 1 - Watch an exercise demo without leaving the app (Priority: P1) 🎯 MVP

**Goal**: Tapping an exercise name with a video opens it in a modal popup on the same page; closing returns the customer to exactly where they were.

**Independent Test**: Open a program day, click an exercise with the play icon: popup with the exercise name and playing video, no new tab. Close with X, backdrop tap and Esc: popup gone, playback stopped, same scroll position, focus back on the exercise name. An exercise without a video behaves as before.

- [X] T006 [US1] Create `app/src/components/video-dialog.js` exporting `openVideoDialog({ url, title, opener })` per `contracts/video-dialog-ui.md`: return `false` without side effects when `parseVideoUrl(url)` is `null` or a dialog is already open; otherwise build (DOM APIs and `textContent` only, never `innerHTML`) a `<dialog class="video-dialog" aria-labelledby="video-dialog-title">` containing a header with `<h2 id="video-dialog-title">` set to `title` and a `<button type="button" class="video-dialog-close" aria-label={t('video.close')}>` holding `icon('x')`, a `.video-dialog-stage` with the `<iframe>` (`title` = exercise name, `src` = `buildEmbedUrl(...)`, `allow="autoplay; fullscreen; picture-in-picture"`, `allowfullscreen`, `referrerpolicy="strict-origin-when-cross-origin"`), and an `<a class="video-dialog-external" target="_blank" rel="noopener noreferrer" href={url}>` labelled `t('video.openOnYoutube')`. Append to `document.body`, call `showModal()`, focus the close button, and return `true`. Close paths: close button click, click on the `<dialog>` element itself outside `.video-dialog-panel` (backdrop), and the native `close`/`cancel` event for Esc. A single `closeDialog()` removes the dialog element (which removes the iframe and stops playback), then refocuses `opener` if it is still connected.
- [X] T007 [US1] Lock page scroll while the dialog is open in `app/src/components/video-dialog.js`: on open add class `video-dialog-open` to `document.body`; on close remove it. The CSS in T008 uses it for `overflow: hidden`. Verify the scroll position of the page is unchanged after closing (no jump to top).
- [X] T008 [P] [US1] Create `app/src/styles/video-dialog.css` and add `@import url('/src/styles/video-dialog.css');` to `app/src/styles/main.css` (after the `toast.css` import). Use existing tokens from `tokens.css` (colors, radius, spacing, `--motion-base`/`--motion-out`). Styles: `.video-dialog` as a centered panel `width: min(960px, calc(100% - 16px))`, no default dialog border/padding, `max-height: calc(100dvh - 16px)`; `::backdrop` dimmed (`rgb(0 0 0 / 0.7)`); `.video-dialog-stage { aspect-ratio: 16 / 9; position: relative; background: #000 }` with `iframe` filling it (`position:absolute; inset:0; width:100%; height:100%; border:0`); `.video-dialog-close` at least 44x44px with a visible `:focus-visible` ring using the project's accent; `.video-dialog-external` as a readable link under the video; `body.video-dialog-open { overflow: hidden }`; `.video-dialog { overscroll-behavior: contain }`.
- [X] T009 [US1] Wire the call site in `app/src/components/program-day.js` (`renderExerciseRow`, ~line 27-39): keep the existing `<a href target=_blank>` markup, and add `name.addEventListener('click', (event) => { ... })` that does nothing if `event.defaultPrevented`, `event.button !== 0`, or `event.ctrlKey || event.metaKey || event.shiftKey || event.altKey`; otherwise `if (openVideoDialog({ url: exercise.videoUrl, title: exercise.name, opener: name })) event.preventDefault();`. Import `openVideoDialog` from `./video-dialog.js`. Exercises without `videoUrl` stay a plain `<span>` (FR-017).
- [X] T010 [US1] Run the P1 scenarios of `specs/017-in-page-video-player/quickstart.md` (scenarios 1, 2, 4, 5, 11) against `cd app && npm run build && npm start` (the CSP is not applied by `vite` dev). Confirm: no CSP violations in the console, no `youtube-nocookie.com` request before the first tap, Ctrl/Cmd-click still opens a new tab, an unparseable link still opens in a new tab.

**Checkpoint**: Core request delivered; MVP is shippable here.

---

## Phase 4: User Story 2 - Comfortable on phones and for keyboard / assistive-technology users (Priority: P2)

**Goal**: The popup is large and easy to dismiss on a phone and fully operable without a pointer.

**Independent Test**: At 375px wide the video fills about 90%+ of the width, the close button is 44x44, Back closes the popup without leaving the page; keyboard-only open/close works with focus contained; reduced motion removes animation.

- [X] T011 [US2] Add Back-button handling in `app/src/components/video-dialog.js` per research R7: on open call `history.pushState({ videoDialog: true }, '')` (same URL, so `main.js` `hashchange` routing does not fire) and set `pushedHistory = true`; add a `popstate` listener that sets `pushedHistory = false` and closes the dialog; in `closeDialog()` for every other close path, if `pushedHistory` is still true set it to false and call `history.back()` (with the `popstate` listener removed first so it does not re-enter); remove the listener on close. Verify the URL hash and scroll position are unchanged after Back and after normal close.
- [X] T012 [P] [US2] Add phone and motion styles in `app/src/styles/video-dialog.css`: at `max-width: 480px` the panel uses `width: calc(100% - 16px)` with `padding-bottom: env(safe-area-inset-bottom)`; landscape phones keep the video within `100dvh` (cap stage with `max-height: calc(100dvh - 8rem)` and `width` derived via `aspect-ratio`); open/close transitions use opacity and a small `scale` over `var(--motion-base)` with `var(--motion-out)` (under 300ms), and because tokens already collapse to 0ms under `prefers-reduced-motion`, also add `@media (prefers-reduced-motion: reduce) { .video-dialog, .video-dialog::backdrop { transition: none } }`. Respect existing light/dark tokens for the panel background and text (FR-016).
- [X] T013 [US2] Make focus handling robust in `app/src/components/video-dialog.js`: after `showModal()` focus the close button explicitly; on close restore focus to `opener` explicitly (Safari does not always do so); `Tab`/`Shift+Tab` stay inside the dialog (native modal behaviour: confirm iframe, close button and the external link are all reachable and nothing outside is). Ensure the title `<h2>` and iframe `title` are the exercise name for screen readers (FR-007).
- [X] T014 [US2] Run quickstart scenarios 3, 6, 7, 8 and 9 (Back, 375px mobile and rotate, keyboard and screen-reader pass, reduced motion, es/en switch) and fix any issue found in the files above.

**Checkpoint**: Phone, keyboard and assistive-technology experience verified.

---

## Phase 5: User Story 3 - Graceful loading and failure (Priority: P3)

**Goal**: A clear loading state in a stable box, and a message plus YouTube fallback when the video can't be shown inline.

**Independent Test**: On Slow 3G the loading indicator fills the 16:9 box with no size jump; offline or blocked shows the error message after ~10 s; the "Open on YouTube" link always works.

- [X] T015 [US3] Add loading and failure states in `app/src/components/video-dialog.js`: inside `.video-dialog-stage` add `<div class="video-dialog-status" role="status">` showing `t('video.loading')` while loading; on the iframe `load` event remove/hide the status; start a 10 000 ms timer on open that, if `load` has not fired, sets the status text to `t('video.error')` and marks the stage `data-state="failed"`; clear the timer on `load` and on close. The `.video-dialog-external` link stays visible in every state (research R5).
- [X] T016 [P] [US3] Style the status in `app/src/styles/video-dialog.css`: `.video-dialog-status` absolutely centered over the stage with muted text and a simple CSS spinner (hidden under `prefers-reduced-motion` in favour of static text), `.video-dialog-stage[data-state="failed"]` shows the message with sufficient contrast (4.5:1) and hides the iframe; the stage keeps its 16:9 reserved size in all states so the dialog never resizes (FR-009).
- [ ] T017 [US3] Run quickstart scenario 10 (Slow 3G and offline) and confirm SC-003 (no layout shift) and SC-006 (message and working fallback link). Fix any issue found.

**Checkpoint**: All three stories work independently.

---

## Phase 6: Polish & Cross-Cutting

- [X] T018 [P] Run the full suite `cd app && npm test` and fix any regression (especially `security-headers`, `i18n`, `markdown-parser`).
- [X] T019 Run `cd app && npm run build` and confirm it succeeds with the new CSS import and component, then do a final pass of every scenario in `specs/017-in-page-video-player/quickstart.md` as both a customer and the coach (FR-018).
- [ ] T020 Mark the checklist in `specs/017-in-page-video-player/checklists/requirements.md` as verified and note any deviations from the spec in that file's Notes section.

---

## Dependencies & Execution Order

- **Phase 1**: T001, T002, T003 are independent ([P]); T002 depends on T001 to pass.
- **Phase 2**: T004 first; T005 can be written in parallel but passes only after T004. Blocks all stories.
- **US1 (P1)**: T006 -> T007 (same file); T008 parallel with T006; T009 after T006; T010 after T006-T009.
- **US2 (P2)**: depends on US1's component. T011 and T013 touch `video-dialog.js` (sequential); T012 parallel with them (CSS file); T014 last.
- **US3 (P3)**: depends on US1's component. T015 -> T016 can overlap (different files); T017 last.
- US2 and US3 both edit `video-dialog.js` and `video-dialog.css`, so do them sequentially rather than in parallel.
- **Polish**: after the stories you want to ship.

### Parallel Example

```text
Start together:  T001 (security-headers.js + vercel.json)
                 T003 (strings.js)
                 T005 (video-embed.test.js, written against the spec in data-model.md)
US1 together:    T006 (video-dialog.js)  +  T008 (video-dialog.css)
```

## Implementation Strategy

**MVP first**: Phase 1 + Phase 2 + Phase 3 (T001-T010) delivers the request: the video opens in a popup on the same page. Stop and validate with the P1 quickstart scenarios, then add Back/mobile/keyboard polish (US2), then loading/failure handling (US3).

**Total**: 20 tasks. Setup 3, Foundational 2, US1 5, US2 4, US3 3, Polish 3.
