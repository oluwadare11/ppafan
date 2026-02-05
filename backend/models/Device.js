// Multi-Tenant Aware Device Model for OpSuite Business Management System
const mongoose = require('mongoose');
const crypto = require('crypto');

const deviceSchema = new mongoose.Schema({
  name: { 
    type: String, 
    required: true,
    trim: true,
    maxlength: 100
  },
  serialNumber: { 
    type: String, 
    required: true,
    uppercase: true,
    trim: true,
    maxlength: 50
  },
  deviceKey: {
    type: String,
    required: true,
    default: '0',
    validate: {
      validator: function(v) {
        // ZKTeco COMM KEY can be any number from 0 to 999999
        const num = parseInt(v, 10);
        return !isNaN(num) && num >= 0 && num <= 999999;
      },
      message: 'Device key must be a number between 0 and 999999'
    }
  },
  deviceType: {
    type: String,
    enum: ['fingerprint', 'face', 'card', 'hybrid'],
    default: 'fingerprint'
  },
  location: { 
    type: String,
    trim: true,
    maxlength: 200
  },
  description: { 
    type: String,
    maxlength: 500
  },
  ipAddress: { 
    type: String,
    validate: {
      validator: function(v) {
        if (!v) return true; // IP is optional
        // Basic IP validation
        return /^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/.test(v);
      },
      message: 'Invalid IP address format'
    }
  },
  port: { 
    type: Number,
    min: 1,
    max: 65535,
    default: 4370
  },
  
  // Device Status and Health
  isActive: { 
    type: Boolean, 
    default: true 
  },
  status: {
    type: String,
    enum: ['online', 'offline', 'maintenance', 'error'],
    default: 'offline'
  },
  lastSeen: { 
    type: Date,
    index: true
  },
  firmwareVersion: { 
    type: String 
  },
  
  // Device Configuration
  settings: {
    timeZone: { 
      type: String, 
      default: 'Africa/Lagos' 
    },
    workCodes: [{
      code: { type: String, required: true },
      name: { type: String, required: true },
      isActive: { type: Boolean, default: true }
    }],
    verificationModes: [{
      type: String,
      enum: ['fingerprint', 'face', 'card', 'password', 'combination']
    }],
    photoCapture: {
      enabled: { type: Boolean, default: true },
      quality: { 
        type: String, 
        enum: ['low', 'medium', 'high'], 
        default: 'medium' 
      },
      saveOnServer: { type: Boolean, default: true }
    },
    attendance: {
      enableOfflineMode: { type: Boolean, default: true },
      syncInterval: { type: Number, default: 5 }, // minutes
      maxOfflineRecords: { type: Number, default: 10000 }
    }
  },
  
  // Device Statistics
  statistics: {
    totalScans: { type: Number, default: 0 },
    lastScanTime: { type: Date },
    totalUsers: { type: Number, default: 0 },
    totalPhotos: { type: Number, default: 0 },
    uptime: { type: Number, default: 0 }, // in hours
    lastReboot: { type: Date },
    errorCount: { type: Number, default: 0 },
    lastErrorTime: { type: Date },
    lastErrorMessage: { type: String }
  },
  
  // Connection and Sync Status
  connectionInfo: {
    protocol: { 
      type: String, 
      enum: ['tcp', 'http', 'https'], 
      default: 'http' 
    },
    lastHeartbeat: { type: Date },
    missedHeartbeats: { type: Number, default: 0 },
    connectionStrength: { 
      type: String, 
      enum: ['excellent', 'good', 'fair', 'poor'], 
      default: 'good' 
    }
  },
  
  // TENANT ISOLATION
  tenantId: { 
    type: String, 
    required: true, 
    index: true 
  },
  
  // Management Fields
  createdBy: { 
    type: String, 
    required: true 
  },
  updatedBy: { 
    type: String 
  },
  notes: { 
    type: String,
    maxlength: 1000
  }
}, { 
  timestamps: true 
});

// ENHANCED TENANT ISOLATION INDEXES
deviceSchema.index({ tenantId: 1, serialNumber: 1 }, { unique: true });
deviceSchema.index({ tenantId: 1, isActive: 1 });
deviceSchema.index({ tenantId: 1, status: 1 });
deviceSchema.index({ tenantId: 1, location: 1 });
deviceSchema.index({ tenantId: 1, deviceType: 1 });

// Pre-save middleware for tenant isolation validation
deviceSchema.pre('save', function(next) {
  // Ensure tenantId is set
  if (!this.tenantId) {
    return next(new Error('TenantId is required for device records'));
  }
  
  // Ensure serialNumber is uppercase
  if (this.serialNumber) {
    this.serialNumber = this.serialNumber.toUpperCase();
  }
  
  // Generate device key if not set
  if (!this.deviceKey) {
    this.deviceKey = this.generateDeviceKey();
  }
  
  // Validate IP and port combination
  if (this.ipAddress && !this.port) {
    this.port = 4370; // Default port
  }
  
  // Set updatedBy on save
  if (!this.isNew && this.isModified() && !this.updatedBy) {
    this.updatedBy = 'system'; // Should be set by routes
  }
  
  next();
});

// Method to generate a secure device key
deviceSchema.methods.generateDeviceKey = function() {
  return crypto.randomBytes(16).toString('hex').toUpperCase();
};

// Method to check if device is online
deviceSchema.methods.isOnline = function() {
  if (!this.lastSeen) return false;
  const now = new Date();
  const timeDiff = now - this.lastSeen;
  return timeDiff < 2 * 60 * 1000; // 2 minutes threshold
};

// Method to update device heartbeat
deviceSchema.methods.updateHeartbeat = function() {
  this.connectionInfo.lastHeartbeat = new Date();
  this.lastSeen = new Date();
  this.status = 'online';
  this.connectionInfo.missedHeartbeats = 0;
  return this.save();
};

// Method to record scan activity
deviceSchema.methods.recordScan = function(employeeId) {
  this.statistics.totalScans = (this.statistics.totalScans || 0) + 1;
  this.statistics.lastScanTime = new Date();
  this.lastSeen = new Date();
  this.status = 'online';
  return this.save();
};

// Method to record photo capture
deviceSchema.methods.recordPhoto = function() {
  this.statistics.totalPhotos = (this.statistics.totalPhotos || 0) + 1;
  this.lastSeen = new Date();
  return this.save();
};

// Method to record error
deviceSchema.methods.recordError = function(errorMessage) {
  this.statistics.errorCount = (this.statistics.errorCount || 0) + 1;
  this.statistics.lastErrorTime = new Date();
  this.statistics.lastErrorMessage = errorMessage;
  this.connectionInfo.missedHeartbeats = (this.connectionInfo.missedHeartbeats || 0) + 1;
  
  // Update connection strength based on error frequency
  if (this.statistics.errorCount > 10) {
    this.connectionInfo.connectionStrength = 'poor';
  } else if (this.statistics.errorCount > 5) {
    this.connectionInfo.connectionStrength = 'fair';
  }
  
  return this.save();
};

// Method to calculate uptime
deviceSchema.methods.calculateUptime = function() {
  if (!this.createdAt) return 0;
  const now = new Date();
  const uptimeMs = now - this.createdAt;
  const uptimeHours = uptimeMs / (1000 * 60 * 60);
  return Math.round(uptimeHours * 100) / 100;
};

// Virtual for connection status
deviceSchema.virtual('connectionStatus').get(function() {
  if (this.isOnline()) {
    return 'Connected';
  } else if (this.lastSeen) {
    const timeDiff = new Date() - this.lastSeen;
    const minutesAgo = Math.floor(timeDiff / (1000 * 60));
    if (minutesAgo < 60) {
      return `Last seen ${minutesAgo} minutes ago`;
    } else {
      const hoursAgo = Math.floor(minutesAgo / 60);
      return `Last seen ${hoursAgo} hours ago`;
    }
  } else {
    return 'Never connected';
  }
});

// Virtual for device health score
deviceSchema.virtual('healthScore').get(function() {
  let score = 100;
  
  // Deduct points for being offline
  if (!this.isOnline()) {
    score -= 30;
  }
  
  // Deduct points for errors
  if (this.statistics.errorCount > 0) {
    score -= Math.min(this.statistics.errorCount * 2, 30);
  }
  
  // Deduct points for missed heartbeats
  if (this.connectionInfo.missedHeartbeats > 0) {
    score -= Math.min(this.connectionInfo.missedHeartbeats * 5, 20);
  }
  
  // Ensure score doesn't go below 0
  return Math.max(0, score);
});

// Static method to get online devices for tenant
deviceSchema.statics.getOnlineDevices = function(tenantId) {
  const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000);
  return this.find({
    tenantId: tenantId,
    isActive: true,
    lastSeen: { $gte: twoMinutesAgo }
  }).sort({ lastSeen: -1 });
};

// Static method to get device statistics for tenant
deviceSchema.statics.getDeviceStats = async function(tenantId) {
  try {
    const stats = await this.aggregate([
      { $match: { tenantId: tenantId, isActive: true } },
      {
        $group: {
          _id: null,
          totalDevices: { $sum: 1 },
          totalScans: { $sum: '$statistics.totalScans' },
          totalPhotos: { $sum: '$statistics.totalPhotos' },
          totalErrors: { $sum: '$statistics.errorCount' },
          deviceTypes: { $push: '$deviceType' },
          locations: { $push: '$location' }
        }
      }
    ]);
    
    if (stats.length === 0) {
      return {
        totalDevices: 0,
        totalScans: 0,
        totalPhotos: 0,
        totalErrors: 0,
        onlineDevices: 0,
        deviceTypeBreakdown: {},
        locationBreakdown: {}
      };
    }
    
    const result = stats[0];
    
    // Count online devices
    const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000);
    const onlineCount = await this.countDocuments({
      tenantId: tenantId,
      isActive: true,
      lastSeen: { $gte: twoMinutesAgo }
    });
    
    // Calculate device type breakdown
    const deviceTypeBreakdown = result.deviceTypes.reduce((acc, type) => {
      acc[type] = (acc[type] || 0) + 1;
      return acc;
    }, {});
    
    // Calculate location breakdown
    const locationBreakdown = result.locations.reduce((acc, location) => {
      if (location) {
        acc[location] = (acc[location] || 0) + 1;
      }
      return acc;
    }, {});
    
    return {
      totalDevices: result.totalDevices,
      totalScans: result.totalScans || 0,
      totalPhotos: result.totalPhotos || 0,
      totalErrors: result.totalErrors || 0,
      onlineDevices: onlineCount,
      deviceTypeBreakdown,
      locationBreakdown
    };
  } catch (error) {
    console.error('Error calculating device stats:', error);
    return {
      totalDevices: 0,
      totalScans: 0,
      totalPhotos: 0,
      totalErrors: 0,
      onlineDevices: 0,
      deviceTypeBreakdown: {},
      locationBreakdown: {}
    };
  }
};

// Static method to find devices by location
deviceSchema.statics.getDevicesByLocation = function(location, tenantId) {
  return this.find({
    location: location,
    tenantId: tenantId,
    isActive: true
  }).sort({ name: 1 });
};

// Static method to clean up inactive devices (for maintenance)
deviceSchema.statics.cleanupInactiveDevices = async function(tenantId, daysInactive = 30) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysInactive);
  
  try {
    const result = await this.updateMany(
      {
        tenantId: tenantId,
        isActive: true,
        $or: [
          { lastSeen: { $lt: cutoffDate } },
          { lastSeen: { $exists: false } }
        ]
      },
      {
        $set: { 
          isActive: false,
          status: 'offline',
          updatedBy: 'system-cleanup'
        }
      }
    );
    
    console.log(`Cleaned up ${result.modifiedCount} inactive devices for tenant ${tenantId}`);
    return result.modifiedCount;
  } catch (error) {
    console.error('Error cleaning up inactive devices:', error);
    throw error;
  }
};

// Post-save middleware for logging
deviceSchema.post('save', function(doc) {
  if (process.env.NODE_ENV === 'development') {
    console.log('DEVICE SAVED:', {
      tenantId: doc.tenantId,
      name: doc.name,
      serialNumber: doc.serialNumber,
      status: doc.status,
      isOnline: doc.isOnline(),
      healthScore: doc.healthScore
    });
  }
});

// Method to validate device configuration
deviceSchema.methods.validateConfiguration = function() {
  const errors = [];
  
  if (!this.name || this.name.trim().length === 0) {
    errors.push('Device name is required');
  }
  
  if (!this.serialNumber || this.serialNumber.trim().length === 0) {
    errors.push('Serial number is required');
  }
  
  if (this.ipAddress && !/^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/.test(this.ipAddress)) {
    errors.push('Invalid IP address format');
  }
  
  if (this.port && (this.port < 1 || this.port > 65535)) {
    errors.push('Port must be between 1 and 65535');
  }
  
  return {
    isValid: errors.length === 0,
    errors: errors
  };
};


module.exports = { schema: deviceSchema };