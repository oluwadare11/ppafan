// middleware/rateLimiting.js - FIXED: Development-Friendly Rate Limits
const rateLimit = require('express-rate-limit');

const isDevelopment = process.env.NODE_ENV === 'development';

// Create rate limiter with development bypass
const createSmartLimit = (options) => {
  return rateLimit({
    windowMs: options.windowMs,
    max: isDevelopment ? options.max * 50 : options.max, // 50x higher limits in dev
    message: options.message || {
      error: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many requests. Please try again later.'
    },
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => {
      // BYPASS ALL rate limiting in development for localhost
      if (isDevelopment && req.ip === '::1' || req.ip === '127.0.0.1') {
        return true;
      }
      
      // Skip for super admin
      if (req.user?.role === 'super_admin') {
        return true;
      }
      
      // Skip for development environment entirely
      if (isDevelopment) {
        console.log(`Rate limit BYPASSED (dev): ${req.method} ${req.path}`);
        return true;
      }
      
      return false;
    }
  });
};

// PUMP HOUSE ERP: Relaxed limits for single-tenant deployment
const globalLimit = createSmartLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5000 // Very high for single tenant
});

const authLimit = createSmartLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // 100 login attempts per 15 min (was 10)
});

const registrationLimit = createSmartLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 20 // 20 registrations per hour (was 3)
});

const posLimit = createSmartLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 1000 // High for busy POS operations
});

const inventoryLimit = createSmartLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 1000 // High for inventory operations
});

const superAdminLimit = createSmartLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 500 // Relaxed for admin
});

const staffLimit = createSmartLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 500 // High for staff operations
});

const customerLimit = createSmartLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 500 // High for customer operations
});

// Log rate limiting status on startup
console.log(`Rate Limiting Mode: ${isDevelopment ? 'DEVELOPMENT (BYPASSED)' : 'PRODUCTION (ENFORCED)'}`);

module.exports = {
  globalLimit,
  authLimit,
  registrationLimit,
  posLimit,
  inventoryLimit,
  superAdminLimit,
  staffLimit,
  customerLimit,
  createSmartLimit
};