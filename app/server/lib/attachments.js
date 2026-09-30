import path from 'node:path';
import { getSupabaseClient } from './database-client.js';

// Client attachments (PDF plans, photos, …) in a private Supabase Storage bucket,
// one folder per client: `<slug>/<relative path>`. They used to be read from the
// repo's customers/ directory, which doesn't exist on Vercel. The browser never
// talks to Storage for reads: GET /customer-files/<slug>/<path> answers with a
// redirect to a short-lived signed URL, so large files don't pass through the
// API function (Vercel caps function responses at 4.5 MB).

export const ATTACHMENTS_BUCKET = 'customer-attachments';
// Uploads go through the API function, whose request body Vercel caps at 4.5 MB.
export const MAX_ATTACHMENT_BYTES = 4 * 1024 * 1024;
const SIGNED_URL_TTL_S = 5 * 60;
// Storage listings are one folder level at a time; plans/ is as deep as it goes today.
const MAX_FOLDER_DEPTH = 3;

export const CONTENT_TYPES = {
  '.pdf': 'application/pdf',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.heic': 'image/heic',
  '.txt': 'text/plain',
  '.csv': 'text/csv',
  '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.xls': 'application/vnd.ms-excel',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
};

// Opened in the browser tab; everything else downloads.
const INLINE_TYPES = new Set(['application/pdf', 'image/png', 'image/jpeg', 'image/webp', 'image/gif']);

export class AttachmentNotFoundError extends Error {}

/** A file the coach can't attach (type, size, name); message is shown as-is. */
export class AttachmentRejectedError extends Error {
  constructor(reason, message) {
    super(message);
    this.reason = reason;
  }
}

export function contentTypeFor(name) {
  return CONTENT_TYPES[path.extname(name).toLowerCase()] || null;
}

/**
 * Storage keys are restricted to a safe ASCII subset, so a file name like
 * "Semana 1 – Pérez.pdf" becomes "Semana-1-Perez.pdf". Returns '' when nothing
 * usable is left.
 */
export function sanitizeFileName(name) {
  const base = String(name || '').split(/[\\/]/).pop();
  const ext = path.extname(base).toLowerCase();
  const stem = base
    .slice(0, base.length - ext.length)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z0-9._-]+/g, '-')
    .replace(/^[-.]+|[-.]+$/g, '')
    .slice(0, 80);
  return stem ? `${stem}${ext}` : '';
}

/** A client-relative path ("plans/semana1.pdf"): no traversal, no absolute paths. A bad one can't name a file. */
export function assertValidRelativePath(relPath) {
  const segments = String(relPath || '').split('/');
  if (!relPath || segments.some((s) => !s || s === '.' || s === '..' || s.includes('\\'))) {
    throw new AttachmentNotFoundError(String(relPath));
  }
}

function bucket() {
  return getSupabaseClient().storage.from(ATTACHMENTS_BUCKET);
}

function storageError(context, error) {
  const err = new Error(`${context}: ${error.message}`, { cause: error });
  err.code = 'DATABASE_ERROR';
  return err;
}

/** Every file under the client's folder, newest first: { relativePath, sizeBytes, modifiedAt, contentType }. */
export async function listAttachments(slug) {
  const files = [];
  async function walk(prefix, relBase, depth) {
    const { data, error } = await bucket().list(prefix, { limit: 1000, sortBy: { column: 'name', order: 'asc' } });
    if (error) throw storageError(`listAttachments(${slug})`, error);
    const folders = [];
    for (const item of data || []) {
      // Supabase's placeholder object for otherwise-empty folders.
      if (item.name === '.emptyFolderPlaceholder') continue;
      const relPath = relBase ? `${relBase}/${item.name}` : item.name;
      if (item.id === null) {
        if (depth < MAX_FOLDER_DEPTH) folders.push(walk(`${prefix}/${item.name}`, relPath, depth + 1));
      } else {
        files.push({
          relativePath: relPath,
          sizeBytes: item.metadata?.size ?? null,
          modifiedAt: item.updated_at || item.created_at || null,
          contentType: item.metadata?.mimetype || contentTypeFor(item.name),
        });
      }
    }
    await Promise.all(folders);
  }
  await walk(slug, '', 1);
  return files.sort((a, b) => String(b.modifiedAt).localeCompare(String(a.modifiedAt)));
}

/** A signed URL for one attachment; PDFs and images open inline, other types download. */
export async function getAttachmentUrl(slug, relPath) {
  assertValidRelativePath(relPath);
  const type = contentTypeFor(relPath);
  const options = type && INLINE_TYPES.has(type) ? {} : { download: path.basename(relPath) };
  const { data, error } = await bucket().createSignedUrl(`${slug}/${relPath}`, SIGNED_URL_TTL_S, options);
  if (error) {
    if (error.statusCode === '404' || error.status === 404 || /not found/i.test(error.message)) {
      throw new AttachmentNotFoundError(relPath);
    }
    throw storageError(`getAttachmentUrl(${slug})`, error);
  }
  return data.signedUrl;
}

/**
 * Stores a file under the client's folder. Rejects unknown types and oversize
 * files (AttachmentRejectedError). With overwrite false, an existing file with
 * that name is rejected (reason 'exists') rather than replaced.
 */
export async function uploadAttachment(slug, relPath, body, { overwrite = false } = {}) {
  assertValidRelativePath(relPath);
  const contentType = contentTypeFor(relPath);
  if (!contentType) {
    throw new AttachmentRejectedError('type', 'Only PDF, image, text, Word and Excel files can be attached.');
  }
  if (body.length > MAX_ATTACHMENT_BYTES) {
    throw new AttachmentRejectedError('size', `Files must be ${MAX_ATTACHMENT_BYTES / (1024 * 1024)} MB or smaller.`);
  }
  const { error } = await bucket().upload(`${slug}/${relPath}`, body, { contentType, upsert: overwrite });
  if (error) {
    if (error.statusCode === '409' || /exists/i.test(error.message)) {
      throw new AttachmentRejectedError('exists', 'A file with that name is already attached.');
    }
    throw storageError(`uploadAttachment(${slug})`, error);
  }
  return { relativePath: relPath, sizeBytes: body.length, contentType };
}

export async function deleteAttachment(slug, relPath) {
  assertValidRelativePath(relPath);
  const { data, error } = await bucket().remove([`${slug}/${relPath}`]);
  if (error) throw storageError(`deleteAttachment(${slug})`, error);
  if (!data?.length) throw new AttachmentNotFoundError(relPath);
}

/** Creates the private bucket when missing (migration script). */
export async function ensureAttachmentsBucket() {
  const storage = getSupabaseClient().storage;
  const { data } = await storage.getBucket(ATTACHMENTS_BUCKET);
  if (data) return false;
  const { error } = await storage.createBucket(ATTACHMENTS_BUCKET, {
    public: false,
    fileSizeLimit: MAX_ATTACHMENT_BYTES,
    allowedMimeTypes: [...new Set(Object.values(CONTENT_TYPES))],
  });
  if (error) throw storageError('ensureAttachmentsBucket', error);
  return true;
}
