import { deriveStatus, statusLabel, formatRelativeCheckIn } from '../lib/status.js';
import { icon } from '../lib/icons.js';
import { initials, formatDate } from '../lib/format.js';
import { t, tn } from '../lib/i18n.js';

// Flag text is built here from its kind/level so it follows the interface language.
function flagText(flag) {
  if (flag.kind === 'hard') return t('card.brutal');
  return flag.level != null ? t('card.pain', { level: flag.level }) : t('card.mentionsPain');
}

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
function renderSignals(signals, unreadMessages = 0) {
  if (!signals && !unreadMessages) return null;
  const row = document.createElement('div');
  row.className = 'signal-row';

  // Customer replies the coach hasn't opened (specs/016): first, icon + text, never colour alone.
  if (unreadMessages > 0) row.appendChild(signalBadge('chat', tn('messages.cardSignal', unreadMessages), 'is-alert'));
  if (!signals) return row;

  for (const flag of signals.flags || []) {
    row.appendChild(signalBadge('warning-circle', `${flagText(flag)} · ${formatDate(flag.date)}`, 'is-alert'));
  }

  const week = signals.weekNumber != null ? t('card.week', { n: signals.weekNumber }) : null;
  if (signals.weekDue) {
    row.appendChild(signalBadge('calendar', t('card.weekDue', { week, days: signals.weekAgeDays }), 'is-warn'));
  }

  const { adherence } = signals;
  if (adherence) {
    const text = adherence.percent != null
      ? t('card.adherencePercent', {
        percent: adherence.percent,
        done: adherence.completed,
        total: adherence.completed + adherence.missed,
        days: adherence.days,
      })
      : adherence.logged
        ? t('card.adherenceLogged', { n: adherence.logged, days: adherence.days })
        : t('card.adherenceNone', { days: adherence.days });
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
  const archived = !!customer.archivedAt;
  a.className = `customer-card customer-card--${status}${flagged ? ' customer-card--flagged' : ''}${archived ? ' customer-card--archived' : ''}`;
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
    goalLine.textContent = t('card.programInProgress');
  } else {
    const badge = document.createElement('span');
    badge.className = 'badge missing';
    badge.textContent = t('card.noProgram');
    goalLine.appendChild(badge);
  }
  a.appendChild(goalLine);

  const signals = renderSignals(customer.signals, customer.unreadMessages || 0);
  if (signals) a.appendChild(signals);

  const footer = document.createElement('div');
  footer.className = 'customer-card-footer';

  const checkIn = document.createElement('span');
  checkIn.className = 'check-in-date';
  checkIn.appendChild(icon('calendar-check'));
  const checkInText = document.createElement('span');
  // Short enough to share a row with the status pill on a narrow card.
  checkInText.textContent = customer.lastFeedbackDate
    ? t('card.checkIn', { when: formatRelativeCheckIn(customer.lastFeedbackDate).toLowerCase() })
    : t('card.noCheckIn');
  checkIn.appendChild(checkInText);
  footer.appendChild(checkIn);

  const pill = document.createElement('span');
  pill.className = archived ? 'status-pill status-archived' : `status-pill status-${status}`;
  pill.textContent = archived ? t('card.archived') : statusLabel(status);
  footer.appendChild(pill);

  a.appendChild(footer);

  return a;
}
