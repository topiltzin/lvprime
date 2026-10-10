# Contract: Video Dialog UI

No server API changes. This contract defines the client component and the security-header change.

## Component

`openVideoDialog({ url, title, opener }) -> boolean` in `src/components/video-dialog.js`

- Returns `false` (and does nothing) when `parseVideoUrl(url)` is `null`; the caller then lets the default link navigation proceed.
- Returns `true` after opening. Only one dialog at a time; a second call while open is ignored.

Call site (`program-day.js`): the existing exercise-name `<a>` gets a `click` handler:
ignore if `event.defaultPrevented`, button != 0, or any of ctrl/meta/shift/alt is held; otherwise `if (openVideoDialog(...)) event.preventDefault()`.

## DOM structure

```html
<dialog class="video-dialog" aria-labelledby="video-dialog-title">
  <div class="video-dialog-panel">
    <header class="video-dialog-header">
      <h2 id="video-dialog-title">{exercise name}</h2>
      <button type="button" class="video-dialog-close" aria-label="{t video.close}">{x icon}</button>
    </header>
    <div class="video-dialog-stage">          <!-- aspect-ratio: 16 / 9, reserved -->
      <div class="video-dialog-status" role="status">{loading | error}</div>
      <iframe title="{exercise name}" src="https://www.youtube-nocookie.com/embed/ID?..."
              allow="autoplay; fullscreen; picture-in-picture" allowfullscreen
              referrerpolicy="strict-origin-when-cross-origin"></iframe>
    </div>
    <a class="video-dialog-external" href="{original url}" target="_blank" rel="noopener noreferrer">{t video.openOnYoutube}</a>
  </div>
</dialog>
```

## Behaviour

| Trigger | Result |
|---------|--------|
| Open | `showModal()`; iframe `src` set only now; history entry pushed; body scroll locked; focus on close button |
| Close button / backdrop click / Esc / Back | dialog removed, iframe removed (stops playback), scroll unlocked, focus to `opener`, history entry popped if still ours |
| iframe `load` | hide status |
| 10 s without `load` | status shows `video.error`; external link remains |
| Reduced motion | no scale/slide; transitions use `--motion-*` tokens (0ms) |
| Viewport <= 480px | panel width `calc(100% - 16px)`, close button 44x44, safe-area padding |

## Security header change

Add to the CSP in both `app/server/security-headers.js` and `app/vercel.json`:

```
frame-src https://www.youtube-nocookie.com
```

Nothing else in the CSP changes (`frame-ancestors 'none'`, `script-src 'self'` stay).

## Strings (es / en)

`video.close`, `video.loading`, `video.error`, `video.openOnYoutube`.
