// LvPrime brand for jsPDF exports (specs/011 contracts/pdf-brand.md).
// Draws the mark as vectors and the wordmark in built-in Helvetica, so PDFs stay sharp
// and text stays selectable without embedding images or font files. No DOM imports:
// `markPolygons` is tested under plain `node --test`.

import { t } from './i18n.js';

export const BRAND_NAME = 'LvPrime';

// Mirrors the --brand-* tokens in src/styles/tokens.css (checked by tests/unit/brand.test.js).
export const BRAND_RGB = {
  graphite: [12, 12, 12],
  graphiteDeep: [5, 5, 5],
  volt: [168, 225, 29],
  voltOnLight: [67, 107, 12],
  chalk: [247, 247, 245],
  steel: [225, 225, 220],
  ink: [12, 12, 12],
  muted: [91, 91, 87],
};

const PT_PER_MM = 2.8346;
const MARK_PT = 28;
const WORDMARK_PT = 20;
const FOOTER_TEXT_PT = 8;
const FOOTER_RESERVE_PT = 40;

// Mark geometry on its own 330 x 397 grid, identical to design/brand/mark.svg
// (traced from the logo: an angular L and v).
const MARK_W = 330;
const MARK_H = 397;
const MARK_L = [[0, 0], [78, 68], [78, 296], [19, 355], [49, 355], [77, 327], [155, 327], [206, 397], [0, 397]];
const MARK_V = [[102, 128], [216, 282], [330, 127], [330, 235], [219, 389], [102, 229]];

function toUnit(pt, unit) {
  return unit === 'mm' ? pt / PT_PER_MM : pt;
}

/** Mark polygons scaled so the mark is `height` tall (any unit), origin at its top-left. */
export function markPolygons(height) {
  const k = height / MARK_H;
  const scale = (pts) => pts.map(([px, py]) => [px * k, py * k]);
  return {
    width: MARK_W * k,
    height,
    l: { points: scale(MARK_L), colour: BRAND_RGB.graphite },
    v: { points: scale(MARK_V), colour: BRAND_RGB.graphite },
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

function fillPolygon(doc, x, y, points, colour) {
  doc.setFillColor(...colour);
  const [first, ...rest] = points;
  const deltas = rest.map(([px, py], i) => [px - (i === 0 ? first[0] : rest[i - 1][0]), py - (i === 0 ? first[1] : rest[i - 1][1])]);
  doc.lines(deltas, x + first[0], y + first[1], [1, 1], 'F', true);
}

function drawMark(doc, x, y, height) {
  const { l, v } = markPolygons(height);
  fillPolygon(doc, x, y, l.points, l.colour);
  fillPolygon(doc, x, y, v.points, v.colour);
}

/**
 * Mark + lowercase "prime" (Helvetica, tracked, green on light), top-left at (x, y).
 * Restores the caller's drawing state and returns the y below the lock-up.
 */
export function drawBrandHeader(doc, { x, y, unit }) {
  const state = saveState(doc);
  const markH = toUnit(MARK_PT, unit);
  drawMark(doc, x, y, markH);
  const markW = markPolygons(markH).width;

  const textX = x + markW + toUnit(12, unit);
  const baseline = y + markH * 0.78;
  doc.setFontSize(WORDMARK_PT);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...BRAND_RGB.voltOnLight);
  doc.text('prime', textX, baseline, { charSpace: toUnit(5, unit) });

  restoreState(doc, state);
  return y + markH + toUnit(24, unit);
}

/** Stamps every page with a Steel rule, "LvPrime" and "Page i of n". Call once, after all content. */
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
    doc.setDrawColor(...BRAND_RGB.steel);
    doc.setLineWidth(toUnit(0.75, unit));
    doc.line(margin, ruleY, width - margin, ruleY);
    doc.setFontSize(FOOTER_TEXT_PT);
    doc.setTextColor(...BRAND_RGB.muted);
    doc.setFont('helvetica', 'bold');
    doc.text(BRAND_NAME, margin, textY);
    doc.setFont('helvetica', 'normal');
    doc.text(t('pdf.page', { i, n: pageCount }), width - margin, textY, { align: 'right' });
  }

  restoreState(doc, state);
}
