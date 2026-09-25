// Which Program day cards count as done (specs/012-program-day-mark-done research R5).
// Program weeks carry no calendar dates, so "done this week" is a completed feedback
// entry for the day's session label dated within the last 7 days.

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const WINDOW_DAYS = 7;

function toIso(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** The coach's local calendar date as YYYY-MM-DD (not UTC). */
export function todayIso(now = new Date()) {
  return toIso(now);
}

/** "<Day> - <Focus>", exactly as the card shows it; just the day when there's no focus. */
export function sessionLabel(day) {
  const focus = (day.focus || '').trim();
  return focus ? `${day.day} - ${focus}` : day.day;
}

function normalize(label) {
  return (label || '').trim().toLowerCase();
}

/** Newest completed entry for this label within [today - 6 days, today], or null. */
export function findDoneEntry(entries, label, today = todayIso()) {
  const [y, m, d] = today.split('-').map(Number);
  const windowStart = toIso(new Date(y, m - 1, d - (WINDOW_DAYS - 1)));
  const wanted = normalize(label);

  let best = null;
  for (const entry of entries || []) {
    if (entry.completed !== true || !ISO_DATE.test(entry.date || '')) continue;
    if (normalize(entry.label) !== wanted) continue;
    if (entry.date < windowStart || entry.date > today) continue;
    if (!best || entry.date >= best.date) best = entry;
  }
  return best;
}
