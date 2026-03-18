// PPAfan Attendance System - Payroll Cron
// Daily/weekly incremental payroll pre-calculation with auto-absence detection.
// Single-tenant. Ported and adapted from OPSuite payroll infrastructure.

const cron = require('node-cron');
const Payroll         = require('../models/Payroll');
const PayrollSettings = require('../models/PayrollSettings');
const Loan            = require('../models/Loan');
const getTenantModel  = require('../utils/getTenantModel');
const Staff           = getTenantModel('Staff');
const Attendance      = getTenantModel('Attendance');
const logger          = require('../utils/logger');

const {
  calculateLatenessDeduction,
  calculateEarlyLeaveDeduction,
  calculateAbsenceDeduction,
  calculateRates
} = require('../utils/payrollCalculations');

const TENANT_ID = 'ppafan';

// ============================================
// LAGOS TIMEZONE HELPERS
// ============================================

const getLagosDate = (date = null) => {
  const target = date ? new Date(date) : new Date();
  return new Date(target.toLocaleString('en-US', { timeZone: 'Africa/Lagos' }));
};

const getLagosDateString = (date = null) =>
  getLagosDate(date).toISOString().split('T')[0];

function getTodayBoundaries() {
  const today = getLagosDateString();
  return { startDate: today, endDate: today, dateKey: today };
}

function getCurrentWeekBoundaries() {
  const now       = getLagosDate();
  const dayOfWeek = now.getDay();
  const monday    = new Date(now);
  const offset    = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  monday.setDate(now.getDate() + offset);
  const saturday = new Date(monday);
  saturday.setDate(monday.getDate() + 5);
  return {
    startDate: monday.toISOString().split('T')[0],
    endDate:   saturday.toISOString().split('T')[0],
    weekKey:   `${monday.getFullYear()}-W${String(Math.ceil(monday.getDate() / 7)).padStart(2, '0')}`
  };
}

function getCurrentMonthBoundaries() {
  const now   = getLagosDate();
  const year  = now.getFullYear();
  const month = now.getMonth() + 1;
  return {
    startDate: new Date(year, month - 1, 1).toISOString().split('T')[0],
    endDate:   new Date(year, month,     0).toISOString().split('T')[0],
    monthKey:  `${year}-${String(month).padStart(2, '0')}`,
    year,
    month
  };
}

function getHistoricalMonthBoundaries(year, month) {
  return {
    startDate: new Date(year, month - 1, 1).toISOString().split('T')[0],
    endDate:   new Date(year, month,     0).toISOString().split('T')[0],
    monthKey:  `${year}-${String(month).padStart(2, '0')}`,
    year,
    month
  };
}

// ============================================
// WORKING DAYS CALCULATION
// Checks for manually entered holiday records in the Attendance collection.
// ============================================
async function calculateWorkingDaysForMonth(year, month) {
  const firstDay = new Date(year, month - 1, 1);
  const lastDay  = new Date(year, month,     0);
  let workingDays = 0;

  for (let date = new Date(firstDay); date <= lastDay; date.setDate(date.getDate() + 1)) {
    const dayOfWeek = date.getDay();
    if (dayOfWeek >= 1 && dayOfWeek <= 6) {
      const dateStr       = date.toISOString().split('T')[0];
      const manualHoliday = await Attendance.findOne({
        employeeId:     'HOLIDAY',
        date:           dateStr,
        adjustmentNote: { $not: { $regex: /Automatically detected/ } }
      });
      if (!manualHoliday) workingDays++;
    }
  }

  return workingDays;
}

// ============================================
// CONFIGURATION CHECK
// ============================================
async function isPayrollSystemConfigured() {
  try {
    const settings        = await PayrollSettings.findOne({ tenantId: TENANT_ID, isActive: true });
    const staffWithSalary = await Staff.countDocuments({
      baseSalary: { $exists: true, $gt: 0 },
      employeeId: { $not: /^CONFIG_/ }
    });
    return !!(settings && staffWithSalary > 0);
  } catch (error) {
    logger.error('Payroll config check failed', { tenantId: TENANT_ID, error: error.message });
    return false;
  }
}

// ============================================
// AUTO-ABSENCE DETECTION
// Marks staff with no attendance record on a working day as absent.
// ============================================
async function detectAbsences(dateStr, settings) {
  try {
    const dayOfWeek = new Date(dateStr).getDay();
    if (dayOfWeek === 0) return [];

    const dayNames       = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const workingDaysDef = settings?.processing?.workingDaysDefinition ||
                           ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

    if (!workingDaysDef.includes(dayNames[dayOfWeek])) return [];

    const holiday = await Attendance.findOne({ employeeId: 'HOLIDAY', date: dateStr });
    if (holiday) return [];

    const allStaff = await Staff.find({
      baseSalary: { $exists: true, $gt: 0 },
      employeeId: { $not: /^CONFIG_/ },
      status:     'active',
      'payroll.excludeFromDeductions': { $ne: true }
    });

    const attendanceRecords = await Attendance.find({
      date:       dateStr,
      employeeId: { $nin: ['HOLIDAY'] }
    });

    const attendedIds = new Set(
      attendanceRecords
        .filter(r => !String(r.employeeId).startsWith('LEAVE_'))
        .map(r => r.employeeId?.toString())
    );
    const onLeaveIds = new Set(
      attendanceRecords
        .filter(r => String(r.employeeId).startsWith('LEAVE_'))
        .map(r => r.employeeId.replace('LEAVE_', ''))
    );

    const absences = [];
    for (const staff of allStaff) {
      const empId = staff.employeeId?.toString();
      if (!attendedIds.has(empId) && !onLeaveIds.has(empId)) {
        absences.push({
          employeeId:  empId,
          staffId:     staff._id,
          name:        `${staff.firstName} ${staff.lastName || ''}`.trim(),
          date:        dateStr,
          subBusiness: staff.subBusiness || 'General'
        });
      }
    }

    if (absences.length > 0) {
      logger.info('Auto-detected absences', {
        tenantId: TENANT_ID,
        date:     dateStr,
        count:    absences.length,
        employees: absences.map(a => a.employeeId)
      });
    }

    return absences;
  } catch (error) {
    logger.error('Absence detection failed', { tenantId: TENANT_ID, date: dateStr, error: error.message });
    return [];
  }
}

// ============================================
// CORE PAYROLL CALCULATION
// Writes incremental pre-calc payroll records (draft) for a date range.
// Full statutory deductions (PAYE, pension, etc.) are applied when the
// HR manager triggers "Generate Payroll" via the route endpoint.
// ============================================
async function calculatePayroll(startDate, endDate, calculationType = 'monthly', calculationSource = 'daily_cron') {
  try {
    const settings = await PayrollSettings.findOne({ tenantId: TENANT_ID, isActive: true });
    if (!settings) {
      return { success: false, error: 'Payroll settings not configured', tenantId: TENANT_ID };
    }

    const staff = await Staff.find({
      baseSalary: { $exists: true, $gt: 0 },
      employeeId: { $not: /^CONFIG_/ },
      status:     'active'
    });

    if (staff.length === 0) {
      return { success: false, error: 'No staff with salaries configured', tenantId: TENANT_ID };
    }

    const today = getLagosDate();

    const rawAttendance = await Attendance.find({
      date:       { $gte: startDate, $lte: endDate },
      employeeId: { $not: /^(HOLIDAY|LEAVE_)/ }
    });
    const validAttendance = rawAttendance.filter(r => getLagosDate(r.date) <= today);

    let dynamicWorkingDays = 1;
    if (calculationType === 'monthly') {
      const [startYear, startMonth] = startDate.split('-').map(Number);
      dynamicWorkingDays = await calculateWorkingDaysForMonth(startYear, startMonth);
    }

    const dateRange   = [];
    const currentDate = new Date(startDate);
    const endDateObj  = new Date(endDate);
    while (currentDate <= endDateObj && currentDate <= today) {
      dateRange.push(currentDate.toISOString().split('T')[0]);
      currentDate.setDate(currentDate.getDate() + 1);
    }

    const allAutoAbsences = [];
    for (const dateStr of dateRange) {
      const absences = await detectAbsences(dateStr, settings);
      allAutoAbsences.push(...absences);
    }

    for (const absence of allAutoAbsences) {
      const existing = await Attendance.findOne({
        employeeId: absence.employeeId,
        date:       absence.date
      });
      if (!existing) {
        await Attendance.create({
          employeeId:        absence.employeeId,
          date:              absence.date,
          absent:            true,
          checkIn:           null,
          checkOut:          null,
          late:              false,
          lateMinutes:       0,
          earlyLeave:        false,
          earlyLeaveMinutes: 0,
          adjustmentNote:    'Auto-detected absence (no attendance record found)',
          tenantId:          TENANT_ID,
          subBusiness:       absence.subBusiness || 'General'
        });
      }
    }

    const updatedRaw     = await Attendance.find({
      date:       { $gte: startDate, $lte: endDate },
      employeeId: { $not: /^(HOLIDAY|LEAVE_)/ }
    });
    const finalAttendance = updatedRaw.filter(r => getLagosDate(r.date) <= today);

    let processedCount = 0;
    const errors       = [];

    for (const staffMember of staff) {
      try {
        // Skip deduction processing for excluded staff
        if (staffMember.payroll?.excludeFromDeductions) {
          processedCount++;
          continue;
        }

        const memberAttendance = finalAttendance.filter(
          r => r.employeeId?.toString() === staffMember.employeeId?.toString()
        );

        const baseSalary      = staffMember.baseSalary || 0;
        const staffPayroll    = staffMember.payroll || {};
        const staffAllowances = staffPayroll.allowances || [];

        const housingAllowance   = staffAllowances.find(a => a.code === 'HOUSING')?.amount
                                   || staffMember.housingAllowance || 0;
        const transportAllowance = staffAllowances.find(a => a.code === 'TRANSPORT')?.amount
                                   || staffMember.transportAllowance || 0;
        const mealAllowance      = staffAllowances.find(a => a.code === 'MEAL')?.amount
                                   || staffMember.mealAllowance || 0;
        const otherAllowances    = staffMember.otherAllowances || 0;

        const rates       = calculateRates(baseSalary, dynamicWorkingDays, settings?.processing?.workingHoursPerDay || 8);
        const dailySalary = rates.dailyRate;

        const grossPay   = baseSalary + housingAllowance + transportAllowance + mealAllowance + otherAllowances;
        const dailyGross = grossPay / dynamicWorkingDays;

        let totalDeductions        = 0;
        let deductionBreakdown     = [];
        let presentDays            = 0;
        let absentDays             = 0;
        let totalLateMinutes       = 0;
        let totalEarlyLeaveMinutes = 0;
        let lateDayCount           = 0;
        let earlyLeaveDayCount     = 0;

        memberAttendance.forEach(record => {
          if (!record.absent && (record.checkIn || record.checkOut)) {
            presentDays++;
          } else if (record.absent) {
            absentDays++;
          }

          if (record.late && record.lateMinutes > 0) {
            const result = calculateLatenessDeduction(record.lateMinutes, dailySalary, settings);
            if (result.amount > 0) {
              totalDeductions  += result.amount;
              totalLateMinutes += record.lateMinutes;
              lateDayCount++;
              deductionBreakdown.push({
                date:        record.date,
                type:        'lateness',
                amount:      result.amount,
                minutes:     record.lateMinutes,
                description: `Late by ${record.lateMinutes} minutes`
              });
            }
          }

          if (record.earlyLeave && record.earlyLeaveMinutes > 0) {
            const result = calculateEarlyLeaveDeduction(record.earlyLeaveMinutes, dailySalary, settings);
            if (result.amount > 0) {
              totalDeductions        += result.amount;
              totalEarlyLeaveMinutes += record.earlyLeaveMinutes;
              earlyLeaveDayCount++;
              deductionBreakdown.push({
                date:        record.date,
                type:        'early_leave',
                amount:      result.amount,
                minutes:     record.earlyLeaveMinutes,
                description: `Early leave by ${record.earlyLeaveMinutes} minutes`
              });
            }
          }

          if (record.absent) {
            const result = calculateAbsenceDeduction(dailySalary, dailyGross, settings, record.isHalfDay);
            if (result.amount > 0) {
              totalDeductions += result.amount;
              deductionBreakdown.push({
                date:        record.date,
                type:        'absence',
                amount:      result.amount,
                description: record.isHalfDay ? 'Half-day absence' : 'Full-day absence'
              });
            }
          }
        });

        let periodString;
        if (calculationType === 'daily') {
          periodString = startDate;
        } else if (calculationType === 'weekly') {
          periodString = getCurrentWeekBoundaries().weekKey;
        } else {
          const [y, m] = startDate.split('-').map(Number);
          periodString = `${y}-${String(m).padStart(2, '0')}`;
        }

        const payrollData = {
          tenantId:        TENANT_ID,
          employeeId:      staffMember._id,
          employeeNumber:  staffMember.employeeId,
          employeeName:    `${staffMember.firstName} ${staffMember.lastName || ''}`.trim(),
          position:        staffMember.position   || 'N/A',
          department:      staffMember.department || 'N/A',
          period:          periodString,
          periodStartDate: startDate,
          periodEndDate:   endDate,

          salaryStructure: {
            baseSalary,
            allowances: staffAllowances.map(a => ({
              code:            a.code,
              name:            a.name,
              amount:          a.amount || 0,
              calculationType: a.calculationType || 'fixed',
              isTaxable:       true,
              isPensionable:   a.isPensionable || false
            }))
          },

          otherDeductions: {
            lateness: {
              amount:       deductionBreakdown.filter(d => d.type === 'lateness').reduce((s, d) => s + d.amount, 0),
              occurrences:  lateDayCount,
              totalMinutes: totalLateMinutes
            },
            earlyLeave: {
              amount:       deductionBreakdown.filter(d => d.type === 'early_leave').reduce((s, d) => s + d.amount, 0),
              occurrences:  earlyLeaveDayCount,
              totalMinutes: totalEarlyLeaveMinutes
            },
            absence: {
              amount: deductionBreakdown.filter(d => d.type === 'absence').reduce((s, d) => s + d.amount, 0),
              days:   absentDays
            },
            totalOtherDeductions: totalDeductions
          },

          deductionBreakdown,

          attendanceData: {
            presentDays,
            absentDays,
            lateDays:            lateDayCount,
            earlyLeaveDays:      earlyLeaveDayCount,
            lateMinutes:         totalLateMinutes,
            earlyLeaveMinutes:   totalEarlyLeaveMinutes,
            standardWorkingDays: dynamicWorkingDays,
            actualWorkingDays:   presentDays
          },

          payrollSummary: {
            basicSalary:          baseSalary,
            totalAllowances:      staffAllowances.reduce((s, a) => s + (a.amount || 0), 0),
            grossSalary:          grossPay,
            totalOtherDeductions: totalDeductions
          },

          payment: {
            status:      'pending',
            bankDetails: staffMember.bankDetails || staffPayroll.bankDetails || {}
          },

          status:            'draft',
          calculationType,
          lastCalculated:    new Date(),
          isPreCalculated:   true,
          calculationSource,
          monthStartDate:    startDate,
          monthEndDate:      endDate
        };

        await Payroll.findOneAndUpdate(
          { tenantId: TENANT_ID, employeeNumber: staffMember.employeeId, period: periodString },
          payrollData,
          { upsert: true, new: true, setDefaultsOnInsert: true }
        );

        processedCount++;

      } catch (staffError) {
        errors.push(`${staffMember.employeeId}: ${staffError.message}`);
        logger.error('Staff payroll calculation failed', {
          tenantId:   TENANT_ID,
          employeeId: staffMember.employeeId,
          error:      staffError.message
        });
      }
    }

    if (processedCount > 0) {
      logger.info('Payroll calculation completed', {
        tenantId:           TENANT_ID,
        calculationType,
        period:             `${startDate} to ${endDate}`,
        processedStaff:     processedCount,
        totalStaff:         staff.length,
        autoAbsences:       allAutoAbsences.length,
        dynamicWorkingDays,
        errors:             errors.length,
        calculationSource
      });
    }

    return {
      success:            true,
      processedStaff:     processedCount,
      totalStaff:         staff.length,
      dynamicWorkingDays,
      autoAbsences:       allAutoAbsences.length,
      errors,
      calculationType,
      period:             `${startDate} to ${endDate}`,
      tenantId:           TENANT_ID,
      calculationSource
    };

  } catch (error) {
    logger.error('Payroll calculation failed', { tenantId: TENANT_ID, calculationType, error: error.message });
    return { success: false, error: error.message, tenantId: TENANT_ID };
  }
}

// ============================================
// HISTORICAL PAYROLL
// ============================================
async function calculateHistoricalPayroll(year, month, calculationSource = 'historical_backfill') {
  try {
    const bounds = getHistoricalMonthBoundaries(year, month);

    await Payroll.deleteMany({
      tenantId:        TENANT_ID,
      period:          bounds.monthKey,
      isPreCalculated: true,
      status:          { $in: ['draft', 'preliminary'] }
    });

    logger.info('Starting historical payroll calculation', {
      tenantId:          TENANT_ID,
      year, month,
      period:            `${bounds.startDate} to ${bounds.endDate}`,
      calculationSource
    });

    const result = await calculatePayroll(
      bounds.startDate, bounds.endDate, 'monthly', calculationSource
    );

    return { ...result, historical: true, requestedPeriod: { year, month } };

  } catch (error) {
    logger.error('Historical payroll calculation failed', { tenantId: TENANT_ID, year, month, error: error.message });
    return { success: false, error: error.message, tenantId: TENANT_ID, historical: true };
  }
}

async function calculateAllHistoricalPayroll(calculationSource = 'historical_backfill') {
  try {
    const firstRecord = await Attendance.findOne({
      employeeId: { $not: /^(HOLIDAY|LEAVE_)/ }
    }).sort({ date: 1 });

    if (!firstRecord) {
      return { success: false, error: 'No attendance records found', tenantId: TENANT_ID };
    }

    const startDate   = new Date(firstRecord.date);
    const currentDate = getLagosDate();
    const results     = [];
    let totalProcessed = 0;
    let totalErrors    = 0;

    let yr = startDate.getFullYear();
    let mo = startDate.getMonth() + 1;

    while (
      yr < currentDate.getFullYear() ||
      (yr === currentDate.getFullYear() && mo <= currentDate.getMonth() + 1)
    ) {
      try {
        const result = await calculateHistoricalPayroll(yr, mo, calculationSource);
        results.push(result);
        totalProcessed += result.processedStaff || 0;
        totalErrors    += result.errors?.length  || 0;
      } catch (monthError) {
        results.push({ success: false, error: monthError.message, year: yr, month: mo, tenantId: TENANT_ID });
        totalErrors++;
      }

      mo++;
      if (mo > 12) { mo = 1; yr++; }
    }

    return {
      success:              true,
      totalMonthsProcessed: results.length,
      totalStaffProcessed:  totalProcessed,
      totalErrors,
      results,
      tenantId:             TENANT_ID,
      calculationSource,
      historical:           true,
      complete:             true
    };

  } catch (error) {
    logger.error('Complete historical payroll calculation failed', { tenantId: TENANT_ID, error: error.message });
    return { success: false, error: error.message, tenantId: TENANT_ID, historical: true };
  }
}

// ============================================
// SCHEDULED CRON WRAPPERS
// ============================================

async function calculateDailyPayroll(calculationSource = 'daily_cron') {
  const bounds = getCurrentMonthBoundaries();
  return calculatePayroll(bounds.startDate, bounds.endDate, 'monthly', calculationSource);
}

async function calculateWeeklyPayroll(calculationSource = 'weekly_cron') {
  const bounds = getCurrentMonthBoundaries();
  return calculatePayroll(bounds.startDate, bounds.endDate, 'monthly', calculationSource);
}

// ============================================
// CRON INITIALIZATION
// ============================================
async function initializePayrollCron() {
  try {
    const configured = await isPayrollSystemConfigured();
    if (!configured) {
      logger.debug('Payroll system not yet configured — skipping cron initialization', { tenantId: TENANT_ID });
      return;
    }

    // Daily at 12:30 AM Lagos (Tue–Sun) — runs after attendance cron at 11:55 PM
    cron.schedule('30 0 * * 2-7', async () => {
      try {
        logger.info('Running daily payroll processing', { tenantId: TENANT_ID });
        await calculateDailyPayroll('daily_cron');
      } catch (error) {
        logger.error('Daily payroll cron failed', { tenantId: TENANT_ID, error: error.message });
      }
    }, { timezone: 'Africa/Lagos' });

    // Weekly on Monday at 2 AM Lagos (after Sunday attendance cron)
    cron.schedule('0 2 * * 1', async () => {
      try {
        logger.info('Running weekly payroll processing', { tenantId: TENANT_ID });
        await calculateWeeklyPayroll('weekly_cron');
      } catch (error) {
        logger.error('Weekly payroll cron failed', { tenantId: TENANT_ID, error: error.message });
      }
    }, { timezone: 'Africa/Lagos' });

    // Startup run — delayed 20 s to let DB connections settle
    setTimeout(async () => {
      try {
        logger.info('Running startup payroll processing', { tenantId: TENANT_ID });
        await calculateDailyPayroll('startup');
      } catch (error) {
        logger.warn('Startup payroll processing failed', { tenantId: TENANT_ID, error: error.message });
      }
    }, 20000);

    logger.info('Payroll crons initialized', {
      tenantId: TENANT_ID,
      schedule: [
        'Daily processing: 12:30 AM Lagos (Tue–Sun)',
        'Weekly recalculation: 2 AM Lagos (Monday)'
      ]
    });

  } catch (error) {
    logger.warn('Payroll cron initialization failed', { tenantId: TENANT_ID, error: error.message });
  }
}

initializePayrollCron();

// ============================================
// EXPORTS (used by payroll routes)
// ============================================
module.exports = {
  calculateDailyPayroll,
  calculateWeeklyPayroll,
  calculatePayroll,
  calculateHistoricalPayroll,
  calculateAllHistoricalPayroll,
  getCurrentMonthBoundaries,
  getHistoricalMonthBoundaries,
  getTodayBoundaries,
  getCurrentWeekBoundaries,
  calculateWorkingDaysForMonth,
  isPayrollSystemConfigured
};
