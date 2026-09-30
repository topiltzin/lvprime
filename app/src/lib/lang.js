// The app chrome is Spanish or English (src/lib/i18n.js) and coach content (programs, notes,
// nutrition) and chatbot answers are usually Spanish. Tagging that text with lang="es" lets screen readers use the right
// voice and browsers hyphenate and spell-check correctly. A cheap stop-word count is enough
// to tell the two apart.

const SPANISH = new Set(['el', 'la', 'los', 'las', 'de', 'del', 'que', 'y', 'en', 'un', 'una', 'con', 'para', 'por', 'se', 'es', 'al', 'lo', 'como', 'más', 'tu', 'sus', 'su', 'semana', 'día']);
const ENGLISH = new Set(['the', 'and', 'of', 'to', 'in', 'is', 'for', 'with', 'that', 'on', 'are', 'your', 'you', 'this', 'it', 'as', 'be', 'week', 'day']);

/** 'es' | 'en' | null (too little text, or no clear winner). */
export function detectLang(text) {
  const words = String(text || '').toLowerCase().match(/[a-záéíóúñü]+/g) || [];
  if (words.length < 8) return null;
  let es = 0;
  let en = 0;
  for (const w of words) {
    if (SPANISH.has(w)) es++;
    if (ENGLISH.has(w)) en++;
  }
  if (es === en || Math.max(es, en) / words.length < 0.08) return null;
  return es > en ? 'es' : 'en';
}

/** Sets el.lang when the text's language is clear and differs from the page's; otherwise inherits. */
export function applyLang(el, text) {
  const lang = detectLang(text);
  const pageLang = globalThis.document?.documentElement.lang || 'en';
  if (lang && lang !== pageLang) el.lang = lang;
  else el.removeAttribute('lang');
}
