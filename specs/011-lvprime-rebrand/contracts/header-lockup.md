# UI Contract: Header lock-up and sign-in brand

**Spec**: FR-001 to FR-006, FR-018 | **Reference**: `design/brand/brand-sheet.png` ("App header" panel)

## Header markup (`app/index.html`)

```html
<header class="app-header">
  <div class="header-content">
    <a class="logo" href="#/" aria-label="LvPrime, go to overview">
      <svg class="logo-mark" viewBox="0 0 64 64" aria-hidden="true" focusable="false">…mark (on-dark)…</svg>
      <span class="logo-lockup">
        <span class="logo-text">Lv<em>Prime</em></span>
        <span class="logo-subtitle">Personal training · 40+</span>
      </span>
    </a>
    <span class="header-chip">Coach workspace</span>
  </div>
</header>
```

- Class names `.logo`, `.logo-text`, `.logo-subtitle`, `.header-chip` are kept so existing reduced-motion and responsive rules still apply.
- `<title>`: `LvPrime · Coach workspace`.
- `<head>` adds: `favicon.svg` (`type="image/svg+xml"`), `favicon-32.png` fallback, `apple-touch-icon.png`, `site.webmanifest`, `<meta name="theme-color" content="#16352A">`.

## Visual rules

| Element | Rule |
|---------|------|
| `.app-header` | background `--header-bg` (Evergreen); `border-bottom: 2px solid var(--brand-brass)` |
| `.logo-mark` | 40px desktop, 32px ≤480px; tile Evergreen deep, hairline Brass |
| `.logo-text` | display 600, 1.875rem, tracking -0.02em, colour Ivory |
| `.logo-text em` | display italic 500, colour `--brand-brass` |
| `.logo-subtitle` | sans 600, 0.625rem, uppercase, tracking 0.26em, Ivory at 72% |
| `.header-chip` | unchanged text; hidden ≤480px |
| ≤480px | `.logo-subtitle` hidden; `.logo-text` 1.375rem; no horizontal scroll at 360px |

## Sign-in view (`login-view.js`)

Above the existing "Coach sign-in" heading, render a centred on-light lock-up:

```html
<div class="login-brand">
  <svg class="logo-mark" …>…mark (on-light)…</svg>
  <p class="login-wordmark">Lv<em>Prime</em></p>
  <p class="login-tagline">Strength for the decades ahead.</p>
</div>
```

- `.login-wordmark` ≥ 2.25rem, Ink; `em` uses `--brand-brass-on-light` (large-text AA only).
- `.login-tagline` display italic 500, 1.125rem, `--muted`.
- Form, error text, focus and submit behaviour unchanged (acceptance US3-2).
