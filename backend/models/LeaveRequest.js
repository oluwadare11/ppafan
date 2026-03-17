const mongoose = require('mongoose');

const leaveRequestSchema = new mongoose.Schema({
  employeeId: {
    type: String,
    required: true,
    index: true
  },
  staffId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Staff',
    required: true
  },
  startDate: {
    type: Date,
    required: true,
    index: true
  },
  endDate: {
    type: Date,
    required: true,
    index: true
  },
  leaveType: {
    type: String,
    required: true,
    enum: ['annual', 'sick', 'maternity', 'paternity', 'casual', 'emergency', 'unpaid', 'other']
  },
  reason: {
    type: String,
    required: true
  },
  status: {
    type: String,
    required: true,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending',
    index: true
  },
  approvedBy: {
    type: String,
    default: null
  },
  approvedAt: {
    type: Date,
    default: null
  },
  rejectionReason: {
    type: String,
    default: null
  },
  totalDays: {
    type: Number,
    required: true
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
  collection: 'leaverequests'
});

// Compound indexes for efficient queries
leaveRequestSchema.index({ tenantId: 1, employeeId: 1, status: 1 });
leaveRequestSchema.index({ tenantId: 1, status: 1, createdAt: -1 });
leaveRequestSchema.index({ tenantId: 1, startDate: 1, endDate: 1 });

// Validation: startDate must be <= endDate
leaveRequestSchema.pre('validate', function(next) {
  if (this.startDate && this.endDate && this.startDate > this.endDate) {
    next(new Error('Start date must be before or equal to end date'));
  } else {
    next();
  }
});

// Instance Methods

// Approve leave request
leaveRequestSchema.methods.approve = function(username) {
  if (this.status !== 'pending') {
    throw new Error('Cannot approve leave request that has already been processed');
  }

  this.status = 'approved';
  this.approvedBy = username;
  this.approvedAt = new Date();
  this.rejectionReason = null;

  return this.save();
};

// Reject leave request
leaveRequestSchema.methods.reject = function(username, reason) {
  if (this.status !== 'pending') {
    throw new Error('Cannot reject leave request that has already been processed');
  }

  if (!reason) {
    throw new Error('Rejection reason is required');
  }

  this.status = 'rejected';
  this.approvedBy = username;
  this.approvedAt = new Date();
  this.rejectionReason = reason;

  return this.save();
};

// Calculate working days (exclude weekends)
leaveRequestSchema.methods.calculateDays = function() {
  let totalDays = 0;
  const current = new Date(this.startDate);
  const end = new Date(this.endDate);

  while (current <= end) {
    const dayOfWeek = current.getDay();
    // Exclude Sunday (0) and Saturday (6)
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      totalDays++;
    }
    current.setDate(current.getDate() + 1);
  }

  return totalDays;
};

// Static Methods

// Get leave requests for a specific employee
leaveRequestSchema.statics.getEmployeeLeaves = function(employeeId, tenantId, status = null) {
  const query = {
    employeeId: employeeId,
    tenantId: tenantId
  };

  if (status) {
    query.status = status;
  }

  return this.find(query).sort({ createdAt: -1 });
};

// Get all pending leave requests for a tenant
leaveRequestSchema.statics.getPendingRequests = function(tenantId) {
  return this.find({
    tenantId: tenantId,
    status: 'pending'
  }).sort({ createdAt: 1 });
};

// Check for overlapping leaves
leaveRequestSchema.statics.checkOverlap = function(employeeId, tenantId, startDate, endDate, excludeId = null) {
  const query = {
    employeeId: employeeId,
    tenantId: tenantId,
    status: { $in: ['pending', 'approved'] },
    $or: [
      {
        startDate: { $lte: endDate },
        endDate: { $gte: startDate }
      }
    ]
  };

  if (excludeId) {
    query._id = { $ne: excludeId };
  }

  return this.findOne(query);
};

// Export schema for getTenantModel pattern (multi-tenancy)
module.exports = { schema: leaveRequestSchema };
