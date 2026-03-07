// PPAfan Attendance System - Payroll Model
// Single-tenant. Full payroll record per employee per period.
// Ported and adapted from OPSuite payroll infrastructure.

const mongoose = require('mongoose');

// ============================================
// SUB-SCHEMAS
// ============================================

const allowanceSchema = new mongoose.Schema({
  code:             { type: String, required: true },
  name:             { type: String, required: true },
  amount:           { type: Number, default: 0 },
  calculationType:  { type: String, enum: ['fixed', 'percentage'], default: 'fixed' },
  percentageOf:     { type: String, enum: ['basic', 'gross', null], default: null },
  percentageValue:  { type: Number, default: 0 },
  isTaxable:        { type: Boolean, default: true },
  isPensionable:    { type: Boolean, default: false }
}, { _id: false });

const bonusSchema = new mongoose.Schema({
  code:        { type: String, required: true },
  name:        { type: String, required: true },
  amount:      { type: Number, default: 0 },
  description: { type: String, default: '' },
  isTaxable:   { type: Boolean, default: true }
}, { _id: false });

const overtimeBreakdownSchema = new mongoose.Schema({
  type:     { type: String, enum: ['weekday', 'weekend', 'holiday', 'night'], required: true },
  hours:    { type: Number, default: 0 },
  rate:     { type: Number, default: 1 },    // multiplier e.g. 1.5
  baseRate: { type: Number, default: 0 },    // hourly base rate in naira
  amount:   { type: Number, default: 0 }
}, { _id: false });

const deductionBreakdownSchema = new mongoose.Schema({
  date:              { type: String, required: true },  // YYYY-MM-DD
  type:              { type: String, enum: ['lateness', 'early_leave', 'absence', 'unpaid_leave', 'loan', 'advance', 'manual', 'other'], required: true },
  amount:            { type: Number, default: 0 },
  minutes:           { type: Number, default: 0 },
  days:              { type: Number, default: 0 },
  description:       { type: String, default: '' },
  calculationMethod: { type: String, default: '' },
  reference:         { type: String, default: '' }      // loan/advance reference ID
}, { _id: false });

const approvalSchema = new mongoose.Schema({
  stage:          { type: Number, required: true },
  status:         { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
  approvedBy:     { type: String },
  approvedByName: { type: String },
  approvedAt:     { type: Date },
  comments:       { type: String, default: '' }
}, { _id: false });

const loanDeductionSchema = new mongoose.Schema({
  loanId:           { type: mongoose.Schema.Types.ObjectId },
  type:             { type: String, enum: ['loan', 'advance'], required: true },
  description:      { type: String },
  originalAmount:   { type: Number, default: 0 },
  monthlyDeduction: { type: Number, default: 0 },
  balanceBefore:    { type: Number, default: 0 },
  balanceAfter:     { type: Number, default: 0 }
}, { _id: false });

// ============================================
// MAIN PAYROLL SCHEMA
// ============================================

const payrollSchema = new mongoose.Schema({

  // ------------------------------------------
  // TENANT (single-tenant, always 'ppafan')
  // ------------------------------------------
  tenantId: { type: String, required: true, default: 'ppafan' },

  // ------------------------------------------
  // EMPLOYEE IDENTIFICATION
  // ------------------------------------------
  employeeId:     { type: mongoose.Schema.Types.ObjectId, ref: 'Staff', required: true },
  employeeNumber: { type: String, required: true },
  name:           { type: String, required: true },
  firstName:      { type: String, default: '' },
  lastName:       { type: String, default: '' },
  position:       { type: String, default: '' },
  department:     { type: String, default: '' },
  email:          { type: String, default: '' },

  // ------------------------------------------
  // PERIOD & STATUS
  // ------------------------------------------
  period:          { type: String, required: true }, // YYYY-MM
  periodStartDate: { type: String },                 // YYYY-MM-DD
  periodEndDate:   { type: String },                 // YYYY-MM-DD
  status: {
    type: String,
    enum: ['draft', 'generated', 'pending', 'pending_approval', 'approved', 'rejected', 'paid', 'cancelled'],
    default: 'draft'
  },

  // ------------------------------------------
  // SALARY STRUCTURE
  // ------------------------------------------
  salaryStructure: {
    salaryType: { type: String, enum: ['monthly', 'hourly', 'daily', 'contract'], default: 'monthly' },
    baseSalary:  { type: Number, required: true, default: 0 },
    allowances:  { type: [allowanceSchema], default: [] },
    bonuses:     { type: [bonusSchema], default: [] },
    overtime: {
      breakdown:   { type: [overtimeBreakdownSchema], default: [] },
      totalHours:  { type: Number, default: 0 },
      totalAmount: { type: Number, default: 0 }
    },
    leaveEncashment: {
      days:       { type: Number, default: 0 },
      ratePerDay: { type: Number, default: 0 },
      amount:     { type: Number, default: 0 }
    }
  },

  // ------------------------------------------
  // STATUTORY DEDUCTIONS
  // ------------------------------------------
  statutoryDeductions: {
    paye: {
      enabled:                     { type: Boolean, default: false },
      grossAnnualIncome:           { type: Number, default: 0 },
      consolidatedReliefAllowance: { type: Number, default: 0 },
      taxableIncome:               { type: Number, default: 0 },
      annualTax:                   { type: Number, default: 0 },
      monthlyTax:                  { type: Number, default: 0 },
      taxBracketApplied:           { type: String, default: '' },
      calculationDetails:          { type: String, default: '' }
    },
    pension: {
      enabled:              { type: Boolean, default: false },
      pensionableIncome:    { type: Number, default: 0 },
      employeeContribution: { type: Number, default: 0 },
      employeeRate:         { type: Number, default: 8 },
      employerContribution: { type: Number, default: 0 },
      employerRate:         { type: Number, default: 10 },
      rsaPin:               { type: String, default: '' },
      pfaName:              { type: String, default: '' }
    },
    nhf: {
      enabled:         { type: Boolean, default: false },
      calculationBase: { type: Number, default: 0 },
      rate:            { type: Number, default: 2.5 },
      amount:          { type: Number, default: 0 }
    },
    nhis: {
      enabled:              { type: Boolean, default: false },
      calculationBase:      { type: Number, default: 0 },
      employeeContribution: { type: Number, default: 0 },
      employeeRate:         { type: Number, default: 5 },
      employerContribution: { type: Number, default: 0 },
      employerRate:         { type: Number, default: 10 }
    },
    itf: {
      enabled: { type: Boolean, default: false },
      amount:  { type: Number, default: 0 },
      rate:    { type: Number, default: 1 }
    },
    nsitf: {
      enabled: { type: Boolean, default: false },
      amount:  { type: Number, default: 0 },
      rate:    { type: Number, default: 1 }
    },
    totalStatutoryDeductions: { type: Number, default: 0 }
  },

  // ------------------------------------------
  // OTHER DEDUCTIONS (attendance + loans)
  // ------------------------------------------
  otherDeductions: {
    lateness: {
      amount:       { type: Number, default: 0 },
      occurrences:  { type: Number, default: 0 },
      totalMinutes: { type: Number, default: 0 }
    },
    earlyLeave: {
      amount:       { type: Number, default: 0 },
      occurrences:  { type: Number, default: 0 },
      totalMinutes: { type: Number, default: 0 }
    },
    absence: {
      amount: { type: Number, default: 0 },
      days:   { type: Number, default: 0 }
    },
    unpaidLeave: {
      amount: { type: Number, default: 0 },
      days:   { type: Number, default: 0 }
    },
    loans:    { type: [loanDeductionSchema], default: [] },
    advances: { type: [loanDeductionSchema], default: [] },
    other:    { type: [deductionBreakdownSchema], default: [] },
    totalOtherDeductions: { type: Number, default: 0 }
  },

  // Daily-level deduction log (one entry per event)
  deductionBreakdown: { type: [deductionBreakdownSchema], default: [] },

  // ------------------------------------------
  // ATTENDANCE DATA
  // ------------------------------------------
  attendanceData: {
    presentDays:         { type: Number, default: 0 },
    absentDays:          { type: Number, default: 0 },
    lateDays:            { type: Number, default: 0 },
    earlyLeaveDays:      { type: Number, default: 0 },
    lateMinutes:         { type: Number, default: 0 },
    earlyLeaveMinutes:   { type: Number, default: 0 },
    overtimeHours:       { type: Number, default: 0 },
    paidLeaveDays:       { type: Number, default: 0 },
    unpaidLeaveDays:     { type: Number, default: 0 },
    holidayDays:         { type: Number, default: 0 },
    actualWorkingDays:   { type: Number, default: 0 },
    standardWorkingDays: { type: Number, default: 26 }
  },

  // ------------------------------------------
  // LEAVE DATA
  // ------------------------------------------
  leaveData: {
    paidLeaveDays:        { type: Number, default: 0 },
    unpaidLeaveDays:      { type: Number, default: 0 },
    unpaidLeaveDeduction: { type: Number, default: 0 },
    leaveEncashment: {
      days:       { type: Number, default: 0 },
      ratePerDay: { type: Number, default: 0 },
      amount:     { type: Number, default: 0 }
    }
  },

  // ------------------------------------------
  // PAYROLL SUMMARY (calculated totals)
  // ------------------------------------------
  payrollSummary: {
    basicSalary:              { type: Number, default: 0 },
    totalAllowances:          { type: Number, default: 0 },
    totalBonuses:             { type: Number, default: 0 },
    overtimePay:              { type: Number, default: 0 },
    leaveEncashment:          { type: Number, default: 0 },
    grossSalary:              { type: Number, default: 0 },
    totalStatutoryDeductions: { type: Number, default: 0 },
    totalOtherDeductions:     { type: Number, default: 0 },
    totalDeductions:          { type: Number, default: 0 },
    netPay:                   { type: Number, default: 0 },
    employerContributions: {
      pension: { type: Number, default: 0 },
      nhis:    { type: Number, default: 0 },
      itf:     { type: Number, default: 0 },
      nsitf:   { type: Number, default: 0 },
      total:   { type: Number, default: 0 }
    },
    totalEmployerCost: { type: Number, default: 0 },
    isProrated:        { type: Boolean, default: false },
    prorationFactor:   { type: Number, default: 1 },
    prorationReason:   { type: String, default: '' }
  },

  // ------------------------------------------
  // PAYMENT INFORMATION
  // ------------------------------------------
  payment: {
    status:  { type: String, enum: ['pending', 'processing', 'paid', 'failed'], default: 'pending' },
    method:  { type: String, enum: ['bank_transfer', 'cash', 'cheque', 'mobile_money'], default: 'bank_transfer' },
    bankDetails: {
      bankName:      { type: String, default: '' },
      bankCode:      { type: String, default: '' },
      accountNumber: { type: String, default: '' },
      accountName:   { type: String, default: '' }
    },
    paymentDate:      { type: Date },
    processedDate:    { type: Date },
    processedBy:      { type: String },
    paymentReference: { type: String, default: '' },
    paymentBatch:     { type: String, default: '' },
    failureReason:    { type: String, default: '' },
    retryCount:       { type: Number, default: 0 }
  },

  // ------------------------------------------
  // APPROVAL WORKFLOW
  // ------------------------------------------
  approvals:            { type: [approvalSchema], default: [] },
  currentApprovalStage: { type: Number, default: 0 },
  approvalStatus: {
    type: String,
    enum: ['not_started', 'in_progress', 'approved', 'rejected'],
    default: 'not_started'
  },
  finalApprovedBy: { type: String },
  finalApprovedAt: { type: Date },

  // ------------------------------------------
  // PAYSLIP
  // ------------------------------------------
  payslip: {
    generated:        { type: Boolean, default: false },
    generatedAt:      { type: Date },
    generatedBy:      { type: String },
    pdfUrl:           { type: String, default: '' },
    pdfPath:          { type: String, default: '' },
    emailSent:        { type: Boolean, default: false },
    emailSentAt:      { type: Date },
    emailError:       { type: String, default: '' },
    downloadCount:    { type: Number, default: 0 },
    lastDownloadedAt: { type: Date }
  },

  // ------------------------------------------
  // CALCULATION METADATA
  // ------------------------------------------
  calculationType: {
    type: String,
    enum: ['daily', 'weekly', 'monthly', 'historical', 'manual'],
    default: 'monthly'
  },
  calculationSource: {
    type: String,
    enum: ['daily_cron', 'weekly_cron', 'monthly_cron', 'manual', 'api', 'historical_backfill', 'startup'],
    default: 'manual'
  },
  lastCalculated:     { type: Date, default: Date.now },
  calculationVersion: { type: Number, default: 1 },
  settingsVersion:    { type: Number, default: 1 },  // which PayrollSettings version was used

  // ------------------------------------------
  // PERIOD METADATA
  // ------------------------------------------
  isPartialPeriod: { type: Boolean, default: false },
  isMonthComplete: { type: Boolean, default: false },
  monthStartDate:  { type: String },
  monthEndDate:    { type: String },

  // ------------------------------------------
  // AUDIT & NOTES
  // ------------------------------------------
  notes:           { type: String, default: '' },
  adjustmentNotes: { type: String, default: '' },
  createdBy:       { type: String },
  lastModifiedBy:  { type: String }

}, { timestamps: true });

// ============================================
// INDEXES
// ============================================
// Primary: one payroll record per employee per period
payrollSchema.index({ tenantId: 1, employeeNumber: 1, period: 1 }, { unique: true });
payrollSchema.index({ tenantId: 1, period: 1 });
payrollSchema.index({ tenantId: 1, employeeId: 1 });
payrollSchema.index({ tenantId: 1, status: 1 });
payrollSchema.index({ tenantId: 1, 'payment.status': 1 });
payrollSchema.index({ tenantId: 1, approvalStatus: 1 });
payrollSchema.index({ tenantId: 1, department: 1, period: 1 });
payrollSchema.index({ tenantId: 1, calculationType: 1, period: 1 });

// ============================================
// VIRTUALS
// ============================================
payrollSchema.virtual('grossPay').get(function () {
  return this.payrollSummary?.grossSalary || 0;
});

payrollSchema.virtual('netPay').get(function () {
  return this.payrollSummary?.netPay || 0;
});

payrollSchema.virtual('fullName').get(function () {
  return `${this.firstName || ''} ${this.lastName || ''}`.trim() || this.name;
});

// ============================================
// INSTANCE METHODS
// ============================================

// Recalculate all totals from component fields
payrollSchema.methods.calculateTotals = function () {
  const salary    = this.salaryStructure;
  const statutory = this.statutoryDeductions;
  const other     = this.otherDeductions;

  const totalAllowances = (salary.allowances || []).reduce((s, a) => s + (a.amount || 0), 0);
  const totalBonuses    = (salary.bonuses    || []).reduce((s, b) => s + (b.amount || 0), 0);
  const overtimePay     = salary.overtime?.totalAmount   || 0;
  const leaveEncashment = salary.leaveEncashment?.amount || 0;

  const grossSalary = salary.baseSalary + totalAllowances + totalBonuses + overtimePay + leaveEncashment;

  const totalStatutoryDeductions =
    (statutory.paye?.monthlyTax              || 0) +
    (statutory.pension?.employeeContribution || 0) +
    (statutory.nhf?.amount                   || 0) +
    (statutory.nhis?.employeeContribution    || 0);

  const totalOtherDeductions =
    (other.lateness?.amount    || 0) +
    (other.earlyLeave?.amount  || 0) +
    (other.absence?.amount     || 0) +
    (other.unpaidLeave?.amount || 0) +
    (other.loans    || []).reduce((s, l) => s + (l.monthlyDeduction || 0), 0) +
    (other.advances || []).reduce((s, a) => s + (a.monthlyDeduction || 0), 0) +
    (other.other    || []).reduce((s, o) => s + (o.amount           || 0), 0);

  const totalDeductions = totalStatutoryDeductions + totalOtherDeductions;

  let netPay = grossSalary - totalDeductions;
  if (this.payrollSummary?.isProrated && this.payrollSummary?.prorationFactor < 1) {
    netPay = (grossSalary * this.payrollSummary.prorationFactor) - totalDeductions;
  }
  netPay = Math.max(0, netPay); // never negative

  const employerContributions = {
    pension: statutory.pension?.employerContribution || 0,
    nhis:    statutory.nhis?.employerContribution    || 0,
    itf:     statutory.itf?.amount                   || 0,
    nsitf:   statutory.nsitf?.amount                 || 0
  };
  employerContributions.total =
    employerContributions.pension +
    employerContributions.nhis +
    employerContributions.itf +
    employerContributions.nsitf;

  this.payrollSummary = {
    ...this.payrollSummary,
    basicSalary: salary.baseSalary,
    totalAllowances,
    totalBonuses,
    overtimePay,
    leaveEncashment,
    grossSalary,
    totalStatutoryDeductions,
    totalOtherDeductions,
    totalDeductions,
    netPay,
    employerContributions,
    totalEmployerCost: netPay + employerContributions.total
  };

  this.statutoryDeductions.totalStatutoryDeductions = totalStatutoryDeductions;
  this.otherDeductions.totalOtherDeductions          = totalOtherDeductions;

  return this.payrollSummary;
};

// Can this record enter approval flow?
payrollSchema.methods.canBeApproved = function () {
  return this.status === 'generated' && this.approvalStatus !== 'approved';
};

// Can payment be processed?
payrollSchema.methods.canBePaid = function () {
  return this.status === 'approved' && this.payment.status === 'pending';
};

// ============================================
// STATIC METHODS
// ============================================

// Aggregated summary for a period
payrollSchema.statics.getPeriodSummary = async function (period) {
  const result = await this.aggregate([
    { $match: { period } },
    {
      $group: {
        _id:               null,
        totalStaff:        { $sum: 1 },
        totalGrossSalary:  { $sum: '$payrollSummary.grossSalary' },
        totalDeductions:   { $sum: '$payrollSummary.totalDeductions' },
        totalNetPay:       { $sum: '$payrollSummary.netPay' },
        totalEmployerCost: { $sum: '$payrollSummary.totalEmployerCost' },
        pendingCount:  { $sum: { $cond: [{ $eq: ['$status', 'pending']  }, 1, 0] } },
        approvedCount: { $sum: { $cond: [{ $eq: ['$status', 'approved'] }, 1, 0] } },
        paidCount:     { $sum: { $cond: [{ $eq: ['$status', 'paid']     }, 1, 0] } }
      }
    }
  ]);

  return result[0] || {
    totalStaff: 0, totalGrossSalary: 0, totalDeductions: 0,
    totalNetPay: 0, totalEmployerCost: 0,
    pendingCount: 0, approvedCount: 0, paidCount: 0
  };
};

// Department-wise cost breakdown for a period
payrollSchema.statics.getDepartmentSummary = async function (period) {
  return this.aggregate([
    { $match: { period } },
    {
      $group: {
        _id:           '$department',
        headcount:     { $sum: 1 },
        totalGross:    { $sum: '$payrollSummary.grossSalary' },
        totalNet:      { $sum: '$payrollSummary.netPay' },
        averageSalary: { $avg: '$payrollSummary.grossSalary' }
      }
    },
    { $sort: { totalGross: -1 } }
  ]);
};

// ============================================
// EXPORT
// ============================================
module.exports = mongoose.model('Payroll', payrollSchema);
