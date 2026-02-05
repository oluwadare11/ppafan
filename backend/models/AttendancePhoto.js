// Multi-Tenant Aware Attendance Photo Model for OpSuite Business Management System
const mongoose = require('mongoose');

const attendancePhotoSchema = new mongoose.Schema({
  employeeId: { 
    type: String, 
    required: true,
    index: true
  },
  timestamp: { 
    type: Date, 
    required: true,
    index: true
  },
  filename: { 
    type: String, 
    required: true 
  },
  photoData: { 
    type: Buffer, 
    required: true 
  },
  size: { 
    type: Number, 
    required: true 
  },
  deviceSN: { 
    type: String,
    index: true
  },
  deviceId: { 
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Device'
  },
  deviceName: { 
    type: String 
  },
  processed: { 
    type: Boolean, 
    default: false,
    index: true
  },
  processingNote: { 
    type: String 
  },
  photoType: {
    type: String,
    enum: ['clock-in', 'clock-out', 'verification', 'manual'],
    default: 'verification'
  },
  quality: {
    type: String,
    enum: ['poor', 'fair', 'good', 'excellent'],
    default: 'good'
  },
  
  // Analysis metadata (if AI photo analysis is enabled)
  analysis: {
    faceDetected: { type: Boolean, default: false },
    confidence: { type: Number, min: 0, max: 100 },
    matchedEmployee: { type: String },
    matchConfidence: { type: Number, min: 0, max: 100 },
    analysisTimestamp: { type: Date },
    analysisNote: { type: String }
  },
  
  // TENANT ISOLATION
  tenantId: { 
    type: String, 
    required: true, 
    index: true 
  }
}, { 
  timestamps: true 
});

// ENHANCED TENANT ISOLATION INDEXES
attendancePhotoSchema.index({ tenantId: 1, employeeId: 1, timestamp: -1 });
attendancePhotoSchema.index({ tenantId: 1, deviceSN: 1, timestamp: -1 });
attendancePhotoSchema.index({ tenantId: 1, processed: 1 });
attendancePhotoSchema.index({ tenantId: 1, photoType: 1 });
attendancePhotoSchema.index({ tenantId: 1, timestamp: -1 }); // For recent photos query
attendancePhotoSchema.index({ tenantId: 1, quality: 1 });

// Pre-save middleware for tenant isolation validation
attendancePhotoSchema.pre('save', function(next) {
  // Ensure tenantId is set
  if (!this.tenantId) {
    return next(new Error('TenantId is required for attendance photo records'));
  }
  
  // Validate photo data
  if (!this.photoData || this.photoData.length === 0) {
    return next(new Error('Photo data is required'));
  }
  
  // Set size if not already set
  if (!this.size) {
    this.size = this.photoData.length;
  }
  
  // Validate JPEG format
  if (this.photoData[0] !== 0xFF || this.photoData[1] !== 0xD8) {
    console.warn(`Warning: Photo ${this.filename} may not be valid JPEG format for tenant ${this.tenantId}`);
  }
  
  next();
});

// Virtual for photo size in KB/MB
attendancePhotoSchema.virtual('sizeFormatted').get(function() {
  if (this.size < 1024) {
    return `${this.size} bytes`;
  } else if (this.size < 1024 * 1024) {
    return `${(this.size / 1024).toFixed(1)} KB`;
  } else {
    return `${(this.size / (1024 * 1024)).toFixed(1)} MB`;
  }
});

// Virtual for base64 data URL (for frontend display)
attendancePhotoSchema.virtual('dataUrl').get(function() {
  if (this.photoData) {
    const base64 = this.photoData.toString('base64');
    return `data:image/jpeg;base64,${base64}`;
  }
  return null;
});

// Method to get photo as buffer for serving
attendancePhotoSchema.methods.getPhotoBuffer = function() {
  return this.photoData;
};

// Method to validate photo quality
attendancePhotoSchema.methods.validatePhotoQuality = function() {
  // Basic validation based on file size and format
  if (this.size < 1024) {
    this.quality = 'poor';
    return 'Photo too small';
  } else if (this.size > 5 * 1024 * 1024) {
    this.quality = 'poor';
    return 'Photo too large';
  } else if (this.photoData[0] !== 0xFF || this.photoData[1] !== 0xD8) {
    this.quality = 'poor';
    return 'Invalid JPEG format';
  } else if (this.size > 100 * 1024) {
    this.quality = 'excellent';
    return 'High quality photo';
  } else if (this.size > 50 * 1024) {
    this.quality = 'good';
    return 'Good quality photo';
  } else {
    this.quality = 'fair';
    return 'Acceptable quality photo';
  }
};

// Static method to get photos for employee in date range
attendancePhotoSchema.statics.getEmployeePhotos = function(employeeId, startDate, endDate, tenantId) {
  const query = {
    employeeId: employeeId,
    tenantId: tenantId,
    timestamp: {
      $gte: startDate,
      $lte: endDate
    }
  };
  
  return this.find(query)
    .select('employeeId timestamp filename size deviceSN photoType quality processed')
    .sort({ timestamp: -1 });
};

// Static method to get recent photos for tenant
attendancePhotoSchema.statics.getRecentPhotos = function(tenantId, limit = 10) {
  return this.find({ 
    tenantId: tenantId,
    processed: true 
  })
    .select('employeeId timestamp filename size deviceSN photoType quality')
    .sort({ timestamp: -1 })
    .limit(limit);
};

// Static method to get unprocessed photos
attendancePhotoSchema.statics.getUnprocessedPhotos = function(tenantId, limit = 50) {
  return this.find({
    tenantId: tenantId,
    processed: false
  })
    .sort({ timestamp: 1 })
    .limit(limit);
};

// Static method to get photos by device
attendancePhotoSchema.statics.getPhotosByDevice = function(deviceSN, tenantId, startDate, endDate) {
  const query = {
    deviceSN: deviceSN,
    tenantId: tenantId
  };
  
  if (startDate && endDate) {
    query.timestamp = {
      $gte: startDate,
      $lte: endDate
    };
  }
  
  return this.find(query)
    .select('employeeId timestamp filename size photoType quality processed')
    .sort({ timestamp: -1 });
};

// Static method to get photo statistics for tenant
attendancePhotoSchema.statics.getPhotoStats = async function(tenantId, startDate, endDate) {
  try {
    const matchQuery = { tenantId: tenantId };
    
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
          totalPhotos: { $sum: 1 },
          totalSize: { $sum: '$size' },
          processedPhotos: {
            $sum: { $cond: ['$processed', 1, 0] }
          },
          avgSize: { $avg: '$size' },
          qualityStats: {
            $push: '$quality'
          },
          deviceStats: {
            $push: '$deviceSN'
          }
        }
      }
    ]);
    
    if (stats.length === 0) {
      return {
        totalPhotos: 0,
        totalSize: 0,
        processedPhotos: 0,
        avgSize: 0,
        qualityBreakdown: {},
        deviceBreakdown: {},
        totalSizeFormatted: '0 bytes'
      };
    }
    
    const result = stats[0];
    
    // Calculate quality breakdown
    const qualityBreakdown = result.qualityStats.reduce((acc, quality) => {
      acc[quality] = (acc[quality] || 0) + 1;
      return acc;
    }, {});
    
    // Calculate device breakdown
    const deviceBreakdown = result.deviceStats.reduce((acc, device) => {
      if (device) {
        acc[device] = (acc[device] || 0) + 1;
      }
      return acc;
    }, {});
    
    // Format total size
    let totalSizeFormatted;
    if (result.totalSize < 1024 * 1024) {
      totalSizeFormatted = `${(result.totalSize / 1024).toFixed(1)} KB`;
    } else {
      totalSizeFormatted = `${(result.totalSize / (1024 * 1024)).toFixed(1)} MB`;
    }
    
    return {
      totalPhotos: result.totalPhotos,
      totalSize: result.totalSize,
      processedPhotos: result.processedPhotos,
      avgSize: Math.round(result.avgSize),
      qualityBreakdown,
      deviceBreakdown,
      totalSizeFormatted,
      processingRate: result.totalPhotos > 0 ? (result.processedPhotos / result.totalPhotos * 100).toFixed(1) : 0
    };
  } catch (error) {
    console.error('Error calculating photo stats:', error);
    return {
      totalPhotos: 0,
      totalSize: 0,
      processedPhotos: 0,
      avgSize: 0,
      qualityBreakdown: {},
      deviceBreakdown: {},
      totalSizeFormatted: '0 bytes',
      processingRate: 0
    };
  }
};

// Static method to cleanup old photos (for maintenance)
attendancePhotoSchema.statics.cleanupOldPhotos = async function(tenantId, daysToKeep = 90) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
  
  try {
    const result = await this.deleteMany({
      tenantId: tenantId,
      timestamp: { $lt: cutoffDate },
      processed: true
    });
    
    console.log(`Cleaned up ${result.deletedCount} old photos for tenant ${tenantId}`);
    return result.deletedCount;
  } catch (error) {
    console.error('Error cleaning up old photos:', error);
    throw error;
  }
};

// Post-save middleware for logging
attendancePhotoSchema.post('save', function(doc) {
  if (process.env.NODE_ENV === 'development') {
    console.log('ATTENDANCE PHOTO SAVED:', {
      tenantId: doc.tenantId,
      employeeId: doc.employeeId,
      timestamp: doc.timestamp,
      size: doc.sizeFormatted,
      device: doc.deviceSN,
      quality: doc.quality
    });
  }
});

// FIXED: Create tenant-specific model factory - ALIGNED WITH MIDDLEWARE NAMING
const createAttendancePhotoModel = (tenantId) => {
  const collectionName = `attendancephoto_${tenantId}`;
  
  // Check if model already exists
  if (mongoose.models[collectionName]) {
    return mongoose.models[collectionName];
  }
  
  // Create new model for this tenant
  return mongoose.model(collectionName, attendancePhotoSchema, collectionName);
};

module.exports = { schema: attendancePhotoSchema };