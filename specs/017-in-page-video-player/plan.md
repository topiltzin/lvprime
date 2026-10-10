# Implementation Plan: In-Page Exercise Video Player

**Branch**: `017-in-page-video-player` (no git branch; work on `main` unless chosen otherwise) | **Date**: 2026-10-10 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/017-in-page-video-player/spec.md`

## Summary

Tapping an exercise name that has a demo video opens a **modal dialog** over the current page with the YouTube video embedded, instead of a new tab. The dialog is a native `<dialog>` opened with `showModal()` (free focus containment, inert background, Esc to close, top-layer stacking), titled with the exercise name, with a 44px close button, backdrop-tap to close, a Back-button handler, a loading state in a fixed 16:9 box, and an always-visible "Open on YouTube" link as the failure fallback. The embed uses the privacy-enhanced host and is created only on tap (nothing loads on page view). The one non-UI change that is required: the app's Content-Security-Policy currently has no `frame-src` (falls back to `default-src 'self'`), so it must allow the embed host in both `server/security-headers.js` and `vercel.json`. No server API, data, or dependency changes.

## Technical Context

**Language/Version**: JavaScript (ES modules), Node >= 22.5; no framework, Vite 8 front end

**Primary Dependencies**: None new. Native `<dialog>`, existing `icon()` (Phosphor `x` already imported), `t()` strings.

**Storage**: N/A. Video links already stored per exercise (`exercise.videoUrl`, all `https://www.youtube.com/watch?v=ID`). Dialog state is transient.

**Testing**: `node --test`. Unit: video-URL parsing (`src/lib/video-embed.js`, pure) and CSP/vercel.json sync (existing `security-headers.test.js`, extended to assert `frame-src`). i18n parity via existing `i18n.test.js`. DOM behaviour (focus return, Esc, Back) verified manually/with Playwright per `quickstart.md` (project has no DOM test harness).

**Target Platform**: Mobile-first browser; Vercel static + serverless and local `server.js`. Hash-routed single page.

**Project Type**: Web application (single repo `app/`)

**Performance Goals**: Dialog and loading state visible < 300ms after tap; zero third-party requests until first tap (SC-007); no layout shift (fixed aspect-ratio box).

**Constraints**: Strict CSP (no inline script; only add `frame-src https://www.youtube-nocookie.com`); es/en strings in `strings.js`; reduced-motion via existing `--motion-*` tokens; hash router must not be disturbed by Back handling; `Referrer-Policy: strict-origin-when-cross-origin` already sent (YouTube embeds require a referrer).

**Scale/Scope**: 1 new lib file, 1 new component, 1 call-site change, 1 CSS file, 2 header files, ~8 string keys per language.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

The constitution governs the markdown customer files and coaching consistency; this feature is presentation-only and touches none of those files.

| Principle | Status | Note |
|-----------|--------|------|
| I. Content & Program Quality | PASS | `program.md` format and video-link data unchanged; only how an existing link is opened. |
| II. Verify-Before-Save | PASS | Nothing is saved or written. |
| III. UX Consistency | PASS | Reuses tokens, icons, `strings.js` es/en copy, existing accent styling; same exercise-name tap target. |
| IV. Performance | PASS | Embed created lazily on tap; no new page-load requests. |
| Customer Data Standards | PASS | No customer data created, stored or transmitted by the app. |

Re-check after design: still PASS. Note for reviewers: loosening the CSP to allow one embed host is a deliberate, minimal security-surface change (see research R2).

## Project Structure

### Documentation (this feature)

```text
specs/017-in-page-video-player/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── video-dialog-ui.md
├── checklists/
│   └── requirements.md
└── tasks.md             # created by /speckit-tasks
```

### Source Code (repository root)

```text
app/
├── server/
│   └── security-headers.js            # add frame-src https://www.youtube-nocookie.com
├── vercel.json                        # same CSP change (kept in sync by test)
├── src/
│   ├── lib/
│   │   ├── video-embed.js             # NEW: parse watch/short/embed URLs -> {id, start}, build embed URL
│   │   └── strings.js                 # es + en keys (video.close, video.loading, video.error, video.openOnYoutube, ...)
│   ├── components/
│   │   ├── video-dialog.js            # NEW: openVideoDialog({ url, title, opener })
│   │   └── program-day.js             # exercise name click -> openVideoDialog; keep href as no-JS/fallback
│   └── styles/
│       ├── video-dialog.css           # NEW (imported from main.css)
│       └── main.css                   # import
└── tests/
    └── unit/
        ├── video-embed.test.js        # NEW
        └── security-headers.test.js   # assert frame-src is present and in sync
```

**Structure Decision**: Extend the existing single web app in the same places as the chat panel (`chat-panel.js` already uses `role="dialog"`) and toast components: a dependency-free component in `src/components`, pure logic in `src/lib`, styles in `src/styles`.

## Complexity Tracking

No constitution violations to justify.
