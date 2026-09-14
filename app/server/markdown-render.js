import { marked } from 'marked';

marked.setOptions({ gfm: true, breaks: false });

// Renders arbitrary Markdown (program.md / notes.md prose, tables, lists) to HTML
// for display. See research.md §3 — used only for free-form content, not the
// structured feedback.md entries (those go through markdown-parser.js instead).
export function renderMarkdown(mdText) {
  if (!mdText) return '';
  return marked.parse(mdText);
}
