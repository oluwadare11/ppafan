// utils/securityLogger.js - Comprehensive Security Audit Logging
const fs = require('fs').promises;
const path = require('path');

// Security log levels
const LOG_LEVELS = {
  CRITICAL: 'CRITICAL',
  HIGH: 'HIGH',
  MEDIUM: 'MEDIUM',
  LOW: 'LOW',
  INFO: 'INFO'
};

// Security event types
const EVENT_TYPES = {
  AUTH_SUCCESS: 'AUTH_SUCCESS',
  AUTH_FAILURE: 'AUTH_FAILURE',
  SESSION_CREATED: 'SESSION_CREATED',
  SESSION_DESTROYED: 'SESSION_DESTROYED',
  SESSION_HIJACK_ATTEMPT: 'SESSION_HIJACK_ATTEMPT',
  SESSION_TIMEOUT: 'SESSION_TIMEOUT',
  UNAUTHORIZED_ACCESS: 'UNAUTHORIZED_ACCESS',
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
  INPUT_VALIDATION_FAILURE: 'INPUT_VALIDATION_FAILURE',
  CSRF_TOKEN_INVALID: 'CSRF_TOKEN_INVALID',
  TENANT_ISOLATION_VIOLATION: 'TENANT_ISOLATION_VIOLATION',
  DATA_ACCESS: 'DATA_ACCESS',
  DATA_MODIFICATION: 'DATA_MODIFICATION',
  ADMIN_ACTION: 'ADMIN_ACTION',
  SUPER_ADMIN_ACTION: 'SUPER_ADMIN_ACTION',
  PRIVILEGE_ESCALATION: 'PRIVILEGE_ESCALATION',
  SECURITY_SCAN_DETECTED: 'SECURITY_SCAN_DETECTED',
  MALICIOUS_PAYLOAD_DETECTED: 'MALICIOUS_PAYLOAD_DETECTED'
};

// Create logs directory if it doesn't exist
const ensureLogDirectory = async () => {
  const logDir = path.join(process.cwd(), 'logs', 'security');
  try {
    await fs.mkdir(logDir, { recursive: true });
  } catch (error) {
    console.error('Failed to create security log directory:', error);
  }
  return logDir;
};

// Get request metadata for logging
const getRequestMetadata = (req) => {
  return {
    ip: req.ip || req.connection?.remoteAddress || 'unknown',
    userAgent: req.get('User-Agent') || 'unknown',
    method: req.method,
    url: req.originalUrl || req.url,
    referer: req.get('Referer') || null,
    timestamp: new Date().toISOString(),
    sessionId: req.sessionID || req.session?.id || null,
    tenantId: req.tenantId || req.session?.tenantId || null,
    userId: req.user?.id || req.session?.user?.id || null,
    userRole: req.user?.role || req.session?.user?.role || null
  };
};

// Core security logging function
const logSecurityEvent = async (req, eventType, details = {}, level = LOG_LEVELS.MEDIUM) => {
  try {
    if (!process.env.ENABLE_SECURITY_LOGGING || process.env.ENABLE_SECURITY_LOGGING === 'false') {
      return; // Security logging disabled
    }

    const logEntry = {
      timestamp: new Date().toISOString(),
      level,
      eventType,
      request: getRequestMetadata(req),
      details,
      environment: process.env.NODE_ENV || 'development'
    };

    // Log to console in development
    if (process.env.NODE_ENV === 'development' || process.env.LOG_LEVEL === 'debug') {
      console.log(`[SECURITY ${level}] ${eventType}:`, JSON.stringify(logEntry, null, 2));
    }

    // Log to file
    const logDir = await ensureLogDirectory();
    const logFile = path.join(logDir, `security-${new Date().toISOString().split('T')[0]}.log`);
    
    await fs.appendFile(logFile, JSON.stringify(logEntry) + '\n', 'utf8');

    // Send critical alerts (implement your alerting system here)
    if (level === LOG_LEVELS.CRITICAL) {
      await sendCriticalAlert(logEntry);
    }

  } catch (error) {
    console.error('Security logging failed:', error);
  }
};

// Authentication success logging
const logAuthSuccess = (req, details = {}) => {
  return logSecurityEvent(req, EVENT_TYPES.AUTH_SUCCESS, {
    username: details.username || req.body?.username,
    userId: details.userId,
    tenantId: details.tenantId,
    sessionId: details.sessionId,
    ...details
  }, LOG_LEVELS.INFO);
};

// Authentication failure logging
const logAuthFailure = (req, details = {}) => {
  return logSecurityEvent(req, EVENT_TYPES.AUTH_FAILURE, {
    username: details.username || req.body?.username,
    reason: details.reason,
    attemptCount: details.attemptCount,
    ...details
  }, LOG_LEVELS.HIGH);
};

// Data access logging
const logDataAccess = (req, action, details = {}) => {
  return logSecurityEvent(req, EVENT_TYPES.DATA_ACCESS, {
    action,
    resourceType: details.resourceType,
    resourceId: details.resourceId,
    recordCount: details.recordCount,
    filters: details.filters,
    ...details
  }, LOG_LEVELS.INFO);
};

// Data modification logging
const logDataModification = (req, action, details = {}) => {
  return logSecurityEvent(req, EVENT_TYPES.DATA_MODIFICATION, {
    action, // CREATE, UPDATE, DELETE
    resourceType: details.resourceType,
    resourceId: details.resourceId,
    beforeData: details.beforeData ? '[REDACTED]' : null, // Don't log sensitive data
    changedFields: details.changedFields,
    ...details
  }, LOG_LEVELS.MEDIUM);
};

// Admin action logging
const logAdminAction = (req, action, details = {}) => {
  return logSecurityEvent(req, EVENT_TYPES.ADMIN_ACTION, {
    action,
    targetUserId: details.targetUserId,
    targetTenantId: details.targetTenantId,
    changes: details.changes,
    ...details
  }, LOG_LEVELS.HIGH);
};

// Super admin action logging
const logSuperAdminAction = (req, action, details = {}) => {
  return logSecurityEvent(req, EVENT_TYPES.SUPER_ADMIN_ACTION, {
    action,
    targetTenantId: details.targetTenantId,
    targetUserId: details.targetUserId,
    systemChanges: details.systemChanges,
    ...details
  }, LOG_LEVELS.CRITICAL);
};

// Unauthorized access attempt logging
const logUnauthorizedAccess = (req, details = {}) => {
  return logSecurityEvent(req, EVENT_TYPES.UNAUTHORIZED_ACCESS, {
    requiredRole: details.requiredRole,
    userRole: req.user?.role,
    endpoint: req.path,
    ...details
  }, LOG_LEVELS.HIGH);
};

// Input validation failure logging
const logValidationFailure = (req, field, value, reason) => {
  return logSecurityEvent(req, EVENT_TYPES.INPUT_VALIDATION_FAILURE, {
    field,
    valueType: typeof value,
    valueLength: typeof value === 'string' ? value.length : null,
    reason,
    sanitizedValue: typeof value === 'string' ? value.substring(0, 50) + '...' : null
  }, LOG_LEVELS.MEDIUM);
};

// CSRF token validation failure
const logCSRFFailure = (req, details = {}) => {
  return logSecurityEvent(req, EVENT_TYPES.CSRF_TOKEN_INVALID, {
    tokenPresent: !!details.token,
    tokenSource: details.tokenSource, // header, body, query
    ...details
  }, LOG_LEVELS.HIGH);
};

// Tenant isolation violation
const logTenantViolation = (req, details = {}) => {
  return logSecurityEvent(req, EVENT_TYPES.TENANT_ISOLATION_VIOLATION, {
    requestedTenantId: details.requestedTenantId,
    userTenantId: req.user?.tenantId,
    resourceType: details.resourceType,
    ...details
  }, LOG_LEVELS.CRITICAL);
};

// Rate limit exceeded logging
const logRateLimitExceeded = (req, details = {}) => {
  return logSecurityEvent(req, EVENT_TYPES.RATE_LIMIT_EXCEEDED, {
    endpoint: req.path,
    limit: details.limit,
    windowMs: details.windowMs,
    currentCount: details.currentCount,
    ...details
  }, LOG_LEVELS.MEDIUM);
};

// Privilege escalation attempt
const logPrivilegeEscalation = (req, details = {}) => {
  return logSecurityEvent(req, EVENT_TYPES.PRIVILEGE_ESCALATION, {
    fromRole: req.user?.role,
    toRole: details.toRole,
    attemptedAction: details.attemptedAction,
    ...details
  }, LOG_LEVELS.CRITICAL);
};

// Security scan detection
const logSecurityScan = (req, details = {}) => {
  return logSecurityEvent(req, EVENT_TYPES.SECURITY_SCAN_DETECTED, {
    scanType: details.scanType, // SQL injection, XSS, directory traversal, etc.
    payload: details.payload?.substring(0, 100) + '...', // Truncate for safety
    endpoint: req.path,
    ...details
  }, LOG_LEVELS.HIGH);
};

// Malicious payload detection
const logMaliciousPayload = (req, field, payload, details = {}) => {
  return logSecurityEvent(req, EVENT_TYPES.MALICIOUS_PAYLOAD_DETECTED, {
    field,
    payloadType: details.payloadType,
    payload: payload?.toString().substring(0, 100) + '...', // Truncate for safety
    severity: details.severity || 'HIGH',
    ...details
  }, LOG_LEVELS.HIGH);
};

// Send critical security alerts (implement based on your alerting system)
const sendCriticalAlert = async (logEntry) => {
  try {
    // Console alert for development
    if (process.env.NODE_ENV === 'development') {
      console.error('🚨 CRITICAL SECURITY ALERT 🚨');
      console.error(JSON.stringify(logEntry, null, 2));
    }

    // In production, implement:
    // - Email alerts to security team
    // - Slack/Discord notifications
    // - SMS alerts for critical events
    // - Integration with SIEM systems
    
    // Example email alert (uncomment and configure)
    /*
    const sendEmail = require('./email');
    await sendEmail(
      process.env.SECURITY_ALERT_EMAIL || 'security@opsuite.io',
      'critical_security_alert',
      {
        eventType: logEntry.eventType,
        timestamp: logEntry.timestamp,
        details: logEntry.details,
        request: logEntry.request
      }
    );
    */

  } catch (error) {
    console.error('Failed to send critical security alert:', error);
  }
};

// Get security logs for analysis
const getSecurityLogs = async (filters = {}) => {
  try {
    const { 
      startDate, 
      endDate, 
      level, 
      eventType, 
      tenantId, 
      userId, 
      limit = 100 
    } = filters;

    const logDir = await ensureLogDirectory();
    const files = await fs.readdir(logDir);
    
    let logs = [];
    
    // Read relevant log files
    for (const file of files.sort().reverse()) {
      if (logs.length >= limit) break;
      
      const filePath = path.join(logDir, file);
      const content = await fs.readFile(filePath, 'utf8');
      const fileLines = content.trim().split('\n').filter(line => line);
      
      for (const line of fileLines) {
        try {
          const logEntry = JSON.parse(line);
          
          // Apply filters
          if (startDate && new Date(logEntry.timestamp) < new Date(startDate)) continue;
          if (endDate && new Date(logEntry.timestamp) > new Date(endDate)) continue;
          if (level && logEntry.level !== level) continue;
          if (eventType && logEntry.eventType !== eventType) continue;
          if (tenantId && logEntry.request.tenantId !== tenantId) continue;
          if (userId && logEntry.request.userId !== userId) continue;
          
          logs.push(logEntry);
          
          if (logs.length >= limit) break;
        } catch (e) {
          // Skip invalid JSON lines
          continue;
        }
      }
    }
    
    return logs.slice(0, limit);
    
  } catch (error) {
    console.error('Failed to retrieve security logs:', error);
    return [];
  }
};

// Security metrics for dashboard
const getSecurityMetrics = async (timeframe = '24h') => {
  try {
    const now = new Date();
    let startDate;
    
    switch (timeframe) {
      case '1h':
        startDate = new Date(now.getTime() - 60 * 60 * 1000);
        break;
      case '24h':
        startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        break;
      case '7d':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30d':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      default:
        startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    }
    
    const logs = await getSecurityLogs({ startDate: startDate.toISOString(), limit: 10000 });
    
    const metrics = {
      totalEvents: logs.length,
      criticalEvents: logs.filter(log => log.level === LOG_LEVELS.CRITICAL).length,
      highEvents: logs.filter(log => log.level === LOG_LEVELS.HIGH).length,
      authFailures: logs.filter(log => log.eventType === EVENT_TYPES.AUTH_FAILURE).length,
      rateLimitExceeded: logs.filter(log => log.eventType === EVENT_TYPES.RATE_LIMIT_EXCEEDED).length,
      unauthorizedAccess: logs.filter(log => log.eventType === EVENT_TYPES.UNAUTHORIZED_ACCESS).length,
      validationFailures: logs.filter(log => log.eventType === EVENT_TYPES.INPUT_VALIDATION_FAILURE).length,
      tenantViolations: logs.filter(log => log.eventType === EVENT_TYPES.TENANT_ISOLATION_VIOLATION).length,
      topIPs: getTopIPs(logs),
      eventsByHour: getEventsByHour(logs, startDate),
      timeframe
    };
    
    return metrics;
    
  } catch (error) {
    console.error('Failed to calculate security metrics:', error);
    return null;
  }
};

// Helper function to get top IPs from logs
const getTopIPs = (logs) => {
  const ipCounts = {};
  logs.forEach(log => {
    const ip = log.request?.ip || 'unknown';
    ipCounts[ip] = (ipCounts[ip] || 0) + 1;
  });
  
  return Object.entries(ipCounts)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 10)
    .map(([ip, count]) => ({ ip, count }));
};

// Helper function to get events by hour
const getEventsByHour = (logs, startDate) => {
  const hourlyData = {};
  const hours = 24;
  
  // Initialize hourly buckets
  for (let i = 0; i < hours; i++) {
    const hour = new Date(startDate.getTime() + i * 60 * 60 * 1000);
    const hourKey = hour.toISOString().substring(0, 13);
    hourlyData[hourKey] = 0;
  }
  
  // Count events per hour
  logs.forEach(log => {
    const logHour = log.timestamp.substring(0, 13);
    if (hourlyData.hasOwnProperty(logHour)) {
      hourlyData[logHour]++;
    }
  });
  
  return Object.entries(hourlyData).map(([hour, count]) => ({
    hour: hour + ':00:00Z',
    count
  }));
};

// Export all logging functions
module.exports = {
  // Core logging
  logSecurityEvent,
  
  // Authentication logging
  logAuthSuccess,
  logAuthFailure,
  
  // Data access logging
  logDataAccess,
  logDataModification,
  
  // Administrative logging
  logAdminAction,
  logSuperAdminAction,
  
  // Security violations
  logUnauthorizedAccess,
  logValidationFailure,
  logCSRFFailure,
  logTenantViolation,
  logRateLimitExceeded,
  logPrivilegeEscalation,
  logSecurityScan,
  logMaliciousPayload,
  
  // Analysis and reporting
  getSecurityLogs,
  getSecurityMetrics,
  
  // Constants
  LOG_LEVELS,
  EVENT_TYPES,
  
  // Utilities
  getRequestMetadata,
  sendCriticalAlert
};