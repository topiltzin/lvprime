// Picks the log-form input for a feedback template field from its example value in
// the customer's feedback.md ("- Energy level: [1-10]"), so answers come back in the
// shape the coach asked for instead of free text like "godd" or "Na".
//
//   [1-10]                        → scale: a 1…10 picker
//   [Easy/Moderate/Hard/Brutal]   → choice: one of those options
//   anything else ([Any notes])   → text, with the hint as placeholder

const RANGE = /^(\d{1,2})\s*-\s*(\d{1,2})$/;
const MAX_SCALE_STEPS = 10;
const MAX_OPTIONS = 6;
const MAX_OPTION_CHARS = 20;

/** { kind: 'scale', min, max } | { kind: 'choice', options } | { kind: 'text', placeholder } */
export function fieldInputSpec(hint) {
  const inner = String(hint || '').trim().match(/^\[(.*)\]$/)?.[1].trim() || '';

  const range = inner.match(RANGE);
  if (range) {
    const [min, max] = [Number(range[1]), Number(range[2])];
    if (min < max && max - min <= MAX_SCALE_STEPS) return { kind: 'scale', min, max };
  }

  // "[X/Y]" (single letters) and "[No/Sí - dónde]" (needs a written detail) stay text.
  const options = inner.split('/').map((o) => o.trim());
  const isChoice =
    options.length >= 2 &&
    options.length <= MAX_OPTIONS &&
    options.every((o) => o.length >= 2 && o.length <= MAX_OPTION_CHARS && !/[-,?"]/.test(o));
  if (isChoice) return { kind: 'choice', options };

  return { kind: 'text', placeholder: inner };
}

/** i18n key for a known template field label ("Energy level" → 'logField.energy level'). */
export function fieldLabelKey(fieldName) {
  return `logField.${fieldName.trim().toLowerCase()}`;
}
