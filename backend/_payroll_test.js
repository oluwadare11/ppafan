// Payroll backend smoke tests — run with: node _payroll_test.js
// Deletes itself cleanly, no DB required for pure-logic tests.

const calc = require('./utils/payrollCalculations');

const mockStaff = {
  _id:         'staff001',
  employeeId:  'EMP001',
  firstName:   'Chidi',
  lastName:    'Okafor',
  email:       'chidi@pumphouse.com',
  baseSalary:  200000,
  payroll: {
    allowances: [
      { code: 'HOUSING',   name: 'Housing Allowance',  amount: 50000, isPensionable: true,  isActive: true, calculationType: 'fixed' },
      { code: 'TRANSPORT', name: 'Transport Allowance', amount: 30000, isPensionable: true,  isActive: true, calculationType: 'fixed' },
      { code: 'MEAL',      name: 'Meal Allowance',      amount: 15000, isPensionable: false, isActive: true, calculationType: 'fixed' }
    ]
  }
};

const mockSettings = {
  statutory: {
    paye: {
      enabled: true,
      cra: { fixedAmount: 200000, percentageOfGross: 0, additionalPercentage: 1, useHigherOf: true },
      taxBrackets: [
        { minIncome: 0,         maxIncome: 800000,    rate: 0  },
        { minIncome: 800000,    maxIncome: 3000000,   rate: 15 },
        { minIncome: 3000000,   maxIncome: 12000000,  rate: 18 },
        { minIncome: 12000000,  maxIncome: 25000000,  rate: 21 },
        { minIncome: 25000000,  maxIncome: 50000000,  rate: 23 },
        { minIncome: 50000000,  maxIncome: null,       rate: 25 }
      ],
      minimumTaxRate: 1, minimumTaxThreshold: 800000, annualCalculation: true
    },
    pension: { enabled: true, employeeRate: 8, employerRate: 10, pensionableComponents: ['basic', 'housing', 'transport'] },
    nhf:     { enabled: false },
    nhis:    { enabled: false },
    itf:     { enabled: false },
    nsitf:   { enabled: false }
  },
  deductions: {
    lateness: {
      enabled: true, graceMinutes: 5, graceMode: 'threshold', method: 'salary_based',
      ratePerMinute: 0, ratePerHour: 500, roundUpToHour: false,
      percentageOfDaily: 0, flatFee: 0, tiers: [], maxDailyDeduction: null
    },
    absence: {
      enabled: true, method: 'salary_based', customAmount: 0,
      percentageOfDaily: 100, includeAllowances: false
    },
    earlyLeave: {
      enabled: true, graceMinutes: 5, graceMode: 'threshold', method: 'salary_based',
      ratePerMinute: 0, ratePerHour: 500, roundUpToHour: false,
      percentageOfDaily: 0, flatFee: 0, maxDailyDeduction: null
    }
  },
  modules:  { attendanceDeductions: true, overtime: true, loans: true },
  overtime: {
    enabled: false, calculationBase: 'basic_only',
    rates: { weekday: 1.5, weekend: 2.0, holiday: 2.5, nightShift: 1.25 },
    nightShiftDefinition: { startHour: 22, endHour: 6 },
    maxHoursPerMonth: 50, requiresApproval: false, minimumMinutes: 30
  },
  leave: {
    unpaidLeave: { method: 'daily_rate', percentageOfDaily: 100, calculationBase: 'gross' },
    encashment:  { enabled: false }
  },
  processing: {
    standardWorkingDays: 26, workingHoursPerDay: 8,
    workingDaysDefinition: ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'],
    paymentCycle: 'monthly', paymentDay: 28, cutoffDay: 25,
    autoGenerateOnCutoff: false,
    approval: { requireApproval: true, approvalLevels: 1, autoApproveBelow: 0 },
    rounding: { enabled: true, method: 'nearest', precision: 0 }
  },
  salaryComponents: [],
  loans: { enabled: true, maxLoanPercentage: 50, maxRepaymentPercentage: 33, interestRate: 0, maxTenureMonths: 12 }
};

// 5-day attendance sample: 1 late, 1 absent, 1 early-leave, 2 normal
const mockAttendance = [
  { date: '2026-03-02', checkIn: '08:05', checkOut: '17:00', lateMinutes: 5,  earlyLeaveMinutes: 0,  absent: false, isHalfDay: false }, // grace — no deduction
  { date: '2026-03-03', checkIn: '07:55', checkOut: '17:00', lateMinutes: 0,  earlyLeaveMinutes: 0,  absent: false, isHalfDay: false }, // on time
  { date: '2026-03-04', checkIn: null,    checkOut: null,    lateMinutes: 0,  earlyLeaveMinutes: 0,  absent: true,  isHalfDay: false }, // absent
  { date: '2026-03-05', checkIn: '08:25', checkOut: '17:00', lateMinutes: 25, earlyLeaveMinutes: 0,  absent: false, isHalfDay: false }, // late (beyond grace)
  { date: '2026-03-06', checkIn: '08:00', checkOut: '16:00', lateMinutes: 0,  earlyLeaveMinutes: 60, absent: false, isHalfDay: false }, // early leave 60 min
];

// ── Helpers ──────────────────────────────────────────────────────────────────
let passed = 0, failed = 0;

function assert(condition, label, detail = '') {
  if (condition) {
    console.log(`  ✓  ${label}`);
    passed++;
  } else {
    console.error(`  ✗  ${label}${detail ? ' — ' + detail : ''}`);
    failed++;
  }
}

function fmt(n) { return (n || 0).toLocaleString(); }

// ── Test 1: calculateRates ────────────────────────────────────────────────────
console.log('\n[1] calculateRates');
const rates = calc.calculateRates(200000, 26, 8);
assert(rates.dailyRate  > 0,  'dailyRate is positive',              `got ${rates.dailyRate}`);
assert(rates.hourlyRate > 0,  'hourlyRate is positive',             `got ${rates.hourlyRate}`);
assert(rates.minuteRate > 0,  'minuteRate is positive',             `got ${rates.minuteRate}`);
assert(Math.round(rates.dailyRate) === 7692, 'dailyRate ≈ 7692',   `got ${Math.round(rates.dailyRate)}`);

// ── Test 2: calculatePAYE ─────────────────────────────────────────────────────
console.log('\n[2] calculatePAYE');
// Annual gross 200k*12 + 95k*12 = 3,540,000 — crosses into 18% bracket
const annualGross = (200000 + 50000 + 30000 + 15000) * 12; // 3,540,000
const payeResult  = calc.calculatePAYE(annualGross, mockSettings);
assert(payeResult.amount      > 0,      'PAYE computed',             `annual tax: ${fmt(payeResult.amount)}`);
assert(payeResult.monthlyAmount > 0,    'monthly PAYE computed',      `monthly: ${fmt(payeResult.monthlyAmount)}`);
assert(payeResult.details?.taxableIncome > 0, 'taxableIncome > 0', `taxable: ${fmt(payeResult.details?.taxableIncome)}`);
console.log(`     Annual gross: ₦${fmt(annualGross)}  →  Annual PAYE: ₦${fmt(payeResult.amount)}  Monthly: ₦${fmt(payeResult.monthlyAmount)}`);

// ── Test 3: calculatePension ──────────────────────────────────────────────────
console.log('\n[3] calculatePension');
const pensionResult = calc.calculatePension(200000, 50000, 30000, mockSettings);
assert(pensionResult.employeeAmount > 0, 'employee pension > 0',  `${fmt(pensionResult.employeeAmount)}`);
assert(pensionResult.employerAmount > 0, 'employer pension > 0',  `${fmt(pensionResult.employerAmount)}`);
console.log(`     Pensionable: ₦${fmt(pensionResult.details?.pensionableIncome)}  Employee: ₦${fmt(pensionResult.employeeAmount)}  Employer: ₦${fmt(pensionResult.employerAmount)}`);

// ── Test 4: calculateLatenessDeduction ───────────────────────────────────────
console.log('\n[4] calculateLatenessDeduction');
const dailyRate    = rates.dailyRate;
const lateResult5  = calc.calculateLatenessDeduction(5, dailyRate, mockSettings);   // at grace boundary
const lateResult25 = calc.calculateLatenessDeduction(25, dailyRate, mockSettings);  // beyond grace
assert(lateResult5.amount  === 0, '5-min late (grace=5, threshold mode) = ₦0', `got ${lateResult5.amount}`);
assert(lateResult25.amount > 0,   '25-min late gives a deduction',               `got ₦${fmt(lateResult25.amount)}`);
console.log(`     25-min late deduction: ₦${fmt(lateResult25.amount)}`);

// ── Test 5: calculateAbsenceDeduction ────────────────────────────────────────
console.log('\n[5] calculateAbsenceDeduction');
const absenceResult = calc.calculateAbsenceDeduction(dailyRate, dailyRate, mockSettings, false);
assert(absenceResult.amount > 0, 'full-day absence deduction > 0', `got ₦${fmt(absenceResult.amount)}`);
console.log(`     Full-day absence deduction: ₦${fmt(absenceResult.amount)}`);

// ── Test 6: Full calculateEmployeePayroll pipeline ────────────────────────────
console.log('\n[6] calculateEmployeePayroll (full pipeline)');

calc.calculateEmployeePayroll({
  staff:           mockStaff,
  settings:        mockSettings,
  attendanceData:  mockAttendance,
  overtimeRecords: [],
  leaveData:       { unpaidDays: 0, unpaidDeduction: 0 },
  period:          '2026-03',
  workingDays:     26,
  staffCount:      1
}).then(result => {
  assert(result.success,                              'calculation succeeded');
  assert(result.name === 'Chidi Okafor',             'employee name correct');

  const s = result.payrollSummary;
  assert(s.basicSalary    === 200000,                'basic salary = 200k');
  assert(s.totalAllowances > 0,                     'allowances > 0',              `${fmt(s.totalAllowances)}`);
  assert(s.grossSalary     > 200000,                'gross > basic',               `₦${fmt(s.grossSalary)}`);
  assert(s.totalStatutoryDeductions > 0,            'statutory deductions > 0',    `₦${fmt(s.totalStatutoryDeductions)}`);
  assert(s.netPay > 0,                              'net pay > 0',                 `₦${fmt(s.netPay)}`);
  assert(s.netPay < s.grossSalary,                  'net pay < gross pay');

  const ad = result.attendanceData;
  assert(ad.absentDays  === 1,                      '1 absent day',                `got ${ad.absentDays}`);
  assert(ad.lateDays    === 2,                      '2 late days (5min+25min recorded)',`got ${ad.lateDays}`);

  const od = result.otherDeductions;
  assert(od.absence?.totalAmount  > 0,              'absence deduction > 0',       `₦${fmt(od.absence?.totalAmount)}`);
  assert(od.lateness?.totalAmount > 0,              'lateness deduction > 0',      `₦${fmt(od.lateness?.totalAmount)}`);
  assert(od.earlyLeave?.totalAmount >= 0,           'early leave deduction >= 0',  `₦${fmt(od.earlyLeave?.totalAmount)}`);

  console.log('\n  ── Payroll Summary ──────────────────────────────────');
  console.log(`  Basic Salary       : ₦${fmt(s.basicSalary)}`);
  console.log(`  Total Allowances   : ₦${fmt(s.totalAllowances)}`);
  console.log(`  Gross Salary       : ₦${fmt(s.grossSalary)}`);
  console.log(`  PAYE               : ₦${fmt(result.statutoryDeductions.paye.monthlyAmount)}`);
  console.log(`  Pension (employee) : ₦${fmt(result.statutoryDeductions.pension.employeeAmount)}`);
  console.log(`  Pension (employer) : ₦${fmt(result.statutoryDeductions.pension.employerAmount)}`);
  console.log(`  Total Statutory    : ₦${fmt(s.totalStatutoryDeductions)}`);
  console.log(`  Lateness Deduction : ₦${fmt(od.lateness?.totalAmount)}`);
  console.log(`  Early Leave Deduct : ₦${fmt(od.earlyLeave?.totalAmount)}`);
  console.log(`  Absence Deduction  : ₦${fmt(od.absence?.totalAmount)}`);
  console.log(`  Total Other        : ₦${fmt(s.totalOtherDeductions)}`);
  console.log(`  Net Pay            : ₦${fmt(s.netPay)}`);
  console.log(`  Attendance         : ${ad.presentDays} present / ${ad.absentDays} absent / ${ad.lateDays} late`);
  console.log('  ──────────────────────────────────────────────────────');

  // ── Final summary ─────────────────────────────────────────────────────────
  console.log(`\n${'─'.repeat(55)}`);
  if (failed === 0) {
    console.log(`✅  All ${passed} tests passed`);
  } else {
    console.log(`❌  ${failed} test(s) FAILED — ${passed} passed`);
    process.exit(1);
  }

}).catch(err => {
  console.error('calculateEmployeePayroll threw:', err.message);
  failed++;
  process.exit(1);
});
