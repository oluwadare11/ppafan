// PPAfan Attendance System - Payroll Routes
// Single-tenant. Ported and adapted from OPSuite payroll infrastructure.

const express  = require('express');
const router   = express.Router();
const logger   = require('../utils/logger');

const Payroll         = require('../models/Payroll');
const PayrollSettings = require('../models/PayrollSettings');
const Loan            = require('../models/Loan');
const getTenantModel  = require('../utils/getTenantModel');
const Staff           = getTenantModel('Staff');
const Attendance      = getTenantModel('Attendance');
const LeaveRequest    = getTenantModel('LeaveRequest');
const Shift           = getTenantModel('Shift');

const {
  calculateEmployeePayroll,
  calculateWorkingDaysForMonth: calcWorkingDaysFromEngine,
  calculatePAYE,
  calculatePension,
  calculateNHF,
  calculateNHIS,
  calculateITF,
  calculateNSITF,
  calculateLatenessDeduction,
  calculateEarlyLeaveDeduction,
  calculateAbsenceDeduction
} = require('../utils/payrollCalculations');

const {
  calculateHistoricalPayroll
} = require('../crons/payroll-cron');

const { sendEmail } = require('../utils/email');

const TENANT_ID = 'ppafan';

// ============================================
// LAGOS TIMEZONE HELPERS
// ============================================

const getLagosDate = (date = null) => {
  const target = date ? new Date(date) : new Date();
  return new Date(target.toLocaleString('en-US', { timeZone: 'Africa/Lagos' }));
};

// ============================================
// PERIOD HELPERS
// ============================================

function parsePeriodString(period) {
  if (!period) return null;
  const match = period.match(/^(\d{4})-(\d{2})$/);
  if (!match) return null;
  const year  = parseInt(match[1]);
  const month = parseInt(match[2]);
  if (year < 2020 || year > 2040 || month < 1 || month > 12) return null;
  return { year, month };
}

// ============================================
// FLATTEN HELPER (nested schema → flat for reports)
// ============================================

function flattenPayrollRecord(r) {
  const loans    = r.otherDeductions?.loans    || [];
  const advances = r.otherDeductions?.advances || [];
  const breakdown = r.deductionBreakdown || [];
  const bdLateness   = breakdown.filter(d => d.type === 'lateness').reduce((s, d) => s + (d.amount || 0), 0);
  const bdEarlyLeave = breakdown.filter(d => d.type === 'early_leave' || d.type === 'earlyLeave').reduce((s, d) => s + (d.amount || 0), 0);
  const bdAbsence    = breakdown.filter(d => d.type === 'absence').reduce((s, d) => s + (d.amount || 0), 0);

  return {
    ...r,
    baseSalary:          r.salaryStructure?.baseSalary || r.baseSalary || 0,
    grossSalary:         r.payrollSummary?.grossSalary || r.grossSalary || 0,
    netSalary:           r.payrollSummary?.netPay      || r.netSalary  || 0,
    totalDeductions:     r.payrollSummary?.totalDeductions || r.totalDeductions || 0,
    totalAllowances:     r.payrollSummary?.totalAllowances || r.totalAllowances || 0,
    overtimePay:         r.payrollSummary?.overtimePay || r.overtimePay || 0,
    totalBonuses:        r.payrollSummary?.totalBonuses || 0,
    paye:                r.statutoryDeductions?.paye?.monthlyTax || r.paye || 0,
    pension:             r.statutoryDeductions?.pension?.employeeContribution || r.pension || 0,
    nhf:                 r.statutoryDeductions?.nhf?.amount || r.nhf || 0,
    nhis:                r.statutoryDeductions?.nhis?.employeeContribution || r.nhis || 0,
    employerPension:     r.statutoryDeductions?.pension?.employerContribution || r.employerPension || 0,
    employerNhis:        r.statutoryDeductions?.nhis?.employerContribution || r.employerNhis || 0,
    latenessDeduction:   r.otherDeductions?.lateness?.amount   || bdLateness   || r.latenessDeduction   || 0,
    earlyLeaveDeduction: r.otherDeductions?.earlyLeave?.amount || bdEarlyLeave || r.earlyLeaveDeduction || 0,
    absenceDeduction:    r.otherDeductions?.absence?.amount    || bdAbsence    || r.absenceDeduction    || 0,
    unpaidLeaveDeduction: r.otherDeductions?.unpaidLeave?.amount || r.unpaidLeaveDeduction || 0,
    unpaidLeaveDays:     r.otherDeductions?.unpaidLeave?.days  || r.unpaidLeaveDays || 0,
    loanDeduction:       loans.reduce((s, l) => s + (l.monthlyDeduction || 0), 0) || r.loanDeduction || 0,
    advanceDeduction:    advances.reduce((s, a) => s + (a.amount || 0), 0) || r.advanceDeduction || 0,
    otherDeductionsAmount: (r.otherDeductions?.other || []).reduce((s, o) => s + (o.amount || 0), 0),
    presentDays:         r.attendanceData?.presentDays || r.presentDays || 0,
    absentDays:          r.attendanceData?.absentDays  || r.absentDays  || 0,
    lateDays:            r.attendanceData?.lateDays    || r.lateDays    || 0
  };
}

// ============================================
// AVAILABLE PERIODS
// ============================================

router.get('/available-periods', async (req, res) => {
  try {
    const now           = new Date();
    const currentPeriod = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    const periods = await Payroll.distinct('period', {
      calculationType: { $in: ['monthly', 'historical'] },
      status: { $in: ['generated', 'approved', 'paid'] }
    });

    const sorted = periods
      .filter(p => p && p.match(/^\d{4}-\d{2}$/) && p <= currentPeriod)
      .sort((a, b) => b.localeCompare(a));

    res.json({ periods: sorted, count: sorted.length });
  } catch (err) {
    logger.error('Error fetching available periods', { tenantId: TENANT_ID, error: err.message });
    res.status(500).json({ error: 'SERVER_ERROR', message: err.message });
  }
});

// ============================================
// SETTINGS
// ============================================

// GET settings
router.get('/settings', async (req, res) => {
  try {
    let settings = await PayrollSettings.findOne({ tenantId: TENANT_ID, isActive: true });
    if (!settings) {
      settings = new PayrollSettings({ tenantId: TENANT_ID, isActive: true });
      await settings.save();
    }

    const now = getLagosDate();
    const dynamicWorkingDays = await calcWorkingDaysFromEngine(now.getFullYear(), now.getMonth() + 1);

    const settingsObj = settings.toObject();
    // Strip legacy CRA fields — abolished under NTA 2025 (safety net for stale DB docs)
    if (settingsObj.statutory?.paye) {
      delete settingsObj.statutory.paye.cra;
      delete settingsObj.statutory.paye.reliefMethod;
    }

    res.json({
      ...settingsObj,
      dynamicWorkingDays,
      currentMonth:    `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`,
      enabledFeatures: settings.getEnabledFeatures ? settings.getEnabledFeatures() : null,
      lastUpdated:     settings.updatedAt || new Date()
    });
  } catch (err) {
    logger.error('Error fetching payroll settings', { tenantId: TENANT_ID, error: err.message });
    res.status(500).json({ error: 'SERVER_ERROR', message: err.message });
  }
});

// PUT full settings update
router.put('/settings', async (req, res) => {
  try {
    let settings = await PayrollSettings.findOne({ tenantId: TENANT_ID, isActive: true });
    if (!settings) {
      settings = new PayrollSettings({ tenantId: TENANT_ID, isActive: true });
    }

    // Merge top-level keys from body (excluding tenantId and isActive)
    const { tenantId: _t, isActive: _a, ...updates } = req.body;
    Object.assign(settings, updates);
    settings.lastModifiedBy = req.user?.username || 'system';
    await settings.save();

    res.json({ success: true, message: 'Settings updated', settings });
  } catch (err) {
    logger.error('Error updating payroll settings', { tenantId: TENANT_ID, error: err.message });
    res.status(500).json({ error: 'SERVER_ERROR', message: err.message });
  }
});

// PATCH statutory settings
router.patch('/settings/statutory/:type', async (req, res) => {
  try {
    const { type } = req.params;
    const validTypes = ['paye', 'pension', 'nhf', 'nhis', 'itf', 'nsitf'];
    if (!validTypes.includes(type)) {
      return res.status(400).json({ error: 'INVALID_TYPE', message: `Valid types: ${validTypes.join(', ')}` });
    }

    const settings = await PayrollSettings.findOne({ tenantId: TENANT_ID, isActive: true });
    if (!settings) return res.status(404).json({ error: 'NO_SETTINGS' });

    Object.assign(settings.statutory[type], req.body);
    settings.lastModifiedBy = req.user?.username || 'system';
    await settings.save();

    res.json({ success: true, message: `${type.toUpperCase()} settings updated`, [type]: settings.statutory[type] });
  } catch (err) {
    res.status(500).json({ error: 'SERVER_ERROR', message: err.message });
  }
});

// PATCH deduction settings
router.patch('/settings/deductions', async (req, res) => {
  try {
    const settings = await PayrollSettings.findOne({ tenantId: TENANT_ID, isActive: true });
    if (!settings) return res.status(404).json({ error: 'NO_SETTINGS' });

    const { lateness, absence, earlyLeave } = req.body;
    if (lateness)   Object.assign(settings.deductions.lateness,   lateness);
    if (absence)    Object.assign(settings.deductions.absence,    absence);
    if (earlyLeave) Object.assign(settings.deductions.earlyLeave, earlyLeave);
    settings.lastModifiedBy = req.user?.username || 'system';
    await settings.save();

    res.json({ success: true, message: 'Deduction settings updated', deductions: settings.deductions });
  } catch (err) {
    res.status(500).json({ error: 'SERVER_ERROR', message: err.message });
  }
});

// PATCH overtime settings
router.patch('/settings/overtime', async (req, res) => {
  try {
    const settings = await PayrollSettings.findOne({ tenantId: TENANT_ID, isActive: true });
    if (!settings) return res.status(404).json({ error: 'NO_SETTINGS' });

    Object.assign(settings.overtime, req.body);
    settings.lastModifiedBy = req.user?.username || 'system';
    await settings.save();

    res.json({ success: true, message: 'Overtime settings updated', overtime: settings.overtime });
  } catch (err) {
    res.status(500).json({ error: 'SERVER_ERROR', message: err.message });
  }
});

// PATCH salary components
router.patch('/settings/salary-components', async (req, res) => {
  try {
    const settings = await PayrollSettings.findOne({ tenantId: TENANT_ID, isActive: true });
    if (!settings) return res.status(404).json({ error: 'NO_SETTINGS' });

    const { components } = req.body;
    if (!Array.isArray(components)) {
      return res.status(400).json({ error: 'INVALID_BODY', message: 'components must be an array' });
    }
    settings.salaryComponents = components;
    settings.lastModifiedBy   = req.user?.username || 'system';
    await settings.save();

    res.json({ success: true, message: 'Salary components updated', salaryComponents: settings.salaryComponents });
  } catch (err) {
    res.status(500).json({ error: 'SERVER_ERROR', message: err.message });
  }
});

// PATCH processing settings
router.patch('/settings/processing', async (req, res) => {
  try {
    const settings = await PayrollSettings.findOne({ tenantId: TENANT_ID, isActive: true });
    if (!settings) return res.status(404).json({ error: 'NO_SETTINGS' });

    Object.assign(settings.processing, req.body);
    settings.lastModifiedBy = req.user?.username || 'system';
    await settings.save();

    res.json({ success: true, message: 'Processing settings updated', processing: settings.processing });
  } catch (err) {
    res.status(500).json({ error: 'SERVER_ERROR', message: err.message });
  }
});

// ============================================
// STAFF PAYROLL SETUP
// ============================================

// List all staff with their payroll configuration
router.get('/staff-setup', async (req, res) => {
  try {
    const staff = await Staff.find({
      employeeId: { $not: /^CONFIG_/ }
    }).sort({ firstName: 1 }).lean();

    const staffWithPayroll = staff.map(s => {
      const fullName = `${s.firstName} ${s.lastName || ''}`.trim();
      return {
        _id:          s._id,
        employeeId:   s.employeeId,
        name:         fullName,
        fullName,
        firstName:    s.firstName || '',
        lastName:     s.lastName  || '',
        department:   s.department  || 'N/A',
        position:     s.position    || 'N/A',
        status:       s.status,
        baseSalary:   s.baseSalary  || 0,
        allowances:   s.payroll?.allowances    || [],
        exemptions:   s.payroll?.exemptions    || {},
        taxReliefs:   s.payroll?.taxReliefs    || {},
        statutoryInfo: s.payroll?.statutoryInfo || {},
        bankDetails:  s.bankDetails || s.payroll?.bankDetails || {},
        isConfigured: (s.baseSalary || 0) > 0
      };
    });

    res.json({ success: true, staff: staffWithPayroll, count: staffWithPayroll.length });
  } catch (err) {
    logger.error('Error fetching staff payroll setup', { tenantId: TENANT_ID, error: err.message });
    res.status(500).json({ error: 'SERVER_ERROR', message: err.message });
  }
});

// Get single staff payroll setup
router.get('/staff-setup/:staffId', async (req, res) => {
  try {
    const staffMember = await Staff.findById(req.params.staffId).lean();
    if (!staffMember) return res.status(404).json({ error: 'STAFF_NOT_FOUND' });

    const fullName = `${staffMember.firstName} ${staffMember.lastName || ''}`.trim();
    res.json({
      success: true,
      staff: {
        _id:          staffMember._id,
        employeeId:   staffMember.employeeId,
        name:         fullName,
        fullName,
        firstName:    staffMember.firstName || '',
        lastName:     staffMember.lastName  || '',
        department:   staffMember.department || 'N/A',
        position:     staffMember.position   || 'N/A',
        baseSalary:   staffMember.baseSalary || 0,
        allowances:   staffMember.payroll?.allowances    || [],
        exemptions:   staffMember.payroll?.exemptions    || {},
        taxReliefs:   staffMember.payroll?.taxReliefs    || {},
        statutoryInfo: staffMember.payroll?.statutoryInfo || {},
        bankDetails:  staffMember.bankDetails || staffMember.payroll?.bankDetails || {}
      }
    });
  } catch (err) {
    res.status(500).json({ error: 'SERVER_ERROR', message: err.message });
  }
});

// Update single staff payroll setup
router.put('/staff-setup/:staffId', async (req, res) => {
  try {
    const { baseSalary, allowances, bankDetails, exemptions, taxReliefs, statutoryInfo } = req.body;

    const staffMember = await Staff.findById(req.params.staffId);
    if (!staffMember) return res.status(404).json({ error: 'STAFF_NOT_FOUND' });

    if (!staffMember.payroll) staffMember.payroll = {};
    if (baseSalary     !== undefined) staffMember.baseSalary              = Number(baseSalary);
    if (allowances     !== undefined) staffMember.payroll.allowances       = allowances;
    if (bankDetails    !== undefined) staffMember.bankDetails              = bankDetails;
    if (exemptions     !== undefined) staffMember.payroll.exemptions       = exemptions;
    if (taxReliefs     !== undefined) staffMember.payroll.taxReliefs       = taxReliefs;
    if (statutoryInfo  !== undefined) staffMember.payroll.statutoryInfo    = statutoryInfo;

    staffMember.payroll.lastUpdated = new Date();
    await staffMember.save();

    res.json({ success: true, message: 'Staff payroll configuration updated', staff: staffMember });
  } catch (err) {
    res.status(500).json({ error: 'SERVER_ERROR', message: err.message });
  }
});

// Bulk update staff payroll setup
router.post('/staff-setup/bulk-update', async (req, res) => {
  try {
    const { updates } = req.body;
    if (!Array.isArray(updates) || updates.length === 0) {
      return res.status(400).json({ error: 'MISSING_UPDATES', message: 'updates array is required' });
    }

    const results = { success: 0, failed: 0, errors: [] };

    for (const update of updates) {
      try {
        const staffMember = await Staff.findOne({ employeeId: update.employeeId });
        if (!staffMember) {
          results.failed++;
          results.errors.push(`${update.employeeId}: not found`);
          continue;
        }

        if (update.baseSalary !== undefined) staffMember.baseSalary = Number(update.baseSalary);
        if (update.allowances !== undefined) {
          if (!staffMember.payroll) staffMember.payroll = {};
          staffMember.payroll.allowances = update.allowances;
        }
        if (update.bankDetails !== undefined) staffMember.bankDetails = update.bankDetails;

        await staffMember.save();
        results.success++;
      } catch (staffErr) {
        results.failed++;
        results.errors.push(`${update.employeeId}: ${staffErr.message}`);
      }
    }

    res.json({ success: true, message: 'Bulk update completed', results });
  } catch (err) {
    res.status(500).json({ error: 'SERVER_ERROR', message: err.message });
  }
});

// ============================================
// ATTENDANCE DEDUCTIONS PREVIEW
// ============================================

router.get('/deductions', async (req, res) => {
  try {
    const { period } = req.query;
    const now           = getLagosDate();
    const targetPeriod  = period || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const parsed        = parsePeriodString(targetPeriod);
    if (!parsed) return res.status(400).json({ error: 'INVALID_PERIOD' });

    const { year, month } = parsed;
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const endDate   = `${year}-${String(month).padStart(2, '0')}-${new Date(year, month, 0).getDate().toString().padStart(2, '0')}`;

    const attendanceRecords = await Attendance.find({
      date:       { $gte: startDate, $lte: endDate },
      employeeId: { $not: /^(HOLIDAY|LEAVE_)/ },
      $or: [{ absent: true }, { late: true, lateMinutes: { $gt: 0 } }, { earlyLeave: true, earlyLeaveMinutes: { $gt: 0 } }]
    }).lean();

    res.json({
      success: true,
      period:  targetPeriod,
      count:   attendanceRecords.length,
      records: attendanceRecords
    });
  } catch (err) {
    res.status(500).json({ error: 'SERVER_ERROR', message: err.message });
  }
});

// ============================================
// PAYROLL SUMMARY (dashboard widget)
// ============================================

router.get('/summary', async (req, res) => {
  try {
    const settings    = await PayrollSettings.findOne({ tenantId: TENANT_ID, isActive: true });
    const paymentDay  = settings?.processing?.paymentDay  || 28;
    const paymentCycle = settings?.processing?.paymentCycle || 'monthly';

    const today = new Date();
    let nextPaymentDate = new Date(today.getFullYear(), today.getMonth(), paymentDay);
    if (today.getDate() > paymentDay) {
      nextPaymentDate = new Date(today.getFullYear(), today.getMonth() + 1, paymentDay);
    }

    const currentPeriod  = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
    const currentPayroll = await Payroll.find({ period: currentPeriod });

    const totalDue       = currentPayroll.reduce((s, p) => s + (p.payrollSummary?.netPay || 0), 0);
    const pendingCount   = currentPayroll.filter(p => ['draft', 'pending_approval'].includes(p.status)).length;
    const approvedCount  = currentPayroll.filter(p => p.status === 'approved').length;
    const paidCount      = currentPayroll.filter(p => p.status === 'paid').length;

    const totalStaff      = await Staff.countDocuments({ status: 'active', employeeId: { $not: /^CONFIG_/ } });
    const configuredStaff = await Staff.countDocuments({ status: 'active', employeeId: { $not: /^CONFIG_/ }, baseSalary: { $gt: 0 } });

    const lastMonth  = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const lastPeriod = `${lastMonth.getFullYear()}-${String(lastMonth.getMonth() + 1).padStart(2, '0')}`;
    const lastPayroll = await Payroll.find({ period: lastPeriod });
    const lastTotalDue = lastPayroll.reduce((s, p) => s + (p.payrollSummary?.netPay || 0), 0);

    const trend = lastTotalDue > 0 ? parseFloat(((totalDue - lastTotalDue) / lastTotalDue * 100).toFixed(1)) : 0;

    res.json({
      nextPaymentDate: nextPaymentDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
      paymentDay,
      paymentCycle,
      totalDue,
      pendingCount,
      processedCount: approvedCount + paidCount,
      approvedCount,
      paidCount,
      currentPeriod,
      staffSummary: { total: totalStaff, configured: configuredStaff, unconfigured: totalStaff - configuredStaff },
      trend,
      hasPayrollData:     currentPayroll.length > 0,
      settingsConfigured: !!settings
    });
  } catch (err) {
    logger.error('Error fetching payroll summary', { tenantId: TENANT_ID, error: err.message });
    res.status(500).json({ error: 'SERVER_ERROR', message: err.message });
  }
});

// ============================================
// SYSTEM STATUS
// ============================================

router.get('/system-status', async (req, res) => {
  try {
    const settings        = await PayrollSettings.findOne({ tenantId: TENANT_ID, isActive: true });
    const staffWithSalary = await Staff.countDocuments({ baseSalary: { $gt: 0 }, employeeId: { $not: /^CONFIG_/ } });
    const lastPayroll     = await Payroll.findOne({ status: { $in: ['generated', 'approved', 'paid'] } }).sort({ updatedAt: -1 });

    res.json({
      success: true,
      status: {
        settingsConfigured: !!settings,
        staffConfigured:    staffWithSalary > 0,
        staffWithSalary,
        lastPayrollPeriod:  lastPayroll?.period || null,
        lastPayrollStatus:  lastPayroll?.status || null,
        isReady:            !!settings && staffWithSalary > 0
      }
    });
  } catch (err) {
    res.status(500).json({ error: 'SERVER_ERROR', message: err.message });
  }
});

// ============================================
// PAYROLL GENERATION (Full statutory calculation)
// ============================================

router.post('/process/generate', async (req, res) => {
  try {
    const { period, regenerate = false } = req.body;

    if (!period) return res.status(400).json({ error: 'MISSING_PERIOD', message: 'Period (YYYY-MM) is required' });
    const parsedPeriod = parsePeriodString(period);
    if (!parsedPeriod) return res.status(400).json({ error: 'INVALID_PERIOD', message: 'Period must be YYYY-MM' });

    // Guard against overwriting non-draft payroll without explicit regenerate flag
    const existingPayroll = await Payroll.findOne({
      tenantId: TENANT_ID,
      period,
      calculationType: 'monthly',
      status: { $in: ['generated', 'pending_approval', 'approved', 'paid'] }
    });

    if (existingPayroll && !regenerate) {
      return res.status(409).json({
        error:  'PAYROLL_EXISTS',
        message: `Payroll for ${period} already exists with status: ${existingPayroll.status}`,
        status: existingPayroll.status,
        hint:   'Set regenerate=true to overwrite'
      });
    }

    const settings = await PayrollSettings.findOne({ tenantId: TENANT_ID, isActive: true });
    if (!settings) return res.status(400).json({ error: 'NO_SETTINGS', message: 'Payroll settings not configured' });

    const staff = await Staff.find({
      baseSalary: { $exists: true, $gt: 0 },
      employeeId: { $not: /^CONFIG_/ },
      status:     'active'
    });
    if (staff.length === 0) return res.status(400).json({ error: 'NO_STAFF', message: 'No active staff with salaries' });

    const { year, month } = parsedPeriod;
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const lastDay   = new Date(year, month, 0).getDate();
    const endDate   = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

    const workingDays = await calcWorkingDaysFromEngine(year, month);

    const attendanceRecords = await Attendance.find({
      date:       { $gte: startDate, $lte: endDate },
      employeeId: { $not: /^(HOLIDAY|LEAVE_)/ }
    });

    // Fetch active loans for this period
    const activeLoans = await Loan.find({ tenantId: TENANT_ID, status: 'active', startPeriod: { $lte: period } });

    // Fetch approved unpaid leave requests
    const unpaidLeaveMap = {};
    try {
      const unpaidLeaves = await LeaveRequest.find({
        tenantId:  TENANT_ID,
        leaveType: 'unpaid',
        status:    'approved',
        $or: [
          { startDate: { $gte: startDate, $lte: endDate } },
          { endDate:   { $gte: startDate, $lte: endDate } },
          { startDate: { $lte: startDate }, endDate: { $gte: endDate } }
        ]
      }).lean();

      for (const leave of unpaidLeaves) {
        const overlapStart = new Date(Math.max(new Date(leave.startDate), new Date(startDate)));
        const overlapEnd   = new Date(Math.min(new Date(leave.endDate),   new Date(endDate)));
        let unpaidDays = 0;
        const d = new Date(overlapStart);
        while (d <= overlapEnd) {
          const day = d.getDay();
          if (day !== 0 && day !== 6) unpaidDays++;
          d.setDate(d.getDate() + 1);
        }
        if (unpaidDays > 0) {
          if (!unpaidLeaveMap[leave.employeeId]) unpaidLeaveMap[leave.employeeId] = { unpaidDays: 0 };
          unpaidLeaveMap[leave.employeeId].unpaidDays += unpaidDays;
        }
      }
    } catch (leaveErr) {
      logger.warn('Unpaid leave fetch failed (non-fatal)', { error: leaveErr.message });
    }

    // Get existing pre-calc records (preserve existing bonuses/overtime)
    const existingRecords = await Payroll.find({ tenantId: TENANT_ID, period, calculationType: 'monthly' });
    const existingRecordMap = {};
    existingRecords.forEach(r => { existingRecordMap[r.employeeNumber] = r; });

    // Pre-fetch permanent shifts for per-staff working hours
    const allEmployeeIds = staff.map(s => s.employeeId);
    const shiftByEmployee = {};
    try {
      const allShifts = await Shift.find({
        employeeId: { $in: allEmployeeIds },
        shiftType:  'permanent',
        isActive:   true
      }).lean();
      allShifts.forEach(shift => {
        if (!shiftByEmployee[shift.employeeId]) shiftByEmployee[shift.employeeId] = shift;
      });
    } catch (_) {}

    const results = { success: 0, failed: 0, errors: [], payrollRecords: [] };

    for (const staffMember of staff) {
      try {
        const memberAttendance = attendanceRecords.filter(
          r => r.employeeId?.toString() === staffMember.employeeId?.toString()
        );

        const attendanceData = memberAttendance.map(r => ({
          date:              r.date,
          checkIn:           r.checkIn,
          checkOut:          r.checkOut,
          lateMinutes:       r.lateMinutes       || 0,
          earlyLeaveMinutes: r.earlyLeaveMinutes  || 0,
          absent:            r.absent             || false,
          isHalfDay:         r.isHalfDay          || false
        }));

        const existingRecord  = existingRecordMap[staffMember.employeeId];
        const existingBonuses = existingRecord?.salaryStructure?.bonuses || [];
        const existingOvertime = existingRecord?.salaryStructure?.overtime || { breakdown: [], totalHours: 0, totalAmount: 0 };

        const staffLoans = activeLoans.filter(l => l.employeeNumber === staffMember.employeeId);

        const employeeLeave = unpaidLeaveMap[staffMember.employeeId] || {};
        const unpaidDays    = employeeLeave.unpaidDays || 0;
        const dailyRate     = staffMember.baseSalary ? staffMember.baseSalary / workingDays : 0;
        const leaveData     = { unpaidDays, unpaidDeduction: Math.round(unpaidDays * dailyRate) };

        // Derive working hours from permanent shift if available
        let staffWorkingHours = settings.processing?.workingHoursPerDay || 8;
        const staffShift      = shiftByEmployee[staffMember.employeeId];
        if (staffShift?.resumptionTime && staffShift?.closingTime) {
          const [rH, rM] = staffShift.resumptionTime.split(':').map(Number);
          const [cH, cM] = staffShift.closingTime.split(':').map(Number);
          const totalMins = (cH * 60 + cM) - (rH * 60 + rM) - (staffShift.breakDuration || 0);
          if (totalMins > 0) staffWorkingHours = totalMins / 60;
        }
        const staffSettings = {
          ...settings.toObject(),
          processing: { ...settings.toObject().processing, workingHoursPerDay: staffWorkingHours }
        };

        const payrollResult = await calculateEmployeePayroll({
          staff:           staffMember,
          settings:        staffSettings,
          attendanceData,
          overtimeRecords: existingOvertime.breakdown || [],
          leaveData,
          period,
          workingDays,
          staffCount:      staff.length
        });

        if (!payrollResult.success) {
          results.failed++;
          results.errors.push({ employeeId: staffMember.employeeId, error: payrollResult.error });
          continue;
        }

        // Compute loan totals
        const loanDeductions  = staffLoans.map(loan => ({
          loanId:           loan._id,
          type:             loan.type,
          description:      loan.description,
          originalAmount:   loan.originalAmount,
          monthlyDeduction: loan.monthlyDeduction,
          balanceBefore:    loan.remainingBalance,
          balanceAfter:     Math.max(0, loan.remainingBalance - loan.monthlyDeduction)
        }));
        const totalLoanDeductions = loanDeductions.reduce((s, l) => s + l.monthlyDeduction, 0);

        // Compute payroll summary including bonuses/overtime/loans
        const bonusTotal    = existingBonuses.reduce((s, b) => s + (b.amount || 0), 0);
        const overtimeTotal = existingOvertime.totalAmount || 0;
        const baseGross     = payrollResult.payrollSummary.grossSalary || 0;
        const adjustedGross = baseGross + bonusTotal + overtimeTotal;
        const baseOther     = payrollResult.payrollSummary.totalOtherDeductions || 0;
        const adjustedOther = baseOther + totalLoanDeductions;

        // Bonus PAYE: compute incremental PAYE for bonus additions (NTA 2025)
        // Bonuses are taxable income — recalculate PAYE on (annual gross + bonus) with
        // the staff's full preTaxDeductions (including taxReliefs) and take the difference.
        let incrementalBonusPAYE = 0;
        if (bonusTotal > 0 && !staffMember.payroll?.exemptions?.paye) {
          const staffTaxReliefs = staffMember.payroll?.taxReliefs || {};
          const annualRentB     = staffTaxReliefs.annualRent || 0;
          const rentReliefB     = Math.min(annualRentB * 0.20, 500000);
          const bonusPreTax = {
            pension:                (payrollResult.statutoryDeductions.pension.employeeAmount || 0) * 12,
            nhf:                    (payrollResult.statutoryDeductions.nhf.amount             || 0) * 12,
            nhis:                   (payrollResult.statutoryDeductions.nhis.employeeAmount    || 0) * 12,
            rentRelief:             rentReliefB,
            annualLifeAssurance:    staffTaxReliefs.annualLifeAssurance    || 0,
            annualMortgageInterest: staffTaxReliefs.annualMortgageInterest || 0,
            voluntaryPensionAVC:    staffTaxReliefs.voluntaryPensionAVC    || 0
          };
          const annualRegularGross = baseGross * 12;
          const payeWithBonus      = calculatePAYE(annualRegularGross + bonusTotal, settings, staffMember.payroll?.exemptions || {}, bonusPreTax);
          incrementalBonusPAYE     = Math.max(0, (payeWithBonus.amount || 0) - (payrollResult.statutoryDeductions.paye.annualAmount || 0));
        }

        const totalStatutory = (payrollResult.payrollSummary.totalStatutoryDeductions || 0) + incrementalBonusPAYE;
        const adjustedTotal  = totalStatutory + adjustedOther;
        const adjustedNet    = Math.max(0, adjustedGross - adjustedTotal);

        const payrollData = {
          tenantId:        TENANT_ID,
          employeeId:      staffMember._id,
          employeeNumber:  staffMember.employeeId,
          employeeName:    payrollResult.name,
          firstName:       staffMember.firstName || '',
          lastName:        staffMember.lastName  || '',
          email:           staffMember.email     || '',
          position:        staffMember.position  || 'N/A',
          department:      staffMember.department || 'N/A',
          period,
          periodStartDate: startDate,
          periodEndDate:   endDate,

          salaryStructure: {
            salaryType: payrollResult.salaryStructure.salaryType || 'monthly',
            baseSalary: payrollResult.salaryStructure.baseSalary,
            allowances: payrollResult.salaryStructure.allowances.map(a => ({
              code:            a.code,
              name:            a.name,
              amount:          a.amount,
              calculationType: a.calculationType || 'fixed',
              isTaxable:       true,
              isPensionable:   false
            })),
            bonuses:  existingBonuses.length > 0 ? existingBonuses : (payrollResult.salaryStructure.bonuses || []),
            overtime: existingOvertime.totalHours > 0 ? existingOvertime : {
              breakdown:   (payrollResult.salaryStructure.overtime?.breakdown || []),
              totalHours:  payrollResult.salaryStructure.overtime?.totalHours || 0,
              totalAmount: payrollResult.salaryStructure.overtime?.totalAmount || 0
            },
            leaveEncashment: {
              days:       payrollResult.leaveData?.encashmentDays || 0,
              ratePerDay: 0,
              amount:     payrollResult.salaryStructure.leaveEncashment || 0
            }
          },

          statutoryDeductions: {
            paye: {
              enabled:           payrollResult.statutoryDeductions.paye.enabled || false,
              grossAnnualIncome: payrollResult.statutoryDeductions.paye.details?.grossAnnualIncome || 0,
              preTaxDeductions:  payrollResult.statutoryDeductions.paye.details?.preTaxDeductions?.total || 0,
              taxableIncome:     payrollResult.statutoryDeductions.paye.details?.taxableIncome || 0,
              // Include incremental PAYE from bonuses in the stored monthly/annual tax
              annualTax:         (payrollResult.statutoryDeductions.paye.annualAmount  || 0) + incrementalBonusPAYE,
              monthlyTax:        (payrollResult.statutoryDeductions.paye.monthlyAmount || 0) + incrementalBonusPAYE
            },
            pension: {
              enabled:              payrollResult.statutoryDeductions.pension.enabled || false,
              pensionableIncome:    payrollResult.statutoryDeductions.pension.details?.pensionableIncome || 0,
              employeeContribution: payrollResult.statutoryDeductions.pension.employeeAmount || 0,
              employeeRate:         payrollResult.statutoryDeductions.pension.details?.employeeRate || 8,
              employerContribution: payrollResult.statutoryDeductions.pension.employerAmount || 0,
              employerRate:         payrollResult.statutoryDeductions.pension.details?.employerRate || 10
            },
            nhf:   { enabled: payrollResult.statutoryDeductions.nhf.enabled   || false, amount: payrollResult.statutoryDeductions.nhf.amount   || 0, rate: payrollResult.statutoryDeductions.nhf.details?.rate   || 2.5 },
            nhis:  { enabled: payrollResult.statutoryDeductions.nhis.enabled  || false, employeeContribution: payrollResult.statutoryDeductions.nhis.employeeAmount || 0, employerContribution: payrollResult.statutoryDeductions.nhis.employerAmount || 0 },
            itf:   { enabled: payrollResult.statutoryDeductions.itf.enabled   || false, amount: payrollResult.statutoryDeductions.itf.amount   || 0, rate: payrollResult.statutoryDeductions.itf.details?.rate   || 1 },
            nsitf: { enabled: payrollResult.statutoryDeductions.nsitf.enabled || false, amount: payrollResult.statutoryDeductions.nsitf.amount || 0, rate: payrollResult.statutoryDeductions.nsitf.details?.rate || 1 },
            totalStatutoryDeductions: totalStatutory
          },

          otherDeductions: {
            lateness:   { amount: payrollResult.otherDeductions.lateness?.totalAmount   || 0, occurrences: payrollResult.otherDeductions.lateness?.count   || 0, totalMinutes: payrollResult.otherDeductions.lateness?.totalMinutes   || 0 },
            earlyLeave: { amount: payrollResult.otherDeductions.earlyLeave?.totalAmount || 0, occurrences: payrollResult.otherDeductions.earlyLeave?.count || 0, totalMinutes: payrollResult.otherDeductions.earlyLeave?.totalMinutes || 0 },
            absence:    { amount: payrollResult.otherDeductions.absence?.totalAmount    || 0, days: payrollResult.otherDeductions.absence?.totalDays || 0 },
            unpaidLeave: { amount: payrollResult.otherDeductions.unpaidLeave?.amount || 0, days: payrollResult.otherDeductions.unpaidLeave?.days || 0 },
            loans:       loanDeductions,
            advances:    [],
            other:       payrollResult.otherDeductions.other || [],
            totalOtherDeductions: adjustedOther
          },

          deductionBreakdown: (payrollResult.otherDeductions.breakdown || []).map(d => ({
            date:        d.date,
            type:        d.type === 'late' ? 'lateness' : d.type,
            amount:      d.amount || 0,
            minutes:     d.details?.originalMinutes || d.minutes || 0,
            days:        d.days || 0,
            description: d.details?.calculation || (typeof d.details === 'string' ? d.details : d.description) || ''
          })),

          attendanceData: {
            presentDays:         payrollResult.attendanceData.presentDays   || 0,
            absentDays:          payrollResult.attendanceData.absentDays    || 0,
            lateDays:            payrollResult.attendanceData.lateDays      || 0,
            earlyLeaveDays:      payrollResult.attendanceData.earlyLeaveDays || 0,
            lateMinutes:         payrollResult.attendanceData.lateMinutes   || 0,
            earlyLeaveMinutes:   payrollResult.attendanceData.earlyLeaveMinutes || 0,
            actualWorkingDays:   payrollResult.attendanceData.recordCount   || 0,
            standardWorkingDays: workingDays
          },

          payrollSummary: {
            basicSalary:             payrollResult.payrollSummary.basicSalary    || 0,
            totalAllowances:         payrollResult.payrollSummary.totalAllowances || 0,
            totalBonuses:            bonusTotal,
            overtimePay:             overtimeTotal,
            leaveEncashment:         payrollResult.salaryStructure.leaveEncashment || 0,
            grossSalary:             adjustedGross,
            totalStatutoryDeductions: totalStatutory,
            totalOtherDeductions:    adjustedOther,
            totalDeductions:         adjustedTotal,
            netPay:                  adjustedNet,
            employerContributions: {
              pension: payrollResult.statutoryDeductions.pension.employerAmount || 0,
              nhis:    payrollResult.statutoryDeductions.nhis.employerAmount    || 0,
              itf:     payrollResult.statutoryDeductions.itf.amount             || 0,
              nsitf:   payrollResult.statutoryDeductions.nsitf.amount           || 0,
              total:   payrollResult.payrollSummary.employerContributions || 0
            },
            totalEmployerCost: adjustedGross + (payrollResult.payrollSummary.employerContributions || 0)
          },

          payment: { status: 'pending', bankDetails: staffMember.bankDetails || staffMember.payroll?.bankDetails || {} },
          status:            'generated',
          calculationType:   'monthly',
          calculationSource: 'api',
          lastCalculated:    new Date(),
          monthStartDate:    startDate,
          monthEndDate:      endDate,
          createdBy:         req.user?.username || 'system',
          lastModifiedBy:    req.user?.username || 'system'
        };

        await Payroll.findOneAndUpdate(
          { tenantId: TENANT_ID, employeeNumber: staffMember.employeeId, period },
          payrollData,
          { upsert: true, new: true, setDefaultsOnInsert: true }
        );

        results.success++;
        results.payrollRecords.push({
          employeeId: staffMember.employeeId,
          name:       payrollResult.name,
          netPay:     payrollData.payrollSummary.netPay
        });

        // Update loan balances
        for (const loan of staffLoans) {
          const newBalance = Math.max(0, loan.remainingBalance - loan.monthlyDeduction);
          await Loan.findByIdAndUpdate(loan._id, {
            remainingBalance: newBalance,
            totalRepaid:      (loan.totalRepaid || 0) + loan.monthlyDeduction,
            ...(newBalance <= 0 ? { status: 'completed' } : {}),
            $push: {
              repayments: {
                period,
                amount: loan.monthlyDeduction,
                date:   new Date(),
                note:   `Auto-deducted from ${period} payroll`
              }
            }
          });
        }

      } catch (staffError) {
        results.failed++;
        results.errors.push({ employeeId: staffMember.employeeId, error: staffError.message });
        logger.error('Staff payroll generation failed', { tenantId: TENANT_ID, employeeId: staffMember.employeeId, error: staffError.message });
      }
    }

    logger.info('Payroll generation completed', {
      tenantId: TENANT_ID,
      period,
      success:     results.success,
      failed:      results.failed,
      generatedBy: req.user?.username
    });

    res.json({
      success:    true,
      message:    `Payroll generated for ${results.success} staff members`,
      period,
      staffCount: results.success,
      failed:     results.failed,
      errors:     results.errors,
      records:    results.payrollRecords
    });
  } catch (err) {
    logger.error('Payroll generation failed', { tenantId: TENANT_ID, error: err.message });
    res.status(500).json({ error: 'SERVER_ERROR', message: err.message });
  }
});

// ============================================
// PAYROLL PROCESS RETRIEVAL
// ============================================

// Get all payroll for a period
router.get('/process/:period', async (req, res) => {
  try {
    const { period } = req.params;
    if (!parsePeriodString(period)) return res.status(400).json({ error: 'INVALID_PERIOD' });

    const records = await Payroll.find({ tenantId: TENANT_ID, period, calculationType: 'monthly' }).sort({ employeeName: 1 });

    if (records.length === 0) {
      return res.status(404).json({ error: 'NO_PAYROLL', message: `No payroll data found for ${period}` });
    }

    const totals = records.reduce((acc, r) => ({
      totalGrossPay:     acc.totalGrossPay     + (r.payrollSummary?.grossSalary || 0),
      totalDeductions:   acc.totalDeductions   + (r.payrollSummary?.totalDeductions || 0),
      totalNetPay:       acc.totalNetPay       + (r.payrollSummary?.netPay || 0),
      totalEmployerCost: acc.totalEmployerCost + (r.payrollSummary?.totalEmployerCost || 0)
    }), { totalGrossPay: 0, totalDeductions: 0, totalNetPay: 0, totalEmployerCost: 0 });

    const statuses     = [...new Set(records.map(r => r.status))];
    const overallStatus = statuses.length === 1 ? statuses[0] : 'mixed';

    res.json({
      success:    true,
      period,
      status:     overallStatus,
      staffCount: records.length,
      totals,
      records: records.map(r => ({
        _id:                 r._id,
        employeeNumber:      r.employeeNumber,
        name:                r.employeeName,
        position:            r.position,
        department:          r.department,
        baseSalary:          r.salaryStructure?.baseSalary || 0,
        grossPay:            r.payrollSummary?.grossSalary   || 0,
        totalDeductions:     r.payrollSummary?.totalDeductions || 0,
        netPay:              r.payrollSummary?.netPay         || 0,
        totalAllowances:     r.payrollSummary?.totalAllowances || 0,
        totalBonuses:        r.payrollSummary?.totalBonuses    || 0,
        overtimePay:         r.payrollSummary?.overtimePay     || 0,
        statutoryDeductions: r.payrollSummary?.totalStatutoryDeductions || 0,
        otherDeductions:     r.payrollSummary?.totalOtherDeductions     || 0,
        status:              r.status,
        bankDetails:         r.payment?.bankDetails || {},
        presentDays:         r.attendanceData?.presentDays || 0,
        absentDays:          r.attendanceData?.absentDays  || 0,
        lateMinutes:         r.attendanceData?.lateMinutes || 0,
        lastCalculated:      r.lastCalculated
      }))
    });
  } catch (err) {
    logger.error('Error fetching period payroll', { tenantId: TENANT_ID, period: req.params.period, error: err.message });
    res.status(500).json({ error: 'SERVER_ERROR', message: err.message });
  }
});

// Get single employee payroll for a period
router.get('/process/:period/:employeeNumber', async (req, res) => {
  try {
    const { period, employeeNumber } = req.params;
    const payroll = await Payroll.findOne({ tenantId: TENANT_ID, period, employeeNumber });
    if (!payroll) return res.status(404).json({ error: 'NOT_FOUND', message: `No payroll for ${employeeNumber} in ${period}` });
    res.json({ success: true, payroll });
  } catch (err) {
    res.status(500).json({ error: 'SERVER_ERROR', message: err.message });
  }
});

// ============================================
// APPROVAL WORKFLOW
// ============================================

// Submit for approval
router.post('/process/:period/submit', async (req, res) => {
  try {
    const { period } = req.params;
    const { notes }  = req.body;

    const settings         = await PayrollSettings.findOne({ tenantId: TENANT_ID, isActive: true });
    const requiresApproval = settings?.processing?.approval?.requireApproval !== false;

    const records = await Payroll.find({ tenantId: TENANT_ID, period, status: 'generated' });
    if (records.length === 0) {
      return res.status(400).json({ error: 'NO_GENERATED_PAYROLL', message: `No generated payroll for ${period}` });
    }

    const newStatus  = requiresApproval ? 'pending_approval' : 'approved';
    const updateData = {
      status:          newStatus,
      submittedBy:     req.user?.username || 'system',
      submittedAt:     new Date(),
      submissionNotes: notes || ''
    };
    if (!requiresApproval) { updateData.approvedBy = 'auto-approved'; updateData.approvedAt = new Date(); }

    await Payroll.updateMany({ tenantId: TENANT_ID, period, status: 'generated' }, { $set: updateData });

    res.json({
      success:        true,
      message:        requiresApproval ? `Payroll for ${period} submitted for approval` : `Payroll for ${period} auto-approved`,
      period,
      status:         newStatus,
      recordsUpdated: records.length
    });
  } catch (err) {
    res.status(500).json({ error: 'SERVER_ERROR', message: err.message });
  }
});

// Approve payroll
router.post('/process/:period/approve', async (req, res) => {
  try {
    const { period } = req.params;
    const { notes }  = req.body;

    const records = await Payroll.find({ tenantId: TENANT_ID, period, status: 'pending_approval' });
    if (records.length === 0) {
      return res.status(400).json({ error: 'NO_PENDING_PAYROLL', message: `No payroll pending approval for ${period}` });
    }

    await Payroll.updateMany(
      { tenantId: TENANT_ID, period, status: 'pending_approval' },
      { $set: { status: 'approved', approvedBy: req.user?.username || 'system', approvedAt: new Date(), approvalNotes: notes || '' } }
    );

    res.json({ success: true, message: `Payroll for ${period} approved`, period, status: 'approved', recordsUpdated: records.length });
  } catch (err) {
    res.status(500).json({ error: 'SERVER_ERROR', message: err.message });
  }
});

// Reject payroll
router.post('/process/:period/reject', async (req, res) => {
  try {
    const { period } = req.params;
    const { reason } = req.body;
    if (!reason) return res.status(400).json({ error: 'REASON_REQUIRED', message: 'Rejection reason is required' });

    const records = await Payroll.find({ tenantId: TENANT_ID, period, status: 'pending_approval' });
    if (records.length === 0) {
      return res.status(400).json({ error: 'NO_PENDING_PAYROLL', message: `No payroll pending approval for ${period}` });
    }

    await Payroll.updateMany(
      { tenantId: TENANT_ID, period, status: 'pending_approval' },
      { $set: { status: 'rejected', rejectedBy: req.user?.username || 'system', rejectedAt: new Date(), rejectionReason: reason } }
    );

    res.json({ success: true, message: `Payroll for ${period} rejected`, period, status: 'rejected', recordsUpdated: records.length, reason });
  } catch (err) {
    res.status(500).json({ error: 'SERVER_ERROR', message: err.message });
  }
});

// ============================================
// PAYSLIPS
// ============================================

// List payslips for a period
router.get('/payslips/list/:period', async (req, res) => {
  try {
    const { period } = req.params;
    const records    = await Payroll.find({
      tenantId: TENANT_ID, period,
      status: { $in: ['generated', 'approved', 'paid'] }
    }).lean();

    if (records.length === 0) return res.json({ payslips: [], count: 0 });

    const payslips = records.map(record => {
      const flat          = flattenPayrollRecord(record);
      const allowancesMap = {};
      (record.salaryStructure?.allowances || []).forEach(a => {
        if (a.name && a.amount) allowancesMap[a.name] = a.amount;
      });

      return {
        employeeNumber: flat.employeeNumber,
        employeeName:   flat.name || flat.employeeName,
        period,
        department:     flat.department,
        position:       flat.position,
        status:         record.status,
        earnings: {
          baseSalary:  flat.baseSalary,
          ...allowancesMap,
          totalBonuses:    flat.totalBonuses || 0,
          overtimePay:     flat.overtimePay  || 0,
          grossSalary:     flat.grossSalary
        },
        deductions: {
          paye:                flat.paye,
          pension:             flat.pension,
          nhf:                 flat.nhf,
          nhis:                flat.nhis,
          latenessDeduction:   flat.latenessDeduction,
          earlyLeaveDeduction: flat.earlyLeaveDeduction,
          absenceDeduction:    flat.absenceDeduction,
          loanDeduction:       flat.loanDeduction,
          totalDeductions:     flat.totalDeductions
        },
        netSalary:      flat.netSalary,
        attendanceSummary: {
          presentDays: flat.presentDays,
          absentDays:  flat.absentDays,
          lateDays:    flat.lateDays
        },
        bankDetails:    record.payment?.bankDetails || {}
      };
    });

    res.json({ success: true, payslips, count: payslips.length, period });
  } catch (err) {
    logger.error('Error listing payslips', { tenantId: TENANT_ID, error: err.message });
    res.status(500).json({ error: 'SERVER_ERROR', message: err.message });
  }
});

// Get single employee payslip
router.get('/payslips/:employeeNumber/:period', async (req, res) => {
  try {
    const { employeeNumber, period } = req.params;
    const record = await Payroll.findOne({ tenantId: TENANT_ID, period, employeeNumber }).lean();
    if (!record) return res.status(404).json({ error: 'NOT_FOUND', message: `No payslip for ${employeeNumber} in ${period}` });

    const flat = flattenPayrollRecord(record);
    res.json({ success: true, payslip: flat });
  } catch (err) {
    res.status(500).json({ error: 'SERVER_ERROR', message: err.message });
  }
});

// ============================================
// PAYMENTS
// ============================================

// Process bulk payment (mark all approved as paid)
router.post('/payments/process', async (req, res) => {
  try {
    const { period, paymentMethod = 'bank_transfer', paymentDate, notes } = req.body;
    if (!period) return res.status(400).json({ error: 'MISSING_PERIOD' });

    const records = await Payroll.find({
      tenantId: TENANT_ID, period,
      status: { $in: ['generated', 'approved'] },
      calculationType: 'monthly'
    });

    if (records.length === 0) {
      return res.status(400).json({ error: 'NO_PAYROLL', message: `No generated payroll found for ${period}` });
    }

    const totalAmount = records.reduce((s, r) => s + (r.payrollSummary?.netPay || 0), 0);
    const paymentRef  = `PAY-${period.replace('-', '')}-${Date.now()}`;

    await Payroll.updateMany(
      { tenantId: TENANT_ID, period, status: { $in: ['generated', 'approved'] }, calculationType: 'monthly' },
      {
        $set: {
          status:                    'paid',
          'payment.status':          'paid',
          'payment.method':          paymentMethod,
          'payment.paymentDate':     paymentDate ? new Date(paymentDate) : new Date(),
          'payment.processedDate':   new Date(),
          'payment.processedBy':     req.user?.username || 'system',
          'payment.paymentReference': paymentRef,
          lastModifiedBy:            req.user?.username || 'system',
          notes:                     notes || ''
        }
      }
    );

    logger.info('Payments processed', { tenantId: TENANT_ID, period, totalAmount, staffCount: records.length, paymentRef });
    res.json({ success: true, message: `Payments processed for ${records.length} staff`, period, paymentReference: paymentRef, paymentMethod, summary: { totalAmount, staffCount: records.length } });
  } catch (err) {
    res.status(500).json({ error: 'SERVER_ERROR', message: err.message });
  }
});

// Get payment status for a period
router.get('/payments/status/:period', async (req, res) => {
  try {
    const { period } = req.params;
    const records    = await Payroll.find({ tenantId: TENANT_ID, period, calculationType: 'monthly' });
    if (records.length === 0) return res.status(404).json({ error: 'NO_PAYROLL', message: `No payroll for ${period}` });

    const statusBreakdown = records.reduce((acc, r) => {
      acc[r.status] = (acc[r.status] || 0) + 1;
      return acc;
    }, {});

    const paid   = records.filter(r => r.status === 'paid');
    const unpaid = records.filter(r => r.status !== 'paid');

    res.json({
      success: true, period,
      totalStaff: records.length,
      statusBreakdown,
      paid:   { count: paid.length,   totalAmount: paid.reduce((s, r) => s + (r.payrollSummary?.netPay || 0), 0),   paymentReference: paid[0]?.payment?.paymentReference, paymentDate: paid[0]?.payment?.paymentDate },
      unpaid: { count: unpaid.length, totalAmount: unpaid.reduce((s, r) => s + (r.payrollSummary?.netPay || 0), 0) }
    });
  } catch (err) {
    res.status(500).json({ error: 'SERVER_ERROR', message: err.message });
  }
});

// Mark individual employees as paid
router.post('/payments/mark-paid', async (req, res) => {
  try {
    const { employeeNumbers, period, paymentMethod = 'manual', paymentReference, notes } = req.body;
    if (!period || !employeeNumbers || employeeNumbers.length === 0) {
      return res.status(400).json({ error: 'MISSING_PARAMS', message: 'period and employeeNumbers are required' });
    }

    const ref = paymentReference || `PAY-${period.replace('-', '')}-${Date.now()}`;

    await Payroll.updateMany(
      { tenantId: TENANT_ID, period, employeeNumber: { $in: employeeNumbers } },
      {
        $set: {
          status:                    'paid',
          'payment.status':          'paid',
          'payment.method':          paymentMethod,
          'payment.paymentDate':     new Date(),
          'payment.paymentReference': ref,
          lastModifiedBy:            req.user?.username || 'system',
          notes:                     notes || ''
        }
      }
    );

    res.json({ success: true, message: `${employeeNumbers.length} staff marked as paid`, period, paymentReference: ref });
  } catch (err) {
    res.status(500).json({ error: 'SERVER_ERROR', message: err.message });
  }
});

// ============================================
// BONUSES
// ============================================

router.post('/bonuses', async (req, res) => {
  try {
    const { employeeNumber, period, amount, name, description, isTaxable = true } = req.body;
    if (!employeeNumber || !period || !amount) {
      return res.status(400).json({ error: 'MISSING_FIELDS', message: 'employeeNumber, period, and amount are required' });
    }

    const bonus = { code: `BONUS_${Date.now()}`, name: name || 'One-time Bonus', amount: Number(amount), description: description || '', isTaxable };

    await Payroll.findOneAndUpdate(
      { tenantId: TENANT_ID, employeeNumber, period },
      {
        $push: { 'salaryStructure.bonuses': bonus },
        $setOnInsert: { tenantId: TENANT_ID, employeeNumber, period, status: 'draft', calculationType: 'monthly' }
      },
      { upsert: true, new: true }
    );

    res.json({ success: true, message: 'Bonus added', bonus });
  } catch (err) {
    res.status(500).json({ error: 'SERVER_ERROR', message: err.message });
  }
});

router.get('/bonuses/:period', async (req, res) => {
  try {
    const { period } = req.params;
    const records = await Payroll.find({
      tenantId: TENANT_ID, period,
      'salaryStructure.bonuses': { $exists: true, $ne: [] }
    }).select('employeeNumber salaryStructure.bonuses').lean();

    const empNums = [...new Set(records.map(r => String(r.employeeNumber)))];
    const staffDocs = await Staff.find({ tenantId: TENANT_ID, employeeId: { $in: empNums } }, { employeeId: 1, firstName: 1, lastName: 1 }).lean();
    const nameMap = {};
    staffDocs.forEach(s => { nameMap[String(s.employeeId)] = `${s.firstName} ${s.lastName || ''}`.trim(); });

    const bonuses = records.flatMap(r =>
      (r.salaryStructure?.bonuses || []).map(b => ({
        ...b,
        employeeNumber: r.employeeNumber,
        employeeName:   nameMap[String(r.employeeNumber)] || r.employeeNumber
      }))
    );

    res.json({ success: true, bonuses, count: bonuses.length });
  } catch (err) {
    res.status(500).json({ error: 'SERVER_ERROR', message: err.message });
  }
});

router.delete('/bonuses/:period/:employeeNumber/:bonusCode', async (req, res) => {
  try {
    const { period, employeeNumber, bonusCode } = req.params;
    await Payroll.updateOne(
      { tenantId: TENANT_ID, employeeNumber, period },
      { $pull: { 'salaryStructure.bonuses': { code: bonusCode } } }
    );
    res.json({ success: true, message: 'Bonus removed' });
  } catch (err) {
    res.status(500).json({ error: 'SERVER_ERROR', message: err.message });
  }
});

// ============================================
// OVERTIME
// ============================================

router.post('/overtime', async (req, res) => {
  try {
    const { employeeNumber, period, hours, type = 'weekday', note = '' } = req.body;
    if (!employeeNumber || !period || !hours) {
      return res.status(400).json({ error: 'MISSING_FIELDS', message: 'employeeNumber, period, and hours are required' });
    }

    const settings      = await PayrollSettings.findOne({ tenantId: TENANT_ID, isActive: true });
    const overtimeRates = settings?.overtime?.rates || { weekday: 1.5, weekend: 2.0, holiday: 2.5 };
    const rate          = overtimeRates[type] || 1.5;

    const staffMember  = await Staff.findOne({ employeeId: employeeNumber });
    const baseSalary   = staffMember?.baseSalary || 0;
    const workingDays  = settings?.processing?.standardWorkingDays || 26;
    const workingHours = settings?.processing?.workingHoursPerDay  || 8;
    const hourlyRate   = baseSalary / (workingDays * workingHours);
    const amount       = Math.round(hourlyRate * rate * Number(hours));

    const overtimeEntry = { type, hours: Number(hours), rate, baseRate: Math.round(hourlyRate), amount, note };

    await Payroll.findOneAndUpdate(
      { tenantId: TENANT_ID, employeeNumber, period },
      {
        $push: { 'salaryStructure.overtime.breakdown': overtimeEntry },
        $inc:  { 'salaryStructure.overtime.totalHours': Number(hours), 'salaryStructure.overtime.totalAmount': amount },
        $setOnInsert: { tenantId: TENANT_ID, employeeNumber, period, status: 'draft', calculationType: 'monthly' }
      },
      { upsert: true, new: true }
    );

    res.json({ success: true, message: 'Overtime added', overtime: overtimeEntry });
  } catch (err) {
    res.status(500).json({ error: 'SERVER_ERROR', message: err.message });
  }
});

router.get('/overtime/:period', async (req, res) => {
  try {
    const { period } = req.params;
    const records    = await Payroll.find({
      tenantId: TENANT_ID, period,
      'salaryStructure.overtime.totalHours': { $gt: 0 }
    }).select('employeeNumber salaryStructure.overtime').lean();

    const empNums = [...new Set(records.map(r => String(r.employeeNumber)))];
    const staffDocs = await Staff.find({ tenantId: TENANT_ID, employeeId: { $in: empNums } }, { employeeId: 1, firstName: 1, lastName: 1 }).lean();
    const nameMap = {};
    staffDocs.forEach(s => { nameMap[String(s.employeeId)] = `${s.firstName} ${s.lastName || ''}`.trim(); });

    const overtime = records.map(r => ({
      employeeNumber: r.employeeNumber,
      employeeName:   nameMap[String(r.employeeNumber)] || r.employeeNumber,
      totalHours:     r.salaryStructure?.overtime?.totalHours  || 0,
      totalAmount:    r.salaryStructure?.overtime?.totalAmount || 0,
      breakdown:      r.salaryStructure?.overtime?.breakdown   || []
    }));

    res.json({ success: true, overtime, count: overtime.length });
  } catch (err) {
    res.status(500).json({ error: 'SERVER_ERROR', message: err.message });
  }
});

// ============================================
// LOANS / ADVANCES
// ============================================

router.post('/loans', async (req, res) => {
  try {
    const { employeeNumber, type = 'loan', description, originalAmount, monthlyDeduction, startPeriod, notes } = req.body;
    if (!employeeNumber || !originalAmount || !monthlyDeduction || !startPeriod) {
      return res.status(400).json({ error: 'MISSING_FIELDS', message: 'employeeNumber, originalAmount, monthlyDeduction, and startPeriod are required' });
    }

    const staffMember = await Staff.findOne({ employeeId: employeeNumber });
    if (!staffMember) return res.status(404).json({ error: 'STAFF_NOT_FOUND' });

    const existingLoan = await Loan.findOne({ tenantId: TENANT_ID, employeeNumber, type, status: 'active' });
    if (existingLoan) {
      return res.status(409).json({ error: 'ACTIVE_LOAN_EXISTS', message: `Employee already has an active ${type}. Complete or cancel it first.` });
    }

    const loan = await Loan.create({
      tenantId:         TENANT_ID,
      employeeId:       staffMember._id,
      employeeNumber,
      employeeName:     `${staffMember.firstName} ${staffMember.lastName || ''}`.trim(),
      type,
      description:      description || (type === 'advance' ? 'Salary Advance' : 'Staff Loan'),
      originalAmount:   Number(originalAmount),
      monthlyDeduction: Number(monthlyDeduction),
      remainingBalance: Number(originalAmount),
      startPeriod,
      status:           'active',
      createdBy:        req.user?.username || 'system',
      notes:            notes || ''
    });

    res.json({ success: true, message: `${type} created`, loan });
  } catch (err) {
    res.status(500).json({ error: 'SERVER_ERROR', message: err.message });
  }
});

router.get('/loans', async (req, res) => {
  try {
    const { status = 'active', employeeNumber } = req.query;
    const query = { tenantId: TENANT_ID };
    if (status && status !== 'all') query.status = status;
    if (employeeNumber)              query.employeeNumber = employeeNumber;

    const loans = await Loan.find(query).sort({ createdAt: -1 });
    res.json({ success: true, loans, count: loans.length });
  } catch (err) {
    res.status(500).json({ error: 'SERVER_ERROR', message: err.message });
  }
});

router.get('/loans/active/:period', async (req, res) => {
  try {
    const { period } = req.params;
    const loans      = await Loan.find({ tenantId: TENANT_ID, status: 'active', startPeriod: { $lte: period } }).sort({ employeeName: 1 });

    res.json({
      success: true,
      loans,
      summary: {
        totalLoans:              loans.length,
        totalMonthlyDeductions:  loans.reduce((s, l) => s + l.monthlyDeduction, 0),
        totalRemainingBalance:   loans.reduce((s, l) => s + l.remainingBalance, 0)
      }
    });
  } catch (err) {
    res.status(500).json({ error: 'SERVER_ERROR', message: err.message });
  }
});

router.put('/loans/:loanId/cancel', async (req, res) => {
  try {
    const loan = await Loan.findById(req.params.loanId);
    if (!loan) return res.status(404).json({ error: 'LOAN_NOT_FOUND' });
    loan.status = 'cancelled';
    await loan.save();
    res.json({ success: true, message: 'Loan cancelled', loan });
  } catch (err) {
    res.status(500).json({ error: 'SERVER_ERROR', message: err.message });
  }
});

// ============================================
// REPORTS
// ============================================

// Payroll register (full period report)
router.get('/reports/register', async (req, res) => {
  try {
    const { period } = req.query;
    if (!period) return res.status(400).json({ error: 'MISSING_PERIOD' });

    const records  = await Payroll.find({ tenantId: TENANT_ID, period, calculationType: 'monthly' }).lean();
    const flat     = records.map(flattenPayrollRecord);

    const totals = flat.reduce((acc, r) => ({
      grossSalary:      acc.grossSalary      + (r.grossSalary      || 0),
      netSalary:        acc.netSalary        + (r.netSalary        || 0),
      paye:             acc.paye             + (r.paye             || 0),
      pension:          acc.pension          + (r.pension          || 0),
      employerPension:  acc.employerPension  + (r.employerPension  || 0),
      nhf:              acc.nhf              + (r.nhf              || 0),
      nhis:             acc.nhis             + (r.nhis             || 0),
      totalDeductions:  acc.totalDeductions  + (r.totalDeductions  || 0),
      loanDeduction:    acc.loanDeduction    + (r.loanDeduction    || 0)
    }), { grossSalary: 0, netSalary: 0, paye: 0, pension: 0, employerPension: 0, nhf: 0, nhis: 0, totalDeductions: 0, loanDeduction: 0 });

    res.json({ success: true, period, count: flat.length, records: flat, totals });
  } catch (err) {
    res.status(500).json({ error: 'SERVER_ERROR', message: err.message });
  }
});

// Statutory reports (PAYE, Pension, NHF, NHIS, ITF, NSITF)
const STATUTORY_FIELDS = {
  paye:    r => ({ annualTax: r.paye * 12, monthlyTax: r.paye }),
  pension: r => ({ employeeContribution: r.pension, employerContribution: r.employerPension }),
  nhf:     r => ({ nhfContribution: r.nhf }),
  nhis:    r => ({ employeeContribution: r.nhis, employerContribution: r.employerNhis }),
  itf:     r => ({ itfAmount: r.itfAmount || 0 }),
  nsitf:   r => ({ nsitfAmount: r.nsitfAmount || 0 })
};

['paye', 'pension', 'nhf', 'nhis', 'itf', 'nsitf'].forEach(type => {
  router.get(`/reports/statutory/${type}`, async (req, res) => {
    try {
      const { period } = req.query;
      if (!period) return res.status(400).json({ error: 'MISSING_PERIOD' });

      const records = await Payroll.find({ tenantId: TENANT_ID, period, calculationType: 'monthly' }).lean();
      const flat    = records.map(flattenPayrollRecord);

      const rows = flat.map(r => ({
        employeeNumber: r.employeeNumber,
        employeeName:   r.name || r.employeeName,
        department:     r.department,
        grossSalary:    r.grossSalary,
        ...STATUTORY_FIELDS[type](r)
      }));

      const total = rows.reduce((s, r) => {
        Object.keys(STATUTORY_FIELDS[type](r)).forEach(k => { s[k] = (s[k] || 0) + (r[k] || 0); });
        return s;
      }, {});

      res.json({ success: true, period, type, count: rows.length, records: rows, total });
    } catch (err) {
      res.status(500).json({ error: 'SERVER_ERROR', message: err.message });
    }
  });
});

// Deduction analysis
router.get('/reports/deduction-analysis', async (req, res) => {
  try {
    const { period } = req.query;
    if (!period) return res.status(400).json({ error: 'MISSING_PERIOD' });

    const records = await Payroll.find({ tenantId: TENANT_ID, period, calculationType: 'monthly' }).lean();
    const flat    = records.map(flattenPayrollRecord);

    const analysis = flat.map(r => ({
      employeeNumber:      r.employeeNumber,
      employeeName:        r.name || r.employeeName,
      department:          r.department,
      latenessDeduction:   r.latenessDeduction,
      earlyLeaveDeduction: r.earlyLeaveDeduction,
      absenceDeduction:    r.absenceDeduction,
      loanDeduction:       r.loanDeduction,
      totalDeductions:     r.totalDeductions,
      presentDays:         r.presentDays,
      absentDays:          r.absentDays,
      lateDays:            r.lateDays
    }));

    res.json({ success: true, period, count: analysis.length, records: analysis });
  } catch (err) {
    res.status(500).json({ error: 'SERVER_ERROR', message: err.message });
  }
});

// Department costs
router.get('/reports/department-costs', async (req, res) => {
  try {
    const { period } = req.query;
    if (!period) return res.status(400).json({ error: 'MISSING_PERIOD' });

    const records = await Payroll.find({ tenantId: TENANT_ID, period, calculationType: 'monthly' }).lean();
    const flat    = records.map(flattenPayrollRecord);

    const departments = {};
    flat.forEach(r => {
      const dept = r.department || 'Unknown';
      if (!departments[dept]) departments[dept] = { department: dept, headCount: 0, grossSalary: 0, netSalary: 0, totalDeductions: 0 };
      departments[dept].headCount++;
      departments[dept].grossSalary    += r.grossSalary    || 0;
      departments[dept].netSalary      += r.netSalary      || 0;
      departments[dept].totalDeductions += r.totalDeductions || 0;
    });

    res.json({ success: true, period, departments: Object.values(departments) });
  } catch (err) {
    res.status(500).json({ error: 'SERVER_ERROR', message: err.message });
  }
});

// Payment status report
router.get('/reports/payment-status', async (req, res) => {
  try {
    const { period } = req.query;
    if (!period) return res.status(400).json({ error: 'MISSING_PERIOD' });

    const records = await Payroll.find({ tenantId: TENANT_ID, period, calculationType: 'monthly' }).lean();
    const flat    = records.map(r => ({
      ...flattenPayrollRecord(r),
      paymentStatus: r.payment?.status || r.status,
      paymentMethod: r.payment?.method || 'N/A',
      paymentDate:   r.payment?.paymentDate || null,
      paymentRef:    r.payment?.paymentReference || 'N/A',
      bankName:      r.payment?.bankDetails?.bankName || 'N/A'
    }));

    res.json({ success: true, period, count: flat.length, records: flat });
  } catch (err) {
    res.status(500).json({ error: 'SERVER_ERROR', message: err.message });
  }
});

// Variance report (period vs previous period)
router.get('/reports/variance', async (req, res) => {
  try {
    const { period } = req.query;
    if (!period) return res.status(400).json({ error: 'MISSING_PERIOD' });

    const [year, month] = period.split('-').map(Number);
    const prevDate = new Date(year, month - 2, 1);
    const prevPeriod = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`;

    const [current, previous] = await Promise.all([
      Payroll.find({ tenantId: TENANT_ID, period,     calculationType: 'monthly' }).lean(),
      Payroll.find({ tenantId: TENANT_ID, period: prevPeriod, calculationType: 'monthly' }).lean()
    ]);

    const prevMap = {};
    previous.map(flattenPayrollRecord).forEach(r => { prevMap[r.employeeNumber] = r; });

    const variance = current.map(flattenPayrollRecord).map(r => {
      const prev = prevMap[r.employeeNumber] || {};
      return {
        employeeNumber:  r.employeeNumber,
        employeeName:    r.name || r.employeeName,
        currentGross:    r.grossSalary  || 0,
        previousGross:   prev.grossSalary || 0,
        grossVariance:   (r.grossSalary || 0) - (prev.grossSalary || 0),
        currentNet:      r.netSalary    || 0,
        previousNet:     prev.netSalary  || 0,
        netVariance:     (r.netSalary || 0) - (prev.netSalary || 0)
      };
    });

    res.json({ success: true, period, prevPeriod, count: variance.length, records: variance });
  } catch (err) {
    res.status(500).json({ error: 'SERVER_ERROR', message: err.message });
  }
});

// ============================================
// RECALCULATE (manual trigger for a period)
// ============================================

router.post('/recalculate', async (req, res) => {
  try {
    const { period } = req.body;
    if (!period) return res.status(400).json({ error: 'MISSING_PERIOD' });
    const parsed = parsePeriodString(period);
    if (!parsed) return res.status(400).json({ error: 'INVALID_PERIOD' });

    const result = await calculateHistoricalPayroll(parsed.year, parsed.month, 'manual_recalculate');
    res.json({ success: result.success, period, ...result });
  } catch (err) {
    res.status(500).json({ error: 'SERVER_ERROR', message: err.message });
  }
});

// Recalculate historical range
router.post('/recalculate-historical', async (req, res) => {
  try {
    const { startPeriod, endPeriod } = req.body;
    const periodRegex = /^\d{4}-\d{2}$/;

    if (!startPeriod || !periodRegex.test(startPeriod)) return res.status(400).json({ error: 'INVALID_START_PERIOD' });
    if (!endPeriod   || !periodRegex.test(endPeriod))   return res.status(400).json({ error: 'INVALID_END_PERIOD' });
    if (startPeriod > endPeriod) return res.status(400).json({ error: 'INVALID_RANGE', message: 'startPeriod must be <= endPeriod' });

    const [startYear, startMonth] = startPeriod.split('-').map(Number);
    const [endYear,   endMonth]   = endPeriod.split('-').map(Number);

    const results = [];
    let totalMonthsProcessed = 0;
    let totalStaffProcessed  = 0;
    let totalErrors          = 0;

    let year = startYear, month = startMonth;
    while (year < endYear || (year === endYear && month <= endMonth)) {
      const result = await calculateHistoricalPayroll(year, month, 'manual_range');
      results.push(result);
      totalMonthsProcessed++;
      totalStaffProcessed += result.processedStaff || 0;
      totalErrors         += result.errors?.length  || 0;

      month++;
      if (month > 12) { month = 1; year++; }
    }

    res.json({ success: true, startPeriod, endPeriod, totalMonthsProcessed, totalStaffProcessed, totalErrors, results });
  } catch (err) {
    res.status(500).json({ error: 'SERVER_ERROR', message: err.message });
  }
});

// ============================================
// PREVIEW / SIMULATE (no DB writes)
// ============================================

router.get('/preview/:period', async (req, res) => {
  try {
    const { period } = req.params;
    const parsed = parsePeriodString(period);
    if (!parsed) return res.status(400).json({ error: 'INVALID_PERIOD' });

    const records = await Payroll.find({ tenantId: TENANT_ID, period, calculationType: 'monthly' }).lean();
    if (records.length === 0) return res.status(404).json({ error: 'NO_PAYROLL', message: `No payroll data for ${period}` });

    // Build staff name lookup
    const empNumbers = [...new Set(records.map(r => String(r.employeeNumber)))];
    const staffDocs = await Staff.find({ tenantId: TENANT_ID, employeeId: { $in: empNumbers } }, { employeeId: 1, firstName: 1, lastName: 1 }).lean();
    const nameMap = {};
    staffDocs.forEach(s => { nameMap[String(s.employeeId)] = `${s.firstName} ${s.lastName || ''}`.trim(); });

    const loans = await Loan.find({ tenantId: TENANT_ID, status: 'active', startPeriod: { $lte: period } }).lean();

    const summary = { totalLateness: 0, totalEarlyLeave: 0, totalAbsence: 0, totalLoanDeductions: 0, totalBonuses: 0, totalOvertime: 0, staffWithDeductions: 0 };

    const staff = records.map(r => {
      const latenessAmt   = r.otherDeductions?.lateness?.amount   || 0;
      const earlyLeaveAmt = r.otherDeductions?.earlyLeave?.amount || 0;
      const absenceAmt    = r.otherDeductions?.absence?.amount    || 0;
      const bonusAmt      = (r.salaryStructure?.bonuses || []).reduce((s, b) => s + (b.amount || 0), 0);
      const overtimeAmt   = r.salaryStructure?.overtime?.totalAmount || 0;
      const staffLoans    = loans.filter(l => String(l.employeeNumber) === String(r.employeeNumber));
      const loanAmt       = staffLoans.reduce((s, l) => s + (l.monthlyInstalment || l.monthlyDeduction || 0), 0);

      if (latenessAmt > 0 || earlyLeaveAmt > 0 || absenceAmt > 0) summary.staffWithDeductions++;
      summary.totalLateness      += latenessAmt;
      summary.totalEarlyLeave    += earlyLeaveAmt;
      summary.totalAbsence       += absenceAmt;
      summary.totalLoanDeductions += loanAmt;
      summary.totalBonuses       += bonusAmt;
      summary.totalOvertime      += overtimeAmt;

      return {
        employeeNumber: r.employeeNumber,
        name:           nameMap[String(r.employeeNumber)] || r.employeeNumber,
        department:     r.department || '',
        deductions:     { lateness: latenessAmt, earlyLeave: earlyLeaveAmt, absence: absenceAmt, loans: loanAmt, total: latenessAmt + earlyLeaveAmt + absenceAmt + loanAmt },
        additions:      { bonuses: bonusAmt, overtime: overtimeAmt, total: bonusAmt + overtimeAmt },
        attendance:     { presentDays: r.attendanceData?.presentDays || 0, absentDays: r.attendanceData?.absentDays || 0, lateDays: r.attendanceData?.lateDays || 0 },
        deductionBreakdown: r.deductionBreakdown || [],
        bonuses: r.salaryStructure?.bonuses || [],
        loans:   staffLoans.map(l => ({ type: l.type || 'loan', description: l.description || l.purpose || '', monthlyDeduction: l.monthlyInstalment || l.monthlyDeduction || 0, remainingBalance: l.remainingBalance || l.balance || 0 }))
      };
    });

    res.json({ success: true, period, staffCount: records.length, summary, staff, activeLoans: loans.length });
  } catch (err) {
    res.status(500).json({ error: 'SERVER_ERROR', message: err.message });
  }
});

// ============================================
// ANALYTICS DASHBOARD
// ============================================

router.get('/analytics/dashboard', async (req, res) => {
  try {
    const months = Math.min(parseInt(req.query.months) || 6, 24);
    const now    = getLagosDate();
    const year   = now.getFullYear();
    const month  = now.getMonth() + 1;
    const currentPeriod = `${year}-${String(month).padStart(2, '0')}`;

    const settings = await PayrollSettings.findOne({ tenantId: TENANT_ID, isActive: true }).lean();
    const payDay   = settings?.processing?.paymentDay || 28;

    const currentRecords = await Payroll.find({ tenantId: TENANT_ID, period: currentPeriod }).lean();

    let grossPayroll = 0, totalDeductions = 0, netPayroll = 0;
    let dedPaye = 0, dedPension = 0, dedNhf = 0, dedNhis = 0, dedAttendance = 0, dedLoans = 0;

    for (const r of currentRecords) {
      grossPayroll    += r.payrollSummary?.grossSalary      || 0;
      totalDeductions += r.payrollSummary?.totalDeductions  || 0;
      netPayroll      += r.payrollSummary?.netPay           || 0;
      dedPaye         += r.statutoryDeductions?.paye?.monthlyTax                  || 0;
      dedPension      += r.statutoryDeductions?.pension?.employeeContribution      || 0;
      dedNhf          += r.statutoryDeductions?.nhf?.amount                        || 0;
      dedNhis         += r.statutoryDeductions?.nhis?.employeeContribution         || 0;
      dedAttendance   += (r.otherDeductions?.lateness?.amount  || 0) +
                         (r.otherDeductions?.earlyLeave?.amount || 0) +
                         (r.otherDeductions?.absence?.amount   || 0);
      dedLoans        += (r.otherDeductions?.loans || []).reduce((s, l) => s + (l.amount || 0), 0);
    }

    let periodStatus = null;
    if (currentRecords.length > 0) {
      const statusCounts = {};
      currentRecords.forEach(r => { statusCounts[r.status] = (statusCounts[r.status] || 0) + 1; });
      periodStatus = Object.keys(statusCounts).sort((a, b) => statusCounts[b] - statusCounts[a])[0];
    }

    const totalActiveStaff = await Staff.countDocuments({ status: 'active', employeeId: { $not: /^CONFIG_/ } });
    const configuredStaff  = await Staff.countDocuments({ status: 'active', employeeId: { $not: /^CONFIG_/ }, baseSalary: { $gt: 0 } });

    const monthlyTrends = [];
    const ytdTotals = { grossPayroll: 0, totalDeductions: 0, netPayroll: 0 };

    for (let i = months - 1; i >= 0; i--) {
      const d = new Date(year, month - 1 - i, 1);
      const p = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const recs = await Payroll.find({ tenantId: TENANT_ID, period: p }).lean();
      const g  = recs.reduce((s, r) => s + (r.payrollSummary?.grossSalary    || 0), 0);
      const dd = recs.reduce((s, r) => s + (r.payrollSummary?.totalDeductions || 0), 0);
      const n  = recs.reduce((s, r) => s + (r.payrollSummary?.netPay          || 0), 0);
      const label = d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
      monthlyTrends.push({ period: p, label, grossPayroll: Math.round(g), totalDeductions: Math.round(dd), netPayroll: Math.round(n), employeeCount: recs.length });
      if (d.getFullYear() === year) {
        ytdTotals.grossPayroll    += g;
        ytdTotals.totalDeductions += dd;
        ytdTotals.netPayroll      += n;
      }
    }

    const activeLoans       = await Loan.find({ tenantId: TENANT_ID, status: 'active' }).lean();
    const totalOutstanding  = activeLoans.reduce((s, l) => s + (l.remainingBalance || 0), 0);
    const monthlyDeductions = activeLoans.reduce((s, l) => s + (l.monthlyInstalment || 0), 0);

    let payDate = new Date(year, month - 1, payDay);
    if (now.getDate() >= payDay) payDate = new Date(year, month, payDay);
    const daysUntil = Math.max(0, Math.ceil((payDate - now) / 86400000));

    res.json({
      currentPeriod: {
        period:          currentPeriod,
        grossPayroll:    Math.round(grossPayroll),
        totalDeductions: Math.round(totalDeductions),
        netPayroll:      Math.round(netPayroll),
        status:          periodStatus,
        employeeCount:   currentRecords.length
      },
      staffSummary:   { totalActiveStaff, configuredStaff },
      ytdTotals:      { grossPayroll: Math.round(ytdTotals.grossPayroll), totalDeductions: Math.round(ytdTotals.totalDeductions), netPayroll: Math.round(ytdTotals.netPayroll) },
      monthlyTrends,
      loanSummary:    { activeLoans: activeLoans.length, totalOutstanding: Math.round(totalOutstanding), monthlyDeductions: Math.round(monthlyDeductions) },
      upcomingPayment: { date: payDate.toISOString(), payDay, daysUntil },
      deductionBreakdown: { paye: Math.round(dedPaye), pension: Math.round(dedPension), nhf: Math.round(dedNhf), nhis: Math.round(dedNhis), attendance: Math.round(dedAttendance), loans: Math.round(dedLoans) }
    });
  } catch (err) {
    logger.error('Analytics dashboard error', { error: err.message });
    res.status(500).json({ error: 'SERVER_ERROR', message: err.message });
  }
});

// ============================================
// PAYROLL SIMULATOR (no DB writes)
// ============================================

router.post('/simulate', async (req, res) => {
  try {
    const {
      // Earnings
      baseSalary     = 0,
      allowances     = [],        // [{ code, name, amount }]
      // Attendance scenarios
      lateDays       = [],        // [{ minutes }] — each entry is one late day
      earlyLeaveDays = [],        // [{ minutes }]
      absentDays     = 0,
      // Exemptions
      exemptions     = {},        // { paye, pension, nhf, nhis }
      // Working days override
      workingDays    = 26,
      // Optional: deep-merge custom statutory settings (e.g. different tax brackets)
      settingsOverride = null,
      // NTA 2025 annual tax reliefs (all values in Naira per year)
      taxReliefs     = {},        // { annualRent, annualLifeAssurance, annualMortgageInterest, voluntaryPensionAVC }
      // One-off additions (NTA 2025: taxable income, excluded from pension/NHF base)
      oneOffs        = []         // [{ type, label, amount }]
    } = req.body;

    if (!baseSalary || baseSalary <= 0) {
      return res.status(400).json({ error: 'INVALID_BASE_SALARY', message: 'baseSalary must be > 0' });
    }

    // Load tenant's saved settings as base
    let settings = await PayrollSettings.findOne({ tenantId: TENANT_ID, isActive: true }).lean();

    // Deep-merge caller-supplied overrides (e.g. custom tax brackets for testing)
    if (settingsOverride && settings) {
      settings = JSON.parse(JSON.stringify(settings));
      if (settingsOverride.statutory) {
        settings.statutory = { ...settings.statutory, ...settingsOverride.statutory };
        if (settingsOverride.statutory.paye) {
          settings.statutory.paye = { ...settings.statutory.paye, ...settingsOverride.statutory.paye };
        }
      }
    }

    // Use defaults if no saved settings found; always deep-clone so we can mutate for simulator
    let effectiveSettings = settings
      ? JSON.parse(JSON.stringify(settings))
      : {
          statutory: {
            paye:    { enabled: true, taxBrackets: [], minimumTaxRate: 1 },
            pension: { enabled: true, employeeRate: 8, employerRate: 10, pensionableComponents: ['basic', 'housing', 'transport'] },
            nhf:     { enabled: true, rate: 2.5, calculationBase: 'gross', minimumSalary: 3000 },
            nhis:    { enabled: true, employeeRate: 5, employerRate: 10 },
            itf:     { enabled: true, rate: 1, minimumStaff: 1 },
            nsitf:   { enabled: true, employerRate: 1, calculationBase: 'gross' }
          },
          deductions: {
            lateness:   { enabled: true, method: 'per_hour', graceMinutes: 5, roundUpToHour: true },
            earlyLeave: { enabled: true, method: 'per_hour', graceMinutes: 5, roundUpToHour: true },
            absence:    { enabled: true, method: 'full_day' }
          },
          processing: { workingDays: 26, workingHoursPerDay: 8 }
        };

    // SIMULATOR: force all statutory deductions enabled regardless of tenant settings.
    // The `enabled` flag gates production payroll — the simulator always shows every
    // calculation; use the `exemptions` param to skip individual staff members.
    if (!effectiveSettings.statutory) effectiveSettings.statutory = {};
    ['paye', 'pension', 'nhf', 'nhis', 'itf', 'nsitf'].forEach(key => {
      if (!effectiveSettings.statutory[key]) effectiveSettings.statutory[key] = {};
      effectiveSettings.statutory[key].enabled = true;
    });
    // ITF: simulator passes staffCount=1; override minimumStaff so it always calculates
    effectiveSettings.statutory.itf.minimumStaff = 1;
    // Fill in missing default rates
    const nhfS   = effectiveSettings.statutory.nhf;
    const nhisS  = effectiveSettings.statutory.nhis;
    const nsitfS = effectiveSettings.statutory.nsitf;
    if (!nhfS.rate)              nhfS.rate              = 2.5;
    if (!nhisS.employeeRate)     nhisS.employeeRate     = 5;
    if (!nhisS.employerRate)     nhisS.employerRate     = 10;
    if (!nsitfS.employerRate)    nsitfS.employerRate    = 1;
    if (!nsitfS.calculationBase) nsitfS.calculationBase = 'gross';

    // 1. Gross salary
    const totalAllowances  = allowances.reduce((s, a) => s + (a.amount || 0), 0);
    const grossMonthly     = baseSalary + totalAllowances;
    const annualGross      = grossMonthly * 12;

    const housingAllowance   = allowances.find(a => a.code === 'HOUSING'   || a.type === 'housing')?.amount   || 0;
    const transportAllowance = allowances.find(a => a.code === 'TRANSPORT' || a.type === 'transport')?.amount || 0;

    // 2. Statutory deductions
    // NTA 2025: pension/NHF/NHIS computed first — they reduce taxable income before PAYE
    const pension = calculatePension(baseSalary, housingAllowance, transportAllowance, effectiveSettings, exemptions);
    const nhf     = calculateNHF(baseSalary, grossMonthly, effectiveSettings, exemptions);
    const nhis    = calculateNHIS(baseSalary, grossMonthly, effectiveSettings, exemptions);

    // Rent relief = 20% of actual annual rent paid, capped at ₦500,000/yr (NTA 2025)
    const annualRent = taxReliefs.annualRent || 0;
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

    const paye  = calculatePAYE(annualGross, effectiveSettings, exemptions, preTaxDeductions);
    const itf   = calculateITF(grossMonthly, 1, effectiveSettings);
    const nsitf = calculateNSITF(baseSalary, grossMonthly, effectiveSettings);

    // 3. One-off additions (NTA 2025: taxable, excluded from pension/NHF base)
    const oneOffTotal = oneOffs.reduce((s, o) => s + (o.amount || 0), 0);
    let oneOffPAYE = 0;
    if (oneOffTotal > 0 && !exemptions.paye) {
      const payeWithOneOffs = calculatePAYE(annualGross + oneOffTotal, effectiveSettings, exemptions, preTaxDeductions);
      oneOffPAYE = Math.max(0, (payeWithOneOffs.amount || 0) - (paye.amount || 0));
    }

    // 4. Attendance deductions
    const effectiveWorkingDays = workingDays || effectiveSettings.processing?.workingDays || 26;
    const dailyRate  = effectiveWorkingDays > 0 ? grossMonthly / effectiveWorkingDays : 0;
    const dailyGross = dailyRate;

    let latenessAmt   = 0;
    const latenessBreakdown = [];
    for (const d of lateDays) {
      const r = calculateLatenessDeduction(d.minutes || 0, dailyRate, effectiveSettings);
      latenessAmt += r?.amount || 0;
      if (r?.amount > 0) latenessBreakdown.push({ minutes: d.minutes, amount: r.amount });
    }

    let earlyLeaveAmt = 0;
    const earlyLeaveBreakdown = [];
    for (const d of earlyLeaveDays) {
      const r = calculateEarlyLeaveDeduction(d.minutes || 0, dailyRate, effectiveSettings);
      earlyLeaveAmt += r?.amount || 0;
      if (r?.amount > 0) earlyLeaveBreakdown.push({ minutes: d.minutes, amount: r.amount });
    }

    let absenceAmt = 0;
    for (let i = 0; i < absentDays; i++) {
      const r = calculateAbsenceDeduction(dailyRate, dailyGross, effectiveSettings, false);
      absenceAmt += r?.amount || 0;
    }

    // 5. Totals
    const baseStatutory  = (paye.monthlyAmount || 0) + (pension.employeeAmount || 0) + (nhf.amount || 0) + (nhis.employeeAmount || 0);
    const totalStatutory = baseStatutory + oneOffPAYE;
    const grossWithOneOffs  = grossMonthly + oneOffTotal;
    const totalAttendance   = latenessAmt + earlyLeaveAmt + absenceAmt;
    const totalDeductions   = totalStatutory + totalAttendance;
    const netPay            = grossWithOneOffs - totalDeductions;
    const totalEmployerCost = grossWithOneOffs + (pension.employerAmount || 0) + (nhis.employerAmount || 0) + (itf.amount || 0) + (nsitf.amount || 0);

    res.json({
      success: true,
      input: { baseSalary, allowances, lateDays, absentDays, earlyLeaveDays, workingDays: effectiveWorkingDays, taxReliefs, oneOffs },
      earnings: {
        baseSalary,
        allowances: allowances.map(a => ({ code: a.code || 'CUSTOM', name: a.name || 'Allowance', amount: a.amount || 0 })),
        oneOffs: oneOffs.filter(o => o.amount > 0),
        oneOffTotal,
        grossMonthly,
        grossWithOneOffs,
        annualGross
      },
      rates: {
        dailyRate:   Math.round(dailyRate),
        workingDays: effectiveWorkingDays
      },
      statutoryDeductions: {
        paye: {
          monthlyAmount:        (paye.monthlyAmount || 0) + oneOffPAYE,
          regularMonthlyAmount: paye.monthlyAmount || 0,
          oneOffPAYE,
          annualAmount:         paye.amount || 0,
          details:              paye.details || {}
        },
        pension: { employeeAmount: pension.employeeAmount || 0, employerAmount: pension.employerAmount || 0, details: pension.details },
        nhf:     { amount: nhf.amount || 0, details: nhf.details },
        nhis:    { employeeAmount: nhis.employeeAmount || 0, employerAmount: nhis.employerAmount || 0 },
        totalStatutory: Math.round(totalStatutory)
      },
      attendanceDeductions: {
        lateness:   { days: lateDays.length,       totalMinutes: lateDays.reduce((s, d) => s + (d.minutes || 0), 0),       totalAmount: Math.round(latenessAmt),   breakdown: latenessBreakdown   },
        earlyLeave: { days: earlyLeaveDays.length, totalMinutes: earlyLeaveDays.reduce((s, d) => s + (d.minutes || 0), 0), totalAmount: Math.round(earlyLeaveAmt), breakdown: earlyLeaveBreakdown },
        absence:    { days: absentDays, totalAmount: Math.round(absenceAmt) },
        totalAttendance: Math.round(totalAttendance)
      },
      summary: {
        grossMonthly,
        grossWithOneOffs,
        totalStatutory:  Math.round(totalStatutory),
        totalAttendance: Math.round(totalAttendance),
        totalDeductions: Math.round(totalDeductions),
        netPay:          Math.round(netPay),
        employerContributions: {
          pension: pension.employerAmount || 0,
          nhis:    nhis.employerAmount    || 0,
          itf:     itf.amount             || 0,
          nsitf:   nsitf.amount           || 0,
          total:   Math.round(totalEmployerCost - grossWithOneOffs)
        },
        totalEmployerCost: Math.round(totalEmployerCost)
      }
    });
  } catch (err) {
    logger.error('Payroll simulate error', { error: err.message });
    res.status(500).json({ error: 'SERVER_ERROR', message: err.message });
  }
});

// ============================================
// DEDUCTIONS CALENDAR (per-day breakdown)
// ============================================

router.get('/deductions/calendar/:period', async (req, res) => {
  try {
    const { period } = req.params;
    const { employeeNumber } = req.query;

    const parsed = parsePeriodString(period);
    if (!parsed) return res.status(400).json({ error: 'INVALID_PERIOD' });

    const query = { tenantId: TENANT_ID, period };
    if (employeeNumber) query.employeeNumber = employeeNumber;

    const payrollRecords = await Payroll.find(query).lean();

    // Build staff name lookup
    const empNums = [...new Set(payrollRecords.map(r => String(r.employeeNumber)))];
    const staffForCal = await Staff.find({ tenantId: TENANT_ID, employeeId: { $in: empNums } }, { employeeId: 1, firstName: 1, lastName: 1, department: 1 }).lean();
    const calNameMap = {};
    staffForCal.forEach(s => { calNameMap[String(s.employeeId)] = `${s.firstName} ${s.lastName || ''}`.trim(); });

    const calendarMap = {};

    for (const r of payrollRecords) {
      const empName = calNameMap[String(r.employeeNumber)] || r.employeeNumber;
      const empDept = r.department   || '';

      for (const event of (r.deductionBreakdown || [])) {
        if (!['lateness', 'early_leave', 'absence'].includes(event.type)) continue;
        if (!event.date || !event.amount) continue;

        if (!calendarMap[event.date]) {
          calendarMap[event.date] = { date: event.date, lateness: [], earlyLeave: [], absence: [], other: [], totalAmount: 0 };
        }

        const entry = {
          employeeNumber: r.employeeNumber,
          name:           empName,
          department:     empDept,
          minutes:        event.minutes     || 0,
          amount:         event.amount      || 0,
          description:    event.description || ''
        };

        if (event.type === 'lateness')    calendarMap[event.date].lateness.push(entry);
        else if (event.type === 'early_leave') calendarMap[event.date].earlyLeave.push(entry);
        else if (event.type === 'absence')     calendarMap[event.date].absence.push(entry);
        else                                   calendarMap[event.date].other.push(entry);

        calendarMap[event.date].totalAmount += event.amount;
      }
    }

    const calendar = Object.values(calendarMap)
      .sort((a, b) => a.date.localeCompare(b.date))
      .map(d => ({ ...d, totalAmount: Math.round(d.totalAmount) }));

    const staffSummary = payrollRecords
      .map(r => {
        const od  = r.otherDeductions || {};
        const lat = od.lateness?.amount   || 0;
        const ear = od.earlyLeave?.amount || 0;
        const abs = od.absence?.amount    || 0;
        return {
          employeeNumber:   r.employeeNumber,
          name:             calNameMap[String(r.employeeNumber)] || r.employeeNumber,
          department:       r.department   || '',
          lateDays:         r.attendanceData?.lateDays   || od.lateness?.occurrences || 0,
          absentDays:       r.attendanceData?.absentDays || od.absence?.days         || 0,
          latenessAmount:   Math.round(lat),
          earlyLeaveAmount: Math.round(ear),
          absenceAmount:    Math.round(abs),
          totalDeductions:  Math.round(lat + ear + abs)
        };
      })
      .filter(s => s.totalDeductions > 0)
      .sort((a, b) => b.totalDeductions - a.totalDeductions);

    const totals = calendar.reduce((acc, d) => ({
      totalLateness:   acc.totalLateness   + d.lateness.reduce((s, e) => s + e.amount, 0),
      totalEarlyLeave: acc.totalEarlyLeave + d.earlyLeave.reduce((s, e) => s + e.amount, 0),
      totalAbsence:    acc.totalAbsence    + d.absence.reduce((s, e) => s + e.amount, 0),
      totalOther:      acc.totalOther      + d.other.reduce((s, e) => s + e.amount, 0)
    }), { totalLateness: 0, totalEarlyLeave: 0, totalAbsence: 0, totalOther: 0 });
    Object.keys(totals).forEach(k => { totals[k] = Math.round(totals[k]); });

    res.json({ success: true, period, staffCount: payrollRecords.length, calendar, staffSummary, totals });
  } catch (err) {
    logger.error('Deductions calendar error', { error: err.message });
    res.status(500).json({ error: 'SERVER_ERROR', message: err.message });
  }
});

// ============================================
// RECALCULATE ATTENDANCE DEDUCTIONS
// ============================================

router.post('/deductions/recalculate-attendance', async (req, res) => {
  try {
    const { startPeriod, endPeriod, force = false } = req.body;
    const periodRegex = /^\d{4}-\d{2}$/;

    if (!startPeriod || !periodRegex.test(startPeriod)) return res.status(400).json({ error: 'INVALID_START_PERIOD' });
    if (!endPeriod   || !periodRegex.test(endPeriod))   return res.status(400).json({ error: 'INVALID_END_PERIOD' });
    if (startPeriod > endPeriod) return res.status(400).json({ error: 'INVALID_RANGE', message: 'startPeriod must be ≤ endPeriod' });

    const deductionSettings = (await PayrollSettings.findOne({ tenantId: TENANT_ID }).lean()) || {};

    // Build list of YYYY-MM periods in range
    const periods = [];
    let [yr, mo] = startPeriod.split('-').map(Number);
    const [endYr, endMo] = endPeriod.split('-').map(Number);
    while (yr < endYr || (yr === endYr && mo <= endMo)) {
      periods.push(`${yr}-${String(mo).padStart(2, '0')}`);
      mo++; if (mo > 12) { mo = 1; yr++; }
    }

    // Today in Lagos timezone
    const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'Africa/Lagos' });

    const summary = { periods: periods.length, cleared: 0, processed: 0, errors: [] };

    for (const period of periods) {
      const [year, month] = period.split('-').map(Number);
      const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
      const lastDay   = new Date(year, month, 0).getDate();
      const endDate   = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

      // Skip paid/approved unless forced
      const query = { tenantId: TENANT_ID, period, calculationType: 'monthly' };
      if (!force) query.status = { $nin: ['paid', 'approved'] };
      const payrollRecords = await Payroll.find(query).lean();

      // ── PHASE 1: Wipe all attendance deduction fields ──────────────────────
      const recordIds = payrollRecords.map(r => r._id);
      if (recordIds.length > 0) {
        await Payroll.updateMany(
          { _id: { $in: recordIds } },
          { $set: {
            'otherDeductions.lateness':   { amount: 0, occurrences: 0, totalMinutes: 0 },
            'otherDeductions.earlyLeave': { amount: 0, occurrences: 0, totalMinutes: 0 },
            'otherDeductions.absence':    { amount: 0, days: 0 },
            deductionBreakdown:           [],
            'attendanceData.lateDays':    0,
            'attendanceData.absentDays':  0,
            'attendanceData.earlyLeaveDays': 0,
            'attendanceData.lateMinutes': 0,
            'attendanceData.earlyLeaveMinutes': 0
          }}
        );
        summary.cleared += recordIds.length;
      }

      // Cap effective end date to yesterday (today's attendance not yet closed)
      const yesterdayStr = (() => {
        const d = new Date(new Date(todayStr + 'T12:00:00Z').getTime() - 86400000);
        return d.toISOString().split('T')[0];
      })();
      const effectiveEndDate = endDate < yesterdayStr ? endDate : yesterdayStr;

      // ── PHASE 2: Recalculate per employee ──────────────────────────────────
      for (const pr of payrollRecords) {
        try {
          const empNo = pr.employeeNumber;

          const attRecords = await Attendance.find({
            tenantId: TENANT_ID,
            employeeId: String(empNo),
            date: { $gte: startDate, $lte: effectiveEndDate },
            $or: [{ lateMinutes: { $gt: 0 } }, { absent: true }, { earlyLeaveMinutes: { $gt: 0 } }]
          }).sort({ date: 1 }).lean();

          const baseSalary  = pr.salaryStructure?.baseSalary || 0;
          const grossSalary = pr.payrollSummary?.grossSalary || baseSalary;
          const workingDays = pr.attendanceData?.standardWorkingDays || 26;
          const dailyRate   = baseSalary / (workingDays || 26);
          const dailyGross  = grossSalary / (workingDays || 26);

          const breakdown = [];
          let totalLateness    = 0;
          let totalEarlyLeave  = 0;
          let totalAbsence     = 0;
          let lateDays         = 0;
          let absentDays       = 0;
          let earlyLeaveDays   = 0;
          let totalLateMinutes = 0;
          let totalELMinutes   = 0;

          for (const att of attRecords) {
            if ((att.lateMinutes || 0) > 0) {
              const r = calculateLatenessDeduction(att.lateMinutes, dailyRate, deductionSettings);
              if (r.amount > 0) {
                totalLateness += r.amount;
                lateDays++;
                totalLateMinutes += att.lateMinutes;
                breakdown.push({ date: att.date, type: 'lateness', amount: r.amount,
                  minutes: att.lateMinutes, description: r.details?.calculation || `${att.lateMinutes} min late` });
              }
            }
            if ((att.earlyLeaveMinutes || 0) > 0) {
              const r = calculateEarlyLeaveDeduction(att.earlyLeaveMinutes, dailyRate, deductionSettings);
              if (r.amount > 0) {
                totalEarlyLeave += r.amount;
                earlyLeaveDays++;
                totalELMinutes += att.earlyLeaveMinutes;
                breakdown.push({ date: att.date, type: 'early_leave', amount: r.amount,
                  minutes: att.earlyLeaveMinutes, description: r.details?.calculation || `Left ${att.earlyLeaveMinutes} min early` });
              }
            }
            if (att.absent === true) {
              const r = calculateAbsenceDeduction(dailyRate, dailyGross, deductionSettings, false);
              if (r.amount > 0) {
                totalAbsence += r.amount;
                absentDays++;
                breakdown.push({ date: att.date, type: 'absence', amount: r.amount,
                  minutes: 0, days: 1, description: r.details?.calculation || 'Full day absent' });
              }
            }
          }

          const newAttendanceTotal = totalLateness + totalEarlyLeave + totalAbsence;

          // Recompute totals — all other deduction buckets unchanged
          const storedPaye     = pr.statutoryDeductions?.paye?.monthlyTax || 0;
          const storedPension  = pr.statutoryDeductions?.pension?.employeeContribution || 0;
          const storedNhf      = pr.statutoryDeductions?.nhf?.amount || 0;
          const storedNhis     = pr.statutoryDeductions?.nhis?.employeeContribution || 0;
          const storedLoans    = (pr.otherDeductions?.loans    || []).reduce((s, l) => s + (l.monthlyDeduction || 0), 0);
          const storedAdvances = (pr.otherDeductions?.advances || []).reduce((s, a) => s + (a.amount || 0), 0);
          const storedUnpaid   = pr.otherDeductions?.unpaidLeave?.amount || 0;
          const storedOther    = (pr.otherDeductions?.other    || []).reduce((s, o) => s + (o.amount || 0), 0);

          const newTotalDeductions = storedPaye + storedPension + storedNhf + storedNhis
            + newAttendanceTotal + storedLoans + storedAdvances + storedUnpaid + storedOther;
          const newNetPay = Math.round(grossSalary - newTotalDeductions);

          await Payroll.updateOne({ _id: pr._id }, { $set: {
            'otherDeductions.lateness':               { amount: Math.round(totalLateness),   occurrences: lateDays,       totalMinutes: totalLateMinutes },
            'otherDeductions.earlyLeave':             { amount: Math.round(totalEarlyLeave), occurrences: earlyLeaveDays, totalMinutes: totalELMinutes },
            'otherDeductions.absence':                { amount: Math.round(totalAbsence),    days: absentDays },
            'otherDeductions.totalOtherDeductions':   Math.round(newAttendanceTotal + storedLoans + storedAdvances + storedUnpaid + storedOther),
            deductionBreakdown:                       breakdown,
            'attendanceData.lateDays':                lateDays,
            'attendanceData.absentDays':              absentDays,
            'attendanceData.earlyLeaveDays':          earlyLeaveDays,
            'attendanceData.lateMinutes':             totalLateMinutes,
            'attendanceData.earlyLeaveMinutes':       totalELMinutes,
            'payrollSummary.totalDeductions':         newTotalDeductions,
            'payrollSummary.netPay':                  newNetPay,
            attendanceRecalculatedAt:                 new Date()
          }});

          summary.processed++;
        } catch (empErr) {
          summary.errors.push({ employeeNumber: pr.employeeNumber, error: empErr.message });
        }
      }
    }

    res.json({ success: true, ...summary,
      message: `Cleared and recalculated attendance deductions for ${summary.processed} record(s) across ${summary.periods} month(s).` });
  } catch (err) {
    logger.error('Recalculate attendance error', { error: err.message });
    res.status(500).json({ error: 'SERVER_ERROR', message: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// PAYSLIP HELPERS
// ═══════════════════════════════════════════════════════════════════════════

// Enrich a payslip object with accurate name/department/position from Staff collection
async function enrichPayslipFromStaff(payslipObj, employeeNumber) {
  if (!Staff || !employeeNumber) return payslipObj;
  try {
    let staff = await Staff.findOne({ employeeId: String(employeeNumber) }).lean();
    if (!staff) {
      const padded = String(employeeNumber).padStart(4, '0');
      if (padded !== String(employeeNumber)) {
        staff = await Staff.findOne({ employeeId: padded }).lean();
      }
    }
    if (!staff) return payslipObj;
    const staffName = `${staff.firstName || ''} ${staff.lastName || ''}`.trim();
    return {
      ...payslipObj,
      employeeName: staffName || payslipObj.employeeName || payslipObj.name || '',
      department:   staff.department || payslipObj.department || '',
      position:     staff.position   || staff.jobTitle || payslipObj.position || ''
    };
  } catch (_) {
    return payslipObj;
  }
}

// Build fully branded HTML payslip for email delivery
function buildPayslipEmailHtml(data) {
  const fmt     = (n) => `₦${Math.round(n || 0).toLocaleString()}`;
  const fmtMins = (m) => m > 0 ? ` (${m} min)` : '';

  // Mask bank account — show only last 4 digits
  const bank = data.bankDetails || {};
  const acct = bank.accountNumber ? `****${String(bank.accountNumber).slice(-4)}` : null;

  // Allowances rows — itemised
  const allowanceRows = (data.allowances || [])
    .filter(a => a.amount > 0 && a.isActive !== false)
    .map(a => `<tr>
      <td style="padding:5px 0 5px 16px;color:#6b7280;font-size:13px;">${a.name || a.code}</td>
      <td style="padding:5px 0;text-align:right;color:#374151;font-size:13px;">${fmt(a.amount)}</td>
    </tr>`).join('');

  const row = (label, value, color = '#374151') =>
    `<tr>
      <td style="padding:5px 0;color:#6b7280;font-size:13px;">${label}</td>
      <td style="padding:5px 0;text-align:right;color:${color};font-size:13px;font-weight:600;">${fmt(value)}</td>
    </tr>`;

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="color-scheme" content="light">
  <meta name="supported-color-schemes" content="light">
</head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;" data-ogsc>

<div style="max-width:620px;margin:24px auto;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);" data-ogsc>

  <!-- HEADER -->
  <div style="background:#1e3a5f;padding:28px 28px 20px;position:relative;" data-ogsc>
    <table style="width:100%;border-collapse:collapse;">
      <tr>
        <td style="vertical-align:top;">
          <p style="margin:0;font-size:11px;color:#ffffff !important;-webkit-text-fill-color:#ffffff;letter-spacing:1.5px;text-transform:uppercase;opacity:0.75;">Pay Slip</p>
          <h1 style="margin:4px 0 0;font-size:20px;font-weight:800;color:#ffffff !important;-webkit-text-fill-color:#ffffff;">${data.tenantName}</h1>
          <p style="margin:6px 0 0;font-size:13px;color:#ffffff !important;-webkit-text-fill-color:#ffffff;opacity:0.85;">${data.period}</p>
        </td>
        <td style="text-align:right;vertical-align:top;">
          <p style="margin:0;font-size:10px;color:#ffffff !important;-webkit-text-fill-color:#ffffff;opacity:0.6;">Ref: ${data.payslipId || ''}</p>
        </td>
      </tr>
    </table>
  </div>

  <!-- EMPLOYEE INFO -->
  <div style="background:#f8fafc;border-bottom:1px solid #e2e8f0;padding:14px 28px;">
    <table style="width:100%;border-collapse:collapse;">
      <tr>
        <td style="vertical-align:top;width:60%;">
          <p style="margin:0;font-size:16px;font-weight:700;color:#0f172a;">${data.staffName}</p>
          ${data.position ? `<p style="margin:3px 0 0;font-size:12px;color:#64748b;">${data.position}${data.department ? ` &nbsp;·&nbsp; ${data.department}` : ''}</p>` : ''}
          <p style="margin:3px 0 0;font-size:12px;color:#94a3b8;">ID: ${data.employeeNumber || ''}</p>
        </td>
        <td style="text-align:right;vertical-align:top;">
          ${acct ? `<p style="margin:0;font-size:12px;color:#64748b;">${bank.bankName || 'Bank'}</p>
          <p style="margin:3px 0 0;font-size:12px;font-weight:600;color:#0f172a;">${acct}</p>
          ${bank.accountName ? `<p style="margin:2px 0 0;font-size:11px;color:#94a3b8;">${bank.accountName}</p>` : ''}` : ''}
        </td>
      </tr>
    </table>
  </div>

  <div style="padding:20px 28px;">

    <!-- EARNINGS -->
    <div style="margin-bottom:20px;">
      <p style="margin:0 0 10px;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:1px;border-bottom:2px solid #d1fae5;padding-bottom:6px;">Earnings</p>
      <table style="width:100%;border-collapse:collapse;">
        ${row('Base Salary', data.baseSalary, '#065f46')}
        ${allowanceRows}
        ${data.overtimePay > 0 ? row('Overtime Pay', data.overtimePay) : ''}
        ${data.totalBonuses > 0 ? row('Bonus', data.totalBonuses) : ''}
        <tr style="border-top:2px solid #d1fae5;">
          <td style="padding:8px 0;font-size:14px;font-weight:700;color:#065f46;">Gross Pay</td>
          <td style="padding:8px 0;text-align:right;font-size:14px;font-weight:700;color:#065f46;">${fmt(data.grossSalary)}</td>
        </tr>
      </table>
    </div>

    <!-- DEDUCTIONS -->
    <div style="margin-bottom:20px;">
      <p style="margin:0 0 10px;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:1px;border-bottom:2px solid #fecaca;padding-bottom:6px;">Deductions</p>
      <table style="width:100%;border-collapse:collapse;">
        ${data.paye > 0 ? row('PAYE Tax', data.paye, '#dc2626') : ''}
        ${data.pension > 0 ? `<tr>
          <td style="padding:5px 0;color:#6b7280;font-size:13px;">Pension (Employee 8%)</td>
          <td style="padding:5px 0;text-align:right;color:#dc2626;font-size:13px;font-weight:600;">${fmt(data.pension)}</td>
        </tr>` : ''}
        ${data.nhf > 0 ? row('NHF (2.5%)', data.nhf, '#dc2626') : ''}
        ${data.nhis > 0 ? row('NHIS', data.nhis, '#dc2626') : ''}
        ${data.latenessDeduction > 0 ? `<tr>
          <td style="padding:5px 0;color:#6b7280;font-size:13px;">Lateness${fmtMins(data.lateMinutes)} — ${data.lateDays || 0} occurrence${data.lateDays !== 1 ? 's' : ''}</td>
          <td style="padding:5px 0;text-align:right;color:#dc2626;font-size:13px;font-weight:600;">${fmt(data.latenessDeduction)}</td>
        </tr>` : ''}
        ${data.earlyLeaveDeduction > 0 ? `<tr>
          <td style="padding:5px 0;color:#6b7280;font-size:13px;">Early Leave${fmtMins(data.earlyLeaveMinutes)}</td>
          <td style="padding:5px 0;text-align:right;color:#dc2626;font-size:13px;font-weight:600;">${fmt(data.earlyLeaveDeduction)}</td>
        </tr>` : ''}
        ${data.absenceDeduction > 0 ? row(`Absence (${data.absentDays || 0} day${data.absentDays !== 1 ? 's' : ''})`, data.absenceDeduction, '#dc2626') : ''}
        ${data.loanDeduction > 0 ? row('Loan Repayment', data.loanDeduction, '#dc2626') : ''}
        ${data.unpaidLeaveDeduction > 0 ? row(`Unpaid Leave (${data.unpaidLeaveDays} day${data.unpaidLeaveDays !== 1 ? 's' : ''})`, data.unpaidLeaveDeduction, '#dc2626') : ''}
        <tr style="border-top:2px solid #fecaca;">
          <td style="padding:8px 0;font-size:14px;font-weight:700;color:#991b1b;">Total Deductions</td>
          <td style="padding:8px 0;text-align:right;font-size:14px;font-weight:700;color:#991b1b;">${fmt(data.totalDeductions)}</td>
        </tr>
      </table>
    </div>

    <!-- NET PAY -->
    <div style="background:#0f172a;border-radius:10px;padding:20px 24px;margin-bottom:20px;display:flex;justify-content:space-between;align-items:center;" data-ogsc>
      <div>
        <p style="margin:0;font-size:11px;color:#ffffff !important;-webkit-text-fill-color:#ffffff;opacity:0.75;letter-spacing:1px;text-transform:uppercase;">Net Pay &mdash; ${data.period}</p>
        <p style="margin:4px 0 0;font-size:11px;color:#ffffff !important;-webkit-text-fill-color:#ffffff;opacity:0.65;">${fmt(data.grossSalary)} gross &minus; ${fmt(data.totalDeductions)} deductions</p>
      </div>
      <p style="margin:0;font-size:28px;font-weight:900;color:#4ade80 !important;-webkit-text-fill-color:#4ade80;letter-spacing:-1px;">${fmt(data.netSalary)}</p>
    </div>

    <!-- FOOTER -->
    <p style="margin:0 0 4px;font-size:11px;color:#94a3b8;text-align:center;">
      This is a computer-generated payslip and requires no signature.
    </p>
    <p style="margin:0;font-size:11px;color:#cbd5e1;text-align:center;">
      ${data.payslipId || ''} &nbsp;·&nbsp; ${data.period} &nbsp;·&nbsp; ${data.tenantName}
    </p>

    ${data.hrLeaveEmail ? `
    <div style="margin-top:16px;padding:14px 16px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;">
      <p style="margin:0 0 6px;font-size:12px;font-weight:600;color:#065f46;">Leave Requests</p>
      <p style="margin:0;font-size:12px;color:#6b7280;">Email <a href="mailto:${data.hrLeaveEmail}?subject=LEAVE REQUEST" style="color:#059669;font-weight:600;">${data.hrLeaveEmail}</a> with your leave type, dates, and reason.</p>
    </div>` : ''}

  </div>
</div>

</body>
</html>
  `;
}

// ═══════════════════════════════════════════════════════════════════════════
// GET /working-schedule — dynamic working days for a given month/year
// ═══════════════════════════════════════════════════════════════════════════
router.get('/working-schedule', async (req, res) => {
  try {
    const { month, year } = req.query;

    const settings = await PayrollSettings.findOne({ tenantId: TENANT_ID, isActive: true });

    const now          = getLagosDate();
    const targetYear   = year  ? parseInt(year)  : now.getFullYear();
    const targetMonth  = month ? parseInt(month) : (now.getMonth() + 1);

    const dynamicWorkingDays = await calcWorkingDaysFromEngine(targetYear, targetMonth);

    res.json({
      days:         dynamicWorkingDays,
      standardDays: settings?.workingDaysPerMonth || 26,
      hours:        settings?.workingHoursPerDay  || 8,
      month:        `${targetYear}-${String(targetMonth).padStart(2, '0')}`,
      isDynamic:    true,
      calculation:  `Mon-Sat excluding holidays for ${targetYear}/${targetMonth}`
    });
  } catch (err) {
    logger.error('Error fetching working schedule', { tenantId: TENANT_ID, error: err.message });
    res.status(500).json({ error: 'SERVER_ERROR', message: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// POST /generate-report — JSON payroll report for a period
// ═══════════════════════════════════════════════════════════════════════════
router.post('/generate-report', async (req, res) => {
  try {
    const { period, startDate, endDate } = req.body;

    let reportStartDate, reportEndDate, periodKey, dynamicWorkingDays;
    const today = getLagosDate().toISOString().split('T')[0];

    if (period) {
      const parsed = parsePeriodString(period);
      if (!parsed) return res.status(400).json({ error: 'INVALID_PERIOD', message: 'Period must be in YYYY-MM format' });

      reportStartDate = `${parsed.year}-${String(parsed.month).padStart(2, '0')}-01`;
      const lastDay   = new Date(parsed.year, parsed.month, 0).getDate();
      const monthEnd  = `${parsed.year}-${String(parsed.month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
      reportEndDate   = today <= monthEnd ? today : monthEnd;
      periodKey       = `${parsed.year}-${String(parsed.month).padStart(2, '0')}`;
      dynamicWorkingDays = await calcWorkingDaysFromEngine(parsed.year, parsed.month);
    } else if (startDate && endDate) {
      reportStartDate    = startDate;
      reportEndDate      = endDate <= today ? endDate : today;
      periodKey          = startDate.substring(0, 7);
      const [y, m]       = startDate.split('-').map(Number);
      dynamicWorkingDays = await calcWorkingDaysFromEngine(y, m);
    } else {
      return res.status(400).json({ error: 'MISSING_PARAMETERS', message: 'Either period (YYYY-MM) or date range is required' });
    }

    const preCalculatedData = await Payroll.find({
      isPreCalculated: true,
      period: periodKey,
      calculationType: { $in: ['monthly', 'historical'] }
    }).sort({ employeeNumber: 1 });

    if (preCalculatedData.length === 0) {
      return res.status(404).json({
        success: false,
        available: false,
        error: 'NO_DATA_FOUND',
        message: 'No payroll data available for this period',
        hint: 'Try a different period or run historical calculation.'
      });
    }

    let payrollData = [];
    const totals = { totalStaff: 0, totalBaseSalary: 0, totalAllowances: 0, totalGrossPay: 0, totalDeductions: 0, totalTax: 0, totalPension: 0, totalNetPay: 0 };

    for (const record of preCalculatedData) {
      const flat    = flattenPayrollRecord(record);
      const grossPay = flat.grossSalary;

      let netPay;
      if (record.isPartialPeriod && !record.isMonthComplete && record.actualWorkingDays > 0) {
        const factor = record.actualWorkingDays / dynamicWorkingDays;
        netPay = Math.max(0, grossPay * factor - flat.totalDeductions);
      } else {
        netPay = flat.netSalary;
      }

      payrollData.push({
        employeeNumber: flat.employeeNumber,
        employeeName:   flat.name,
        employeeId:     flat.employeeNumber,
        position:       flat.position,
        department:     flat.department,
        baseSalary:     flat.baseSalary,
        totalAllowances: flat.totalAllowances,
        grossPay,
        totalDeductions: flat.totalDeductions,
        taxAmount:       flat.paye,
        pensionAmount:   flat.pension,
        nhf:             flat.nhf,
        nhis:            flat.nhis,
        netPay,
        bankDetails:     record.bankDetails || { bankName: '', accountNumber: '', accountName: '' },
        presentDays:     flat.presentDays,
        absentDays:      flat.absentDays,
        actualWorkingDays:   record.actualWorkingDays || 0,
        standardWorkingDays: dynamicWorkingDays,
        isPartialPeriod:  record.isPartialPeriod  || false,
        isMonthComplete:  record.isMonthComplete   || false
      });

      totals.totalBaseSalary  += flat.baseSalary;
      totals.totalAllowances  += flat.totalAllowances;
      totals.totalGrossPay    += grossPay;
      totals.totalDeductions  += flat.totalDeductions;
      totals.totalTax         += flat.paye;
      totals.totalPension     += flat.pension;
      totals.totalNetPay      += netPay;
    }
    totals.totalStaff = payrollData.length;

    const isPartialPeriod = payrollData.some(p => p.isPartialPeriod && !p.isMonthComplete);
    const avgWorkingDays  = payrollData.length > 0
      ? payrollData.reduce((s, p) => s + (p.actualWorkingDays || 0), 0) / payrollData.length
      : dynamicWorkingDays;

    res.json({
      success:        true,
      available:      true,
      period:         period || `${reportStartDate} to ${reportEndDate}`,
      startDate:      reportStartDate,
      endDate:        reportEndDate,
      actualWorkingDays:   Math.round(avgWorkingDays),
      standardWorkingDays: dynamicWorkingDays,
      dynamicWorkingDays,
      isPartialPeriod,
      ...totals,
      payrollData,
      dataSource:    'pre-calculated',
      lastCalculated: preCalculatedData[0]?.lastCalculated || new Date(),
      prorationNote:  isPartialPeriod
        ? `Period is incomplete. Net pay prorated based on ${Math.round(avgWorkingDays)} of ${dynamicWorkingDays} working days.`
        : null
    });
  } catch (err) {
    logger.error('Error generating payroll report', { tenantId: TENANT_ID, error: err.message });
    res.status(500).json({ error: 'SERVER_ERROR', message: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// POST /payslips/generate — generate payslip documents for a period
// ═══════════════════════════════════════════════════════════════════════════
router.post('/payslips/generate', async (req, res) => {
  try {
    const { period, employeeNumbers } = req.body;

    if (!period) return res.status(400).json({ error: 'MISSING_PERIOD', message: 'Period is required' });

    const query = { period, status: { $in: ['generated', 'approved', 'paid'] } };
    if (employeeNumbers?.length > 0) query.employeeNumber = { $in: employeeNumbers };

    const payrollRecords = await Payroll.find(query).lean();

    if (payrollRecords.length === 0) {
      return res.status(400).json({ error: 'NO_PAYROLL_FOUND', message: `No payroll records found for ${period}. Payroll must be generated first.` });
    }

    const payslips = await Promise.all(payrollRecords.map(async record => {
      const flat = flattenPayrollRecord(record);

      const allowancesMap = {};
      (record.salaryStructure?.allowances || []).forEach(a => {
        if (a.name && a.amount) allowancesMap[a.name] = a.amount;
      });

      const base = {
        employeeNumber: flat.employeeNumber,
        employeeName:   flat.name,
        period,
        department:     flat.department,
        position:       flat.position,
        earnings: {
          baseSalary: flat.baseSalary,
          ...allowancesMap,
          overtime:   flat.overtimePay  || 0,
          bonuses:    flat.totalBonuses || 0,
          totalEarnings: flat.grossSalary
        },
        deductions: {
          paye:           flat.paye,
          pension:        flat.pension,
          nhf:            flat.nhf,
          nhis:           flat.nhis,
          lateness:       flat.latenessDeduction,
          earlyLeave:     flat.earlyLeaveDeduction,
          absence:        flat.absenceDeduction,
          unpaidLeave:    flat.unpaidLeaveDeduction,
          loans:          flat.loanDeduction,
          advances:       flat.advanceDeduction,
          other:          flat.otherDeductionsAmount,
          totalDeductions: flat.totalDeductions
        },
        employerPension: flat.employerPension,
        netPay:          flat.netSalary,
        attendance: {
          workingDays: record.attendanceData?.workingDays || 0,
          presentDays: flat.presentDays,
          lateDays:    flat.lateDays,
          absentDays:  flat.absentDays
        },
        bankDetails:  record.bankDetails,
        generatedAt:  new Date(),
        payslipId:    `PS-${period.replace('-', '')}-${flat.employeeNumber}`
      };
      return enrichPayslipFromStaff(base, flat.employeeNumber);
    }));

    // Mark payslips as generated
    await Payroll.updateMany(query, {
      $set: {
        payslipGenerated:    true,
        payslipGeneratedAt:  new Date(),
        payslipGeneratedBy:  req.user?.username || 'system'
      }
    });

    logger.info('Payslips generated', { tenantId: TENANT_ID, period, count: payslips.length, generatedBy: req.user?.username });

    res.json({
      success: true,
      message: `Generated ${payslips.length} payslips for ${period}`,
      period,
      count:   payslips.length,
      payslips
    });
  } catch (err) {
    logger.error('Error generating payslips', { tenantId: TENANT_ID, error: err.message });
    res.status(500).json({ error: 'SERVER_ERROR', message: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// POST /payslips/email — send HTML payslips to staff email addresses
// ═══════════════════════════════════════════════════════════════════════════
router.post('/payslips/email', async (req, res) => {
  try {
    const { period, employeeNumbers } = req.body;
    if (!period) return res.status(400).json({ error: 'MISSING_PERIOD', message: 'Period is required' });

    const query = { period, status: { $in: ['generated', 'approved', 'paid'] } };
    if (employeeNumbers?.length > 0) query.employeeNumber = { $in: employeeNumbers };

    const payrollRecords = await Payroll.find(query).lean();
    if (payrollRecords.length === 0) {
      return res.status(400).json({ error: 'NO_RECORDS', message: 'No payroll records found for this period' });
    }

    const empNumbers = payrollRecords.map(r => r.employeeNumber);
    const staffList  = await Staff.find({ employeeId: { $in: empNumbers } }).lean();
    const staffMap   = new Map();
    staffList.forEach(s => staffMap.set(s.employeeId, s));

    const [year, month] = period.split('-');
    const periodLabel   = new Date(year, parseInt(month) - 1, 1).toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
    const tenantName    = req.tenant?.businessInfo?.businessName || req.tenant?.name || 'PPAfan';

    let sent = 0, skipped = 0;
    const errors = [];

    for (const record of payrollRecords) {
      const flat  = flattenPayrollRecord(record);
      const staff = staffMap.get(record.employeeNumber);
      const email = staff?.email;

      if (!email) { skipped++; continue; }

      try {
        const payslipHtml = buildPayslipEmailHtml({
          staffName:      `${staff?.firstName || ''} ${staff?.lastName || ''}`.trim() || flat.name,
          employeeNumber: record.employeeNumber,
          department:     flat.department || staff?.department || '',
          position:       flat.position   || staff?.position   || '',
          period:         periodLabel,
          payslipId:      `PS-${period.replace('-', '')}-${record.employeeNumber}`,
          tenantName,
          tenantLogo:     req.tenant?.logo || req.tenant?.settings?.logo || '',
          baseSalary:     flat.baseSalary,
          allowances:     record.salaryStructure?.allowances || [],
          overtimePay:    flat.overtimePay  || 0,
          totalBonuses:   flat.totalBonuses || 0,
          grossSalary:    flat.grossSalary,
          paye:           flat.paye,
          pension:        flat.pension,
          employerPension: record.statutoryDeductions?.pension?.employerContribution || 0,
          nhf:            flat.nhf,
          nhis:           flat.nhis,
          latenessDeduction:   flat.latenessDeduction,
          lateMinutes:         record.attendanceData?.lateMinutes || 0,
          lateDays:            record.attendanceData?.lateDays    || flat.lateDays || 0,
          earlyLeaveDeduction: flat.earlyLeaveDeduction,
          earlyLeaveMinutes:   record.attendanceData?.earlyLeaveMinutes || 0,
          absenceDeduction:    flat.absenceDeduction,
          loanDeduction:       flat.loanDeduction,
          unpaidLeaveDeduction: flat.unpaidLeaveDeduction || 0,
          unpaidLeaveDays:      flat.unpaidLeaveDays      || 0,
          totalDeductions:      flat.totalDeductions,
          netSalary:            flat.netSalary,
          workingDays:          record.attendanceData?.workingDays || 0,
          presentDays:          flat.presentDays,
          absentDays:           flat.absentDays,
          bankDetails:          record.payment?.bankDetails || record.bankDetails || staff?.bankDetails || {},
          hrLeaveEmail:         req.tenant?.settings?.hrLeaveEmail || ''
        });

        await sendEmail(email, 'payslip', {
          subject: `Your Payslip - ${periodLabel} | ${tenantName}`,
          html:    payslipHtml,
          text:    `Your payslip for ${periodLabel} is ready. Net Pay: ₦${flat.netSalary?.toLocaleString()}`
        }, req.tenant);

        sent++;
      } catch (emailErr) {
        errors.push({ employeeNumber: record.employeeNumber, error: emailErr.message });
      }
    }

    logger.info('Payslip emails sent', { tenantId: TENANT_ID, period, sent, skipped, errors: errors.length });

    res.json({
      success: true,
      message: `Sent ${sent} payslip email${sent !== 1 ? 's' : ''}${skipped ? `, ${skipped} skipped (no email)` : ''}`,
      sent,
      skipped,
      errors: errors.length > 0 ? errors : undefined
    });
  } catch (err) {
    logger.error('Error sending payslip emails', { tenantId: TENANT_ID, error: err.message });
    res.status(500).json({ error: 'SERVER_ERROR', message: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// POST /payslips/email/resend — resend payslip to a single employee
// ═══════════════════════════════════════════════════════════════════════════
router.post('/payslips/email/resend', async (req, res) => {
  try {
    const { period, employeeNumber } = req.body;
    if (!period || !employeeNumber) {
      return res.status(400).json({ error: 'MISSING_FIELDS', message: 'Period and employeeNumber are required' });
    }

    const record = await Payroll.findOne({
      period,
      employeeNumber,
      status: { $in: ['generated', 'approved', 'paid'] }
    }).lean();

    if (!record) return res.status(404).json({ error: 'NOT_FOUND', message: 'Payroll record not found for this employee and period' });

    const staff = await Staff.findOne({ employeeId: employeeNumber }).lean();
    const email = staff?.email;
    if (!email) return res.status(400).json({ error: 'NO_EMAIL', message: 'Employee has no email address on file' });

    const [year, month] = period.split('-');
    const periodLabel   = new Date(year, parseInt(month) - 1, 1).toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
    const tenantName    = req.tenant?.businessInfo?.businessName || req.tenant?.name || 'PPAfan';
    const flat          = flattenPayrollRecord(record);

    const payslipHtml = buildPayslipEmailHtml({
      staffName:      `${staff?.firstName || ''} ${staff?.lastName || ''}`.trim() || flat.name,
      employeeNumber: record.employeeNumber,
      department:     flat.department || staff?.department || '',
      position:       flat.position   || staff?.position   || '',
      period:         periodLabel,
      payslipId:      `PS-${period.replace('-', '')}-${record.employeeNumber}`,
      tenantName,
      tenantLogo:     req.tenant?.logo || req.tenant?.settings?.logo || '',
      baseSalary:     flat.baseSalary,
      allowances:     record.salaryStructure?.allowances || [],
      overtimePay:    flat.overtimePay  || 0,
      totalBonuses:   flat.totalBonuses || 0,
      grossSalary:    flat.grossSalary,
      paye:           flat.paye,
      pension:        flat.pension,
      employerPension: record.statutoryDeductions?.pension?.employerContribution || 0,
      nhf:            flat.nhf,
      nhis:           flat.nhis,
      latenessDeduction:   flat.latenessDeduction,
      lateMinutes:         record.attendanceData?.lateMinutes || 0,
      lateDays:            record.attendanceData?.lateDays    || flat.lateDays || 0,
      earlyLeaveDeduction: flat.earlyLeaveDeduction,
      earlyLeaveMinutes:   record.attendanceData?.earlyLeaveMinutes || 0,
      absenceDeduction:    flat.absenceDeduction,
      loanDeduction:       flat.loanDeduction,
      unpaidLeaveDeduction: flat.unpaidLeaveDeduction || 0,
      unpaidLeaveDays:      flat.unpaidLeaveDays      || 0,
      totalDeductions:      flat.totalDeductions,
      netSalary:            flat.netSalary,
      workingDays:          record.attendanceData?.workingDays || 0,
      presentDays:          flat.presentDays,
      absentDays:           flat.absentDays,
      bankDetails:          record.payment?.bankDetails || record.bankDetails || staff?.bankDetails || {},
      hrLeaveEmail:         req.tenant?.settings?.hrLeaveEmail || ''
    });

    await sendEmail(email, 'payslip', {
      subject: `Your Payslip - ${periodLabel} | ${tenantName}`,
      html:    payslipHtml,
      text:    `Your payslip for ${periodLabel} is ready. Net Pay: ₦${flat.netSalary?.toLocaleString()}`
    }, req.tenant);

    logger.info('Payslip email resent', { tenantId: TENANT_ID, period, employeeNumber });
    res.json({ success: true, message: 'Payslip email sent successfully', employeeNumber, period });
  } catch (err) {
    logger.error('Error resending payslip email', { tenantId: TENANT_ID, error: err.message });
    res.status(500).json({ error: 'SERVER_ERROR', message: err.message });
  }
});

logger.debug('PPAfan payroll routes loaded', { tenantId: TENANT_ID });

module.exports = router;
