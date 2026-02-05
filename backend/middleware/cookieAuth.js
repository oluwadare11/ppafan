// middleware/cookieAuth.js - Unified HTTP-Only Cookie Authentication
const jwt = require('jsonwebtoken');
const logger = require('../utils/logger');

/**
 * Extract JWT token from HTTP-only cookie
 * Works with tokens set by tenant-auth.js login system
 */
const extractTokenFromCookie = (req) => {
  // Check for access token in HTTP-only cookie (primary)
  const accessToken = req.cookies?.accessToken;
  if (accessToken) {
    return accessToken;
  }

  // Fallback: check for legacy session token formats
  const sessionToken = req.cookies?.authToken || req.cookies?.token;
  if (sessionToken) {
    return sessionToken;
  }

  return null;
};

/**
 * Extract JWT token from kiosk-specific HTTP-only cookie
 * Used for kiosk authentication (separate from admin auth)
 */
const extractKioskTokenFromCookie = (req) => {
  // Check for kiosk access token in HTTP-only cookie
  const kioskAccessToken = req.cookies?.kioskAccessToken;
  return kioskAccessToken || null;
};

/**
 * Verify JWT token and validate tenant context
 * This replaces all the old verifyToken, requireAuth, etc.
 */
const requireAuthentication = async (req, res, next) => {
  try {
    // Extract token from HTTP-only cookie
    const token = extractTokenFromCookie(req);
    
    if (!token) {
      logger.warn('No authentication token provided', {
        tenantId: req.tenantId || 'unknown',
        path: req.path,
        method: req.method,
        ip: req.ip
      });
      
      return res.status(401).json({
        error: 'AUTHENTICATION_REQUIRED',
        message: 'Authentication required'
      });
    }

    // Verify JWT token
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (jwtError) {
      if (jwtError.name === 'TokenExpiredError') {
        logger.info('Expired token provided', {
          tenantId: req.tenantId || 'unknown',
          path: req.path,
          ip: req.ip
        });
        
        return res.status(401).json({
          error: 'TOKEN_EXPIRED',
          message: 'Session expired. Please log in again.'
        });
      }
      
      logger.warn('Invalid token provided', {
        tenantId: req.tenantId || 'unknown',
        error: jwtError.message,
        ip: req.ip
      });
      
      return res.status(401).json({
        error: 'INVALID_TOKEN',
        message: 'Invalid authentication token'
      });
    }

    // FIXED: More robust tenant context validation
    if (req.tenantId && decoded.tenantId) {
      // Both exist - they must match
      if (decoded.tenantId !== req.tenantId) {
        logger.error('Token tenant mismatch - possible security violation', {
          tokenTenantId: decoded.tenantId,
          requestTenantId: req.tenantId,
          userId: decoded.id,
          path: req.path,
          ip: req.ip
        });
        
        return res.status(401).json({
          error: 'TENANT_TOKEN_MISMATCH',
          message: 'Invalid session for this business'
        });
      }
    } else if (!req.tenantId && decoded.tenantId) {
      // Token has tenant but request doesn't - set from token
      req.tenantId = decoded.tenantId;
      if (process.env.NODE_ENV === 'development') {
        console.log('Set tenantId from token:', decoded.tenantId);
      }
    } else if (req.tenantId && !decoded.tenantId) {
      // Request has tenant but token doesn't - this is suspicious but allow for backwards compatibility
      logger.warn('Token missing tenantId but request has one', {
        requestTenantId: req.tenantId,
        userId: decoded.id,
        path: req.path
      });
    }
    // If both are missing, continue (for super admin routes)

    // Verify user still exists and is active
    if (req.getTenantModel && (decoded.tenantId || req.tenantId)) {
      const TenantUser = req.getTenantModel('User');
      if (TenantUser) {
        try {
          const user = await TenantUser.findById(decoded.id).select('username role confirmed');
          
          if (!user || !user.confirmed) {
            logger.warn('Token user not found or not confirmed', {
              tenantId: req.tenantId,
              userId: decoded.id,
              ip: req.ip
            });
            
            return res.status(401).json({
              error: 'USER_NOT_FOUND',
              message: 'User account not found or deactivated'
            });
          }
          
          // Update decoded with fresh user data
          decoded.username = user.username;
          decoded.role = user.role;
        } catch (dbError) {
          logger.warn('Error validating user during authentication', {
            tenantId: req.tenantId,
            userId: decoded.id,
            error: dbError.message
          });
          // Continue with cached user data from token
        }
      }
    }

    // Attach user info to request
    req.user = {
      id: decoded.id,
      username: decoded.username,
      role: decoded.role,
      tenantId: decoded.tenantId || req.tenantId
    };

    // Log successful authentication (debug level only)
    if (process.env.LOG_LEVEL === 'debug') {
      logger.debug('Authentication successful', {
        tenantId: req.tenantId,
        userId: decoded.id,
        username: decoded.username,
        role: decoded.role,
        path: req.path
      });
    }

    next();

  } catch (error) {
    logger.error('Authentication middleware error', {
      tenantId: req.tenantId || 'unknown',
      error: error.message,
      path: req.path,
      ip: req.ip,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
    
    res.status(500).json({
      error: 'AUTHENTICATION_ERROR',
      message: 'Authentication system error'
    });
  }
};

/**
 * Kiosk-specific authentication middleware
 * Reads from kioskAccessToken cookie instead of accessToken
 * This allows admin and kiosk to maintain separate sessions
 */
const requireKioskAuthentication = async (req, res, next) => {
  try {
    // Extract token from kiosk-specific HTTP-only cookie
    const token = extractKioskTokenFromCookie(req);

    if (!token) {
      logger.warn('No kiosk authentication token provided', {
        tenantId: req.tenantId || 'unknown',
        path: req.path,
        method: req.method,
        ip: req.ip
      });

      return res.status(401).json({
        error: 'KIOSK_AUTHENTICATION_REQUIRED',
        message: 'Kiosk authentication required'
      });
    }

    // Verify JWT token
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (jwtError) {
      if (jwtError.name === 'TokenExpiredError') {
        logger.info('Expired kiosk token provided', {
          tenantId: req.tenantId || 'unknown',
          path: req.path,
          ip: req.ip
        });

        return res.status(401).json({
          error: 'KIOSK_TOKEN_EXPIRED',
          message: 'Kiosk session expired. Please log in again.'
        });
      }

      logger.warn('Invalid kiosk token provided', {
        tenantId: req.tenantId || 'unknown',
        error: jwtError.message,
        ip: req.ip
      });

      return res.status(401).json({
        error: 'INVALID_KIOSK_TOKEN',
        message: 'Invalid kiosk authentication token'
      });
    }

    // Validate tenant context
    if (req.tenantId && decoded.tenantId) {
      if (decoded.tenantId !== req.tenantId) {
        logger.error('Kiosk token tenant mismatch', {
          tokenTenantId: decoded.tenantId,
          requestTenantId: req.tenantId,
          userId: decoded.id,
          path: req.path,
          ip: req.ip
        });

        return res.status(401).json({
          error: 'KIOSK_TENANT_TOKEN_MISMATCH',
          message: 'Invalid kiosk session for this business'
        });
      }
    } else if (!req.tenantId && decoded.tenantId) {
      req.tenantId = decoded.tenantId;
    }

    // Verify user still exists and is active
    if (req.getTenantModel && (decoded.tenantId || req.tenantId)) {
      const TenantUser = req.getTenantModel('User');
      if (TenantUser) {
        try {
          const user = await TenantUser.findById(decoded.id).select('username role confirmed accessType');

          if (!user || !user.confirmed) {
            logger.warn('Kiosk token user not found or not confirmed', {
              tenantId: req.tenantId,
              userId: decoded.id,
              ip: req.ip
            });

            return res.status(401).json({
              error: 'KIOSK_USER_NOT_FOUND',
              message: 'User account not found or deactivated'
            });
          }

          // Verify user has kiosk access
          if (!['kiosk_only', 'both'].includes(user.accessType)) {
            logger.warn('User does not have kiosk access', {
              tenantId: req.tenantId,
              userId: decoded.id,
              accessType: user.accessType,
              ip: req.ip
            });

            return res.status(403).json({
              error: 'KIOSK_ACCESS_DENIED',
              message: 'User does not have kiosk access'
            });
          }

          // Update decoded with fresh user data
          decoded.username = user.username;
          decoded.role = user.role;
        } catch (dbError) {
          logger.warn('Error validating user during kiosk authentication', {
            tenantId: req.tenantId,
            userId: decoded.id,
            error: dbError.message
          });
          // Continue with cached user data from token
        }
      }
    }

    // Attach user info to request with kiosk flag
    req.user = {
      id: decoded.id,
      username: decoded.username,
      role: decoded.role,
      tenantId: decoded.tenantId || req.tenantId,
      isKiosk: true
    };

    // Log successful kiosk authentication (debug level only)
    if (process.env.LOG_LEVEL === 'debug') {
      logger.debug('Kiosk authentication successful', {
        tenantId: req.tenantId,
        userId: decoded.id,
        username: decoded.username,
        role: decoded.role,
        path: req.path
      });
    }

    next();

  } catch (error) {
    logger.error('Kiosk authentication middleware error', {
      tenantId: req.tenantId || 'unknown',
      error: error.message,
      path: req.path,
      ip: req.ip,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });

    res.status(500).json({
      error: 'KIOSK_AUTHENTICATION_ERROR',
      message: 'Kiosk authentication system error'
    });
  }
};

/**
 * Flexible authentication that accepts either admin or kiosk tokens
 * Useful for routes that both admin and kiosk users can access (e.g., POS transactions)
 */
const requireEitherAuthentication = async (req, res, next) => {
  try {
    // Try admin token first
    const adminToken = extractTokenFromCookie(req);

    // Try kiosk token if no admin token
    const kioskToken = !adminToken ? extractKioskTokenFromCookie(req) : null;

    const token = adminToken || kioskToken;
    const isKioskToken = !adminToken && kioskToken;

    if (!token) {
      logger.warn('No authentication token provided (admin or kiosk)', {
        tenantId: req.tenantId || 'unknown',
        path: req.path,
        method: req.method,
        ip: req.ip
      });

      return res.status(401).json({
        error: 'AUTHENTICATION_REQUIRED',
        message: 'Authentication required'
      });
    }

    // Verify JWT token
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (jwtError) {
      if (jwtError.name === 'TokenExpiredError') {
        return res.status(401).json({
          error: 'TOKEN_EXPIRED',
          message: 'Session expired. Please log in again.'
        });
      }

      return res.status(401).json({
        error: 'INVALID_TOKEN',
        message: 'Invalid authentication token'
      });
    }

    // Validate tenant context
    if (req.tenantId && decoded.tenantId) {
      if (decoded.tenantId !== req.tenantId) {
        logger.error('Token tenant mismatch', {
          tokenTenantId: decoded.tenantId,
          requestTenantId: req.tenantId,
          userId: decoded.id,
          path: req.path,
          ip: req.ip
        });

        return res.status(401).json({
          error: 'TENANT_TOKEN_MISMATCH',
          message: 'Invalid session for this business'
        });
      }
    } else if (!req.tenantId && decoded.tenantId) {
      req.tenantId = decoded.tenantId;
    }

    // Verify user still exists and is active
    if (req.getTenantModel && (decoded.tenantId || req.tenantId)) {
      const TenantUser = req.getTenantModel('User');
      if (TenantUser) {
        try {
          const user = await TenantUser.findById(decoded.id).select('username role confirmed accessType');

          if (!user || !user.confirmed) {
            return res.status(401).json({
              error: 'USER_NOT_FOUND',
              message: 'User account not found or deactivated'
            });
          }

          // If using kiosk token, verify user has kiosk access
          if (isKioskToken && !['kiosk_only', 'both'].includes(user.accessType)) {
            return res.status(403).json({
              error: 'KIOSK_ACCESS_DENIED',
              message: 'User does not have kiosk access'
            });
          }

          // Update decoded with fresh user data
          decoded.username = user.username;
          decoded.role = user.role;
        } catch (dbError) {
          logger.warn('Error validating user during authentication', {
            tenantId: req.tenantId,
            userId: decoded.id,
            error: dbError.message
          });
        }
      }
    }

    // Attach user info to request
    req.user = {
      id: decoded.id,
      username: decoded.username,
      role: decoded.role,
      tenantId: decoded.tenantId || req.tenantId,
      isKiosk: isKioskToken
    };

    if (process.env.LOG_LEVEL === 'debug') {
      logger.debug(`${isKioskToken ? 'Kiosk' : 'Admin'} authentication successful`, {
        tenantId: req.tenantId,
        userId: decoded.id,
        username: decoded.username,
        role: decoded.role,
        path: req.path
      });
    }

    next();

  } catch (error) {
    logger.error('Authentication middleware error', {
      tenantId: req.tenantId || 'unknown',
      error: error.message,
      path: req.path,
      ip: req.ip,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });

    res.status(500).json({
      error: 'AUTHENTICATION_ERROR',
      message: 'Authentication system error'
    });
  }
};

/**
 * Require admin role (admin or super_admin)
 */
const requireAdmin = (req, res, next) => {
  requireAuthentication(req, res, () => {
    if (!req.user || !['admin', 'super_admin', 'custom'].includes(req.user.role)) {
      logger.warn('Admin access denied', {
        tenantId: req.tenantId,
        userId: req.user?.id,
        role: req.user?.role || 'none',
        path: req.path,
        ip: req.ip
      });

      return res.status(403).json({
        error: 'ADMIN_ACCESS_REQUIRED',
        message: 'Administrator access required'
      });
    }
    next();
  });
};

/**
 * Require super admin role only
 */
const requireSuperAdmin = (req, res, next) => {
  requireAuthentication(req, res, () => {
    if (!req.user || req.user.role !== 'super_admin') {
      logger.warn('Super admin access denied', {
        tenantId: req.tenantId,
        userId: req.user?.id,
        role: req.user?.role || 'none',
        path: req.path,
        ip: req.ip
      });
      
      return res.status(403).json({
        error: 'SUPER_ADMIN_ACCESS_REQUIRED',
        message: 'Super administrator access required'
      });
    }
    next();
  });
};

/**
 * Require cashier role (cashier or admin)
 */
const requireCashier = (req, res, next) => {
  requireAuthentication(req, res, () => {
    if (!req.user || !['cashier', 'admin', 'super_admin', 'custom'].includes(req.user.role)) {
      logger.warn('Cashier access denied', {
        tenantId: req.tenantId,
        userId: req.user?.id,
        role: req.user?.role || 'none',
        path: req.path,
        ip: req.ip
      });
      
      return res.status(403).json({
        error: 'CASHIER_ACCESS_REQUIRED',
        message: 'Cashier access required'
      });
    }
    next();
  });
};

/**
 * Optional authentication - doesn't fail if no token provided
 * Useful for routes that work for both authenticated and unauthenticated users
 */
const optionalAuthentication = async (req, res, next) => {
  const token = extractTokenFromCookie(req);
  
  if (!token) {
    // No token provided - continue without authentication
    return next();
  }
  
  // Token provided - validate it
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Validate tenant context if available
    if (req.tenantId && decoded.tenantId) {
      if (decoded.tenantId !== req.tenantId) {
        // Invalid tenant context - clear user info and continue
        req.user = null;
        return next();
      }
    } else if (!req.tenantId && decoded.tenantId) {
      req.tenantId = decoded.tenantId;
    }
    
    req.user = {
      id: decoded.id,
      username: decoded.username,
      role: decoded.role,
      tenantId: decoded.tenantId || req.tenantId
    };
    
  } catch (error) {
    // Invalid token - clear user info and continue
    req.user = null;
  }
  
  next();
};

/**
 * Check if user is authenticated (boolean check)
 */
const isAuthenticated = (req) => {
  return !!(req.user && req.user.id);
};

/**
 * Require specific module permission (for custom role users)
 * Admin role bypasses all permission checks.
 * Usage: requirePermission('inventory'), requirePermission('pos')
 */
const requirePermission = (permissionKey) => {
  return (req, res, next) => {
    requireEitherAuthentication(req, res, async () => {
      // Admin role has full access
      if (req.user.role === 'admin' || req.user.role === 'super_admin') {
        return next();
      }

      // Kiosk/staff users bypass module permission checks (they have their own access control)
      if (req.user.isKiosk || req.user.role === 'staff' || req.user.role === 'cashier') {
        return next();
      }

      // For custom role, check permissions from database
      if (req.user.role === 'custom') {
        try {
          const TenantUser = req.getTenantModel('User');
          const user = await TenantUser.findById(req.user.id).select('permissions');
          if (user && user.permissions && user.permissions[permissionKey] === true) {
            return next();
          }
          return res.status(403).json({
            error: 'PERMISSION_DENIED',
            message: `You do not have permission to access the ${permissionKey} module`
          });
        } catch (err) {
          logger.error('Permission check error', { error: err.message, userId: req.user.id });
          return res.status(500).json({ error: 'SYSTEM_ERROR', message: 'Error checking permissions' });
        }
      }

      // Other roles - deny by default
      return res.status(403).json({
        error: 'PERMISSION_DENIED',
        message: 'You do not have permission to access this resource'
      });
    });
  };
};

/**
 * Check if user has specific role
 */
const hasRole = (req, role) => {
  return req.user && req.user.role === role;
};

/**
 * Check if user has any of the specified roles
 */
const hasAnyRole = (req, roles) => {
  return req.user && roles.includes(req.user.role);
};

module.exports = {
  requireAuthentication,
  requireKioskAuthentication,
  requireEitherAuthentication,
  requireAdmin,
  requireSuperAdmin,
  requireCashier,
  requirePermission,
  optionalAuthentication,
  isAuthenticated,
  hasRole,
  hasAnyRole,
  extractTokenFromCookie,
  extractKioskTokenFromCookie
};