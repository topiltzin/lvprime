import { addMeasurement, ApiError } from '../api-client.js';
import { todayIso } from '../lib/day-completion.js';
import { formatDate } from '../lib/format.js';
import { t } from '../lib/i18n.js';

// Progress tab: one line chart per measurement from the notes.md measurements table, plus a
// form that adds a dated row. Hand-drawn SVG like trend-chart.js (no charting library).
const SVG_NS = 'http://www.w3.org/2000/svg';
const DEFAULT_COLUMNS = ['Peso', 'Pecho', 'Cintura', 'Abdomen', 'Pierna', 'Bíceps', 'Pantorrilla'];
const UNIT_BY_NAME = { peso: 'kg', weight: 'kg' };

const unitFor = (name) => UNIT_BY_NAME[name.toLowerCase()] || 'cm';
const fmt = (n) => (Number.isInteger(n) ? String(n) : n.toFixed(1).replace(/\.0$/, ''));

function svgEl(name, attrs = {}) {
  const el = document.createElementNS(SVG_NS, name);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  return el;
}

/** Points for one column: [{ date, value }] where the client was measured. */
export function seriesFor(measurements, column) {
  return measurements.rows
    .filter((r) => r.values[column] != null)
    .map((r) => ({ date: r.date, value: r.values[column] }));
}

function dayNumber(iso) {
  return Date.parse(`${iso}T00:00:00Z`) / 86400000;
}

function renderLineChart(name, points) {
  const W = 320;
  const H = 120;
  const pad = { l: 8, r: 8, t: 14, b: 22 };
  const values = points.map((p) => p.value);
  let min = Math.min(...values);
  let max = Math.max(...values);
  // Pad the range so a flat line sits mid-chart and small changes stay visible but honest.
  const span = Math.max(max - min, max * 0.02, 1);
  min -= span * 0.25;
  max += span * 0.25;

  const t0 = dayNumber(points[0].date);
  const t1 = dayNumber(points.at(-1).date);
  const x = (p) => (t1 === t0 ? W / 2 : pad.l + ((dayNumber(p.date) - t0) / (t1 - t0)) * (W - pad.l - pad.r));
  const y = (p) => pad.t + (1 - (p.value - min) / (max - min)) * (H - pad.t - pad.b);

  const svg = svgEl('svg', { viewBox: `0 0 ${W} ${H}`, class: 'progress-chart-svg', role: 'img',
    'aria-label': `${name}: ${points.map((p) => `${formatDate(p.date)} ${fmt(p.value)}`).join(', ')}` });

  if (points.length > 1) {
    svg.appendChild(svgEl('polyline', {
      points: points.map((p) => `${x(p).toFixed(1)},${y(p).toFixed(1)}`).join(' '),
      class: 'progress-line', fill: 'none',
    }));
  }
  points.forEach((p, i) => {
    const last = i === points.length - 1;
    svg.appendChild(svgEl('circle', { cx: x(p).toFixed(1), cy: y(p).toFixed(1), r: last ? 5 : 3.5,
      class: last ? 'progress-dot progress-dot-last' : 'progress-dot' }));
  });

  const label = (p, anchor) => {
    const t = svgEl('text', { x: anchor === 'start' ? pad.l : anchor === 'end' ? W - pad.r : W / 2, y: H - 6,
      'text-anchor': anchor, class: 'progress-axis' });
    t.textContent = formatDate(p.date);
    svg.appendChild(t);
  };
  label(points[0], points.length === 1 ? 'middle' : 'start');
  if (points.length > 1) label(points.at(-1), 'end');
  return svg;
}

function renderMetricCard(name, points) {
  const card = document.createElement('article');
  card.className = 'card progress-card';

  const head = document.createElement('div');
  head.className = 'progress-card-head';
  const title = document.createElement('h4');
  title.textContent = name;
  const unit = unitFor(name);
  const latest = document.createElement('div');
  latest.className = 'progress-latest';
  latest.textContent = `${fmt(points.at(-1).value)} ${unit}`;
  head.append(title, latest);
  card.appendChild(head);

  card.appendChild(renderLineChart(name, points));

  const deltas = document.createElement('p');
  deltas.className = 'progress-deltas';
  if (points.length < 2) {
    deltas.textContent = t('progress.oneSoFar');
  } else {
    const change = (from) => {
      const d = Math.round((points.at(-1).value - from.value) * 10) / 10;
      return `${d > 0 ? '+' : d < 0 ? '−' : ''}${fmt(Math.abs(d))} ${unit}`;
    };
    deltas.textContent = t('progress.deltas', {
      recent: change(points.at(-2)),
      recentDate: formatDate(points.at(-2).date),
      first: change(points[0]),
      firstDate: formatDate(points[0].date),
    });
  }
  card.appendChild(deltas);
  return card;
}

function renderMeasurementForm(columns, slug, onAdded) {
  const wrap = document.createElement('section');
  wrap.className = 'card log-session-form-wrap';
  const h = document.createElement('h3');
  h.textContent = t('progress.logTitle');
  const intro = document.createElement('p');
  intro.className = 'form-intro';
  intro.textContent = t('progress.intro');
  wrap.append(h, intro);

  const form = document.createElement('form');
  form.className = 'feedback-form';
  const dateLabel = document.createElement('label');
  dateLabel.textContent = t('common.date');
  const date = document.createElement('input');
  date.type = 'date';
  date.value = todayIso();
  date.required = true;
  dateLabel.appendChild(date);
  const dateRow = document.createElement('div');
  dateRow.className = 'form-row';
  dateRow.appendChild(dateLabel);
  form.appendChild(dateRow);

  const grid = document.createElement('div');
  grid.className = 'form-grid progress-form-grid';
  const inputs = {};
  const addField = (name) => {
    const label = document.createElement('label');
    label.textContent = `${name} (${unitFor(name)})`;
    const input = document.createElement('input');
    input.type = 'number';
    input.inputMode = 'decimal';
    input.step = '0.1';
    input.min = '0';
    input.name = name;
    label.appendChild(input);
    grid.appendChild(label);
    inputs[name] = input;
  };
  columns.forEach(addField);
  form.appendChild(grid);

  const extra = document.createElement('div');
  extra.className = 'form-row';
  const nameLabel = document.createElement('label');
  nameLabel.textContent = t('progress.another');
  const extraName = document.createElement('input');
  extraName.type = 'text';
  extraName.placeholder = t('progress.anotherPlaceholder');
  extraName.maxLength = 40;
  nameLabel.appendChild(extraName);
  const valLabel = document.createElement('label');
  valLabel.textContent = t('progress.value');
  const extraValue = document.createElement('input');
  extraValue.type = 'number';
  extraValue.inputMode = 'decimal';
  extraValue.step = '0.1';
  extraValue.min = '0';
  valLabel.appendChild(extraValue);
  extra.append(nameLabel, valLabel);
  form.appendChild(extra);

  const actions = document.createElement('div');
  actions.className = 'form-actions';
  const error = document.createElement('div');
  error.className = 'field-error';
  error.setAttribute('role', 'alert');
  const submit = document.createElement('button');
  submit.type = 'submit';
  submit.textContent = t('progress.submit');
  actions.append(error, submit);
  form.appendChild(actions);

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    error.textContent = '';
    const values = {};
    for (const [name, input] of Object.entries(inputs)) if (input.value) values[name] = input.value;
    if (extraName.value.trim() && extraValue.value) values[extraName.value.trim()] = extraValue.value;
    if (!Object.keys(values).length) {
      error.textContent = t('progress.none');
      return;
    }
    submit.disabled = true;
    try {
      await addMeasurement(slug, { date: date.value, values });
      await onAdded();
    } catch (err) {
      const first = err instanceof ApiError && err.fields ? Object.entries(err.fields)[0] : null;
      error.textContent = first ? `${first[0] === 'values' ? '' : `${first[0]}: `}${first[1]}` : err.message || t('common.couldNotSave');
    } finally {
      submit.disabled = false;
    }
  });

  wrap.appendChild(form);
  return wrap;
}

export function renderProgressPanel(container, measurements, { slug, onMeasurementAdded }) {
  const columns = measurements.columns.length ? measurements.columns : DEFAULT_COLUMNS;
  const charts = columns
    .map((name) => [name, seriesFor(measurements, name)])
    .filter(([, points]) => points.length > 0);

  if (charts.length) {
    const grid = document.createElement('div');
    grid.className = 'progress-grid';
    for (const [name, points] of charts) grid.appendChild(renderMetricCard(name, points));
    container.appendChild(grid);
  } else {
    const empty = document.createElement('div');
    empty.className = 'empty-state-card';
    empty.textContent = t('progress.empty');
    container.appendChild(empty);
  }

  container.appendChild(renderMeasurementForm(columns, slug, onMeasurementAdded));
}
