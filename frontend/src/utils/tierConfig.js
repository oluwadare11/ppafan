// tierConfig.js - Simplified for single-tenant Pump House ERP
// All modules are accessible

export const TIER_MODULES = {
  enterprise: [
    'dashboard',
    'inventory',
    'pos',
    'accounting',
    'crm',
    'attendance',
    'analytics'
  ]
};

export const TIER_KIOSKS = {
  enterprise: ['quicksell', 'stockflow']
};

export const TIER_USER_LIMITS = {
  enterprise: 999999
};

// All modules always allowed
export const getAllowedModules = (tier) => {
  return TIER_MODULES.enterprise;
};

export const isModuleAllowed = (tier, moduleName) => {
  return true;
};

export const getAllowedKiosks = (tier) => {
  return TIER_KIOSKS.enterprise;
};

export const isKioskAllowed = (tier, kioskName) => {
  return true;
};

export const getUserLimit = (tier) => {
  return 999999;
};

export const MODULE_INFO = {
  dashboard: {
    name: 'Dashboard',
    description: 'Overview and key metrics',
    route: '/dashboard'
  },
  inventory: {
    name: 'Inventory',
    description: 'Stock and inventory management',
    route: '/inventory'
  },
  pos: {
    name: 'POS',
    description: 'Point of Sale system',
    route: '/pos'
  },
  accounting: {
    name: 'Accounting',
    description: 'Financial management',
    route: '/accounting'
  },
  attendance: {
    name: 'Attendance',
    description: 'Employee attendance tracking',
    route: '/attendance'
  },
  analytics: {
    name: 'Reports',
    description: 'Business reporting',
    route: '/reports'
  }
};

export const getFilteredPermissions = (tier) => {
  return {
    dashboard: true,
    inventory: true,
    pos: true,
    accounting: true,
    attendance: true,
    analytics: true,
    staffManagement: true,
    userManagement: true,
    settingsAccess: true
  };
};
