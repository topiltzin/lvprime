import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  parseMeasurements,
  upsertMeasurementText,
  validateMeasurement,
  slugifyName,
} from '../../server/measurements.js';

const NOTES = `# Notas

## Medidas

| Fecha | Peso | Cintura |
|---|---|---|
| 2026-07-31 | 55 | 69.5 |
| 2026-05-01 | — | 73 |

## Qué vigilar
- Codo
`;

test('parses the table, sorts by date and turns — into null', () => {
  const { columns, rows } = parseMeasurements(NOTES);
  assert.deepEqual(columns, ['Peso', 'Cintura']);
  assert.deepEqual(rows.map((r) => r.date), ['2026-05-01', '2026-07-31']);
  assert.equal(rows[0].values.Peso, null);
  assert.equal(rows[1].values.Cintura, 69.5);
});

test('no table → empty result', () => {
  assert.deepEqual(parseMeasurements('# Notas\n- algo'), { columns: [], rows: [] });
  assert.deepEqual(parseMeasurements(undefined), { columns: [], rows: [] });
});

test('parses the real liliana-valdez notes.md', () => {
  const dir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..', 'customers', 'liliana-valdez', 'notes.md');
  if (!fs.existsSync(dir)) return;
  const { columns, rows } = parseMeasurements(fs.readFileSync(dir, 'utf8'));
  assert.equal(columns[0], 'Peso');
  assert.equal(rows.length, 6);
  assert.equal(rows.at(-1).values.Peso, 58);
});

test('appending keeps every other line byte-for-byte', () => {
  const out = upsertMeasurementText(NOTES, { date: '2026-09-27', values: { Peso: 58, Cintura: 70.5 } });
  assert.ok(out.includes('| 2026-07-31 | 55 | 69.5 |'));
  assert.ok(out.includes('| 2026-09-27 | 58 | 70.5 |'));
  assert.ok(out.endsWith('## Qué vigilar\n- Codo\n'));
  assert.equal(parseMeasurements(out).rows.length, 3);
});

test('same date replaces the row and keeps values not resubmitted', () => {
  const out = upsertMeasurementText(NOTES, { date: '2026-07-31', values: { Cintura: 69 } });
  const row = parseMeasurements(out).rows.find((r) => r.date === '2026-07-31');
  assert.equal(row.values.Cintura, 69);
  assert.equal(row.values.Peso, 55);
  assert.equal(parseMeasurements(out).rows.length, 2);
});

test('a new measurement name adds a column and pads older rows', () => {
  const out = upsertMeasurementText(NOTES, { date: '2026-09-27', values: { Cadera: 95 } });
  const parsed = parseMeasurements(out);
  assert.deepEqual(parsed.columns, ['Peso', 'Cintura', 'Cadera']);
  assert.equal(parsed.rows[0].values.Cadera, null);
  assert.equal(parsed.rows.at(-1).values.Cadera, 95);
});

test('creates a Medidas section when notes have none', () => {
  const out = upsertMeasurementText('# Notas\n- algo', { date: '2026-09-27', values: { Peso: 58 } });
  assert.ok(out.startsWith('# Notas\n- algo\n\n## Medidas'));
  assert.equal(parseMeasurements(out).rows[0].values.Peso, 58);
  assert.equal(parseMeasurements(upsertMeasurementText('', { date: '2026-09-27', values: { Peso: 58 } })).rows.length, 1);
});

test('validates date and values', () => {
  assert.equal(validateMeasurement({ date: '2026-09-27', values: { Peso: '58,5', Cintura: '' } }).values.Peso, 58.5);
  assert.ok(validateMeasurement({ date: 'nope', values: { Peso: 58 } }).fields.date);
  assert.ok(validateMeasurement({ date: '2026-09-27', values: {} }).fields.values);
  assert.ok(validateMeasurement({ date: '2026-09-27', values: { Peso: -1 } }).fields.Peso);
  assert.ok(validateMeasurement({ date: '2026-09-27', values: { 'a|b': 1 } }).fields.values);
});

test('slugifyName strips accents and punctuation', () => {
  assert.equal(slugifyName('María José Peña'), 'maria-jose-pena');
  assert.equal(slugifyName('  Ana  '), 'ana');
  assert.equal(slugifyName('!!'), null);
});
