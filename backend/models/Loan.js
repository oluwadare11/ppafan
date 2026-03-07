// PPAfan Attendance System - Loan / Advance Model
// Tracks employee loans and salary advances with monthly payroll deduction.
// Ported and adapted from OPSuite payroll infrastructure.

const mongoose = require('mongoose');

// ============================================
// REPAYMENT SUB-SCHEMA
// ============================================
const repaymentSchema = new mongoose.Schema({
  period:    { type: String, required: true },                  // YYYY-MM
  amount:    { type: Number, required: true },
  date:      { type: Date, default: Date.now },
  payrollId: { type: mongoose.Schema.Types.ObjectId },          // Payroll record that made this deduction
  note:      { type: String, default: '' }
}, { _id: true });

// ============================================
// MAIN LOAN SCHEMA
// ============================================
const loanSchema = new mongoose.Schema({

  // ------------------------------------------
  // TENANT (single-tenant, always 'ppafan')
  // ------------------------------------------
  tenantId: { type: String, required: true, default: 'ppafan' },

  // ------------------------------------------
  // EMPLOYEE REFERENCE
  // ------------------------------------------
  employeeId:     { type: mongoose.Schema.Types.ObjectId, ref: 'Staff', required: true },
  employeeNumber: { type: String, required: true },
  employeeName:   { type: String, required: true },

  // ------------------------------------------
  // LOAN DETAILS
  // ------------------------------------------
  type:             { type: String, enum: ['loan', 'advance'], default: 'loan' },
  description:      { type: String, default: '' },
  originalAmount:   { type: Number, required: true },    // Total amount disbursed
  monthlyDeduction: { type: Number, required: true },    // Fixed monthly deduction from payroll
  remainingBalance: { type: Number, required: true },    // Decreases with each repayment

  // ------------------------------------------
  // TIMELINE
  // ------------------------------------------
  startPeriod:       { type: String, required: true }, // YYYY-MM — first deduction period
  expectedEndPeriod: { type: String, default: '' },    // Estimated payoff period (YYYY-MM)

  // ------------------------------------------
  // REPAYMENT HISTORY
  // ------------------------------------------
  repayments:  { type: [repaymentSchema], default: [] },
  totalRepaid: { type: Number, default: 0 },

  // ------------------------------------------
  // STATUS
  // ------------------------------------------
  status: {
    type: String,
    enum: ['active', 'completed', 'cancelled'],
    default: 'active'
  },

  // ------------------------------------------
  // AUDIT
  // ------------------------------------------
  createdBy: { type: String, default: '' },
  notes:     { type: String, default: '' }

}, { timestamps: true });

// ============================================
// INDEXES
// ============================================
loanSchema.index({ tenantId: 1, employeeNumber: 1, status: 1 });
loanSchema.index({ tenantId: 1, status: 1 });
loanSchema.index({ tenantId: 1, startPeriod: 1 });

// ============================================
// INSTANCE METHODS
// ============================================

// Compute the projected payoff period based on remaining balance and monthly deduction
loanSchema.methods.calculateExpectedEnd = function () {
  if (this.monthlyDeduction <= 0) return '';

  const remainingMonths = Math.ceil(this.remainingBalance / this.monthlyDeduction);
  const alreadyPaid     = this.repayments.length;
  const [year, month]   = this.startPeriod.split('-').map(Number);
  const endDate         = new Date(year, month - 1 + alreadyPaid + remainingMonths, 1);

  return `${endDate.getFullYear()}-${String(endDate.getMonth() + 1).padStart(2, '0')}`;
};

// ============================================
// EXPORT
// ============================================
module.exports = mongoose.model('Loan', loanSchema);
