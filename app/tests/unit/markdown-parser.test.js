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
  // Only fully-matched entries are expected to round-trip; the live file also
  // holds placeholder entries and keeps growing, so don't pin the count.
  const entries = parseFeedbackEntries(text).filter((e) => e.raw_matched);
  assert.ok(entries.length > 0, 'expected at least one fully-matched entry in the fixture file');

  const template = extractFeedbackTemplate(text);
  const entry = entries[0];
  const fieldValues = Object.fromEntries(entry.fields_raw.map((f) => [f.label, f.value]));
  const formatted = formatFeedbackEntry(template, {
    date: entry.entry_date,
    label: entry.label,
    fieldValues,
  });

  const originalBlockStart = text.indexOf(formatted.split('\n')[0]);
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

// Inline copy of topiltzin-flores/program.md's English "Rest / Form tip" format;
// the real file is rewritten every week, so the exact exercises can't be pinned.
test('parseProgramDetail extracts exercise rows from an English program (Rest/Form tip)', () => {
  const text = `# Test Program

### Monday - Chest & Back

1. **Barbell Bench Press** - 4 × 6-8 reps - Rest 2 min
   - Form tip: Full range of motion, chest to bar, feet planted
2. **Pull-ups** - 3 × 8 - Rest 90 sec
`;
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

// specs/010-weekly-routine-versioning research.md Decision 4: the 4-slot weekly
// progression note is retired; the progression section itself still renders as HTML.
test('parseProgramDetail keeps the progression section as html and no longer returns weeklyProgression', () => {
  const text = `# Test Program

**Objetivo:** Fuerza

### Monday - Full Body
1. **Squat** - 3 x 8 - Rest 90s

## Progression (4 weeks)

- **Week 1:** Find a comfortable load.
`;
  const detail = parseProgramDetail(text, renderMarkdown);
  assert.equal('weeklyProgression' in detail, false);
  assert.ok(detail.progressionHtml.includes('Find a comfortable load.'));
  assert.equal(detail.weeklySchedule.length, 1);
});
