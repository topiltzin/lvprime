# Implementation Plan: LvPrime Rebrand

**Branch**: `011-lvprime-rebrand` | **Date**: 2026-09-24 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/011-lvprime-rebrand/spec.md`

## Summary

Replace the "Lv Fitness" identity with the LvPrime brand system from `design/brand/`. The change is almost entirely presentational: new brand tokens and a semantic-token remap in `tokens.css` (Ivory, Stone, Ink, Evergreen header, Brass details) with Signal green and all status colours untouched; Fraunces added as a self-hosted display face for the wordmark and headings; an inline-SVG mark and two-tone wordmark in the header and sign-in view; favicon, app icons and web manifest in a new `app/public/`; and a shared `pdf-brand.js` module that draws the vector mark, wordmark and page footers into both jsPDF exports. See [research.md](./research.md) for decisions R1 to R8.

## Technical Context

**Language/Version**: JavaScript (ES modules), Node ≥ 22.5 for tooling and tests

**Primary Dependencies**: Vite 8 (dev/build), jsPDF 4 (PDF export), `@fontsource/inter` (kept), `@fontsource/fraunces` 5.3.0 (new), `@fontsource/inter-tight` (removed)

**Storage**: N/A (no data changes)

**Testing**: `node --test` (`npm test`), plus manual render checks in `quickstart.md`

**Target Platform**: Modern desktop and mobile browsers; coach app deployed on Vercel

**Project Type**: Web application (vanilla JS single-page app with local API in `app/`)

**Performance Goals**: No perceptible load regression; added font payload ≤ ~90 KB (three latin woff2 cuts) offset by removing Inter Tight

**Constraints**: No external font or asset CDN; WCAG AA contrast in both colour schemes; no visible layout shift from font swap; fits 360px width without horizontal scroll

**Scale/Scope**: 1 HTML shell, 3 stylesheets, 1 view, 2 PDF generators, 1 new module, ~6 static icon assets

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Assessment | Status |
|-----------|------------|--------|
| I. Content & Program Quality | No change to customer file formats or program content. PDF exports keep all existing content; only a brand header, footer and colours are added. | Pass |
| II. Verify-Before-Save (NON-NEGOTIABLE) | No writes to `program.md`, `feedback.md` or `notes.md`. Not applicable beyond confirming customer files are untouched (quickstart §6). | Pass |
| III. User Experience Consistency | One brand applied uniformly via tokens across all views and both PDFs; structure, headings and terminology of customer content unchanged. | Pass |
| IV. Performance & Responsiveness | Font payload controlled (R1, R2). Exported PDFs must be rendered and inspected before hand-off (quickstart §5). | Pass |
| Customer Data Standards | No customer data touched. | Pass |
| Development Workflow | Customer interaction workflow unaffected. | Pass |

**Post-design re-check (after Phase 1)**: Pass. The contracts add no customer-data paths; PDF verification is an explicit quickstart step.

## Project Structure

### Documentation (this feature)

```text
specs/011-lvprime-rebrand/
├── plan.md              # This file
├── spec.md
├── research.md          # Phase 0: decisions R1 to R8
├── data-model.md        # Phase 1: BrandPalette, BrandMark, WordmarkLockup
├── quickstart.md        # Phase 1: validation guide
├── contracts/
│   ├── brand-tokens.md  # tokens.css additions and remaps
│   ├── header-lockup.md # header + sign-in markup and visual rules
│   └── pdf-brand.md     # pdf-brand.js module contract
├── checklists/
│   └── requirements.md
└── tasks.md             # Phase 2 (/speckit-tasks)
```

### Source Code (repository root)

```text
design/brand/                    # design masters (already created, read-only for this feature)
├── brand-sheet.html / .png
├── mark.svg, mark-on-dark.svg, mark-mono.svg

app/
├── index.html                   # title, icons, manifest, header lock-up with inline mark
├── package.json                 # + @fontsource/fraunces, − @fontsource/inter-tight
├── public/                      # NEW, served at /
│   ├── favicon.svg              # simplified small-size mark
│   ├── favicon-32.png
│   ├── apple-touch-icon.png     # 180
│   ├── icon-192.png, icon-512.png
│   └── site.webmanifest
├── src/
│   ├── styles/
│   │   ├── tokens.css           # brand tokens, semantic remap, Fraunces imports
│   │   ├── main.css             # header lock-up, headings, sign-in brand, ≤480px rules
│   │   └── tabs.css             # audit hard-coded colours only
│   ├── views/login-view.js      # on-light lock-up + tagline
│   ├── lib/pdf-brand.js         # NEW: BRAND_RGB, markSegments, drawBrandHeader/Footer
│   └── components/
│       ├── program-pdf.js       # header, footer, author, bottom reserve
│       └── nutrition-pdf.js     # header, footer, Evergreen replaces blue, author
└── tests/unit/brand.test.js     # NEW: legacy strings, geometry, palette sync
```

**Structure Decision**: Existing single web app under `app/`. All changes live in the presentation layer (`index.html`, `src/styles`, one view, the two PDF components) plus one new pure-ish library module and a new `public/` folder for static icons. No server, API or data changes.

## Implementation Order (for /speckit-tasks)

1. **Foundation**: tokens and font (brand-tokens contract). Unblocks everything.
2. **US1 Header + icons** (P1): inline mark, lock-up, title, `public/` assets.
3. **US2 Palette sweep** (P1): headings, hard-coded colour audit in `main.css`/`tabs.css`, dark mode, ≤480px.
4. **US3 Sign-in** (P2).
5. **US4 PDFs** (P2): `pdf-brand.js`, then both generators.
6. **Polish**: `brand.test.js`, quickstart run-through, contrast audit.

## Complexity Tracking

No constitution violations; section intentionally empty.
