import test from 'node:test';
import assert from 'node:assert/strict';
import { detectLang } from '../../src/lib/lang.js';

test('detects Spanish coach text', () => {
  assert.equal(detectLang('Calentamiento de 7 minutos: caminata ligera y movilidad de cadera para la semana'), 'es');
});

test('detects English text', () => {
  assert.equal(detectLang('Warm up for seven minutes with light walking and hip mobility for the week'), 'en');
});

test('short or ambiguous text is left to the page default', () => {
  assert.equal(detectLang('Sentadilla 3x10'), null);
  assert.equal(detectLang(''), null);
  assert.equal(detectLang(undefined), null);
});
