// models/AuditLog.js - Super Admin Audit Trail Model
const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema({
  // Who performed the action
  actor: {
    type: {
      type: String,
      enum: ['super_admin', 'system', 'webhook'],
      required: true
    },
    id: { type: mongoose.Schema.Types.ObjectId },
    username: { type: String },
    email: { type: String },
    ip: { type: String }
  },

  // What action was performed
  action: {
    type: String,
    required: true,
    enum: [
      // Authentication
      'LOGIN', 'LOGIN_FAILED', 'LOGOUT', 'MFA_SETUP', 'MFA_VERIFY', 'PASSWORD_CHANGE',
      'SESSION_REVOKE', 'SESSION_REVOKE_ALL',

      // Tenant Management
      'TENANT_CREATE', 'TENANT_UPDATE', 'TENANT_STATUS_CHANGE', 'TENANT_DELETE',
      'TENANT_ARCHIVE', 'TENANT_RESTORE',

      // Subscription Management
      'SUBSCRIPTION_UPGRADE', 'SUBSCRIPTION_DOWNGRADE', 'SUBSCRIPTION_CANCEL',
      'SUBSCRIPTION_REACTIVATE', 'TRIAL_EXTEND',

      // User Management
      'USER_CREATE', 'USER_UPDATE', 'USER_DELETE', 'USER_STATUS_CHANGE',
      'USER_PASSWORD_RESET', 'USER_BULK_UPDATE', 'USER_BULK_DELETE',
      'USER_IMPERSONATE',

      // Security
      'IP_WHITELIST_ADD', 'IP_WHITELIST_REMOVE', 'IP_ANYWHERE_TOGGLE',
      'SECURITY_ALERT',

      // System
      'SYSTEM_CONFIG_CHANGE', 'EXPORT_DATA', 'VIEW_SENSITIVE_DATA'
    ],
    index: true
  },

  // What resource was affected
  resource: {
    type: {
      type: String,
      enum: ['tenant', 'user', 'subscription', 'session', 'system', 'security'],
      required: true
    },
    id: { type: String },
    name: { type: String }
  },

  // Target tenant (if applicable)
  targetTenant: {
    tenantId: { type: String, index: true },
    businessName: { type: String }
  },

  // Details of the action
  details: {
    before: { type: mongoose.Schema.Types.Mixed },
    after: { type: mongoose.Schema.Types.Mixed },
    changes: { type: mongoose.Schema.Types.Mixed },
    metadata: { type: mongoose.Schema.Types.Mixed }
  },

  // Result of the action
  result: {
    success: { type: Boolean, required: true },
    error: { type: String },
    errorCode: { type: String }
  },

  // Request information
  request: {
    method: { type: String },
    path: { type: String },
    userAgent: { type: String },
    referer: { type: String }
  },

  // Severity level for filtering
  severity: {
    type: String,
    enum: ['info', 'warning', 'critical'],
    default: 'info',
    index: true
  },

  // Timestamp (indexed via TTL index below)
  timestamp: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: false // We use our own timestamp field
});

// Compound indexes for common queries
auditLogSchema.index({ 'actor.username': 1, timestamp: -1 });
auditLogSchema.index({ action: 1, timestamp: -1 });
auditLogSchema.index({ 'targetTenant.tenantId': 1, timestamp: -1 });
auditLogSchema.index({ severity: 1, timestamp: -1 });

// TTL index - automatically delete logs older than 1 year
auditLogSchema.index({ timestamp: 1 }, { expireAfterSeconds: 365 * 24 * 60 * 60 });

// Static method to log an action
auditLogSchema.statics.log = async function(data) {
  try {
    const log = new this(data);
    await log.save();
    return log;
  } catch (error) {
    console.error('Failed to create audit log:', error.message);
    return null;
  }
};

// Static method to get recent critical events
auditLogSchema.statics.getRecentCritical = function(limit = 10) {
  return this.find({ severity: 'critical' })
    .sort({ timestamp: -1 })
    .limit(limit)
    .lean();
};

// Static method to get activity for a specific tenant
auditLogSchema.statics.getTenantActivity = function(tenantId, limit = 50) {
  return this.find({ 'targetTenant.tenantId': tenantId })
    .sort({ timestamp: -1 })
    .limit(limit)
    .lean();
};

// Static method to get activity for a specific admin
auditLogSchema.statics.getAdminActivity = function(username, limit = 50) {
  return this.find({ 'actor.username': username })
    .sort({ timestamp: -1 })
    .limit(limit)
    .lean();
};

// Static method to get failed login attempts
auditLogSchema.statics.getFailedLogins = function(hours = 24) {
  const since = new Date(Date.now() - hours * 60 * 60 * 1000);
  return this.find({
    action: 'LOGIN_FAILED',
    timestamp: { $gte: since }
  })
    .sort({ timestamp: -1 })
    .lean();
};

module.exports = mongoose.model('AuditLog', auditLogSchema);
