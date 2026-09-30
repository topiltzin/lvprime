import { CustomerNotFoundError, ValidationError } from './lib/customer-data.js';

export function sendJson(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(body));
}

// Largest legitimate body is a 500KB program sync upload (customer-data.js
// MAX_CONTENT_BYTES) plus JSON overhead.
const MAX_BODY_BYTES = 1024 * 1024;

export class PayloadTooLargeError extends Error {}

// Errors handleApiRequest translates into specific 4xx/503 responses; the sync
// handlers' catch-alls rethrow these instead of flattening them to 500.
export function isMappedError(err) {
  return (
    err instanceof PayloadTooLargeError ||
    err instanceof CustomerNotFoundError ||
    err instanceof ValidationError ||
    err instanceof URIError ||
    err.code === 'DATABASE_ERROR'
  );
}

// Decoded once from the whole body: decoding chunk by chunk would split a multi-byte
// character (á, ñ, ó) that lands on a chunk boundary into two U+FFFD characters.
export async function readJsonBody(req) {
  const text = (await readRawBody(req, MAX_BODY_BYTES)).toString('utf8');
  return text ? JSON.parse(text) : {};
}

// Parsed body, or undefined after answering 422 for malformed JSON
// (JSON.parse never yields undefined, so a literal `null` body still passes through).
export async function readJsonBodyOr422(req, res) {
  try {
    return await readJsonBody(req);
  } catch (err) {
    if (err instanceof PayloadTooLargeError) throw err;
    sendJson(res, 422, { error: 'validation_failed', fields: { body: 'invalid JSON' } });
    return undefined;
  }
}

/** The raw request body as a Buffer; PayloadTooLargeError past maxBytes (attachment uploads). */
export function readRawBody(req, maxBytes) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > maxBytes) {
        req.removeAllListeners('data');
        req.resume();
        reject(new PayloadTooLargeError('request body too large'));
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}
