// crons/attendance-cron.js - Single-tenant daily attendance automation for Pump House ERP
const cron = require('node-cron');
const mongoose = require('mongoose');
const Tenant = require('../models/Tenant');
const getModel = require('../utils/getTenantModel');
const logger = require('../utils/logger');
const { getLagosDateString, getLagosDayOfWeek } = require('../utils/timestamp');

// Helper function to check if date is a holiday
const isHoliday = async (date, tenantId) => {
  try {
    const Attendance = getModel('Attendance');

    if (!Attendance) {
      logger.warn('Could not get Attendance model');
      return false;
    }

    const dateStr = getLagosDateString(date);

    const holiday = await Attendance.findOne({
      employeeId: 'HOLIDAY',
      date: dateStr,
      tenantId: tenantId
    });

    return !!holiday;
  } catch (error) {
    logger.error('Error checking holiday', {
      tenantId,
      date: getLagosDateString(date),
      error: error.message
    });
    return false;
  }
};

// Create absent records for staff with shifts who didn't clock in
async function createAbsentRecordsForTenant(tenantId) {
  try {
    const now = new Date();
    const today = getLagosDateString(now);
    const dayOfWeek = getLagosDayOfWeek(now);

    // Skip holidays
    if (await isHoliday(now, tenantId)) {
      return { success: true, message: 'Holiday - skipped', date: today, tenantId };
    }

    // Get models (single-tenant)
    const Staff = getModel('Staff');
    const Attendance = getModel('Attendance');
    const Shift = getModel('Shift');
    const LeaveRequest = getModel('LeaveRequest');

    if (!Staff || !Attendance || !Shift) {
      logger.debug('Attendance models unavailable', { tenantId });
      return { success: false, message: 'Models not available', tenantId };
    }

    const allStaff = await Staff.find({
      employeeId: { $not: /^CONFIG_/ }
    }).lean();

    if (allStaff.length === 0) {
      return { success: true, message: 'No staff configured', date: today, tenantId };
    }

    let createdCount = 0;
    let existingCount = 0;
    let noShiftCount = 0;
    let onLeaveCount = 0;

    for (const staff of allStaff) {
      try {
        // Check for approved leave
        if (LeaveRequest) {
          const approvedLeave = await LeaveRequest.findOne({
            employeeId: staff.employeeId,
            status: 'approved',
            startDate: { $lte: today },
            endDate: { $gte: today },
            tenantId: tenantId
          });

          if (approvedLeave) {
            logger.debug('Staff has approved leave - skipping absence marking', {
              tenantId,
              employeeId: staff.employeeId,
              date: today,
              leaveType: approvedLeave.leaveType
            });
            onLeaveCount++;
            continue;
          }
        }

        const shift = await Shift.findOne({
          staffId: staff._id,
          dayOfWeek: dayOfWeek
        });

        if (!shift) {
          noShiftCount++;
          continue;
        }

        const existingRecord = await Attendance.findOne({
          employeeId: staff.employeeId,
          date: today
        });

        if (existingRecord) {
          existingCount++;
          continue;
        }

        const absentRecord = new Attendance({
          employeeId: staff.employeeId,
          date: today,
          subBusiness: staff.subBusiness || 'General',
          absent: true,
          checkIn: null,
          checkOut: null,
          late: false,
          lateMinutes: 0,
          earlyLeave: false,
          earlyLeaveMinutes: 0,
          overtimeHours: 0,
          adjustmentNote: `Auto-created absent record - Staff had ${shift.resumptionTime}-${shift.closingTime} shift but no attendance recorded`,
          tenantId: tenantId
        });

        await absentRecord.save();
        createdCount++;

      } catch (staffError) {
        logger.warn('Error processing staff attendance', {
          tenantId: tenantId,
          employeeId: staff.employeeId,
          error: staffError.message
        });
      }
    }

    if (createdCount > 0) {
      logger.info('Absent records created', {
        tenantId: tenantId,
        date: today,
        created: createdCount,
        existing: existingCount,
        noShift: noShiftCount,
        onLeave: onLeaveCount,
        total: allStaff.length
      });
    }

    return {
      success: true,
      date: today,
      dayOfWeek: dayOfWeek,
      created: createdCount,
      existing: existingCount,
      noShift: noShiftCount,
      onLeave: onLeaveCount,
      total: allStaff.length,
      tenantId: tenantId
    };

  } catch (error) {
    logger.error('Daily absent record creation failed', {
      tenantId: tenantId,
      error: error.message
    });
    throw error;
  }
}

// Process all active tenants
async function createAbsentRecordsForAllTenants() {
  try {
    logger.info('Starting absent record creation', { tenantId: 'system' });

    const activeTenants = await Tenant.find({ status: 'active' }).lean();

    if (activeTenants.length === 0) {
      logger.info('No active tenants found', { tenantId: 'system' });
      return { success: true, message: 'No active tenants', processedTenants: 0 };
    }

    let processedTenants = 0;
    let totalCreated = 0;
    const results = [];

    for (const tenant of activeTenants) {
      try {
        const result = await createAbsentRecordsForTenant(tenant.tenantId);
        results.push(result);
        processedTenants++;
        totalCreated += result.created || 0;

        logger.debug('Processed tenant absent records', {
          tenantId: tenant.tenantId,
          businessName: tenant.businessName,
          created: result.created || 0
        });

      } catch (tenantError) {
        logger.error('Failed to process tenant absent records', {
          tenantId: tenant.tenantId,
          businessName: tenant.businessName,
          error: tenantError.message
        });
      }
    }

    logger.info('Absent record creation completed', {
      tenantId: 'system',
      processedTenants: processedTenants,
      totalTenants: activeTenants.length,
      totalCreated: totalCreated
    });

    return {
      success: true,
      processedTenants: processedTenants,
      totalTenants: activeTenants.length,
      totalCreated: totalCreated,
      results: results
    };

  } catch (error) {
    logger.error('Absent record creation failed', {
      tenantId: 'system',
      error: error.message
    });
    throw error;
  }
}

// Check if attendance system is configured
async function isAttendanceSystemConfigured() {
  try {
    const Staff = getModel('Staff');
    const Shift = getModel('Shift');

    if (!Staff || !Shift) return false;

    const staffCount = await Staff.countDocuments({
      employeeId: { $not: /^CONFIG_/ }
    });
    const shiftCount = await Shift.countDocuments({});

    return staffCount > 0 && shiftCount > 0;
  } catch (error) {
    logger.error('Error checking attendance system configuration', {
      tenantId: 'system',
      error: error.message
    });
    return false;
  }
}

// Schedule cron job only if attendance system is configured
async function initializeAttendanceCron() {
  try {
    const isConfigured = await isAttendanceSystemConfigured();

    if (!isConfigured) {
      logger.debug('Attendance system not configured, skipping cron initialization', {
        tenantId: 'system'
      });
      return;
    }

    // Schedule daily cron at 11:55 PM Lagos time
    cron.schedule('55 23 * * *', async () => {
      try {
        await createAbsentRecordsForAllTenants();
      } catch (error) {
        logger.error('Daily absent record cron failed', {
          tenantId: 'system',
          error: error.message
        });
      }
    }, {
      timezone: 'Africa/Lagos'
    });

    // Run initial check after server startup (delayed)
    setTimeout(async () => {
      try {
        logger.info('Running initial absent record check', { tenantId: 'system' });
        await createAbsentRecordsForAllTenants();
      } catch (error) {
        logger.warn('Initial absent record check failed', {
          tenantId: 'system',
          error: error.message
        });
      }
    }, 30000);

    logger.info('Attendance cron initialized', {
      tenantId: 'system',
      schedule: '11:55 PM Lagos time daily'
    });

  } catch (error) {
    logger.warn('Attendance cron initialization failed', {
      tenantId: 'system',
      error: error.message
    });
  }
}

// Initialize on module load
initializeAttendanceCron();

// ─────────────────────────────────────────────────────────────────────────────
// LEAVE CARRYOVER FUNCTIONS
// Called by attendance routes (/leave-balances/carry-over and /expire-carryover)
// and scheduled automatically on Jan 1 / daily.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * runYearEndCarryover(tenantId, fromYear, toYear)
 * Copies eligible unused leave days from fromYear into toYear for all active staff,
 * honouring each policy's carryoverPolicy (none / limited / unlimited) and maxDays cap.
 */
async function runYearEndCarryover(tenantId, fromYear, toYear) {
  const LeaveBalance = getModel('LeaveBalance');
  const LeavePolicy  = getModel('LeavePolicy');
  const Staff        = getModel('Staff');
  if (!LeaveBalance || !LeavePolicy || !Staff) return { carried: 0, skipped: 0 };

  const policies  = await LeavePolicy.find({ tenantId, isActive: true }).lean();
  const staffList = await Staff.find({ tenantId, status: 'active', employeeId: { $not: /^CONFIG_/ } }).lean();
  let carried = 0;
  let skipped = 0;

  for (const staff of staffList) {
    for (const policy of policies) {
      if (policy.carryoverPolicy === 'none') { skipped++; continue; }

      const fromBal = await LeaveBalance.findOne({
        tenantId,
        employeeId: staff.employeeId,
        year: fromYear,
        leaveType: policy.leaveType
      }).lean();

      if (!fromBal) { skipped++; continue; }

      const available = (fromBal.entitledDays    || 0) +
                        (fromBal.carriedOverDays  || 0) -
                        (fromBal.usedDays         || 0) -
                        (fromBal.pendingDays      || 0) +
                        (fromBal.adjustmentDays   || 0);
      if (available <= 0) { skipped++; continue; }

      const carryDays = policy.carryoverPolicy === 'limited'
        ? Math.min(available, policy.carryoverMaxDays || 0)
        : available; // unlimited

      await LeaveBalance.findOneAndUpdate(
        { tenantId, employeeId: staff.employeeId, year: toYear, leaveType: policy.leaveType },
        {
          $set: {
            staffName:       fromBal.staffName,
            staffId:         fromBal.staffId,
            entitledDays:    policy.entitlementDays || 0,
            carriedOverDays: carryDays,
            usedDays:        0,
            pendingDays:     0,
            adjustmentDays:  0,
            lastUpdated:     new Date()
          }
        },
        { upsert: true, new: true }
      );
      carried++;
    }
  }

  logger.info('Leave carryover complete', { tenantId, fromYear, toYear, carried, skipped });
  return { carried, skipped };
}

/**
 * runCarryoverExpiry(tenantId, year)
 * Forfeits unused carried-over days where today has passed the policy's carryoverExpiry (MM-DD).
 */
async function runCarryoverExpiry(tenantId, year) {
  const LeaveBalance = getModel('LeaveBalance');
  const LeavePolicy  = getModel('LeavePolicy');
  if (!LeaveBalance || !LeavePolicy) return { expired: 0 };

  const today      = new Date();
  const todayMMDD  = `${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  const policies = await LeavePolicy.find({
    tenantId,
    isActive: true,
    carryoverPolicy: { $ne: 'none' },
    carryoverExpiry: { $ne: null, $exists: true }
  }).lean();

  let expired = 0;

  for (const policy of policies) {
    if (!policy.carryoverExpiry || policy.carryoverExpiry !== todayMMDD) continue;

    const balances = await LeaveBalance.find({
      tenantId,
      year,
      leaveType: policy.leaveType,
      carriedOverDays: { $gt: 0 }
    }).lean();

    for (const bal of balances) {
      const totalUsed     = (bal.usedDays || 0) + (bal.pendingDays || 0);
      const carryoverUsed    = Math.max(0, Math.min(bal.carriedOverDays, totalUsed - (bal.entitledDays || 0)));
      const carryoverExpired = bal.carriedOverDays - carryoverUsed;

      if (carryoverExpired <= 0) continue;

      await LeaveBalance.findByIdAndUpdate(bal._id, {
        $set: { carriedOverDays: carryoverUsed, lastUpdated: new Date() }
      });
      expired++;
    }
  }

  if (expired > 0) {
    logger.info('Leave carryover expiry applied', { tenantId, year, expired });
  }
  return { expired };
}

// ── Jan 1 at 02:30 AM — auto year-end carryover ──────────────────────────────
cron.schedule('30 2 1 1 *', async () => {
  const now      = new Date();
  const toYear   = now.getFullYear();
  const fromYear = toYear - 1;
  logger.info('Year-end leave carryover cron starting', { fromYear, toYear });
  try {
    const Tenant = require('../models/Tenant');
    const tenants = await Tenant.find({ status: 'active' }).lean();
    let totalCarried = 0;
    for (const tenant of tenants) {
      try {
        const { carried } = await runYearEndCarryover(tenant.tenantId, fromYear, toYear);
        totalCarried += carried;
      } catch (err) {
        logger.warn('Carryover failed for tenant', { tenantId: tenant.tenantId, error: err.message });
      }
    }
    logger.info('Year-end leave carryover cron complete', { fromYear, toYear, totalCarried });
  } catch (err) {
    logger.error('Year-end carryover cron error', { error: err.message });
  }
}, { timezone: 'Africa/Lagos' });

// ── Daily at 03:00 AM — expire carried-over days past their policy expiry date ─
cron.schedule('0 3 * * *', async () => {
  const year = new Date().getFullYear();
  try {
    const Tenant = require('../models/Tenant');
    const tenants = await Tenant.find({ status: 'active' }).lean();
    let totalExpired = 0;
    for (const tenant of tenants) {
      try {
        const { expired } = await runCarryoverExpiry(tenant.tenantId, year);
        totalExpired += expired;
      } catch (err) {
        logger.warn('Carryover expiry failed for tenant', { tenantId: tenant.tenantId, error: err.message });
      }
    }
    if (totalExpired > 0) {
      logger.info('Leave carryover expiry cron complete', { year, totalExpired });
    }
  } catch (err) {
    logger.error('Carryover expiry cron error', { error: err.message });
  }
}, { timezone: 'Africa/Lagos' });

module.exports = {
  createAbsentRecordsForAllTenants,
  createAbsentRecordsForTenant,
  runYearEndCarryover,
  runCarryoverExpiry
};
