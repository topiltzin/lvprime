import { setSafeHtml } from '../lib/safe-html.js';
import { icon } from '../lib/icons.js';
import { formatDayDate } from '../lib/format.js';
import { todayIso } from '../lib/day-completion.js';
import { notepadStartText } from '../lib/day-notes.js';
import { t, tn } from '../lib/i18n.js';
import { openVideoDialog } from './video-dialog.js';

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
    name.setAttribute('aria-label', t('day.watchVideo', { name: exercise.name }));
    // Plain click plays the video in a popup on this page; modified clicks and links the popup
    // can't play keep the default new-tab behaviour.
    name.addEventListener('click', (event) => {
      if (event.defaultPrevented || event.button !== 0) return;
      if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
      if (openVideoDialog({ url: exercise.videoUrl, title: exercise.name, opener: name })) {
        event.preventDefault();
      }
    });
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
  // A trailing "(note)" (e.g. "3 x 10 - 12 kg (subir a 14 kg si…)") moves to its own
  // small line so the sets and load stay short enough to fit a phone screen.
  const noteMatch = exercise.setsReps.match(/^(.*?)\s*\(([^()]+)\)\s*$/);
  setsReps.textContent = noteMatch && noteMatch[1] ? noteMatch[1] : exercise.setsReps;
  dose.appendChild(setsReps);
  if (noteMatch && noteMatch[1]) {
    const note = document.createElement('span');
    note.className = 'exercise-dose-note';
    note.textContent = noteMatch[2];
    dose.appendChild(note);
  }

  if (exercise.rest) {
    const rest = document.createElement('span');
    rest.className = 'exercise-rest';
    rest.appendChild(icon('timer'));
    const restText = document.createElement('span');
    restText.textContent = t('day.rest', { rest: exercise.rest });
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
  chip.append(entry.date === todayIso() ? t('day.doneToday') : t('day.doneOn', { date: formatDayDate(entry.date) }));
  return chip;
}

// Inline notepad between the exercises and the footer, collapsed until the footer's
// details button opens it: one note for the whole session, preloaded with the day's
// exercises, usable before or after "Mark done". Saved as the
// day's single feedback entry. Save stays off until the text differs from what was last
// saved, so an untouched preload is never stored.
function renderNotepad(day, initialEntry, onSaveNotes, id) {
  const pad = document.createElement('form');
  pad.className = 'day-notepad';
  pad.id = id;
  pad.hidden = true;

  const label = document.createElement('label');
  label.className = 'day-notepad-label';
  label.htmlFor = `${id}-text`;
  label.append(icon('note-pencil'), t('day.notes.title'));
  const hint = document.createElement('p');
  hint.className = 'day-notepad-hint';
  hint.id = `${id}-hint`;
  hint.textContent = t('day.notes.hint');

  const text = document.createElement('textarea');
  text.id = `${id}-text`;
  text.className = 'day-notepad-text';
  text.maxLength = 5000;
  text.setAttribute('aria-describedby', hint.id);

  const error = document.createElement('p');
  error.className = 'field-error day-notepad-error';
  error.setAttribute('role', 'alert');

  const save = document.createElement('button');
  save.type = 'submit';
  save.className = 'day-notepad-save';
  save.textContent = t('common.save');
  const actions = document.createElement('div');
  actions.className = 'day-notepad-actions';
  actions.appendChild(save);

  pad.append(label, hint, text, error, actions);

  let entry = initialEntry;
  let saved = (entry?.notes || '').trim();
  // Grows with its content (field-sizing in the CSS); rows is the fallback elsewhere.
  const fit = () => {
    text.rows = Math.min(16, Math.max(5, text.value.split('\n').length + 1));
  };
  const show = () => {
    text.value = notepadStartText(day, { notes: saved });
    save.disabled = true;
    fit();
  };
  show();
  text.addEventListener('input', () => {
    save.disabled = text.value.trim() === saved;
    fit();
  });

  let busy = false;
  pad.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (busy || save.disabled) return;
    busy = true;
    error.textContent = '';
    save.disabled = true;
    save.setAttribute('aria-busy', 'true');
    save.textContent = t('common.saving');
    try {
      const next = await onSaveNotes(day, entry, text.value.trim());
      entry = next;
      saved = (next?.notes ?? text.value).trim();
      save.disabled = text.value.trim() === saved;
      pad.dispatchEvent(new CustomEvent('notepad-saved'));
    } catch {
      error.textContent = t('common.couldNotSave');
      save.disabled = false;
    } finally {
      busy = false;
      save.removeAttribute('aria-busy');
      save.textContent = t('common.save');
    }
  });

  return {
    pad,
    text,
    hasNote: () => !!saved,
    /** "Mark done" produced/updated the day's entry: later saves go to it. */
    setEntry(next) {
      entry = next;
    },
  };
}

function renderDayFooter(card, day, options) {
  const { editable, onMarkDone, onEntryChange, notepad } = options;
  const footer = document.createElement('footer');
  footer.className = 'program-day-footer';
  // Announces the switch to "Done" without making the buttons part of a live region.
  const status = document.createElement('div');
  status.className = 'program-day-status';
  status.setAttribute('role', 'status');
  footer.appendChild(status);

  // Opens/closes the notepad; one button for both the idle and done footers.
  let details = null;
  if (notepad) {
    details = document.createElement('button');
    details.type = 'button';
    details.className = 'day-add-details';
    details.setAttribute('aria-expanded', 'false');
    details.setAttribute('aria-controls', notepad.pad.id);
    const detailsLabel = document.createElement('span');
    const syncLabel = () => {
      detailsLabel.textContent = t(notepad.hasNote() ? 'day.editDetails' : 'day.addDetails');
    };
    syncLabel();
    details.append(icon('note-pencil'), detailsLabel);
    const setOpen = (open) => {
      notepad.pad.hidden = !open;
      details.setAttribute('aria-expanded', String(open));
      if (open) {
        notepad.text.focus();
        notepad.text.setSelectionRange(notepad.text.value.length, notepad.text.value.length);
      } else {
        details.focus();
      }
    };
    details.addEventListener('click', () => setOpen(notepad.pad.hidden));
    notepad.pad.addEventListener('notepad-saved', () => {
      syncLabel();
      setOpen(false);
    });
  }

  const showDone = (entry, animate) => {
    footer.replaceChildren(status);
    footer.classList.add('is-done');
    card.classList.add('program-day-card--done');
    status.replaceChildren(doneChip(entry, animate));
    if (details) footer.appendChild(details);
  };

  const showIdle = () => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'day-done-button';
    const label = document.createElement('span');
    label.textContent = t('day.markDone');
    button.append(icon('check-circle'), label);
    const error = document.createElement('p');
    error.className = 'field-error day-done-error';
    footer.append(...(details ? [details] : []), button, error);

    let saving = false;
    button.addEventListener('click', async () => {
      if (saving) return;
      saving = true;
      error.textContent = '';
      button.disabled = true;
      button.setAttribute('aria-busy', 'true');
      label.textContent = t('common.saving');
      try {
        const entry = await onMarkDone(day);
        onEntryChange?.(entry);
        showDone(entry, true);
      } catch {
        saving = false;
        button.disabled = false;
        button.removeAttribute('aria-busy');
        label.textContent = t('day.markDone');
        error.textContent = t('common.couldNotSave');
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
 * noteEntry, onSaveNotes(day, entry|null, text) => Promise<entry> } (the per-day notepad). Without options the card renders exactly as before.
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
  title.id = `${card.id}-title`;
  card.setAttribute('aria-labelledby', title.id);
  title.textContent = day.focus || day.day;
  titles.appendChild(title);
  header.appendChild(titles);

  // Days without structured rows (rest days, or free-form days) get no count badge.
  if (hasExercises) {
    const badge = document.createElement('span');
    badge.className = 'program-day-count';
    badge.appendChild(icon('barbell'));
    const n = day.exercises.length;
    badge.append(tn('day.exercises', n));
    header.appendChild(badge);
  }
  card.appendChild(header);

  if (hasExercises) {
    const list = document.createElement('ol');
    list.className = 'exercise-list';
    day.exercises.forEach((exercise, i) => list.appendChild(renderExerciseRow(exercise, i)));
    card.appendChild(list);
    let notepad = null;
    if (options.editable && options.onSaveNotes) {
      notepad = renderNotepad(day, options.noteEntry, options.onSaveNotes, `${card.id}-notepad`);
      card.appendChild(notepad.pad);
    }
    const footer = renderDayFooter(card, day, { ...options, onEntryChange: notepad?.setEntry, notepad });
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
  nav.setAttribute('aria-label', t('day.navLabel'));
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
      // Scrolling alone leaves keyboard focus on the chip; move it to the day so the next
      // Tab starts inside that day's exercises and screen readers announce where they landed.
      if (target) {
        target.tabIndex = -1;
        target.focus({ preventScroll: true });
      }
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
      if (isActive) chip.setAttribute('aria-current', 'true');
      else chip.removeAttribute('aria-current');
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
