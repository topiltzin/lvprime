# Research: In-Page Exercise Video Player

## R1. Container: modal dialog vs inline expand vs new tab
- **Decision**: Modal dialog over a dimmed backdrop, implemented with the native `<dialog>` element and `showModal()`.
- **Rationale**: ui-ux-pro-max guidance (focus/keyboard, click-to-play, reserved space, loading feedback) maps directly to a modal. `showModal()` gives, with no code: focus moved in and contained, rest of page inert (also hidden from screen readers), Esc to close, top-layer stacking (no z-index fights with the sticky header/chat panel), implicit `role=dialog` + `aria-modal`. Focus returns to the previously focused element on close (we also restore explicitly for Safari consistency).
- **Alternatives**: Inline accordion under the exercise (shifts the list, video small, many embeds possible at once); bottom sheet (nice on phones but needs gesture/drag code and custom focus trapping); custom `div role=dialog` + hand-written focus trap (more code and bugs than the platform element); keep new tab (the thing being replaced).

## R2. Embed host and CSP
- **Decision**: Embed `https://www.youtube-nocookie.com/embed/<id>`; add `frame-src https://www.youtube-nocookie.com` to the CSP in `server/security-headers.js` **and** `vercel.json` (existing test enforces they match). No `script-src`/`connect-src` changes: the embed is a plain iframe, and we do not load YouTube's IFrame API script.
- **Rationale**: Currently `default-src 'self'` with no `frame-src` blocks all iframes, so without this change the dialog would be blank. The privacy-enhanced host sets no tracking cookies until play (spec assumption/SC-007). Narrowest possible addition: one host, frames only.
- **Alternatives**: `www.youtube.com` host (sets cookies on load); loading the IFrame API script (needs `script-src` additions and third-party JS in a strict-CSP app); self-hosting videos (out of scope).

## R3. Parsing the stored link
- **Decision**: Pure function `parseVideoUrl(url)` accepts `youtube.com/watch?v=`, `youtu.be/`, `youtube.com/embed/`, `shorts/`, with optional `t`/`start` seconds; validates the id as `[A-Za-z0-9_-]{11}`; returns `null` for anything else. `null` => keep the original `<a target=_blank>` behaviour (FR-012). Current data is 130/130 `watch?v=ID`.
- **Rationale**: The id is the only value interpolated into the iframe URL, so strict validation also prevents URL injection. Unknown hosts never get framed.
- **Alternatives**: Pass the stored URL straight to the iframe (breaks for watch URLs, unsafe for arbitrary hosts).

## R4. Progressive enhancement of the existing link
- **Decision**: Keep the exercise name an `<a href=videoUrl target=_blank>`. A click handler calls `preventDefault()` and opens the dialog when the URL parses; modified clicks (ctrl/cmd/shift/middle) are left alone so "open in new tab" still works.
- **Rationale**: Gives a working fallback for free if JS fails or the URL is unparseable, preserves right-click/copy-link, and keeps the existing `aria-label`. Enter on a link already triggers `click`.
- **Alternatives**: Convert to `<button>` (loses link semantics/fallback; changes existing tests/styles).

## R5. Failure and loading detection
- **Decision**: Show a spinner/skeleton in a fixed 16:9 box until the iframe `load` event; after that the video player's own UI takes over. Always render an "Open on YouTube" link under the video (cheap, robust fallback for embed-disabled, removed, blocked or offline cases). Add a 10 s timeout that swaps the loading state for the error message + link if `load` never fires. Embed-disabled videos still fire `load` with YouTube's own error screen, so the permanent link beneath is the safety net rather than guessing via undocumented postMessage.
- **Rationale**: Iframes expose no reliable error event for provider-side errors; a permanent fallback link is simpler and more honest than brittle detection. Satisfies FR-010/FR-011 (message appears on timeout/offline; link always present).
- **Alternatives**: YouTube IFrame API `onError` (needs third-party script + CSP changes); postMessage `listening` handshake (undocumented, may break).

## R6. Autoplay
- **Decision**: Use `autoplay=1` on the embed, which is allowed because the dialog is opened from a user tap and the iframe has `allow="autoplay; fullscreen; picture-in-picture"`. No autoplay on page load (iframe is created only inside the click handler).
- **Rationale**: The customer just asked to watch; making them tap play again in the popup is friction. The "no autoplay" UX guidance targets unrequested playback. Also `rel=0`, `playsinline=1`, `modestbranding=1`. If a browser blocks it, the player shows its normal play button.
- **Alternatives**: Require a second tap (safer but worse UX).

## R7. Back button / gesture
- **Decision**: On open, `history.pushState({ videoDialog: true }, '')` (same URL, so the hash router does not fire); on `popstate` close the dialog; on any other close path call `history.back()` only if our state entry is still on top (avoid double-pop).
- **Rationale**: On phones the Back gesture is the instinctive dismiss; without it the customer leaves the program page (spec edge case). Same-hash `pushState` fires no `hashchange`, so `main.js` routing is unaffected.
- **Alternatives**: Ignore Back (violates FR-004); hash-based route for the dialog (re-renders the view, loses scroll).

## R8. Scroll lock, motion, mobile layout
- **Decision**: Rely on the modal's inert backdrop plus `overscroll-behavior: contain` on the dialog and `body { overflow: hidden }` via a class while open (restored on close, preserving scroll position). Open/close uses opacity + slight scale over `var(--motion-base)` (0ms under reduced motion through existing tokens). Dialog width `min(100% - 16px, 960px)` with the 16:9 box; panel padding follows tokens; close button 44x44 using the existing `x` icon with visible focus ring; `dvh`-safe max-height; safe-area padding for notched phones.
- **Rationale**: Matches ui-ux-pro-max (spatial continuity, reduced motion, touch target, focus ring) and the project's existing token system.

## R9. Internationalisation
- **Decision**: New keys in both languages: `video.close`, `video.loading`, `video.error`, `video.openOnYoutube`, plus reuse `day.watchVideo` for the link label. `i18n.test.js` already checks key parity.
