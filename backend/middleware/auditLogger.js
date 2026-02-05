/**
 * Audit Logger Middleware
 * Automatically logs super admin actions to AuditLog collection
 */

const AuditLog = require('../models/AuditLog');

// Map routes to action types
const actionMap = {
  // Auth actions
  'POST /api/admin/auth/login': 'LOGIN',
  'POST /api/admin/auth/logout': 'LOGOUT',
  'POST /api/admin/auth/setup-mfa': 'MFA_SETUP',
  'POST /api/admin/auth/verify-mfa-setup': 'MFA_SETUP',

  // Tenant management
  'POST /api/admin/tenants': 'TENANT_CREATE',
  'PUT /api/admin/tenants/:id': 'TENANT_UPDATE',
  'DELETE /api/admin/tenants/:id': 'TENANT_DELETE',
  'PUT /api/admin/tenants/:id/suspend': 'TENANT_SUSPEND',
  'PUT /api/admin/tenants/:id/activate': 'TENANT_ACTIVATE',
  'PUT /api/admin/tenants/:id/subscription': 'SUBSCRIPTION_UPDATE',

  // User management
  'POST /api/admin/users/tenant/:tenantId/users': 'USER_CREATE',
  'PUT /api/admin/users/tenant/:tenantId/users/:userId': 'USER_UPDATE',
  'DELETE /api/admin/users/tenant/:tenantId/users/:userId': 'USER_DELETE',
  'PUT /api/admin/users/tenant/:tenantId/users/:userId/status': 'USER_STATUS_CHANGE',
  'PUT /api/admin/users/tenant/:tenantId/bulk/status': 'USER_BULK_STATUS',
  'DELETE /api/admin/users/tenant/:tenantId/bulk': 'USER_BULK_DELETE',
  'POST /api/admin/users/tenant/:tenantId/users/:userId/impersonate': 'USER_IMPERSONATE',
  'POST /api/admin/users/tenant/:tenantId/users/:userId/reset-password': 'USER_PASSWORD_RESET',

  // System settings
  'PUT /api/admin/system/settings': 'SETTINGS_UPDATE',
  'POST /api/admin/system/maintenance': 'MAINTENANCE_MODE',

  // IP whitelist management
  'POST /api/admin/auth/ip-whitelist': 'IP_WHITELIST_ADD',
  'DELETE /api/admin/auth/ip-whitelist/:ip': 'IP_WHITELIST_REMOVE',
};

// Severity levels for different actions
const severityMap = {
  'LOGIN': 'info',
  'LOGOUT': 'info',
  'LOGIN_FAILED': 'warning',
  'MFA_SETUP': 'info',
  'TENANT_CREATE': 'info',
  'TENANT_UPDATE': 'info',
  'TENANT_DELETE': 'critical',
  'TENANT_SUSPEND': 'warning',
  'TENANT_ACTIVATE': 'info',
  'SUBSCRIPTION_UPDATE': 'info',
  'USER_CREATE': 'info',
  'USER_UPDATE': 'info',
  'USER_DELETE': 'warning',
  'USER_STATUS_CHANGE': 'info',
  'USER_BULK_STATUS': 'warning',
  'USER_BULK_DELETE': 'critical',
  'USER_IMPERSONATE': 'warning',
  'USER_PASSWORD_RESET': 'info',
  'SETTINGS_UPDATE': 'warning',
  'MAINTENANCE_MODE': 'critical',
  'IP_WHITELIST_ADD': 'info',
  'IP_WHITELIST_REMOVE': 'warning',
};

/**
 * Normalize route path for matching (replace :param with actual pattern)
 */
const normalizeRoute = (method, path) => {
  // Remove query strings
  const cleanPath = path.split('?')[0];
  return `${method} ${cleanPath}`;
};

/**
 * Match route against action map
 */
const matchRoute = (method, path) => {
  const normalizedRoute = normalizeRoute(method, path);

  // Direct match first
  if (actionMap[normalizedRoute]) {
    return actionMap[normalizedRoute];
  }

  // Pattern matching for routes with parameters
  for (const [pattern, action] of Object.entries(actionMap)) {
    const patternParts = pattern.split(' ');
    const routeMethod = patternParts[0];
    const routePath = patternParts[1];

    if (method !== routeMethod) continue;

    // Convert route pattern to regex
    const regexPattern = routePath
      .replace(/:[^/]+/g, '[^/]+')  // Replace :param with wildcard
      .replace(/\//g, '\\/');       // Escape slashes

    const regex = new RegExp(`^${regexPattern}$`);
    const cleanPath = path.split('?')[0];

    if (regex.test(cleanPath)) {
      return action;
    }
  }

  return null;
};

/**
 * Extract resource info from request
 */
const extractResourceInfo = (req) => {
  const resource = {};

  // Extract tenant info
  if (req.params.tenantId || req.params.id) {
    resource.type = 'tenant';
    resource.id = req.params.tenantId || req.params.id;
    resource.name = req.body?.businessName || req.tenant?.businessName;
  }

  // Extract user info
  if (req.params.userId) {
    resource.type = 'user';
    resource.id = req.params.userId;
    resource.name = req.body?.username || req.body?.email;
  }

  return Object.keys(resource).length > 0 ? resource : undefined;
};

/**
 * Get client IP address
 */
const getClientIP = (req) => {
  return req.headers['x-forwarded-for']?.split(',')[0].trim() ||
         req.connection?.remoteAddress ||
         req.socket?.remoteAddress ||
         req.ip ||
         'unknown';
};

/**
 * Audit logging middleware - logs after response
 */
const auditLogger = (options = {}) => {
  return async (req, res, next) => {
    // Only log super admin routes
    if (!req.path.startsWith('/api/admin/')) {
      return next();
    }

    // Skip GET requests unless explicitly configured
    if (req.method === 'GET' && !options.logReads) {
      return next();
    }

    // Store original response methods
    const originalJson = res.json.bind(res);
    const originalSend = res.send.bind(res);

    // Capture response data
    let responseData = null;
    let responseStatus = 200;

    res.json = function(data) {
      responseData = data;
      responseStatus = res.statusCode;
      return originalJson(data);
    };

    res.send = function(data) {
      if (typeof data === 'object') {
        responseData = data;
      }
      responseStatus = res.statusCode;
      return originalSend(data);
    };

    // Hook into response finish
    res.on('finish', async () => {
      try {
        const action = matchRoute(req.method, req.path);

        if (!action) return; // No mapped action for this route

        const success = responseStatus >= 200 && responseStatus < 400;
        const severity = success ? (severityMap[action] || 'info') : 'warning';

        // Build audit entry
        const auditEntry = {
          actor: {
            type: req.user?.role === 'super_admin' ? 'super_admin' : 'system',
            id: req.user?.id || req.user?._id,
            username: req.user?.username,
            email: req.user?.email,
            ip: getClientIP(req)
          },
          action,
          resource: extractResourceInfo(req),
          details: {
            changes: req.body,
            metadata: {
              queryParams: req.query,
              responseStatus
            }
          },
          result: {
            success,
            error: !success ? responseData?.error : undefined,
            errorCode: !success ? responseData?.code : undefined
          },
          request: {
            method: req.method,
            path: req.path,
            userAgent: req.get('User-Agent'),
            referer: req.get('Referer')
          },
          severity,
          timestamp: new Date()
        };

        // Add tenant context if available
        if (req.params.tenantId || req.params.id) {
          auditEntry.targetTenant = {
            tenantId: req.params.tenantId || req.params.id
          };
        }

        // Log to database
        await AuditLog.create(auditEntry);

      } catch (error) {
        console.error('Audit logging error:', error);
        // Don't fail the request due to audit logging errors
      }
    });

    next();
  };
};

/**
 * Manual audit log helper for custom logging
 */
const logAuditEvent = async ({
  actor,
  action,
  resource,
  targetTenant,
  details,
  result,
  request,
  severity = 'info'
}) => {
  try {
    await AuditLog.create({
      actor,
      action,
      resource,
      targetTenant,
      details,
      result: result || { success: true },
      request,
      severity,
      timestamp: new Date()
    });
  } catch (error) {
    console.error('Manual audit logging error:', error);
  }
};

/**
 * Log failed login attempt
 */
const logFailedLogin = async (req, username, reason) => {
  await logAuditEvent({
    actor: {
      type: 'unknown',
      username,
      ip: getClientIP(req)
    },
    action: 'LOGIN_FAILED',
    details: {
      metadata: { reason }
    },
    result: {
      success: false,
      error: reason
    },
    request: {
      method: req.method,
      path: req.path,
      userAgent: req.get('User-Agent')
    },
    severity: 'warning'
  });
};

/**
 * Log successful login
 */
const logSuccessfulLogin = async (req, admin) => {
  await logAuditEvent({
    actor: {
      type: 'super_admin',
      id: admin._id,
      username: admin.username,
      email: admin.email,
      ip: getClientIP(req)
    },
    action: 'LOGIN',
    details: {
      metadata: {
        sessionId: req.sessionID,
        mfaUsed: admin.mfa?.enabled || false
      }
    },
    result: { success: true },
    request: {
      method: req.method,
      path: req.path,
      userAgent: req.get('User-Agent')
    },
    severity: 'info'
  });
};

module.exports = {
  auditLogger,
  logAuditEvent,
  logFailedLogin,
  logSuccessfulLogin,
  getClientIP,
  matchRoute
};
