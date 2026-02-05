// Multi-Tenant Aware Attendance Log Model for OpSuite Business Management System
const mongoose = require('mongoose');

const attendanceLogSchema = new mongoose.Schema({
  employeeId: { type: String, required: true },
  timestamp: { type: Date, required: true },
  deviceStatus: { type: String },
  deviceSN: { type: String },
  verificationMethod: { type: String },
  subBusiness: { type: String, default: 'General' },
  rawData: { type: String },
  processed: { type: Boolean, default: false },
  determinedType: { 
    type: String, 
    enum: ['clock-in', 'clock-out', 'ignored', 'manual-entry', 'break', 'lunch'], 
    default: null
  },
  processingNote: { type: String },
  tenantId: { type: String, required: true, index: true },
  createdAt: { type: Date, default: Date.now }
}, { 
  timestamps: true 
});

// ENHANCED INDEXES FOR TENANT ISOLATION
attendanceLogSchema.index({ tenantId: 1, employeeId: 1 });
attendanceLogSchema.index({ tenantId: 1, timestamp: -1 });
attendanceLogSchema.index({ tenantId: 1, processed: 1 });
attendanceLogSchema.index({ tenantId: 1, determinedType: 1 });
attendanceLogSchema.index({ tenantId: 1, deviceSN: 1 });

// PRE-SAVE MIDDLEWARE FOR TENANT VALIDATION
attendanceLogSchema.pre('save', function(next) {
  // Ensure tenantId is set
  if (!this.tenantId) {
    return next(new Error('TenantId is required for attendance log records'));
  }
  
  // Validate timestamp
  if (!this.timestamp) {
    this.timestamp = new Date();
  }
  
  next();
});

// STATIC METHODS FOR TENANT-AWARE QUERIES
attendanceLogSchema.statics.findByEmployee = function(employeeId, tenantId, limit = 20) {
  return this.find({
    employeeId,
    tenantId
  })
    .sort({ timestamp: -1 })
    .limit(limit);
};

attendanceLogSchema.statics.findByDateRange = function(startDate, endDate, tenantId, options = {}) {
  const query = {
    tenantId,
    timestamp: {
      $gte: startDate,
      $lte: endDate
    }
  };
  
  if (options.employeeId) {
    query.employeeId = options.employeeId;
  }
  
  if (options.processed !== undefined) {
    query.processed = options.processed;
  }
  
  if (options.determinedType) {
    query.determinedType = options.determinedType;
  }
  
  return this.find(query).sort({ timestamp: -1 });
};

attendanceLogSchema.statics.findUnprocessed = function(tenantId, limit = 50) {
  return this.find({
    tenantId,
    processed: false
  })
    .sort({ timestamp: 1 })
    .limit(limit);
};

attendanceLogSchema.statics.getRecentLogs = function(tenantId, limit = 10) {
  return this.find({
    tenantId,
    determinedType: { $nin: ['ignored', null] }
  })
    .sort({ timestamp: -1 })
    .limit(limit);
};

// STATIC METHOD FOR LOG STATISTICS
attendanceLogSchema.statics.getLogStats = async function(tenantId, startDate, endDate) {
  try {
    const matchQuery = { tenantId };
    
    if (startDate && endDate) {
      matchQuery.timestamp = {
        $gte: startDate,
        $lte: endDate
      };
    }
    
    const stats = await this.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: null,
          totalLogs: { $sum: 1 },
          processedLogs: {
            $sum: { $cond: ['$processed', 1, 0] }
          },
          clockInLogs: {
            $sum: { $cond: [{ $eq: ['$determinedType', 'clock-in'] }, 1, 0] }
          },
          clockOutLogs: {
            $sum: { $cond: [{ $eq: ['$determinedType', 'clock-out'] }, 1, 0] }
          },
          ignoredLogs: {
            $sum: { $cond: [{ $eq: ['$determinedType', 'ignored'] }, 1, 0] }
          },
          deviceBreakdown: {
            $push: '$deviceSN'
          }
        }
      }
    ]);
    
    if (stats.length === 0) {
      return {
        totalLogs: 0,
        processedLogs: 0,
        clockInLogs: 0,
        clockOutLogs: 0,
        ignoredLogs: 0,
        processingRate: 0,
        deviceBreakdown: {}
      };
    }
    
    const result = stats[0];
    
    // Calculate device breakdown
    const deviceBreakdown = result.deviceBreakdown.reduce((acc, device) => {
      if (device) {
        acc[device] = (acc[device] || 0) + 1;
      }
      return acc;
    }, {});
    
    return {
      totalLogs: result.totalLogs,
      processedLogs: result.processedLogs,
      clockInLogs: result.clockInLogs,
      clockOutLogs: result.clockOutLogs,
      ignoredLogs: result.ignoredLogs,
      processingRate: result.totalLogs > 0 ? (result.processedLogs / result.totalLogs * 100).toFixed(1) : 0,
      deviceBreakdown
    };
  } catch (error) {
    console.error('Error calculating log stats:', error);
    return {
      totalLogs: 0,
      processedLogs: 0,
      clockInLogs: 0,
      clockOutLogs: 0,
      ignoredLogs: 0,
      processingRate: 0,
      deviceBreakdown: {}
    };
  }
};

// POST-SAVE MIDDLEWARE FOR LOGGING
attendanceLogSchema.post('save', function(doc) {
  if (process.env.NODE_ENV === 'development') {
    console.log('ATTENDANCE LOG SAVED:', {
      tenantId: doc.tenantId,
      employeeId: doc.employeeId,
      timestamp: doc.timestamp,
      determinedType: doc.determinedType,
      processed: doc.processed
    });
  }
});

// FIXED: Create tenant-specific model factory - ALIGNED WITH MIDDLEWARE NAMING
const createAttendanceLogModel = (tenantId) => {
  const collectionName = `attendancelog_${tenantId}`;
  
  // Check if model already exists
  if (mongoose.models[collectionName]) {
    return mongoose.models[collectionName];
  }
  
  // Create new model for this tenant
  return mongoose.model(collectionName, attendanceLogSchema, collectionName);
};


module.exports = { schema: attendanceLogSchema };