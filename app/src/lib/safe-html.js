import DOMPurify from 'dompurify';

// Every Markdown-rendered HTML string (program days, progression, notes,
// nutrition) goes through here before touching the DOM, so a <script> or
// onerror= in stored content can't run in the coach's session.
export function setSafeHtml(el, html) {
  el.innerHTML = DOMPurify.sanitize(html || '');
}
