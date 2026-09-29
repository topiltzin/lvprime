// Per-client attention signals for the overview: recent adherence, pain/"brutal" flags from the
// latest logged sessions, and whether the current program week is due for a new one.
// Pure functions over parseFeedbackEntries() output, so they are unit-tested without a database.
//
// These are prompts for the coach to look, not a diagnosis: the flags come from what the client
// wrote (a 0-10 pain field, pain words in their notes, a "Brutal" difficulty).

export const ADHERENCE_WINDOW_DAYS = 14;
export const RECENT_SESSIONS_SCANNED = 3;
export const PAIN_ALERT_LEVEL = 4; // out of 10
export const WEEK_DUE_DAYS = 7;

const MS_PER_DAY = 24 * 60 * 60 * 1000;
// JS \b treats accented letters as non-word, so "dolió" needs an explicit letter lookahead.
const WORD_END = '(?![a-záéíóúñ])';
const PAIN_WORD = new RegExp(`(?<![a-záéíóúñ])(dolor|duele|dol[ií]a|doli[oó]|pain|painful|hurts?|sore|lesi[oó]n|injur\\w*|molestia|inflamaci[oó]n)${WORD_END}`, 'i');
const NEGATED_PAIN = /(?<![a-záéíóúñ])(sin|no|nada\s+de|ning[uú]n|ninguna|without|zero|cero)\s+(?:\w+\s+)?(dolor|pain|molestia)(?![a-záéíóúñ])/i;
const PAIN_LABEL = /dolor|pain/i;

function daysBetween(fromIso, now) {
  const from = new Date(`${fromIso}T00:00:00`);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.floor((today.getTime() - from.getTime()) / MS_PER_DAY);
}

/** Highest 0-10 number in a pain field's value ("3 durante, 2 mañana" → 3), or null. */
function painLevel(entry) {
  let level = null;
  for (const { label, value } of entry.fields_raw || []) {
    if (!PAIN_LABEL.test(label)) continue;
    for (const m of String(value).matchAll(/\d+(?:[.,]\d+)?/g)) {
      const n = Number(m[0].replace(',', '.'));
      if (n >= 0 && n <= 10) level = Math.max(level ?? 0, n);
    }
  }
  return level;
}

function mentionsPain(entry) {
  const text = [entry.felt, entry.notes].filter(Boolean).join(' . ');
  return PAIN_WORD.test(text) && !NEGATED_PAIN.test(text);
}

/**
 * @param {Array} entries parseFeedbackEntries() output (any order)
 * @param {{weekNumber?: number|null, weekUpdatedAt?: string|null, now?: Date}} [context]
 * @returns {{
 *   weekNumber: number|null, weekAgeDays: number|null, weekDue: boolean,
 *   adherence: {days: number, logged: number, completed: number, missed: number, percent: number|null},
 *   flags: Array<{kind: 'pain'|'hard', text: string, date: string}>
 * }}
 */
export function computeClientSignals(entries, { weekNumber = null, weekUpdatedAt = null, now = new Date() } = {}) {
  const recent = entries
    .filter((e) => e.raw_matched && e.entry_date_iso)
    .map((e) => ({ entry: e, age: daysBetween(e.entry_date_iso, now) }))
    .filter(({ age }) => age >= 0 && age < ADHERENCE_WINDOW_DAYS)
    .sort((a, b) => (a.entry.entry_date_iso < b.entry.entry_date_iso ? 1 : -1));

  const completed = recent.filter(({ entry }) => entry.completed === true).length;
  const missed = recent.filter(({ entry }) => entry.completed === false).length;
  const adherence = {
    days: ADHERENCE_WINDOW_DAYS,
    logged: recent.length,
    completed,
    missed,
    percent: completed + missed > 0 ? Math.round((completed / (completed + missed)) * 100) : null,
  };

  const flags = [];
  for (const { entry } of recent.slice(0, RECENT_SESSIONS_SCANNED)) {
    const date = entry.entry_date_iso;
    const level = painLevel(entry);
    if (level != null && level >= PAIN_ALERT_LEVEL) {
      flags.push({ kind: 'pain', text: `Pain ${level}/10`, date });
    } else if (level == null && mentionsPain(entry)) {
      flags.push({ kind: 'pain', text: 'Mentions pain', date });
    }
    if (/^brutal$/i.test((entry.difficulty || '').trim())) {
      flags.push({ kind: 'hard', text: 'Session felt brutal', date });
    }
  }
  // Newest of each kind only; the coach opens the client for the rest.
  const seen = new Set();
  const uniqueFlags = flags.filter((f) => !seen.has(f.kind) && seen.add(f.kind));

  let weekAgeDays = null;
  if (weekUpdatedAt) {
    const updated = new Date(weekUpdatedAt);
    if (!Number.isNaN(updated.getTime())) {
      weekAgeDays = Math.max(0, Math.floor((now.getTime() - updated.getTime()) / MS_PER_DAY));
    }
  }

  return {
    weekNumber,
    weekAgeDays,
    weekDue: weekNumber != null && weekAgeDays != null && weekAgeDays >= WEEK_DUE_DAYS,
    adherence,
    flags: uniqueFlags,
  };
}
