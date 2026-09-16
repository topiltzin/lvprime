/**
 * Hash Utilities - Content integrity verification for sync operations
 * Uses SHA256 for verifying file content matches declared hash
 */

import crypto from 'node:crypto';

/**
 * Compute SHA256 hash of file content
 * @param {string} content - File content to hash
 * @returns {string} SHA256 hex string (lowercase, 64 chars)
 */
export function computeContentHash(content) {
  if (typeof content !== 'string') {
    throw new TypeError('Content must be a string');
  }

  return crypto
    .createHash('sha256')
    .update(content, 'utf8')
    .digest('hex')
    .toLowerCase();
}

/**
 * Verify content matches expected hash
 * @param {string} content - File content to verify
 * @param {string} expectedHash - Expected SHA256 hash (hex string)
 * @returns {boolean} True if content hash matches expected hash
 */
export function verifyContentHash(content, expectedHash) {
  if (typeof content !== 'string' || typeof expectedHash !== 'string') {
    return false;
  }

  const actualHash = computeContentHash(content);
  return actualHash === expectedHash.toLowerCase();
}

/**
 * Validate hash format (is it a valid SHA256 hex string?)
 * @param {string} hash - Hash to validate
 * @returns {boolean} True if valid SHA256 hex format
 */
export function isValidHashFormat(hash) {
  if (typeof hash !== 'string') {
    return false;
  }
  return /^[a-f0-9]{64}$/i.test(hash);
}

export default {
  computeContentHash,
  verifyContentHash,
  isValidHashFormat
};
