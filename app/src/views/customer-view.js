import { getCustomer } from '../api-client.js';
import { renderTrendChart } from '../components/trend-chart.js';
import { renderFeedbackEntry } from '../components/feedback-entry.js';
import { renderFeedbackForm } from './feedback-form-view.js';

function formatBytes(bytes) {
  if (bytes == null) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function renderProgram(container, program) {
  const section = document.createElement('section');
  section.className = 'card';
  const h2 = document.createElement('h2');
  h2.textContent = 'Program';
  section.appendChild(h2);

  if (!program.present) {
    const empty = document.createElement('p');
    empty.className = 'empty-state';
    empty.textContent = 'Program not yet created.';
    section.appendChild(empty);
    container.appendChild(section);
    return;
  }

  const meta = document.createElement('p');
  meta.className = 'summary-line';
  meta.textContent = [
    program.goal ? `Goal: ${program.goal}` : null,
    program.fitnessLevel ? `Level: ${program.fitnessLevel}` : null,
    program.sessionDuration ? `Duration: ${program.sessionDuration}` : null,
    program.planDuration ? `Plan length: ${program.planDuration}` : null,
  ]
    .filter(Boolean)
    .join(' · ');
  section.appendChild(meta);

  const scheduleSection = document.createElement('div');
  scheduleSection.className = 'weekly-schedule';
  for (const day of program.weeklySchedule) {
    const block = document.createElement('div');
    block.className = 'day-block';
    const h3 = document.createElement('h3');
    h3.textContent = day.focus ? `${day.day} — ${day.focus}` : day.day;
    block.appendChild(h3);
    const body = document.createElement('div');
    body.innerHTML = day.html;
    block.appendChild(body);
    scheduleSection.appendChild(block);
  }
  section.appendChild(scheduleSection);

  if (program.progressionHtml) {
    const progression = document.createElement('div');
    progression.innerHTML = program.progressionHtml;
    section.appendChild(progression);
  }

  container.appendChild(section);
}

function renderNotes(container, notes) {
  const section = document.createElement('section');
  section.className = 'card';
  const h2 = document.createElement('h2');
  h2.textContent = 'Coach notes';
  section.appendChild(h2);

  if (!notes.present) {
    const empty = document.createElement('p');
    empty.className = 'empty-state';
    empty.textContent = 'Notes not yet created.';
    section.appendChild(empty);
  } else {
    const body = document.createElement('div');
    body.innerHTML = notes.html;
    section.appendChild(body);
  }
  container.appendChild(section);
}

function renderAttachments(container, attachments) {
  if (!attachments.length) return;
  const section = document.createElement('section');
  section.className = 'card attachments';
  const h2 = document.createElement('h2');
  h2.textContent = 'Attachments';
  section.appendChild(h2);
  const ul = document.createElement('ul');
  for (const a of attachments) {
    const li = document.createElement('li');
    const link = document.createElement('a');
    link.href = `/customer-files/${a.relativePath}`;
    link.textContent = a.relativePath;
    li.appendChild(link);
    li.appendChild(document.createTextNode(` (${formatBytes(a.sizeBytes)})`));
    ul.appendChild(li);
  }
  section.appendChild(ul);
  container.appendChild(section);
}

function renderFeedbackSection(container, slug, feedback) {
  const section = document.createElement('section');
  section.className = 'card';
  section.id = 'feedback-section';
  const h2 = document.createElement('h2');
  h2.textContent = 'Feedback history';
  section.appendChild(h2);

  const listEl = document.createElement('div');
  listEl.id = 'feedback-list';
  if (!feedback.entries.length) {
    listEl.innerHTML = '<p class="empty-state">No feedback logged yet.</p>';
  } else {
    section.appendChild(renderTrendChart(feedback.trend));
    for (const entry of feedback.entries) {
      listEl.appendChild(renderFeedbackEntry(entry));
    }
  }
  section.appendChild(listEl);

  const formHost = document.createElement('div');
  formHost.appendChild(
    renderFeedbackForm(slug, feedback.template, async () => {
      // Refresh just the feedback section in place — no app restart (spec FR-007).
      const data = await getCustomer(slug);
      const fresh = document.createElement('div');
      renderFeedbackSection(fresh, slug, data.feedback);
      section.replaceWith(fresh.firstChild);
    })
  );
  section.appendChild(formHost);

  container.appendChild(section);
}

export async function renderCustomer(container, slug) {
  container.innerHTML = '';

  const header = document.createElement('div');
  header.className = 'page-header';
  header.innerHTML = '<a class="back-link" href="#/">&larr; All customers</a>';
  container.appendChild(header);

  let data;
  try {
    data = await getCustomer(slug);
  } catch (err) {
    const banner = document.createElement('div');
    banner.className = 'error-banner';
    banner.textContent = err.message || 'Failed to load this customer.';
    container.appendChild(banner);
    return;
  }

  const title = document.createElement('h1');
  title.textContent = data.displayName;
  container.appendChild(title);

  renderProgram(container, data.program);
  renderFeedbackSection(container, slug, data.feedback);
  renderNotes(container, data.notes);
  renderAttachments(container, data.attachments);
}
