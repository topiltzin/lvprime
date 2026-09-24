// Phosphor icons (@phosphor-icons/core), inlined as static SVG strings via Vite's ?raw.
// Trusted build-time assets only — never pass user content through icon().
import caretLeft from '@phosphor-icons/core/assets/regular/caret-left.svg?raw';
import playCircle from '@phosphor-icons/core/assets/fill/play-circle-fill.svg?raw';
import timer from '@phosphor-icons/core/assets/regular/timer.svg?raw';
import downloadSimple from '@phosphor-icons/core/assets/regular/download-simple.svg?raw';
import barbell from '@phosphor-icons/core/assets/regular/barbell.svg?raw';
import clock from '@phosphor-icons/core/assets/regular/clock.svg?raw';
import calendarBlank from '@phosphor-icons/core/assets/regular/calendar-blank.svg?raw';
import filePdf from '@phosphor-icons/core/assets/regular/file-pdf.svg?raw';
import checkCircle from '@phosphor-icons/core/assets/regular/check-circle.svg?raw';
import xCircle from '@phosphor-icons/core/assets/regular/x-circle.svg?raw';
import chartBar from '@phosphor-icons/core/assets/regular/chart-bar.svg?raw';
import magnifyingGlass from '@phosphor-icons/core/assets/regular/magnifying-glass.svg?raw';
import arrowRight from '@phosphor-icons/core/assets/regular/arrow-right.svg?raw';
import warningCircle from '@phosphor-icons/core/assets/regular/warning-circle.svg?raw';
import notePencil from '@phosphor-icons/core/assets/regular/note-pencil.svg?raw';
import calendarCheck from '@phosphor-icons/core/assets/regular/calendar-check.svg?raw';
import paperclip from '@phosphor-icons/core/assets/regular/paperclip.svg?raw';
import users from '@phosphor-icons/core/assets/regular/users.svg?raw';
import lightning from '@phosphor-icons/core/assets/regular/lightning.svg?raw';
import signOut from '@phosphor-icons/core/assets/regular/sign-out.svg?raw';
import eye from '@phosphor-icons/core/assets/regular/eye.svg?raw';
import eyeSlash from '@phosphor-icons/core/assets/regular/eye-slash.svg?raw';

const ICONS = {
  'caret-left': caretLeft,
  'play-circle': playCircle,
  timer,
  download: downloadSimple,
  barbell,
  clock,
  calendar: calendarBlank,
  users,
  'sign-out': signOut,
  eye,
  'eye-slash': eyeSlash,
  lightning,
  'file-pdf': filePdf,
  'check-circle': checkCircle,
  'x-circle': xCircle,
  'chart-bar': chartBar,
  'magnifying-glass': magnifyingGlass,
  'arrow-right': arrowRight,
  'warning-circle': warningCircle,
  'note-pencil': notePencil,
  'calendar-check': calendarCheck,
  'paperclip': paperclip,
};

/** Returns a decorative <span class="icon"> wrapping the named icon's SVG. */
export function icon(name, className = '') {
  const span = document.createElement('span');
  span.className = `icon ${className}`.trim();
  span.setAttribute('aria-hidden', 'true');
  span.innerHTML = ICONS[name];
  return span;
}
