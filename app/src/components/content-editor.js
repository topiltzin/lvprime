import { marked } from 'marked';
import { getContent, saveContent, ApiError } from '../api-client.js';
import { setSafeHtml } from '../lib/safe-html.js';
import { showToast } from './toast.js';
import { t } from '../lib/i18n.js';

/**
 * Markdown editor card for one file (a program week, notes, or the nutrition plan).
 *
 * options:
 *  - slug, fileType ('program' | 'notes' | 'nutrition_plan'), weekNumber (program only)
 *  - title: heading text
 *  - copyFromWeek: start a NEW week prefilled with that week's Markdown (version 0)
 *  - onSaved(result): called after a successful save
 *  - onCancel(): called when the coach leaves without saving
 */
export function renderContentEditor({ slug, fileType, weekNumber, title, copyFromWeek, onSaved, onCancel }) {
  const wrap = document.createElement('section');
  wrap.className = 'card log-session-form-wrap content-editor';

  const heading = document.createElement('h3');
  heading.textContent = title;
  wrap.appendChild(heading);

  const status = document.createElement('p');
  status.className = 'form-intro';
  status.textContent = t('editor.loading');
  wrap.appendChild(status);

  const form = document.createElement('form');
  form.className = 'feedback-form';
  form.hidden = true;
  wrap.appendChild(form);

  const tabs = document.createElement('div');
  tabs.className = 'editor-modes';
  const writeBtn = document.createElement('button');
  const previewBtn = document.createElement('button');
  for (const [btn, label] of [[writeBtn, t('editor.write')], [previewBtn, t('editor.preview')]]) {
    btn.type = 'button';
    btn.textContent = label;
    btn.className = 'editor-mode';
    tabs.appendChild(btn);
  }
  form.appendChild(tabs);

  const textarea = document.createElement('textarea');
  textarea.className = 'editor-textarea';
  textarea.setAttribute('aria-label', t('editor.markdownLabel', { title }));
  textarea.spellcheck = true;
  form.appendChild(textarea);

  const preview = document.createElement('div');
  preview.className = 'card prose editor-preview';
  preview.hidden = true;
  form.appendChild(preview);

  const actions = document.createElement('div');
  actions.className = 'form-actions';
  const message = document.createElement('div');
  message.className = 'field-error';
  message.setAttribute('role', 'alert');
  const cancelBtn = document.createElement('button');
  cancelBtn.type = 'button';
  cancelBtn.className = 'pdf-download-button';
  cancelBtn.textContent = t('common.cancel');
  const saveBtn = document.createElement('button');
  saveBtn.type = 'submit';
  saveBtn.textContent = t('common.save');
  actions.append(message, cancelBtn, saveBtn);
  form.appendChild(actions);

  let version = 0;
  let original = '';

  const setMode = (mode) => {
    const isPreview = mode === 'preview';
    if (isPreview) setSafeHtml(preview, marked(textarea.value || ''));
    textarea.hidden = isPreview;
    preview.hidden = !isPreview;
    writeBtn.classList.toggle('active', !isPreview);
    previewBtn.classList.toggle('active', isPreview);
    writeBtn.setAttribute('aria-pressed', String(!isPreview));
    previewBtn.setAttribute('aria-pressed', String(isPreview));
  };
  writeBtn.addEventListener('click', () => setMode('write'));
  previewBtn.addEventListener('click', () => setMode('preview'));

  const isDirty = () => textarea.value !== original;

  cancelBtn.addEventListener('click', () => {
    if (isDirty() && !window.confirm(t('editor.discard'))) return;
    onCancel?.();
  });

  const save = async () => {
    message.textContent = '';
    if (!textarea.value.trim()) {
      message.textContent = t('editor.empty');
      return;
    }
    saveBtn.disabled = true;
    try {
      const result = await saveContent(slug, { fileType, weekNumber, content: textarea.value, version });
      original = textarea.value;
      await onSaved?.(result);
    } catch (err) {
      message.textContent = err instanceof ApiError ? err.message : t('common.couldNotSave');
    } finally {
      saveBtn.disabled = false;
    }
  };

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    save();
  });
  // Ctrl/Cmd+S saves without leaving the textarea.
  textarea.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
      e.preventDefault();
      save();
    }
  });

  (async () => {
    try {
      const source = await getContent(slug, { fileType, weekNumber: copyFromWeek ?? weekNumber });
      // A copy becomes a brand-new row, so it starts at version 0.
      version = copyFromWeek ? 0 : source.version;
      textarea.value = source.content;
      // A new week is unsaved until the coach saves it, even before any typing.
      original = copyFromWeek ? '' : source.content;
      status.textContent = copyFromWeek
        ? t('editor.copyIntro', { n: weekNumber, from: copyFromWeek })
        : t('editor.intro');
      form.hidden = false;
      setMode('write');
      textarea.focus();
    } catch (err) {
      status.textContent = '';
      message.textContent = '';
      showToast(err.message || t('editor.loadFailed'), 3000, 'error');
      onCancel?.();
    }
  })();

  return wrap;
}
