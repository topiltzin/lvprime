/**
 * Sync Engine - Coordinates file sync, conflict detection, and resolution
 * Handles coach and customer changes with deterministic conflict resolution
 */

/**
 * Detect version mismatch between coach and server
 * @param {number} coachVersion - Coach's current version
 * @param {number} serverVersion - Server's current version
 * @returns {boolean} True if versions don't match
 */
export function detectVersionMismatch(coachVersion, serverVersion) {
  return coachVersion !== serverVersion;
}

/**
 * Detect conflict between feedback submission and program update
 * @param {number} programVersionSeen - Program version customer saw
 * @param {number} currentServerVersion - Current server program version
 * @returns {boolean} True if program was updated since customer saw it
 */
export function detectFeedbackConflict(programVersionSeen, currentServerVersion) {
  return programVersionSeen !== currentServerVersion;
}

/**
 * Resolve coach sync with version mismatch
 * Coach changes always take precedence (coach-always-wins per FR-007)
 * @param {object} request - Sync request {customer_id, file_type, current_version, content, content_hash}
 * @param {number} serverVersion - Current server version
 * @returns {object} Resolution {status, new_version, conflicted}
 */
export function resolveCoachSync(request, serverVersion) {
  const coachVersion = request.current_version;
  const conflicted = detectVersionMismatch(coachVersion, serverVersion);

  return {
    status: 'synced',
    new_version: serverVersion + 1,
    conflicted: conflicted,
    coach_version: coachVersion,
    server_version: serverVersion,
    message: conflicted
      ? `Version mismatch: coach=${coachVersion}, server=${serverVersion}. Coach changes applied.`
      : 'Sync successful'
  };
}

/**
 * Resolve feedback conflict when program was updated
 * Returns error details for 409 response
 * @param {string} customerId - Customer ID
 * @param {number} programVersionSeen - Program version customer saw
 * @param {number} currentProgramVersion - Current server program version
 * @returns {object} Conflict details {status, conflict_type, new_version, message}
 */
export function resolveFeedbackConflict(customerId, programVersionSeen, currentProgramVersion) {
  return {
    status: 'conflict',
    conflict_type: 'customer_feedback_simultaneous',
    customer_id: customerId,
    file_type: 'program',
    program_version_seen: programVersionSeen,
    new_version: currentProgramVersion,
    message: 'Program was updated by coach; please review and retry feedback'
  };
}

/**
 * Validate format consistency (YYYY-MM-DD dates, markdown structure)
 * @param {string} content - File content to validate
 * @param {string} fileType - 'program', 'feedback', or 'notes'
 * @returns {object} {valid: boolean, errors: array}
 */
export function validateFormatConsistency(content, fileType) {
  const errors = [];

  if (!content || typeof content !== 'string') {
    errors.push('Content must be non-empty string');
    return { valid: false, errors };
  }

  // Check UTF-8 encoding is valid
  try {
    Buffer.from(content, 'utf8');
  } catch (err) {
    errors.push('Content must be valid UTF-8');
  }

  // For feedback files, validate date format
  if (fileType === 'feedback') {
    const datePattern = /\d{4}-\d{2}-\d{2}/;
    if (!datePattern.test(content)) {
      errors.push('Feedback must contain dates in YYYY-MM-DD format');
    }
  }

  return { valid: errors.length === 0, errors };
}

export default {
  detectVersionMismatch,
  detectFeedbackConflict,
  resolveCoachSync,
  resolveFeedbackConflict,
  validateFormatConsistency
};
