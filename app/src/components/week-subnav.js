// Program tab week selector (specs/010 contracts/week-tab-navigation-v2.md): one chip per
// week the customer actually has. Past weeks are marked locked but stay selectable —
// locking blocks edits, never viewing.

/**
 * Renders one chip per entry in `weeks` ({ weekNumber, isLocked }[], ascending), marks
 * `activeWeek` as selected, and calls `onSelect(weekNumber)` on click or arrow-key
 * navigation (wrapping at the ends).
 *
 * The returned element updates its own active-chip state in place rather than being
 * rebuilt, so keyboard focus survives arrow-key navigation.
 */
export function renderWeekSubnav(weeks, activeWeek, onSelect) {
  const nav = document.createElement('nav');
  nav.className = 'week-subnav';
  nav.setAttribute('role', 'tablist');
  nav.setAttribute('aria-label', 'Program week');

  const weekNumbers = weeks.map((w) => w.weekNumber);
  let currentWeek = activeWeek;
  const chips = {};

  function setActiveChip(weekNumber) {
    currentWeek = weekNumber;
    for (const wn of weekNumbers) {
      const isActive = wn === weekNumber;
      chips[wn].classList.toggle('active', isActive);
      chips[wn].setAttribute('aria-selected', String(isActive));
    }
  }

  for (const { weekNumber, isLocked } of weeks) {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'week-chip';
    chip.classList.toggle('active', weekNumber === activeWeek);
    chip.classList.toggle('locked', isLocked);
    chip.setAttribute('role', 'tab');
    chip.setAttribute('aria-selected', String(weekNumber === activeWeek));
    chip.textContent = `Week ${weekNumber}`;
    if (isLocked) {
      chip.title = 'Past week (read-only)';
      chip.setAttribute('aria-label', `Week ${weekNumber}, past week, read-only`);
    }
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
    const currentIndex = weekNumbers.indexOf(currentWeek);
    const delta = e.key === 'ArrowRight' ? 1 : -1;
    const nextWeek = weekNumbers[(currentIndex + delta + weekNumbers.length) % weekNumbers.length];
    setActiveChip(nextWeek);
    chips[nextWeek]?.focus();
    onSelect(nextWeek);
  });

  // Long histories scroll horizontally; keep the selected chip in view on first paint.
  // Scroll the row itself: scrollIntoView would also nudge the page vertically.
  requestAnimationFrame(() => {
    const chip = chips[activeWeek];
    if (chip && chip.offsetLeft + chip.offsetWidth > nav.clientWidth) {
      nav.scrollLeft = chip.offsetLeft - 16;
    }
  });

  return nav;
}
