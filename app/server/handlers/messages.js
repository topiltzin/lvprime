import { listMessages, shapeMessage } from '../lib/messages.js';
import { sendJson } from '../http.js';

// The old coach-client conversation (specs/016) is read-only history now; the coach sees it
// beside the welcome message editor (specs/018). The route is coach-only (the default tag).

export async function handleGetMessages(req, res, slug) {
  const messages = await listMessages(slug);
  sendJson(res, 200, { messages: messages.map(shapeMessage) });
}
