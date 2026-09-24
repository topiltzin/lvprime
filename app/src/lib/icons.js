// Phosphor icons (@phosphor-icons/core), inlined as static SVG strings via Vite's ?raw.
// Trusted build-time assets only — never pass user content through icon().
import caretLeft from '@phosphor-icons/core/assets/regular/caret-left.svg?raw';
import playCircle from '@phosphor-icons/core/assets/fill/play-circle-fill.svg?raw';
import timer from '@phosphor-icons/core/assets/regular/timer.svg?raw';
import downloadSimple from '@phosphor-icons/core/assets/regular/download-simple.svg?raw';
import barbell from '@phosphor-icons/core/assets/regular/barbell.svg?raw';
import clock from '@phosphor-icons/core/assets/regular/clock.svg?raw';
import calendarBlank from '@phosphor-icons/core/assets/regular/calendar-blank.svg?raw';

const ICONS = {
  'caret-left': caretLeft,
  'play-circle': playCircle,
  timer,
  download: downloadSimple,
  barbell,
  clock,
  calendar: calendarBlank,
};

/** Returns a decorative <span class="icon"> wrapping the named icon's SVG. */
export function icon(name, className = '') {
  const span = document.createElement('span');
  span.className = `icon ${className}`.trim();
  span.setAttribute('aria-hidden', 'true');
  span.innerHTML = ICONS[name];
  return span;
}
