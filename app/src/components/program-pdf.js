// Program week PDF export: builds a plain content model for the week currently shown,
// then renders it with jsPDF as real, selectable text (not a DOM screenshot) and
// triggers a browser download.

import { jsPDF } from 'jspdf';
import { setSafeHtml } from '../lib/safe-html.js';
import { BRAND_NAME, drawBrandFooter, drawBrandHeader, footerReserve } from '../lib/pdf-brand.js';

/**
 * Pure content-model builder — no DOM, no jsPDF — so it's testable with plain
 * `node --test` assertions. `weekDetail` is one week's own parsed routine
 * (GET /api/customers/:slug/program/weeks/:week), never a schedule shared across weeks.
 */
export function buildProgramWeekPdfContent(weekDetail) {
  return {
    weekNumber: weekDetail.weekNumber,
    weekLabel: `Week ${weekDetail.weekNumber}`,
    days: weekDetail.weeklySchedule || [],
    progressionHtml: weekDetail.progressionHtml || null,
  };
}

// Days with no structured `exercises` fall back to their rendered-HTML body (same as the
// on-screen program-day.js fallback) — stripped to plain text via a detached element,
// since the PDF is real text, not a screenshot.
function htmlToPlainText(html) {
  const el = document.createElement('div');
  setSafeHtml(el, html);
  return (el.textContent || '').replace(/\n{3,}/g, '\n\n').trim();
}

const MARGIN_X = 40;
// Keeps content clear of the LvPrime footer band stamped on every page.
const PAGE_BOTTOM_MARGIN = footerReserve('pt') + 20;

function addPageIfNeeded(doc, y) {
  if (y <= doc.internal.pageSize.getHeight() - PAGE_BOTTOM_MARGIN) return y;
  doc.addPage();
  return 50;
}

function renderDay(doc, day, y, maxWidth) {
  y = addPageIfNeeded(doc, y);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text(day.focus ? `${day.day} — ${day.focus}` : day.day, MARGIN_X, y);
  y += 20;

  doc.setFontSize(11);
  if (day.exercises && day.exercises.length) {
    for (const exercise of day.exercises) {
      y = addPageIfNeeded(doc, y);
      doc.setFont('helvetica', 'bold');
      doc.text(exercise.name, MARGIN_X, y);
      y += 14;

      doc.setFont('helvetica', 'normal');
      const metaParts = [exercise.setsReps, exercise.rest ? `Rest ${exercise.rest}` : null].filter(Boolean);
      doc.text(metaParts.join('  ·  '), MARGIN_X + 10, y);
      y += 14;

      if (exercise.formTip) {
        doc.setFont('helvetica', 'italic');
        const tipLines = doc.splitTextToSize(exercise.formTip, maxWidth - 10);
        doc.text(tipLines, MARGIN_X + 10, y);
        y += tipLines.length * 12 + 4;
      }
      y += 6;
    }
  } else {
    doc.setFont('helvetica', 'normal');
    const lines = doc.splitTextToSize(htmlToPlainText(day.html) || 'No details available.', maxWidth);
    doc.text(lines, MARGIN_X, y);
    y += lines.length * 14;
  }

  return y + 20;
}

/**
 * Renders `weekDetail` with jsPDF and triggers a browser download named
 * `<customerSlug>-week-<weekNumber>.pdf`. Empty schedule → an explicit
 * "No schedule available." line rather than a blank/broken file.
 */
export function downloadProgramWeekPdf(weekDetail, customerSlug) {
  const content = buildProgramWeekPdfContent(weekDetail);

  const doc = new jsPDF({ unit: 'pt' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const maxWidth = pageWidth - MARGIN_X * 2;
  doc.setProperties({ title: `${BRAND_NAME} · ${content.weekLabel}`, author: BRAND_NAME });
  let y = drawBrandHeader(doc, { x: MARGIN_X, y: 36, unit: 'pt' }) + 8;

  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.text(content.weekLabel, MARGIN_X, y);
  y += 30;

  if (content.days.length === 0) {
    y = addPageIfNeeded(doc, y);
    doc.setFont('helvetica', 'italic');
    doc.text('No schedule available.', MARGIN_X, y);
    y += 30;
  } else {
    for (const day of content.days) {
      y = renderDay(doc, day, y, maxWidth);
    }
  }

  const progressionText = htmlToPlainText(content.progressionHtml);
  if (progressionText) {
    y = addPageIfNeeded(doc, y);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Progression', MARGIN_X, y);
    y += 18;
    doc.setFont('helvetica', 'normal');
    for (const line of doc.splitTextToSize(progressionText, maxWidth)) {
      y = addPageIfNeeded(doc, y);
      doc.text(line, MARGIN_X, y);
      y += 14;
    }
  }

  drawBrandFooter(doc, { unit: 'pt' });

  const fileName = `${customerSlug}-week-${content.weekNumber}.pdf`;
  const blob = doc.output('blob');
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
