import { setSafeHtml } from '../lib/safe-html.js';
import { icon } from '../lib/icons.js';
import { formatDayDate } from '../lib/format.js';
import { todayIso } from '../lib/day-completion.js';

// Program tab "workout poster" (User Story 2): one card per training day, with structured
// exercise rows when available, falling back to the day's raw rendered html otherwise
// (FR-009, FR-010, FR-011, FR-012).

function renderExerciseRow(exercise, index) {
  const row = document.createElement('li');
  row.className = 'exercise-row';

  const number = document.createElement('span');
  number.className = 'exercise-number';
  number.setAttribute('aria-hidden', 'true');
  number.textContent = String(index + 1).padStart(2, '0');
  row.appendChild(number);

  const main = document.createElement('div');
  main.className = 'exercise-row-main';

  // Exercise name doubles as the link to its form-demo video when one is known
  // (specs/007-exercise-library-migration/contracts/exercise-video-linking.md).
  const name = document.createElement(exercise.videoUrl ? 'a' : 'span');
  name.className = 'exercise-name';
  if (exercise.videoUrl) {
    name.href = exercise.videoUrl;
    name.target = '_blank';
    name.rel = 'noopener noreferrer';
    name.classList.add('has-video');
    name.setAttribute('aria-label', `${exercise.name}, watch demo video`);
  }
  const nameText = document.createElement('span');
  nameText.textContent = exercise.name;
  name.appendChild(nameText);
  if (exercise.videoUrl) name.appendChild(icon('play-circle', 'exercise-video-icon'));
  main.appendChild(name);

  if (exercise.formTip) {
    const tip = document.createElement('p');
    tip.className = 'exercise-form-tip';
    tip.textContent = exercise.formTip;
    main.appendChild(tip);
  }

  row.appendChild(main);

  const dose = document.createElement('div');
  dose.className = 'exercise-dose';

  const setsReps = document.createElement('span');
  setsReps.className = 'exercise-sets-reps';
  setsReps.textContent = exercise.setsReps;
  dose.appendChild(setsReps);

  if (exercise.rest) {
    const rest = document.createElement('span');
    rest.className = 'exercise-rest';
    rest.appendChild(icon('timer'));
    const restText = document.createElement('span');
    restText.textContent = `Rest ${exercise.rest}`;
    rest.appendChild(restText);
    dose.appendChild(rest);
  }

  row.appendChild(dose);
  return row;
}

function slugifyDay(day) {
  return day
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // strip accents (á, é, í, ó, ú, ñ handled via NFD)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

// "Mark done" footer (specs/012-program-day-mark-done contracts/program-day-footer-ui.md).
// States: idle (Mark done) -> saving -> done (chip + Add details), or error (inline
// message, button usable again). Locked weeks only ever show the done chip.
function doneChip(entry, animate) {
  const chip = document.createElement('span');
  chip.className = animate ? 'completion-chip is-done is-new' : 'completion-chip is-done';
  chip.appendChild(icon('check-circle'));
  chip.append(entry.date === todayIso() ? 'Done today' : `Done ${formatDayDate(entry.date)}`);
  return chip;
}

function renderDayFooter(card, day, options) {
  const { editable, onMarkDone, onAddDetails } = options;
  const footer = document.createElement('footer');
  footer.className = 'program-day-footer';
  // Announces the switch to "Done" without making the buttons part of a live region.
  const status = document.createElement('div');
  status.className = 'program-day-status';
  status.setAttribute('role', 'status');
  footer.appendChild(status);

  const showDone = (entry, animate) => {
    footer.replaceChildren(status);
    footer.classList.add('is-done');
    card.classList.add('program-day-card--done');
    status.replaceChildren(doneChip(entry, animate));
    if (editable && onAddDetails) {
      const details = document.createElement('button');
      details.type = 'button';
      details.className = 'day-add-details';
      details.appendChild(icon('note-pencil'));
      details.append('Add details');
      details.addEventListener('click', () => onAddDetails(entry));
      footer.appendChild(details);
      return details;
    }
    return null;
  };

  const showIdle = () => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'day-done-button';
    const label = document.createElement('span');
    label.textContent = 'Mark done';
    button.append(icon('check-circle'), label);
    const error = document.createElement('p');
    error.className = 'field-error day-done-error';
    footer.append(button, error);

    let saving = false;
    button.addEventListener('click', async () => {
      if (saving) return;
      saving = true;
      error.textContent = '';
      button.disabled = true;
      button.setAttribute('aria-busy', 'true');
      label.textContent = 'Saving...';
      try {
        const entry = await onMarkDone(day);
        const details = showDone(entry, true);
        details?.focus();
      } catch {
        saving = false;
        button.disabled = false;
        button.removeAttribute('aria-busy');
        label.textContent = 'Mark done';
        error.textContent = 'Could not save. Try again.';
      }
    });
  };

  if (options.doneEntry) showDone(options.doneEntry, false);
  else if (editable && onMarkDone) showIdle();
  else return null;
  return footer;
}

/**
 * options (specs/012): { editable, doneEntry, onMarkDone(day) => Promise<entry>,
 * onAddDetails(entry) }. Without options the card renders exactly as before.
 */
export function renderProgramDay(day, index = 0, options = {}) {
  const hasExercises = !!(day.exercises && day.exercises.length);
  const card = document.createElement('article');
  card.className = hasExercises ? 'program-day-card' : 'program-day-card program-day-card--light';
  card.id = `day-${slugifyDay(day.day)}`;
  card.style.setProperty('--i', index);

  const header = document.createElement('header');
  header.className = 'program-day-header';

  const titles = document.createElement('div');
  const dayName = document.createElement('p');
  dayName.className = 'program-day-name';
  dayName.textContent = day.day.toLowerCase();
  titles.appendChild(dayName);

  const title = document.createElement('h3');
  title.className = 'program-day-focus';
  title.textContent = day.focus || day.day;
  titles.appendChild(title);
  header.appendChild(titles);

  // Days without structured rows (rest days, or free-form days) get no count badge.
  if (hasExercises) {
    const badge = document.createElement('span');
    badge.className = 'program-day-count';
    badge.appendChild(icon('barbell'));
    const n = day.exercises.length;
    badge.append(`${n} ${n === 1 ? 'exercise' : 'exercises'}`);
    header.appendChild(badge);
  }
  card.appendChild(header);

  if (hasExercises) {
    const list = document.createElement('ol');
    list.className = 'exercise-list';
    day.exercises.forEach((exercise, i) => list.appendChild(renderExerciseRow(exercise, i)));
    card.appendChild(list);
    const footer = renderDayFooter(card, day, options);
    if (footer) card.appendChild(footer);
  } else {
    const body = document.createElement('div');
    body.className = 'program-day-html';
    setSafeHtml(body, day.html);
    card.appendChild(body);
  }

  return card;
}

function prefersReducedMotion() {
  return typeof window !== 'undefined'
    && window.matchMedia
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** Sticky day-name chip subnav that jump-scrolls to each day's card (FR-012). */
export function renderDaySubnav(weeklySchedule) {
  if (weeklySchedule.length <= 1) return null;

  const nav = document.createElement('nav');
  nav.className = 'day-subnav';
  nav.setAttribute('aria-label', 'Program days');
  for (const day of weeklySchedule) {
    // Buttons (not #day- hash links) so chips don't collide with the hash router.
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'day-chip';
    chip.dataset.target = `day-${slugifyDay(day.day)}`;
    chip.textContent = day.day.toLowerCase();
    chip.addEventListener('click', () => {
      const target = document.getElementById(`day-${slugifyDay(day.day)}`);
      target?.scrollIntoView({
        behavior: prefersReducedMotion() ? 'auto' : 'smooth',
        block: 'start',
      });
    });
    nav.appendChild(chip);
  }
  return nav;
}

/**
 * Highlights the day chip whose card is currently in the reading zone, so the client
 * always sees where they are in the week. Returns a disconnect function.
 */
export function trackActiveDay(nav, cards) {
  if (!nav || typeof IntersectionObserver === 'undefined') return () => {};
  const chips = [...nav.querySelectorAll('.day-chip')];
  const setActive = (id) => {
    for (const chip of chips) {
      const isActive = chip.dataset.target === id;
      chip.classList.toggle('active', isActive);
      // On narrow screens keep the highlighted chip inside the scrollable row.
      if (isActive && (chip.offsetLeft < nav.scrollLeft
        || chip.offsetLeft + chip.offsetWidth > nav.scrollLeft + nav.clientWidth)) {
        nav.scrollTo({ left: chip.offsetLeft - 16, behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
      }
    }
  };
  setActive(cards[0]?.id);

  const observer = new IntersectionObserver(
    (entries) => {
      const visible = entries.filter((e) => e.isIntersecting);
      if (visible.length) setActive(visible[0].target.id);
    },
    // A thin band just below the sticky header + tabs + chip row.
    { rootMargin: '-200px 0px -60% 0px' },
  );
  cards.forEach((card) => observer.observe(card));
  return () => observer.disconnect();
}
