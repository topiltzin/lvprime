// Renders one feedback entry. Entries the parser couldn't fully match are still
// shown (never hidden), just with a subtler visual treatment (data-model.md).
export function renderFeedbackEntry(entry) {
  const el = document.createElement('div');
  el.className = 'feedback-entry' + (entry.rawMatched ? '' : ' partial');

  const dateEl = document.createElement('span');
  dateEl.className = 'entry-date';
  dateEl.textContent = entry.label ? `${entry.date} — ${entry.label}` : entry.date;
  el.appendChild(dateEl);

  const parts = [];
  if (entry.felt) parts.push(`Felt: ${entry.felt}`);
  if (entry.completed != null) parts.push(`Completed: ${entry.completed ? 'Yes' : 'No'}`);
  if (entry.difficulty) parts.push(`Difficulty: ${entry.difficulty}`);
  if (entry.notes) parts.push(`Notes: ${entry.notes}`);
  if (!entry.rawMatched) parts.push('(partial entry — some fields not recognized)');

  const detail = document.createElement('p');
  detail.className = 'summary-line';
  detail.textContent = parts.join(' · ') || '(no details recorded)';
  el.appendChild(detail);

  return el;
}
