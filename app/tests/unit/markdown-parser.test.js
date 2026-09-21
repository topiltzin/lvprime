import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  parseFeedbackEntries,
  extractFeedbackTemplate,
  formatFeedbackEntry,
  parseProgramDetail,
} from '../../server/markdown-parser.js';
import { renderMarkdown } from '../../server/markdown-render.js';

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

// User Story 2 / contracts/exercise-row-parsing.md: structured exercise rows extracted
// from real, unmodified customer program files — Spanish and English authoring alike.
test('parseProgramDetail extracts exercise rows from a real Spanish program (jaqueline-orellano, Descanso/Forma)', () => {
  const text = fs.readFileSync(path.join(CUSTOMERS_DIR, 'jaqueline-orellano', 'program.md'), 'utf8');
  const detail = parseProgramDetail(text, renderMarkdown);

  const monday = detail.weeklySchedule.find((d) => /^LUNES/i.test(d.day));
  assert.ok(monday, 'expected a Monday ("LUNES") day block');
  assert.ok(monday.exercises.length > 0, 'expected at least one extracted exercise');
  assert.ok(monday.html.length > 0, 'the existing html field must remain populated');

  const squat = monday.exercises[0];
  assert.equal(squat.name, 'Sentadilla libre / Goblet squat');
  assert.equal(squat.setsReps, '3 x 8-10');
  assert.equal(squat.rest, '90-120 seg');
  assert.equal(squat.formTip, 'Rodillas alineadas con tobillos, bajar controlado');
});

test('parseProgramDetail extracts exercise rows from a real English program (topiltzin-flores, Rest/Form tip)', () => {
  const text = fs.readFileSync(path.join(CUSTOMERS_DIR, 'topiltzin-flores', 'program.md'), 'utf8');
  const detail = parseProgramDetail(text, renderMarkdown);

  const monday = detail.weeklySchedule.find((d) => /^Monday/i.test(d.day));
  assert.ok(monday, 'expected a Monday day block');
  assert.ok(monday.exercises.length > 0, 'expected at least one extracted exercise');

  const bench = monday.exercises[0];
  assert.equal(bench.name, 'Barbell Bench Press');
  assert.equal(bench.setsReps, '4 × 6-8 reps');
  assert.equal(bench.rest, '2 min');
  assert.equal(bench.formTip, 'Full range of motion, chest to bar, feet planted');
});

// specs/007-exercise-library-migration/contracts/exercise-video-linking.md
test('parseProgramDetail resolves videoUrl case-insensitively against a supplied videoLinkMap', () => {
  const text = `# Test Program

### Monday - Full Body
1. **Push-Up** - 3 x 12 - Rest 60s
2. **Squat** - 3 x 8 - Rest 90s
`;
  const videoLinkMap = new Map([
    ['push-up', 'https://www.youtube.com/watch?v=WDIpL0pjun0'], // lowercase in map, "Push-Up" in program
  ]);
  const detail = parseProgramDetail(text, renderMarkdown, videoLinkMap);
  const [pushUp, squat] = detail.weeklySchedule[0].exercises;

  assert.equal(pushUp.videoUrl, 'https://www.youtube.com/watch?v=WDIpL0pjun0');
  assert.equal(squat.videoUrl, null, 'no matching map entry must resolve to null, not throw');
});

test('parseProgramDetail resolves every videoUrl to null when no videoLinkMap is supplied', () => {
  const text = `# Test Program

### Monday - Full Body
1. **Push-Up** - 3 x 12 - Rest 60s
`;
  const detail = parseProgramDetail(text, renderMarkdown);
  assert.equal(detail.weeklySchedule[0].exercises[0].videoUrl, null);
});

test('parseProgramDetail falls back to an empty exercises array (html still populated) for a day with no matching lines', () => {
  const text = `# Test Program

**Objetivo:** Recuperación

### SÁBADO Y DOMINGO - Descanso / Movilidad Ligera
Caminata suave, estiramientos, yoga suave o pilates. Sin entrenamiento de fuerza.
`;
  const detail = parseProgramDetail(text, renderMarkdown);
  assert.equal(detail.weeklySchedule.length, 1);
  const restDay = detail.weeklySchedule[0];
  assert.deepEqual(restDay.exercises, []);
  assert.ok(restDay.html.includes('Caminata suave'), 'the rest-day prose must still render via html');
});

// User Story 1 (003) / contracts/weekly-progression-parsing.md: weekly progression notes
// extracted from a program's existing "Progresión Semanal"/"Weekly Progression" section.
test('parseProgramDetail extracts a well-formed 4-entry weekly progression section (jaqueline-orellano)', () => {
  const text = fs.readFileSync(path.join(CUSTOMERS_DIR, 'jaqueline-orellano', 'program.md'), 'utf8');
  const detail = parseProgramDetail(text, renderMarkdown);

  assert.equal(detail.weeklyProgression.length, 4);
  assert.deepEqual(
    detail.weeklyProgression.map((e) => e.weekNumber),
    [1, 2, 3, 4]
  );
  assert.equal(detail.weeklyProgression[0].text, 'Encontrar una carga cómoda y dominar la técnica.');
  assert.equal(
    detail.weeklyProgression[1].text,
    'Aumentar progresivamente las repeticiones dentro del rango indicado.'
  );
});

test('parseProgramDetail returns an empty weeklyProgression array for a program whose progression section is not in the per-week bullet format (topiltzin-flores uses week-range subheadings)', () => {
  const text = fs.readFileSync(path.join(CUSTOMERS_DIR, 'topiltzin-flores', 'program.md'), 'utf8');
  const detail = parseProgramDetail(text, renderMarkdown);
  assert.deepEqual(detail.weeklyProgression, []);
});

test('parseProgramDetail returns only the weeks a partial weekly progression section covers', () => {
  const text = `# Test Program

**Objetivo:** Fuerza

### Monday - Full Body
1. **Squat** - 3 x 8 - Rest 90s

## Progression (4 weeks)

- **Week 1:** Find a comfortable load.
- **Week 3:** Increase load slightly if form holds.
`;
  const detail = parseProgramDetail(text, renderMarkdown);
  assert.deepEqual(detail.weeklyProgression, [
    { weekNumber: 1, text: 'Find a comfortable load.' },
    { weekNumber: 3, text: 'Increase load slightly if form holds.' },
  ]);
});

test('parseProgramDetail drops an out-of-range week number and still parses the rest of the file', () => {
  const text = `# Test Program

**Objetivo:** Fuerza

### Monday - Full Body
1. **Squat** - 3 x 8 - Rest 90s

## Progresión Semanal (4 semanas)

- **Semana 1:** Carga cómoda.
- **Semana 5:** Fuera de rango, no debe aparecer.
`;
  const detail = parseProgramDetail(text, renderMarkdown);
  assert.deepEqual(detail.weeklyProgression, [{ weekNumber: 1, text: 'Carga cómoda.' }]);
  assert.equal(detail.weeklySchedule.length, 1, 'unrelated schedule parsing must be unaffected');
});

test('parseProgramDetail keeps only the first occurrence of a duplicated week number', () => {
  const text = `# Test Program

## Progresión Semanal (4 semanas)

- **Semana 2:** Primera entrada.
- **Semana 2:** Segunda entrada duplicada.
`;
  const detail = parseProgramDetail(text, renderMarkdown);
  assert.deepEqual(detail.weeklyProgression, [{ weekNumber: 2, text: 'Primera entrada.' }]);
});
