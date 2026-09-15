// Renders one feedback entry as a card: bold date + session label, and a 2x2 fact
// grid (Felt / Completed / Difficulty / Notes) — User Story 3, contracts/feedback-honesty-and-stats.md.
export function renderFeedbackEntry(entry) {
  const el = document.createElement('div');
  el.className = 'card feedback-entry-card';

  const header = document.createElement('div');
  header.className = 'feedback-entry-header';
  header.innerHTML = `<strong>${entry.date || 'N/A'}</strong>${entry.exercise ? ` <span class="feedback-entry-label">${entry.exercise}</span>` : ''}`;
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
    fact.innerHTML = `<span class="feedback-fact-label">${label}</span><span class="feedback-fact-value">${value}</span>`;
    grid.appendChild(fact);
  }
  el.appendChild(grid);

  return el;
}
