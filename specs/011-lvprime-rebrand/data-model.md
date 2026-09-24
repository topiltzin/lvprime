# Data Model: LvPrime Rebrand

**Feature**: [spec.md](./spec.md) | **Date**: 2026-09-24

This feature stores no customer or server data. The "entities" are brand constants shared by CSS, the app shell and the PDF generators. They must stay in sync, which `tests/unit/brand.test.js` checks.

## BrandPalette

One colour role per row. Light and dark values; RGB triplets are what `pdf-brand.js` exports as `BRAND_RGB` (PDFs are always light).

| Role | Token | Light | Dark | RGB (PDF) | Allowed uses |
|------|-------|-------|------|-----------|--------------|
| Evergreen | `--brand-evergreen` | #16352A | #16352A | 22, 53, 42 | header, mark tile, PDF header band and headings |
| Evergreen deep | `--brand-evergreen-deep` | #0E231C | #0E231C | 14, 35, 28 | mark tile on dark surfaces |
| Brass | `--brand-brass` | #C9A46A | #C9A46A | 201, 164, 106 | mark rising stroke, "Prime" on dark, one rule per view |
| Brass on light | `--brand-brass-on-light` | #9C7A43 | #C9A46A | 156, 122, 67 | "Prime" on light, ≥24px only |
| Ivory | `--brand-ivory` | #F5F1EA | n/a | 245, 241, 234 | page background, mark L/V strokes |
| Stone | `--brand-stone` | #E6E0D5 | n/a | 230, 224, 213 | borders, table rules |
| Ink | `--ink` | #141412 | #F0EDE6 | 20, 20, 18 | primary text |

**Semantic remap** (existing tokens in `app/src/styles/tokens.css`):

| Token | Before (light / dark) | After (light / dark) |
|-------|------------------------|----------------------|
| `--bg` | #f4f2ee / #171715 | Ivory #F5F1EA / #121614 |
| `--surface` | #ffffff / #211f1d | #FFFFFF / #1B201D |
| `--ink` | #111111 / #f0efe9 | #141412 / #F0EDE6 |
| `--muted` | #6b6b64 / #a9a79f | #6B675E / #A9ADA6 |
| `--border` | #e6e3dc / #35332f | Stone #E6E0D5 / #2C332F |
| `--muted-bg` | #ebe8e2 / #2c2a26 | #EDE8DF / #242A26 |
| `--header-bg` | #0b0b0b | Evergreen #16352A (both schemes) |
| `--font-display` | Inter Tight | Fraunces, Georgia, serif |

**Unchanged (validation rule, SC-003)**: `--accent`, `--accent-hover`, `--accent-deep`, `--accent-tint`, `--accent-contrast`, `--danger*`, `--warning*`, `--chart-*` keep their current values in both schemes.

**Rules**:
- Brass tokens MUST NOT be referenced by any selector for buttons, links, tabs, chips, form controls, status badges or charts (FR-009).
- `--brand-brass` MUST NOT colour text on Ivory or white (2.07:1).

## BrandMark

Geometry on a 64 × 64 grid, identical in the SVG masters, the inline SVG and `markSegments()`.

| Part | Geometry | Colour |
|------|----------|--------|
| Tile | rect 0,0,64,64, radius 15 | Evergreen (on light) or Evergreen deep + 1.5px Brass hairline at 55% (on dark); none (mono) |
| L | polyline (18,16) → (18,46) → (34,46) | Ivory (tile variants) / currentColor (mono) |
| V left arm | line (25,26) → (34,46) | Ivory / currentColor |
| Rising stroke | line (34,46) → (47,16) | Brass / currentColor |
| Stroke | width 5, round caps and joins | |

**Variants**: `on-light`, `on-dark`, `mono`, `small` (favicon: no V left arm, stroke width 7).

`markSegments(size)` returns `{ tile: { x, y, w, h, r }, strokes: [{ from, to, colour }], strokeWidth }` with every coordinate multiplied by `size / 64`.

## WordmarkLockup

| Field | Value |
|-------|-------|
| name | "LvPrime" (never "Lv Prime" or "LVPRIME" in running text) |
| wordmark | "Lv" (display 600) + "Prime" (display italic 500) |
| descriptor | "PERSONAL TRAINING · 40+" (sans 600, uppercase, tracking 0.26 to 0.32em) |
| tagline | "Strength for the decades ahead." (sign-in only) |
| variants | `full` (mark + wordmark + descriptor), `compact` (mark + wordmark) |

**Legacy strings** that must not appear in user-visible source after this change: "Lv Fitness", "Personalized Training", "Lili Trainer" (as PDF author).
