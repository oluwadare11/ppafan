// middleware/tenant.js - Simplified for single-tenant PPAfan
// No multi-tenancy - just provides model access helpers

const logger = require('../utils/logger');
const getTenantModel = require('../utils/getTenantModel');
const Tenant = require('../models/Tenant');

/**
 * Simple middleware that adds model helpers to request
 * No tenant detection needed - single tenant system
 * FIXED: Now loads full tenant document from database to get notification settings
 */
const identifyTenant = async (req, res, next) => {
  try {
    // Load actual tenant document from database to get notification emails and settings
    const tenantDoc = await Tenant.getOrCreate();

    // Set tenant context with full document data
    req.tenant = {
      tenantId: tenantDoc.tenantId || 'pumphouse',
      businessName: tenantDoc.businessName || process.env.SYSTEM_NAME || 'PPAfan',
      businessType: tenantDoc.businessType || 'Attendance Management',
      status: tenantDoc.status || 'active',
      subscription: tenantDoc.subscription || { plan: 'enterprise', status: 'active' },
      // CRITICAL: Include contactInfo and settings for email notifications
      contactInfo: tenantDoc.contactInfo || {},
      settings: tenantDoc.settings || {},
      branding: tenantDoc.branding || {}
    };
    req.tenantId = 'pumphouse';
    req.subdomain = 'pumphouse';

    next();
  } catch (error) {
    logger.error('Failed to load tenant', { error: error.message });
    // Fallback to minimal tenant object
    req.tenant = {
      tenantId: 'pumphouse',
      businessName: process.env.SYSTEM_NAME || 'PPAfan',
      status: 'active',
      subscription: { plan: 'enterprise', status: 'active' }
    };
    req.tenantId = 'pumphouse';
    req.subdomain = 'pumphouse';
    next();
  }
};

/**
 * Middleware to add model access helpers
 */
const addTenantHelpers = (req, res, next) => {
  // Cache for models
  if (!req._modelCache) {
    req._modelCache = new Map();
  }

  // Get model helper - uses simplified getTenantModel
  req.getTenantModel = (baseModelName) => {
    if (req._modelCache.has(baseModelName)) {
      return req._modelCache.get(baseModelName);
    }

    const model = getTenantModel(baseModelName);
    req._modelCache.set(baseModelName, model);
    return model;
  };

  // Alias for clarity
  req.getModel = req.getTenantModel;

  // Helper to execute operations (kept for compatibility)
  req.withTenantContext = async (operation) => {
    try {
      return await operation(req.tenant, req.tenantId);
    } catch (error) {
      logger.error('Operation failed', {
        error: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      });
      throw error;
    }
  };

  next();
};

/**
 * No-op middleware - always passes (single tenant, always active)
 */
const requireActiveTenant = (req, res, next) => {
  next();
};

/**
 * No-op middleware - tenant context always exists
 */
const requireTenantContext = (req, res, next) => {
  next();
};

/**
 * Extract subdomain - returns default for single tenant
 */
const extractSubdomain = (req) => {
  return 'pumphouse';
};

// Cache functions (no-op for single tenant)
const clearTenantCache = () => {};
const clearAllTenantCache = () => {};
const getTenantCacheStats = () => null;

module.exports = {
  identifyTenant,
  requireActiveTenant,
  addTenantHelpers,
  requireTenantContext,
  extractSubdomain,
  getTenantCacheStats,
  clearTenantCache,
  clearAllTenantCache,
  getTenantModel
};
