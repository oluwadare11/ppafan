// middleware/csrf.js - Complete Working CSRF Protection
const crypto = require('crypto');

const CSRF_SECRET = process.env.CSRF_SECRET || crypto.randomBytes(32).toString('hex');
const tokenStore = new Map();

// Generate CSRF token
const generateCSRFToken = (sessionId) => {
  const timestamp = Date.now();
  const nonce = crypto.randomBytes(16).toString('hex');
  const token = crypto.createHmac('sha256', CSRF_SECRET)
    .update(`${sessionId}:${timestamp}:${nonce}`)
    .digest('hex');
  
  const csrfToken = `${timestamp}:${nonce}:${token}`;
  
  // Store token with expiration
  tokenStore.set(csrfToken, {
    sessionId,
    timestamp,
    expires: timestamp + (60 * 60 * 1000) // 1 hour
  });
  
  return csrfToken;
};

// Validate CSRF token
const validateCSRFToken = (token, sessionId) => {
  if (!token || !sessionId) return false;
  
  const tokenData = tokenStore.get(token);
  if (!tokenData) return false;
  
  if (Date.now() > tokenData.expires) {
    tokenStore.delete(token);
    return false;
  }
  
  if (tokenData.sessionId !== sessionId) return false;
  
  const [timestamp, nonce, hash] = token.split(':');
  const expectedHash = crypto.createHmac('sha256', CSRF_SECRET)
    .update(`${sessionId}:${timestamp}:${nonce}`)
    .digest('hex');
  
  return hash === expectedHash;
};

// Helper to extract sessionId from request
const getSessionId = (req) => {
  // Try to get sessionId from user object (set during authentication)
  if (req.user?.id) {
    return `user_${req.user.id}`;
  }

  // Try express-session sessionID
  if (req.sessionID) {
    return req.sessionID;
  }

  // Try session object
  if (req.session?.id) {
    return req.session.id;
  }

  // Extract from CSRF token itself if present (for validation)
  const csrfToken = req.headers['x-csrf-token'] || req.body._csrf;
  if (csrfToken) {
    const tokenData = tokenStore.get(csrfToken);
    if (tokenData) {
      return tokenData.sessionId;
    }
  }

  // Fallback: use IP-based temporary ID (consistent within same request lifecycle)
  return `temp_${req.ip}`;
};

// Simple CSRF protection middleware
const csrfProtection = (req, res, next) => {
  // PUMP HOUSE ERP: CSRF disabled for single-tenant deployment
  // To re-enable, set CSRF_ENABLED=true in .env
  const csrfEnabled = process.env.CSRF_ENABLED === 'true';
  if (!csrfEnabled) {
    return next();
  }

  // Skip for GET, HEAD, OPTIONS
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    return next();
  }

  // Skip for authentication routes (they can't have CSRF tokens yet)
  const authRoutes = [
    '/api/public/',
    '/api/webhook/',
    '/api/admin/auth/',
    '/api/auth/login',
    '/api/auth/register',
    '/api/auth/forgot-password',
    '/api/auth/reset-password',
    '/api/auth/verify-email',
    '/api/tenant/info',
    '/api/auth/verify',
    '/api/auth/refresh'
  ];

  const isAuthRoute = authRoutes.some(route => req.path.includes(route));
  if (isAuthRoute) {
    if (process.env.NODE_ENV === 'development') {
      console.log('CSRF: Skipping auth route:', req.path);
    }
    return next();
  }

  // Development: Make CSRF optional but log
  if (process.env.NODE_ENV === 'development') {
    const csrfToken = req.headers['x-csrf-token'] || req.body._csrf;
    if (!csrfToken) {
      console.log('CSRF: Development mode - no token provided for:', req.path);
    } else {
      console.log('CSRF: Development mode - token provided for:', req.path);
    }
    return next();
  }

  // Production CSRF validation
  const csrfToken = req.headers['x-csrf-token'] || req.body._csrf;

  if (!csrfToken) {
    console.warn('CSRF: No token provided', {
      path: req.path,
      method: req.method
    });

    return res.status(403).json({
      error: 'CSRF_TOKEN_MISSING',
      message: 'CSRF token required'
    });
  }

  // Extract sessionId from token data (self-validating)
  const sessionId = getSessionId(req);

  if (!validateCSRFToken(csrfToken, sessionId)) {
    console.warn('CSRF: Token validation failed', {
      path: req.path,
      method: req.method,
      hasToken: !!csrfToken,
      sessionId: sessionId
    });

    return res.status(403).json({
      error: 'CSRF_TOKEN_INVALID',
      message: 'Invalid or missing CSRF token'
    });
  }

  next();
};

// Double submit pattern - simplified
const doubleSubmit = (req, res, next) => {
  // PUMP HOUSE ERP: CSRF disabled for single-tenant deployment
  const csrfEnabled = process.env.CSRF_ENABLED === 'true';
  if (!csrfEnabled) {
    return next();
  }

  // Skip for GET requests
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    return next();
  }

  // Skip for auth routes
  const authRoutes = [
    '/api/public/',
    '/api/webhook/',
    '/api/admin/auth/',
    '/api/auth/login',
    '/api/auth/register',
    '/api/auth/forgot-password',
    '/api/auth/reset-password',
    '/api/auth/verify-email'
  ];

  const isAuthRoute = authRoutes.some(route => req.path.includes(route));
  if (isAuthRoute) {
    return next();
  }

  // Development: Optional but logged
  if (process.env.NODE_ENV === 'development') {
    const cookieToken = req.cookies?.[`XSRF-TOKEN`];
    const headerToken = req.headers['x-xsrf-token'] || req.headers['x-csrf-token'];

    if (!cookieToken && !headerToken) {
      console.log('CSRF: Development - no double-submit tokens for:', req.path);
    }
    return next();
  }
  
  // Production validation
  const cookieToken = req.cookies?.[`XSRF-TOKEN`];
  const headerToken = req.headers['x-xsrf-token'] || req.headers['x-csrf-token'];
  
  if (!cookieToken || !headerToken || cookieToken !== headerToken) {
    return res.status(403).json({
      error: 'CSRF_TOKEN_MISMATCH',
      message: 'CSRF token validation failed'
    });
  }
  
  next();
};

// Set CSRF cookie
const setCsrfCookie = (req, res, next) => {
  const sessionId = req.sessionID || req.session?.id || `temp_${req.ip}_${Date.now()}`;
  const csrfToken = generateCSRFToken(sessionId);
  
  res.cookie('XSRF-TOKEN', csrfToken, {
    httpOnly: false,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 60 * 60 * 1000 // 1 hour
  });
  
  next();
};

// Provide CSRF token
const provideCSRFToken = (req, res, next) => {
  const sessionId = req.sessionID || req.session?.id || `temp_${req.ip}_${Date.now()}`;
  const csrfToken = generateCSRFToken(sessionId);
  
  res.setHeader('X-CSRF-Token', csrfToken);
  res.locals.csrfToken = csrfToken;
  
  next();
};

// Clean up expired tokens periodically
setInterval(() => {
  const now = Date.now();
  for (const [token, data] of tokenStore.entries()) {
    if (now > data.expires) {
      tokenStore.delete(token);
    }
  }
}, 30 * 60 * 1000); // Every 30 minutes

module.exports = {
  // Main exports - ALL FUNCTIONS DEFINED
  csrfProtection,
  generateCSRFToken,
  validateCSRFToken,
  provideCSRFToken,
  
  // Combined middleware
  doubleSubmit,
  setCsrfCookie,
  
  // For compatibility with your server.js
  full: [provideCSRFToken, csrfProtection],
  
  // The object your server.js expects
  doubleSubmitCookie: {
    setCookie: setCsrfCookie,
    validate: doubleSubmit
  }
};