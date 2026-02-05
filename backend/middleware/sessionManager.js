// middleware/sessionManager.js - Concurrent Session Control
const logger = require('../utils/logger');

// Session store (use Redis in production for distributed systems)
const activeSessions = new Map(); // Map<userId, Set<sessionId>>

// Maximum concurrent sessions per user
const MAX_SESSIONS_PER_USER = 3;

/**
 * Generate unique session ID
 */
const generateSessionId = () => {
  const crypto = require('crypto');
  return crypto.randomBytes(32).toString('hex');
};

/**
 * Add session for user
 */
const addSession = (userId, sessionId = null) => {
  const sid = sessionId || generateSessionId();
  const userIdStr = userId.toString();

  if (!activeSessions.has(userIdStr)) {
    activeSessions.set(userIdStr, new Set());
  }

  const userSessions = activeSessions.get(userIdStr);

  // If max sessions reached, remove oldest session
  if (userSessions.size >= MAX_SESSIONS_PER_USER) {
    const oldestSession = Array.from(userSessions)[0];
    userSessions.delete(oldestSession);

    logger.info('Removed oldest session due to max limit', {
      userId: userIdStr,
      oldSession: oldestSession,
      maxSessions: MAX_SESSIONS_PER_USER
    });
  }

  userSessions.add(sid);

  logger.debug('Session added', {
    userId: userIdStr,
    sessionId: sid,
    totalSessions: userSessions.size
  });

  return sid;
};

/**
 * Remove session for user
 */
const removeSession = (userId, sessionId) => {
  const userIdStr = userId.toString();

  if (!activeSessions.has(userIdStr)) {
    return false;
  }

  const userSessions = activeSessions.get(userIdStr);
  const removed = userSessions.delete(sessionId);

  // Clean up if no sessions left
  if (userSessions.size === 0) {
    activeSessions.delete(userIdStr);
  }

  logger.debug('Session removed', {
    userId: userIdStr,
    sessionId: sessionId,
    success: removed,
    remainingSessions: userSessions.size
  });

  return removed;
};

/**
 * Remove all sessions for a user
 */
const removeAllSessions = (userId) => {
  const userIdStr = userId.toString();
  const had = activeSessions.has(userIdStr);

  if (had) {
    const count = activeSessions.get(userIdStr).size;
    activeSessions.delete(userIdStr);

    logger.info('All sessions removed for user', {
      userId: userIdStr,
      sessionsRemoved: count
    });

    return count;
  }

  return 0;
};

/**
 * Check if session is valid
 */
const isSessionValid = (userId, sessionId) => {
  const userIdStr = userId.toString();

  if (!activeSessions.has(userIdStr)) {
    return false;
  }

  return activeSessions.get(userIdStr).has(sessionId);
};

/**
 * Get all sessions for a user
 */
const getUserSessions = (userId) => {
  const userIdStr = userId.toString();

  if (!activeSessions.has(userIdStr)) {
    return [];
  }

  return Array.from(activeSessions.get(userIdStr));
};

/**
 * Get session count for user
 */
const getSessionCount = (userId) => {
  const userIdStr = userId.toString();

  if (!activeSessions.has(userIdStr)) {
    return 0;
  }

  return activeSessions.get(userIdStr).size;
};

/**
 * Get total active sessions across all users
 */
const getTotalSessions = () => {
  let total = 0;
  for (const sessions of activeSessions.values()) {
    total += sessions.size;
  }
  return total;
};

/**
 * Session tracking middleware
 * Validates session and enforces concurrent session limits
 */
const sessionTracking = (req, res, next) => {
  // Only track authenticated users
  if (!req.user || !req.user.id) {
    return next();
  }

  const userId = req.user.id.toString();

  // Extract session ID from cookie or generate new one
  let sessionId = req.cookies?.sessionId;

  if (!sessionId || !isSessionValid(userId, sessionId)) {
    // New session or invalid session
    sessionId = addSession(userId);

    // Set session cookie
    res.cookie('sessionId', sessionId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days
    });

    logger.info('New session created', {
      userId: userId,
      username: req.user.username,
      sessionId: sessionId,
      ip: req.ip
    });
  }

  // Attach session info to request
  req.sessionId = sessionId;
  req.sessionCount = getSessionCount(userId);

  // Log session count warning if approaching limit
  if (req.sessionCount >= MAX_SESSIONS_PER_USER - 1) {
    logger.warn('User approaching max concurrent sessions', {
      userId: userId,
      username: req.user.username,
      sessionCount: req.sessionCount,
      maxSessions: MAX_SESSIONS_PER_USER
    });
  }

  next();
};

/**
 * Require valid session middleware
 * Ensures user has a valid active session
 */
const requireValidSession = (req, res, next) => {
  if (!req.user || !req.user.id) {
    return res.status(401).json({
      error: 'AUTHENTICATION_REQUIRED',
      message: 'Authentication required'
    });
  }

  const userId = req.user.id.toString();
  const sessionId = req.cookies?.sessionId || req.sessionId;

  if (!sessionId || !isSessionValid(userId, sessionId)) {
    logger.warn('Invalid or expired session', {
      userId: userId,
      username: req.user.username,
      hasSessionId: !!sessionId,
      ip: req.ip
    });

    return res.status(401).json({
      error: 'SESSION_INVALID',
      message: 'Your session has expired. Please log in again.'
    });
  }

  next();
};

/**
 * Clean up sessions on logout
 */
const cleanupSession = (req, res, next) => {
  if (req.user && req.sessionId) {
    removeSession(req.user.id, req.sessionId);
    res.clearCookie('sessionId');
  }
  next();
};

module.exports = {
  sessionTracking,
  requireValidSession,
  cleanupSession,
  addSession,
  removeSession,
  removeAllSessions,
  isSessionValid,
  getUserSessions,
  getSessionCount,
  getTotalSessions,
  MAX_SESSIONS_PER_USER
};
