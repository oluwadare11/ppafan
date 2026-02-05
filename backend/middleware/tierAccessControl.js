// middleware/tierAccessControl.js - Simplified for single-tenant Pump House ERP
// All modules are enabled - no tier restrictions

/**
 * No-op middleware - all modules are accessible
 */
const requireModuleAccess = (moduleName) => {
  return (req, res, next) => {
    // All modules accessible in single-tenant system
    next();
  };
};

/**
 * Attach tier info - always enterprise level
 */
const attachTierInfo = (req, res, next) => {
  req.tierInfo = {
    plan: 'enterprise',
    allowedModules: ['dashboard', 'inventory', 'pos', 'accounting', 'crm', 'attendance', 'payroll', 'analytics'],
    isModuleAllowed: () => true
  };
  next();
};

/**
 * Check module access - always returns true
 */
const checkModuleAccess = (req, moduleName) => {
  return true;
};

/**
 * Get allowed modules - returns all modules
 */
const getAllowedModules = (tier) => {
  return ['dashboard', 'inventory', 'pos', 'accounting', 'crm', 'attendance', 'payroll', 'analytics'];
};

/**
 * Check if module is allowed - always true
 */
const isModuleAllowed = (tier, moduleName) => {
  return true;
};

const TIER_MODULES = {
  enterprise: ['dashboard', 'inventory', 'pos', 'accounting', 'crm', 'attendance', 'payroll', 'analytics']
};

module.exports = {
  requireModuleAccess,
  attachTierInfo,
  checkModuleAccess,
  getAllowedModules,
  isModuleAllowed,
  TIER_MODULES
};
