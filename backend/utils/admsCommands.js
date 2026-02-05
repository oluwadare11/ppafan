/**
 * ADMS Protocol Command Builder Utilities
 *
 * Generates properly formatted ADMS protocol commands for ZKTeco devices.
 * CRITICAL: Commands must use \t (tab) between parameters, not spaces!
 */

/**
 * Global counter to prevent command ID collisions in bulk operations
 */
let commandIdCounter = 0;

/**
 * Generate unique command ID
 * @param {number} [bulkIndex] - Optional index for bulk operations to guarantee uniqueness
 * @returns {number} Timestamp-based unique ID
 */
function generateCommandId(bulkIndex) {
  // Reset counter every second to prevent overflow
  const now = Date.now();

  // Increment counter (wraps at 10000 to stay within safe integer range)
  commandIdCounter = (commandIdCounter + 1) % 10000;

  // Use: timestamp * 100000 + bulkIndex (if provided) * 100 + random + counter
  // This ensures uniqueness even in bulk operations within the same millisecond
  if (typeof bulkIndex === 'number') {
    // For bulk operations: timestamp + bulk index offset
    return now * 100000 + (bulkIndex * 100) + commandIdCounter;
  }

  // For single operations: timestamp + random + counter
  return now * 100000 + Math.floor(Math.random() * 10000) + commandIdCounter;
}

/**
 * Build ADD_USER command
 * @param {number} commandId - Unique command ID
 * @param {object} userDetails - User information
 * @param {string} userDetails.pin - Employee PIN (user ID on device)
 * @param {string} userDetails.name - Full name
 * @param {number} userDetails.privilege - Access level (0=normal, 14=admin)
 * @param {number} userDetails.group - Group number (default: 1)
 * @returns {string} Formatted command
 */
function buildAddUserCommand(commandId, userDetails) {
  const { pin, name, privilege = 0, group = 1 } = userDetails;

  // CRITICAL: Use \t (tab) between parameters!
  // Empty fields need double tab (Card=\t\t)
  const params = `PIN=${pin}\tName=${name}\tPri=${privilege}\tPasswd=\tCard=\t\tGrp=${group}\tVerify=0`;

  return `C:${commandId}:DATA USER ${params}`;
}

/**
 * Build DELETE_USER command
 * @param {number} commandId - Unique command ID
 * @param {string} pin - Employee PIN to delete
 * @returns {string} Formatted command
 */
function buildDeleteUserCommand(commandId, pin) {
  return `C:${commandId}:DATA DEL_USER PIN=${pin}`;
}

/**
 * Build ENROLL_FP command (triggers device to prompt for fingerprint)
 * @param {number} commandId - Unique command ID
 * @param {string} pin - Employee PIN
 * @param {number} fingerId - Finger index (0-9: 0=Right Thumb, 1=Right Index, etc.)
 * @returns {string} Formatted command
 */
function buildEnrollFingerprintCommand(commandId, pin, fingerId = 0) {
  const params = `PIN=${pin}\tFID=${fingerId}\tRETRY=3\tOVERWRITE=1`;
  return `C:${commandId}:ENROLL_FP ${params}`;
}

/**
 * Build upload fingerprint template command
 * @param {number} commandId - Unique command ID
 * @param {string} pin - Employee PIN
 * @param {number} fingerId - Finger index
 * @param {string} template - Base64 encoded fingerprint template
 * @returns {string} Formatted command
 */
function buildUploadFingerprintCommand(commandId, pin, fingerId, template) {
  const params = `Pin=${pin}\tNo=${fingerId}\tIndex=0\tValid=1\tDuress=0\tType=8\tMajorVer=5\tMinorVer=0\tTmp=${template}`;
  return `C:${commandId}:DATA UPDATE BIODATA ${params}`;
}

/**
 * Build ENROLL_FACE command
 * Triggers device to prompt user for face scan
 * Device will capture face template and upload to server
 *
 * @param {number} commandId - Unique command identifier
 * @param {string} pin - User PIN/badge number
 * @param {number} [faceId=0] - Face ID (0-11 for 12 faces per user)
 * @param {number} [retry=3] - Number of scan attempts
 * @param {number} [overwrite=1] - Overwrite existing template
 * @returns {string} Formatted command string
 *
 * @example
 * buildEnrollFaceCommand(123459, '00100', 0)
 * // Returns: "C:123459:ENROLL_FACE PIN=00100\tFID=0\tRETRY=3\tOVERWRITE=1"
 */
function buildEnrollFaceCommand(commandId, pin, faceId = 0, retry = 3, overwrite = 1) {
  if (!pin) {
    throw new Error('PIN is required for ENROLL_FACE command');
  }

  if (faceId < 0 || faceId > 11) {
    throw new Error('Face ID must be between 0 and 11 (12 faces per user)');
  }

  const params = [
    `PIN=${pin}`,
    `FID=${faceId}`,
    `RETRY=${retry}`,
    `OVERWRITE=${overwrite}`
  ].join('\t');

  return `C:${commandId}:ENROLL_FACE ${params}`;
}

/**
 * Build UPLOAD_FACE command
 * Pushes a stored face template to device
 * Face templates are always 1648 bytes when base64-encoded
 *
 * @param {number} commandId - Unique command identifier
 * @param {string} pin - User PIN/badge number
 * @param {number} faceId - Face ID (0-11)
 * @param {string} template - Base64 encoded template (must be 1648 bytes)
 * @returns {string} Formatted command string
 *
 * @example
 * buildUploadFaceCommand(123460, '00100', 0, 'base64_template...')
 */
function buildUploadFaceCommand(commandId, pin, faceId, template) {
  if (!pin || faceId === undefined || !template) {
    throw new Error('PIN, faceId, and template are required for UPLOAD_FACE');
  }

  if (faceId < 0 || faceId > 11) {
    throw new Error('Face ID must be between 0 and 11');
  }

  const params = [
    `PIN=${pin}`,
    `FID=${faceId}`,
    `SIZE=1648`,  // Face templates are always 1648 bytes
    `Valid=1`,
    `TMP=${template}`
  ].join('\t');

  return `C:${commandId}:DATA UPDATE FACE ${params}`;
}

/**
 * Build UPLOAD_USERPIC command
 * Pushes user photo to device
 * Device will fetch photo from specified URL via HTTP GET
 *
 * @param {number} commandId - Unique command identifier
 * @param {string} pin - User PIN/badge number
 * @param {string} photoUrl - Relative URL to photo (device will fetch)
 * @param {number} [format=1] - Photo format (1=JPEG)
 * @returns {string} Formatted command string
 *
 * @example
 * buildUploadUserPhotoCommand(123461, '00100', 'iclock/file/photo/abc123/00100.jpg')
 */
function buildUploadUserPhotoCommand(commandId, pin, photoUrl, format = 1) {
  if (!pin || !photoUrl) {
    throw new Error('PIN and photoUrl are required for UPLOAD_USERPIC');
  }

  const params = [
    `PIN=${pin}`,
    `Format=${format}`,
    `Url=${photoUrl}`,
    '' // Trailing tab required
  ].join('\t');

  return `C:${commandId}:DATA UPDATE USERPIC ${params}`;
}

/**
 * Build REBOOT command
 * @param {number} commandId - Unique command ID
 * @returns {string} Formatted command
 */
function buildRebootCommand(commandId) {
  return `C:${commandId}:REBOOT`;
}

/**
 * Build command to clear all users from device
 * @param {number} commandId - Unique command ID
 * @returns {string} Formatted command
 */
function buildClearAllUsersCommand(commandId) {
  return `C:${commandId}:DATA DELETE USER`;
}

/**
 * Build CHECK command (force attendance data sync)
 * @param {number} commandId - Unique command ID
 * @returns {string} Formatted command
 */
function buildCheckCommand(commandId) {
  return `C:${commandId}:CHECK`;
}

/**
 * Build sync time command
 * @param {number} commandId - Unique command ID
 * @returns {string} Formatted command
 */
function buildSyncTimeCommand(commandId) {
  const now = new Date();
  const timestamp = Math.floor(now.getTime() / 1000);
  return `C:${commandId}:SYSTIME ${timestamp}`;
}

/**
 * Build get device option command
 * @param {number} commandId - Unique command ID
 * @param {string} optionName - Option name to retrieve
 * @returns {string} Formatted command
 */
function buildGetOptionCommand(commandId, optionName) {
  return `C:${commandId}:GET_OPTION ${optionName}`;
}

/**
 * Build set device option command
 * @param {number} commandId - Unique command ID
 * @param {string} optionName - Option name to set
 * @param {string} optionValue - Option value
 * @returns {string} Formatted command
 */
function buildSetOptionCommand(commandId, optionName, optionValue) {
  return `C:${commandId}:SET_OPTION ${optionName}=${optionValue}`;
}

module.exports = {
  generateCommandId,
  buildAddUserCommand,
  buildDeleteUserCommand,
  buildEnrollFingerprintCommand,
  buildEnrollFaceCommand,
  buildUploadFingerprintCommand,
  buildUploadFaceCommand,
  buildUploadUserPhotoCommand,
  buildRebootCommand,
  buildClearAllUsersCommand,
  buildCheckCommand,
  buildSyncTimeCommand,
  buildGetOptionCommand,
  buildSetOptionCommand
};
