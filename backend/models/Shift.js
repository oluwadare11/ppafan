// Multi-Tenant Aware Shift Model for OpSuite Business Management System
const mongoose = require('mongoose');

const shiftSchema = new mongoose.Schema({
  staffId: { 
    type: mongoose.Schema.Types.ObjectId, 
    required: true,
    ref: 'Staff'
  },
  dayOfWeek: { 
    type: String, 
    required: true,
    enum: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
  },
  resumptionTime: { 
    type: String, 
    required: true,
    validate: {
      validator: function(v) {
        return /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(v);
      },
      message: 'Invalid time format. Use HH:mm format (e.g., 09:00)'
    }
  },
  closingTime: { 
    type: String, 
    required: true,
    validate: {
      validator: function(v) {
        return /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(v);
      },
      message: 'Invalid time format. Use HH:mm format (e.g., 17:00)'
    }
  },
  breakDuration: { 
    type: Number, 
    default: 60,
    min: 0,
    max: 480
  },
  isActive: { 
    type: Boolean, 
    default: true 
  },
  notes: { 
    type: String, 
    maxlength: 500 
  },
  
  tenantId: { 
    type: String, 
    required: true, 
    index: true 
  },
  
  createdBy: { 
    type: String,
    required: true 
  },
  updatedBy: { 
    type: String 
  }
}, { 
  timestamps: true 
});

// INDEXES
shiftSchema.index({ tenantId: 1, staffId: 1, dayOfWeek: 1 }, { unique: true });
shiftSchema.index({ tenantId: 1, dayOfWeek: 1 });
shiftSchema.index({ tenantId: 1, isActive: 1 });

// PRE-SAVE MIDDLEWARE
shiftSchema.pre('save', function(next) {
  if (!this.tenantId) {
    return next(new Error('TenantId is required for shift records'));
  }
  
  const [startHour, startMinute] = this.resumptionTime.split(':').map(Number);
  const [endHour, endMinute] = this.closingTime.split(':').map(Number);
  const startMinutes = startHour * 60 + startMinute;
  const endMinutes = endHour * 60 + endMinute;
  
  if (startMinutes >= endMinutes) {
    return next(new Error('Resumption time must be before closing time'));
  }
  
  if (!this.isNew && this.isModified() && !this.updatedBy) {
    this.updatedBy = 'system';
  }
  
  next();
});

// VIRTUALS
shiftSchema.virtual('durationHours').get(function() {
  const [startHour, startMinute] = this.resumptionTime.split(':').map(Number);
  const [endHour, endMinute] = this.closingTime.split(':').map(Number);
  const startMinutes = startHour * 60 + startMinute;
  const endMinutes = endHour * 60 + endMinute;
  const durationMinutes = endMinutes - startMinutes;
  return Math.round((durationMinutes / 60) * 100) / 100;
});

shiftSchema.virtual('workDurationHours').get(function() {
  const totalDuration = this.durationHours;
  const breakHours = this.breakDuration / 60;
  return Math.round((totalDuration - breakHours) * 100) / 100;
});

// INSTANCE METHODS
shiftSchema.methods.isActiveOnDate = function(date) {
  const dayOfWeek = new Date(date).toLocaleString('en-US', { weekday: 'long', timeZone: 'UTC' });
  return this.isActive && this.dayOfWeek === dayOfWeek;
};

// STATIC METHODS
shiftSchema.statics.getStaffShifts = function(staffId, tenantId) {
  return this.find({
    staffId: staffId,
    tenantId: tenantId,
    isActive: true
  }).sort({ dayOfWeek: 1 });
};

shiftSchema.statics.getShiftsForDay = function(dayOfWeek, tenantId) {
  return this.find({
    dayOfWeek: dayOfWeek,
    tenantId: tenantId,
    isActive: true
  });
};

shiftSchema.statics.getShiftSummary = async function(tenantId) {
  try {
    const summary = await this.aggregate([
      { $match: { tenantId: tenantId, isActive: true } },
      {
        $group: {
          _id: '$dayOfWeek',
          count: { $sum: 1 },
          avgDuration: { $avg: { $subtract: [
            { $add: [
              { $multiply: [{ $toInt: { $substr: ['$closingTime', 0, 2] } }, 60] },
              { $toInt: { $substr: ['$closingTime', 3, 2] } }
            ]},
            { $add: [
              { $multiply: [{ $toInt: { $substr: ['$resumptionTime', 0, 2] } }, 60] },
              { $toInt: { $substr: ['$resumptionTime', 3, 2] } }
            ]}
          ]}}
        }
      },
      { $sort: { _id: 1 } }
    ]);
    
    return summary.map(day => ({
      dayOfWeek: day._id,
      staffCount: day.count,
      avgDurationHours: Math.round((day.avgDuration / 60) * 100) / 100
    }));
  } catch (error) {
    console.error('Error getting shift summary:', error);
    return [];
  }
};

shiftSchema.statics.detectConflicts = async function(staffId, dayOfWeek, resumptionTime, closingTime, tenantId, excludeId = null) {
  const query = {
    staffId: staffId,
    dayOfWeek: dayOfWeek,
    tenantId: tenantId,
    isActive: true
  };
  
  if (excludeId) {
    query._id = { $ne: excludeId };
  }
  
  const existingShifts = await this.find(query);
  
  const [newStartHour, newStartMinute] = resumptionTime.split(':').map(Number);
  const [newEndHour, newEndMinute] = closingTime.split(':').map(Number);
  const newStartMinutes = newStartHour * 60 + newStartMinute;
  const newEndMinutes = newEndHour * 60 + newEndMinute;
  
  for (const shift of existingShifts) {
    const [existingStartHour, existingStartMinute] = shift.resumptionTime.split(':').map(Number);
    const [existingEndHour, existingEndMinute] = shift.closingTime.split(':').map(Number);
    const existingStartMinutes = existingStartHour * 60 + existingStartMinute;
    const existingEndMinutes = existingEndHour * 60 + existingEndMinute;
    
    if (newStartMinutes < existingEndMinutes && newEndMinutes > existingStartMinutes) {
      return {
        hasConflict: true,
        conflictingShift: shift,
        message: `Shift conflicts with existing shift: ${shift.resumptionTime}-${shift.closingTime}`
      };
    }
  }
  
  return { hasConflict: false };
};

// POST-SAVE MIDDLEWARE
shiftSchema.post('save', function(doc) {
  if (process.env.NODE_ENV === 'development') {
    console.log('SHIFT SAVED:', {
      tenantId: doc.tenantId,
      staffId: doc.staffId,
      dayOfWeek: doc.dayOfWeek,
      schedule: `${doc.resumptionTime}-${doc.closingTime}`,
      duration: `${doc.durationHours}h`
    });
  }
});

// CRITICAL: Export schema only, no auto-registration
module.exports = { schema: shiftSchema };