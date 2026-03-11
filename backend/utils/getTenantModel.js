// utils/getTenantModel.js - Model loader for single-tenant Pump House ERP
// Simplified version - no tenant prefixes, direct model access

const mongoose = require('mongoose');
const logger = require('./logger');

// Model cache to avoid re-requiring
const modelCache = new Map();

/**
 * Gets or creates a Mongoose model
 * Single-tenant version - uses fixed collection names
 *
 * @param {string} baseModelName - Name of the model (e.g., 'User', 'Staff')
 * @returns {Model|null} - Mongoose model or null if not found
 */
const getModel = (baseModelName) => {
  // Model name to collection name mapping
  const modelNameMap = {
    'User': 'users',
    'Staff': 'staff',
    'Settings': 'settings',
    'InventoryItem': 'inventoryitems',
    'InventoryCheckout': 'inventorycheckouts',
    'InventoryLog': 'inventorylogs',
    'POSTransaction': 'postransactions',
    'POSItem': 'positems',
    'Receipt': 'receipts',
    'Category': 'categories',
    'Expense': 'expenses',
    'Invoice': 'invoices',
    'Quotation': 'quotations',
    'OtherRevenue': 'otherrevenues',
    'Account': 'accounts',
    'JournalEntry': 'journalentries',
    'Attendance': 'attendances',
    'AttendanceLog': 'attendancelogs',
    'AttendancePhoto': 'attendancephotos',
    'Shift': 'shifts',
    'LeaveRequest': 'leaverequests',
    'Holiday': 'holidays',
    'Device': 'devices',
    'DeviceCommand': 'devicecommands',
    'Customer': 'customers',
    'Vendor': 'vendors',
    'InvoiceCounter': 'invoicecounters',
    'AuditLog': 'auditlogs',
    'LeavePolicy': 'leavepolicies',
    'LeaveBalance': 'leavebalances'
  };

  try {
    // Check cache first
    if (modelCache.has(baseModelName)) {
      return modelCache.get(baseModelName);
    }

    // Check if model already exists in Mongoose registry
    const collectionName = modelNameMap[baseModelName] || baseModelName.toLowerCase() + 's';

    if (mongoose.models[baseModelName]) {
      modelCache.set(baseModelName, mongoose.models[baseModelName]);
      return mongoose.models[baseModelName];
    }

    // Load the model file
    const baseModelPath = `../models/${baseModelName}`;
    let BaseModel;

    try {
      BaseModel = require(baseModelPath);
    } catch (modelError) {
      logger.warn(`Model ${baseModelName} not found at ${baseModelPath}`, {
        modelName: baseModelName,
        error: modelError.message
      });
      return null;
    }

    // If the model file exports the model directly (mongoose.model())
    if (BaseModel.modelName) {
      modelCache.set(baseModelName, BaseModel);
      return BaseModel;
    }

    // If it exports a schema, create the model
    if (BaseModel.schema) {
      const Model = mongoose.model(baseModelName, BaseModel.schema, collectionName);
      modelCache.set(baseModelName, Model);
      return Model;
    }

    logger.error(`Model ${baseModelName} does not export a valid model or schema`);
    return null;

  } catch (error) {
    logger.error('Failed to get model', {
      baseModelName,
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
    return null;
  }
};

/**
 * Compatibility wrapper - accepts tenantId but ignores it
 * This allows gradual migration of routes without breaking them
 *
 * @param {string} baseModelName - Name of the model
 * @param {string} tenantId - IGNORED (kept for compatibility)
 * @param {string} tenantTier - IGNORED (kept for compatibility)
 * @returns {Model|null} - Mongoose model
 */
const getTenantModel = (baseModelName, tenantId = null, tenantTier = null) => {
  // Ignore tenantId and tenantTier - single tenant system
  return getModel(baseModelName);
};

// Export both for compatibility
module.exports = getTenantModel;
module.exports.getModel = getModel;
module.exports.getTenantModel = getTenantModel;
