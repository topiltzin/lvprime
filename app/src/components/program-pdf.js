// Program week PDF export (User Story 2 / contracts/pdf-export-download.md): builds a
// plain content model for whichever week is currently selected, then renders it with
// jsPDF as real, selectable text (not a DOM screenshot — research.md §1) and triggers a
// browser download.

import { jsPDF } from 'jspdf';
import { resolveProgressionText } from './week-subnav.js';

/**
 * Pure content-model builder — no DOM, no jsPDF — so it's testable with plain
 * `node --test` assertions (data-model.md's Program PDF Document).
 */
export function buildProgramWeekPdfContent(weekNumber, programDetail) {
  return {
    weekLabel: `Week ${weekNumber}`,
    days: programDetail.weeklySchedule || [],
    progressionText: resolveProgressionText(weekNumber, programDetail.weeklyProgression),
  };
}

// Days with no structured `exercises` fall back to their rendered-HTML body (same as the
// on-screen program-day.js fallback) — stripped to plain text via a detached element,
// since the PDF is real text, not a screenshot.
function htmlToPlainText(html) {
  const el = document.createElement('div');
  el.innerHTML = html || '';
  return (el.textContent || '').replace(/\n{3,}/g, '\n\n').trim();
}

const MARGIN_X = 40;
const PAGE_BOTTOM_MARGIN = 60;

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
 * Builds the content model for `weekNumber`, renders it with jsPDF, and triggers a
 * browser download named `<customerSlug>-week-<weekNumber>.pdf` (FR-006, FR-007, FR-008).
 * Empty schedule → an explicit "No schedule available." line rather than a blank/broken
 * file (spec.md Edge Cases).
 */
export function downloadProgramWeekPdf(weekNumber, programDetail, customerSlug) {
  const content = buildProgramWeekPdfContent(weekNumber, programDetail);

  const doc = new jsPDF({ unit: 'pt' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const maxWidth = pageWidth - MARGIN_X * 2;
  let y = 50;

  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.text(content.weekLabel, MARGIN_X, y);
  y += 30;

  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('Progression', MARGIN_X, y);
  y += 18;
  doc.setFont('helvetica', 'normal');
  const progressionLines = doc.splitTextToSize(content.progressionText, maxWidth);
  doc.text(progressionLines, MARGIN_X, y);
  y += progressionLines.length * 14 + 16;

  if (content.days.length === 0) {
    y = addPageIfNeeded(doc, y);
    doc.setFont('helvetica', 'italic');
    doc.text('No schedule available.', MARGIN_X, y);
  } else {
    for (const day of content.days) {
      y = renderDay(doc, day, y, maxWidth);
    }
  }

  const fileName = `${customerSlug}-week-${weekNumber}.pdf`;
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
