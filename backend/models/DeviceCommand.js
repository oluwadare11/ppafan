const mongoose = require('mongoose');

const deviceCommandSchema = new mongoose.Schema({
  deviceSN: {
    type: String,
    required: true,
    uppercase: true,
    index: true
  },
  commandId: {
    type: Number,
    required: true,
    unique: true,
    index: true
  },
  commandType: {
    type: String,
    required: true,
    enum: [
      'ADD_USER',
      'DELETE_USER',
      'ENROLL_FP',
      'ENROLL_FACE',
      'UPLOAD_FP',
      'UPLOAD_FACE',
      'UPLOAD_USERPIC',
      'REBOOT',
      'CLEAR_ALL_USERS',
      'CHECK',
      'SYNC_TIME',
      'GET_OPTION',
      'SET_OPTION',
      'QUERY_USERINFO',
      'QUERY_ATT_LOG',
      'INFO',
      'CLEAR_DATA',
      'DATA_QUERY'
    ]
  },
  rawCommand: {
    type: String,
    required: true
  },
  parameters: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  status: {
    type: String,
    required: true,
    enum: ['pending', 'sent', 'acknowledged', 'failed', 'expired'],
    default: 'pending',
    index: true
  },
  returnCode: {
    type: Number,
    default: null
  },
  deviceResponse: {
    type: String,
    default: null
  },
  retryCount: {
    type: Number,
    default: 0
  },
  maxRetries: {
    type: Number,
    default: 3
  },
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  sentAt: {
    type: Date,
    default: null
  },
  acknowledgedAt: {
    type: Date,
    default: null
  },
  expiresAt: {
    type: Date,
    index: true
  },
  tenantId: {
    type: String,
    required: true,
    index: true
  },
  createdBy: {
    type: String,
    required: true
  }
}, {
  timestamps: true,
  collection: 'devicecommands'
});

// Compound indexes for efficient queries
deviceCommandSchema.index({ deviceSN: 1, status: 1, tenantId: 1 });
deviceCommandSchema.index({ commandId: 1, tenantId: 1 });
deviceCommandSchema.index({ tenantId: 1, status: 1, createdAt: -1 });

// Pre-save hook to set expiresAt if not provided
deviceCommandSchema.pre('save', function(next) {
  if (!this.expiresAt && this.isNew) {
    // Set expiration to 5 minutes from creation
    this.expiresAt = new Date(this.createdAt.getTime() + 5 * 60 * 1000);
  }
  next();
});

// Instance Methods

// Mark command as sent
deviceCommandSchema.methods.markAsSent = function() {
  this.status = 'sent';
  this.sentAt = new Date();
  return this.save();
};

// Mark command as acknowledged
deviceCommandSchema.methods.markAsAcknowledged = function(returnCode, response) {
  this.returnCode = returnCode;
  this.deviceResponse = response;
  this.status = returnCode === 0 ? 'acknowledged' : 'failed';
  this.acknowledgedAt = new Date();
  return this.save();
};

// Mark command as failed
deviceCommandSchema.methods.markAsFailed = function(reason) {
  this.status = 'failed';
  this.deviceResponse = reason;
  this.acknowledgedAt = new Date();
  return this.save();
};

// Increment retry count
deviceCommandSchema.methods.incrementRetry = async function() {
  this.retryCount += 1;

  if (this.retryCount >= this.maxRetries) {
    this.status = 'failed';
    this.deviceResponse = 'Max retries exceeded';
  } else {
    // Reset to pending for retry
    this.status = 'pending';
    this.sentAt = null;
  }

  return this.save();
};

// Check if command is expired
deviceCommandSchema.methods.isExpired = function() {
  return this.expiresAt && new Date() > this.expiresAt;
};

// Check if command can be retried
deviceCommandSchema.methods.canRetry = function() {
  return this.retryCount < this.maxRetries;
};

// Static Methods

// Get pending commands for a device
deviceCommandSchema.statics.getPendingCommands = function(deviceSN, tenantId, limit = 5) {
  return this.find({
    deviceSN: deviceSN.toUpperCase(),
    tenantId: tenantId,
    status: 'pending'
  })
  .sort({ commandId: 1 })
  .limit(limit);
};

// Clean up expired commands
deviceCommandSchema.statics.cleanupExpiredCommands = async function(tenantId) {
  const now = new Date();

  const result = await this.updateMany(
    {
      tenantId: tenantId,
      status: { $in: ['pending', 'sent'] },
      expiresAt: { $lt: now }
    },
    {
      status: 'expired',
      deviceResponse: 'Command expired'
    }
  );

  return result;
};

// Export schema for getTenantModel pattern (multi-tenancy)
module.exports = { schema: deviceCommandSchema };
