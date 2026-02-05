// Multi-Tenant Aware Attendance Model for Opsuite Business Management System
const mongoose = require('mongoose');

const leaveSchema = new mongoose.Schema({
  staffId: { type: String, required: true },
  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true },
  leaveType: { type: String, required: true },
  reason: { type: String, required: true },
  status: { type: String, enum: ['Pending', 'Approved', 'Rejected'], default: 'Pending' },
}, { timestamps: true });

const holidaySchema = new mongoose.Schema({
  name: { type: String, required: true },
  date: { type: Date, required: true },
  year: { type: Number, required: true },
}, { timestamps: true });

const attendanceSchema = new mongoose.Schema({
  employeeId: { type: String, required: true },
  date: { type: String, required: true }, // 'YYYY-MM-DD'
  checkIn: { type: Date },
  checkOut: { type: Date },
  late: { type: Boolean, default: false },
  lateMinutes: { type: Number, default: 0 },
  earlyLeave: { type: Boolean, default: false },
  earlyLeaveMinutes: { type: Number, default: 0 },
  absent: { type: Boolean, default: true },
  overtimeHours: { type: Number, default: 0 },
  subBusiness: { type: String, required: true },
  adjustmentNote: { type: String },
  
  checkOutEmailSent: { type: Boolean, default: false },
  
  secondaryClockOutEmailSent: { 
    type: Boolean, 
    default: false,
    description: 'Tracks if the one additional clock-out email has been sent'
  },
  clockOutCount: { 
    type: Number, 
    default: 0,
    description: 'Total number of clock-out attempts for this attendance record'
  },
  firstClockOut: { 
    type: Date,
    description: 'Original clock-out time (for reference, optional)'
  },
  
  clockOutHistory: [{
    timestamp: { type: Date, required: true },
    overtime: { type: Number, default: 0 },
    earlyLeave: { type: Boolean, default: false },
    earlyLeaveMinutes: { type: Number, default: 0 },
    emailSent: { type: Boolean, default: false },
    note: { type: String }
  }],
  
  leaves: [leaveSchema],
  holidays: [holidaySchema],
  
  tenantId: { type: String, required: true, index: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
}, { 
  timestamps: true 
});

// INDEXES
attendanceSchema.index({ tenantId: 1, employeeId: 1, date: 1 }, { unique: true });
attendanceSchema.index({ tenantId: 1, date: 1 });
attendanceSchema.index({ tenantId: 1, employeeId: 1 });
attendanceSchema.index({ tenantId: 1, subBusiness: 1, date: 1 });
attendanceSchema.index({ tenantId: 1, absent: 1, date: 1 });
attendanceSchema.index({ tenantId: 1, late: 1, date: 1 });
attendanceSchema.index({ tenantId: 1, earlyLeave: 1, date: 1 });

// VIRTUALS
attendanceSchema.virtual('workDuration').get(function() {
  if (this.checkIn && this.checkOut) {
    const durationMs = this.checkOut - this.checkIn;
    const hours = Math.floor(durationMs / (1000 * 60 * 60));
    const minutes = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${minutes}m`;
  }
  return null;
});

attendanceSchema.virtual('isMultipleClockOut').get(function() {
  return this.clockOutCount > 1;
});

attendanceSchema.virtual('canSendSecondaryEmail').get(function() {
  return this.clockOutCount > 1 && !this.secondaryClockOutEmailSent;
});

attendanceSchema.virtual('hasDeductions').get(function() {
  return this.late || this.earlyLeave || this.absent;
});

attendanceSchema.virtual('totalDeductionMinutes').get(function() {
  let totalMinutes = 0;
  if (this.late && this.lateMinutes > 0) totalMinutes += this.lateMinutes;
  if (this.earlyLeave && this.earlyLeaveMinutes > 0) totalMinutes += this.earlyLeaveMinutes;
  return totalMinutes;
});

// INSTANCE METHODS
attendanceSchema.methods.addClockOutToHistory = function(timestamp, overtime, earlyLeave, earlyLeaveMinutes, emailSent, note) {
  this.clockOutHistory.push({
    timestamp,
    overtime,
    earlyLeave,
    earlyLeaveMinutes,
    emailSent,
    note: note || `Clock-out #${this.clockOutCount + 1}`
  });
};

attendanceSchema.methods.incrementClockOutCount = function() {
  this.clockOutCount = (this.clockOutCount || 0) + 1;
  
  if (this.clockOutCount === 1 && this.checkOut) {
    this.firstClockOut = this.checkOut;
  }
};

attendanceSchema.methods.calculateDeductionHours = function(settings) {
  let totalHours = 0;
  
  if (this.late && this.lateMinutes > 0) {
    totalHours += Math.ceil(this.lateMinutes / 60);
  }
  
  if (this.earlyLeave && this.earlyLeaveMinutes > 0) {
    totalHours += Math.ceil(this.earlyLeaveMinutes / 60);
  }
  
  return totalHours;
};

attendanceSchema.methods.calculateTotalDeduction = function(settings, dailySalary) {
  let totalDeduction = 0;
  
  if (this.late && this.lateMinutes > 0) {
    const lateHours = Math.ceil(this.lateMinutes / 60);
    totalDeduction += lateHours * settings.latenessPenaltyPerHour;
  }
  
  if (this.earlyLeave && this.earlyLeaveMinutes > 0) {
    const earlyHours = Math.ceil(this.earlyLeaveMinutes / 60);
    totalDeduction += earlyHours * settings.earlyLeavePenaltyPerHour;
  }
  
  if (this.absent) {
    if (settings.absencePenalty === 'full_day') {
      totalDeduction += dailySalary;
    } else if (settings.absencePenalty === 'half_day') {
      totalDeduction += dailySalary / 2;
    } else if (settings.absencePenalty === 'custom') {
      totalDeduction += settings.customAbsencePenalty;
    }
  }
  
  return Math.round(totalDeduction);
};

// STATIC METHODS
attendanceSchema.statics.findByEmployeeAndDateRange = function(employeeId, startDate, endDate, tenantId) {
  return this.find({
    tenantId,
    employeeId,
    date: {
      $gte: startDate,
      $lte: endDate
    }
  }).sort({ date: -1 });
};

attendanceSchema.statics.findMultipleClockOuts = function(startDate, endDate, tenantId) {
  return this.find({
    tenantId,
    clockOutCount: { $gt: 1 },
    date: {
      $gte: startDate,
      $lte: endDate
    }
  }).sort({ date: -1 });
};

attendanceSchema.statics.findWithDeductions = function(startDate, endDate, tenantId, employeeId = null) {
  const query = {
    tenantId,
    date: { $gte: startDate, $lte: endDate },
    $or: [
      { late: true, lateMinutes: { $gt: 0 } },
      { earlyLeave: true, earlyLeaveMinutes: { $gt: 0 } },
      { absent: true }
    ],
    employeeId: { $nin: ['HOLIDAY', /^LEAVE_/] }
  };
  
  if (employeeId) {
    query.employeeId = employeeId;
  }
  
  return this.find(query).sort({ date: -1, employeeId: 1 });
};

attendanceSchema.statics.findWorkingDayRecords = async function(startDate, endDate, tenantId) {
  const allRecords = await this.find({
    tenantId,
    date: { $gte: startDate, $lte: endDate },
    employeeId: { $nin: ['HOLIDAY', /^LEAVE_/] }
  });
  
  return allRecords;
};

// PRE-SAVE MIDDLEWARE
attendanceSchema.pre('save', function(next) {
  if (!this.tenantId) {
    return next(new Error('TenantId is required for attendance records'));
  }
  
  if (this.clockOutCount < 0) {
    this.clockOutCount = 0;
  }
  
  if (this.checkOut && !this.firstClockOut && this.clockOutCount <= 1) {
    this.firstClockOut = this.checkOut;
  }
  
  this.lateMinutes = Math.max(0, this.lateMinutes || 0);
  this.earlyLeaveMinutes = Math.max(0, this.earlyLeaveMinutes || 0);
  this.overtimeHours = Math.max(0, this.overtimeHours || 0);
  
  next();
});

// POST-SAVE MIDDLEWARE
attendanceSchema.post('save', function(doc) {
  if (process.env.NODE_ENV === 'development' && (doc.late || doc.earlyLeave || doc.absent)) {
    console.log('ATTENDANCE SAVED WITH DEDUCTIONS:', {
      tenantId: doc.tenantId,
      employeeId: doc.employeeId,
      date: doc.date,
      late: doc.late,
      lateMinutes: doc.lateMinutes,
      earlyLeave: doc.earlyLeave,
      earlyLeaveMinutes: doc.earlyLeaveMinutes,
      absent: doc.absent
    });
  }
});

// CRITICAL: Export schema only, no auto-registration
module.exports = { schema: attendanceSchema };
