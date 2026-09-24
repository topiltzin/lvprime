// Client detail hero (FR-005): name, goal, and level/session/plan facts, with a quiet
// back-to-overview link — rendered above the tab navigation on every client detail page.
import { icon } from '../lib/icons.js';
import { deriveStatus, STATUS_LABEL, formatRelativeCheckIn } from '../lib/status.js';

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
  label.textContent = `Week ${currentWeek} of ${totalWeeks}`;
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

export function renderClientHero(customerData) {
  const wrap = document.createElement('div');
  wrap.className = 'client-hero';

  const back = document.createElement('a');
  back.className = 'back-link';
  back.href = '#/';
  back.appendChild(icon('caret-left'));
  const backText = document.createElement('span');
  backText.textContent = 'All clients';
  back.appendChild(backText);
  wrap.appendChild(back);

  const card = document.createElement('section');
  card.className = 'client-hero-card';

  const entries = customerData.feedback?.entries || [];
  const lastDate = entries.length ? entries[entries.length - 1].date : null;
  const status = deriveStatus(lastDate);

  const top = document.createElement('div');
  top.className = 'client-hero-top';
  const pill = document.createElement('span');
  pill.className = `status-pill status-${status}`;
  pill.textContent = STATUS_LABEL[status];
  top.appendChild(pill);
  const checkIn = document.createElement('span');
  checkIn.className = 'client-hero-checkin';
  checkIn.textContent = `Last check-in ${formatRelativeCheckIn(lastDate).toLowerCase()}`;
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
      ['barbell', 'Level', program.fitnessLevel],
      ['clock', 'Session', program.sessionDuration],
      ['calendar', 'Plan', program.planDuration],
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
