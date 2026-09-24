# Module Contract: `app/src/lib/pdf-brand.js`

**Spec**: FR-019, US4 | **Consumers**: `program-pdf.js` (unit `pt`), `nutrition-pdf.js` (unit `mm`)

## Exports

```js
export const BRAND_NAME = 'LvPrime';
export const BRAND_RGB = { evergreen, evergreenDeep, brass, brassOnLight, ivory, stone, ink }; // [r, g, b]

// Pure, no jsPDF: geometry of the 64-grid mark scaled to `size` (any unit).
export function markSegments(size) -> { tile: {x, y, w, h, r}, strokes: [{ from: [x, y], to: [x, y], colour }], strokeWidth }

// Draws mark + "Lv" (times bold) + "Prime" (times bolditalic, brassOnLight) at (x, y).
// Returns the y coordinate below the lock-up for content to continue from.
export function drawBrandHeader(doc, { x, y, unit }) -> number

// Stamps every page: thin Stone rule + "LvPrime" left, "Page i of n" right, Muted text.
// Call once after all content is written.
export function drawBrandFooter(doc, { unit }) -> void

// Height reserved at page bottom so content never enters the footer band.
export function footerReserve(unit) -> number
```

## Behaviour

- `unit` is `'pt'` or `'mm'`; sizes are specified once in pt and converted (1 mm = 2.8346 pt).
- Header: mark 28pt square, wordmark 20pt, placed at the page's top margin; restores the caller's font, size and colours before returning.
- Footer: baseline `footerReserve / 2` above page bottom; 8pt text.
- Both PDFs set document properties `author: 'LvPrime'`.
- Nutrition PDF: `COLORS.headerBg` becomes `BRAND_RGB.evergreen`; the section and table styling otherwise unchanged.
- Program PDF: page-break check uses `PAGE_BOTTOM_MARGIN >= footerReserve('pt')`.

## Tests (`tests/unit/brand.test.js`)

- `markSegments(64)` equals the data-model geometry; `markSegments(32)` halves every coordinate and the stroke width.
- `BRAND_RGB` values equal the hex tokens in `tokens.css`.
