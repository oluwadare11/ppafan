// Single-Tenant Aware Attendance Routes with Complete Isolation
const express = require('express');
const router = express.Router();
const { requireAuthentication } = require('../middleware/cookieAuth');
const { identifyTenant, addTenantHelpers, requireActiveTenant } = require('../middleware/tenant');
const { sendEmail } = require('../utils/email');
const { formatTimestampForEmail, getLagosDateString, getLagosDayOfWeek, createLagosShiftTime } = require('../utils/timestamp');
const logger = require('../utils/logger');

// COMPLETE MIDDLEWARE STACK FOR ALL ROUTES
router.use(identifyTenant);
router.use(addTenantHelpers);
router.use(requireActiveTenant);
router.use(requireAuthentication);

console.log('COMPLETE ATTENDANCE ROUTES LOADING - Single-Tenant Manual Holidays Only');

// Helper function to parse date strings with proper timezone handling
const parseDate = (dateStr) => {
  if (!dateStr) return null;
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) {
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      return new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
    }
    return null;
  }
  return date;
};

// Helper function to create date range filter
const createDateFilter = (startDate, endDate) => {
  const filter = {};

  if (startDate || endDate) {
    if (startDate) {
      const start = parseDate(startDate);
      if (start) {
        // FIXED: Use Lagos timezone for date string
        filter.date = { $gte: getLagosDateString(start) };
      }
    }

    if (endDate) {
      const end = parseDate(endDate);
      if (end) {
        // FIXED: Use Lagos timezone for date string
        filter.date = {
          ...filter.date,
          $lte: getLagosDateString(end)
        };
      }
    }
  }

  return filter;
};

// Helper to get dayOfWeek in Lagos timezone
const getDayOfWeek = (date) => getLagosDayOfWeek(date);

// Helper to parse time string to minutes since midnight
const timeToMinutes = (time) => {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
};

// Helper to calculate diff in minutes
const timeDiffMinutes = (time1, time2) => Math.floor((time1 - time2) / 60000);

// Helper to validate time format (HH:mm)
const isValidTimeFormat = (time) => {
  const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
  return timeRegex.test(time);
};

// Format minutes into hours and minutes for display (60+ mins)
const formatMinutesToHoursAndMinutes = (totalMinutes) => {
  if (totalMinutes < 60) {
    return `${totalMinutes} min`;
  }
  
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  
  if (minutes === 0) {
    return `${hours}hr${hours > 1 ? 's' : ''}`;
  } else {
    return `${hours}hr${hours > 1 ? 's' : ''} ${minutes}min`;
  }
};

// FIXED: Holiday/Leave Detection - Shift is source of truth for working days
// This function checks if there's a holiday or approved leave that would override working
const isHolidayOrLeaveForStaff = async (date, employeeId, req) => {
  // FIXED: Use Lagos timezone for date string
  const dateStr = getLagosDateString(date);
  const TenantAttendance = req.getTenantModel('Attendance');
  const TenantLeaveRequest = req.getTenantModel('LeaveRequest');

  // Check for manual holiday
  if (TenantAttendance) {
    const holiday = await TenantAttendance.findOne({
      employeeId: 'HOLIDAY',
      date: dateStr,
      tenantId: req.tenantId,
      adjustmentNote: { $not: { $regex: /Automatically detected/i } }
    });
    if (holiday) {
      return { isNonWorking: true, reason: 'Holiday' };
    }
  }

  // Check for approved leave for this employee
  if (TenantLeaveRequest && employeeId) {
    const leave = await TenantLeaveRequest.findOne({
      employeeId: employeeId,
      tenantId: req.tenantId,
      status: 'approved',
      startDate: { $lte: date },
      endDate: { $gte: date }
    });
    if (leave) {
      return { isNonWorking: true, reason: `On ${leave.leaveType || 'approved'} leave` };
    }
  }

  return { isNonWorking: false, reason: null };
};

// Check if staff has a shift for the given day (SHIFT IS SOURCE OF TRUTH)
const hasShiftForDay = async (staffId, date, req) => {
  // FIXED: Use Lagos timezone for day of week
  const dayOfWeek = getLagosDayOfWeek(date);
  const TenantShift = req.getTenantModel('Shift');

  if (!TenantShift) return false;

  const shift = await TenantShift.findOne({
    staffId: staffId,
    dayOfWeek: dayOfWeek,
    tenantId: req.tenantId,
    isActive: true
  });

  return !!shift;
};

// Legacy isWorkingDay - only checks holidays (used for report filtering)
const isWorkingDay = async (date, req) => {
  const result = await isHolidayOrLeaveForStaff(date, null, req);
  return !result.isNonWorking;
};

// Helper to get notification recipients from tenant settings
function getNotificationRecipients(req) {
  // Build recipient list: primary email first, then additional emails, then fallbacks
  const allEmails = [];

  // Add primary notification email first
  if (req.tenant?.settings?.primaryNotificationEmail?.trim()) {
    allEmails.push(req.tenant.settings.primaryNotificationEmail.trim());
  }

  // Add additional notification emails (avoid duplicates)
  const additionalEmails = req.tenant?.settings?.notificationEmails?.filter(e => e?.trim()) || [];
  additionalEmails.forEach(email => {
    if (!allEmails.includes(email)) {
      allEmails.push(email);
    }
  });

  if (allEmails.length > 0) {
    return allEmails;
  }

  // Fallback to contact email
  if (req.tenant?.contactInfo?.email) {
    return [req.tenant.contactInfo.email];
  }

  // Final fallback to environment variable (check both variable names)
  if (process.env.NOTIFICATION_EMAILS) {
    return process.env.NOTIFICATION_EMAILS.split(',').map(e => e.trim()).filter(e => e);
  }
  if (process.env.NOTIFICATION_RECIPIENT) {
    return [process.env.NOTIFICATION_RECIPIENT];
  }

  return [];
}

// Email helper functions with proper UTC timestamp handling and enhanced formatting
async function sendCheckInEmail(staff, checkInTime, attendance, req) {
  try {
    const recipientEmails = getNotificationRecipients(req);

    if (recipientEmails.length > 0) {
      const formattedTimestamp = formatTimestampForEmail(checkInTime, 'time');
      const formattedDate = formatTimestampForEmail(checkInTime, 'date');

      // Format lateness with hours/minutes if over 60 minutes
      const lateInfo = attendance.late ? `(${formatMinutesToHoursAndMinutes(attendance.lateMinutes)} late)` : '';

      await sendEmail(recipientEmails, 'staff_clock_in', {
        staffName: `${staff.firstName} ${staff.lastName || ''}`.trim(),
        timestamp: formattedTimestamp,
        date: formattedDate,
        late: lateInfo,
        employeeId: staff.employeeId,
        department: staff.department || 'N/A',
        position: staff.position || 'N/A',
        type: 'staff_clock_in',
        tenantId: req.tenantId,
        tenantName: req.tenant?.businessName || 'Your Business'
      }, req.tenant);

      console.log(`Clock-in email sent for ${staff.firstName} ${staff.lastName} at ${formattedTimestamp} ${lateInfo} to ${recipientEmails.join(', ')}`);
    } else {
      console.warn('No notification recipients configured for clock-in email');
    }
  } catch (err) {
    console.error(`Error sending clock-in email for ${staff.employeeId}:`, err.message);
  }
}

async function sendCheckOutEmail(attendance, staff, checkOutTime, shift, req) {
  try {
    const recipientEmails = getNotificationRecipients(req);

    if (recipientEmails.length > 0 && !attendance.checkOutEmailSent) {
      const formattedTimestamp = formatTimestampForEmail(checkOutTime, 'time');
      const formattedDate = formatTimestampForEmail(checkOutTime, 'date');

      // Format early leave and overtime with hours/minutes if over 60 minutes
      const earlyLeaveInfo = attendance.earlyLeave ? `(${formatMinutesToHoursAndMinutes(attendance.earlyLeaveMinutes)} early)` : '';
      const overtimeInfo = attendance.overtimeHours > 0 ? `(${formatMinutesToHoursAndMinutes(Math.round(attendance.overtimeHours * 60))} overtime)` : '';

      let workDuration = '';
      if (attendance.checkIn && attendance.checkOut) {
        const durationMs = attendance.checkOut - attendance.checkIn;
        const hours = Math.floor(durationMs / (1000 * 60 * 60));
        const minutes = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60));
        workDuration = `${hours}h ${minutes}m`;
      }

      const checkInTimeFormatted = attendance.checkIn ?
        formatTimestampForEmail(attendance.checkIn, 'time') : 'N/A';

      await sendEmail(recipientEmails, 'staff_clock_out', {
        staffName: `${staff.firstName} ${staff.lastName || ''}`.trim(),
        timestamp: formattedTimestamp,
        date: formattedDate,
        earlyLeave: earlyLeaveInfo,
        overtime: overtimeInfo,
        workDuration: workDuration,
        employeeId: staff.employeeId,
        department: staff.department || 'N/A',
        position: staff.position || 'N/A',
        checkInTime: checkInTimeFormatted,
        type: 'staff_clock_out',
        tenantId: req.tenantId,
        tenantName: req.tenant?.businessName || 'Your Business'
      }, req.tenant);

      attendance.checkOutEmailSent = true;
      await attendance.save();

      console.log(`Clock-out email sent for ${staff.firstName} ${staff.lastName} at ${formattedTimestamp} ${earlyLeaveInfo} ${overtimeInfo} to ${recipientEmails.join(', ')}`);
    } else if (recipientEmails.length === 0) {
      console.warn('No notification recipients configured for clock-out email');
    }
  } catch (err) {
    console.error(`Error sending clock-out email for ${staff.employeeId}:`, err.message);
  }
}

// Basic clock-in/out (for manual entries or API calls) - FIXED with tenant isolation
router.post('/', async (req, res) => {
  try {
    const { employeeId, type, timestamp, subBusiness, adjustmentNote } = req.body;
    
    const TenantStaff = req.getTenantModel('Staff');
    const TenantAttendance = req.getTenantModel('Attendance');
    const TenantShift = req.getTenantModel('Shift');
    const TenantAttendanceLog = req.getTenantModel('AttendanceLog');
    
    if (!TenantStaff || !TenantAttendance) {
      return res.status(500).json({ 
        error: 'TENANT_MODELS_UNAVAILABLE',
        message: 'Required models not available' 
      });
    }
    
    // FIXED: Proper tenant filtering
    const staff = await TenantStaff.findOne({ 
      employeeId,
      tenantId: req.tenantId,
      employeeId: { $not: /^CONFIG_/ }
    });
    
    if (!staff) {
      return res.status(404).json({ 
        error: 'STAFF_NOT_FOUND',
        message: 'Staff not found' 
      });
    }

    const recordTime = new Date(timestamp);
    
    // Use consistent working day check (manual holidays only)
    if (!(await isWorkingDay(recordTime, req))) {
      return res.status(400).json({ 
        error: 'NON_WORKING_DAY',
        message: 'Cannot record attendance on Sunday or manually set holidays' 
      });
    }

    // FIXED: Use Lagos timezone for date and day of week
    const dateStr = getLagosDateString(recordTime);
    const dayOfWeek = getDayOfWeek(recordTime);
    
    let shift = null;
    if (TenantShift) {
      shift = await TenantShift.findOne({ 
        staffId: staff._id, 
        dayOfWeek: dayOfWeek,
        tenantId: req.tenantId // CRITICAL: Tenant filtering
      });
    }
    
    if (!shift) {
      return res.status(400).json({ 
        error: 'NO_SHIFT_FOUND',
        message: 'No shift found for this staff on this day' 
      });
    }

    // FIXED: Proper tenant filtering for attendance record
    let attendance = await TenantAttendance.findOne({ 
      employeeId, 
      date: dateStr,
      tenantId: req.tenantId,
      employeeId: { $ne: 'HOLIDAY' } // Exclude holiday records
    });

    if (!attendance) {
      attendance = new TenantAttendance({
        employeeId,
        date: dateStr,
        subBusiness: subBusiness || staff.subBusiness || 'General',
        absent: true,
        adjustmentNote,
        tenantId: req.tenantId // CRITICAL: Ensure tenant isolation
      });
    }

    // Calculate expected times based on shift
    // FIXED: Use Lagos timezone for shift time calculations
    const expectedStart = createLagosShiftTime(recordTime, shift.resumptionTime);
    const expectedEnd = createLagosShiftTime(recordTime, shift.closingTime);

    if (type === 'clock-in') {
      if (attendance.checkIn) {
        return res.status(400).json({ 
          error: 'ALREADY_CLOCKED_IN',
          message: 'Staff already clocked in today' 
        });
      }

      attendance.checkIn = recordTime;
      attendance.absent = false;

      // Calculate lateness with 5-minute grace period
      const graceStart = new Date(expectedStart.getTime() + 5 * 60 * 1000); // 5 minutes grace
      if (recordTime > graceStart) {
        attendance.late = true;
        attendance.lateMinutes = timeDiffMinutes(recordTime, expectedStart);
      } else {
        attendance.late = false;
        attendance.lateMinutes = 0;
      }

      attendance.adjustmentNote = adjustmentNote || attendance.adjustmentNote;
      await attendance.save();
      await sendCheckInEmail(staff, recordTime, attendance, req);

    } else if (type === 'clock-out') {
      attendance.checkOut = recordTime;

      // Calculate early leave or overtime
      if (recordTime < expectedEnd) {
        attendance.earlyLeave = true;
        attendance.earlyLeaveMinutes = timeDiffMinutes(expectedEnd, recordTime);
        attendance.overtimeHours = 0;
      } else {
        attendance.earlyLeave = false;
        attendance.earlyLeaveMinutes = 0;
        attendance.overtimeHours = timeDiffMinutes(recordTime, expectedEnd) / 60;
      }

      await attendance.save();
      await sendCheckOutEmail(attendance, staff, recordTime, shift, req);
    }

    // Log attendance if AttendanceLog model is available
    if (TenantAttendanceLog) {
      const attendanceLog = new TenantAttendanceLog({
        employeeId,
        timestamp: recordTime,
        determinedType: type,
        subBusiness: subBusiness || staff.subBusiness || 'General',
        processed: true,
        tenantId: req.tenantId // CRITICAL: Tenant isolation
      });
      await attendanceLog.save();
    }

    logger.info('Attendance recorded', {
      tenantId: req.tenantId,
      employeeId,
      type,
      recordedBy: req.user.username
    });

    res.status(201).json({
      success: true,
      message: `${type} recorded successfully`,
      attendance
    });

  } catch (err) {
    logger.error('Error recording attendance', {
      tenantId: req.tenantId,
      error: err.message,
      userId: req.user.id
    });
    res.status(500).json({ 
      error: 'RECORD_ATTENDANCE_FAILED',
      message: 'Server error: ' + err.message 
    });
  }
});

// Live attendance logs endpoint - FIXED with tenant isolation
router.get('/live', async (req, res) => {
  try {
    const { limit = 10 } = req.query;
    
    console.log(`Fetching live attendance logs (limit: ${limit}) for tenant: ${req.tenantId}`);
    
    const TenantAttendanceLog = req.getTenantModel('AttendanceLog');
    const TenantStaff = req.getTenantModel('Staff');
    
    if (!TenantAttendanceLog || !TenantStaff) {
      return res.json({
        logs: [],
        total: 0,
        lastUpdated: new Date().toISOString(),
        message: 'Attendance logging not available'
      });
    }
    
    // FIXED: Get recent attendance logs with proper tenant filtering
    const logs = await TenantAttendanceLog.find({
      tenantId: req.tenantId, // CRITICAL: Tenant filtering
      determinedType: { $nin: ['ignored', null] }
    })
      .sort({ timestamp: -1 })
      .limit(Number(limit))
      .lean();

    console.log(`Found ${logs.length} attendance logs for tenant: ${req.tenantId}`);

    // Enrich logs with staff information
    const enrichedLogs = [];
    for (const log of logs) {
      const staff = await TenantStaff.findOne({ 
        employeeId: log.employeeId,
        tenantId: req.tenantId,
        employeeId: { $not: /^CONFIG_/ }
      }).lean();
      
      const enrichedLog = {
        _id: log._id,
        employeeId: log.employeeId,
        timestamp: log.timestamp,
        determinedType: log.determinedType,
        subBusiness: log.subBusiness,
        staffName: staff ? `${staff.firstName} ${staff.lastName || ''}`.trim() : 'Unknown Staff',
        position: staff?.position || 'N/A',
        department: staff?.department || 'N/A',
      };
      enrichedLogs.push(enrichedLog);
    }

    console.log(`Enriched ${enrichedLogs.length} logs with staff info for tenant: ${req.tenantId}`);

    res.json({
      logs: enrichedLogs,
      total: enrichedLogs.length,
      lastUpdated: new Date().toISOString()
    });

  } catch (err) {
    logger.error('Error fetching live logs', {
      tenantId: req.tenantId,
      error: err.message,
      userId: req.user.id
    });
    res.status(500).json({ 
      error: 'FETCH_LIVE_LOGS_FAILED',
      message: 'Server error: ' + err.message 
    });
  }
});

// Enhanced attendance report endpoint - FIXED with tenant isolation
router.get('/report', async (req, res) => {
  try {
    const { 
      startDate, 
      endDate, 
      page = 1, 
      limit = 50,
      employeeId,
      department,
      status 
    } = req.query;

    console.log(`Fetching attendance report for tenant: ${req.tenantId}`, { startDate, endDate, page, limit });

    const TenantAttendance = req.getTenantModel('Attendance');
    const TenantStaff = req.getTenantModel('Staff');
    
    if (!TenantAttendance || !TenantStaff) {
      return res.json({
        attendances: [],
        totalPages: 0,
        currentPage: 1,
        total: 0,
        message: 'Attendance system not available'
      });
    }

    // Build query with proper tenant filtering
    const query = {
      tenantId: req.tenantId // CRITICAL: Tenant filtering
    };
    
    // Apply date filtering
    const dateFilter = createDateFilter(startDate, endDate);
    Object.assign(query, dateFilter);
    
    if (employeeId) {
      query.employeeId = employeeId;
    }
    
    if (status) {
      if (status === 'present') {
        query.absent = { $ne: true };
      } else if (status === 'absent') {
        query.absent = true;
      } else if (status === 'late') {
        query.late = true;
      } else if (status === 'early_leave') {
        query.earlyLeave = true;
      }
    }

    // Get staff info for department filtering
    if (department) {
      const staffInDept = await TenantStaff.find({ 
        department,
        tenantId: req.tenantId,
        employeeId: { $not: /^CONFIG_/ }
      }).select('employeeId');
      const employeeIds = staffInDept.map(s => s.employeeId);
      query.employeeId = { 
        ...(query.employeeId || {}),
        $in: employeeIds 
      };
    }

    // Exclude holidays and special records consistently
    query.employeeId = { 
      ...query.employeeId, 
      $nin: ['HOLIDAY', /^LEAVE_/] // Exclude both holidays and leave records
    };

    console.log('Final attendance query:', query);

    // Get all records that match the filter
    const allRecords = await TenantAttendance.find(query).lean();
    
    // Filter out Sunday and manual holiday records only
    const filteredRecords = [];
    for (const record of allRecords) {
      const recordDate = new Date(record.date + 'T00:00:00.000Z');
      
      // Use consistent working day check (manual holidays only)
      if (await isWorkingDay(recordDate, req)) {
        filteredRecords.push(record);
      }
    }

    // Apply pagination to filtered records
    const startIndex = (page - 1) * limit;
    const paginatedRecords = filteredRecords
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(startIndex, startIndex + Number(limit));

    console.log(`Found ${paginatedRecords.length} attendance records (after filtering) for tenant: ${req.tenantId}`);

    // Enrich with staff information and formatting
    const enrichedRecords = [];
    for (const record of paginatedRecords) {
      const staff = await TenantStaff.findOne({ 
        employeeId: record.employeeId,
        tenantId: req.tenantId,
        employeeId: { $not: /^CONFIG_/ }
      }).lean();
      
      // Enhanced record with proper time formatting
      const enrichedRecord = {
        ...record,
        // Add formatted time displays for frontend
        lateDisplay: record.late ? formatMinutesToHoursAndMinutes(record.lateMinutes || 0) : null,
        earlyLeaveDisplay: record.earlyLeave ? formatMinutesToHoursAndMinutes(record.earlyLeaveMinutes || 0) : null,
        overtimeDisplay: record.overtimeHours > 0 ? formatMinutesToHoursAndMinutes(Math.round(record.overtimeHours * 60)) : null,
        staffId: staff ? {
          _id: staff._id,
          firstName: staff.firstName,
          lastName: staff.lastName || '',
          department: staff.department || 'N/A',
          position: staff.position || 'N/A',
          employeeId: staff.employeeId
        } : null
      };
      
      enrichedRecords.push(enrichedRecord);
    }

    const total = filteredRecords.length;

    console.log(`Returning ${enrichedRecords.length} enriched records, total: ${total} for tenant: ${req.tenantId}`);

    // Return data in format expected by frontend
    res.json({
      attendances: enrichedRecords,
      totalPages: Math.ceil(total / limit),
      currentPage: Number(page),
      total: total
    });

  } catch (err) {
    logger.error('Error fetching attendance report', {
      tenantId: req.tenantId,
      error: err.message,
      userId: req.user.id
    });
    res.status(500).json({ 
      error: 'FETCH_ATTENDANCE_REPORT_FAILED',
      message: 'Server error: ' + err.message 
    });
  }
});

// Enhanced manual attendance entry - FIXED with tenant isolation
router.post('/manual', async (req, res) => {
  try {
    const { employeeId, date, checkIn, checkOut, status, remarks } = req.body;
    
    if (!employeeId || !date || !status) {
      return res.status(400).json({ 
        error: 'MISSING_REQUIRED_FIELDS',
        message: 'Employee ID, date, and status are required' 
      });
    }
    
    const TenantStaff = req.getTenantModel('Staff');
    const TenantAttendance = req.getTenantModel('Attendance');
    const TenantShift = req.getTenantModel('Shift');
    
    if (!TenantStaff || !TenantAttendance) {
      return res.status(500).json({ 
        error: 'TENANT_MODELS_UNAVAILABLE',
        message: 'Required models not available' 
      });
    }
    
    // FIXED: Proper tenant filtering for staff lookup
    const staff = await TenantStaff.findOne({ 
      employeeId,
      tenantId: req.tenantId,
      employeeId: { $not: /^CONFIG_/ }
    });
    
    if (!staff) {
      return res.status(404).json({ 
        error: 'STAFF_NOT_FOUND',
        message: 'Staff not found' 
      });
    }

    const entryDate = new Date(date + 'T00:00:00.000Z');
    
    // Use consistent holiday detection (manual holidays only)
    if (!(await isWorkingDay(entryDate, req))) {
      return res.status(400).json({ 
        error: 'NON_WORKING_DAY',
        message: 'Cannot create manual entry for Sunday or manually set holidays' 
      });
    }

    // FIXED: Use Lagos timezone for date and day of week
    const dateStr = getLagosDateString(entryDate);
    const dayOfWeek = getDayOfWeek(entryDate);
    
    let shift = null;
    if (TenantShift) {
      shift = await TenantShift.findOne({ 
        staffId: staff._id, 
        dayOfWeek,
        tenantId: req.tenantId // CRITICAL: Tenant filtering
      });
    }

    if (!shift) {
      return res.status(400).json({ 
        error: 'NO_SHIFT_FOUND',
        message: 'No shift found for this staff on this day' 
      });
    }

    // Create or update attendance record with proper tenant filtering
    let attendance = await TenantAttendance.findOne({ 
      employeeId, 
      date: dateStr,
      tenantId: req.tenantId,
      employeeId: { $ne: 'HOLIDAY' }
    });

    if (!attendance) {
      attendance = new TenantAttendance({
        employeeId,
        date: dateStr,
        subBusiness: staff.subBusiness || 'General',
        absent: status === 'absent',
        adjustmentNote: `Manual entry: ${remarks || 'No remarks'}`,
        tenantId: req.tenantId // CRITICAL: Ensure tenant isolation
      });
    }

    // Handle manual entry based on status
    if (status === 'absent') {
      attendance.absent = true;
      attendance.checkIn = null;
      attendance.checkOut = null;
      attendance.late = false;
      attendance.lateMinutes = 0;
      attendance.earlyLeave = false;
      attendance.earlyLeaveMinutes = 0;
      attendance.overtimeHours = 0;
    } else {
      attendance.absent = false;

      // FIXED: Use Lagos timezone for shift time calculations
      const expectedStart = createLagosShiftTime(entryDate, shift.resumptionTime);
      const expectedEnd = createLagosShiftTime(entryDate, shift.closingTime);

      if (checkIn) {
        // FIXED: Create check-in time in Lagos timezone (+01:00)
        const checkInTime = new Date(`${date}T${checkIn}:00.000+01:00`);
        attendance.checkIn = checkInTime;

        // Calculate lateness based on shift with 5-minute grace period
        const graceStart = new Date(expectedStart.getTime() + 5 * 60 * 1000);
        if (checkInTime > graceStart) {
          attendance.late = true;
          attendance.lateMinutes = timeDiffMinutes(checkInTime, expectedStart);
        } else {
          attendance.late = false;
          attendance.lateMinutes = 0;
        }
      }

      if (checkOut) {
        // FIXED: Create check-out time in Lagos timezone (+01:00)
        const checkOutTime = new Date(`${date}T${checkOut}:00.000+01:00`);
        attendance.checkOut = checkOutTime;

        // Calculate early leave based on shift
        if (checkOutTime < expectedEnd) {
          attendance.earlyLeave = true;
          attendance.earlyLeaveMinutes = timeDiffMinutes(expectedEnd, checkOutTime);
          attendance.overtimeHours = 0;
        } else {
          attendance.earlyLeave = false;
          attendance.earlyLeaveMinutes = 0;
          attendance.overtimeHours = timeDiffMinutes(checkOutTime, expectedEnd) / 60;
        }
      }
    }

    attendance.adjustmentNote = `Manual entry: ${remarks || 'No remarks'}`;
    await attendance.save();

    logger.info('Manual attendance entry created', {
      tenantId: req.tenantId,
      employeeId,
      date,
      status,
      createdBy: req.user.username
    });

    res.status(201).json({ 
      success: true,
      message: 'Manual entry submitted successfully',
      attendance 
    });

  } catch (err) {
    logger.error('Error creating manual attendance entry', {
      tenantId: req.tenantId,
      error: err.message,
      userId: req.user.id
    });
    res.status(500).json({ 
      error: 'MANUAL_ENTRY_FAILED',
      message: 'Server error: ' + err.message 
    });
  }
});

// Attendance analytics endpoint - FIXED with tenant isolation
router.get('/analytics', async (req, res) => {
  try {
    const { startDate, endDate, period = 'daily' } = req.query;
    
    const TenantAttendance = req.getTenantModel('Attendance');
    const TenantStaff = req.getTenantModel('Staff');
    
    if (!TenantAttendance || !TenantStaff) {
      return res.json({
        period: { startDate, endDate },
        today: { total: 0, present: 0, absent: 0, late: 0, earlyLeave: 0, notClockedIn: 0 },
        period: { totalRecords: 0, present: 0, absent: 0, late: 0, earlyLeave: 0, overtime: 0, averageWorkingDays: 0 },
        attendanceRate: 0,
        trends: {},
        departments: [],
        lastUpdated: new Date().toISOString(),
        message: 'Attendance analytics not available'
      });
    }
    
    // Default to last 30 days if no dates provided
    const end = endDate ? new Date(endDate) : new Date();
    const start = startDate ? new Date(startDate) : new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);

    // FIXED: Use Lagos timezone for date strings
    const startDateStr = getLagosDateString(start);
    const endDateStr = getLagosDateString(end);

    // FIXED: Get attendance records for the period with proper tenant filtering
    const allRecords = await TenantAttendance.find({
      tenantId: req.tenantId, // CRITICAL: Tenant filtering
      date: { $gte: startDateStr, $lte: endDateStr },
      employeeId: { $nin: ['HOLIDAY', /^LEAVE_/] } // Exclude both holidays and leave records
    }).lean();

    const attendanceRecords = [];
    for (const record of allRecords) {
      const recordDate = new Date(record.date);
      
      // Use consistent working day check (manual holidays only)
      if (await isWorkingDay(recordDate, req)) {
        attendanceRecords.push(record);
      }
    }

    // FIXED: Get all staff with proper tenant filtering
    const allStaff = await TenantStaff.find({
      tenantId: req.tenantId,
      employeeId: { $not: /^CONFIG_/ }
    }).lean();
    const totalStaff = allStaff.length;

    // Today's statistics (excluding Sunday/manual holidays only)
    // FIXED: Use Lagos timezone for today's date
    const today = getLagosDateString(new Date());
    const todayDate = new Date(today);
    const todayIsWorkingDay = await isWorkingDay(todayDate, req);
    
    let todayStats = {
      total: totalStaff,
      present: 0,
      absent: 0,
      late: 0,
      earlyLeave: 0,
      notClockedIn: totalStaff
    };

    if (todayIsWorkingDay) {
      const todayRecords = await TenantAttendance.find({ 
        tenantId: req.tenantId, // CRITICAL: Tenant filtering
        date: today,
        employeeId: { $nin: ['HOLIDAY', /^LEAVE_/] } // Exclude special records
      }).lean();
      
      todayStats = {
        total: totalStaff,
        present: todayRecords.filter(r => !r.absent).length,
        absent: todayRecords.filter(r => r.absent).length,
        late: todayRecords.filter(r => r.late).length,
        earlyLeave: todayRecords.filter(r => r.earlyLeave).length,
        notClockedIn: totalStaff - todayRecords.length
      };
    }

    // Calculate trends by period with formatting
    const trends = {};
    if (period === 'daily') {
      const dailyStats = {};
      attendanceRecords.forEach(record => {
        if (!dailyStats[record.date]) {
          dailyStats[record.date] = {
            date: record.date,
            present: 0,
            absent: 0,
            late: 0,
            earlyLeave: 0,
            overtime: 0,
            // Add formatted displays for analytics
            avgLateTime: 0,
            avgEarlyLeaveTime: 0,
            avgOvertimeTime: 0,
            lateMinutes: [],
            earlyLeaveMinutes: [],
            overtimeMinutes: []
          };
        }
        
        const stats = dailyStats[record.date];
        if (!record.absent) stats.present++;
        if (record.absent) stats.absent++;
        if (record.late) {
          stats.late++;
          stats.lateMinutes.push(record.lateMinutes || 0);
        }
        if (record.earlyLeave) {
          stats.earlyLeave++;
          stats.earlyLeaveMinutes.push(record.earlyLeaveMinutes || 0);
        }
        if (record.overtimeHours > 0) {
          stats.overtime++;
          stats.overtimeMinutes.push(Math.round(record.overtimeHours * 60));
        }
      });
      
      // Calculate averages and format them
      Object.values(dailyStats).forEach(day => {
        if (day.lateMinutes.length > 0) {
          const avgLate = Math.round(day.lateMinutes.reduce((a, b) => a + b, 0) / day.lateMinutes.length);
          day.avgLateTimeFormatted = formatMinutesToHoursAndMinutes(avgLate);
        }
        if (day.earlyLeaveMinutes.length > 0) {
          const avgEarly = Math.round(day.earlyLeaveMinutes.reduce((a, b) => a + b, 0) / day.earlyLeaveMinutes.length);
          day.avgEarlyLeaveTimeFormatted = formatMinutesToHoursAndMinutes(avgEarly);
        }
        if (day.overtimeMinutes.length > 0) {
          const avgOvertime = Math.round(day.overtimeMinutes.reduce((a, b) => a + b, 0) / day.overtimeMinutes.length);
          day.avgOvertimeTimeFormatted = formatMinutesToHoursAndMinutes(avgOvertime);
        }
        
        // Clean up arrays (don't send to frontend)
        delete day.lateMinutes;
        delete day.earlyLeaveMinutes;
        delete day.overtimeMinutes;
      });
      
      trends.daily = Object.values(dailyStats).sort((a, b) => a.date.localeCompare(b.date));
    }

    // Department-wise statistics with formatting
    const departmentStats = {};
    for (const record of attendanceRecords) {
      const staff = allStaff.find(s => s.employeeId === record.employeeId);
      const dept = staff?.department || 'Unknown';
      
      if (!departmentStats[dept]) {
        departmentStats[dept] = {
          department: dept,
          present: 0,
          absent: 0,
          late: 0,
          earlyLeave: 0,
          totalRecords: 0,
          // Add arrays to calculate averages
          lateMinutes: [],
          earlyLeaveMinutes: [],
          overtimeMinutes: []
        };
      }
      
      const stats = departmentStats[dept];
      stats.totalRecords++;
      if (!record.absent) stats.present++;
      if (record.absent) stats.absent++;
      if (record.late) {
        stats.late++;
        stats.lateMinutes.push(record.lateMinutes || 0);
      }
      if (record.earlyLeave) {
        stats.earlyLeave++;
        stats.earlyLeaveMinutes.push(record.earlyLeaveMinutes || 0);
      }
      if (record.overtimeHours > 0) {
        stats.overtimeMinutes.push(Math.round(record.overtimeHours * 60));
      }
    }

    // Calculate department averages and format them
    Object.values(departmentStats).forEach(dept => {
      if (dept.lateMinutes.length > 0) {
        const avgLate = Math.round(dept.lateMinutes.reduce((a, b) => a + b, 0) / dept.lateMinutes.length);
        dept.avgLateTimeFormatted = formatMinutesToHoursAndMinutes(avgLate);
      }
      if (dept.earlyLeaveMinutes.length > 0) {
        const avgEarly = Math.round(dept.earlyLeaveMinutes.reduce((a, b) => a + b, 0) / dept.earlyLeaveMinutes.length);
        dept.avgEarlyLeaveTimeFormatted = formatMinutesToHoursAndMinutes(avgEarly);
      }
      if (dept.overtimeMinutes.length > 0) {
        const avgOvertime = Math.round(dept.overtimeMinutes.reduce((a, b) => a + b, 0) / dept.overtimeMinutes.length);
        dept.avgOvertimeTimeFormatted = formatMinutesToHoursAndMinutes(avgOvertime);
      }
      
      // Clean up arrays
      delete dept.lateMinutes;
      delete dept.earlyLeaveMinutes;
      delete dept.overtimeMinutes;
    });

    // Overall period statistics
    const periodStats = {
      totalRecords: attendanceRecords.length,
      present: attendanceRecords.filter(r => !r.absent).length,
      absent: attendanceRecords.filter(r => r.absent).length,
      late: attendanceRecords.filter(r => r.late).length,
      earlyLeave: attendanceRecords.filter(r => r.earlyLeave).length,
      overtime: attendanceRecords.filter(r => r.overtimeHours > 0).length,
      averageWorkingDays: attendanceRecords.length / totalStaff,
    };

    // Calculate attendance rate (excluding Sundays and manual holidays only)
    const workingDaysInPeriod = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) - 
      Math.floor(Math.ceil((end - start) / (1000 * 60 * 60 * 24)) / 7); // Rough Sunday exclusion
    const expectedAttendance = totalStaff * workingDaysInPeriod;
    const attendanceRate = expectedAttendance > 0 ? (periodStats.present / expectedAttendance * 100) : 0;

    logger.debug('Attendance analytics calculated', {
      tenantId: req.tenantId,
      totalRecords: attendanceRecords.length,
      totalStaff,
      userId: req.user.id
    });

    res.json({
      period: { startDate: startDateStr, endDate: endDateStr },
      today: todayStats,
      period: periodStats,
      attendanceRate: Math.round(attendanceRate * 100) / 100,
      trends,
      departments: Object.values(departmentStats),
      lastUpdated: new Date().toISOString()
    });

  } catch (err) {
    logger.error('Error calculating attendance analytics', {
      tenantId: req.tenantId,
      error: err.message,
      userId: req.user.id
    });
    res.status(500).json({ 
      error: 'ANALYTICS_FAILED',
      message: 'Server error: ' + err.message 
    });
  }
});

// Update attendance record with calculations - FIXED with tenant isolation
router.put('/:id', async (req, res) => {
  try {
    const { checkIn, checkOut, adjustmentNote } = req.body;
    
    const TenantAttendance = req.getTenantModel('Attendance');
    const TenantStaff = req.getTenantModel('Staff');
    const TenantShift = req.getTenantModel('Shift');
    
    if (!TenantAttendance) {
      return res.status(500).json({ 
        error: 'TENANT_MODEL_UNAVAILABLE',
        message: 'Attendance model not available' 
      });
    }
    
    // FIXED: Proper tenant filtering
    const attendance = await TenantAttendance.findOne({
      _id: req.params.id,
      tenantId: req.tenantId
    });
    
    if (!attendance) {
      return res.status(404).json({ 
        error: 'ATTENDANCE_NOT_FOUND',
        message: 'Attendance record not found' 
      });
    }

    // If updating times, recalculate based on shift
    if (TenantStaff && TenantShift && (checkIn || checkOut)) {
      const staff = await TenantStaff.findOne({ 
        employeeId: attendance.employeeId,
        tenantId: req.tenantId,
        employeeId: { $not: /^CONFIG_/ }
      });
      
      if (staff) {
        const dayOfWeek = getDayOfWeek(new Date(attendance.date));
        const shift = await TenantShift.findOne({ 
          staffId: staff._id, 
          dayOfWeek,
          tenantId: req.tenantId // CRITICAL: Tenant filtering
        });
        
        if (shift) {
          // FIXED: Use Lagos timezone for shift time calculations
          const attendanceDate = new Date(attendance.date);
          const expectedStart = createLagosShiftTime(attendanceDate, shift.resumptionTime);
          const expectedEnd = createLagosShiftTime(attendanceDate, shift.closingTime);

          if (checkIn) {
            const checkInTime = new Date(checkIn);
            attendance.checkIn = checkInTime;

            // Apply 5-minute grace period
            const graceStart = new Date(expectedStart.getTime() + 5 * 60 * 1000);
            if (checkInTime > graceStart) {
              attendance.late = true;
              attendance.lateMinutes = timeDiffMinutes(checkInTime, expectedStart);
            } else {
              attendance.late = false;
              attendance.lateMinutes = 0;
            }
          }

          if (checkOut) {
            const checkOutTime = new Date(checkOut);
            attendance.checkOut = checkOutTime;

            if (checkOutTime < expectedEnd) {
              attendance.earlyLeave = true;
              attendance.earlyLeaveMinutes = timeDiffMinutes(expectedEnd, checkOutTime);
              attendance.overtimeHours = 0;
            } else {
              attendance.earlyLeave = false;
              attendance.earlyLeaveMinutes = 0;
              attendance.overtimeHours = timeDiffMinutes(checkOutTime, expectedEnd) / 60;
            }
          }
        }
      }
    }

    if (adjustmentNote) attendance.adjustmentNote = adjustmentNote;

    await attendance.save();

    logger.info('Attendance record updated', {
      tenantId: req.tenantId,
      attendanceId: req.params.id,
      updatedBy: req.user.username
    });

    res.json({
      success: true,
      message: 'Attendance record updated successfully',
      attendance
    });

  } catch (err) {
    logger.error('Error updating attendance record', {
      tenantId: req.tenantId,
      attendanceId: req.params.id,
      error: err.message,
      userId: req.user.id
    });
    res.status(500).json({ 
      error: 'UPDATE_ATTENDANCE_FAILED',
      message: 'Server error: ' + err.message 
    });
  }
});

// Delete attendance record - FIXED with tenant isolation
router.delete('/:id', async (req, res) => {
  try {
    const TenantAttendance = req.getTenantModel('Attendance');
    
    if (!TenantAttendance) {
      return res.status(500).json({ 
        error: 'TENANT_MODEL_UNAVAILABLE',
        message: 'Attendance model not available' 
      });
    }
    
    // FIXED: Proper tenant filtering
    const attendance = await TenantAttendance.findOneAndDelete({
      _id: req.params.id,
      tenantId: req.tenantId
    });
    
    if (!attendance) {
      return res.status(404).json({ 
        error: 'ATTENDANCE_NOT_FOUND',
        message: 'Attendance record not found' 
      });
    }

    logger.info('Attendance record deleted', {
      tenantId: req.tenantId,
      attendanceId: req.params.id,
      deletedBy: req.user.username
    });

    res.json({ 
      success: true,
      message: 'Attendance record deleted successfully' 
    });

  } catch (err) {
    logger.error('Error deleting attendance record', {
      tenantId: req.tenantId,
      attendanceId: req.params.id,
      error: err.message,
      userId: req.user.id
    });
    res.status(500).json({ 
      error: 'DELETE_ATTENDANCE_FAILED',
      message: 'Server error: ' + err.message 
    });
  }
});

// Get attendance logs - FIXED with tenant isolation
router.get('/logs', async (req, res) => {
  try {
    const { page = 1, limit = 20, employeeId } = req.query;
    const query = { 
      tenantId: req.tenantId // CRITICAL: Tenant filtering
    };
    
    if (employeeId) {
      query.employeeId = employeeId;
    }
    
    const TenantAttendanceLog = req.getTenantModel('AttendanceLog');
    const TenantStaff = req.getTenantModel('Staff');
    
    if (!TenantAttendanceLog || !TenantStaff) {
      return res.json({
        logs: [],
        totalPages: 0,
        message: 'Attendance logging not available'
      });
    }
    
    // Exclude ignored scans from logs
    query.determinedType = { $nin: ['ignored', null] };

    const logs = await TenantAttendanceLog.find(query)
      .sort({ timestamp: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit))
      .lean();

    // Enrich with staff data
    const enrichedLogs = [];
    for (const log of logs) {
      const staff = await TenantStaff.findOne({ 
        employeeId: log.employeeId,
        tenantId: req.tenantId,
        employeeId: { $not: /^CONFIG_/ }
      }).lean();
      enrichedLogs.push({
        ...log,
        staff: staff || { firstName: 'Unknown', lastName: 'Staff' }
      });
    }

    const total = await TenantAttendanceLog.countDocuments(query);

    res.json({
      logs: enrichedLogs,
      totalPages: Math.ceil(total / limit),
    });

  } catch (err) {
    logger.error('Error fetching attendance logs', {
      tenantId: req.tenantId,
      error: err.message,
      userId: req.user.id
    });
    res.status(500).json({ 
      error: 'FETCH_LOGS_FAILED',
      message: 'Server error: ' + err.message 
    });
  }
});

// Enhanced shift management with proper validation - FIXED with tenant isolation
router.post('/shifts', async (req, res) => {
  try {
    const { employeeId, dayOfWeek, resumptionTime, closingTime, isFullDayReference, isHalfDay } = req.body;

    // Validate inputs
    if (!employeeId || !dayOfWeek || !resumptionTime || !closingTime) {
      return res.status(400).json({
        error: 'MISSING_REQUIRED_FIELDS',
        message: 'Missing required fields'
      });
    }

    // Validate time format
    if (!isValidTimeFormat(resumptionTime) || !isValidTimeFormat(closingTime)) {
      return res.status(400).json({
        error: 'INVALID_TIME_FORMAT',
        message: 'Invalid time format. Use HH:mm format'
      });
    }

    // Validate dayOfWeek
    const validDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    if (!validDays.includes(dayOfWeek)) {
      return res.status(400).json({
        error: 'INVALID_DAY',
        message: 'Invalid day of week'
      });
    }

    // Validate time sequence
    const [startHour, startMinute] = resumptionTime.split(':').map(Number);
    const [endHour, endMinute] = closingTime.split(':').map(Number);
    const startMinutes = startHour * 60 + startMinute;
    const endMinutes = endHour * 60 + endMinute;

    if (startMinutes >= endMinutes) {
      return res.status(400).json({
        error: 'INVALID_TIME_SEQUENCE',
        message: 'Resumption time must be before closing time'
      });
    }

    const TenantStaff = req.getTenantModel('Staff');
    const TenantShift = req.getTenantModel('Shift');

    if (!TenantStaff || !TenantShift) {
      return res.status(500).json({
        error: 'TENANT_MODELS_UNAVAILABLE',
        message: 'Required models not available'
      });
    }

    // FIXED: Check if staff exists with proper tenant filtering
    const staff = await TenantStaff.findOne({
      $and: [
        { employeeId: employeeId },
        { employeeId: { $not: /^CONFIG_/ } }
      ],
      tenantId: req.tenantId
    });

    if (!staff) {
      return res.status(404).json({
        error: 'STAFF_NOT_FOUND',
        message: 'Staff not found'
      });
    }

    // FIXED: Check for existing shift and replace if exists with proper tenant filtering
    const existingShift = await TenantShift.findOne({
      staffId: staff._id,
      dayOfWeek,
      tenantId: req.tenantId // CRITICAL: Tenant filtering
    });

    if (existingShift) {
      existingShift.resumptionTime = resumptionTime;
      existingShift.closingTime = closingTime;
      // Update flags if provided
      if (typeof isFullDayReference === 'boolean') existingShift.isFullDayReference = isFullDayReference;
      if (typeof isHalfDay === 'boolean') existingShift.isHalfDay = isHalfDay;
      existingShift.updatedBy = req.user.id;
      await existingShift.save();

      logger.info('Shift updated', {
        tenantId: req.tenantId,
        employeeId,
        dayOfWeek,
        updatedBy: req.user.username
      });

      res.json({
        success: true,
        shift: existingShift,
        message: 'Shift updated successfully'
      });
    } else {
      // Create new shift
      const newShift = new TenantShift({
        staffId: staff._id,
        dayOfWeek,
        resumptionTime,
        closingTime,
        isFullDayReference: isFullDayReference || false,
        isHalfDay: isHalfDay || false,
        createdBy: req.user.id,
        tenantId: req.tenantId // CRITICAL: Ensure tenant isolation
      });

      await newShift.save();

      logger.info('Shift created', {
        tenantId: req.tenantId,
        employeeId,
        dayOfWeek,
        createdBy: req.user.username
      });

      res.status(201).json({
        success: true,
        shift: newShift,
        message: 'Shift created successfully'
      });
    }

  } catch (err) {
    logger.error('Error managing shift', {
      tenantId: req.tenantId,
      error: err.message,
      userId: req.user.id
    });
    res.status(500).json({
      error: 'SHIFT_MANAGEMENT_FAILED',
      message: 'Server error: ' + err.message
    });
  }
});

// BULK shift creation - Fast endpoint for creating multiple shifts at once
router.post('/shifts/bulk', async (req, res) => {
  try {
    const { shifts } = req.body;

    if (!shifts || !Array.isArray(shifts) || shifts.length === 0) {
      return res.status(400).json({
        error: 'MISSING_SHIFTS',
        message: 'shifts array is required'
      });
    }

    const TenantStaff = req.getTenantModel('Staff');
    const TenantShift = req.getTenantModel('Shift');

    if (!TenantStaff || !TenantShift) {
      return res.status(500).json({
        error: 'TENANT_MODELS_UNAVAILABLE',
        message: 'Required models not available'
      });
    }

    const validDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    const results = { created: 0, updated: 0, errors: [] };

    // Get all unique employeeIds and lookup staff in one query
    const employeeIds = [...new Set(shifts.map(s => s.employeeId))];
    const staffList = await TenantStaff.find({
      employeeId: { $in: employeeIds },
      tenantId: req.tenantId
    });
    const staffMap = new Map(staffList.map(s => [s.employeeId, s]));

    // Process all shifts in parallel
    const operations = shifts.map(async (shiftData) => {
      const { employeeId, dayOfWeek, resumptionTime, closingTime, isFullDayReference, isHalfDay } = shiftData;

      // Validate
      if (!employeeId || !dayOfWeek || !resumptionTime || !closingTime) {
        results.errors.push({ employeeId, dayOfWeek, error: 'Missing required fields' });
        return;
      }

      if (!validDays.includes(dayOfWeek)) {
        results.errors.push({ employeeId, dayOfWeek, error: 'Invalid day of week' });
        return;
      }

      if (!isValidTimeFormat(resumptionTime) || !isValidTimeFormat(closingTime)) {
        results.errors.push({ employeeId, dayOfWeek, error: 'Invalid time format' });
        return;
      }

      const staff = staffMap.get(employeeId);
      if (!staff) {
        results.errors.push({ employeeId, dayOfWeek, error: 'Staff not found' });
        return;
      }

      try {
        // Upsert shift (update if exists, create if not)
        await TenantShift.findOneAndUpdate(
          { staffId: staff._id, dayOfWeek, tenantId: req.tenantId },
          {
            staffId: staff._id,
            dayOfWeek,
            resumptionTime,
            closingTime,
            isFullDayReference: isFullDayReference || false,
            isHalfDay: isHalfDay || false,
            tenantId: req.tenantId,
            createdBy: req.user.id,
            updatedBy: req.user.id
          },
          { upsert: true, new: true, setDefaultsOnInsert: true }
        );
        results.created++;
      } catch (err) {
        results.errors.push({ employeeId, dayOfWeek, error: err.message });
      }
    });

    await Promise.all(operations);

    logger.info('Bulk shift creation completed', {
      tenantId: req.tenantId,
      created: results.created,
      errors: results.errors.length,
      createdBy: req.user.username
    });

    res.status(201).json({
      success: true,
      message: `Created/updated ${results.created} shifts`,
      ...results
    });

  } catch (err) {
    logger.error('Error in bulk shift creation', {
      tenantId: req.tenantId,
      error: err.message,
      userId: req.user.id
    });
    res.status(500).json({
      error: 'BULK_SHIFT_FAILED',
      message: 'Server error: ' + err.message
    });
  }
});

// Delete shift - FIXED with tenant isolation
router.delete('/shifts/:id', async (req, res) => {
  try {
    const TenantShift = req.getTenantModel('Shift');
    
    if (!TenantShift) {
      return res.status(500).json({ 
        error: 'TENANT_MODEL_UNAVAILABLE',
        message: 'Shift model not available' 
      });
    }
    
    // FIXED: Proper tenant filtering
    const shift = await TenantShift.findOneAndDelete({
      _id: req.params.id,
      tenantId: req.tenantId
    });
    
    if (!shift) {
      return res.status(404).json({ 
        error: 'SHIFT_NOT_FOUND',
        message: 'Shift not found' 
      });
    }

    logger.info('Shift deleted', {
      tenantId: req.tenantId,
      shiftId: req.params.id,
      deletedBy: req.user.username
    });

    res.json({ 
      success: true,
      message: 'Shift deleted successfully' 
    });

  } catch (err) {
    logger.error('Error deleting shift', {
      tenantId: req.tenantId,
      shiftId: req.params.id,
      error: err.message,
      userId: req.user.id
    });
    res.status(500).json({ 
      error: 'DELETE_SHIFT_FAILED',
      message: 'Server error: ' + err.message 
    });
  }
});

// Get shifts with proper staff population - FIXED with tenant isolation
router.get('/shifts', async (req, res) => {
  try {
    const { page = 1, limit = 20, staffId } = req.query;
    const query = { 
      tenantId: req.tenantId // CRITICAL: Tenant filtering
    };
    
    if (staffId) {
      query.staffId = staffId;
    }
    
    const TenantShift = req.getTenantModel('Shift');
    const TenantStaff = req.getTenantModel('Staff');
    
    if (!TenantShift || !TenantStaff) {
      return res.json({ 
        shifts: [], 
        totalPages: 0,
        message: 'Shift management not available'
      });
    }
    
    const shifts = await TenantShift.find(query)
      .sort({ dayOfWeek: 1 })
      .skip((page - 1) * limit)
      .limit(Number(limit))
      .lean();
      
    // Manually populate staff data with proper tenant filtering
    const enrichedShifts = [];
    for (const shift of shifts) {
      const staff = await TenantStaff.findOne({
        _id: shift.staffId,
        tenantId: req.tenantId,
        employeeId: { $not: /^CONFIG_/ }
      }).lean();
      enrichedShifts.push({
        ...shift,
        staffId: staff || null
      });
    }
    
    const total = await TenantShift.countDocuments(query);
    
    res.json({ 
      shifts: enrichedShifts, 
      totalPages: Math.ceil(total / limit) 
    });

  } catch (err) {
    logger.error('Error fetching shifts', {
      tenantId: req.tenantId,
      error: err.message,
      userId: req.user.id
    });
    res.status(500).json({ 
      error: 'FETCH_SHIFTS_FAILED',
      message: 'Server error: ' + err.message 
    });
  }
});

// FIXED: Manual Holiday Management Only - No Auto-Detection with tenant isolation
router.post('/holidays', async (req, res) => {
  try {
    const { name, date } = req.body;
    
    if (!name || !date) {
      return res.status(400).json({ 
        error: 'MISSING_REQUIRED_FIELDS',
        message: 'Holiday name and date are required' 
      });
    }

    const TenantAttendance = req.getTenantModel('Attendance');
    
    if (!TenantAttendance) {
      return res.status(500).json({ 
        error: 'TENANT_MODEL_UNAVAILABLE',
        message: 'Attendance model not available' 
      });
    }

    const holidayDate = new Date(date);
    const year = holidayDate.getFullYear();
    // FIXED: Use Lagos timezone for date string
    const dateStr = getLagosDateString(holidayDate);
    
    // FIXED: Check if holiday already exists for this date with proper tenant filtering
    const existingHoliday = await TenantAttendance.findOne({
      employeeId: 'HOLIDAY',
      date: dateStr,
      tenantId: req.tenantId // CRITICAL: Tenant filtering
    });
    
    if (existingHoliday) {
      return res.status(400).json({ 
        error: 'HOLIDAY_EXISTS',
        message: 'Holiday already exists for this date' 
      });
    }
    
    // Create MANUAL holiday record only
    const holidayRecord = new TenantAttendance({
      employeeId: 'HOLIDAY',
      date: dateStr,
      subBusiness: 'General',
      absent: true,
      holidays: [{ name, date: holidayDate, year }],
      adjustmentNote: `Manual holiday: ${name}`, // Clear manual designation
      tenantId: req.tenantId // CRITICAL: Ensure tenant isolation
    });

    await holidayRecord.save();
    
    logger.info('Manual holiday created', {
      tenantId: req.tenantId,
      name,
      date: dateStr,
      createdBy: req.user.username
    });
    
    res.status(201).json({
      success: true,
      message: 'Holiday created successfully',
      holiday: {
        _id: holidayRecord.holidays[0]._id,
        name: holidayRecord.holidays[0].name,
        date: holidayRecord.holidays[0].date,
        year: holidayRecord.holidays[0].year
      }
    });

  } catch (err) {
    logger.error('Error creating holiday', {
      tenantId: req.tenantId,
      error: err.message,
      userId: req.user.id
    });
    res.status(500).json({ 
      error: 'CREATE_HOLIDAY_FAILED',
      message: 'Server error: ' + err.message 
    });
  }
});

// Get all manual holidays only - FIXED with tenant isolation
router.get('/holidays', async (req, res) => {
  try {
    const TenantAttendance = req.getTenantModel('Attendance');
    
    if (!TenantAttendance) {
      return res.json([]);
    }
    
    // FIXED: Proper tenant filtering for holidays
    const holidayRecords = await TenantAttendance.find({ 
      employeeId: 'HOLIDAY',
      tenantId: req.tenantId, // CRITICAL: Tenant filtering
      'holidays.0': { $exists: true },
      // Only return manually created holidays
      adjustmentNote: { $not: { $regex: /Automatically detected/i } }
    }).lean();
    
    const holidays = holidayRecords.reduce((acc, curr) => {
      return [...acc, ...curr.holidays.map(holiday => ({
        _id: holiday._id,
        name: holiday.name,
        date: holiday.date,
        year: holiday.year
      }))];
    }, []);
    
    // Sort by date (newest first)
    holidays.sort((a, b) => new Date(b.date) - new Date(a.date));
    
    console.log(`Retrieved ${holidays.length} manual holidays for tenant: ${req.tenantId}`);
    res.json(holidays);

  } catch (err) {
    logger.error('Error fetching holidays', {
      tenantId: req.tenantId,
      error: err.message,
      userId: req.user.id
    });
    res.status(500).json({ 
      error: 'FETCH_HOLIDAYS_FAILED',
      message: 'Server error: ' + err.message 
    });
  }
});

// Delete holiday - FIXED with tenant isolation
router.delete('/holidays/:holidayId', async (req, res) => {
  try {
    const TenantAttendance = req.getTenantModel('Attendance');
    
    if (!TenantAttendance) {
      return res.status(500).json({ 
        error: 'TENANT_MODEL_UNAVAILABLE',
        message: 'Attendance model not available' 
      });
    }
    
    // FIXED: Proper tenant filtering for holiday deletion
    const attendance = await TenantAttendance.findOne({ 
      employeeId: 'HOLIDAY',
      tenantId: req.tenantId, // CRITICAL: Tenant filtering
      'holidays._id': req.params.holidayId 
    });
    
    if (!attendance) {
      return res.status(404).json({ 
        error: 'HOLIDAY_NOT_FOUND',
        message: 'Holiday not found' 
      });
    }

    attendance.holidays.id(req.params.holidayId).remove();
    
    // If no more holidays in this record, delete the entire record
    if (attendance.holidays.length === 0) {
      await TenantAttendance.findByIdAndDelete(attendance._id);
    } else {
      await attendance.save();
    }
    
    logger.info('Manual holiday deleted', {
      tenantId: req.tenantId,
      holidayId: req.params.holidayId,
      deletedBy: req.user.username
    });
    
    res.json({ 
      success: true,
      message: 'Holiday deleted successfully' 
    });

  } catch (err) {
    logger.error('Error deleting holiday', {
      tenantId: req.tenantId,
      holidayId: req.params.holidayId,
      error: err.message,
      userId: req.user.id
    });
    res.status(500).json({ 
      error: 'DELETE_HOLIDAY_FAILED',
      message: 'Server error: ' + err.message 
    });
  }
});

// ==========================================
// LEAVE REQUEST MANAGEMENT
// ==========================================

// Create leave request
router.post('/leaves', async (req, res) => {
  try {
    const { employeeId, startDate, endDate, leaveType, reason } = req.body;

    if (!employeeId || !startDate || !endDate || !leaveType || !reason) {
      return res.status(400).json({
        error: 'MISSING_REQUIRED_FIELDS',
        message: 'All fields are required'
      });
    }

    const TenantLeaveRequest = req.getTenantModel('LeaveRequest');
    const TenantStaff = req.getTenantModel('Staff');

    if (!TenantLeaveRequest || !TenantStaff) {
      return res.status(500).json({
        error: 'MODELS_UNAVAILABLE',
        message: 'Required models not available'
      });
    }

    // Verify staff exists
    const staff = await TenantStaff.findOne({
      employeeId: employeeId,
      tenantId: req.tenantId,
      employeeId: { $not: /^CONFIG_/ }
    });

    if (!staff) {
      return res.status(404).json({
        error: 'STAFF_NOT_FOUND',
        message: 'Staff member not found'
      });
    }

    // Validate dates
    const start = new Date(startDate);
    const end = new Date(endDate);

    if (start > end) {
      return res.status(400).json({
        error: 'INVALID_DATES',
        message: 'Start date must be before or equal to end date'
      });
    }

    // Check for overlapping leave requests
    const overlapping = await TenantLeaveRequest.findOne({
      employeeId: employeeId,
      tenantId: req.tenantId,
      status: { $in: ['pending', 'approved'] },
      $or: [
        {
          startDate: { $lte: end },
          endDate: { $gte: start }
        }
      ]
    });

    if (overlapping) {
      return res.status(400).json({
        error: 'OVERLAPPING_LEAVE',
        message: 'Leave request overlaps with existing leave'
      });
    }

    // Calculate working days (exclude weekends)
    let totalDays = 0;
    const current = new Date(start);
    while (current <= end) {
      const dayOfWeek = current.getDay();
      if (dayOfWeek !== 0 && dayOfWeek !== 6) { // Not Sunday or Saturday
        totalDays++;
      }
      current.setDate(current.getDate() + 1);
    }

    // Create leave request
    const leaveRequest = new TenantLeaveRequest({
      employeeId: employeeId,
      staffId: staff._id,
      startDate: start,
      endDate: end,
      leaveType: leaveType,
      reason: reason,
      status: 'pending',
      totalDays: totalDays,
      tenantId: req.tenantId,
      createdBy: req.user.username
    });

    await leaveRequest.save();

    logger.info('Leave request created', {
      tenantId: req.tenantId,
      leaveRequestId: leaveRequest._id,
      employeeId: employeeId,
      startDate: startDate,
      endDate: endDate,
      totalDays: totalDays,
      createdBy: req.user.username
    });

    res.status(201).json({
      success: true,
      message: 'Leave request submitted successfully',
      leaveRequest: {
        _id: leaveRequest._id,
        employeeId: leaveRequest.employeeId,
        startDate: leaveRequest.startDate,
        endDate: leaveRequest.endDate,
        leaveType: leaveRequest.leaveType,
        status: leaveRequest.status,
        totalDays: leaveRequest.totalDays
      }
    });

  } catch (err) {
    logger.error('Error creating leave request', {
      tenantId: req.tenantId,
      error: err.message,
      userId: req.user.id
    });
    res.status(500).json({
      error: 'CREATE_LEAVE_FAILED',
      message: 'Server error: ' + err.message
    });
  }
});

// Get all leave requests
router.get('/leaves', async (req, res) => {
  try {
    const { status, employeeId } = req.query;

    const TenantLeaveRequest = req.getTenantModel('LeaveRequest');

    if (!TenantLeaveRequest) {
      return res.json([]);
    }

    // Build query
    const query = { tenantId: req.tenantId };

    if (status) {
      query.status = status;
    }

    if (employeeId) {
      query.employeeId = employeeId;
    }

    // Get leave requests
    const leaveRequests = await TenantLeaveRequest.find(query)
      .sort({ createdAt: -1 })
      .lean();

    res.json(leaveRequests);

  } catch (err) {
    logger.error('Error fetching leave requests', {
      tenantId: req.tenantId,
      error: err.message,
      userId: req.user.id
    });
    res.status(500).json({
      error: 'FETCH_LEAVES_FAILED',
      message: 'Server error: ' + err.message
    });
  }
});

// Approve or reject leave request
router.post('/leaves/:id/approve', async (req, res) => {
  try {
    const { id } = req.params;
    const { action, reason } = req.body;

    if (!action || !['approve', 'reject'].includes(action)) {
      return res.status(400).json({
        error: 'INVALID_ACTION',
        message: 'Action must be "approve" or "reject"'
      });
    }

    if (action === 'reject' && !reason) {
      return res.status(400).json({
        error: 'MISSING_REASON',
        message: 'Rejection reason is required'
      });
    }

    const TenantLeaveRequest = req.getTenantModel('LeaveRequest');

    if (!TenantLeaveRequest) {
      return res.status(500).json({
        error: 'MODEL_UNAVAILABLE',
        message: 'LeaveRequest model not available'
      });
    }

    // Find leave request
    const leaveRequest = await TenantLeaveRequest.findOne({
      _id: id,
      tenantId: req.tenantId
    });

    if (!leaveRequest) {
      return res.status(404).json({
        error: 'LEAVE_NOT_FOUND',
        message: 'Leave request not found'
      });
    }

    if (leaveRequest.status !== 'pending') {
      return res.status(400).json({
        error: 'ALREADY_PROCESSED',
        message: `Leave request has already been ${leaveRequest.status}`
      });
    }

    // Update status
    if (action === 'approve') {
      leaveRequest.status = 'approved';
    } else {
      leaveRequest.status = 'rejected';
      leaveRequest.rejectionReason = reason;
    }

    leaveRequest.approvedBy = req.user.username;
    leaveRequest.approvedAt = new Date();

    await leaveRequest.save();

    logger.info(`Leave request ${action}d`, {
      tenantId: req.tenantId,
      leaveRequestId: id,
      employeeId: leaveRequest.employeeId,
      action: action,
      approvedBy: req.user.username
    });

    res.json({
      success: true,
      message: `Leave request ${action}d successfully`,
      leaveRequest: {
        _id: leaveRequest._id,
        employeeId: leaveRequest.employeeId,
        status: leaveRequest.status,
        approvedBy: leaveRequest.approvedBy,
        approvedAt: leaveRequest.approvedAt,
        rejectionReason: leaveRequest.rejectionReason
      }
    });

  } catch (err) {
    logger.error('Error processing leave request', {
      tenantId: req.tenantId,
      leaveRequestId: req.params.id,
      error: err.message,
      userId: req.user.id
    });
    res.status(500).json({
      error: 'PROCESS_LEAVE_FAILED',
      message: 'Server error: ' + err.message
    });
  }
});

console.log('✅ COMPLETE ATTENDANCE ROUTES LOADED - Single-Tenant');
console.log('   ✅ Manual holiday management only (no auto-detection)');
console.log('   ✅ All original functionality preserved');
console.log('   ✅ Clean working day detection');
console.log('   ✅ Complete shift, leave, and analytics systems');
console.log('   ✅ Graceful handling of missing models');
console.log('   ✅ Complete tenant isolation throughout');
console.log('   ✅ Leave request management system');

module.exports = router;