import { icon } from '../lib/icons.js';
import { formatDayDate } from '../lib/format.js';

// Renders one feedback entry as a card: date + session label and a completed/missed chip
// up top, Felt / Difficulty side by side, and the notes as a full-width paragraph —
// User Story 3, contracts/feedback-honesty-and-stats.md.
// Every value here comes from feedback submitted through the public form, so it is
// set via textContent, never innerHTML. Empty facts are left out rather than padded.
function span(className, text) {
  const s = document.createElement('span');
  s.className = className;
  s.textContent = text;
  return s;
}

function present(value) {
  return value && value !== 'N/A' ? value : null;
}

export function renderFeedbackEntry(entry) {
  const el = document.createElement('article');
  el.className = 'card feedback-entry-card';

  const header = document.createElement('header');
  header.className = 'feedback-entry-header';

  const titles = document.createElement('div');
  const date = document.createElement('h4');
  date.className = 'feedback-entry-date';
  date.textContent = present(entry.date) ? formatDayDate(entry.date) : 'Undated session';
  if (present(entry.date)) date.title = entry.date;
  titles.appendChild(date);
  if (entry.exercise) titles.appendChild(span('feedback-entry-label', entry.exercise));
  header.appendChild(titles);

  const chip = document.createElement('span');
  chip.className = entry.completed ? 'completion-chip is-done' : 'completion-chip is-missed';
  chip.appendChild(icon(entry.completed ? 'check-circle' : 'x-circle'));
  chip.append(entry.completed ? 'Completed' : 'Not completed');
  header.appendChild(chip);
  el.appendChild(header);

  const facts = [
    ['Felt', present(entry.howCustomerFelt)],
    ['Difficulty', present(entry.overallImpression)],
  ].filter(([, value]) => value);

  if (facts.length) {
    const grid = document.createElement('div');
    grid.className = 'feedback-fact-grid';
    for (const [label, value] of facts) {
      const fact = document.createElement('div');
      fact.className = 'feedback-fact';
      fact.append(span('feedback-fact-label', label), span('feedback-fact-value', value));
      grid.appendChild(fact);
    }
    el.appendChild(grid);
  }

  if (entry.notes) {
    const notes = document.createElement('p');
    notes.className = 'feedback-entry-notes';
    notes.textContent = entry.notes;
    el.appendChild(notes);
  }

  return el;
}
