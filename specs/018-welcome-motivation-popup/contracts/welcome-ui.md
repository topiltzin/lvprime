# Contract: Welcome UI

Validated against the UI/UX Pro Max guidance (reduced motion, one hero animation per view, visible focus on modal controls) and the existing tokens in `tokens.css`.

## Popup (customer)
- Native `<dialog class="welcome-dialog" aria-labelledby aria-describedby>` opened with `showModal()`; background inert; focus lands on the close button; focus returns to the previously focused element on close.
- Content: small caps label "From your coach" (sender label, not color alone), heading "Welcome back, {first name}!" (display font), the coach's message in 1.25 rem body text, and one primary button "Let's go!" (≥ 44×44 px, accent-fill). A top-right close icon button (≥ 44×44 px) duplicates it. Esc and backdrop click also close.
- Card: `--surface-raised`, `--radius-hero`, volt accent line; dark-mode tokens honored. Text always sits on the solid card, never over the particles, so contrast stays ≥ 4.5:1. Card scrolls internally with `max-height: calc(100dvh - 32px)`; no horizontal scroll at 360 px.
- Only one popup at a time; never shown to the coach except in preview.

## Effect
- Open: card scales/fades in over ≤ 250 ms while three staggered bursts (≈ 28 particles each, brand volt / chalk / warm accent) play behind and around it, total ≤ 1.2 s.
- Close: card fades out over ≤ 200 ms with a single burst (≤ 0.5 s); the dialog is removed after the effect, but the page is interactive immediately.
- The canvas is `aria-hidden`, `pointer-events: none`, removed when finished; particles fade smoothly (no strobing; ≤ 3 flashes/s).
- `prefers-reduced-motion: reduce`: no canvas, no scaling; 150 ms opacity fade only.

## Coach editor ("Welcome message" tab)
- Visible-label textarea (not placeholder-only) with live counter "n/300", turning to warning at 270.
- Day picker as a 7-button radiogroup (Mon–Sun, localized, default Mon), keyboard arrow navigation, ≥ 44 px targets.
- "Repeat every week" switch (default on); status line "Scheduled for Monday" / "Seen on 2026-10-12"; buttons Save, Preview, Remove.
- Preview opens the same popup with a "Preview" ribbon and never calls the seen endpoint.
- Below: collapsed "Earlier conversation (read-only)" if 016 history exists.

## Strings
All fixed labels live in `strings.js` for `es` and `en`; message text is rendered via `textContent` only.
