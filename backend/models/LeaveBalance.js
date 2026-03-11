const mongoose = require('mongoose');

// Leave Balance tracks each employee's leave days per type per year.
// Created/updated by the recalculate endpoint; manually adjustable by admins.
const leaveBalanceSchema = new mongoose.Schema({
  tenantId:   { type: String, required: true, index: true },
  employeeId: { type: String, required: true, index: true },
  staffId:    { type: mongoose.Schema.Types.ObjectId },
  staffName:  { type: String, default: '' }, // denormalised for display

  year:      { type: Number, required: true },
  leaveType: {
    type: String,
    required: true,
    enum: ['annual', 'sick', 'maternity', 'paternity', 'casual', 'emergency', 'compassionate', 'study', 'unpaid', 'other']
  },

  // Days breakdown
  entitledDays:    { type: Number, default: 0, min: 0 }, // from policy
  carriedOverDays: { type: Number, default: 0, min: 0 }, // from previous year
  usedDays:        { type: Number, default: 0, min: 0 }, // approved & taken
  pendingDays:     { type: Number, default: 0, min: 0 }, // pending approval
  adjustmentDays:  { type: Number, default: 0 },          // manual admin override (can be negative)

  lastUpdated: { type: Date, default: Date.now }
}, {
  timestamps: true
});

// availableDays virtual: entitled + carriedOver - used - pending + adjustment
leaveBalanceSchema.virtual('availableDays').get(function () {
  return (
    (this.entitledDays    || 0) +
    (this.carriedOverDays || 0) -
    (this.usedDays        || 0) -
    (this.pendingDays     || 0) +
    (this.adjustmentDays  || 0)
  );
});

leaveBalanceSchema.set('toJSON',   { virtuals: true });
leaveBalanceSchema.set('toObject', { virtuals: true });

leaveBalanceSchema.index({ tenantId: 1, employeeId: 1, year: 1 });
leaveBalanceSchema.index(
  { tenantId: 1, employeeId: 1, year: 1, leaveType: 1 },
  { unique: true }
);

module.exports = { schema: leaveBalanceSchema };
