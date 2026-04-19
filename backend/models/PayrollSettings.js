// PPAfan Attendance System - Payroll Settings Model
// Single-tenant. One active settings document governs all payroll calculations.
// Ported and adapted from OPSuite payroll infrastructure.

const mongoose = require('mongoose');

// ============================================
// SUB-SCHEMAS
// ============================================

// Progressive tax bracket (Nigerian PAYE)
const payeTaxBracketSchema = new mongoose.Schema({
  minIncome: { type: Number, required: true },
  maxIncome: { type: Number, default: null }, // null = unlimited (top bracket)
  rate:      { type: Number, required: true }  // percentage e.g. 15, 18, 21
}, { _id: false });

// Configurable salary component (allowance / bonus / benefit)
const salaryComponentSchema = new mongoose.Schema({
  name:            { type: String, required: true, trim: true },
  code:            { type: String, required: true, trim: true, uppercase: true },
  type:            { type: String, enum: ['allowance', 'bonus', 'benefit'], default: 'allowance' },
  calculationType: { type: String, enum: ['fixed', 'percentage'], default: 'fixed' },
  defaultValue:    { type: Number, default: 0 },
  percentageOf:    { type: String, enum: ['basic', 'gross', null], default: null },
  isTaxable:       { type: Boolean, default: true },
  isPensionable:   { type: Boolean, default: false },
  isActive:        { type: Boolean, default: true },
  description:     { type: String, default: '' }
}, { _id: true });

// ============================================
// MAIN SCHEMA
// ============================================

const payrollSettingsSchema = new mongoose.Schema({

  // ------------------------------------------
  // TENANT (single-tenant, always 'ppafan')
  // ------------------------------------------
  tenantId: { type: String, required: true, default: 'ppafan' },

  // ------------------------------------------
  // STATUTORY COMPLIANCE
  // ------------------------------------------
  statutory: {

    // PAYE — Pay As You Earn (Nigerian income tax)
    paye: {
      enabled: { type: Boolean, default: false },

      // NTA 2025 progressive tax brackets (effective January 1, 2026)
      // Note: brackets are hardcoded in payrollCalculations.js per NTA 2025 statute.
      // This field is retained for reference/display only.
      // Source: Presidential Fiscal Policy & Tax Reforms Committee, KPMG Nigeria, EY Nigeria
      taxBrackets: {
        type: [payeTaxBracketSchema],
        default: [
          { minIncome: 0,        maxIncome: 800000,   rate: 0  }, // First ₦800k — tax-free
          { minIncome: 800000,   maxIncome: 3000000,  rate: 15 }, // Next ₦2.2M
          { minIncome: 3000000,  maxIncome: 12000000, rate: 18 }, // Next ₦9M
          { minIncome: 12000000, maxIncome: 25000000, rate: 21 }, // Next ₦13M
          { minIncome: 25000000, maxIncome: 50000000, rate: 23 }, // Next ₦25M
          { minIncome: 50000000, maxIncome: null,     rate: 25 }  // Above ₦50M
        ]
      },

      minimumTaxRate:      { type: Number, default: 1 },      // 1% minimum tax
      minimumTaxThreshold: { type: Number, default: 800000 }, // exempt below ₦800k (NTA 2025)
      annualCalculation:   { type: Boolean, default: true },  // calculate annually ÷ 12
      state:               { type: String, default: '' },     // Lagos, Rivers, etc.
      taxAuthorityId:      { type: String, default: '' }      // LIRS, RIRS, KGIRS, etc.
    },

    // Contributory Pension Scheme
    pension: {
      enabled:                  { type: Boolean, default: false },
      employeeRate:             { type: Number, default: 8 },   // 8% employee
      employerRate:             { type: Number, default: 10 },  // 10% employer
      pensionableComponents:    { type: [String], default: ['basic', 'housing', 'transport'] },
      minimumPensionableIncome: { type: Number, default: 0 },
      maximumPensionableIncome: { type: Number, default: null }  // null = unlimited
    },

    // National Housing Fund
    nhf: {
      enabled:         { type: Boolean, default: false },
      rate:            { type: Number, default: 2.5 },    // 2.5% of monthly gross salary (FMBN guidance)
      minimumSalary:   { type: Number, default: 3000 },   // only applies if salary > ₦3k
      calculationBase: { type: String, enum: ['basic', 'gross'], default: 'gross' }, // always gross per FMBN
      // NTA 2025: NHF deduction is claimable pre-PAYE. Set isVoluntary=true to treat as opt-in
      // (employees must provide NHF registration number). Enforcement varies — consult your tax advisor.
      isVoluntary:     { type: Boolean, default: false }
    },

    // National Health Insurance Scheme
    nhis: {
      enabled:             { type: Boolean, default: false },
      employeeRate:        { type: Number, default: 5 },   // 5% employee
      employerRate:        { type: Number, default: 10 },  // 10% employer
      calculationBase:     { type: String, enum: ['basic', 'gross'], default: 'basic' },
      maximumContribution: { type: Number, default: null }  // null = unlimited
    },

    // Industrial Training Fund
    itf: {
      enabled:         { type: Boolean, default: false },
      rate:            { type: Number, default: 1 },  // 1% of total annual payroll
      minimumStaff:    { type: Number, default: 5 },  // only required if 5+ staff
      calculationType: { type: String, enum: ['annual', 'monthly'], default: 'annual' }
    },

    // Nigeria Social Insurance Trust Fund
    nsitf: {
      enabled:         { type: Boolean, default: false },
      employerRate:    { type: Number, default: 1 },   // 1% employer only
      calculationBase: { type: String, enum: ['basic', 'gross'], default: 'gross' }
    }
  },

  // ------------------------------------------
  // SALARY COMPONENTS (allowances & bonuses catalogue)
  // ------------------------------------------
  salaryComponents: {
    type: [salaryComponentSchema],
    default: [
      { name: 'Housing Allowance',   code: 'HOUSING',     type: 'allowance', calculationType: 'fixed',      isTaxable: true,  isPensionable: true,  isActive: true },
      { name: 'Transport Allowance', code: 'TRANSPORT',   type: 'allowance', calculationType: 'fixed',      isTaxable: true,  isPensionable: true,  isActive: true },
      { name: 'Meal Allowance',      code: 'MEAL',        type: 'allowance', calculationType: 'fixed',      isTaxable: true,  isPensionable: false, isActive: true },
      { name: 'Utility Allowance',   code: 'UTILITY',     type: 'allowance', calculationType: 'fixed',      isTaxable: true,  isPensionable: false, isActive: true },
      { name: 'Leave Allowance',     code: 'LEAVE',       type: 'allowance', calculationType: 'percentage', percentageOf: 'basic', defaultValue: 10, isTaxable: true, isPensionable: false, isActive: true },
      { name: '13th Month',          code: '13TH_MONTH',  type: 'bonus',     calculationType: 'percentage', percentageOf: 'basic', defaultValue: 100, isTaxable: true, isPensionable: false, isActive: true },
      { name: 'Performance Bonus',   code: 'PERFORMANCE', type: 'bonus',     calculationType: 'fixed',      isTaxable: true,  isPensionable: false, isActive: true }
    ]
  },

  // ------------------------------------------
  // MODULE TOGGLES (master on/off switches)
  // ------------------------------------------
  modules: {
    attendanceDeductions: { type: Boolean, default: true  },
    overtime:             { type: Boolean, default: true  },
    loans:                { type: Boolean, default: true  }
  },

  // ------------------------------------------
  // DEDUCTION RULES
  // ------------------------------------------
  deductions: {

    // Lateness deduction
    lateness: {
      enabled:      { type: Boolean, default: false },
      graceMinutes: { type: Number, default: 5 },
      graceMode:    { type: String, enum: ['threshold', 'excess'], default: 'threshold' },
      method: {
        type: String,
        enum: ['salary_based', 'fixed_rate', 'flat_fee', 'per_minute', 'per_hour', 'percentage', 'tiered'],
        default: 'salary_based'
      },
      ratePerMinute:     { type: Number, default: 0 },
      ratePerHour:       { type: Number, default: 500 },
      roundUpToHour:     { type: Boolean, default: false },
      percentageOfDaily: { type: Number, default: 0 },
      flatFee:           { type: Number, default: 0 },
      tiers: [{
        minMinutes: { type: Number },
        maxMinutes: { type: Number },
        deduction:  { type: Number }
      }],
      maxDailyDeduction: { type: Number, default: null }
    },

    // Absence deduction
    absence: {
      enabled: { type: Boolean, default: false },
      method: {
        type: String,
        enum: ['salary_based', 'fixed_amount', 'full_day', 'half_day', 'percentage', 'custom'],
        default: 'salary_based'
      },
      customAmount:      { type: Number, default: 0 },
      percentageOfDaily: { type: Number, default: 100 },
      includeAllowances: { type: Boolean, default: false }
    },

    // Early leave deduction
    earlyLeave: {
      enabled:      { type: Boolean, default: false },
      graceMinutes: { type: Number, default: 5 },
      graceMode:    { type: String, enum: ['threshold', 'excess'], default: 'threshold' },
      method: {
        type: String,
        enum: ['salary_based', 'fixed_rate', 'flat_fee', 'per_minute', 'per_hour', 'percentage'],
        default: 'salary_based'
      },
      ratePerMinute:     { type: Number, default: 0 },
      ratePerHour:       { type: Number, default: 500 },
      roundUpToHour:     { type: Boolean, default: false },
      percentageOfDaily: { type: Number, default: 0 },
      flatFee:           { type: Number, default: 0 },
      maxDailyDeduction: { type: Number, default: null }
    }
  },

  // ------------------------------------------
  // OVERTIME SETTINGS
  // ------------------------------------------
  overtime: {
    enabled:         { type: Boolean, default: false },
    calculationBase: { type: String, enum: ['basic_only', 'basic_plus_allowances', 'gross'], default: 'basic_only' },
    rates: {
      weekday:    { type: Number, default: 1.5  },
      weekend:    { type: Number, default: 2.0  },
      holiday:    { type: Number, default: 2.5  },
      nightShift: { type: Number, default: 1.25 }
    },
    nightShiftDefinition: {
      startHour: { type: Number, default: 22 },
      endHour:   { type: Number, default: 6  }
    },
    maxHoursPerMonth: { type: Number, default: 50 },
    requiresApproval: { type: Boolean, default: false },
    minimumMinutes:   { type: Number, default: 30 }
  },

  // ------------------------------------------
  // LEAVE SETTINGS
  // ------------------------------------------
  leave: {
    unpaidLeave: {
      method: {
        type: String,
        enum: ['daily_rate', 'hourly_rate', 'percentage'],
        default: 'daily_rate'
      },
      percentageOfDaily: { type: Number, default: 100 },
      calculationBase:   { type: String, enum: ['basic', 'gross'], default: 'gross' }
    },
    encashment: {
      enabled:         { type: Boolean, default: false },
      ratePerDay:      { type: Number, default: 0 },
      maxDays:         { type: Number, default: 10 },
      calculationBase: { type: String, enum: ['basic', 'gross'], default: 'basic' }
    }
  },

  // ------------------------------------------
  // PROCESSING SETTINGS
  // ------------------------------------------
  processing: {
    standardWorkingDays:   { type: Number, default: 26 },
    workingHoursPerDay:    { type: Number, default: 8 },
    workingDaysDefinition: {
      type: [String],
      default: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']
    },
    paymentCycle: { type: String, enum: ['weekly', 'bi-weekly', 'monthly'], default: 'monthly' },
    paymentDay:   { type: Number, default: 28 },
    cutoffDay:    { type: Number, default: 25 },
    autoGenerateOnCutoff: { type: Boolean, default: false },
    approval: {
      requireApproval:  { type: Boolean, default: true },
      approvalLevels:   { type: Number, default: 1 },
      autoApproveBelow: { type: Number, default: 0 }
    },
    rounding: {
      enabled:   { type: Boolean, default: true },
      method:    { type: String, enum: ['nearest', 'up', 'down'], default: 'nearest' },
      precision: { type: Number, default: 0 }
    }
  },

  // ------------------------------------------
  // LOAN & ADVANCE SETTINGS
  // ------------------------------------------
  loans: {
    enabled:                { type: Boolean, default: false },
    maxLoanPercentage:      { type: Number, default: 50 },
    maxRepaymentPercentage: { type: Number, default: 33 },
    interestRate:           { type: Number, default: 0 },
    maxTenureMonths:        { type: Number, default: 12 }
  },

  // ------------------------------------------
  // META
  // ------------------------------------------
  isActive:       { type: Boolean, default: true },
  version:        { type: Number, default: 1 },
  lastModifiedBy: { type: String }

}, { timestamps: true });

// ============================================
// INDEXES
// ============================================
payrollSettingsSchema.index({ tenantId: 1, isActive: 1 });

// ============================================
// PRE-SAVE MIDDLEWARE
// ============================================
payrollSettingsSchema.pre('save', function (next) {
  this.version = (this.version || 0) + 1;
  next();
});

// ============================================
// STATIC METHODS
// ============================================

// Get active settings — auto-creates default document if none exists
payrollSettingsSchema.statics.getActiveSettings = async function () {
  let settings = await this.findOne({ tenantId: 'ppafan', isActive: true });
  if (!settings) {
    settings = new this({ tenantId: 'ppafan', isActive: true });
    await settings.save();
  }
  return settings;
};

// ============================================
// INSTANCE METHODS
// ============================================

// Quick summary of which features are currently enabled
payrollSettingsSchema.methods.getEnabledFeatures = function () {
  return {
    statutory: {
      paye:    this.statutory.paye.enabled,
      pension: this.statutory.pension.enabled,
      nhf:     this.statutory.nhf.enabled,
      nhis:    this.statutory.nhis.enabled,
      itf:     this.statutory.itf.enabled,
      nsitf:   this.statutory.nsitf.enabled
    },
    deductions: {
      lateness:   this.deductions.lateness.enabled,
      absence:    this.deductions.absence.enabled,
      earlyLeave: this.deductions.earlyLeave.enabled
    },
    overtime:         this.overtime.enabled,
    leaveEncashment:  this.leave.encashment.enabled,
    loans:            this.loans.enabled,
    requiresApproval: this.processing.approval.requireApproval
  };
};

// ============================================
// EXPORT
// ============================================
module.exports = mongoose.model('PayrollSettings', payrollSettingsSchema);
