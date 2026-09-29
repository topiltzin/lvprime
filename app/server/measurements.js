// Body measurements live in a "## Medidas" (or "## Measurements") Markdown table inside
// notes.md, one row per date, first column the date:
//
//   | Fecha | Peso | Cintura |
//   |---|---|---|
//   | 2026-07-31 | 55 | 69.5 |
//
// "—" or an empty cell means "not measured that day". Keeping the table in notes.md
// means existing client files (and the coach's hand edits) keep working unchanged.

export const DEFAULT_MEASUREMENT_COLUMNS = ['Peso', 'Pecho', 'Cintura', 'Abdomen', 'Pierna', 'Bíceps', 'Pantorrilla'];

const SECTION_RE = /^#{1,6}\s*(medidas|measurements)\b/i;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const SEPARATOR_RE = /^\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/;

function splitRow(line) {
  return line
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((cell) => cell.trim());
}

function isTableLine(line) {
  return line.trim().startsWith('|');
}

/** Locates the measurements table: { start, end (exclusive), sectionLine } or null. */
function findTable(lines) {
  const sectionLine = lines.findIndex((l) => SECTION_RE.test(l));
  if (sectionLine === -1) return null;
  let start = -1;
  for (let i = sectionLine + 1; i < lines.length; i++) {
    if (/^#{1,6}\s/.test(lines[i])) return null; // next section began before any table
    if (isTableLine(lines[i])) {
      start = i;
      break;
    }
  }
  if (start === -1) return null;
  let end = start;
  while (end < lines.length && isTableLine(lines[end])) end++;
  return { start, end, sectionLine };
}

function toNumber(cell) {
  const n = Number(cell.replace(',', '.').replace(/[^\d.\-]/g, ''));
  return cell && Number.isFinite(n) && /\d/.test(cell) ? n : null;
}

/**
 * @returns {{ columns: string[], rows: Array<{ date: string, values: Record<string, number|null> }> }}
 * Empty columns/rows when the notes have no measurements table. Rows are sorted by date.
 */
export function parseMeasurements(notesMd) {
  const empty = { columns: [], rows: [] };
  if (typeof notesMd !== 'string' || !notesMd) return empty;
  const lines = notesMd.split('\n');
  const table = findTable(lines);
  if (!table) return empty;

  const [dateHeader, ...columns] = splitRow(lines[table.start]);
  if (!dateHeader || columns.length === 0) return empty;

  const rows = [];
  for (let i = table.start + 1; i < table.end; i++) {
    if (SEPARATOR_RE.test(lines[i])) continue;
    const [date, ...cells] = splitRow(lines[i]);
    if (!DATE_RE.test(date)) continue;
    const values = {};
    columns.forEach((col, idx) => {
      values[col] = toNumber(cells[idx] ?? '');
    });
    rows.push({ date, values });
  }
  rows.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  return { columns, rows };
}

/**
 * Validates a submitted measurement. Returns { ok: true, date, values } or { ok: false, fields }.
 * `values` maps a column name to a positive number; blanks are dropped.
 */
export function validateMeasurement(body) {
  const fields = {};
  const date = typeof body?.date === 'string' ? body.date.trim() : '';
  if (!DATE_RE.test(date) || Number.isNaN(Date.parse(date))) fields.date = 'Use a valid date (YYYY-MM-DD).';

  const values = {};
  const raw = body?.values && typeof body.values === 'object' && !Array.isArray(body.values) ? body.values : {};
  for (const [name, value] of Object.entries(raw)) {
    if (value === '' || value === null || value === undefined) continue;
    const n = typeof value === 'number' ? value : Number(String(value).replace(',', '.'));
    const cleanName = name.trim();
    if (!cleanName || /[|\n\r]/.test(cleanName) || cleanName.length > 40) {
      fields.values = 'Invalid measurement name.';
    } else if (!Number.isFinite(n) || n <= 0 || n > 500) {
      fields[cleanName] = 'Enter a number between 0 and 500.';
    } else {
      values[cleanName] = n;
    }
  }
  if (!fields.values && Object.keys(values).length === 0 && Object.keys(fields).length === 0) {
    fields.values = 'Enter at least one measurement.';
  }
  return Object.keys(fields).length ? { ok: false, fields } : { ok: true, date, values };
}

const formatCell = (n) => (n === undefined || n === null ? '—' : String(n));

/**
 * Returns notes Markdown with the measurement added: replaces the row for the same date,
 * otherwise appends. Columns follow the existing table; new column names are added on the
 * right. Creates a "## Medidas" section at the end when none exists. Never touches other content.
 */
export function upsertMeasurementText(notesMd, { date, values }) {
  const content = typeof notesMd === 'string' ? notesMd : '';
  const lines = content.split('\n');
  const table = findTable(lines);

  if (!table) {
    const columns = [...DEFAULT_MEASUREMENT_COLUMNS];
    for (const name of Object.keys(values)) if (!columns.includes(name)) columns.push(name);
    const block = [
      '## Medidas',
      '',
      `| Fecha | ${columns.join(' | ')} |`,
      `|${'---|'.repeat(columns.length + 1)}`,
      `| ${date} | ${columns.map((c) => formatCell(values[c])).join(' | ')} |`,
    ].join('\n');
    return content.trim() ? `${content.replace(/\s+$/, '')}\n\n${block}\n` : `${block}\n`;
  }

  const existing = parseMeasurements(content);
  const columns = [...existing.columns];
  const added = Object.keys(values).filter((name) => !columns.includes(name));
  columns.push(...added);

  const header = splitRow(lines[table.start]);
  const rowLines = [];
  let replaced = false;
  for (let i = table.start + 1; i < table.end; i++) {
    const line = lines[i];
    if (SEPARATOR_RE.test(line)) continue;
    const cells = splitRow(line);
    if (cells[0] === date) {
      const old = existing.rows.find((r) => r.date === date);
      const merged = columns.map((c) => formatCell(values[c] ?? old?.values[c]));
      rowLines.push(`| ${date} | ${merged.join(' | ')} |`);
      replaced = true;
    } else {
      // Keep untouched rows byte-for-byte, padding only when columns were added.
      rowLines.push(added.length ? `${line.replace(/\|\s*$/, '')}${' | —'.repeat(added.length)} |` : line);
    }
  }
  if (!replaced) rowLines.push(`| ${date} | ${columns.map((c) => formatCell(values[c])).join(' | ')} |`);

  const tableLines = [
    added.length ? `| ${[header[0], ...columns].join(' | ')} |` : lines[table.start],
    added.length ? `|${'---|'.repeat(columns.length + 1)}` : lines[table.start + 1] ?? `|${'---|'.repeat(columns.length + 1)}`,
    ...rowLines,
  ];
  return [...lines.slice(0, table.start), ...tableLines, ...lines.slice(table.end)].join('\n');
}

/** "María José Peña" → "maria-jose-pena"; null when nothing usable remains. */
export function slugifyName(name) {
  const slug = String(name ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 100)
    .replace(/-+$/, '');
  return slug.length >= 3 ? slug : null;
}
