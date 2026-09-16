/**
 * Offline Queue Management - Persists coach changes made while disconnected
 * Enables offline-first workflow with retry on reconnection
 */

import { getSyncState, updateSyncStatus, recordSyncEvent } from './sync-state.js';

/**
 * Add a change to the offline queue
 * Validates entry structure per offline-queue contract
 * @param {string} customerId - Customer identifier
 * @param {object} entry - Queue entry {sequence, timestamp, file_type, action, content_hash, content_size_bytes, description}
 * @returns {object} Updated sync state with new queue
 */
export function queueChange(customerId, entry) {
  // Validate required fields
  if (!entry.sequence || !entry.timestamp || !entry.file_type || !entry.action || !entry.content_hash || !entry.content_size_bytes) {
    throw new Error('Queue entry missing required fields: sequence, timestamp, file_type, action, content_hash, content_size_bytes');
  }

  // Validate file_type
  if (!['program', 'notes'].includes(entry.file_type)) {
    throw new Error(`Invalid file_type: ${entry.file_type}. Must be 'program' or 'notes'`);
  }

  // Validate timestamp format (ISO8601)
  if (isNaN(new Date(entry.timestamp).getTime())) {
    throw new Error(`Invalid timestamp format: ${entry.timestamp}. Must be ISO8601`);
  }

  // Validate content_size_bytes > 0
  if (entry.content_size_bytes <= 0) {
    throw new Error('content_size_bytes must be > 0');
  }

  // Validate content_hash format (SHA256 hex string)
  if (!/^[a-f0-9]{64}$/i.test(entry.content_hash)) {
    throw new Error(`Invalid content_hash format: ${entry.content_hash}. Must be SHA256 hex string (64 chars)`);
  }

  // Get current queue
  const state = getSyncState(customerId, entry.file_type);
  let queue = state && state.offline_queue ? JSON.parse(state.offline_queue) : [];

  // Validate sequence continuity
  if (queue.length > 0) {
    const maxSequence = Math.max(...queue.map(e => e.sequence));
    if (entry.sequence !== maxSequence + 1) {
      throw new Error(`Sequence gap: expected ${maxSequence + 1}, got ${entry.sequence}`);
    }
  } else if (entry.sequence !== 1) {
    throw new Error(`First sequence must be 1, got ${entry.sequence}`);
  }

  // Add entry to queue
  queue.push(entry);

  // Update sync state
  const queueJson = JSON.stringify(queue);
  updateSyncStatus(customerId, entry.file_type, 'pending');

  // Record queue event
  recordSyncEvent(customerId, entry.file_type, 'sync_start', {
    source: 'coach',
    version_from: state?.current_version || 0
  });

  return { queue, queueJson };
}

/**
 * Get entire offline queue for a customer file
 * @param {string} customerId - Customer identifier
 * @param {string} fileType - 'program' or 'notes'
 * @returns {array} Queue entries in sequence order
 */
export function getQueue(customerId, fileType) {
  const state = getSyncState(customerId, fileType);
  if (!state || !state.offline_queue) {
    return [];
  }

  try {
    const queue = JSON.parse(state.offline_queue);
    // Validate queue structure
    if (!Array.isArray(queue)) {
      console.warn(`Invalid queue structure for ${customerId}/${fileType}, resetting to empty`);
      return [];
    }
    return queue;
  } catch (err) {
    console.error(`Failed to parse queue for ${customerId}/${fileType}:`, err);
    return [];
  }
}

/**
 * Clear offline queue after successful sync
 * @param {string} customerId - Customer identifier
 * @param {string} fileType - 'program' or 'notes'
 * @returns {void}
 */
export function clearQueue(customerId, fileType) {
  const state = getSyncState(customerId, fileType);
  if (state) {
    // Update sync state to clear queue
    const db = getDb();
    const stmt = db.prepare(`
      UPDATE sync_metadata
      SET offline_queue = '[]'
      WHERE customer_id = ? AND file_type = ?
    `);
    stmt.run(customerId, fileType);
  }
}

/**
 * Validate queue for flush (before uploading to server)
 * Checks: sequence continuity, timestamp ordering, hash validity
 * @param {array} queue - Queue entries to validate
 * @returns {object} {valid: boolean, errors: array}
 */
export function validateQueueForFlush(queue) {
  const errors = [];

  if (!Array.isArray(queue) || queue.length === 0) {
    return { valid: true, errors: [] };
  }

  // Check sequence continuity
  for (let i = 0; i < queue.length; i++) {
    if (queue[i].sequence !== i + 1) {
      errors.push(`Sequence gap at index ${i}: expected ${i + 1}, got ${queue[i].sequence}`);
    }
  }

  // Check timestamp ordering (ascending or equal)
  for (let i = 1; i < queue.length; i++) {
    const prev = new Date(queue[i - 1].timestamp);
    const curr = new Date(queue[i].timestamp);
    if (curr < prev) {
      errors.push(`Timestamp ordering violation at index ${i}: ${queue[i].timestamp} < ${queue[i - 1].timestamp}`);
    }
  }

  // Check hash validity
  for (let i = 0; i < queue.length; i++) {
    if (!/^[a-f0-9]{64}$/i.test(queue[i].content_hash)) {
      errors.push(`Invalid hash at index ${i}: ${queue[i].content_hash}`);
    }
  }

  return { valid: errors.length === 0, errors };
}

export default {
  queueChange,
  getQueue,
  clearQueue,
  validateQueueForFlush
};
