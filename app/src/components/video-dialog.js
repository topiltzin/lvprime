import { icon } from '../lib/icons.js';
import { t } from '../lib/i18n.js';
import { parseVideoUrl, buildEmbedUrl } from '../lib/video-embed.js';

// Modal popup that plays an exercise demo video on the current page instead of sending the
// customer to YouTube (specs/017-in-page-video-player/contracts/video-dialog-ui.md).
// Uses a native <dialog> + showModal(): focus containment, inert background, Esc and the
// top layer come from the platform. The iframe is created only on open, so nothing from the
// video host loads on page view.

const LOAD_TIMEOUT_MS = 10_000;

let active = null;

/**
 * Opens the video in a popup. Returns false (doing nothing) when the link is not a
 * recognisable YouTube video or a popup is already open, so the caller keeps its default
 * behaviour (opening the link in a new tab).
 */
export function openVideoDialog({ url, title, opener }) {
  if (active) return false;
  const video = parseVideoUrl(url);
  if (!video) return false;

  const dialog = document.createElement('dialog');
  dialog.className = 'video-dialog';
  dialog.setAttribute('aria-labelledby', 'video-dialog-title');

  const panel = document.createElement('div');
  panel.className = 'video-dialog-panel';

  const header = document.createElement('header');
  header.className = 'video-dialog-header';
  const heading = document.createElement('h2');
  heading.id = 'video-dialog-title';
  heading.textContent = title;
  const closeButton = document.createElement('button');
  closeButton.type = 'button';
  closeButton.className = 'video-dialog-close';
  closeButton.setAttribute('aria-label', t('video.close'));
  closeButton.appendChild(icon('close'));
  header.append(heading, closeButton);

  const stage = document.createElement('div');
  stage.className = 'video-dialog-stage';
  const status = document.createElement('div');
  status.className = 'video-dialog-status';
  status.setAttribute('role', 'status');
  status.textContent = t('video.loading');
  const frame = document.createElement('iframe');
  frame.title = title;
  frame.allow = 'autoplay; fullscreen; picture-in-picture';
  frame.allowFullscreen = true;
  frame.referrerPolicy = 'strict-origin-when-cross-origin';
  stage.append(status, frame);

  const external = document.createElement('a');
  external.className = 'video-dialog-external';
  external.href = url;
  external.target = '_blank';
  external.rel = 'noopener noreferrer';
  external.textContent = t('video.openOnYoutube');

  panel.append(header, stage, external);
  dialog.appendChild(panel);

  // Back button / gesture closes the popup instead of leaving the program page. Same-URL
  // pushState does not fire hashchange, so the router in main.js is unaffected.
  let ownsHistoryEntry = true;
  history.pushState({ videoDialog: true }, '');
  const onPopState = () => {
    ownsHistoryEntry = false;
    if (dialog.open) dialog.close();
  };
  window.addEventListener('popstate', onPopState);

  const loadTimer = setTimeout(() => {
    status.textContent = t('video.error');
    stage.dataset.state = 'failed';
    frame.removeAttribute('src');
  }, LOAD_TIMEOUT_MS);
  frame.addEventListener('load', () => {
    if (!frame.getAttribute('src')) return;
    clearTimeout(loadTimer);
    stage.dataset.state = 'ready';
  });

  closeButton.addEventListener('click', () => dialog.close());
  // The panel fills the dialog, so a click landing on the dialog itself is the backdrop.
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) dialog.close();
  });
  // Fires for every close path (button, backdrop, Esc, Back).
  dialog.addEventListener('close', () => {
    clearTimeout(loadTimer);
    window.removeEventListener('popstate', onPopState);
    dialog.remove(); // drops the iframe, which stops playback
    document.body.classList.remove('video-dialog-open');
    active = null;
    if (ownsHistoryEntry) history.back();
    if (opener?.isConnected) opener.focus();
  });

  document.body.appendChild(dialog);
  document.body.classList.add('video-dialog-open');
  dialog.showModal();
  frame.src = buildEmbedUrl(video);
  closeButton.focus();
  active = dialog;
  return true;
}
