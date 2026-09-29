import { deriveStatus, STATUS_LABEL, formatRelativeCheckIn } from '../lib/status.js';
import { icon } from '../lib/icons.js';
import { initials, formatDate } from '../lib/format.js';

function signalBadge(iconName, text, tone = '') {
  const span = document.createElement('span');
  span.className = `signal ${tone}`.trim();
  span.appendChild(icon(iconName));
  const label = document.createElement('span');
  label.textContent = text;
  span.appendChild(label);
  return span;
}

/**
 * Static badges (the whole card is the link): flags first, then a due week, adherence and the
 * current week. Every signal carries an icon and text, never colour alone.
 */
function renderSignals(signals) {
  if (!signals) return null;
  const row = document.createElement('div');
  row.className = 'signal-row';

  for (const flag of signals.flags || []) {
    row.appendChild(signalBadge('warning-circle', `${flag.text} · ${formatDate(flag.date)}`, 'is-alert'));
  }

  const week = signals.weekNumber != null ? `Week ${signals.weekNumber}` : null;
  if (signals.weekDue) {
    row.appendChild(signalBadge('calendar', `${week} is ${signals.weekAgeDays}d old · new week due`, 'is-warn'));
  }

  const { adherence } = signals;
  if (adherence) {
    const text = adherence.percent != null
      ? `${adherence.percent}% done · ${adherence.completed}/${adherence.completed + adherence.missed} in ${adherence.days}d`
      : adherence.logged
        ? `${adherence.logged} logged · ${adherence.days}d`
        : `No sessions in ${adherence.days}d`;
    row.appendChild(signalBadge('check-circle', text, adherence.logged ? '' : 'is-muted'));
  }

  if (week && !signals.weekDue) row.appendChild(signalBadge('calendar', week));
  return row.children.length ? row : null;
}

// Renders one client's overview card (User Story 1, FR-002).
export function renderCustomerCard(customer) {
  const status = deriveStatus(customer.lastFeedbackDate);

  const a = document.createElement('a');
  const flagged = (customer.signals?.flags?.length || 0) > 0;
  a.className = `customer-card customer-card--${status}${flagged ? ' customer-card--flagged' : ''}`;
  a.href = `#/customers/${encodeURIComponent(customer.slug)}`;

  const top = document.createElement('div');
  top.className = 'customer-card-top';

  const avatar = document.createElement('span');
  avatar.className = 'customer-avatar';
  avatar.setAttribute('aria-hidden', 'true');
  avatar.textContent = initials(customer.displayName);
  top.appendChild(avatar);

  const h2 = document.createElement('h2');
  h2.textContent = customer.displayName;
  top.appendChild(h2);

  top.appendChild(icon('arrow-right', 'customer-card-arrow'));
  a.appendChild(top);

  const goalLine = document.createElement('p');
  goalLine.className = 'summary-line goal-line';
  if (customer.hasProgram && customer.programGoal) {
    goalLine.textContent = customer.programGoal;
  } else if (customer.hasProgram) {
    goalLine.textContent = 'Program in progress';
  } else {
    goalLine.innerHTML = '<span class="badge missing">No program yet</span>';
  }
  a.appendChild(goalLine);

  const signals = renderSignals(customer.signals);
  if (signals) a.appendChild(signals);

  const footer = document.createElement('div');
  footer.className = 'customer-card-footer';

  const checkIn = document.createElement('span');
  checkIn.className = 'check-in-date';
  checkIn.appendChild(icon('calendar-check'));
  const checkInText = document.createElement('span');
  // Short enough to share a row with the status pill on a narrow card.
  checkInText.textContent = customer.lastFeedbackDate
    ? `Check-in ${formatRelativeCheckIn(customer.lastFeedbackDate).toLowerCase()}`
    : 'No check-in yet';
  checkIn.appendChild(checkInText);
  footer.appendChild(checkIn);

  const pill = document.createElement('span');
  pill.className = `status-pill status-${status}`;
  pill.textContent = STATUS_LABEL[status];
  footer.appendChild(pill);

  a.appendChild(footer);

  return a;
}
