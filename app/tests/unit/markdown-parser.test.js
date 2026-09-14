import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  parseFeedbackEntries,
  extractFeedbackTemplate,
  formatFeedbackEntry,
} from '../../server/markdown-parser.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CUSTOMERS_DIR = path.resolve(__dirname, '..', '..', '..', 'customers');

// Constitution Principle I ("never corrupt existing content") requires that
// re-formatting an already-parsed, unmodified entry reproduces its original
// Markdown byte-for-byte. This is the one test kept at the Foundational level
// (T013) per the minimal-tests directive — everything else is covered by one
// integration test per user story.
test('round-trips a real, unmodified entry from topiltzin-flores/feedback.md exactly', () => {
  const text = fs.readFileSync(path.join(CUSTOMERS_DIR, 'topiltzin-flores', 'feedback.md'), 'utf8');
  const entries = parseFeedbackEntries(text);
  assert.equal(entries.length, 1, 'expected exactly one real entry in the fixture file');

  const template = extractFeedbackTemplate(text);
  const entry = entries[0];
  const fieldValues = Object.fromEntries(entry.fields_raw.map((f) => [f.label, f.value]));
  const formatted = formatFeedbackEntry(template, {
    date: entry.entry_date,
    label: entry.label,
    fieldValues,
  });

  const originalBlockStart = text.indexOf(`${'#'.repeat(entry.heading_level)} ${entry.entry_date}`);
  assert.ok(originalBlockStart !== -1, 'could not locate the original entry block in the source file');
  const originalBlock = text.slice(originalBlockStart, originalBlockStart + formatted.length);

  assert.equal(formatted, originalBlock, 'formatted entry must byte-for-byte match the original');
});

test('round-trips a synthetic Jaqueline-style (Spanish, flat ## heading) entry exactly', () => {
  const text = `# Feedback y Progreso: Test

### Formato de Entrada
\`\`\`
## [Fecha] - [Día de semana] - [Grupo muscular/Skills]
- Completó: [Sí/No]
- Energía: [Baja/Normal/Alta]
- Dificultad: [Fácil/Moderada/Difícil]
- Observaciones: [Cualquier nota]
- Impresión general: [Descripción breve]
\`\`\`

---

## 2026-09-21 - Lunes - Piernas A
- Completó: Sí
- Energía: Alta
- Dificultad: Moderada
- Observaciones: Buena sesión
- Impresión general: Moderada
`;

  const entries = parseFeedbackEntries(text);
  assert.equal(entries.length, 1);
  assert.equal(entries[0].raw_matched, true);
  assert.equal(entries[0].completed, true);

  const template = extractFeedbackTemplate(text);
  assert.equal(template.headingLevel, 2);

  const entry = entries[0];
  const fieldValues = Object.fromEntries(entry.fields_raw.map((f) => [f.label, f.value]));
  const formatted = formatFeedbackEntry(template, {
    date: entry.entry_date,
    label: entry.label,
    fieldValues,
  });

  const expected = [
    '## 2026-09-21 - Lunes - Piernas A',
    '- Completó: Sí',
    '- Energía: Alta',
    '- Dificultad: Moderada',
    '- Observaciones: Buena sesión',
    '- Impresión general: Moderada',
  ].join('\n');

  assert.equal(formatted, expected);
});

test('a malformed/partial entry is still returned (never dropped), with raw_matched: false', () => {
  const text = `## 2026-09-01 - Custom Session\n- SomeUnknownField: hello\n`;
  const entries = parseFeedbackEntries(text);
  assert.equal(entries.length, 1);
  assert.equal(entries[0].entry_date, '2026-09-01');
  assert.equal(entries[0].raw_matched, false);
  assert.equal(entries[0].felt, null);
});
