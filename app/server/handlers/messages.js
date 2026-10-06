import {
  countUnread,
  deleteCoachMessage,
  hasCoachMessage,
  insertMessage,
  latestCoachMessageRead,
  listMessages,
  markRead,
  shapeMessage,
  validateMessage,
} from '../lib/messages.js';
import { readJsonBodyOr422, sendJson } from '../http.js';

// Coach-client messages (specs/016-coach-client-messaging contracts/messages-api.md).
// Every route is tagged access: 'customer-own', so by the time a handler runs the coach
// may use any slug and a customer only their own. The sender is req.actor.role.

export async function handleGetMessages(req, res, slug) {
  const role = req.actor.role;
  const messages = await listMessages(slug);
  const [unread, latestRead, coachWrote] = await Promise.all([
    countUnread(slug, role),
    latestCoachMessageRead(slug),
    role === 'coach' ? true : hasCoachMessage(slug),
  ]);
  sendJson(res, 200, {
    messages: messages.map(shapeMessage),
    canReply: coachWrote,
    unread,
    latestCoachMessageRead: latestRead,
  });
}

export async function handlePostMessage(req, res, slug) {
  const body = await readJsonBodyOr422(req, res);
  if (body === undefined) return;

  const result = validateMessage(body);
  if (!result.ok) return sendJson(res, 422, { error: 'validation_failed', fields: result.fields });

  const role = req.actor.role;
  // FR-004: the coach starts every conversation; a customer replies after that.
  if (role === 'customer' && !(await hasCoachMessage(slug))) {
    return sendJson(res, 409, { error: 'no_coach_message', message: 'Your coach has not written yet.' });
  }

  const { row, created } = await insertMessage(slug, role, result.value.body, result.value.clientId);
  sendJson(res, created ? 201 : 200, { message: shapeMessage(row) });
}

export async function handleMarkMessagesRead(req, res, slug) {
  const role = req.actor.role;
  const marked = await markRead(slug, role);
  sendJson(res, 200, { marked, unread: await countUnread(slug, role) });
}

export async function handleDeleteMessage(req, res, slug, id) {
  if (req.actor.role !== 'coach') {
    return sendJson(res, 403, { error: 'forbidden', message: 'You do not have access to this.' });
  }
  const messageId = /^\d+$/.test(id) ? Number(id) : null;
  if (messageId === null || !(await deleteCoachMessage(slug, messageId))) {
    return sendJson(res, 404, { error: 'message_not_found' });
  }
  sendJson(res, 200, { deleted: true });
}
