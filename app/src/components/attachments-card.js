import { attachmentUrl, deleteAttachment, uploadAttachment } from '../api-client.js';
import { icon } from '../lib/icons.js';
import { t } from '../lib/i18n.js';
import { showToast } from './toast.js';

// Client attachments (PDF plans, photos, …) kept in Supabase Storage. Links go
// through /customer-files/<slug>/<path>, which redirects to a short-lived signed
// URL, so they open in a new tab. Upload and remove stay on this card; the list
// is updated in place rather than reloading the whole client page.

// Mirrors MAX_ATTACHMENT_BYTES and CONTENT_TYPES in server/lib/attachments.js; the
// server enforces both, this only saves a pointless upload.
const MAX_MB = 4;
const ACCEPT = '.pdf,.png,.jpg,.jpeg,.webp,.gif,.heic,.txt,.csv,.doc,.docx,.xls,.xlsx';

function formatBytes(bytes) {
  if (bytes == null) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function fileName(relativePath) {
  return relativePath.split('/').pop();
}

/**
 * attachments: [{ relativePath, sizeBytes }] from GET /api/customers/<slug>, or null
 * when Storage couldn't be read (the card says so and hides the upload control).
 */
export function renderAttachmentsCard(slug, attachments, { readOnly = false } = {}) {
  const section = document.createElement('section');
  section.className = 'card attachments';

  const header = document.createElement('div');
  header.className = 'attachments-header';
  const h2 = document.createElement('h2');
  h2.textContent = t('attach.title');
  header.appendChild(h2);
  section.appendChild(header);

  if (attachments === null) {
    const unavailable = document.createElement('p');
    unavailable.className = 'empty-state';
    unavailable.textContent = t('attach.unavailable');
    section.appendChild(unavailable);
    return section;
  }

  const items = [...attachments];
  const list = document.createElement('ul');
  list.className = 'attachment-list';
  const empty = document.createElement('p');
  empty.className = 'empty-state attachments-empty';
  empty.textContent = readOnly ? t('attach.emptyReadOnly') : t('attach.empty', { mb: MAX_MB });
  const error = document.createElement('p');
  error.className = 'field-error';
  error.setAttribute('role', 'alert');

  function renderItem(a) {
    const li = document.createElement('li');
    li.className = 'attachment-item';
    const link = document.createElement('a');
    link.className = 'attachment-link';
    link.href = attachmentUrl(slug, a.relativePath);
    link.target = '_blank';
    link.rel = 'noopener';
    link.appendChild(icon(/\.pdf$/i.test(a.relativePath) ? 'file-pdf' : 'paperclip', 'attachment-icon'));
    const name = document.createElement('span');
    name.className = 'attachment-name';
    name.textContent = fileName(a.relativePath);
    name.title = a.relativePath;
    link.appendChild(name);
    const size = document.createElement('span');
    size.className = 'attachment-size';
    size.textContent = formatBytes(a.sizeBytes);
    link.appendChild(size);
    li.appendChild(link);
    if (readOnly) return li;

    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'attachment-remove';
    remove.setAttribute('aria-label', t('attach.remove', { name: fileName(a.relativePath) }));
    remove.title = t('attach.remove', { name: fileName(a.relativePath) });
    remove.appendChild(icon('trash'));
    remove.addEventListener('click', async () => {
      if (!window.confirm(t('attach.confirmRemove', { name: fileName(a.relativePath) }))) return;
      remove.disabled = true;
      error.textContent = '';
      try {
        await deleteAttachment(slug, a.relativePath);
        items.splice(items.indexOf(a), 1);
        render();
        showToast(t('attach.removed'));
        uploadButton.focus();
      } catch (err) {
        remove.disabled = false;
        error.textContent = err.message || t('attach.removeFailed');
      }
    });
    li.appendChild(remove);
    return li;
  }

  function render() {
    list.replaceChildren(...items.map(renderItem));
    list.hidden = items.length === 0;
    empty.hidden = items.length > 0;
  }

  // A visually plain button that opens the (hidden) file picker.
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = ACCEPT;
  input.hidden = true;
  const uploadButton = document.createElement('button');
  uploadButton.type = 'button';
  uploadButton.className = 'pdf-download-button attachment-upload';
  const uploadLabel = document.createElement('span');
  uploadLabel.textContent = t('attach.upload');
  uploadButton.append(icon('upload'), uploadLabel);
  uploadButton.addEventListener('click', () => input.click());
  if (!readOnly) header.append(uploadButton, input);

  input.addEventListener('change', async () => {
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    error.textContent = '';
    if (file.size > MAX_MB * 1024 * 1024) {
      error.textContent = t('attach.tooLarge', { mb: MAX_MB });
      return;
    }
    const ext = file.name.includes('.') ? `.${file.name.split('.').pop().toLowerCase()}` : '';
    if (!ACCEPT.split(',').includes(ext)) {
      error.textContent = t('attach.badType');
      return;
    }

    uploadButton.disabled = true;
    uploadButton.setAttribute('aria-busy', 'true');
    uploadLabel.textContent = t('attach.uploading');
    try {
      const saved = await uploadAttachment(slug, file);
      items.unshift(saved);
      render();
      showToast(t('attach.uploaded'));
    } catch (err) {
      error.textContent = err.message || t('attach.failed');
    } finally {
      uploadButton.disabled = false;
      uploadButton.removeAttribute('aria-busy');
      uploadLabel.textContent = t('attach.upload');
    }
  });

  section.append(error, list, empty);
  render();
  return section;
}
