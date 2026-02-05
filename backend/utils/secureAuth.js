const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const logger = require('./logger');
const { generateCSRFToken } = require('../middleware/csrf');

const refreshTokenStore = new Map();

const generateTokenPair = (payload) => {
  const accessToken = jwt.sign(
    payload,
    process.env.JWT_SECRET,
    { expiresIn: '15m' }
  );
  
  const refreshToken = crypto.randomBytes(32).toString('hex');
  const refreshTokenExpiry = Date.now() + (7 * 24 * 60 * 60 * 1000);
  
  refreshTokenStore.set(refreshToken, {
    userId: payload.id,
    tenantId: payload.tenantId,
    role: payload.role,
    expires: refreshTokenExpiry
  });
  
  return { accessToken, refreshToken };
};

const refreshAccessToken = (refreshToken) => {
  const tokenData = refreshTokenStore.get(refreshToken);
  
  if (!tokenData || Date.now() > tokenData.expires) {
    refreshTokenStore.delete(refreshToken);
    throw new Error('Invalid or expired refresh token');
  }
  
  const newAccessToken = jwt.sign(
    {
      id: tokenData.userId,
      tenantId: tokenData.tenantId,
      role: tokenData.role
    },
    process.env.JWT_SECRET,
    { expiresIn: '15m' }
  );
  
  return newAccessToken;
};

const revokeRefreshToken = (refreshToken) => {
  refreshTokenStore.delete(refreshToken);
};

const setSecureCookies = (res, accessToken, refreshToken, options = {}) => {
  const isDevelopment = process.env.NODE_ENV === 'development';
  const prefix = options.prefix || ''; // e.g., 'kiosk' for kiosk auth
  const sessionId = options.sessionId || `session_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;

  // Common cookie options
  const baseCookieOptions = {
    httpOnly: true,
    path: '/',
    sameSite: 'lax',
  };

  // CRITICAL FIX: Development - NO domain setting for cross-port cookie sharing
  if (isDevelopment) {
    // IMPORTANT: No sameSite in dev allows localhost cross-port cookie sharing
    // Modern browsers treat localhost specially and allow this
    const devCookieOptions = {
      httpOnly: true,
      path: '/',
      secure: false, // Allow HTTP in dev
      // NO sameSite - browsers treat localhost permissively
      // NO domain property - allows localhost:5173 to share cookies with localhost:5000
    };

    const accessTokenName = prefix ? `${prefix}AccessToken` : 'accessToken';
    const refreshTokenName = prefix ? `${prefix}RefreshToken` : 'refreshToken';
    const csrfTokenName = prefix ? `${prefix}CsrfToken` : 'csrfToken';

    res.cookie(accessTokenName, accessToken, {
      ...devCookieOptions,
      maxAge: 15 * 60 * 1000 // 15 minutes
    });

    res.cookie(refreshTokenName, refreshToken, {
      ...devCookieOptions,
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      path: '/api/auth'
    });

    // FIXED: Use proper CSRF token generation that stores in tokenStore
    const csrfToken = generateCSRFToken(sessionId);
    res.cookie(csrfTokenName, csrfToken, {
      ...devCookieOptions,
      httpOnly: false, // Frontend needs to read this
      maxAge: 15 * 60 * 1000
    });

    console.log('DEV COOKIES SET: No sameSite (localhost permissive mode), HTTP allowed');
    return csrfToken;
  }

  // Production: Full security with configurable domain
  // PPAfan: Use COOKIE_DOMAIN env var or default to .ppafan.org
  const cookieDomain = process.env.COOKIE_DOMAIN || '.ppafan.org';
  const prodCookieOptions = {
    ...baseCookieOptions,
    secure: true, // HTTPS only
    sameSite: 'lax', // Changed from strict to lax for better compatibility
    domain: cookieDomain // Cross-subdomain sharing
  };

  const accessTokenName = prefix ? `${prefix}AccessToken` : 'accessToken';
  const refreshTokenName = prefix ? `${prefix}RefreshToken` : 'refreshToken';
  const csrfTokenName = prefix ? `${prefix}CsrfToken` : 'csrfToken';

  res.cookie(accessTokenName, accessToken, {
    ...prodCookieOptions,
    maxAge: 15 * 60 * 1000
  });

  res.cookie(refreshTokenName, refreshToken, {
    ...prodCookieOptions,
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: '/api/auth'
  });

  // FIXED: Use proper CSRF token generation that stores in tokenStore
  const csrfToken = generateCSRFToken(sessionId);
  res.cookie(csrfTokenName, csrfToken, {
    ...prodCookieOptions,
    httpOnly: false,
    maxAge: 15 * 60 * 1000
  });

  return csrfToken;
};

const clearAuthCookies = (res, options = {}) => {
  const isDevelopment = process.env.NODE_ENV === 'development';
  const prefix = options.prefix || '';

  const accessTokenName = prefix ? `${prefix}AccessToken` : 'accessToken';
  const refreshTokenName = prefix ? `${prefix}RefreshToken` : 'refreshToken';
  const csrfTokenName = prefix ? `${prefix}CsrfToken` : 'csrfToken';

  if (isDevelopment) {
    // CRITICAL FIX: DEV - Clear without domain to match what we set
    const clearOptions = {
      path: '/'
      // NO domain property
    };

    res.clearCookie(accessTokenName, clearOptions);
    res.clearCookie(csrfTokenName, clearOptions);
    res.clearCookie(refreshTokenName, {
      path: '/api/auth'
      // NO domain property
    });
    console.log(`DEV COOKIES CLEARED${prefix ? ` (${prefix})` : ''} (no domain specified)`);
  } else {
    // PROD: Clear with domain
    const cookieDomain = process.env.COOKIE_DOMAIN || '.ppafan.org';
    const clearOptions = {
      domain: cookieDomain,
      path: '/'
    };
    
    res.clearCookie('accessToken', clearOptions);
    res.clearCookie('csrfToken', clearOptions);
    res.clearCookie('refreshToken', {
      ...clearOptions,
      path: '/api/auth'
    });
  }
};

const extractToken = (req) => {
  return req.cookies?.accessToken || 
         req.header('Authorization')?.replace('Bearer ', '');
};

const secureLog = (level, message, data = {}) => {
  const sanitizedData = { ...data };

  delete sanitizedData.password;
  delete sanitizedData.token;
  delete sanitizedData.accessToken;
  delete sanitizedData.refreshToken;
  delete sanitizedData.tempPassword;
  delete sanitizedData.newPassword;
  delete sanitizedData.pin;

  Object.keys(sanitizedData).forEach(key => {
    if (typeof sanitizedData[key] === 'string' && sanitizedData[key].length > 100) {
      sanitizedData[key] = sanitizedData[key].substring(0, 97) + '...';
    }
  });

  // Map custom levels to winston levels
  const levelMap = {
    'critical': 'error',
    'high': 'error',
    'medium': 'warn',
    'low': 'info'
  };

  const logLevel = levelMap[level] || level;

  if (typeof logger[logLevel] === 'function') {
    logger[logLevel](message, sanitizedData);
  } else {
    logger.error(message, sanitizedData);
  }
};

// Cleanup expired refresh tokens
setInterval(() => {
  const now = Date.now();
  for (const [token, data] of refreshTokenStore.entries()) {
    if (now > data.expires) {
      refreshTokenStore.delete(token);
    }
  }
}, 60 * 60 * 1000);

module.exports = {
  generateTokenPair,
  refreshAccessToken,
  revokeRefreshToken,
  setSecureCookies,
  clearAuthCookies,
  extractToken,
  secureLog
};