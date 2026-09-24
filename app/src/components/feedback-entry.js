// Renders one feedback entry as a card: bold date + session label, and a 2x2 fact
// grid (Felt / Completed / Difficulty / Notes) — User Story 3, contracts/feedback-honesty-and-stats.md.
// Every value here comes from feedback submitted through the public form, so it is
// set via textContent, never innerHTML.
function span(className, text) {
  const s = document.createElement('span');
  s.className = className;
  s.textContent = text;
  return s;
}

export function renderFeedbackEntry(entry) {
  const el = document.createElement('div');
  el.className = 'card feedback-entry-card';

  const header = document.createElement('div');
  header.className = 'feedback-entry-header';
  const date = document.createElement('strong');
  date.textContent = entry.date || 'N/A';
  header.appendChild(date);
  if (entry.exercise) {
    header.append(' ', span('feedback-entry-label', entry.exercise));
  }
  el.appendChild(header);

  const grid = document.createElement('div');
  grid.className = 'feedback-fact-grid';
  const facts = [
    ['Felt', entry.howCustomerFelt && entry.howCustomerFelt !== 'N/A' ? entry.howCustomerFelt : '—'],
    ['Completed', entry.completed ? 'Yes' : 'No'],
    ['Difficulty', entry.overallImpression && entry.overallImpression !== 'N/A' ? entry.overallImpression : '—'],
    ['Notes', entry.notes || '—'],
  ];
  for (const [label, value] of facts) {
    const fact = document.createElement('div');
    fact.className = 'feedback-fact';
    fact.append(span('feedback-fact-label', label), span('feedback-fact-value', value));
    grid.appendChild(fact);
  }
  el.appendChild(grid);

  return el;
}
