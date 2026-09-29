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

export function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    let size = 0;
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        // Drain and discard the rest (not destroy) so the 413 still reaches the client.
        req.removeAllListeners('data');
        req.resume();
        reject(new PayloadTooLargeError('request body too large'));
        return;
      }
      data += chunk;
    });
    req.on('end', () => {
      if (!data) return resolve({});
      try {
        resolve(JSON.parse(data));
      } catch (err) {
        reject(err);
      }
    });
    req.on('error', reject);
  });
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
