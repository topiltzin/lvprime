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

// SC-003: the rebrand must not change what status and action colours mean.
test('status and action colours are unchanged by the rebrand', () => {
  const { light, dark } = tokenBlocks();
  assert.deepEqual(
    {
      accent: light.accent, 'accent-hover': light['accent-hover'], 'accent-deep': light['accent-deep'],
      'accent-tint': light['accent-tint'], 'accent-contrast': light['accent-contrast'],
      danger: light.danger, 'danger-tint': light['danger-tint'], 'danger-border': light['danger-border'],
      'warning-deep': light['warning-deep'], 'warning-tint': light['warning-tint'],
    },
    {
      accent: '#1f7a4d', 'accent-hover': '#186a42', 'accent-deep': '#143d2b',
      'accent-tint': '#e8f5ee', 'accent-contrast': '#ffffff',
      danger: '#c23b22', 'danger-tint': '#fee2e2', 'danger-border': '#fca5a5',
      'warning-deep': '#8a5a1c', 'warning-tint': '#fdf0e2',
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
      accent: '#3ddc97', 'accent-hover': '#2fc984', 'accent-deep': '#3ddc97',
      'accent-tint': '#10251b', 'accent-contrast': '#10251b',
      'danger-tint': '#3a1712', 'danger-border': '#5c261a',
      'warning-deep': '#e8b979', 'warning-tint': '#3a2a12',
    },
  );
});

// specs/011 contracts/pdf-brand.md "Tests": the vector mark and palette drawn into the
// PDFs stay identical to the SVG masters and tokens.css.
test('markSegments matches the 64-grid mark and scales linearly', async () => {
  const { markSegments, BRAND_RGB } = await import('../../src/lib/pdf-brand.js');
  const full = markSegments(64);
  assert.deepEqual(full.tile, { x: 0, y: 0, w: 64, h: 64, r: 15 });
  assert.equal(full.strokeWidth, 5);
  assert.deepEqual(full.strokes.map((s) => [s.from, s.to]), [
    [[18, 16], [18, 46]],
    [[18, 46], [34, 46]],
    [[25, 26], [34, 46]],
    [[34, 46], [47, 16]],
  ]);
  assert.deepEqual(full.strokes.at(-1).colour, BRAND_RGB.brass);

  const half = markSegments(32);
  assert.deepEqual(half.tile, { x: 0, y: 0, w: 32, h: 32, r: 7.5 });
  assert.equal(half.strokeWidth, 2.5);
  assert.deepEqual(half.strokes[3].to, [23.5, 8]);
});

test('PDF palette matches the brand tokens and name', async () => {
  const { BRAND_RGB, BRAND_NAME } = await import('../../src/lib/pdf-brand.js');
  const { light } = tokenBlocks();
  const hex = (rgb) => '#' + rgb.map((n) => n.toString(16).padStart(2, '0')).join('').toUpperCase();
  assert.equal(BRAND_NAME, 'LvPrime');
  assert.equal(hex(BRAND_RGB.evergreen), light['brand-evergreen']);
  assert.equal(hex(BRAND_RGB.evergreenDeep), light['brand-evergreen-deep']);
  assert.equal(hex(BRAND_RGB.brass), light['brand-brass']);
  assert.equal(hex(BRAND_RGB.brassOnLight), light['brand-brass-on-light']);
  assert.equal(hex(BRAND_RGB.ivory), light['brand-ivory']);
  assert.equal(hex(BRAND_RGB.stone), light['brand-stone']);
  assert.equal(hex(BRAND_RGB.ink), light.ink);
  assert.equal(hex(BRAND_RGB.muted), light.muted);
});
