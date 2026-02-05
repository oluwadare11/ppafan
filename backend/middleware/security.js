// middleware/security.js - Production-Ready CORS Configuration
const helmet = require('helmet');
const cors = require('cors');
const mongoSanitize = require('express-mongo-sanitize');

const isDevelopment = process.env.NODE_ENV === 'development';
const isProduction = process.env.NODE_ENV === 'production';

// Enhanced CORS configuration that works for both dev and production
const corsOptions = {
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, Postman, etc.)
    if (!origin) {
      console.log('CORS: No origin header - allowing (mobile/native apps)');
      return callback(null, true);
    }
    
    // Development origins
    const devOrigins = [
      'http://localhost:5173',
      'http://localhost:3000',
      'http://127.0.0.1:5173',
      'http://127.0.0.1:3000',
      'http://localhost:5174', // Vite preview
      'http://localhost:4173'  // Alternative Vite port
    ];
    
    // Production origins
    const prodOrigins = [
      'https://www.opsuite.io',
      'https://opsuite.io',
      'https://admin.opsuite.io',
      'https://app.opsuite.io'
    ];
    
    const allowedOrigins = isDevelopment ? devOrigins : prodOrigins;
    
    // Development: Allow localhost/127.0.0.1 with any port
    if (isDevelopment) {
      if (origin.match(/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/)) {
        console.log('CORS: Development localhost pattern allowed:', origin);
        return callback(null, true);
      }
    }
    
    // Production: Allow *.opsuite.io subdomains
    if (isProduction) {
      if (origin.match(/^https:\/\/[a-zA-Z0-9-]+\.opsuite\.io$/)) {
        console.log('CORS: Production subdomain allowed:', origin);
        return callback(null, true);
      }
    }
    
    // Check explicit allowed origins
    if (allowedOrigins.includes(origin)) {
      console.log('CORS: Explicit origin allowed:', origin);
      return callback(null, true);
    }
    
    // Log blocked origins for debugging
    console.warn('CORS blocked origin:', origin, {
      isDevelopment,
      allowedOrigins: isDevelopment ? 'localhost patterns + explicit' : 'opsuite.io subdomains + explicit'
    });
    
    callback(new Error('Not allowed by CORS policy'));
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type', 
    'Authorization', 
    'X-Tenant-Subdomain',
    'X-CSRF-Token',
    'X-Requested-With',
    'Cache-Control'
  ],
  credentials: true,
  optionsSuccessStatus: 204,
  // Add preflight cache for production performance
  maxAge: isProduction ? 86400 : 300 // 24 hours in prod, 5 minutes in dev
};

// Helmet configuration with environment-specific settings
const helmetOptions = {
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: [
        "'self'", 
        "'unsafe-inline'", 
        "https://fonts.googleapis.com",
        "https://cdn.jsdelivr.net"
      ],
      fontSrc: [
        "'self'", 
        "https://fonts.gstatic.com",
        "https://cdn.jsdelivr.net"
      ],
      imgSrc: ["'self'", "data:", "https:", "blob:"],
      scriptSrc: isDevelopment 
        ? ["'self'", "'unsafe-eval'", "'unsafe-inline'"] 
        : ["'self'", "'unsafe-inline'"], // Allow inline for production builds
      connectSrc: isDevelopment 
        ? ["'self'", "http://localhost:*", "ws://localhost:*", "wss://localhost:*"]
        : ["'self'", "https://*.opsuite.io", "wss://*.opsuite.io"],
      frameSrc: ["'none'"],
      objectSrc: ["'none'"],
      upgradeInsecureRequests: isProduction ? [] : null
    }
  },
  crossOriginEmbedderPolicy: false,
  hsts: isProduction ? {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  } : false
};

// Enhanced XSS Protection with Additional Security Headers
const xssProtection = (req, res, next) => {
  // Basic security headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.removeHeader('X-Powered-By');

  // Enhanced security headers
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=(), payment=(), usb=(), magnetometer=(), gyroscope=(), speaker=()');
  res.setHeader('X-Permitted-Cross-Domain-Policies', 'none');
  res.setHeader('X-Download-Options', 'noopen');
  res.setHeader('X-DNS-Prefetch-Control', 'off');

  // Expect-CT (Certificate Transparency) for production
  if (isProduction) {
    res.setHeader('Expect-CT', 'max-age=86400, enforce');
  }

  // Development headers for debugging
  if (isDevelopment) {
    res.setHeader('X-Debug-Environment', 'development');
    res.setHeader('X-CORS-Debug', 'enabled');
  }

  next();
};

// IP-based restrictions for super admin (production only)
const checkSuperAdminIP = (req, res, next) => {
  // Only apply IP restrictions in production for super admin routes
  if (isProduction && req.path.startsWith('/api/admin/')) {
    const superAdminIPs = process.env.SUPER_ADMIN_IPS;
    if (superAdminIPs) {
      const allowedIPs = superAdminIPs.split(',').map(ip => ip.trim());
      const clientIP = req.ip || req.connection.remoteAddress || req.socket.remoteAddress;
      
      // Handle forwarded headers in production
      const forwardedFor = req.headers['x-forwarded-for'];
      const realIP = forwardedFor ? forwardedFor.split(',')[0].trim() : clientIP;
      
      if (!allowedIPs.includes(realIP) && !allowedIPs.includes(clientIP)) {
        console.warn('Super admin access denied for IP:', { realIP, clientIP, allowed: allowedIPs });
        return res.status(403).json({ 
          error: 'ACCESS_DENIED',
          message: 'Access denied from this IP address' 
        });
      }
    }
  }
  next();
};

// Request size limits with environment-specific values
const requestLimits = {
  json: { limit: isDevelopment ? '50mb' : '10mb' },
  urlencoded: { 
    limit: isDevelopment ? '50mb' : '10mb', 
    extended: true,
    parameterLimit: 1000
  }
};

// Enhanced security validation
const validateSecurityConfig = () => {
  const warnings = [];
  const errors = [];
  
  if (isDevelopment) {
    warnings.push('Development mode - some security features relaxed');
  }
  
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
    errors.push('JWT_SECRET must be at least 32 characters');
  }
  
  if (!process.env.SESSION_SECRET || process.env.SESSION_SECRET.length < 32) {
    warnings.push('SESSION_SECRET should be at least 32 characters');
  }
  
  if (isProduction) {
    if (!process.env.ENCRYPTION_KEY) {
      errors.push('ENCRYPTION_KEY is required in production');
    }
    
    if (!process.env.SUPER_ADMIN_IPS) {
      warnings.push('SUPER_ADMIN_IPS not configured - super admin accessible from any IP');
    }
  }
  
  return {
    isSecure: errors.length === 0,
    warnings,
    errors,
    environment: process.env.NODE_ENV,
    corsOrigins: isDevelopment ? 'localhost patterns allowed' : '*.opsuite.io domains only'
  };
};

// Debug CORS middleware (development only)
const debugCORS = isDevelopment ? (req, res, next) => {
  const origin = req.headers.origin;
  console.log('CORS Debug:', {
    method: req.method,
    origin: origin || 'no-origin',
    path: req.path,
    headers: {
      'user-agent': req.headers['user-agent']?.substring(0, 50),
      'x-tenant-subdomain': req.headers['x-tenant-subdomain']
    }
  });
  next();
} : (req, res, next) => next();

module.exports = {
  // Apply CORS with enhanced configuration
  cors: cors(corsOptions),
  
  // Apply Helmet security headers
  helmet: helmet(helmetOptions),
  
  // Apply XSS protection
  xssProtection,
  
  // Apply MongoDB injection protection
  mongoSanitize: mongoSanitize({
    allowDots: true,
    replaceWith: '_'
  }),
  
  // Apply IP restrictions for super admin
  checkSuperAdminIP,
  
  // Request size limits
  requestLimits,
  
  // Security configuration checker
  validateSecurityConfig,
  
  // Debug middleware
  debugCORS,
  
  // Environment info
  isDevelopment,
  isProduction
};