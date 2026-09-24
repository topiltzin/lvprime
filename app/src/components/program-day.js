import { setSafeHtml } from '../lib/safe-html.js';

// Program tab "workout poster" (User Story 2): one card per training day, with structured
// exercise rows when available, falling back to the day's raw rendered html otherwise
// (FR-009, FR-010, FR-011, FR-012).

function renderExerciseRow(exercise) {
  const row = document.createElement('div');
  row.className = 'exercise-row';

  const main = document.createElement('div');
  main.className = 'exercise-row-main';

  // Exercise name doubles as the link to its form-demo video when one is known
  // (specs/007-exercise-library-migration/contracts/exercise-video-linking.md).
  const name = document.createElement(exercise.videoUrl ? 'a' : 'span');
  if (exercise.videoUrl) {
    name.href = exercise.videoUrl;
    name.target = '_blank';
    name.rel = 'noopener noreferrer';
  }
  name.className = 'exercise-name';
  name.textContent = exercise.name;
  main.appendChild(name);

  const setsReps = document.createElement('span');
  setsReps.className = 'exercise-sets-reps';
  setsReps.textContent = exercise.setsReps;
  main.appendChild(setsReps);

  if (exercise.rest) {
    const rest = document.createElement('span');
    rest.className = 'exercise-rest';
    rest.textContent = `Rest ${exercise.rest}`;
    main.appendChild(rest);
  }

  row.appendChild(main);

  if (exercise.formTip) {
    const tip = document.createElement('p');
    tip.className = 'exercise-form-tip';
    tip.textContent = exercise.formTip;
    row.appendChild(tip);
  }

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

export function renderProgramDay(day) {
  const card = document.createElement('article');
  card.className = 'program-day-card';
  card.id = `day-${slugifyDay(day.day)}`;

  const title = document.createElement('h3');
  title.textContent = day.focus ? `${day.day} — ${day.focus}` : day.day;
  card.appendChild(title);

  if (day.exercises && day.exercises.length) {
    const list = document.createElement('div');
    list.className = 'exercise-list';
    for (const exercise of day.exercises) {
      list.appendChild(renderExerciseRow(exercise));
    }
    card.appendChild(list);
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
    chip.textContent = day.day;
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
