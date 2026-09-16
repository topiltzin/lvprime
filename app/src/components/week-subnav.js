// Program tab week selector (User Story 1 / contracts/week-tab-navigation.md): four
// fixed week chips — Week 1..Week 4 — that switch which week's progression note is shown,
// mirroring the interaction pattern of renderDaySubnav() in program-day.js at a level above
// the day-by-day schedule (which stays identical across every week — FR-003, FR-011).

const WEEK_NUMBERS = [1, 2, 3, 4];

const FALLBACK_PROGRESSION_TEXT = 'No specific guidance for this week.';

/**
 * Resolve the progression note to show for a given week (FR-004, FR-005): the matching
 * `weeklyProgression` entry's text, or an explicit fallback message when none matches.
 * Shared by the on-screen render (tab-container.js) and the PDF content builder
 * (program-pdf.js) so the two never drift.
 */
export function resolveProgressionText(weekNumber, weeklyProgression) {
  const entry = (weeklyProgression || []).find((e) => e.weekNumber === weekNumber);
  return entry ? entry.text : FALLBACK_PROGRESSION_TEXT;
}

/**
 * Renders the four week chips, marks `activeWeek` as selected, and calls
 * `onSelect(weekNumber)` on click or arrow-key navigation (wrapping at the ends, mirroring
 * TabContainer's own tab-header keyboard behavior).
 *
 * The returned element manages its own active-chip visual state in place (toggling
 * classes/aria-selected on its existing buttons, never tearing itself down and rebuilding)
 * — the same pattern TabContainer's own tab header uses. `onSelect` is a pure notification
 * for the caller to update whatever else depends on the active week (the progression note);
 * it must not replace this nav element, or keyboard focus would be lost after every
 * arrow-key press (the previously-focused button would no longer be in the document).
 */
export function renderWeekSubnav(activeWeek, onSelect) {
  const nav = document.createElement('nav');
  nav.className = 'week-subnav';
  nav.setAttribute('role', 'tablist');
  nav.setAttribute('aria-label', 'Program week');

  let currentWeek = activeWeek;
  const chips = {};

  function setActiveChip(weekNumber) {
    currentWeek = weekNumber;
    for (const wn of WEEK_NUMBERS) {
      const isActive = wn === weekNumber;
      chips[wn].classList.toggle('active', isActive);
      chips[wn].setAttribute('aria-selected', String(isActive));
    }
  }

  for (const weekNumber of WEEK_NUMBERS) {
    const isActive = weekNumber === activeWeek;
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = isActive ? 'week-chip active' : 'week-chip';
    chip.setAttribute('role', 'tab');
    chip.setAttribute('aria-selected', String(isActive));
    chip.textContent = `Week ${weekNumber}`;
    chip.addEventListener('click', () => {
      setActiveChip(weekNumber);
      onSelect(weekNumber);
    });
    chips[weekNumber] = chip;
    nav.appendChild(chip);
  }

  nav.addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    e.preventDefault();
    const currentIndex = WEEK_NUMBERS.indexOf(currentWeek);
    const delta = e.key === 'ArrowRight' ? 1 : -1;
    const nextWeek = WEEK_NUMBERS[(currentIndex + delta + WEEK_NUMBERS.length) % WEEK_NUMBERS.length];
    setActiveChip(nextWeek);
    chips[nextWeek]?.focus();
    onSelect(nextWeek);
  });

  return nav;
}
