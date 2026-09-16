import { jsPDF } from 'jspdf';

const MARGIN_X = 15;
const MARGIN_Y = 12;
const TITLE_SIZE = 12;
const SECTION_SIZE = 11;
const BODY_SIZE = 10;
const LINE_HEIGHT = 4;
const MAX_WIDTH = 180;

function extractSections(markdown) {
  const lines = markdown.split('\n');
  const sections = [];
  let current = null;

  for (const line of lines) {
    if (line.startsWith('## ')) {
      if (current) sections.push(current);
      current = { title: line.replace(/^## /, ''), content: [] };
    } else if (current && line.trim() && !line.startsWith('#')) {
      const text = line.replace(/^[-•*]\s+/, '').trim();
      if (text) current.content.push(text);
    }
  }
  if (current) sections.push(current);
  return sections;
}

export function downloadNutritionPdf(customerName, nutritionMarkdown) {
  const doc = new jsPDF('p', 'mm', 'a4');
  const sections = extractSections(nutritionMarkdown);

  doc.setProperties({
    title: `Nutrition Plan - ${customerName}`,
    author: 'Lili Trainer',
  });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(TITLE_SIZE);
  doc.text(`${customerName}`, MARGIN_X, MARGIN_Y);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(BODY_SIZE - 1);
  doc.text('Personalized Nutrition Plan', MARGIN_X, MARGIN_Y + 5);

  let y = MARGIN_Y + 12;

  for (const section of sections) {
    if (y > 275) {
      doc.addPage();
      y = MARGIN_Y;
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(SECTION_SIZE);
    doc.text(section.title, MARGIN_X, y);
    y += 6;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(BODY_SIZE);

    for (const line of section.content) {
      if (y > 280) {
        doc.addPage();
        y = MARGIN_Y;
      }
      const wrapped = doc.splitTextToSize(line, MAX_WIDTH);
      for (const wLine of wrapped) {
        doc.text(wLine, MARGIN_X, y);
        y += LINE_HEIGHT;
      }
    }
    y += 3;
  }

  const filename = `nutrition-plan-${customerName.toLowerCase().replace(/\s+/g, '-')}.pdf`;
  doc.save(filename);
}
