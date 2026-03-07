// Pump House ERP - Payroll Calculation Engine
// Pure computation functions — no models, no DB access.
// Called by payroll-cron.js and payroll routes.
// Ported and adapted from OPSuite payroll infrastructure.

const logger = require('./logger');

// ============================================
// UTILITY HELPERS
// ============================================

/**
 * Count working days in a given month.
 * Iterates every calendar day and checks it against workingDaysDefinition.
 * Public holidays are NOT subtracted — they are paid days and do not
 * reduce the salary denominator.
 */
const calculateWorkingDaysForMonth = async (year, month, _unused = null, workingDaysDefinition = null) => {
  const firstDay = new Date(year, month - 1, 1);
  const lastDay  = new Date(year, month,     0);

  const defaultDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
  const daysList    = workingDaysDefinition?.length > 0 ? workingDaysDefinition : defaultDays;
  const dayNames    = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  let workingDays = 0;
  for (let d = new Date(firstDay); d <= lastDay; d.setDate(d.getDate() + 1)) {
    if (daysList.includes(dayNames[d.getDay()])) workingDays++;
  }
  return workingDays;
};

/**
 * Derive daily, hourly and per-minute rates from base salary.
 */
const calculateRates = (baseSalary, workingDays, workingHoursPerDay = 8) => {
  const dailyRate  = Math.round(baseSalary / workingDays);
  const hourlyRate = Math.round(dailyRate  / workingHoursPerDay);
  const minuteRate = hourlyRate / 60;

  return {
    dailyRate,
    hourlyRate,
    minuteRate: Number(minuteRate.toFixed(4)),
    workingDays,
    workingHoursPerDay
  };
};

/**
 * Apply a grace period to reported late/early minutes.
 *
 * threshold (default): if minutes > grace → deduct ALL late minutes
 * excess:              if minutes > grace → deduct only the excess above grace
 */
const applyGracePeriod = (minutes, graceMinutes = 0, graceMode = 'threshold') => {
  if (minutes <= graceMinutes) return 0;
  return graceMode === 'excess' ? minutes - graceMinutes : minutes;
};

/**
 * Round a monetary amount to a given precision using the specified method.
 */
const roundAmount = (amount, method = 'nearest', precision = 0) => {
  const m = Math.pow(10, precision);
  if (method === 'up')   return Math.ceil(amount  * m) / m;
  if (method === 'down') return Math.floor(amount * m) / m;
  return Math.round(amount * m) / m;
};

// ============================================
// DEDUCTION CALCULATIONS
// ============================================

/**
 * Lateness deduction.
 *
 * Core formula (salary_based):
 *   minuteRate = baseSalary / workingDays / workingHours / 60
 *   deduction  = deductibleMinutes × minuteRate
 *
 * Seven methods supported; 'salary_based' is the default.
 */
const calculateLatenessDeduction = (lateMinutes, dailyRate, settings) => {
  const ls = settings?.deductions?.lateness || {};

  if (!ls.enabled || lateMinutes <= 0) return { amount: 0, details: null };

  const grace             = ls.graceMinutes || 0;
  const graceMode         = ls.graceMode    || 'threshold';
  const deductibleMinutes = applyGracePeriod(lateMinutes, grace, graceMode);

  if (deductibleMinutes <= 0) return { amount: 0, details: { withinGrace: true, graceMinutes: grace } };

  const method           = ls.method || 'salary_based';
  const workingHours     = settings?.processing?.workingHoursPerDay || 8;
  const hourlyRate       = dailyRate / workingHours;
  const minuteRate       = hourlyRate / 60;

  let amount = 0;

  switch (method) {
    case 'salary_based':
      amount = deductibleMinutes * minuteRate;
      break;

    case 'fixed_rate':
      amount = deductibleMinutes * (ls.ratePerMinute || 0);
      break;

    case 'flat_fee':
      amount = ls.flatFee || 0;
      break;

    case 'per_minute':
      amount = deductibleMinutes * (ls.ratePerMinute || minuteRate);
      break;

    case 'per_hour': {
      const lateHours = ls.roundUpToHour
        ? Math.ceil(deductibleMinutes / 60)
        : deductibleMinutes / 60;
      amount = lateHours * (ls.ratePerHour || hourlyRate);
      break;
    }

    case 'percentage': {
      const hours = deductibleMinutes / 60;
      amount = (dailyRate * (ls.percentageOfDaily || 0) / 100) * hours;
      break;
    }

    case 'tiered': {
      const tiers = ls.tiers || [];
      for (const tier of tiers) {
        if (deductibleMinutes >= tier.minMinutes &&
            (tier.maxMinutes == null || deductibleMinutes <= tier.maxMinutes)) {
          amount = tier.deduction;
          break;
        }
      }
      break;
    }

    default:
      amount = deductibleMinutes * minuteRate;
  }

  if (ls.maxDailyDeduction && amount > ls.maxDailyDeduction) amount = ls.maxDailyDeduction;

  return {
    amount: Math.round(amount),
    details: {
      originalMinutes: lateMinutes,
      graceMinutes: grace,
      graceMode,
      deductibleMinutes,
      method,
      minuteRate: Number(minuteRate.toFixed(4)),
      calculation: `${method}: ${deductibleMinutes} min × ${minuteRate.toFixed(4)}`
    }
  };
};

/**
 * Early leave deduction — identical formula to lateness.
 */
const calculateEarlyLeaveDeduction = (earlyMinutes, dailyRate, settings) => {
  const es = settings?.deductions?.earlyLeave || {};

  if (!es.enabled || earlyMinutes <= 0) return { amount: 0, details: null };

  const grace             = es.graceMinutes || 0;
  const graceMode         = es.graceMode    || 'threshold';
  const deductibleMinutes = applyGracePeriod(earlyMinutes, grace, graceMode);

  if (deductibleMinutes <= 0) return { amount: 0, details: { withinGrace: true, graceMinutes: grace } };

  const method       = es.method || 'salary_based';
  const workingHours = settings?.processing?.workingHoursPerDay || 8;
  const hourlyRate   = dailyRate / workingHours;
  const minuteRate   = hourlyRate / 60;

  let amount = 0;

  switch (method) {
    case 'salary_based':
      amount = deductibleMinutes * minuteRate;
      break;

    case 'fixed_rate':
      amount = deductibleMinutes * (es.ratePerMinute || 0);
      break;

    case 'flat_fee':
      amount = es.flatFee || 0;
      break;

    case 'per_minute':
      amount = deductibleMinutes * (es.ratePerMinute || minuteRate);
      break;

    case 'per_hour': {
      const earlyHours = es.roundUpToHour
        ? Math.ceil(deductibleMinutes / 60)
        : deductibleMinutes / 60;
      amount = earlyHours * (es.ratePerHour || hourlyRate);
      break;
    }

    case 'percentage': {
      const hours = deductibleMinutes / 60;
      amount = (dailyRate * (es.percentageOfDaily || 0) / 100) * hours;
      break;
    }

    default:
      amount = deductibleMinutes * minuteRate;
  }

  if (es.maxDailyDeduction && amount > es.maxDailyDeduction) amount = es.maxDailyDeduction;

  return {
    amount: Math.round(amount),
    details: {
      originalMinutes: earlyMinutes,
      graceMinutes: grace,
      graceMode,
      deductibleMinutes,
      method,
      minuteRate: Number(minuteRate.toFixed(4)),
      calculation: `${method}: ${deductibleMinutes} min × ${minuteRate.toFixed(4)}`
    }
  };
};

/**
 * Absence deduction.
 *
 * IMPORTANT: always deducts from base daily rate, NOT gross.
 * Allowances are contractual entitlements — they are not forfeited for absences
 * unless the org explicitly enables includeAllowances (not recommended).
 */
const calculateAbsenceDeduction = (dailyRate, grossDaily, settings, isHalfDay = false) => {
  const as = settings?.deductions?.absence || {};

  if (!as.enabled) return { amount: 0, details: null };

  const method   = as.method   || 'salary_based';
  const baseRate = as.includeAllowances === true ? grossDaily : dailyRate;

  let amount = 0;

  switch (method) {
    case 'salary_based':
    case 'full_day':
      amount = isHalfDay ? baseRate / 2 : baseRate;
      break;

    case 'fixed_amount':
    case 'custom':
      amount = as.customAmount || 0;
      if (isHalfDay) amount /= 2;
      break;

    case 'half_day':
      amount = baseRate / 2;
      break;

    case 'percentage': {
      const pct = as.percentageOfDaily || 100;
      amount = (baseRate * pct / 100) * (isHalfDay ? 0.5 : 1);
      break;
    }

    default:
      amount = isHalfDay ? baseRate / 2 : baseRate;
  }

  return {
    amount: Math.round(amount),
    details: {
      method,
      isHalfDay,
      dailyRate,
      calculation: isHalfDay ? 'Half-day absence' : 'Full-day absence'
    }
  };
};

// ============================================
// STATUTORY CALCULATIONS
// ============================================

/**
 * PAYE (Pay As You Earn) — Nigerian progressive income tax.
 *
 * NTA 2025 (effective January 1, 2026):
 *   • CRA is ABOLISHED. Taxable income = gross minus statutory deductions + declared personal reliefs.
 *   • Pre-tax deductions: pension (employee), NHF, NHIS, rent relief, life assurance, mortgage interest, voluntary AVC
 *   • Rent relief = 20% of actual annual rent paid, capped at ₦500,000/yr
 *   • 6 progressive tax brackets (0% – 25%)
 *   • Minimum tax: 1% of gross, only for incomes above ₦800k threshold
 *
 * Source: Presidential Fiscal Policy & Tax Reforms Committee, KPMG Nigeria, EY Nigeria
 *
 * @param {number} annualGross        - Annual gross (monthly gross × 12)
 * @param {object} settings           - PayrollSettings document
 * @param {object} exemptions         - Per-staff exemption flags
 * @param {object} preTaxDeductions   - Annual amounts: { pension, nhf, nhis, rentRelief,
 *                                      annualLifeAssurance, annualMortgageInterest, voluntaryPensionAVC }
 */
const calculatePAYE = (annualGross, settings, exemptions = {}, preTaxDeductions = {}) => {
  const ps = settings?.statutory?.paye || {};

  if (!ps.enabled || exemptions.paye) {
    return {
      amount: 0, monthlyAmount: 0,
      details: { exempt: true, reason: exemptions.paye ? 'Staff exempt' : 'PAYE disabled' }
    };
  }

  // NTA 2025: taxable income = gross − statutory deductions − declared personal reliefs
  const annualPension    = preTaxDeductions.pension    || 0; // employee share × 12
  const annualNHF        = preTaxDeductions.nhf        || 0;
  const annualNHIS       = preTaxDeductions.nhis       || 0;
  const rentRelief       = preTaxDeductions.rentRelief || 0; // 20% of actual rent, ≤ ₦500k/yr
  const lifeAssurance    = preTaxDeductions.annualLifeAssurance    || 0;
  const mortgageInterest = preTaxDeductions.annualMortgageInterest || 0;
  const voluntaryAVC     = preTaxDeductions.voluntaryPensionAVC    || 0;

  const totalPreTax   = annualPension + annualNHF + annualNHIS + rentRelief + lifeAssurance + mortgageInterest + voluntaryAVC;
  const taxableIncome = Math.max(0, annualGross - totalPreTax);

  // NTA 2025 statutory brackets — hardcoded, not overridable from DB settings
  const brackets = [
    { minIncome: 0,        maxIncome: 800000,   rate: 0  }, // First ₦800k — tax-free
    { minIncome: 800000,   maxIncome: 3000000,  rate: 15 }, // Next ₦2.2M
    { minIncome: 3000000,  maxIncome: 12000000, rate: 18 }, // Next ₦9M
    { minIncome: 12000000, maxIncome: 25000000, rate: 21 }, // Next ₦13M
    { minIncome: 25000000, maxIncome: 50000000, rate: 23 }, // Next ₦25M
    { minIncome: 50000000, maxIncome: null,     rate: 25 }  // Above ₦50M
  ];

  let totalTax        = 0;
  let remainingIncome = taxableIncome;
  const bracketBreakdown = [];

  for (const bracket of brackets) {
    if (remainingIncome <= 0) break;

    const bracketSize      = bracket.maxIncome ? bracket.maxIncome - bracket.minIncome : remainingIncome;
    const taxableInBracket = Math.min(remainingIncome, bracketSize);
    const taxInBracket     = (taxableInBracket * bracket.rate) / 100;

    if (taxInBracket > 0) {
      bracketBreakdown.push({
        bracket:       `${bracket.minIncome.toLocaleString()} - ${bracket.maxIncome ? bracket.maxIncome.toLocaleString() : 'above'}`,
        rate:          bracket.rate,
        taxableAmount: Math.round(taxableInBracket),
        tax:           Math.round(taxInBracket)
      });
    }

    totalTax        += taxInBracket;
    remainingIncome -= taxableInBracket;
  }

  // Minimum tax: 1% of gross — only applies above the ₦800k exempt threshold
  const minTaxRate      = ps.minimumTaxRate      != null ? ps.minimumTaxRate      : 1;
  const minTaxThreshold = ps.minimumTaxThreshold != null ? ps.minimumTaxThreshold : 800000;
  const minimumTax      = (annualGross * minTaxRate) / 100;

  if (annualGross > minTaxThreshold && totalTax < minimumTax && minimumTax > 0) {
    totalTax = minimumTax;
  }

  const monthlyTax = totalTax / 12;

  return {
    amount:        Math.round(totalTax),
    monthlyAmount: Math.round(monthlyTax),
    details: {
      annualGross,
      reliefMethod: 'nta_2025',
      preTaxDeductions: {
        pension:          Math.round(annualPension),
        nhf:              Math.round(annualNHF),
        nhis:             Math.round(annualNHIS),
        rentRelief:       Math.round(rentRelief),
        lifeAssurance:    Math.round(lifeAssurance),
        mortgageInterest: Math.round(mortgageInterest),
        voluntaryAVC:     Math.round(voluntaryAVC),
        total:            Math.round(totalPreTax)
      },
      taxableIncome:      Math.round(taxableIncome),
      brackets:           bracketBreakdown,
      minimumTaxApplied:  totalTax === minimumTax && minimumTax > 0
    }
  };
};

/**
 * Pension (Contributory Pension Scheme).
 * Pensionable income = basic + housing + transport (configurable).
 * Employee 8%, Employer 10% (configurable).
 */
const calculatePension = (monthlyBasic, monthlyHousing, monthlyTransport, settings, exemptions = {}) => {
  const ps = settings?.statutory?.pension || {};

  if (!ps.enabled || exemptions.pension) {
    return {
      employeeAmount: 0, employerAmount: 0, totalAmount: 0,
      details: { exempt: true, reason: exemptions.pension ? 'Staff exempt' : 'Pension disabled' }
    };
  }

  const components = ps.pensionableComponents || ['basic', 'housing', 'transport'];
  let pensionableIncome = 0;
  if (components.includes('basic'))     pensionableIncome += monthlyBasic;
  if (components.includes('housing'))   pensionableIncome += monthlyHousing;
  if (components.includes('transport')) pensionableIncome += monthlyTransport;

  const min = ps.minimumPensionableIncome || 0;
  const max = ps.maximumPensionableIncome || null;
  if (pensionableIncome < min) pensionableIncome = 0;
  if (max && pensionableIncome > max) pensionableIncome = max;

  const employeeRate   = ps.employeeRate || 8;
  const employerRate   = ps.employerRate || 10;
  const employeeAmount = (pensionableIncome * employeeRate) / 100;
  const employerAmount = (pensionableIncome * employerRate) / 100;

  return {
    employeeAmount: Math.round(employeeAmount),
    employerAmount: Math.round(employerAmount),
    totalAmount:    Math.round(employeeAmount + employerAmount),
    details:        { pensionableIncome: Math.round(pensionableIncome), components, employeeRate, employerRate }
  };
};

/**
 * NHF (National Housing Fund) — Employee deduction.
 * Default: 2.5% of basic salary.
 */
const calculateNHF = (monthlyBasic, monthlyGross, settings, exemptions = {}) => {
  const ns = settings?.statutory?.nhf || {};

  if (!ns.enabled || exemptions.nhf) {
    return { amount: 0, details: { exempt: true, reason: exemptions.nhf ? 'Staff exempt' : 'NHF disabled' } };
  }

  // FMBN guidance: NHF = 2.5% of monthly gross salary (not basic only).
  // Ignore stored calculationBase — always use gross regardless of DB value.
  const base       = monthlyGross;
  const minSalary  = ns.minimumSalary || 3000;

  if (base < minSalary) {
    return { amount: 0, details: { belowThreshold: true, threshold: minSalary } };
  }

  const rate   = ns.rate || 2.5;
  const amount = (base * rate) / 100;

  return {
    amount:  Math.round(amount),
    details: { calculationBase: 'gross', baseAmount: Math.round(base), rate }
  };
};

/**
 * NHIS (National Health Insurance Scheme).
 * Employee 5%, Employer 10% (configurable).
 */
const calculateNHIS = (monthlyBasic, monthlyGross, settings, exemptions = {}) => {
  const ns = settings?.statutory?.nhis || {};

  if (!ns.enabled || exemptions.nhis) {
    return {
      employeeAmount: 0, employerAmount: 0, totalAmount: 0,
      details: { exempt: true, reason: exemptions.nhis ? 'Staff exempt' : 'NHIS disabled' }
    };
  }

  const base         = ns.calculationBase === 'gross' ? monthlyGross : monthlyBasic;
  const empRate      = ns.employeeRate    || 5;
  const erRate       = ns.employerRate    || 10;
  let empAmount      = (base * empRate)   / 100;
  let erAmount       = (base * erRate)    / 100;
  const max          = ns.maximumContribution;
  if (max) { empAmount = Math.min(empAmount, max); erAmount = Math.min(erAmount, max); }

  return {
    employeeAmount: Math.round(empAmount),
    employerAmount: Math.round(erAmount),
    totalAmount:    Math.round(empAmount + erAmount),
    details:        { calculationBase: ns.calculationBase || 'basic', baseAmount: Math.round(base), employeeRate: empRate, employerRate: erRate }
  };
};

/**
 * ITF (Industrial Training Fund) — Employer only.
 * 1% of total annual payroll. Only applies if staff count ≥ minimumStaff (5).
 */
const calculateITF = (monthlyGross, staffCount, settings) => {
  const its = settings?.statutory?.itf || {};

  if (!its.enabled) return { amount: 0, details: { exempt: true, reason: 'ITF disabled' } };

  const minStaff = its.minimumStaff || 5;
  if (staffCount < minStaff) {
    return { amount: 0, details: { belowMinimumStaff: true, minimum: minStaff, current: staffCount } };
  }

  const rate = its.rate || 1;
  const calc = its.calculationType || 'annual';
  // Always return monthly portion
  const amount = calc === 'annual'
    ? (monthlyGross * 12 * rate) / 100 / 12
    : (monthlyGross * rate) / 100;

  return {
    amount:  Math.round(amount),
    details: { rate, calculationType: calc, monthlyGross: Math.round(monthlyGross) }
  };
};

/**
 * NSITF (Nigeria Social Insurance Trust Fund) — Employer only.
 * 1% of gross (configurable).
 */
const calculateNSITF = (monthlyBasic, monthlyGross, settings) => {
  const ns = settings?.statutory?.nsitf || {};

  if (!ns.enabled) return { amount: 0, details: { exempt: true, reason: 'NSITF disabled' } };

  const base   = ns.calculationBase === 'gross' ? monthlyGross : monthlyBasic;
  const rate   = ns.employerRate    || 1;
  const amount = (base * rate) / 100;

  return {
    amount:  Math.round(amount),
    details: { calculationBase: ns.calculationBase || 'gross', baseAmount: Math.round(base), employerRate: rate }
  };
};

// ============================================
// OVERTIME CALCULATION
// ============================================

/**
 * Overtime pay.
 * Applies type-specific multipliers (weekday/weekend/holiday/nightShift).
 * Caps at maxHoursPerMonth; skips records below minimumMinutes.
 */
const calculateOvertimePay = (overtimeRecords, baseSalary, settings, staffExemptions = {}) => {
  const os = settings?.overtime || {};

  if (!os.enabled || staffExemptions.overtimeEligible === false) {
    return { totalAmount: 0, totalHours: 0, breakdown: [], details: { exempt: true } };
  }

  const workingDays  = settings?.processing?.standardWorkingDays || 26;
  const workingHours = settings?.processing?.workingHoursPerDay  || 8;
  const hourlyRate   = baseSalary / workingDays / workingHours;
  const rates        = os.rates || { weekday: 1.5, weekend: 2.0, holiday: 2.5, nightShift: 1.25 };
  const maxHours     = os.maxHoursPerMonth || 50;
  const minMinutes   = os.minimumMinutes   || 30;

  let totalHours  = 0;
  let totalAmount = 0;
  const breakdown = [];

  for (const record of overtimeRecords || []) {
    const minutes = record.minutes || 0;
    if (minutes < minMinutes) continue;

    const hours = minutes / 60;
    if (totalHours >= maxHours) break;

    const availableHours = Math.min(hours, maxHours - totalHours);
    const type           = record.type || 'weekday';
    const multiplier     = rates[type] || 1.5;
    const amount         = availableHours * hourlyRate * multiplier;

    breakdown.push({
      date:   record.date,
      type,
      hours:  availableHours,
      rate:   multiplier,
      amount: Math.round(amount),
      capped: availableHours < hours
    });

    totalHours  += availableHours;
    totalAmount += amount;
  }

  return {
    totalAmount: Math.round(totalAmount),
    totalHours:  Number(totalHours.toFixed(2)),
    breakdown,
    details:     { hourlyRate: Math.round(hourlyRate), rates, maxHours, minMinutes }
  };
};

// ============================================
// GROSS SALARY CALCULATION
// ============================================

/**
 * Build gross salary from base + allowances + bonuses + overtime + leave encashment.
 * Allowances are applied after basic salary is known.
 * Percentage-based allowances reference basic (not gross) to avoid circular dependency.
 */
const calculateGrossSalary = (
  baseSalary,
  staffAllowances   = [],
  settingsComponents = [], // unused here — allowances come from staff record
  bonuses           = [],
  overtime          = { totalAmount: 0, breakdown: [] },
  leaveEncashment   = 0
) => {
  let totalAllowances   = 0;
  const allowanceBreakdown = [];

  for (const a of staffAllowances) {
    if (!a.isActive) continue;
    let amount = 0;
    if (a.calculationType === 'fixed') {
      amount = a.amount || 0;
    } else if (a.calculationType === 'percentage') {
      const base = a.percentageOf === 'basic' ? baseSalary : 0;
      amount = (base * (a.percentageValue || 0)) / 100;
    }
    if (amount > 0) {
      totalAllowances += amount;
      allowanceBreakdown.push({ code: a.code, name: a.name, amount: Math.round(amount), calculationType: a.calculationType });
    }
  }

  let totalBonuses    = 0;
  const bonusBreakdown = [];
  for (const b of bonuses) {
    const amount = b.amount || 0;
    if (amount > 0) {
      totalBonuses += amount;
      bonusBreakdown.push({ code: b.code || 'BONUS', name: b.name || 'Bonus', amount: Math.round(amount) });
    }
  }

  const grossSalary = baseSalary + totalAllowances + totalBonuses + (overtime.totalAmount || 0) + leaveEncashment;

  return {
    baseSalary,
    totalAllowances:  Math.round(totalAllowances),
    totalBonuses:     Math.round(totalBonuses),
    overtimeAmount:   overtime.totalAmount || 0,
    leaveEncashment:  Math.round(leaveEncashment),
    grossSalary:      Math.round(grossSalary),
    breakdown:        { allowances: allowanceBreakdown, bonuses: bonusBreakdown, overtime: overtime.breakdown || [] }
  };
};

// ============================================
// MAIN ORCHESTRATOR
// ============================================

/**
 * calculateEmployeePayroll — Master function for a single employee.
 *
 * Execution order:
 *   1. Overtime
 *   2. Leave encashment
 *   3. Gross salary (base + allowances + bonuses + overtime + encashment)
 *   4. Statutory deductions (PAYE, Pension, NHF, NHIS, ITF, NSITF)
 *   5. Attendance deductions (lateness, early leave, absence) — only when module enabled
 *   6. Aggregate totals
 *   7. Rounding (per settings)
 *   8. Build and return result object
 */
const calculateEmployeePayroll = async ({
  staff,
  settings,
  attendanceData,
  overtimeRecords = [],
  leaveData       = {},
  period,
  workingDays,
  staffCount      = 1
}) => {
  try {
    const baseSalary  = staff.baseSalary  || 0;
    const staffPayroll = staff.payroll    || {};
    const exemptions   = staffPayroll.exemptions || {};

    // 1. Overtime
    const overtime = calculateOvertimePay(overtimeRecords, baseSalary, settings, staffPayroll);

    // 2. Leave encashment
    const leaveEncashment = leaveData.encashmentAmount || 0;

    // 3. Gross salary
    const grossCalc = calculateGrossSalary(
      baseSalary,
      staffPayroll.allowances || [],
      settings.salaryComponents || [],
      [],         // one-off bonuses handled separately
      overtime,
      leaveEncashment
    );

    const housingAllowance   = (staffPayroll.allowances || []).find(a => a.code === 'HOUSING')?.amount   || 0;
    const transportAllowance = (staffPayroll.allowances || []).find(a => a.code === 'TRANSPORT')?.amount || 0;

    // 4. Statutory deductions
    // IMPORTANT (NTA 2025): pension, NHF, and NHIS must be calculated BEFORE PAYE because
    // they reduce taxable income. Calculate them first, then pass annual amounts into PAYE.
    const annualGross = grossCalc.grossSalary * 12;
    const pension = calculatePension(baseSalary, housingAllowance, transportAllowance, settings, exemptions);
    const nhf    = calculateNHF(baseSalary, grossCalc.grossSalary, settings, exemptions);
    const nhis   = calculateNHIS(baseSalary, grossCalc.grossSalary, settings, exemptions);

    // Build pre-tax deductions for NTA 2025 PAYE calculation
    const taxReliefs = staffPayroll.taxReliefs || {};
    const annualRent = taxReliefs.annualRent || 0;
    // Rent relief = 20% of actual annual rent paid, capped at ₦500,000/yr (KPMG / EY NTA 2025)
    const rentRelief = Math.min(annualRent * 0.20, 500000);
    const preTaxDeductions = {
      pension:                (pension.employeeAmount || 0) * 12,
      nhf:                    (nhf.amount             || 0) * 12,
      nhis:                   (nhis.employeeAmount    || 0) * 12,
      rentRelief,
      annualLifeAssurance:    taxReliefs.annualLifeAssurance    || 0,
      annualMortgageInterest: taxReliefs.annualMortgageInterest || 0,
      voluntaryPensionAVC:    taxReliefs.voluntaryPensionAVC    || 0
    };

    const paye   = calculatePAYE(annualGross, settings, exemptions, preTaxDeductions);
    const itf    = calculateITF(grossCalc.grossSalary, staffCount, settings);   // employer only
    const nsitf  = calculateNSITF(baseSalary, grossCalc.grossSalary, settings); // employer only

    // 5. Attendance deductions
    const rates    = calculateRates(baseSalary, workingDays, settings?.processing?.workingHoursPerDay || 8);
    const dailyGross = grossCalc.grossSalary / workingDays;

    let totalLatenessDeduction   = 0;
    let totalEarlyLeaveDeduction = 0;
    let totalAbsenceDeduction    = 0;
    const deductionBreakdown     = [];

    const attendanceModuleEnabled = settings?.modules?.attendanceDeductions === true;

    if (attendanceModuleEnabled) {
      for (const record of attendanceData || []) {
        if (record.lateMinutes > 0) {
          const d = calculateLatenessDeduction(record.lateMinutes, rates.dailyRate, settings);
          if (d.amount > 0) {
            totalLatenessDeduction += d.amount;
            deductionBreakdown.push({ date: record.date, type: 'lateness',   amount: d.amount, details: d.details });
          }
        }

        if (record.earlyLeaveMinutes > 0) {
          const d = calculateEarlyLeaveDeduction(record.earlyLeaveMinutes, rates.dailyRate, settings);
          if (d.amount > 0) {
            totalEarlyLeaveDeduction += d.amount;
            deductionBreakdown.push({ date: record.date, type: 'early_leave', amount: d.amount, details: d.details });
          }
        }

        if (record.absent) {
          const d = calculateAbsenceDeduction(rates.dailyRate, dailyGross, settings, record.isHalfDay);
          if (d.amount > 0) {
            totalAbsenceDeduction += d.amount;
            deductionBreakdown.push({ date: record.date, type: 'absence',    amount: d.amount, details: d.details });
          }
        }
      }
    }

    // 6. Totals
    const unpaidLeaveDeduction       = leaveData.unpaidDeduction || 0;
    const totalStatutoryDeductions   = paye.monthlyAmount + pension.employeeAmount + nhf.amount + nhis.employeeAmount;
    const totalOtherDeductions       = totalLatenessDeduction + totalEarlyLeaveDeduction + totalAbsenceDeduction + unpaidLeaveDeduction;
    const totalDeductions            = totalStatutoryDeductions + totalOtherDeductions;
    const rawNetPay                  = grossCalc.grossSalary - totalDeductions;
    const employerContributionsTotal = pension.employerAmount + nhis.employerAmount + itf.amount + nsitf.amount;

    // 7. Rounding
    const rounding    = settings?.processing?.rounding || {};
    const finalNetPay = rounding.enabled !== false
      ? roundAmount(rawNetPay, rounding.method || 'nearest', rounding.precision || 0)
      : Math.round(rawNetPay);

    // Ensure net pay never goes negative
    const netPay = Math.max(0, finalNetPay);

    // 8. Result
    return {
      success:        true,
      employeeId:     staff._id,
      employeeNumber: staff.employeeId,
      name:           `${staff.firstName} ${staff.lastName || ''}`.trim(),
      period,

      salaryStructure: {
        salaryType:      staffPayroll.salaryType || 'monthly',
        baseSalary,
        allowances:      grossCalc.breakdown.allowances,
        bonuses:         grossCalc.breakdown.bonuses,
        overtime: {
          breakdown:   overtime.breakdown,
          totalHours:  overtime.totalHours,
          totalAmount: overtime.totalAmount
        },
        leaveEncashment
      },

      statutoryDeductions: {
        paye:  { enabled: settings?.statutory?.paye?.enabled,    monthlyAmount: paye.monthlyAmount,     annualAmount: paye.amount, details: paye.details },
        pension: { enabled: settings?.statutory?.pension?.enabled, employeeAmount: pension.employeeAmount, employerAmount: pension.employerAmount, details: pension.details },
        nhf:   { enabled: settings?.statutory?.nhf?.enabled,     amount: nhf.amount, details: nhf.details },
        nhis:  { enabled: settings?.statutory?.nhis?.enabled,    employeeAmount: nhis.employeeAmount, employerAmount: nhis.employerAmount, details: nhis.details },
        itf:   { enabled: settings?.statutory?.itf?.enabled,     amount: itf.amount, details: itf.details },
        nsitf: { enabled: settings?.statutory?.nsitf?.enabled,   amount: nsitf.amount, details: nsitf.details },
        totalStatutoryDeductions
      },

      otherDeductions: {
        lateness:   { totalMinutes: (attendanceData || []).reduce((s, r) => s + (r.lateMinutes || 0), 0),       totalAmount: totalLatenessDeduction,   count: deductionBreakdown.filter(d => d.type === 'lateness').length },
        earlyLeave: { totalMinutes: (attendanceData || []).reduce((s, r) => s + (r.earlyLeaveMinutes || 0), 0), totalAmount: totalEarlyLeaveDeduction,  count: deductionBreakdown.filter(d => d.type === 'early_leave').length },
        absence:    { totalDays: (attendanceData || []).filter(r => r.absent).length, totalAmount: totalAbsenceDeduction },
        unpaidLeave:{ days: leaveData.unpaidDays || 0, amount: leaveData.unpaidDeduction || 0 },
        loans:      [],
        advances:   [],
        other:      [],
        totalOtherDeductions,
        breakdown:  deductionBreakdown
      },

      attendanceData: {
        presentDays:       (attendanceData || []).filter(r => !r.absent && (r.checkIn || r.checkOut)).length,
        absentDays:        (attendanceData || []).filter(r => r.absent).length,
        lateDays:          (attendanceData || []).filter(r => r.lateMinutes > 0).length,
        lateMinutes:       (attendanceData || []).reduce((s, r) => s + (r.lateMinutes       || 0), 0),
        earlyLeaveDays:    (attendanceData || []).filter(r => r.earlyLeaveMinutes > 0).length,
        earlyLeaveMinutes: (attendanceData || []).reduce((s, r) => s + (r.earlyLeaveMinutes || 0), 0),
        workingDays,
        recordCount:       (attendanceData || []).length
      },

      leaveData: {
        paidDays:         leaveData.paidDays         || 0,
        unpaidDays:       leaveData.unpaidDays        || 0,
        encashmentDays:   leaveData.encashmentDays    || 0,
        encashmentAmount: leaveEncashment
      },

      payrollSummary: {
        basicSalary:              baseSalary,
        totalAllowances:          grossCalc.totalAllowances,
        totalBonuses:             grossCalc.totalBonuses,
        overtimeAmount:           overtime.totalAmount,
        grossSalary:              grossCalc.grossSalary,
        totalStatutoryDeductions,
        totalOtherDeductions,
        totalDeductions,
        netPay,
        employerContributions:    employerContributionsTotal,
        totalEmployerCost:        grossCalc.grossSalary + employerContributionsTotal
      },

      calculationMeta: {
        settingsVersion: settings.version || 1,
        calculatedAt:    new Date(),
        workingDays,
        rates
      }
    };

  } catch (error) {
    logger.error('Payroll calculation error', { employeeId: staff?.employeeId, error: error.message });
    return { success: false, error: error.message, employeeId: staff?._id, employeeNumber: staff?.employeeId };
  }
};

// ============================================
// LEGACY COMPATIBILITY
// ============================================

/**
 * Shift-based deduction helper (backward compatible with old attendance cron callers).
 * Wraps the new calculation functions with a simpler interface.
 */
const calculateShiftBasedDeduction = async ({
  baseSalary,
  date,
  lateMinutes       = 0,
  earlyLeaveMinutes = 0,
  isAbsent          = false,
  isHalfDay         = false,
  settings          = null
}) => {
  const defaultSettings = {
    deductions: {
      lateness:   { enabled: true, method: 'per_hour', graceMinutes: 5, ratePerHour: 500 },
      earlyLeave: { enabled: true, method: 'per_hour', graceMinutes: 5, ratePerHour: 500 },
      absence:    { enabled: true, method: 'full_day' }
    },
    processing: { standardWorkingDays: 26, workingHoursPerDay: 8 }
  };
  const useSettings = settings || defaultSettings;

  const [year, month] = date.split('-').map(Number);
  const workingDays   = await calculateWorkingDaysForMonth(year, month);
  const rates         = calculateRates(baseSalary, workingDays, useSettings.processing?.workingHoursPerDay || 8);
  const dailyGross    = baseSalary / workingDays;

  const deductions   = [];
  let totalDeduction = 0;

  if (lateMinutes > 0) {
    const r = calculateLatenessDeduction(lateMinutes, rates.dailyRate, useSettings);
    if (r.amount > 0) {
      deductions.push({ type: 'late', minutes: lateMinutes, amount: r.amount, description: r.details?.calculation || `Late ${lateMinutes} min` });
      totalDeduction += r.amount;
    }
  }

  if (earlyLeaveMinutes > 0) {
    const r = calculateEarlyLeaveDeduction(earlyLeaveMinutes, rates.dailyRate, useSettings);
    if (r.amount > 0) {
      deductions.push({ type: 'early_leave', minutes: earlyLeaveMinutes, amount: r.amount, description: r.details?.calculation || `Early leave ${earlyLeaveMinutes} min` });
      totalDeduction += r.amount;
    }
  }

  if (isAbsent) {
    const r = calculateAbsenceDeduction(rates.dailyRate, dailyGross, useSettings, isHalfDay);
    if (r.amount > 0) {
      deductions.push({ type: 'absent', amount: r.amount, description: r.details?.calculation || (isHalfDay ? 'Half-day absence' : 'Full-day absence') });
      totalDeduction += r.amount;
    }
  }

  return { deductions, totalDeduction, rates, workingDays, shiftHours: useSettings.processing?.workingHoursPerDay || 8 };
};

// ============================================
// EXPORTS
// ============================================
module.exports = {
  // Utilities
  calculateWorkingDaysForMonth,
  calculateRates,
  applyGracePeriod,
  roundAmount,

  // Deductions
  calculateLatenessDeduction,
  calculateEarlyLeaveDeduction,
  calculateAbsenceDeduction,

  // Statutory
  calculatePAYE,
  calculatePension,
  calculateNHF,
  calculateNHIS,
  calculateITF,
  calculateNSITF,

  // Earnings
  calculateOvertimePay,
  calculateGrossSalary,

  // Orchestrator
  calculateEmployeePayroll,

  // Legacy
  calculateShiftBasedDeduction
};
