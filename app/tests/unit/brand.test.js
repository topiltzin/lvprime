import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// specs/011 research.md R8: brand guard rails. No legacy names in user-visible source,
// status colours untouched by the rebrand, and the PDF mark/palette kept in sync with CSS.

const APP_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const LEGACY_STRINGS = ['Lv Fitness', 'Personalized Training', 'Lili Trainer'];

function sourceFiles(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.(js|css)$/.test(name) ? [path] : [];
  });
}

test('no legacy brand names remain in the app shell or src/', () => {
  const files = [join(APP_DIR, 'index.html'), ...sourceFiles(join(APP_DIR, 'src'))];
  for (const file of files) {
    const text = readFileSync(file, 'utf8');
    for (const legacy of LEGACY_STRINGS) {
      assert.ok(!text.includes(legacy), `${file} still contains "${legacy}"`);
    }
  }
});

test('page title is LvPrime', () => {
  const html = readFileSync(join(APP_DIR, 'index.html'), 'utf8');
  assert.match(html, /<title>LvPrime/);
});

// Reads `--name: value;` declarations from one block of tokens.css.
function declarations(block) {
  return Object.fromEntries([...block.matchAll(/--([a-z0-9-]+):\s*([^;]+);/gi)].map((m) => [m[1], m[2].trim()]));
}

function tokenBlocks() {
  const css = readFileSync(join(APP_DIR, 'src', 'styles', 'tokens.css'), 'utf8');
  const darkStart = css.indexOf('@media (prefers-color-scheme: dark)');
  const rootStart = css.indexOf(':root');
  return {
    light: declarations(css.slice(rootStart, css.indexOf('@media', rootStart))),
    dark: declarations(css.slice(darkStart)),
  };
}

// Locks the graphite/volt status and action colours so they only change deliberately.
test('status and action colours match the locked palette', () => {
  const { light, dark } = tokenBlocks();
  assert.deepEqual(
    {
      accent: light.accent, 'accent-hover': light['accent-hover'], 'accent-deep': light['accent-deep'],
      'accent-tint': light['accent-tint'], 'accent-contrast': light['accent-contrast'],
      'accent-fill': light['accent-fill'],
      danger: light.danger, 'danger-tint': light['danger-tint'], 'danger-border': light['danger-border'],
      'warning-deep': light['warning-deep'], 'warning-tint': light['warning-tint'],
    },
    {
      accent: '#4B6B0A', 'accent-hover': '#3A5306', 'accent-deep': '#3A5306',
      'accent-tint': '#EEF5DC', 'accent-contrast': '#14170F',
      'accent-fill': '#C2EB57',
      danger: '#B42318', 'danger-tint': '#FDE8E6', 'danger-border': '#F4B4AD',
      'warning-deep': '#8F5200', 'warning-tint': '#FFF1D6',
    },
  );
  assert.deepEqual(
    {
      accent: dark.accent, 'accent-hover': dark['accent-hover'], 'accent-deep': dark['accent-deep'],
      'accent-tint': dark['accent-tint'], 'accent-contrast': dark['accent-contrast'],
      'danger-tint': dark['danger-tint'], 'danger-border': dark['danger-border'],
      'warning-deep': dark['warning-deep'], 'warning-tint': dark['warning-tint'],
    },
    {
      accent: '#C2EB57', 'accent-hover': '#D2F27A', 'accent-deep': '#C2EB57',
      'accent-tint': '#252D16', 'accent-contrast': '#14170F',
      'danger-tint': '#3A1A18', 'danger-border': '#6B2A25',
      'warning-deep': '#F0B34A', 'warning-tint': '#33270F',
    },
  );
});

// specs/011 contracts/pdf-brand.md "Tests": the vector mark and palette drawn into the
// PDFs stay identical to the SVG masters and tokens.css.
test('markSegments matches the 64-grid mark and scales linearly', async () => {
  const { markSegments, BRAND_RGB } = await import('../../src/lib/pdf-brand.js');
  const full = markSegments(64);
  assert.deepEqual(full.tile, { x: 0, y: 0, w: 64, h: 64, r: 16 });
  assert.equal(full.strokeWidth, 6.5);
  assert.deepEqual(full.strokes.map((s) => [s.from, s.to]), [
    [[16, 19], [16, 48]],
    [[16, 48], [24, 48]],
    [[26.5, 28], [35.5, 48]],
    [[35.5, 48], [49, 13]],
  ]);
  assert.deepEqual(full.strokes.at(-1).colour, BRAND_RGB.volt);

  const half = markSegments(32);
  assert.deepEqual(half.tile, { x: 0, y: 0, w: 32, h: 32, r: 8 });
  assert.equal(half.strokeWidth, 3.25);
  assert.deepEqual(half.strokes[3].to, [24.5, 6.5]);
});

test('PDF palette matches the brand tokens and name', async () => {
  const { BRAND_RGB, BRAND_NAME } = await import('../../src/lib/pdf-brand.js');
  const { light } = tokenBlocks();
  const hex = (rgb) => '#' + rgb.map((n) => n.toString(16).padStart(2, '0')).join('').toUpperCase();
  assert.equal(BRAND_NAME, 'LvPrime');
  assert.equal(hex(BRAND_RGB.graphite), light['brand-graphite']);
  assert.equal(hex(BRAND_RGB.graphiteDeep), light['brand-graphite-deep']);
  assert.equal(hex(BRAND_RGB.volt), light['brand-volt']);
  assert.equal(hex(BRAND_RGB.voltOnLight), light['brand-volt-on-light']);
  assert.equal(hex(BRAND_RGB.chalk), light['brand-chalk']);
  assert.equal(hex(BRAND_RGB.steel), light['brand-steel']);
  assert.equal(hex(BRAND_RGB.ink), light.ink);
  assert.equal(hex(BRAND_RGB.muted), light.muted);
});
