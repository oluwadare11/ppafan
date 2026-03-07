// PPAfan - Attendance Management System Backend Server
require('dotenv').config();

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const compression = require('compression');
const http = require('http');
const path = require('path');
const logger = require('./utils/logger');
const cookieParser = require('cookie-parser');

// Security middleware
const securityMiddleware = require('./middleware/security');
const rateLimiting = require('./middleware/rateLimiting');
const inputValidation = require('./middleware/inputValidation');
const { auditLogger } = require('./middleware/auditLogger');

// Simplified tenant middleware (single-tenant)
const { identifyTenant, addTenantHelpers } = require('./middleware/tenant');
const { requirePermission } = require('./middleware/cookieAuth');

// Import models
const Tenant = require('./models/Tenant');

// Import routes
const authRoutes = require('./routes/tenant-auth');
const staffRoutes = require('./routes/staff');
const usersRoutes = require('./routes/users');
const settingsRoutes = require('./routes/settings');
const dashboardRoutes = require('./routes/dashboard');
const attendanceRoutes = require('./routes/attendance');
const devicesRouter = require('./routes/devices');
const admsRouter = require('./routes/adms');
const deviceCommandsRouter = require('./routes/deviceCommands');
const uploadRouter = require('./routes/upload');
const payrollRoutes = require('./routes/payroll');

// Initialize cron jobs
require('./crons/attendance-cron');
require('./crons/payroll-cron');

const app = express();

// Trust proxy for nginx
app.set('trust proxy', 1);

// Environment
const isDevelopment = process.env.NODE_ENV === 'development';
const isProduction = process.env.NODE_ENV === 'production';

console.log(`\n📋 PPAfan Attendance System - ${process.env.NODE_ENV || 'development'} mode`);

// MongoDB Connection
mongoose.connect(process.env.MONGO_URI, {
  serverSelectionTimeoutMS: 30000,
})
  .then(() => {
    logger.info('Database connected', {
      system: process.env.SYSTEM_NAME || 'PPAfan',
      version: process.env.SYSTEM_VERSION || '1.0.0',
      database: mongoose.connection.name
    });
  })
  .catch((err) => {
    logger.error('Database connection failed', { error: err.message });
    process.exit(1);
  });

// Static file serving
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use('/images', express.static(path.join(__dirname, 'public/images')));

// Security headers
app.use(securityMiddleware.helmet);
app.use(securityMiddleware.xssProtection);

// CORS Configuration
const corsOptions = {
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, Postman)
    if (!origin) return callback(null, true);

    if (isDevelopment) {
      // Development: allow localhost
      if (origin.match(/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/)) {
        return callback(null, true);
      }
      return callback(null, true);
    }

    // Production: allow ppafan.org domain
    const allowedOrigins = [
      'https://app.ppafan.org',
      'https://ppafan.org',
      'https://www.ppafan.org'
    ];

    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    callback(new Error('Not allowed by CORS'));
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token', 'Accept'],
  credentials: true,
  optionsSuccessStatus: 204,
  maxAge: isDevelopment ? 60 : 86400
};

app.use(cors(corsOptions));

// Rate limiting (relaxed in development)
if (!isDevelopment) {
  app.use(rateLimiting.globalLimit);
}

// Body parsing
app.use(express.json({ limit: isDevelopment ? '50mb' : '10mb' }));
app.use(express.urlencoded({ limit: isDevelopment ? '50mb' : '10mb', extended: true }));
app.use(cookieParser());
app.use(inputValidation.sanitizeAndValidate);
app.use(securityMiddleware.mongoSanitize);

// ZKTeco device support
app.use('/iclock', express.raw({ type: '*/*', limit: '10mb' }));

// Root route
app.get('/', (req, res) => {
  res.json({
    message: 'PPAfan Attendance System API Server',
    version: process.env.SYSTEM_VERSION || '1.0.0',
    status: 'operational'
  });
});

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: Math.floor(process.uptime()),
    system: process.env.SYSTEM_NAME || 'PPAfan'
  });
});

// System status
app.get('/api/system/status', (req, res) => {
  res.json({
    status: 'operational',
    system: process.env.SYSTEM_NAME || 'PPAfan',
    version: process.env.SYSTEM_VERSION || '1.0.0',
    database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    timestamp: new Date().toISOString()
  });
});

// CSRF Token endpoint
app.get('/api/auth/csrf-token', (req, res) => {
  const csrfToken = isDevelopment
    ? `dev_token_${Date.now()}_${Math.random().toString(36).substring(7)}`
    : require('crypto').randomBytes(32).toString('hex');

  res.json({ csrfToken, expires: Date.now() + (60 * 60 * 1000) });
});

// Business info endpoint (for frontend branding) - fetches from database
app.get('/api/tenant/info', async (req, res) => {
  try {
    // Fetch actual tenant data from database
    const tenant = await Tenant.getOrCreate();

    res.json({
      tenant: {
        businessName: tenant.businessName || process.env.SYSTEM_NAME || 'PPAfan',
        businessType: tenant.businessType || 'Attendance Management',
        branding: {
          primaryColor: tenant.branding?.primaryColor || '#2563EB',
          secondaryColor: tenant.branding?.secondaryColor || '#10B981',
          logo: tenant.branding?.logo || null
        },
        contactInfo: tenant.contactInfo || {},
        settings: tenant.settings || {},
        subscription: tenant.subscription || { plan: 'enterprise', status: 'active' }
      }
    });
  } catch (error) {
    console.error('Error fetching tenant info:', error);
    // Fallback to defaults on error
    res.json({
      tenant: {
        businessName: process.env.SYSTEM_NAME || 'PPAfan',
        businessType: 'Attendance Management',
        branding: {
          primaryColor: '#2563EB',
          secondaryColor: '#10B981',
          logo: null
        },
        subscription: { plan: 'enterprise', status: 'active' }
      }
    });
  }
});

// Authentication routes (no tenant middleware needed)
app.use('/api/auth', authRoutes);

// Apply model helpers to all API routes
app.use('/api', identifyTenant, addTenantHelpers);

// Core routes
app.use('/api/staff', staffRoutes);
app.use('/api/users', requirePermission('settings'), usersRoutes);
app.use('/api/settings', requirePermission('settings'), settingsRoutes);
app.use('/api/dashboard', requirePermission('dashboard'), dashboardRoutes);
app.use('/api/upload', uploadRouter);

// Payroll routes
app.use('/api/payroll', requirePermission('payroll'), payrollRoutes);

// Attendance routes
app.use('/api/attendance', requirePermission('attendance'), attendanceRoutes);

// Device management (ADMS for ZKTeco)
app.use('/api/devices', devicesRouter);
app.use('/api/device-commands', deviceCommandsRouter);
app.use('/iclock', admsRouter);
app.use('/api/adms', admsRouter);

// Error handling
app.use((err, req, res, next) => {
  logger.error('Request error', {
    error: err.message,
    url: req.url,
    method: req.method,
    stack: isDevelopment ? err.stack : undefined
  });

  if (err.message === 'Not allowed by CORS') {
    return res.status(403).json({
      error: 'CORS_ERROR',
      message: 'Request blocked by CORS policy'
    });
  }

  res.status(500).json({
    error: 'SERVER_ERROR',
    message: isDevelopment ? err.message : 'Internal server error'
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'NOT_FOUND',
    message: `Route ${req.method} ${req.path} not found`
  });
});

// Server startup
const PORT = process.env.HTTP_PORT || 5000;

const server = http.createServer(app);
server.listen(PORT, '0.0.0.0', () => {
  console.log(`\n🚀 PPAfan Attendance System Server Started`);
  console.log(`   Port: ${PORT}`);
  console.log(`   Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`   Database: ${mongoose.connection.name || 'connecting...'}`);

  if (isDevelopment) {
    console.log(`\n   📍 Local URLs:`);
    console.log(`      API: http://localhost:${PORT}`);
    console.log(`      Health: http://localhost:${PORT}/health`);
    console.log(`      Status: http://localhost:${PORT}/api/system/status`);
  }

  logger.info('Server started', { port: PORT, environment: process.env.NODE_ENV });
});

// Graceful shutdown
const shutdown = async (signal) => {
  console.log(`\n🛑 ${signal} received: shutting down...`);
  server.close(async () => {
    try {
      await mongoose.connection.close();
      console.log('✅ Server and database connections closed');
      process.exit(0);
    } catch (err) {
      console.error('Error during shutdown:', err);
      process.exit(1);
    }
  });
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
