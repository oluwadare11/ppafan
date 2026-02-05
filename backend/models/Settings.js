// Multi-Tenant Aware Settings Model for OpSuite Business Management System
const mongoose = require('mongoose');

const settingsSchema = new mongoose.Schema({
  tenantId: { type: String, required: true }, // Index defined separately below
  businessInfo: {
    name: String,
    type: String,
    logo: String,
    primaryColor: { type: String, default: '#2563EB' },
    secondaryColor: { type: String, default: '#10B981' }
  },
  systemSettings: {
    timezone: { type: String, default: 'UTC' },
    currency: { type: String, default: 'NGN' },
    vatRate: { type: Number, default: 7.5 },
    notificationEmails: [String]
  },
  posSettings: {
    enableInventoryDeduction: { type: Boolean, default: true },
    requireCustomerInfo: { type: Boolean, default: false },
    enableDiscounts: { type: Boolean, default: true },
    enableTips: { type: Boolean, default: false },
    enableBarcodeScanning: { type: Boolean, default: false },
    enableReceiptPrinting: { type: Boolean, default: true },
    enableCashDrawer: { type: Boolean, default: false }
  },
  inventorySettings: {
    enableLowStockAlerts: { type: Boolean, default: true },
    lowStockThreshold: { type: Number, default: 10 },
    enableBarcodeScanning: { type: Boolean, default: false },
    enableSupplierManagement: { type: Boolean, default: true },
    enableCostTracking: { type: Boolean, default: true }
  },
  attendanceSettings: {
    workingHours: {
      start: { type: String, default: '08:00' },
      end: { type: String, default: '17:00' }
    },
    workingDays: {
      type: [String],
      default: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
    },
    enableGeoLocation: { type: Boolean, default: false },
    enableBreakTracking: { type: Boolean, default: false },
    enablePhotoCapture: { type: Boolean, default: true },
    graceMinutes: { type: Number, default: 5 }, // Grace period for lateness
    enableOvertimeTracking: { type: Boolean, default: true }
  },
  payrollSettings: {
    currency: { type: String, default: 'NGN' },
    payPeriod: { type: String, enum: ['weekly', 'bi-weekly', 'monthly'], default: 'monthly' },
    enableOvertimePay: { type: Boolean, default: true },
    overtimeMultiplier: { type: Number, default: 1.5 },
    enableBonuses: { type: Boolean, default: true },
    enableDeductions: { type: Boolean, default: true },
    taxRate: { type: Number, default: 0 }, // Default tax rate
    enableAutomaticCalculation: { type: Boolean, default: true }
  },
  emailSettings: {
    enableNotifications: { type: Boolean, default: true },
    primaryNotificationEmail: { type: String, default: '' },
    notificationRecipients: [String],
    enableAttendanceAlerts: { type: Boolean, default: true },
    enableInventoryAlerts: { type: Boolean, default: true },
    enableSalesReports: { type: Boolean, default: false }
  },
  securitySettings: {
    enableTwoFactorAuth: { type: Boolean, default: false },
    sessionTimeout: { type: Number, default: 480 }, // minutes
    enableLoginAudit: { type: Boolean, default: true },
    enableDataBackup: { type: Boolean, default: true }
  },
  integrationSettings: {
    enableApiAccess: { type: Boolean, default: false },
    webhookUrl: String,
    enableThirdPartySync: { type: Boolean, default: false }
  },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
}, {
  timestamps: true
});

// TENANT ISOLATION INDEXES
settingsSchema.index({ tenantId: 1 }); // Primary tenant lookup
settingsSchema.index({ tenantId: 1, 'businessInfo.name': 1 });

// Pre-save middleware for tenant validation
settingsSchema.pre('save', function(next) {
  // Ensure tenantId is set
  if (!this.tenantId) {
    return next(new Error('TenantId is required for settings records'));
  }
  
  // Validate color formats
  const colorRegex = /^#[0-9A-F]{6}$/i;
  if (this.businessInfo.primaryColor && !colorRegex.test(this.businessInfo.primaryColor)) {
    return next(new Error('Invalid primary color format. Use hex format (#RRGGBB)'));
  }
  if (this.businessInfo.secondaryColor && !colorRegex.test(this.businessInfo.secondaryColor)) {
    return next(new Error('Invalid secondary color format. Use hex format (#RRGGBB)'));
  }
  
  // Validate numeric ranges
  if (this.systemSettings.vatRate && (this.systemSettings.vatRate < 0 || this.systemSettings.vatRate > 100)) {
    return next(new Error('VAT rate must be between 0 and 100'));
  }
  if (this.payrollSettings.overtimeMultiplier && this.payrollSettings.overtimeMultiplier < 1) {
    return next(new Error('Overtime multiplier must be at least 1.0'));
  }
  if (this.attendanceSettings.graceMinutes && this.attendanceSettings.graceMinutes < 0) {
    return next(new Error('Grace minutes cannot be negative'));
  }
  
  next();
});

// Static method to get or create default settings for tenant
settingsSchema.statics.getOrCreateDefaults = async function(tenantId) {
  try {
    let settings = await this.findOne({ tenantId });
    
    if (!settings) {
      settings = new this({
        tenantId,
        businessInfo: {
          name: 'My Business',
          type: 'general',
          primaryColor: '#2563EB',
          secondaryColor: '#10B981'
        }
      });
      await settings.save();
    }
    
    return settings;
  } catch (error) {
    console.error('Error getting/creating default settings:', error);
    throw error;
  }
};

// Static method to update settings section
settingsSchema.statics.updateSection = async function(tenantId, section, updates) {
  try {
    const updateQuery = {};
    Object.keys(updates).forEach(key => {
      updateQuery[`${section}.${key}`] = updates[key];
    });
    
    const settings = await this.findOneAndUpdate(
      { tenantId },
      { $set: updateQuery },
      { new: true, upsert: true }
    );
    
    return settings;
  } catch (error) {
    console.error('Error updating settings section:', error);
    throw error;
  }
};

// Instance method to get section
settingsSchema.methods.getSection = function(section) {
  return this[section] || {};
};

// Instance method to validate email settings
settingsSchema.methods.validateEmailSettings = function() {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const errors = [];
  
  if (this.emailSettings.notificationRecipients) {
    this.emailSettings.notificationRecipients.forEach((email, index) => {
      if (!emailRegex.test(email)) {
        errors.push(`Invalid email at index ${index}: ${email}`);
      }
    });
  }
  
  if (this.systemSettings.notificationEmails) {
    this.systemSettings.notificationEmails.forEach((email, index) => {
      if (!emailRegex.test(email)) {
        errors.push(`Invalid notification email at index ${index}: ${email}`);
      }
    });
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
};

// Post-save middleware for logging
settingsSchema.post('save', function(doc) {
  if (process.env.NODE_ENV === 'development') {
    console.log('SETTINGS SAVED:', {
      tenantId: doc.tenantId,
      businessName: doc.businessInfo?.name,
      updatedAt: doc.updatedAt
    });
  }
});

// FIXED: Export schema for getTenantModel utility
module.exports = { schema: settingsSchema };

// Factory function for tenant-specific settings model
module.exports.createSettingsModel = (tenantId) => {
  const collectionName = `settings_${tenantId}`;

  // Check if model already exists and return it
  if (mongoose.models[collectionName]) {
    return mongoose.models[collectionName];
  }

  // Create a fresh schema copy to avoid any caching issues
  const freshSchema = settingsSchema.clone();

  // Create new model for this tenant
  return mongoose.model(collectionName, freshSchema, collectionName);
};