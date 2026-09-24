import { deriveStatus, STATUS_LABEL, formatRelativeCheckIn } from '../lib/status.js';
import { icon } from '../lib/icons.js';
import { initials } from '../lib/format.js';

// Renders one client's overview card (User Story 1, FR-002).
export function renderCustomerCard(customer) {
  const status = deriveStatus(customer.lastFeedbackDate);

  const a = document.createElement('a');
  a.className = `customer-card customer-card--${status}`;
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
