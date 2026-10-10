import { icon } from '../lib/icons.js';
import { t } from '../lib/i18n.js';
import { applyLang } from '../lib/lang.js';
import { playBurst, prefersReducedMotion } from './fireworks.js';

// Welcome motivation popup (specs/018-welcome-motivation-popup contracts/welcome-ui.md).
// A native <dialog> + showModal() gives focus containment, an inert background, Esc and the
// top layer, as in video-dialog.js. Text is always set with textContent.

const EXIT_MS = 200;
let active = false;

/**
 * Opens the popup and resolves once the customer has closed it. Does nothing (resolves
 * immediately) when a welcome popup is already open.
 * `preview` shows the coach's view and is the caller's cue to skip recording "seen".
 */
export function openWelcomePopup({ name, body, coachName, preview = false }) {
  if (active) return Promise.resolve();
  active = true;
  const opener = document.activeElement;
  const reduced = prefersReducedMotion();

  const dialog = document.createElement('dialog');
  dialog.className = 'welcome-dialog';
  dialog.setAttribute('aria-labelledby', 'welcome-title');
  dialog.setAttribute('aria-describedby', 'welcome-message');

  const closeButton = document.createElement('button');
  closeButton.type = 'button';
  closeButton.className = 'welcome-close';
  closeButton.setAttribute('aria-label', t('welcome.close'));
  closeButton.appendChild(icon('close'));

  if (preview) {
    const ribbon = document.createElement('span');
    ribbon.className = 'welcome-ribbon';
    ribbon.textContent = t('welcome.preview');
    dialog.appendChild(ribbon);
  }

  const label = document.createElement('p');
  label.className = 'welcome-label';
  label.textContent = coachName || t('welcome.fromCoach');
  const heading = document.createElement('h2');
  heading.id = 'welcome-title';
  heading.className = 'welcome-heading';
  heading.textContent = name ? t('welcome.heading', { name }) : t('welcome.headingNoName');
  const message = document.createElement('p');
  message.id = 'welcome-message';
  message.className = 'welcome-message';
  message.textContent = body;
  applyLang(message, body);
  const cta = document.createElement('button');
  cta.type = 'button';
  cta.className = 'welcome-cta';
  cta.textContent = t('welcome.cta');

  dialog.append(closeButton, label, heading, message, cta);

  const canvas = document.createElement('canvas');
  canvas.className = 'welcome-fx';
  canvas.setAttribute('aria-hidden', 'true');
  // A manual popover joins the top layer, so the effect draws above the modal's backdrop
  // (a plain fixed canvas would sit underneath it).
  canvas.setAttribute('popover', 'manual');

  return new Promise((resolve) => {
    let closing = false;
    let openFx = null;

    const cleanup = () => {
      try {
        canvas.hidePopover();
      } catch {
        // Not shown (unsupported browser or reduced motion): nothing to hide.
      }
      if (dialog.open) dialog.close();
      dialog.remove();
      canvas.remove();
      document.body.classList.remove('welcome-open');
      active = false;
      if (opener && typeof opener.focus === 'function' && document.contains(opener)) opener.focus();
    };

    const close = () => {
      if (closing) return;
      closing = true;
      openFx?.cancel();
      // The customer is free to continue at once; the exit effect finishes on its own.
      resolve();
      // Stays open (but inert to clicks) while it fades out; cleanup() closes it.
      dialog.classList.add('is-closing');
      const fx = reduced || !canvas.matches(':popover-open') ? null : playBurst(canvas, { bursts: 1, particlesPerBurst: 28, durationMs: 500 });
      const gone = new Promise((r) => setTimeout(r, EXIT_MS));
      Promise.all([gone, fx]).then(cleanup, cleanup);
    };

    closeButton.addEventListener('click', close);
    cta.addEventListener('click', close);
    dialog.addEventListener('cancel', (event) => {
      event.preventDefault();
      close();
    });
    // A click on the backdrop lands on the dialog element itself, not on its content.
    dialog.addEventListener('click', (event) => {
      if (event.target === dialog) close();
    });

    document.body.append(canvas, dialog);
    document.body.classList.add('welcome-open');
    dialog.showModal();
    cta.focus();
    if (!reduced) {
      try {
        canvas.showPopover();
        openFx = playBurst(canvas, { bursts: 3, particlesPerBurst: 28, durationMs: 1200 });
      } catch {
        // Popover API unavailable: the card still works, just without the effect.
      }
    }
  });
}
