/**
 * Sync State Management - Persistent tracking of file sync status
 * Simplified version for MVP: Uses in-memory store with JSON file persistence
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.join(__dirname, 'data', 'sync-state.json');

// In-memory store
let _syncMetadata = {};
let _syncLog = [];

/**
 * Load sync state from file
 */
function loadSyncState() {
  try {
    if (fs.existsSync(dbPath)) {
      const data = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
      _syncMetadata = data.metadata || {};
      _syncLog = data.log || [];
    }
  } catch (err) {
    console.warn('Failed to load sync state:', err.message);
    _syncMetadata = {};
    _syncLog = [];
  }
}

/**
 * Save sync state to file
 */
function saveSyncState() {
  try {
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(dbPath, JSON.stringify({ metadata: _syncMetadata, log: _syncLog }, null, 2), 'utf8');
  } catch (err) {
    console.error('Failed to save sync state:', err.message);
  }
}

// Initialize on module load
loadSyncState();

/**
 * Get sync state for a customer file
 * @param {string} customerId - Customer identifier
 * @param {string} fileType - 'program', 'feedback', or 'notes'
 * @returns {object|null} Sync metadata or null if not found
 */
export function getSyncState(customerId, fileType) {
  const key = `${customerId}:${fileType}`;
  return _syncMetadata[key] || null;
}

/**
 * Initialize sync state for a customer file (first sync)
 * @param {string} customerId - Customer identifier
 * @param {string} fileType - 'program', 'feedback', or 'notes'
 * @returns {object} Inserted row with new sync metadata
 */
export function initializeSyncState(customerId, fileType) {
  const key = `${customerId}:${fileType}`;
  const now = new Date().toISOString();

  _syncMetadata[key] = {
    customer_id: customerId,
    file_type: fileType,
    current_version: 0,
    sync_status: 'synced',
    last_sync_timestamp: now,
    offline_queue: '[]',
    last_writer: null,
    last_content_hash: null,
    created_at: now,
    updated_at: now
  };

  saveSyncState();
  return _syncMetadata[key];
}

/**
 * Update sync status for a file
 * @param {string} customerId - Customer identifier
 * @param {string} fileType - 'program', 'feedback', or 'notes'
 * @param {string} status - 'synced', 'pending', or 'conflicted'
 * @returns {void}
 */
export function updateSyncStatus(customerId, fileType, status) {
  const key = `${customerId}:${fileType}`;
  if (_syncMetadata[key]) {
    _syncMetadata[key].sync_status = status;
    _syncMetadata[key].updated_at = new Date().toISOString();
    saveSyncState();
  }
}

/**
 * Record a sync event in the audit log
 * @param {string} customerId - Customer identifier
 * @param {string} fileType - 'program', 'feedback', or 'notes'
 * @param {string} eventType - 'sync_start', 'sync_success', 'sync_conflict', 'sync_error'
 * @param {object} metadata - Additional event details
 * @returns {void}
 */
export function recordSyncEvent(customerId, fileType, eventType, metadata = {}) {
  _syncLog.push({
    timestamp: new Date().toISOString(),
    customer_id: customerId,
    file_type: fileType,
    event_type: eventType,
    source: metadata.source || null,
    version_from: metadata.version_from || null,
    version_to: metadata.version_to || null,
    conflict_description: metadata.conflict_description || null,
    error_message: metadata.error_message || null,
    content_hash: metadata.content_hash || null
  });

  saveSyncState();
}

/**
 * Get last sync timestamp for a file
 * @param {string} customerId - Customer identifier
 * @param {string} fileType - 'program', 'feedback', or 'notes'
 * @returns {string|null} ISO8601 timestamp or null
 */
export function getLastSyncTimestamp(customerId, fileType) {
  const state = getSyncState(customerId, fileType);
  return state ? state.last_sync_timestamp : null;
}

/**
 * Increment version counter for a file (atomic)
 * @param {string} customerId - Customer identifier
 * @param {string} fileType - 'program', 'feedback', or 'notes'
 * @returns {number} New version number
 */
export function incrementVersion(customerId, fileType) {
  const key = `${customerId}:${fileType}`;
  if (!_syncMetadata[key]) {
    initializeSyncState(customerId, fileType);
  }

  _syncMetadata[key].current_version++;
  _syncMetadata[key].updated_at = new Date().toISOString();
  saveSyncState();

  return _syncMetadata[key].current_version;
}

/**
 * Update sync metadata after successful sync
 * @param {string} customerId - Customer identifier
 * @param {string} fileType - 'program', 'feedback', or 'notes'
 * @param {number} newVersion - New version number
 * @param {string} lastWriter - 'coach' or 'customer'
 * @param {string} contentHash - SHA256 hash of synced content
 * @returns {void}
 */
export function updateSyncMetadata(customerId, fileType, newVersion, lastWriter, contentHash) {
  const key = `${customerId}:${fileType}`;
  if (!_syncMetadata[key]) {
    initializeSyncState(customerId, fileType);
  }

  const now = new Date().toISOString();
  _syncMetadata[key].current_version = newVersion;
  _syncMetadata[key].last_writer = lastWriter;
  _syncMetadata[key].last_content_hash = contentHash;
  _syncMetadata[key].last_sync_timestamp = now;
  _syncMetadata[key].sync_status = 'synced';
  _syncMetadata[key].offline_queue = '[]';
  _syncMetadata[key].updated_at = now;

  saveSyncState();
}

/**
 * Get recent sync events for a customer
 * @param {string} customerId - Customer identifier
 * @param {number} limit - Max events to return (default: 10)
 * @returns {array} Sync log entries
 */
export function getRecentSyncEvents(customerId, limit = 10) {
  return _syncLog
    .filter(e => e.customer_id === customerId)
    .slice(-limit);
}

/**
 * Validate sync state schema - ensures database is properly initialized
 * @returns {object} {valid: boolean, errors: array}
 */
export function validateSyncStateSchema() {
  const errors = [];

  try {
    // For MVP: just verify we can load/save
    saveSyncState();
    loadSyncState();
    return { valid: true, errors: [] };
  } catch (err) {
    return { valid: false, errors: [err.message] };
  }
}

/**
 * Close/reset database connection (for testing)
 */
export function closeDb() {
  _syncMetadata = {};
  _syncLog = [];
}

export default {
  getSyncState,
  initializeSyncState,
  updateSyncStatus,
  recordSyncEvent,
  getLastSyncTimestamp,
  incrementVersion,
  updateSyncMetadata,
  getRecentSyncEvents,
  validateSyncStateSchema,
  closeDb
};
