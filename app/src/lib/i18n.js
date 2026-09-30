// Interface language (EN/ES). The coach's content (programs, notes, nutrition) is
// written in Spanish and never translated; this covers the app's own chrome.
// Spanish is the default; the header switch saves the choice per browser and
// reloads, so every view renders once in the chosen language.
//
// t('key', { var }) fills {var} placeholders. A missing Spanish string falls back to
// English, and a missing key shows the key itself so it's easy to spot.

import { STRINGS_EN, STRINGS_ES } from './strings.js';

export const LANGS = ['es', 'en'];
export const DEFAULT_LANG = 'es';
const STORAGE_KEY = 'lvprime.lang';
const DICTS = { en: STRINGS_EN, es: STRINGS_ES };
const LOCALES = { en: 'en-US', es: 'es-MX' };

function readSavedLang() {
  try {
    const saved = globalThis.localStorage?.getItem(STORAGE_KEY);
    return LANGS.includes(saved) ? saved : DEFAULT_LANG;
  } catch {
    return DEFAULT_LANG;
  }
}

let current = readSavedLang();

export function getLang() {
  return current;
}

/** BCP 47 locale for dates and numbers in the current language. */
export function getLocale() {
  return LOCALES[current];
}

/** Saves the choice and reloads, so every view renders in the new language. */
export function setLang(lang) {
  if (!LANGS.includes(lang) || lang === current) return;
  try {
    localStorage.setItem(STORAGE_KEY, lang);
  } catch {
    // Storage blocked: the switch still applies to this page load.
  }
  current = lang;
  window.location.reload();
}

/** Test-only: switch language without storage or a reload. */
export function setLangForTests(lang) {
  current = LANGS.includes(lang) ? lang : DEFAULT_LANG;
}

export function hasString(key) {
  return key in DICTS[current] || key in STRINGS_EN;
}

export function t(key, vars = {}) {
  const template = DICTS[current][key] ?? STRINGS_EN[key] ?? key;
  return template.replace(/\{(\w+)\}/g, (match, name) => (name in vars ? String(vars[name]) : match));
}

/** Plural form: '<key>.one' for n === 1, '<key>.other' otherwise; {n} is filled in. */
export function tn(key, n, vars = {}) {
  return t(`${key}.${n === 1 ? 'one' : 'other'}`, { n, ...vars });
}
