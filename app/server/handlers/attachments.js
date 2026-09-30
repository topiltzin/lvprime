import { PayloadTooLargeError, readRawBody, sendJson } from '../http.js';
import { getCustomer } from '../lib/customer-data.js';
import {
  AttachmentNotFoundError,
  AttachmentRejectedError,
  MAX_ATTACHMENT_BYTES,
  deleteAttachment,
  getAttachmentUrl,
  sanitizeFileName,
  uploadAttachment,
} from '../lib/attachments.js';

// Client attachments in Supabase Storage (server/lib/attachments.js).

// GET /customer-files/<slug>/<path>: redirect to a short-lived signed URL.
export async function handleCustomerFile(req, res, slug, relPath) {
  await getCustomer(slug);
  try {
    const url = await getAttachmentUrl(slug, relPath);
    res.statusCode = 302;
    res.setHeader('Location', url);
    res.setHeader('Cache-Control', 'no-store');
    res.end();
  } catch (err) {
    if (err instanceof AttachmentNotFoundError) return sendJson(res, 404, { error: 'not_found' });
    throw err;
  }
}

// POST /api/customers/<slug>/attachments?name=<file name>, raw file bytes as the body.
export async function handleUploadAttachment(req, res, slug) {
  await getCustomer(slug);
  const url = new URL(req.url, 'http://localhost');
  const name = sanitizeFileName(url.searchParams.get('name'));
  if (!name) {
    return sendJson(res, 422, { error: 'validation_failed', fields: { file: 'Choose a file with a name.' } });
  }

  let body;
  try {
    body = await readRawBody(req, MAX_ATTACHMENT_BYTES);
  } catch (err) {
    if (err instanceof PayloadTooLargeError) {
      return sendJson(res, 413, {
        error: 'file_too_large',
        message: `Files must be ${MAX_ATTACHMENT_BYTES / (1024 * 1024)} MB or smaller.`,
      });
    }
    throw err;
  }
  if (!body.length) {
    return sendJson(res, 422, { error: 'validation_failed', fields: { file: 'The file is empty.' } });
  }

  try {
    const attachment = await uploadAttachment(slug, name, body);
    sendJson(res, 201, { ...attachment, modifiedAt: new Date().toISOString() });
  } catch (err) {
    if (err instanceof AttachmentRejectedError) {
      const status = err.reason === 'exists' ? 409 : 422;
      return sendJson(res, status, {
        error: err.reason === 'exists' ? 'attachment_exists' : 'validation_failed',
        message: err.message,
        fields: { file: err.message },
      });
    }
    throw err;
  }
}

// DELETE /api/customers/<slug>/attachments/<path>
export async function handleDeleteAttachment(req, res, slug, relPath) {
  await getCustomer(slug);
  try {
    await deleteAttachment(slug, relPath);
    sendJson(res, 200, { ok: true });
  } catch (err) {
    if (err instanceof AttachmentNotFoundError) return sendJson(res, 404, { error: 'not_found' });
    throw err;
  }
}
