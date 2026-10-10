# Quickstart: Validating the In-Page Video Player

## Prerequisites

```bash
cd app && npm install
npm test                 # unit tests incl. video-embed, security-headers, i18n
npm run build && npm start   # CSP is applied by server.js, NOT by `vite` dev
```

Use a customer whose program has exercises with videos (any seeded customer). Sign in as a customer and as the coach.

## Scenarios

1. **Opens in place (US1)**: On a program day, click an exercise with the play icon. Dialog appears with the exercise name; no new tab; video starts. Close via X, backdrop, Esc: playback stops, you are on the same day at the same scroll position, focus is on the exercise name.
2. **No video unchanged**: An exercise without a video has no link and nothing happens on click.
3. **Back gesture**: Open the dialog, press browser Back. Dialog closes; you stay on the program day (URL hash unchanged).
4. **Modified click**: Ctrl/Cmd-click the exercise name opens YouTube in a new tab and no dialog.
5. **CSP**: In devtools console there are no CSP violations on open. Network tab shows no `youtube-nocookie.com` requests before the first tap (SC-007).
6. **Mobile (US2)**: Emulate 375x667. Video ~full width, 16:9, no horizontal scroll; close button >= 44x44; rotate to landscape and the video refits.
7. **Keyboard / screen reader**: Tab/Shift+Tab stay within the dialog with visible focus; Enter/Space on the exercise link opens it; screen reader announces a dialog named for the exercise.
8. **Reduced motion**: Enable `prefers-reduced-motion`; open/close has no scale/slide.
9. **Languages**: Switch es/en; close label, loading, error and link text follow.
10. **Failure (US3)**: Throttle to Slow 3G: loading indicator fills the 16:9 box with no size jump. Go offline then open: after ~10 s the error message shows; "Open on YouTube" link works.
11. **Unparseable link**: Temporarily set an exercise `videoUrl` to a non-YouTube URL: click opens it in a new tab as before (no broken dialog).

## Automated checks expected to pass

- `video-embed.test.js`: watch/short/embed/youtu.be URLs, start times, invalid ids and hosts return `null`.
- `security-headers.test.js`: `vercel.json` and `SECURITY_HEADERS` equal, and CSP contains `frame-src https://www.youtube-nocookie.com` and still contains `frame-ancestors 'none'`.
- `i18n.test.js`: es/en key parity for the new `video.*` keys.

See [contracts/video-dialog-ui.md](contracts/video-dialog-ui.md) and [data-model.md](data-model.md).
