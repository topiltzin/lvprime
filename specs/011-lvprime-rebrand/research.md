# Research: LvPrime Rebrand

**Feature**: [spec.md](./spec.md) | **Date**: 2026-09-24

All Technical Context unknowns are resolved below. Each entry: Decision, Rationale, Alternatives considered.

## R1. Display typeface delivery

- **Decision**: Add `@fontsource/fraunces` (v5.3.0) and import only the three cuts the brand uses: `500.css`, `600.css` and `500-italic.css`. Point `--font-display` at `'Fraunces', Georgia, 'Times New Roman', serif`. Remove the now-unused `@fontsource/inter-tight` import (and the dependency).
- **Rationale**: Matches the existing self-hosted pattern in `app/src/styles/tokens.css` (Inter via `@fontsource`, no CDN, spec 002 research §4). Static cuts keep the payload small (latin subsets only are emitted by Vite as used).
- **Alternatives considered**: `@fontsource-variable/fraunces` (one file, but larger and pulls the full opsz/SOFT/WONK axes we do not use); Google Fonts link (violates the no-CDN policy, FR-013); keeping Inter Tight for headings (loses the "elegant" voice the brand sheet establishes).

## R2. Avoiding layout shift from the display font (SC-007)

- **Decision**: The header keeps its fixed `--header-height`, so the wordmark swap cannot move content. Headings use a fallback stack starting with Georgia, whose metrics are close to Fraunces at the sizes used. No `font-display: block`.
- **Rationale**: The only above-the-fold serif text is the wordmark (fixed-height container) and one `h1`. A fallback with similar x-height keeps any reflow under one line.
- **Alternatives considered**: `<link rel="preload">` of the woff2 (Vite hashes filenames, making a static preload brittle); `size-adjust` fallback `@font-face` (precise, but extra maintenance for a one-coach tool).

## R3. Mark in the app shell and sign-in view

- **Decision**: Inline the mark as SVG markup in `app/index.html` (header) and create it in `login-view.js` (sign-in), using CSS custom properties for tile, stroke and brass colours so light/dark variants come from tokens rather than separate files.
- **Rationale**: No extra request, crisp at any DPR, and one SVG serves on-light, on-dark and mono by swapping three variables. `design/brand/*.svg` stay as the design masters.
- **Alternatives considered**: `<img src="/brand/mark-on-dark.svg">` (simple, but colours cannot follow dark mode and needs a second file per variant); icon font (overkill).

## R4. Favicon and app icons (FR-015, FR-016, SC-005)

- **Decision**: Create `app/public/` (Vite serves it at `/`) containing:
  - `favicon.svg`: simplified mark for 16/32px. Tile plus the L and the brass rising stroke only (drop the short V left arm), stroke width raised from 5 to 7 on the 64 grid.
  - `favicon-32.png`: raster fallback.
  - `apple-touch-icon.png` (180), `icon-192.png`, `icon-512.png`: full mark.
  - `site.webmanifest` with name "LvPrime", `theme_color` #16352A, `background_color` #F5F1EA.
  PNGs are rendered once from the SVGs with headless Chrome and committed.
- **Rationale**: At 16px the V's left arm merges with the L's vertical into a blob; removing it keeps a clear "L + rising line" silhouette. Committed PNGs avoid a build-time image dependency.
- **Alternatives considered**: One full-detail SVG for all sizes (blurs at 16px); build-time rasterisation plugin (new dependency for four files).

## R5. Branding the PDFs (FR-019)

- **Decision**: New module `app/src/lib/pdf-brand.js` with:
  - `BRAND_RGB`: palette as RGB triplets for jsPDF.
  - `markSegments(size)`: pure function returning the mark's tile and stroke geometry scaled to a given size (unit-agnostic, testable with `node --test`).
  - `drawBrandHeader(doc, { x, y, unit })` and `drawBrandFooter(doc, { unit })`: draw the mark with jsPDF vector primitives (`roundedRect`, `line`, `setLineCap('round')`) and the wordmark with jsPDF's built-in `times` (bold "Lv", bold-italic "Prime").
  - The footer is applied after content by looping `doc.getNumberOfPages()` / `doc.setPage(i)`, and the content bottom margin is enlarged so content never reaches the footer band.
  Both `program-pdf.js` (pt units) and `nutrition-pdf.js` (mm units) call it. Nutrition PDF's blue `headerBg` becomes Evergreen; both set `author: 'LvPrime'`.
- **Rationale**: Vector drawing keeps the mark sharp and selectable text intact, with no image embedding. Built-in Times avoids embedding a ~100 KB base64 Fraunces TTF in the bundle; the spec's Assumptions allow a built-in serif.
- **Alternatives considered**: `addImage` of a PNG mark (raster, adds bytes, blurry when zoomed); embedding Fraunces via `addFileToVFS` (heavy for v1, can follow later).

## R6. Palette tokens and dark mode (FR-007 to FR-011, SC-002)

- **Decision**: Add brand tokens to `tokens.css` (`--brand-evergreen`, `--brand-evergreen-deep`, `--brand-brass`, `--brand-brass-on-light`, `--brand-ivory`, `--brand-stone`) and remap existing semantic tokens: `--bg` to Ivory, `--border` to Stone, `--ink` to #141412, `--header-bg` to Evergreen, `--muted-bg` to a Stone tint. `--accent` (Signal) and danger/warning tokens are untouched. Dark mode: `--bg` #121614, `--surface` #1B201D, `--border` #2C332F, `--ink` #F0EDE6, `--muted` #A9ADA6; header stays Evergreen, separated from the page by the Brass rule.
- **Rationale**: Remapping semantic tokens restyles every view without touching component CSS, and leaves status colour roles byte-identical (SC-003). Dark values take a slight green cast to sit with Evergreen.
- **Contrast (WCAG 2.x, computed)**:

  | Pair | Ratio | Use | Result |
  |------|-------|-----|--------|
  | Ivory on Evergreen | 11.83 | header wordmark | AA |
  | Brass on Evergreen | 5.71 | "Prime" in header | AA |
  | Ivory 72% on Evergreen | 6.89 | descriptor, label | AA |
  | Ink on Ivory | 16.38 | body | AA |
  | Muted #6B675E on Ivory | 5.00 | meta text | AA |
  | Signal on Ivory | 4.72 | links, status | AA |
  | White on Signal | 5.32 | primary buttons | AA |
  | Brass dark #9C7A43 on Ivory | 3.53 | "Prime" on sign-in (≥30px) | AA large only |
  | Brass #C9A46A on Ivory | 2.07 | none | not allowed for text |
  | Ink dark on bg dark | 15.61 | body (dark) | AA |
  | Muted dark on surface dark | 7.25 | meta (dark) | AA |
  | Brass on bg dark | 7.82 | "Prime" (dark) | AA |

- **Alternatives considered**: Keeping the #0b0b0b header (not on brand); making Brass the accent (breaks FR-008/FR-009 and fails contrast on light).

## R7. Narrow screens (FR-006, SC-006)

- **Decision**: At ≤480px, the header hides the descriptor and the "Coach workspace" label and scales the mark to 32px and wordmark to 1.375rem. Extend the existing `@media (max-width: 480px)` block in `main.css` (the project's established breakpoint).
- **Rationale**: Keeps the mark and name, the parts that carry recognition, and guarantees no horizontal scroll at 360px.
- **Alternatives considered**: Mark only on mobile (loses the name on the one screen where it has room).

## R8. Verification approach

- **Decision**: (a) A unit test `tests/unit/brand.test.js` asserts that no legacy brand strings remain in `index.html` and `src/`, that `markSegments` scales correctly, and that `BRAND_RGB` matches the hex tokens. (b) Manual render checks per `quickstart.md`: each view in light and dark, 360px width, sign-in, and both PDFs opened and inspected (constitution Principle IV).
- **Rationale**: The repo already runs `node --test`; string and geometry checks are cheap and catch regressions. Visual fidelity still needs eyes on renders.
- **Alternatives considered**: Screenshot diffing (no existing infrastructure; the only local browser here is Windows Chrome via WSL).
