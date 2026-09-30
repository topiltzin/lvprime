import { test } from 'node:test';
import assert from 'node:assert/strict';
import { STRINGS_EN, STRINGS_ES } from '../../src/lib/strings.js';
import { DEFAULT_LANG, getLang, setLangForTests, t, tn } from '../../src/lib/i18n.js';

const placeholders = (s) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

test('Spanish is the default interface language', () => {
  assert.equal(DEFAULT_LANG, 'es');
  assert.equal(getLang(), 'es'); // no saved choice under node
});

test('every English string has a Spanish one with the same placeholders', () => {
  for (const [key, en] of Object.entries(STRINGS_EN)) {
    assert.ok(key in STRINGS_ES, `missing Spanish string: ${key}`);
    assert.deepEqual(placeholders(STRINGS_ES[key]), placeholders(en), `placeholders differ: ${key}`);
  }
});

test('Spanish-only keys are translated server error codes', () => {
  const extra = Object.keys(STRINGS_ES).filter((k) => !(k in STRINGS_EN));
  assert.ok(extra.every((k) => k.startsWith('error.')), `unexpected Spanish-only keys: ${extra}`);
});

test('t fills placeholders and falls back to the key; tn picks the plural form', () => {
  setLangForTests('es');
  assert.equal(t('week.chip', { n: 4 }), 'Semana 4');
  assert.equal(tn('day.exercises', 1), '1 ejercicio');
  assert.equal(tn('day.exercises', 3), '3 ejercicios');
  assert.equal(t('no.such.key'), 'no.such.key');
  setLangForTests('en');
  assert.equal(t('week.chip', { n: 4 }), 'Week 4');
  assert.equal(tn('overview.count', 1), '1 client');
  setLangForTests('es');
});
