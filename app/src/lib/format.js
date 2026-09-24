// Display formatting for ISO dates (YYYY-MM-DD) coming from feedback.md.
// Parsed as local dates so a "2026-09-21" entry never shifts a day across time zones.

function parseIsoDate(iso) {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  const date = new Date(`${iso}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** "2026-09-21" → "Sep 21, 2026"; unparseable input is returned unchanged. */
export function formatDate(iso) {
  const date = parseIsoDate(iso);
  if (!date) return iso;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

/** "2026-09-21" → "Mon, Sep 21"; unparseable input is returned unchanged. */
export function formatDayDate(iso) {
  const date = parseIsoDate(iso);
  if (!date) return iso;
  return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}
