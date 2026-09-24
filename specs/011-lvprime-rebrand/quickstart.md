# Quickstart: Validate the LvPrime Rebrand

**Feature**: [spec.md](./spec.md) | **Reference render**: `design/brand/brand-sheet.png`

## Prerequisites

```bash
cd app
npm install          # picks up @fontsource/fraunces
```

## 1. Automated checks

```bash
npm test
```

Expected: all existing tests pass, plus `tests/unit/brand.test.js`:
- no "Lv Fitness", "Personalized Training" or "Lili Trainer" in `index.html` or `src/`
- `markSegments` geometry and scaling match [data-model.md](./data-model.md)
- `BRAND_RGB` matches `tokens.css`

```bash
npm run build
```

Expected: build succeeds; `dist/` contains Fraunces woff2 files, `favicon.svg`, icon PNGs and `site.webmanifest`; no Inter Tight files.

## 2. App shell (US1, US2)

```bash
npm run dev
```

Open the overview, a customer page and the feedback form. For each, in light and dark scheme:

| Check | Expected | Spec |
|-------|----------|------|
| Header | Mark, ivory "Lv" + brass italic "Prime", descriptor, Evergreen band, Brass 2px rule; matches brand sheet "App header" | FR-003, FR-004, SC-004 |
| Coach workspace label | Present, right side | FR-005 |
| Logo click | Returns to overview | US1-4 |
| Tab | Title "LvPrime · Coach workspace", LvPrime icon legible beside other tabs | FR-015, SC-005 |
| Background, borders, headings | Ivory, Stone, Fraunces headings | FR-007, FR-012 |
| Status, charts, buttons | Same green/red roles as before this change | FR-008, FR-010, SC-003 |
| Brass | Only in mark, "Prime" and header rule | FR-009 |

Then resize to 360px wide: no horizontal scroll; descriptor and label hidden; mark and wordmark visible (SC-006).

Hard-reload with cache disabled: headings and header do not visibly jump when the font arrives (SC-007).

## 3. Contrast (SC-002)

Run a contrast check (browser DevTools accessibility pane or axe) on header, sign-in and each main view in both schemes. Expected: no AA failures. Reference ratios are in [research.md](./research.md) R6.

## 4. Sign-in (US3)

Sign out (clear the session cookie) and reload. Expected: on-light lock-up, tagline "Strength for the decades ahead.", heading "Coach sign-in". Wrong password shows "Wrong password."; correct password signs in.

## 5. PDFs (US4, constitution Principle IV)

On a customer with a multi-page program and a nutrition plan, export both PDFs and open them.

| Check | Expected |
|-------|----------|
| Page 1 | LvPrime mark + wordmark header |
| Every page | "LvPrime" footer with page numbers; no content under or over it |
| Nutrition accents | Evergreen, no blue |
| Document properties | Author "LvPrime" |
| Text | Still selectable; content unchanged |

## 6. Scope guard (FR-020)

`git diff --stat` touches only `app/index.html`, `app/public/`, `app/src/styles/`, `app/src/views/login-view.js`, `app/src/components/*-pdf.js`, `app/src/lib/pdf-brand.js`, `app/package*.json`, `app/tests/unit/brand.test.js` and this spec folder. No `customers/` files change.
