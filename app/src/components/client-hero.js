// Client detail hero (FR-005): name, goal, and level/session/plan facts, with a quiet
// back-to-overview link — rendered above the tab navigation on every client detail page.
import { icon } from '../lib/icons.js';
import { deriveStatus, statusLabel, formatRelativeCheckIn } from '../lib/status.js';
import { formatDate } from '../lib/format.js';
import { t } from '../lib/i18n.js';

// "4 semanas" / "6 weeks" → 4 / 6; anything else → null (no progress row).
function planWeeks(planDuration) {
  const match = String(planDuration || '').match(/(\d+)\s*(semanas?|weeks?)/i);
  return match ? Number(match[1]) : null;
}

// Week N of M as one segment per week: past weeks, the current week, weeks to come.
function renderWeekProgress(currentWeek, totalWeeks) {
  const wrap = document.createElement('div');
  wrap.className = 'hero-progress';
  const label = document.createElement('span');
  label.className = 'hero-progress-label';
  label.textContent = t('hero.weekOf', { current: currentWeek, total: totalWeeks });
  wrap.appendChild(label);
  const track = document.createElement('span');
  track.className = 'hero-progress-segments';
  track.setAttribute('aria-hidden', 'true');
  for (let w = 1; w <= totalWeeks; w++) {
    const seg = document.createElement('span');
    seg.className = w < currentWeek ? 'is-past' : w === currentWeek ? 'is-current' : '';
    track.appendChild(seg);
  }
  wrap.appendChild(track);
  return wrap;
}

// "55-65 min/sesión (7 min calentamiento, ...)" → main value + the parenthetical as detail.
function splitDetail(text) {
  const match = text.match(/^([^(]+?)\s*\((.+)\)\s*$/);
  return match ? { value: match[1], detail: match[2] } : { value: text, detail: null };
}

function renderFact(iconName, label, text) {
  const { value, detail } = splitDetail(text);
  const fact = document.createElement('div');
  fact.className = 'hero-fact';

  fact.appendChild(icon(iconName, 'hero-fact-icon'));

  const body = document.createElement('div');
  const labelEl = document.createElement('span');
  labelEl.className = 'hero-fact-label';
  labelEl.textContent = label;
  const valueEl = document.createElement('span');
  valueEl.className = 'hero-fact-value';
  valueEl.textContent = value;
  body.append(labelEl, valueEl);
  if (detail) {
    const detailEl = document.createElement('span');
    detailEl.className = 'hero-fact-detail';
    detailEl.textContent = detail;
    body.appendChild(detailEl);
  }
  fact.appendChild(body);
  return fact;
}

// Archive / restore (nothing is deleted). onToggle(archived) does the request and
// re-renders the page; the button stays disabled while it runs.
function renderArchiveControl(customerData, onToggleArchived) {
  const archived = !!customerData.archivedAt;
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'hero-archive-button';
  button.appendChild(icon(archived ? 'arrow-counter-clockwise' : 'archive'));
  const label = document.createElement('span');
  label.textContent = archived ? t('archive.restore') : t('archive.button');
  button.appendChild(label);
  button.addEventListener('click', async () => {
    if (!archived && !window.confirm(t('archive.confirm', { name: customerData.displayName }))) return;
    button.disabled = true;
    try {
      await onToggleArchived(!archived);
    } finally {
      button.disabled = false;
    }
  });
  return button;
}

export function renderClientHero(customerData, { onToggleArchived } = {}) {
  const wrap = document.createElement('div');
  wrap.className = 'client-hero';

  const back = document.createElement('a');
  back.className = 'back-link';
  back.href = '#/';
  back.appendChild(icon('caret-left'));
  const backText = document.createElement('span');
  backText.textContent = t('common.allClients');
  back.appendChild(backText);
  const nav = document.createElement('div');
  nav.className = 'client-hero-nav';
  nav.appendChild(back);
  if (onToggleArchived) nav.appendChild(renderArchiveControl(customerData, onToggleArchived));
  wrap.appendChild(nav);

  if (customerData.archivedAt) {
    const banner = document.createElement('p');
    banner.className = 'archived-banner';
    banner.setAttribute('role', 'status');
    banner.appendChild(icon('archive'));
    const text = document.createElement('span');
    text.textContent = t('archive.banner', { date: formatDate(customerData.archivedAt.slice(0, 10)) });
    banner.appendChild(text);
    wrap.appendChild(banner);
  }

  const card = document.createElement('section');
  card.className = 'client-hero-card';

  const entries = customerData.feedback?.entries || [];
  const lastDate = entries.length ? entries[entries.length - 1].date : null;
  const status = deriveStatus(lastDate);

  const top = document.createElement('div');
  top.className = 'client-hero-top';
  const pill = document.createElement('span');
  pill.className = `status-pill status-${status}`;
  pill.textContent = statusLabel(status);
  top.appendChild(pill);
  const checkIn = document.createElement('span');
  checkIn.className = 'client-hero-checkin';
  checkIn.textContent = t('hero.lastCheckIn', { when: formatRelativeCheckIn(lastDate).toLowerCase() });
  top.appendChild(checkIn);
  card.appendChild(top);

  const name = document.createElement('h1');
  name.className = 'client-hero-name';
  name.textContent = customerData.displayName;
  card.appendChild(name);

  const program = customerData.program;
  if (program && program.present) {
    if (program.goal) {
      const goal = document.createElement('p');
      goal.className = 'client-hero-goal';
      goal.textContent = program.goal;
      card.appendChild(goal);
    }

    const facts = [
      ['barbell', t('hero.level'), program.fitnessLevel],
      ['clock', t('hero.session'), program.sessionDuration],
      ['calendar', t('hero.plan'), program.planDuration],
    ].filter(([, , value]) => value);

    const total = planWeeks(program.planDuration);
    const current = program.weekNumber
      ?? (customerData.programWeeks || []).find((w) => w.isCurrent)?.weekNumber
      ?? null;
    if (total && current && current <= total) card.appendChild(renderWeekProgress(current, total));

    if (facts.length) {
      const list = document.createElement('div');
      list.className = 'hero-facts';
      for (const [iconName, label, value] of facts) list.appendChild(renderFact(iconName, label, value));
      card.appendChild(list);
    }
  }

  wrap.appendChild(card);
  return wrap;
}
