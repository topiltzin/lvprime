// LvPrime brand for jsPDF exports (specs/011 contracts/pdf-brand.md).
// Draws the mark as vectors and the wordmark in built-in Times, so PDFs stay sharp
// and text stays selectable without embedding images or font files. No DOM imports:
// `markSegments` is tested under plain `node --test`.

export const BRAND_NAME = 'LvPrime';

// Mirrors the --brand-* tokens in src/styles/tokens.css (checked by tests/unit/brand.test.js).
export const BRAND_RGB = {
  evergreen: [22, 53, 42],
  evergreenDeep: [14, 35, 28],
  brass: [201, 164, 106],
  brassOnLight: [156, 122, 67],
  ivory: [245, 241, 234],
  stone: [230, 224, 213],
  ink: [20, 20, 18],
  muted: [107, 103, 94],
};

const PT_PER_MM = 2.8346;
const MARK_PT = 28;
const WORDMARK_PT = 20;
const FOOTER_TEXT_PT = 8;
const FOOTER_RESERVE_PT = 40;

// Mark geometry on its 64 grid, identical to design/brand/mark.svg.
const GRID = 64;
const TILE_RADIUS = 15;
const STROKE_WIDTH = 5;
const STROKES = [
  { from: [18, 16], to: [18, 46], colour: BRAND_RGB.ivory },
  { from: [18, 46], to: [34, 46], colour: BRAND_RGB.ivory },
  { from: [25, 26], to: [34, 46], colour: BRAND_RGB.ivory },
  { from: [34, 46], to: [47, 16], colour: BRAND_RGB.brass },
];

function toUnit(pt, unit) {
  return unit === 'mm' ? pt / PT_PER_MM : pt;
}

/** Mark geometry scaled from the 64 grid to `size` (any unit), origin at the tile's top-left. */
export function markSegments(size) {
  const k = size / GRID;
  return {
    tile: { x: 0, y: 0, w: size, h: size, r: TILE_RADIUS * k },
    strokes: STROKES.map(({ from, to, colour }) => ({
      from: [from[0] * k, from[1] * k],
      to: [to[0] * k, to[1] * k],
      colour,
    })),
    strokeWidth: STROKE_WIDTH * k,
  };
}

/** Space to keep clear at the page bottom so content never enters the footer band. */
export function footerReserve(unit) {
  return toUnit(FOOTER_RESERVE_PT, unit);
}

function saveState(doc) {
  const { fontName, fontStyle } = doc.getFont();
  return {
    fontName,
    fontStyle,
    fontSize: doc.getFontSize(),
    textColor: doc.getTextColor(),
    drawColor: doc.getDrawColor(),
    fillColor: doc.getFillColor(),
    lineWidth: doc.getLineWidth(),
  };
}

function restoreState(doc, s) {
  doc.setFont(s.fontName, s.fontStyle);
  doc.setFontSize(s.fontSize);
  doc.setTextColor(s.textColor);
  doc.setDrawColor(s.drawColor);
  doc.setFillColor(s.fillColor);
  doc.setLineWidth(s.lineWidth);
  doc.setLineCap('butt');
}

function drawMark(doc, x, y, size) {
  const { tile, strokes, strokeWidth } = markSegments(size);
  doc.setFillColor(...BRAND_RGB.evergreen);
  doc.roundedRect(x + tile.x, y + tile.y, tile.w, tile.h, tile.r, tile.r, 'F');
  doc.setLineWidth(strokeWidth);
  doc.setLineCap('round');
  for (const { from, to, colour } of strokes) {
    doc.setDrawColor(...colour);
    doc.line(x + from[0], y + from[1], x + to[0], y + to[1]);
  }
}

/**
 * Mark + "Lv" (Times bold, Evergreen) + "Prime" (Times bold italic, Brass on light),
 * top-left at (x, y). Restores the caller's drawing state and returns the y below the lock-up.
 */
export function drawBrandHeader(doc, { x, y, unit }) {
  const state = saveState(doc);
  const mark = toUnit(MARK_PT, unit);
  drawMark(doc, x, y, mark);

  const textX = x + mark + toUnit(10, unit);
  const baseline = y + mark * 0.72;
  doc.setFontSize(WORDMARK_PT);
  doc.setFont('times', 'bold');
  doc.setTextColor(...BRAND_RGB.evergreen);
  doc.text('Lv', textX, baseline);
  const lvWidth = doc.getTextWidth('Lv');
  doc.setFont('times', 'bolditalic');
  doc.setTextColor(...BRAND_RGB.brassOnLight);
  doc.text('Prime', textX + lvWidth, baseline);

  restoreState(doc, state);
  return y + mark + toUnit(24, unit);
}

/** Stamps every page with a Stone rule, "LvPrime" and "Page i of n". Call once, after all content. */
export function drawBrandFooter(doc, { unit }) {
  const state = saveState(doc);
  const pageCount = doc.getNumberOfPages();
  const width = doc.internal.pageSize.getWidth();
  const height = doc.internal.pageSize.getHeight();
  const margin = toUnit(40, unit);
  const ruleY = height - footerReserve(unit) * 0.7;
  const textY = height - footerReserve(unit) * 0.35;

  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setDrawColor(...BRAND_RGB.stone);
    doc.setLineWidth(toUnit(0.75, unit));
    doc.line(margin, ruleY, width - margin, ruleY);
    doc.setFontSize(FOOTER_TEXT_PT);
    doc.setTextColor(...BRAND_RGB.muted);
    doc.setFont('times', 'bolditalic');
    doc.text(BRAND_NAME, margin, textY);
    doc.setFont('helvetica', 'normal');
    doc.text(`Page ${i} of ${pageCount}`, width - margin, textY, { align: 'right' });
  }

  restoreState(doc, state);
}
