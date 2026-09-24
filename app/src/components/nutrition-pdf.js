import { jsPDF } from 'jspdf';
import { BRAND_NAME, BRAND_RGB, drawBrandFooter, drawBrandHeader, footerReserve } from '../lib/pdf-brand.js';

const MARGIN_X = 15;
const MARGIN_Y = 12;
const TITLE_SIZE = 14;
const SUBTITLE_SIZE = 9;
const SECTION_SIZE = 12;
const BODY_SIZE = 10;
const LINE_HEIGHT = 5;
const MAX_WIDTH = 180;
const PAGE_HEIGHT = 297;
// Stays above the LvPrime footer band (footerReserve) stamped on every page.
const PAGE_BOTTOM = Math.min(280, PAGE_HEIGHT - footerReserve('mm') - 3);

// LvPrime palette (specs/011 data-model.md BrandPalette)
const COLORS = {
  headerBg: BRAND_RGB.plum,   // Section bars, table headers, title rule
  headerText: [255, 255, 255],     // White
  sectionBg: [236, 240, 241],      // Light gray
  sectionText: BRAND_RGB.plum,
  tableBorder: BRAND_RGB.mist,
  tableAlt: [248, 249, 250],       // Very light gray
  text: [52, 73, 94],              // Dark text
};

function isTableRow(line) {
  return line.trim().startsWith('|') && line.trim().endsWith('|');
}

function parseTable(lines) {
  const tableLines = [];
  let i = 0;
  while (i < lines.length && isTableRow(lines[i])) {
    tableLines.push(lines[i]);
    i++;
  }
  return { table: tableLines, remainingLines: lines.slice(i) };
}

function formatTableRow(row) {
  return row.split('|').map(cell => cell.trim()).filter(cell => cell && cell !== '---');
}

function extractSections(markdown) {
  const lines = markdown.split('\n');
  const sections = [];
  let current = null;
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (line.startsWith('## ')) {
      if (current) sections.push(current);
      current = { title: line.replace(/^## /, ''), content: [], tables: [] };
      i++;
    } else if (current && line.trim()) {
      if (isTableRow(line)) {
        const tableLines = [];
        while (i < lines.length && isTableRow(lines[i])) {
          tableLines.push(formatTableRow(lines[i]));
          i++;
        }
        if (tableLines.length > 0) {
          current.tables.push(tableLines);
        }
        continue;
      } else if (!line.startsWith('#')) {
        const text = line.replace(/^[-•*]\s+/, '').trim();
        if (text && text !== '---') current.content.push(text);
        i++;
      } else {
        i++;
      }
    } else {
      i++;
    }
  }

  if (current) sections.push(current);
  return sections;
}

function addStyledSection(doc, title, x, y) {
  const boxHeight = 8;

  // Header background box
  doc.setFillColor(...COLORS.headerBg);
  doc.rect(x, y, MAX_WIDTH + 10, boxHeight, 'F');

  // Header text
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(SECTION_SIZE);
  doc.setTextColor(...COLORS.headerText);
  doc.text(title, x + 3, y + 5.5);

  // Reset text color
  doc.setTextColor(...COLORS.text);

  return y + boxHeight + 3;
}

function addTable(doc, tableData, x, y, width) {
  if (!tableData || tableData.length === 0) return y;

  const cellPadding = 2;
  const rowHeight = 7;
  const colWidth = width / tableData[0].length;

  // Header row
  doc.setFillColor(...COLORS.sectionBg);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(BODY_SIZE - 1);
  doc.setTextColor(...COLORS.sectionText);

  let currentY = y;

  tableData.forEach((row, rowIndex) => {
    if (currentY > PAGE_BOTTOM) return;

    // Alternate row colors for better readability
    if (rowIndex > 0 && rowIndex % 2 === 0) {
      doc.setFillColor(...COLORS.tableAlt);
      doc.rect(x, currentY, width, rowHeight, 'F');
    }

    // Draw borders
    doc.setDrawColor(...COLORS.tableBorder);
    doc.setLineWidth(0.3);
    doc.rect(x, currentY, width, rowHeight);

    // Draw column borders
    let colX = x;
    row.forEach((cell, colIndex) => {
      if (colIndex < row.length - 1) {
        doc.line(colX + colWidth, currentY, colX + colWidth, currentY + rowHeight);
      }

      // Cell text
      doc.setFont('helvetica', rowIndex === 0 ? 'bold' : 'normal');
      const textColor = rowIndex === 0 ? COLORS.headerText : COLORS.text;
      doc.setTextColor(...textColor);

      if (rowIndex === 0) {
        doc.setFillColor(...COLORS.headerBg);
        doc.rect(colX, currentY, colWidth, rowHeight, 'F');
        doc.setTextColor(...COLORS.headerText);
      }

      const wrappedText = doc.splitTextToSize(cell, colWidth - 2);
      doc.text(wrappedText[0] || '', colX + cellPadding, currentY + 4);

      colX += colWidth;
    });

    currentY += rowHeight;
  });

  return currentY + 2;
}

export function downloadNutritionPdf(customerName, nutritionMarkdown) {
  const doc = new jsPDF('p', 'mm', 'a4');
  const sections = extractSections(nutritionMarkdown);

  doc.setProperties({
    title: `Nutrition Plan - ${customerName}`,
    author: BRAND_NAME,
  });

  const titleY = drawBrandHeader(doc, { x: MARGIN_X, y: MARGIN_Y, unit: 'mm' }) + 2;

  // Title with styling
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(TITLE_SIZE);
  doc.setTextColor(...COLORS.sectionText);
  doc.text(`${customerName}`, MARGIN_X, titleY);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(SUBTITLE_SIZE);
  doc.setTextColor(120, 120, 120);
  doc.text('Personalized Nutrition Plan', MARGIN_X, titleY + 6);

  // Subtitle underline
  doc.setDrawColor(...COLORS.headerBg);
  doc.setLineWidth(1);
  doc.line(MARGIN_X, titleY + 8, MARGIN_X + 60, titleY + 8);

  let y = titleY + 14;

  for (const section of sections) {
    if (y > PAGE_BOTTOM) {
      doc.addPage();
      y = MARGIN_Y;
    }

    // Add styled section header
    y = addStyledSection(doc, section.title, MARGIN_X, y);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(BODY_SIZE);
    doc.setTextColor(...COLORS.text);

    // Add content lines
    for (const line of section.content) {
      if (y > PAGE_BOTTOM) {
        doc.addPage();
        y = MARGIN_Y;
      }
      const wrapped = doc.splitTextToSize(line, MAX_WIDTH);
      for (const wLine of wrapped) {
        doc.text(`• ${wLine}`, MARGIN_X + 2, y);
        y += LINE_HEIGHT;
      }
    }

    // Add tables
    for (const table of section.tables) {
      if (y > PAGE_BOTTOM) {
        doc.addPage();
        y = MARGIN_Y;
      }
      y = addTable(doc, table, MARGIN_X, y, MAX_WIDTH);
    }

    y += 2;
  }

  drawBrandFooter(doc, { unit: 'mm' });

  const filename = `nutrition-plan-${customerName.toLowerCase().replace(/\s+/g, '-')}.pdf`;
  doc.save(filename);
}
