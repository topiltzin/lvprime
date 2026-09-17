import { handleApiRequest } from '../server/index.js';

// Single Vercel Function (Node.js runtime, legacy (req, res) handler — see
// https://vercel.com/docs/functions/runtimes/node-js#node.js-request-and-response-objects)
// that all /api/* and /customer-files/* traffic is rewritten to (see
// ../vercel.json). handleApiRequest does its own internal routing based on
// req.url, exactly like an Express app deployed this way — Vercel preserves
// the original request path in req.url when rewriting to a single function.
export default async function handler(req, res) {
  await handleApiRequest(req, res);
}
