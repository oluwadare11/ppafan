// ========================================
// UPDATED SINGLE-TENANT ADMS.js - Enhanced Device Management
// ========================================

const express = require('express');
const router = express.Router();
const { identifyTenant, addTenantHelpers, requireActiveTenant } = require('../middleware/tenant');
const { requireAuthentication } = require('../middleware/cookieAuth');
const { sendEmail } = require('../utils/email');
const { formatTimestampForEmail, getLagosDateString, getLagosDayOfWeek, createLagosShiftTime } = require('../utils/timestamp');
const logger = require('../utils/logger');

// Apply tenant middleware to all routes
router.use(identifyTenant);
router.use(addTenantHelpers);
router.use(requireActiveTenant);

console.log('🚨 UPDATED SINGLE-TENANT ADMS.JS LOADED - Enhanced device management');

// Helper to get real client IP (handles nginx proxy)
const getClientIP = (req) => {
  return req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
         req.headers['x-real-ip'] ||
         req.connection?.remoteAddress ||
         req.socket?.remoteAddress ||
         req.ip ||
         'unknown';
};

// Device credentials cache for performance (tenant-isolated)
const deviceCredentialsCache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// Background processing status (per tenant)
const processingStatus = new Map();

// Security logging for failed authentication attempts (tenant-isolated)
const failedAuthAttempts = new Map();

// DISCOVERY: Track unregistered devices attempting to connect (tenant-isolated)
const discoveredDevicesCache = new Map();
const DISCOVERY_TTL = 30 * 60 * 1000; // 30 minutes - keep discovered devices for 30 min

// Track a discovered (unregistered) device
const trackDiscoveredDevice = (tenantId, serialNumber, ip, additionalInfo = {}) => {
  const cacheKey = `${tenantId}-${serialNumber}`;
  const existing = discoveredDevicesCache.get(cacheKey);

  const deviceInfo = {
    serialNumber: serialNumber.toUpperCase(),
    tenantId,
    ip,
    firstSeen: existing?.firstSeen || new Date(),
    lastSeen: new Date(),
    connectionCount: (existing?.connectionCount || 0) + 1,
    ...additionalInfo,
    timestamp: Date.now()
  };

  discoveredDevicesCache.set(cacheKey, deviceInfo);

  // ALWAYS log discovered devices to console for visibility
  console.log(`📡 [ADMS] DISCOVERED DEVICE: ${serialNumber} from IP ${ip} (tenant: ${tenantId}, connections: ${deviceInfo.connectionCount})`);

  logger.info('Discovered unregistered device', {
    tenantId,
    serialNumber,
    ip,
    connectionCount: deviceInfo.connectionCount
  });

  return deviceInfo;
};

// Get all discovered devices for a tenant
const getDiscoveredDevices = (tenantId) => {
  const now = Date.now();
  const devices = [];

  for (const [key, device] of discoveredDevicesCache.entries()) {
    // Only include devices for this tenant and not expired
    if (device.tenantId === tenantId && (now - device.timestamp) < DISCOVERY_TTL) {
      devices.push(device);
    }
  }

  // Sort by lastSeen (most recent first)
  return devices.sort((a, b) => new Date(b.lastSeen) - new Date(a.lastSeen));
};

// Clear a discovered device (after registration)
const clearDiscoveredDevice = (tenantId, serialNumber) => {
  const cacheKey = `${tenantId}-${serialNumber.toUpperCase()}`;
  discoveredDevicesCache.delete(cacheKey);
};

// ENHANCED: Get device credentials with tenant isolation
const getDeviceCredentials = async (serialNumber, tenantId) => {
  const cacheKey = `${tenantId}-${serialNumber}`;
  const cached = deviceCredentialsCache.get(cacheKey);

  // Return cached credentials if valid
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.credentials;
  }

  try {
    // FIXED: Use getTenantModel utility instead of direct require
    const getTenantModel = require('../utils/getTenantModel');
    const TenantDevice = getTenantModel('Device', tenantId);

    if (!TenantDevice) {
      logger.error('Device model not available', { tenantId });
      return null;
    }

    // PUMP HOUSE ERP: Single-tenant - removed tenantId filtering
    const device = await TenantDevice.findOne({
      serialNumber: serialNumber.toUpperCase(),
      isActive: true
    });
    
    if (!device) {
      // Log failed authentication attempt
      const failedKey = `${tenantId}-${serialNumber}`;
      const attempts = failedAuthAttempts.get(failedKey) || [];
      attempts.push({ timestamp: new Date(), reason: 'Device not found' });
      failedAuthAttempts.set(failedKey, attempts.slice(-10)); // Keep last 10 attempts
      
      logger.warn('Device authentication failed', {
        tenantId,
        serialNumber,
        reason: 'Device not found'
      });
      return null;
    }
    
    const credentials = {
      deviceId: device._id,
      serialNumber: device.serialNumber,
      deviceKey: device.deviceKey,
      name: device.name,
      location: device.location,
      tenantId: device.tenantId // ENHANCED: Include tenant for verification
    };
    
    // Cache the credentials
    deviceCredentialsCache.set(cacheKey, {
      credentials,
      timestamp: Date.now()
    });
    
    logger.debug('Device credentials found', {
      tenantId,
      deviceName: device.name,
      serialNumber
    });
    return credentials;
    
  } catch (error) {
    logger.error('Error fetching device credentials', {
      tenantId,
      serialNumber,
      error: error.message
    });
    return null;
  }
};

// Enhanced device verification middleware with tenant validation and discovery
const verifyDevice = async (req, res, next) => {
  const { SN, INFO } = req.query;
  const clientIP = getClientIP(req);

  if (!SN) {
    console.log(`⚠️ [ADMS] Request without serial number from ${clientIP}`);
    logger.warn('Device request without serial number', {
      tenantId: req.tenantId,
      ip: clientIP
    });
    return res.status(400).send('Serial number required');
  }

  const deviceCredentials = await getDeviceCredentials(SN, req.tenantId);

  if (!deviceCredentials) {
    // DISCOVERY: Track this unregistered device instead of just rejecting
    const additionalInfo = {};

    // Parse INFO parameter if present (contains device info like FW version, etc.)
    if (INFO) {
      try {
        // INFO format: "Ver 6.60 Jun 16 2017,FPCount=0,AttCount=0,UserCount=0"
        const infoParts = INFO.split(',');
        infoParts.forEach(part => {
          if (part.includes('Ver')) {
            additionalInfo.firmwareVersion = part.trim();
          } else if (part.includes('=')) {
            const [key, value] = part.split('=');
            additionalInfo[key.trim()] = value.trim();
          }
        });
      } catch (e) {
        additionalInfo.rawInfo = INFO;
      }
    }

    // Track the discovered device with correct IP
    trackDiscoveredDevice(req.tenantId, SN, clientIP, additionalInfo);

    // Log to console
    console.log(`📡 [ADMS] Unregistered device polling: SN=${SN} IP=${clientIP} (tenant: ${req.tenantId})`);

    logger.info('Unregistered device polling - tracked for discovery', {
      tenantId: req.tenantId,
      serialNumber: SN,
      ip: clientIP
    });

    // Return empty response - device will keep polling
    return res.set('Content-Type', 'text/plain; charset=utf-8').send('');
  }

  // PUMP HOUSE ERP: Single-tenant - tenant consistency check removed

  // Attach device info to request
  req.deviceCredentials = deviceCredentials;
  req.clientIP = clientIP;

  // Log registered device connection
  console.log(`✅ [ADMS] Device verified: ${deviceCredentials.name} (${SN}) from ${clientIP}`);

  logger.debug('Device verified successfully', {
    tenantId: req.tenantId,
    deviceName: deviceCredentials.name,
    serialNumber: SN,
    ip: clientIP
  });

  return next();
};

// Update device record in database with enhanced tenant validation
const updateDeviceRecord = async (deviceId, tenantId, additionalData = {}) => {
  try {
    // FIXED: Use getTenantModel utility instead of direct require
    const getTenantModel = require('../utils/getTenantModel');
    const TenantDevice = getTenantModel('Device', tenantId);

    if (!TenantDevice) {
      logger.error('Device model not available for update', { tenantId, deviceId });
      return false;
    }

    // PUMP HOUSE ERP: Single-tenant - simplified device update
    const result = await TenantDevice.findOneAndUpdate(
      {
        _id: deviceId
      },
      {
        lastSeen: new Date(),
        status: 'online',
        ...additionalData,
      },
      { upsert: false }
    );
    
    if (!result) {
      logger.warn('Device update failed - device not found or wrong tenant', {
        tenantId,
        deviceId
      });
      return false;
    }
    
    logger.debug('Device record updated successfully', {
      tenantId,
      deviceId,
      deviceName: result.name
    });
    return true;
    
  } catch (err) {
    logger.error('Error updating device record', {
      tenantId,
      deviceId,
      error: err.message
    });
    return false;
  }
};

// Get or initialize tenant processing status
const getTenantProcessingStatus = (tenantId) => {
  if (!processingStatus.has(tenantId)) {
    processingStatus.set(tenantId, {
      isProcessing: false,
      lastProcessed: null,
      totalProcessed: 0,
      errors: 0
    });
  }
  return processingStatus.get(tenantId);
};

// ENHANCED: Holiday/Leave Detection Helper Function (tenant-aware)
// NOTE: Does NOT check day of week - shift is the source of truth for working days
const isHolidayOrLeave = async (date, employeeId, tenantId) => {
  const getTenantModel = require('../utils/getTenantModel');
  // FIXED: Use Lagos timezone for date string
  const dateStr = getLagosDateString(date);

  const TenantAttendance = getTenantModel('Attendance', tenantId);
  const TenantLeaveRequest = getTenantModel('LeaveRequest', tenantId);

  // Check for manual holiday
  if (TenantAttendance) {
    const holiday = await TenantAttendance.findOne({
      employeeId: 'HOLIDAY',
      date: dateStr,
      tenantId: tenantId
    });
    if (holiday) {
      return { isNonWorking: true, reason: 'Holiday' };
    }
  }

  // Check for approved leave for this employee
  if (TenantLeaveRequest && employeeId) {
    const leave = await TenantLeaveRequest.findOne({
      employeeId: employeeId,
      tenantId: tenantId,
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

// Legacy wrapper for backward compatibility (used in attendance.js)
const isWorkingDay = async (date, tenantId) => {
  const result = await isHolidayOrLeave(date, null, tenantId);
  return !result.isNonWorking;
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

// Helper to calculate diff in minutes
const timeDiffMinutes = (time1, time2) => Math.floor((time1 - time2) / 60000);

// Helper to get notification recipients (loads from DB then falls back to ENV)
async function getNotificationRecipients(tenantId) {
  try {
    const Tenant = require('../models/Tenant');
    const tenant = await Tenant.findOne({ tenantId });

    // Collect all notification emails (primary + additional)
    const allEmails = [];

    // Add primary notification email first
    if (tenant?.settings?.primaryNotificationEmail?.trim()) {
      allEmails.push(tenant.settings.primaryNotificationEmail.trim());
    }

    // Add additional notification emails
    const additionalEmails = tenant?.settings?.notificationEmails?.filter(e => e?.trim()) || [];
    additionalEmails.forEach(email => {
      if (!allEmails.includes(email)) {
        allEmails.push(email);
      }
    });

    // Return if we have any notification emails configured
    if (allEmails.length > 0) {
      return { recipients: allEmails, tenant };
    }

    // Fallback: Tenant contactInfo email
    if (tenant?.contactInfo?.email) {
      return { recipients: [tenant.contactInfo.email], tenant };
    }

    // Priority 3: Environment variable (check both names)
    if (process.env.NOTIFICATION_EMAILS) {
      return { recipients: process.env.NOTIFICATION_EMAILS.split(',').map(e => e.trim()).filter(e => e), tenant };
    }
    if (process.env.NOTIFICATION_RECIPIENT) {
      return { recipients: [process.env.NOTIFICATION_RECIPIENT], tenant };
    }

    return { recipients: [], tenant };
  } catch (err) {
    logger.error('Error fetching notification recipients', { tenantId, error: err.message });
    // Fallback to ENV
    if (process.env.NOTIFICATION_EMAILS) {
      return { recipients: process.env.NOTIFICATION_EMAILS.split(',').map(e => e.trim()).filter(e => e), tenant: null };
    }
    if (process.env.NOTIFICATION_RECIPIENT) {
      return { recipients: [process.env.NOTIFICATION_RECIPIENT], tenant: null };
    }
    return { recipients: [], tenant: null };
  }
}

// ENHANCED: Email helper functions with tenant context
async function sendCheckInEmail(staff, checkInTime, attendance, tenantId) {
  try {
    const { recipients, tenant } = await getNotificationRecipients(tenantId);

    if (recipients.length > 0) {
      const formattedTimestamp = formatTimestampForEmail(checkInTime, 'time');
      const formattedDate = formatTimestampForEmail(checkInTime, 'date');

      const lateInfo = attendance.late ? `(${formatMinutesToHoursAndMinutes(attendance.lateMinutes)} late)` : '';

      await sendEmail(recipients, 'staff_clock_in', {
        staffName: `${staff.firstName} ${staff.lastName || ''}`.trim(),
        timestamp: formattedTimestamp,
        date: formattedDate,
        late: lateInfo,
        employeeId: staff.employeeId,
        department: staff.department || 'N/A',
        position: staff.position || 'N/A',
        type: 'staff_clock_in',
        tenantId: tenantId,
        tenantName: tenant?.businessName || 'Pump House ERP'
      }, tenant);

      logger.info('Clock-in email sent', {
        tenantId,
        employeeId: staff.employeeId,
        timestamp: formattedTimestamp,
        recipients: recipients.join(', ')
      });
    } else {
      logger.warn('No notification recipients configured for clock-in email', { tenantId });
    }
  } catch (err) {
    logger.error('Error sending clock-in email', {
      tenantId,
      employeeId: staff.employeeId,
      error: err.message
    });
  }
}

async function sendCheckOutEmail(attendance, staff, checkOutTime, shift, tenantId, isSecondary = false) {
  try {
    const { recipients, tenant } = await getNotificationRecipients(tenantId);

    if (recipients.length > 0 && (!attendance.checkOutEmailSent || isSecondary)) {
      const formattedTimestamp = formatTimestampForEmail(checkOutTime, 'time');
      const formattedDate = formatTimestampForEmail(checkOutTime, 'date');

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

      const emailData = {
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
        isUpdatedDeparture: isSecondary,
        tenantId: tenantId,
        tenantName: tenant?.businessName || 'Pump House ERP'
      };

      await sendEmail(recipients, 'staff_clock_out', emailData, tenant);

      if (!isSecondary) {
        attendance.checkOutEmailSent = true;
      }
      await attendance.save();

      const emailType = isSecondary ? 'Updated departure time' : 'Clock-out';
      logger.info(`${emailType} email sent`, {
        tenantId,
        employeeId: staff.employeeId,
        timestamp: formattedTimestamp,
        recipients: recipients.join(', ')
      });
    } else if (recipients.length === 0) {
      logger.warn('No notification recipients configured for clock-out email', { tenantId });
    }
  } catch (err) {
    logger.error('Error sending clock-out email', {
      tenantId,
      employeeId: staff.employeeId,
      error: err.message
    });
  }
}

// ==========================================
// HELPER: Get pending commands for embedding in responses
// ==========================================
const getPendingCommandsResponse = async (req, deviceSN, tenantId) => {
  try {
    const TenantDeviceCommand = req.getTenantModel('DeviceCommand');
    if (!TenantDeviceCommand) return '';

    // PUMP HOUSE ERP: Single-tenant - removed tenantId filtering
    const pendingCommands = await TenantDeviceCommand.find({
      deviceSN: deviceSN.toUpperCase(),
      status: 'pending'
    })
    .sort({ commandId: 1 })
    .limit(3)
    .lean();

    if (pendingCommands.length === 0) return '';

    let response = '';
    const commandIds = [];

    for (const cmd of pendingCommands) {
      response += cmd.rawCommand + '\n';
      commandIds.push(cmd._id);
      console.log(`📤 [ADMS] EMBEDDING COMMAND in response: ${cmd.commandType} (ID: ${cmd.commandId})`);
    }

    // Mark as sent
    await TenantDeviceCommand.updateMany(
      { _id: { $in: commandIds } },
      { status: 'sent', sentAt: new Date() }
    );

    return response;
  } catch (err) {
    console.log(`❌ [ADMS] Error getting commands: ${err.message}`);
    return '';
  }
};

// ==========================================
// LAYER 1: DEVICE COMMUNICATION (ENHANCED WITH TENANT VALIDATION)
// ==========================================

// 1. GET /cdata - Initial device config (ENHANCED WITH TENANT VALIDATION)
router.get('/cdata', verifyDevice, async (req, res) => {
  const { SN } = req.query;
  const deviceCredentials = req.deviceCredentials;

  console.log(`📋 [ADMS] GET /cdata - Device config request from ${deviceCredentials.name} (${SN})`);

  logger.debug('Device config request', {
    tenantId: req.tenantId,
    deviceName: deviceCredentials.name,
    serialNumber: SN
  });

  await updateDeviceRecord(deviceCredentials.deviceId, req.tenantId);

  // SIMPLIFIED CONFIG - based on working test server
  // Commands are ONLY delivered via GET /iclock/getrequest, NOT here
  // Keep config simple to ensure device compatibility
  const config = `GET OPTION FROM: ${SN}
Stamp=0
OpStamp=0
ErrorDelay=60
Delay=10
Realtime=1
Encrypt=0`;

  console.log(`📤 [ADMS] Sending simple config to ${deviceCredentials.name}`);
  res.set('Content-Type', 'text/plain; charset=utf-8').send(config);
});

// 2. POST /cdata - Main data endpoint (ENHANCED WITH COMMAND EMBEDDING)
router.post('/cdata', verifyDevice, async (req, res) => {
  const { table, Stamp, PhotoStamp } = req.query;
  const deviceCredentials = req.deviceCredentials;

  // Log every cdata POST for visibility
  console.log(`📥 [ADMS] POST /cdata: ${deviceCredentials.name} (${req.query.SN}) table=${table || 'heartbeat'}`);

  logger.debug('Main data submission', {
    tenantId: req.tenantId,
    table,
    deviceName: deviceCredentials.name
  });

  await updateDeviceRecord(deviceCredentials.deviceId, req.tenantId);

  if (table === 'ATTLOG') {
    let data = '';
    if (Buffer.isBuffer(req.body)) {
      data = req.body.toString('utf8').trim();
    } else if (typeof req.body === 'string') {
      data = req.body.trim();
    }
    return await handleAttendanceData(req, res, deviceCredentials, data, Stamp);

  } else if (table === 'ATTPHOTO') {
    logger.debug('Photo data via /cdata', {
      tenantId: req.tenantId,
      deviceName: deviceCredentials.name,
      bufferSize: req.body ? req.body.length : 0
    });
    return await handlePhotoData(req, res, deviceCredentials, req.body, PhotoStamp);

  } else if (table === 'USERINFO') {
    let data = '';
    if (Buffer.isBuffer(req.body)) {
      data = req.body.toString('utf8').trim();
    } else if (typeof req.body === 'string') {
      data = req.body.trim();
    }
    return await handleUserData(req, res, deviceCredentials, data, Stamp);

  } else if (table === 'OPERLOG') {
    let data = '';
    if (Buffer.isBuffer(req.body)) {
      data = req.body.toString('utf8').trim();
    } else if (typeof req.body === 'string') {
      data = req.body.trim();
    }
    return await handleOperationLog(req, res, deviceCredentials, data, Stamp);

  } else {
    // Heartbeat or unknown table
    // Commands are ONLY delivered via GET /iclock/getrequest
    console.log(`💓 [ADMS] POST /cdata heartbeat/unknown from ${deviceCredentials.name}`);

    // ============================================================================
    // BIOMETRIC TEMPLATE PROCESSING
    // Devices upload fingerprint/face templates after enrollment completes
    // ============================================================================

    // Get body data as string
    let body = '';
    if (Buffer.isBuffer(req.body)) {
      body = req.body.toString('utf8');
    } else if (typeof req.body === 'string') {
      body = req.body;
    }

    // Parse BIODATA (fingerprint templates) from device
    if (body.includes('BIODATA')) {
      try {
        const biodataLines = body.split('\n').filter(line => line.includes('BIODATA'));

        for (const line of biodataLines) {
          // Format: BIODATA PIN=100 No=0 Index=0 Valid=1 Duress=0 Type=8 MajorVer=5 MinorVer=0 Tmp={base64}
          const biodata = {};
          const parts = line.replace('BIODATA', '').trim().split(/[\t\s]+/);

          for (const part of parts) {
            if (part.includes('=')) {
              const [key, ...valueParts] = part.split('=');
              biodata[key] = valueParts.join('='); // Handle = in base64
            }
          }

          // Also try parsing with \t separator format
          if (!biodata.Pin && !biodata.PIN) {
            const tabParts = line.replace('BIODATA', '').split('\t');
            for (const part of tabParts) {
              if (part.includes('=')) {
                const [key, ...valueParts] = part.split('=');
                biodata[key.trim()] = valueParts.join('=');
              }
            }
          }

          const pin = biodata.Pin || biodata.PIN;
          const template = biodata.Tmp || biodata.TMP;

          if (pin && template) {
            // Find staff by employeeId (PIN)
            const getTenantModel = require('../utils/getTenantModel');
            const TenantStaff = getTenantModel('Staff', req.tenantId);

            if (TenantStaff) {
              const staff = await TenantStaff.findOne({
                employeeId: pin,
                tenantId: req.tenantId
              });

              if (staff) {
                // Save fingerprint template
                await staff.saveFingerprint({
                  fingerId: parseInt(biodata.No || biodata.no || 0),
                  template: template,
                  templateSize: template.length,
                  enrolledBy: 'device',
                  sourceDeviceSN: req.query.SN
                });

                console.log(`🖐️ [ADMS] Fingerprint template captured for ${staff.firstName} (${pin}) from ${deviceCredentials.name}`);

                logger.info('Fingerprint template captured', {
                  tenantId: req.tenantId,
                  deviceSN: req.query.SN,
                  staffId: staff._id,
                  employeeId: pin,
                  fingerId: biodata.No || biodata.no || 0,
                  templateSize: template.length
                });
              } else {
                logger.warn('Staff not found for fingerprint template', {
                  tenantId: req.tenantId,
                  employeeId: pin,
                  deviceSN: req.query.SN
                });
              }
            }
          }
        }
      } catch (error) {
        logger.error('Error processing BIODATA', {
          tenantId: req.tenantId,
          deviceSN: req.query.SN,
          error: error.message
        });
      }
    }

    // Parse FACE templates from device
    if (body.includes('FACE')) {
      try {
        const faceLines = body.split('\n').filter(line => line.includes('FACE') && !line.includes('BIOFACE'));

        for (const line of faceLines) {
          // Format: FACE PIN=100 FID=0 SIZE=1648 Valid=1 TMP={base64}
          const faceData = {};
          const parts = line.replace('FACE', '').trim().split(/[\t\s]+/);

          for (const part of parts) {
            if (part.includes('=')) {
              const [key, ...valueParts] = part.split('=');
              faceData[key] = valueParts.join('=');
            }
          }

          // Also try parsing with \t separator format
          if (!faceData.PIN) {
            const tabParts = line.replace('FACE', '').split('\t');
            for (const part of tabParts) {
              if (part.includes('=')) {
                const [key, ...valueParts] = part.split('=');
                faceData[key.trim()] = valueParts.join('=');
              }
            }
          }

          const pin = faceData.PIN || faceData.Pin;
          const template = faceData.TMP || faceData.Tmp;

          if (pin && template) {
            // Find staff by employeeId (PIN)
            const getTenantModel = require('../utils/getTenantModel');
            const TenantStaff = getTenantModel('Staff', req.tenantId);

            if (TenantStaff) {
              const staff = await TenantStaff.findOne({
                employeeId: pin,
                tenantId: req.tenantId
              });

              if (staff) {
                // Save face template
                await staff.saveFace({
                  faceId: parseInt(faceData.FID || faceData.Fid || 0),
                  template: template,
                  templateSize: parseInt(faceData.SIZE || faceData.Size || 1648),
                  enrolledBy: 'device',
                  sourceDeviceSN: req.query.SN
                });

                console.log(`👤 [ADMS] Face template captured for ${staff.firstName} (${pin}) from ${deviceCredentials.name}`);

                logger.info('Face template captured', {
                  tenantId: req.tenantId,
                  deviceSN: req.query.SN,
                  staffId: staff._id,
                  employeeId: pin,
                  faceId: faceData.FID || faceData.Fid || 0,
                  templateSize: faceData.SIZE || faceData.Size || 1648
                });
              } else {
                logger.warn('Staff not found for face template', {
                  tenantId: req.tenantId,
                  employeeId: pin,
                  deviceSN: req.query.SN
                });
              }
            }
          }
        }
      } catch (error) {
        logger.error('Error processing FACE data', {
          tenantId: req.tenantId,
          deviceSN: req.query.SN,
          error: error.message
        });
      }
    }

    // ============================================================================
    // END BIOMETRIC TEMPLATE PROCESSING
    // ============================================================================

    res.set('Content-Type', 'text/plain; charset=utf-8').send('OK');
  }
});

// 3. POST /fdata - Handle photos and other fdata (ENHANCED)
// NOTE: Router is mounted at /iclock, so this becomes /iclock/fdata
router.post('/fdata', verifyDevice, async (req, res) => {
  const { table, PhotoStamp } = req.query;
  const deviceCredentials = req.deviceCredentials;
  
  logger.debug('Iclock fdata submission', {
    tenantId: req.tenantId,
    table,
    deviceName: deviceCredentials.name
  });
  
  try {
    await updateDeviceRecord(deviceCredentials.deviceId, req.tenantId);
    
    if (table === 'ATTPHOTO') {
      logger.debug('Photo data via /iclock/fdata', {
        tenantId: req.tenantId,
        deviceName: deviceCredentials.name
      });
      return await handlePhotoData(req, res, deviceCredentials, req.body, PhotoStamp);
    } else {
      logger.warn('Unknown fdata table type', {
        tenantId: req.tenantId,
        table,
        deviceName: deviceCredentials.name
      });
      res.set('Content-Type', 'text/plain; charset=utf-8').send('OK');
    }
  } catch (routeErr) {
    logger.error('Route error in fdata', {
      tenantId: req.tenantId,
      deviceName: deviceCredentials.name,
      error: routeErr.message
    });
    if (!res.headersSent) {
      res.status(500).send('Server Error');
    }
  }
});

// 5. GET /getrequest - Device polling for commands (ENHANCED WITH COMMAND QUEUE)
// NOTE: Router is mounted at /iclock, so this becomes /iclock/getrequest
router.get('/getrequest', verifyDevice, async (req, res) => {
  const { INFO } = req.query;
  const deviceCredentials = req.deviceCredentials;

  // Log every device poll to console for visibility
  console.log(`🔄 [ADMS] Device polling: ${deviceCredentials.name} (${req.query.SN}) - checking for commands...`);

  if (INFO) {
    console.log(`📋 [ADMS] Device INFO: ${deviceCredentials.name} -> ${INFO}`);
    logger.debug('Device info received', {
      tenantId: req.tenantId,
      deviceName: deviceCredentials.name,
      info: INFO
    });
  }

  await updateDeviceRecord(deviceCredentials.deviceId, req.tenantId);

  try {
    // ENHANCED: Check for pending commands
    const TenantDeviceCommand = req.getTenantModel('DeviceCommand');

    if (!TenantDeviceCommand) {
      console.log(`⚠️ [ADMS] DeviceCommand model not available for ${req.tenantId}`);
      return res.set('Content-Type', 'text/plain; charset=utf-8').send('');
    }

    // Get up to 5 pending commands for this device
    // PUMP HOUSE ERP: Single-tenant - removed tenantId filtering
    const pendingCommands = await TenantDeviceCommand.find({
      deviceSN: req.query.SN,
      status: 'pending'
    })
    .sort({ commandId: 1 })
    .limit(5) // Device can handle max 5 commands per poll
    .lean();

    if (pendingCommands.length === 0) {
      // No commands - send OK (matching test server behavior)
      return res.set('Content-Type', 'text/plain; charset=utf-8').send('OK');
    }

    // Build response with commands (each ending with \n)
    let response = '';
    const commandIds = [];

    for (const cmd of pendingCommands) {
      response += cmd.rawCommand + '\n';
      commandIds.push(cmd._id);
      console.log(`📤 [ADMS] SENDING COMMAND to ${deviceCredentials.name}: ${cmd.commandType} (ID: ${cmd.commandId})`);
      console.log(`   Raw: ${cmd.rawCommand}`);
    }

    // Update all commands to 'sent' status
    await TenantDeviceCommand.updateMany(
      { _id: { $in: commandIds } },
      {
        status: 'sent',
        sentAt: new Date()
      }
    );

    console.log(`✅ [ADMS] ${pendingCommands.length} command(s) sent to ${deviceCredentials.name}`);

    logger.info('Commands sent to device', {
      tenantId: req.tenantId,
      deviceName: deviceCredentials.name,
      deviceSN: req.query.SN,
      commandCount: pendingCommands.length,
      commandTypes: pendingCommands.map(c => c.commandType)
    });

    res.set('Content-Type', 'text/plain; charset=utf-8').send(response);

  } catch (error) {
    console.log(`❌ [ADMS] Error processing commands: ${error.message}`);
    logger.error('Error processing command queue', {
      tenantId: req.tenantId,
      deviceSN: req.query.SN,
      error: error.message
    });
    res.set('Content-Type', 'text/plain; charset=utf-8').send('');
  }
});

// 6. GET /getreq - Original getreq endpoint (ENHANCED)
router.get('/getreq', verifyDevice, async (req, res) => {
  const deviceCredentials = req.deviceCredentials;
  logger.debug('Original getreq poll', {
    tenantId: req.tenantId,
    deviceName: deviceCredentials.name
  });
  
  await updateDeviceRecord(deviceCredentials.deviceId, req.tenantId);
  res.set('Content-Type', 'text/plain; charset=utf-8').send('');
});

// 7. POST /devicecmd - Device command responses (ENHANCED WITH ACKNOWLEDGMENT PROCESSING)
router.post('/devicecmd', verifyDevice, async (req, res) => {
  const { ID } = req.query;
  const deviceCredentials = req.deviceCredentials;
  let data = '';

  if (req.body) {
    if (Buffer.isBuffer(req.body)) {
      data = req.body.toString('utf8').trim();
    } else if (typeof req.body === 'string') {
      data = req.body.trim();
    } else {
      data = JSON.stringify(req.body);
    }
  }

  logger.debug('Device command response', {
    tenantId: req.tenantId,
    deviceName: deviceCredentials.name,
    commandId: ID,
    response: data
  });

  if (ID === 'INFO') {
    logger.info('Device info received', {
      tenantId: req.tenantId,
      deviceName: deviceCredentials.name,
      info: data
    });
    return res.set('Content-Type', 'text/plain; charset=utf-8').send('OK');
  }

  try {
    // ENHANCED: Process command acknowledgments
    const TenantDeviceCommand = req.getTenantModel('DeviceCommand');

    if (!TenantDeviceCommand) {
      return res.set('Content-Type', 'text/plain; charset=utf-8').send('OK');
    }

    // Parse acknowledgment data (can be multiple lines)
    const lines = data.split('\n').filter(line => line.trim());

    for (const line of lines) {
      // Parse response format: ID=1234567890&Return=0&CMD=DATA
      const params = new URLSearchParams(line);
      const commandId = parseInt(params.get('ID'));
      const returnCode = parseInt(params.get('Return'));
      const cmdType = params.get('CMD');

      if (!commandId) continue;

      // Determine status based on return code
      // 0 = success
      // -1 = general failure
      // -1005 = device busy (in menu)
      const status = returnCode === 0 ? 'acknowledged' : 'failed';

      // Update command status
      // PUMP HOUSE ERP: Single-tenant - removed tenantId filtering
      const updated = await TenantDeviceCommand.findOneAndUpdate(
        {
          commandId: commandId,
          deviceSN: req.query.SN
        },
        {
          status: status,
          returnCode: returnCode,
          acknowledgedAt: new Date(),
          deviceResponse: line
        },
        { new: true }
      );

      if (updated) {
        logger.info('Command acknowledged by device', {
          tenantId: req.tenantId,
          deviceName: deviceCredentials.name,
          commandId: commandId,
          commandType: updated.commandType,
          returnCode: returnCode,
          status: status,
          success: returnCode === 0
        });

        // Handle retry for failed commands (if device busy)
        if (returnCode === -1005 && updated.retryCount < updated.maxRetries) {
          await updated.incrementRetry();
          logger.info('Command will retry', {
            tenantId: req.tenantId,
            commandId: commandId,
            retryCount: updated.retryCount + 1
          });
        }
      }
    }

    res.set('Content-Type', 'text/plain; charset=utf-8').send('OK');

  } catch (error) {
    logger.error('Error processing command acknowledgment', {
      tenantId: req.tenantId,
      deviceSN: req.query.SN,
      error: error.message
    });
    res.set('Content-Type', 'text/plain; charset=utf-8').send('OK');
  }
});

// ==========================================
// LAYER 1: RAW DATA HANDLERS (ENHANCED WITH TENANT VALIDATION)
// ==========================================

// LAYER 1: Raw data capture with enhanced device tracking
async function handleAttendanceData(req, res, deviceCredentials, data, stamp) {
  try {
    logger.debug('Raw attendance data received', {
      tenantId: req.tenantId,
      deviceName: deviceCredentials.name,
      dataLength: data ? data.length : 0
    });

    if (!data || data.trim() === '' || data === '{}') {
      logger.debug('Empty attendance data - initial sync', {
        tenantId: req.tenantId,
        deviceName: deviceCredentials.name
      });
      return res.set('Content-Type', 'text/plain; charset=utf-8').send('OK: 0');
    }

    const records = data.split('\n').filter(line => line.trim() !== '');
    logger.info('Capturing raw attendance records', {
      tenantId: req.tenantId,
      deviceName: deviceCredentials.name,
      recordCount: records.length
    });

    let capturedCount = 0;
    const TenantAttendanceLog = req.getTenantModel('AttendanceLog');
    const TenantStaff = req.getTenantModel('Staff');

    if (!TenantAttendanceLog) {
      logger.error('AttendanceLog model not available', {
        tenantId: req.tenantId
      });
      return res.set('Content-Type', 'text/plain; charset=utf-8').send('OK: 0');
    }

    for (const record of records) {
      try {
        const parts = record.split('\t');
        const [pin, timeStr, deviceStatus, verify, ...rest] = parts;

        logger.debug('Processing raw scan', {
          tenantId: req.tenantId,
          deviceName: deviceCredentials.name,
          employeeId: pin,
          timestamp: timeStr
        });

        // Validate timestamp
        const timestamp = new Date(timeStr);
        if (isNaN(timestamp.getTime())) {
          logger.warn('Invalid timestamp - skipping', {
            tenantId: req.tenantId,
            timestamp: timeStr
          });
          continue;
        }

        // Get staff info for subBusiness (don't fail if not found)
        const staff = TenantStaff ? await TenantStaff.findOne({ 
          employeeId: pin, 
          tenantId: req.tenantId,
          employeeId: { $not: /^CONFIG_/ }
        }) : null;
        
        const subBusiness = staff?.subBusiness || 'General';

        // SAVE ALL SCANS AS RAW DATA WITH ENHANCED DEVICE TRACKING
        const rawLog = new TenantAttendanceLog({
          employeeId: pin,
          timestamp,
          deviceStatus,
          deviceSN: deviceCredentials.serialNumber,
          deviceId: deviceCredentials.deviceId,
          deviceName: deviceCredentials.name,
          verificationMethod: getVerificationMethod(verify),
          rawData: record,
          processed: false,
          subBusiness: subBusiness,
          tenantId: req.tenantId // CRITICAL: Ensure tenant isolation
        });

        await rawLog.save();
        capturedCount++;

        logger.debug('Raw scan captured', {
          tenantId: req.tenantId,
          employeeId: pin,
          scanId: rawLog._id,
          deviceName: deviceCredentials.name
        });

      } catch (recordErr) {
        logger.error('Error capturing raw scan', {
          tenantId: req.tenantId,
          deviceName: deviceCredentials.name,
          error: recordErr.message,
          record: record
        });
      }
    }

    logger.info('Raw capture complete', {
      tenantId: req.tenantId,
      deviceName: deviceCredentials.name,
      capturedCount
    });

    // Just return OK - commands are ONLY delivered via GET /iclock/getrequest
    res.set('Content-Type', 'text/plain; charset=utf-8').send(`OK: ${capturedCount}`);

    // Trigger async processing AFTER responding to device
    setImmediate(() => processRawScans(req.tenantId));

  } catch (err) {
    logger.error('Error handling raw attendance data', {
      tenantId: req.tenantId,
      deviceName: deviceCredentials?.name || 'unknown',
      error: err.message
    });
    // Always respond to device even on error
    res.set('Content-Type', 'text/plain; charset=utf-8').send('OK: 0');
  }
}

// Helper function for verification method
function getVerificationMethod(verify) {
  const methods = {
    '0': 'Password',
    '1': 'Fingerprint',
    '2': 'RFID Card',
    '3': 'Password+Fingerprint',
    '4': 'Face',
    '15': 'Face+Fingerprint',
  };
  return methods[verify] || `Method ${verify}`;
}

// Enhanced photo data handler with tenant validation
// SIMPLIFIED: Just return OK - commands are delivered via /iclock/getrequest only
async function handlePhotoData(req, res, deviceCredentials, buffer, stamp) {
  try {
    logger.debug('Photo data received', {
      tenantId: req.tenantId,
      deviceName: deviceCredentials.name,
      bufferSize: buffer ? buffer.length : 0
    });

    if (!buffer || buffer.length === 0) {
      logger.warn('Empty photo buffer', {
        tenantId: req.tenantId,
        deviceName: deviceCredentials.name
      });
      return res.set('Content-Type', 'text/plain; charset=utf-8').send('OK');
    }

    // Just return OK - commands are ONLY delivered via GET /iclock/getrequest
    res.set('Content-Type', 'text/plain; charset=utf-8').send('OK');

    // ASYNC PROCESSING AFTER RESPONSE
    setImmediate(async () => {
      try {
        const TenantAttendancePhoto = req.getTenantModel('AttendancePhoto');
        
        if (!TenantAttendancePhoto) {
          logger.error('AttendancePhoto model not available', {
            tenantId: req.tenantId
          });
          return;
        }

        logger.debug('Processing photo data', {
          tenantId: req.tenantId,
          deviceName: deviceCredentials.name
        });
        
        const bufferText = buffer.toString('utf8', 0, Math.min(200, buffer.length));
        
        const pinMatch = bufferText.match(/PIN=([^\r\n]+)/);
        if (!pinMatch) {
          logger.warn('Could not find PIN in buffer text', {
            tenantId: req.tenantId,
            deviceName: deviceCredentials.name
          });
          return;
        }
        const filename = pinMatch[1];
        
        let jpegStart = -1;
        for (let i = 0; i < buffer.length - 1; i++) {
          if (buffer[i] === 0xFF && buffer[i + 1] === 0xD8) {
            jpegStart = i;
            break;
          }
        }

        if (jpegStart === -1) {
          logger.warn('No JPEG signature found in buffer', {
            tenantId: req.tenantId,
            deviceName: deviceCredentials.name
          });
          return;
        }

        const photoData = buffer.slice(jpegStart);
        
        if (photoData[0] !== 0xFF || photoData[1] !== 0xD8) {
          logger.warn('Invalid JPEG signature after extraction', {
            tenantId: req.tenantId,
            deviceName: deviceCredentials.name
          });
          return;
        }

        const parts = filename.replace('.jpg', '').split('-');
        if (parts.length >= 2) {
          const timeStr = parts[0];
          const employeeId = parts.slice(1).join('-');

          if (timeStr.length === 14) {
            const year = parseInt(timeStr.substr(0, 4));
            const month = parseInt(timeStr.substr(4, 2)) - 1;
            const day = parseInt(timeStr.substr(6, 2));
            const hour = parseInt(timeStr.substr(8, 2));
            const min = parseInt(timeStr.substr(10, 2));
            const sec = parseInt(timeStr.substr(12, 2));

            const timestamp = new Date(year, month, day, hour, min, sec);
            
            if (!isNaN(timestamp.getTime())) {
              const photo = new TenantAttendancePhoto({
                employeeId,
                timestamp,
                filename,
                photoData,
                size: photoData.length,
                deviceSN: deviceCredentials.serialNumber,
                deviceId: deviceCredentials.deviceId,
                deviceName: deviceCredentials.name,
                processed: false,
                tenantId: req.tenantId // CRITICAL: Ensure tenant isolation
              });
              
              await photo.save();
              
              logger.info('Photo saved successfully', {
                tenantId: req.tenantId,
                employeeId,
                timestamp,
                photoId: photo._id,
                size: photoData.length,
                deviceName: deviceCredentials.name
              });
              
            } else {
              logger.warn('Invalid timestamp parsed from filename', {
                tenantId: req.tenantId,
                filename,
                deviceName: deviceCredentials.name
              });
            }
          } else {
            logger.warn('Invalid timestamp format in filename', {
              tenantId: req.tenantId,
              filename,
              deviceName: deviceCredentials.name
            });
          }
        } else {
          logger.warn('Invalid filename format', {
            tenantId: req.tenantId,
            filename,
            deviceName: deviceCredentials.name
          });
        }

      } catch (asyncErr) {
        logger.error('Photo processing error', {
          tenantId: req.tenantId,
          deviceName: deviceCredentials.name,
          error: asyncErr.message
        });
      }
    });

  } catch (err) {
    logger.error('Photo processing error', {
      tenantId: req.tenantId,
      deviceName: deviceCredentials?.name || 'unknown',
      error: err.message
    });
    if (!res.headersSent) {
      res.set('Content-Type', 'text/plain; charset=utf-8').send('OK: 1');
    }
  }
}

// USER DATA HANDLER with tenant validation
async function handleUserData(req, res, deviceCredentials, data, stamp) {
  try {
    console.log(`👤 [ADMS] USERINFO received from ${deviceCredentials.name}: ${data ? data.length : 0} bytes`);

    logger.debug('User data received', {
      tenantId: req.tenantId,
      deviceName: deviceCredentials.name,
      dataLength: data ? data.length : 0
    });

    // Just return OK - commands are ONLY delivered via GET /iclock/getrequest
    res.set('Content-Type', 'text/plain; charset=utf-8').send('OK');
  } catch (err) {
    logger.error('Error handling user data', {
      tenantId: req.tenantId,
      deviceName: deviceCredentials?.name || 'unknown',
      error: err.message
    });
    res.set('Content-Type', 'text/plain; charset=utf-8').send('OK');
  }
}

// OPERATION LOG HANDLER with tenant validation
// SIMPLIFIED: Just return OK - commands are delivered via /iclock/getrequest only
async function handleOperationLog(req, res, deviceCredentials, data, stamp) {
  try {
    console.log(`📋 [ADMS] OPERLOG received from ${deviceCredentials.name}: ${data ? data.length : 0} bytes`);

    logger.debug('Operation log received', {
      tenantId: req.tenantId,
      deviceName: deviceCredentials.name,
      dataLength: data ? data.length : 0
    });

    // Just return OK - device will poll /iclock/getrequest for commands
    res.set('Content-Type', 'text/plain; charset=utf-8').send('OK');
  } catch (err) {
    logger.error('Error handling operation log', {
      tenantId: req.tenantId,
      deviceName: deviceCredentials?.name || 'unknown',
      error: err.message
    });
    res.set('Content-Type', 'text/plain; charset=utf-8').send('OK');
  }
}

// ==========================================
// LAYER 2: BUSINESS LOGIC PROCESSOR (ENHANCED WITH TENANT VALIDATION)
// ==========================================

async function processRawScans(tenantId) {
  try {
    const processingInfo = getTenantProcessingStatus(tenantId);

    if (processingInfo.isProcessing) {
      logger.debug('Processing already in progress', { tenantId });
      return;
    }

    processingInfo.isProcessing = true;
    logger.info('Processing raw scans', { tenantId });

    // FIXED: Use getTenantModel for tenant-isolated model access
    const getTenantModel = require('../utils/getTenantModel');
    const AttendanceLog = getTenantModel('AttendanceLog', tenantId);

    if (!AttendanceLog) {
      logger.error('Failed to get AttendanceLog model in processRawScans', { tenantId });
      processingInfo.isProcessing = false;
      return;
    }

    const unprocessedScans = await AttendanceLog.find({
      processed: false,
      tenantId: tenantId // CRITICAL: Tenant filtering
    })
      .sort({ timestamp: 1 })
      .limit(100);

    if (unprocessedScans.length === 0) {
      logger.debug('No unprocessed scans found', { tenantId });
      processingInfo.isProcessing = false;
      return;
    }

    logger.info('Processing unprocessed scans', {
      tenantId,
      scanCount: unprocessedScans.length
    });

    let processedCount = 0;
    let errorCount = 0;

    for (const scan of unprocessedScans) {
      try {
        await processSingleScan(scan, tenantId);
        processedCount++;
      } catch (err) {
        logger.error('Error processing scan', {
          tenantId,
          scanId: scan._id,
          error: err.message
        });
        errorCount++;
        scan.processed = true;
        scan.processingNote = `Error: ${err.message}`;
        await scan.save();
      }
    }

    processingInfo.totalProcessed += processedCount;
    processingInfo.errors += errorCount;
    processingInfo.lastProcessed = new Date();
    processingInfo.isProcessing = false;

    logger.info('Batch processing complete', {
      tenantId,
      processedCount,
      errorCount
    });
  } catch (err) {
    logger.error('Error in processRawScans', {
      tenantId,
      error: err.message
    });
    const processingInfo = getTenantProcessingStatus(tenantId);
    processingInfo.isProcessing = false;
    processingInfo.errors++;
  }
}

// UPDATED processSingleScan function with clock-out window logic

async function processSingleScan(scan, tenantId) {
  const { employeeId, timestamp, deviceStatus } = scan;

  // FIXED: Use getTenantModel for tenant-isolated model access
  const getTenantModel = require('../utils/getTenantModel');
  const Staff = getTenantModel('Staff', tenantId);
  const Attendance = getTenantModel('Attendance', tenantId);
  const Shift = getTenantModel('Shift', tenantId);

  if (!Staff || !Attendance || !Shift) {
    logger.error('Failed to get tenant models in processSingleScan', { tenantId });
    scan.determinedType = 'error';
    scan.processingNote = 'Tenant models unavailable';
    scan.processed = true;
    await scan.save();
    return;
  }

  // ENHANCED: Find staff with proper tenant filtering
  // FIX: Use $and to combine employeeId conditions (duplicate keys overwrite each other!)
  const staff = await Staff.findOne({
    employeeId: employeeId,
    tenantId: tenantId
  });
  
  if (!staff) {
    scan.determinedType = 'ignored';
    scan.processingNote = 'Staff not found';
    scan.processed = true;
    await scan.save();
    logger.warn('Staff not found - ignoring scan', {
      tenantId,
      employeeId
    });
    return;
  }

  // Skip CONFIG_ records (system configuration, not real staff)
  if (staff.employeeId && staff.employeeId.startsWith('CONFIG_')) {
    scan.determinedType = 'ignored';
    scan.processingNote = 'Configuration record - not a staff member';
    scan.processed = true;
    await scan.save();
    return;
  }

  // FIXED: Use Lagos timezone for day of week
  const dayOfWeek = getLagosDayOfWeek(timestamp);

  // SHIFT IS SOURCE OF TRUTH - Check if staff has a shift for this day FIRST
  const shift = await Shift.findOne({
    staffId: staff._id,
    dayOfWeek,
    tenantId: tenantId,
    isActive: true
  });

  if (!shift) {
    scan.determinedType = 'ignored';
    scan.processingNote = `No shift scheduled for ${dayOfWeek}`;
    scan.processed = true;
    await scan.save();
    logger.debug('No shift scheduled - ignoring scan', {
      tenantId,
      employeeId,
      dayOfWeek
    });
    return;
  }

  // Staff has a shift - now check for holidays and approved leave
  const holidayLeaveCheck = await isHolidayOrLeave(timestamp, employeeId, tenantId);
  if (holidayLeaveCheck.isNonWorking) {
    scan.determinedType = 'ignored';
    scan.processingNote = holidayLeaveCheck.reason;
    scan.processed = true;
    await scan.save();
    logger.debug('Scan ignored - holiday/leave', {
      tenantId,
      employeeId,
      reason: holidayLeaveCheck.reason
    });
    return;
  }

  logger.debug('Processing scan with shift context', {
    tenantId,
    employeeId,
    dayOfWeek,
    shiftTime: `${shift.resumptionTime}-${shift.closingTime}`
  });

  // *** CRITICAL FIX: Calculate clock-out window BEFORE checking attendance ***
  // FIXED: Use Lagos timezone for shift end time
  const shiftEndTime = createLagosShiftTime(timestamp, shift.closingTime);

  const windowStart = new Date(shiftEndTime.getTime() - 3 * 60 * 60 * 1000); // 3 hours before
  const windowEnd = new Date(shiftEndTime.getTime() + 3 * 60 * 60 * 1000);   // 3 hours after

  const isInClockOutWindow = timestamp >= windowStart && timestamp <= windowEnd;

  logger.debug('Clock-out window calculated', {
    tenantId,
    employeeId,
    windowStart: windowStart.toLocaleTimeString(),
    windowEnd: windowEnd.toLocaleTimeString(),
    scanTime: timestamp.toLocaleTimeString(),
    isInWindow: isInClockOutWindow
  });

  // FIXED: Use Lagos timezone for date string
  const dateStr = getLagosDateString(timestamp);

  // ENHANCED: Find existing attendance with proper tenant filtering
  const existingAttendance = await Attendance.findOne({ 
    employeeId: employeeId,
    date: dateStr,
    tenantId: tenantId
  });
  
  const hasClockIn = existingAttendance && existingAttendance.checkIn;
  
  logger.debug('Attendance check', {
    tenantId,
    employeeId,
    date: dateStr,
    hasClockIn: hasClockIn
  });

  let determinedType;
  let processingNote;

  // *** NEW LOGIC: Check clock-out window first ***
  if (isInClockOutWindow) {
    // This scan is in clock-out window
    if (hasClockIn) {
      // Has clock-in, this is clock-out
      determinedType = 'clock-out';
      processingNote = 'Within clock-out window with existing clock-in';
      logger.debug('Determined as clock-out', {
        tenantId,
        employeeId,
        reason: 'Has existing check-in'
      });
    } else {
      // FIXED: No clock-in, but they showed up - treat as clock-out (partial attendance)
      determinedType = 'clock-out';
      processingNote = 'Clock-out window without check-in - staff present but missed morning scan (partial attendance)';
      logger.debug('Determined as clock-out (partial)', {
        tenantId,
        employeeId,
        reason: 'No morning check-in'
      });
    }
  } else {
    // Outside clock-out window
    if (hasClockIn) {
      // Already clocked in, this is likely lunch/break
      determinedType = 'ignored';
      processingNote = 'Outside clock-out window - likely lunch/break';
      logger.debug('Scan ignored', {
        tenantId,
        employeeId,
        reason: 'Lunch/break scan'
      });
    } else {
      // No clock-in yet, this could be late clock-in
      determinedType = 'clock-in';
      processingNote = 'First scan of day outside clock-out window - treating as clock-in';
      logger.debug('Determined as clock-in', {
        tenantId,
        employeeId,
        timestamp: timestamp.toLocaleTimeString()
      });
    }
  }

  scan.determinedType = determinedType;
  scan.processingNote = processingNote;
  scan.processed = true;
  await scan.save();

  if (determinedType === 'clock-in' || determinedType === 'clock-out') {
    logger.debug('Updating attendance record', {
      tenantId,
      employeeId,
      type: determinedType
    });
    await updateAttendanceRecord(employeeId, timestamp, determinedType, staff, scan._id, tenantId);
  }

  logger.debug('Scan processed successfully', {
    tenantId,
    employeeId,
    determinedType,
    processingNote
  });
}

const updateAttendanceRecord = async (employeeId, timestamp, type, staff, scanId, tenantId) => {
  try {
    // FIXED: Use Lagos timezone for date and day of week
    const dateStr = getLagosDateString(timestamp);
    const dayOfWeek = getLagosDayOfWeek(timestamp);

    logger.debug('Updating attendance record', {
      tenantId,
      employeeId,
      type,
      date: dateStr
    });

    // FIXED: Use getTenantModel for tenant-isolated model access
    const getTenantModel = require('../utils/getTenantModel');
    const Shift = getTenantModel('Shift', tenantId);
    const Attendance = getTenantModel('Attendance', tenantId);

    if (!Shift || !Attendance) {
      logger.error('Failed to get tenant models in updateAttendanceRecord', { tenantId });
      return;
    }

    // ENHANCED: Find shift with proper tenant filtering
    const shift = await Shift.findOne({
      staffId: staff._id,
      dayOfWeek,
      tenantId: tenantId
    });
    
    if (!shift) {
      logger.warn('No shift found for attendance update', {
        tenantId,
        employeeId,
        dayOfWeek
      });
      return null;
    }

    // ENHANCED: Find or create attendance with proper tenant filtering
    let attendance = await Attendance.findOne({ 
      employeeId: employeeId,
      date: dateStr,
      tenantId: tenantId
    });

    if (!attendance) {
      attendance = new Attendance({
        employeeId,
        date: dateStr,
        subBusiness: staff.subBusiness || 'General',
        absent: true,
        adjustmentNote: `Processed from scan ${scanId}`,
        checkOutEmailSent: false,
        secondaryClockOutEmailSent: false,
        clockOutCount: 0,
        tenantId: tenantId // CRITICAL: Ensure tenant isolation
      });
      logger.debug('Created new attendance record', {
        tenantId,
        employeeId
      });
    }

    // FIXED: Use Lagos timezone for shift time calculations
    const expectedStart = createLagosShiftTime(timestamp, shift.resumptionTime);
    const expectedEnd = createLagosShiftTime(timestamp, shift.closingTime);

    if (type === 'clock-in') {
      if (attendance.checkIn) {
        logger.warn('Staff already clocked in today', {
          tenantId,
          employeeId,
          existingClockIn: attendance.checkIn
        });
        return attendance;
      }

      attendance.checkIn = timestamp;
      attendance.absent = false;

      const graceStart = new Date(expectedStart.getTime() + 5 * 60 * 1000);
      if (timestamp > graceStart) {
        attendance.late = true;
        attendance.lateMinutes = timeDiffMinutes(timestamp, expectedStart);
      } else {
        attendance.late = false;
        attendance.lateMinutes = 0;
      }

      await attendance.save();
      logger.info('Clock-in recorded', {
        tenantId,
        employeeId,
        timestamp: timestamp.toISOString()
      });
      
      await sendCheckInEmail(staff, timestamp, attendance, tenantId);

    } else if (type === 'clock-out') {
      logger.debug('Processing clock-out', {
        tenantId,
        employeeId
      });
      
      if (attendance.checkOut) {
        const timeSinceLastClockOut = timestamp - attendance.checkOut;
        const minutesSince = timeSinceLastClockOut / (1000 * 60);
        
        logger.debug('Multiple clock-out detected', {
          tenantId,
          employeeId,
          previousClockOut: attendance.checkOut.toLocaleTimeString(),
          currentClockOut: timestamp.toLocaleTimeString(),
          minutesSince: Math.round(minutesSince)
        });
        
        attendance.checkOut = timestamp;
        attendance.clockOutCount = (attendance.clockOutCount || 1) + 1;
        attendance.absent = false;
        
        if (timestamp < expectedEnd) {
          attendance.earlyLeave = true;
          attendance.earlyLeaveMinutes = timeDiffMinutes(expectedEnd, timestamp);
          attendance.overtimeHours = 0;
        } else {
          attendance.earlyLeave = false;
          attendance.earlyLeaveMinutes = 0;
          attendance.overtimeHours = timeDiffMinutes(timestamp, expectedEnd) / 60;
        }
        
        if (!attendance.checkOutEmailSent) {
          logger.debug('Sending first clock-out email', { tenantId, employeeId });
          await sendCheckOutEmail(attendance, staff, timestamp, shift, tenantId, false);
          attendance.checkOutEmailSent = true;
        } else {
          if (minutesSince < 15) {
            logger.debug('No email sent - within 15min grace period', {
              tenantId,
              employeeId,
              minutesSince: Math.round(minutesSince)
            });
          } else if (!attendance.secondaryClockOutEmailSent) {
            logger.debug('Sending secondary clock-out email', { tenantId, employeeId });
            await sendCheckOutEmail(attendance, staff, timestamp, shift, tenantId, true);
            attendance.secondaryClockOutEmailSent = true;
          } else {
            logger.debug('No email sent - secondary email already sent', {
              tenantId,
              employeeId
            });
          }
        }

        await attendance.save();
        logger.info('Multiple clock-out updated', {
          tenantId,
          employeeId,
          clockOutCount: attendance.clockOutCount
        });
        
      } else {
        logger.debug('First clock-out for employee', {
          tenantId,
          employeeId
        });
        
        attendance.checkOut = timestamp;
        attendance.clockOutCount = 1;
        attendance.absent = false;

        if (timestamp < expectedEnd) {
          attendance.earlyLeave = true;
          attendance.earlyLeaveMinutes = timeDiffMinutes(expectedEnd, timestamp);
          attendance.overtimeHours = 0;
        } else {
          attendance.earlyLeave = false;
          attendance.earlyLeaveMinutes = 0;
          attendance.overtimeHours = timeDiffMinutes(timestamp, expectedEnd) / 60;
        }

        await attendance.save();
        
        logger.debug('Sending first clock-out email', { tenantId, employeeId });
        await sendCheckOutEmail(attendance, staff, timestamp, shift, tenantId, false);
        attendance.checkOutEmailSent = true;
        await attendance.save();

        logger.info('First clock-out recorded', {
          tenantId,
          employeeId,
          timestamp: timestamp.toISOString()
        });
      }
    }

    await attendance.save();
    logger.debug('Final attendance record saved', {
      tenantId,
      employeeId,
      absent: attendance.absent,
      hasCheckIn: !!attendance.checkIn,
      hasCheckOut: !!attendance.checkOut
    });

    return attendance;
  } catch (err) {
    logger.error('Error updating attendance record', {
      tenantId,
      employeeId,
      error: err.message
    });
    throw err;
  }
};

// ==========================================
// ENHANCED ENDPOINTS WITH COMPLETE TENANT ISOLATION
// ==========================================

// Photo endpoint for serving attendance photos (tenant-aware)
router.get('/photo/:photoId', async (req, res) => {
  try {
    const { photoId } = req.params;
    const TenantAttendancePhoto = req.getTenantModel('AttendancePhoto');
    
    if (!TenantAttendancePhoto) {
      return res.status(404).json({ 
        error: 'PHOTO_MODEL_UNAVAILABLE',
        message: 'Photo model not available'
      });
    }
    
    const photo = await TenantAttendancePhoto.findOne({
      _id: photoId,
      tenantId: req.tenantId // CRITICAL: Tenant filtering
    });
    
    if (!photo) {
      return res.status(404).json({ 
        error: 'PHOTO_NOT_FOUND',
        message: 'Photo not found'
      });
    }

    res.set({
      'Content-Type': 'image/jpeg',
      'Cache-Control': 'public, max-age=3600'
    });
    
    res.send(photo.photoData);
    
    logger.debug('Photo served', {
      tenantId: req.tenantId,
      photoId,
      size: photo.size
    });
    
  } catch (err) {
    logger.error('Error serving photo', {
      tenantId: req.tenantId,
      photoId: req.params.photoId,
      error: err.message
    });
    res.status(500).json({ 
      error: 'PHOTO_SERVE_ERROR',
      message: 'Error serving photo'
    });
  }
});

// Enhanced attendance summary endpoint with complete tenant isolation
router.get('/attendance-summary', async (req, res) => {
  try {
    const { startDate, endDate, mode = 'day' } = req.query;
    let dateRangeStart, dateRangeEnd;

    const now = new Date();
    now.setHours(0, 0, 0, 0);

    if (mode === 'day') {
      dateRangeStart = startDate ? new Date(startDate) : now;
      dateRangeEnd = new Date(dateRangeStart);
      dateRangeEnd.setHours(23, 59, 59, 999);
    } else if (mode === 'week') {
      dateRangeStart = startDate ? new Date(startDate) : new Date(now.setDate(now.getDate() - now.getDay()));
      dateRangeEnd = new Date(dateRangeStart);
      dateRangeEnd.setDate(dateRangeStart.getDate() + 6);
      dateRangeEnd.setHours(23, 59, 59, 999);
    } else if (mode === 'month') {
      dateRangeStart = startDate ? new Date(startDate) : new Date(now.getFullYear(), now.getMonth(), 1);
      dateRangeEnd = new Date(dateRangeStart.getFullYear(), dateRangeStart.getMonth() + 1, 0);
      dateRangeEnd.setHours(23, 59, 59, 999);
    } else if (mode === 'custom' && startDate && endDate) {
      dateRangeStart = new Date(startDate);
      dateRangeEnd = new Date(endDate);
      dateRangeEnd.setHours(23, 59, 59, 999);
    } else {
      return res.status(400).json({ 
        error: 'INVALID_DATE_RANGE',
        message: 'Invalid date range or mode' 
      });
    }

    if (isNaN(dateRangeStart.getTime()) || isNaN(dateRangeEnd.getTime())) {
      return res.status(400).json({ 
        error: 'INVALID_DATE_FORMAT',
        message: 'Invalid date format' 
      });
    }

    const TenantAttendance = req.getTenantModel('Attendance');
    const TenantAttendanceLog = req.getTenantModel('AttendanceLog');
    const TenantAttendancePhoto = req.getTenantModel('AttendancePhoto');
    const TenantStaff = req.getTenantModel('Staff');

    if (!TenantAttendance || !TenantStaff) {
      return res.json({
        stats: { totalStaff: 0, totalRecords: 0, present: 0, absent: 0, late: 0, earlyLeave: 0 },
        records: [],
        recent: [],
        device: { isOnline: false, status: 'Offline' },
        processing: getTenantProcessingStatus(req.tenantId),
        tenantId: req.tenantId,
        lastUpdated: new Date().toISOString(),
        message: 'Attendance system not available'
      });
    }

    // ENHANCED: Get attendance records with proper tenant filtering
    // FIXED: Use Lagos timezone for date range query
    const allRecords = await TenantAttendance.find({
      tenantId: req.tenantId, // CRITICAL: Tenant filtering
      date: {
        $gte: getLagosDateString(dateRangeStart),
        $lte: getLagosDateString(dateRangeEnd),
      },
      employeeId: { $nin: ['HOLIDAY', /^LEAVE_/] }
    }).lean();

    const attendanceRecords = [];
    for (const record of allRecords) {
      const recordDate = new Date(record.date);
      if (await isWorkingDay(recordDate, req.tenantId)) {
        attendanceRecords.push(record);
      }
    }

    // Enhanced logs with tenant filtering
    const attendanceLogs = TenantAttendanceLog ? await TenantAttendanceLog.find({
      tenantId: req.tenantId, // CRITICAL: Tenant filtering
      timestamp: {
        $gte: dateRangeStart,
        $lte: dateRangeEnd,
      },
      processed: true,
      determinedType: { $in: ['clock-in', 'clock-out'] }
    })
      .sort({ timestamp: -1 })
      .limit(50)
      .lean() : [];

    // Enhance logs with photo information and tenant filtering
    for (const log of attendanceLogs) {
      try {
        if (TenantAttendancePhoto) {
          const photoTimeStart = new Date(log.timestamp.getTime() - 30000);
          const photoTimeEnd = new Date(log.timestamp.getTime() + 30000);
          
          const photo = await TenantAttendancePhoto.findOne({
            employeeId: log.employeeId,
            tenantId: req.tenantId, // CRITICAL: Tenant filtering
            timestamp: {
              $gte: photoTimeStart,
              $lte: photoTimeEnd
            }
          }).lean();
          
          if (photo) {
            log.photoId = photo._id;
          }
        }
      } catch (photoErr) {
        logger.error('Error finding photo for log', {
          tenantId: req.tenantId,
          logId: log._id,
          error: photoErr.message
        });
      }
    }

    // ENHANCED: Get staff with proper tenant filtering
    const allStaff = await TenantStaff.find({ 
      tenantId: req.tenantId,
      employeeId: { $not: /^CONFIG_/ }
    }).lean();
    
    const staffMap = {};
    allStaff.forEach(staff => {
      staffMap[staff.employeeId] = {
        _id: staff._id,
        firstName: staff.firstName,
        lastName: staff.lastName || '',
        position: staff.position || 'N/A',
        department: staff.department || 'N/A',
      };
    });

    const stats = {
      totalStaff: allStaff.length,
      totalRecords: attendanceRecords.length,
      present: attendanceRecords.filter(r => !r.absent).length,
      absent: attendanceRecords.filter(r => r.absent).length,
      late: attendanceRecords.filter(r => r.late).length,
      earlyLeave: attendanceRecords.filter(r => r.earlyLeave).length,
    };

    // Enhanced logs with staff info, photo URLs, and device information
    const enrichedLogs = attendanceLogs.map(log => {
      return {
        ...log,
        staffName: staffMap[log.employeeId]
          ? `${staffMap[log.employeeId].firstName} ${staffMap[log.employeeId].lastName}`.trim()
          : log.employeeId,
        position: staffMap[log.employeeId]?.position || 'N/A',
        department: staffMap[log.employeeId]?.department || 'N/A',
        formattedTime: log.timestamp.toLocaleTimeString('en-US', {
          timeZone: 'Africa/Lagos',
          hour: 'numeric',
          minute: '2-digit',
          hour12: true,
        }),
        formattedDate: log.timestamp.toLocaleDateString('en-US', {
          timeZone: 'Africa/Lagos',
          month: 'short',
          day: 'numeric',
        }),
        photoUrl: log.photoId ? `/api/adms/photo/${log.photoId}` : null,
        deviceInfo: {
          name: log.deviceName || 'Unknown Device',
          serialNumber: log.deviceSN || 'Unknown',
        }
      };
    });

    // ENHANCED: Get device status summary for tenant with proper filtering
    const TenantDevice = req.getTenantModel('Device');
    const devices = TenantDevice ? await TenantDevice.find({
      tenantId: req.tenantId, // CRITICAL: Tenant filtering
      isActive: true
    }).lean() : [];
    
    const deviceSummary = {
      totalDevices: devices.length,
      onlineDevices: devices.filter(d => {
        if (!d.lastSeen) return false;
        return (new Date() - new Date(d.lastSeen)) < 120000; // 2 minutes
      }).length,
      lastActivity: devices.reduce((latest, device) => {
        if (!device.lastSeen) return latest;
        const deviceLastSeen = new Date(device.lastSeen);
        return deviceLastSeen > latest ? deviceLastSeen : latest;
      }, new Date(0))
    };

    const summary = {
      stats,
      records: attendanceRecords,
      recent: enrichedLogs,
      device: {
        ...deviceSummary,
        isOnline: deviceSummary.onlineDevices > 0,
        lastSeen: deviceSummary.lastActivity > new Date(0) ? deviceSummary.lastActivity : null,
        lastSeenFormatted: deviceSummary.lastActivity > new Date(0)
          ? deviceSummary.lastActivity.toLocaleString('en-US', {
              timeZone: 'Africa/Lagos',
              month: 'short',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })
          : 'Never connected',
        status: deviceSummary.onlineDevices > 0 ? 'Online' : 'Offline',
        statusColor: deviceSummary.onlineDevices > 0 ? 'green' : 'red',
      },
      processing: getTenantProcessingStatus(req.tenantId),
      tenantId: req.tenantId,
      lastUpdated: new Date().toISOString(),
    };

    res.json(summary);

  } catch (err) {
    logger.error('Error getting attendance summary', {
      tenantId: req.tenantId,
      error: err.message,
      stack: err.stack
    });

    res.status(500).json({
      error: 'ATTENDANCE_SUMMARY_ERROR',
      message: 'Error getting attendance summary',
      tenantId: req.tenantId,
      timestamp: new Date().toISOString(),
    });
  }
});

// Additional endpoints with proper tenant isolation
router.post('/force-sync', (req, res) => {
  logger.info('Force sync requested', { tenantId: req.tenantId });
  res.json({
    success: true,
    message: 'Force sync initiated',
    tenantId: req.tenantId,
    note: 'All registered devices will be synced',
  });
});

router.post('/process-pending', async (req, res) => {
  try {
    logger.info('Manual processing trigger requested', { tenantId: req.tenantId });

    const TenantAttendanceLog = req.getTenantModel('AttendanceLog');
    const pendingCount = TenantAttendanceLog ? await TenantAttendanceLog.countDocuments({
      processed: false,
      tenantId: req.tenantId // CRITICAL: Tenant filtering
    }) : 0;
    
    if (pendingCount === 0) {
      return res.json({
        success: true,
        message: 'No pending scans to process',
        tenantId: req.tenantId,
        pendingCount: 0,
        processingStatus: getTenantProcessingStatus(req.tenantId)
      });
    }

    setImmediate(() => processRawScans(req.tenantId));
    
    res.json({
      success: true,
      message: `Processing ${pendingCount} pending scans`,
      tenantId: req.tenantId,
      pendingCount,
      processingStatus: getTenantProcessingStatus(req.tenantId),
      note: 'Processing started in background'
    });
  } catch (err) {
    logger.error('Error in manual processing trigger', {
      tenantId: req.tenantId,
      error: err.message
    });
    res.status(500).json({ 
      error: 'PROCESSING_TRIGGER_ERROR',
      message: 'Error triggering processing: ' + err.message,
      tenantId: req.tenantId
    });
  }
});

// Debug status endpoint with enhanced tenant information
router.get('/debug-status', async (req, res) => {
  try {
    const TenantAttendanceLog = req.getTenantModel('AttendanceLog');
    const TenantDevice = req.getTenantModel('Device');

    const pendingScans = TenantAttendanceLog ? await TenantAttendanceLog.countDocuments({
      processed: false,
      tenantId: req.tenantId // CRITICAL: Tenant filtering
    }) : 0;

    // ENHANCED: Get device status information with tenant filtering
    const devices = TenantDevice ? await TenantDevice.find({
      tenantId: req.tenantId, // CRITICAL: Tenant filtering
      isActive: true
    }).lean() : [];
    
    const deviceSummary = {
      totalDevices: devices.length,
      onlineDevices: devices.filter(d => {
        if (!d.lastSeen) return false;
        return (new Date() - new Date(d.lastSeen)) < 120000;
      }).length,
      devices: devices.map(d => ({
        name: d.name,
        serialNumber: d.serialNumber,
        status: d.status,
        lastSeen: d.lastSeen,
        isOnline: d.lastSeen && (new Date() - new Date(d.lastSeen)) < 120000
      }))
    };
    
    res.json({
      tenantId: req.tenantId,
      devices: deviceSummary,
      processing: {
        ...getTenantProcessingStatus(req.tenantId),
        pendingScans
      },
      cache: {
        deviceCredentialsCacheSize: Array.from(deviceCredentialsCache.keys()).filter(key => key.startsWith(req.tenantId)).length,
        failedAuthAttemptsCount: Array.from(failedAuthAttempts.keys()).filter(key => key.startsWith(req.tenantId)).length
      },
      message: deviceSummary.onlineDevices > 0 ? 'Devices are actively communicating' : 'No devices online',
      systemHealth: {
        deviceCommunication: deviceSummary.onlineDevices > 0 ? 'Good' : 'Poor',
        backgroundProcessing: getTenantProcessingStatus(req.tenantId).isProcessing ? 'Active' : 'Idle',
        pendingWork: pendingScans > 0 ? `${pendingScans} scans pending` : 'All caught up'
      }
    });
  } catch (err) {
    logger.error('Error getting debug status', {
      tenantId: req.tenantId,
      error: err.message
    });
    res.status(500).json({ 
      error: 'DEBUG_STATUS_ERROR',
      message: 'Error getting debug status: ' + err.message,
      tenantId: req.tenantId
    });
  }
});

// Enhanced device security audit endpoint with tenant isolation
router.get('/security-audit', async (req, res) => {
  try {
    const TenantDevice = req.getTenantModel('Device');

    const auditData = {
      tenantId: req.tenantId,
      timestamp: new Date().toISOString(),
      cache: {
        deviceCredentialsCacheSize: Array.from(deviceCredentialsCache.keys()).filter(key => key.startsWith(req.tenantId)).length,
        cacheEntries: Array.from(deviceCredentialsCache.keys()).filter(key => key.startsWith(req.tenantId))
      },
      failedAttempts: Array.from(failedAuthAttempts.entries())
        .filter(([key]) => key.startsWith(req.tenantId))
        .map(([key, attempts]) => ({
          deviceKey: key,
          attemptCount: attempts.length,
          lastAttempt: attempts[attempts.length - 1]
        })),
      registeredDevices: TenantDevice ? await TenantDevice.find({
        tenantId: req.tenantId // CRITICAL: Tenant filtering
      }).select('name serialNumber status lastSeen isActive').lean() : []
    };
    
    res.json(auditData);
  } catch (err) {
    logger.error('Error getting security audit', {
      tenantId: req.tenantId,
      error: err.message
    });
    res.status(500).json({ 
      error: 'SECURITY_AUDIT_ERROR',
      message: 'Error getting security audit: ' + err.message,
      tenantId: req.tenantId
    });
  }
});

// ==========================================
// DEVICE DISCOVERY ENDPOINTS
// ==========================================

// GET /api/adms/discover - List all discovered (unregistered) devices
router.get('/discover', requireAuthentication, async (req, res) => {
  try {
    const discoveredDevices = getDiscoveredDevices(req.tenantId);

    // Also get registered devices to filter them out
    const TenantDevice = req.getTenantModel('Device');
    const registeredSerials = TenantDevice
      ? (await TenantDevice.find({ tenantId: req.tenantId }).select('serialNumber').lean())
          .map(d => d.serialNumber.toUpperCase())
      : [];

    // Filter out already registered devices
    const unregisteredDevices = discoveredDevices.filter(
      d => !registeredSerials.includes(d.serialNumber.toUpperCase())
    );

    logger.info('Device discovery request', {
      tenantId: req.tenantId,
      discoveredCount: discoveredDevices.length,
      unregisteredCount: unregisteredDevices.length
    });

    res.json({
      success: true,
      tenantId: req.tenantId,
      discoveredDevices: unregisteredDevices,
      totalDiscovered: unregisteredDevices.length,
      message: unregisteredDevices.length > 0
        ? `Found ${unregisteredDevices.length} device(s) waiting to be registered`
        : 'No unregistered devices found. Make sure your device ADMS is pointing to this server.',
      instructions: {
        step1: 'On your ZKTeco device, go to COMM > ADMS settings',
        step2: `Set Domain Name`,
        step3: 'Enable ADMS and ensure the device shows connection icon',
        step4: 'Wait 30-60 seconds for device to appear here',
        step5: 'Click "Register" to complete device setup'
      }
    });

  } catch (err) {
    logger.error('Error in device discovery', {
      tenantId: req.tenantId,
      error: err.message
    });
    res.status(500).json({
      error: 'DISCOVERY_ERROR',
      message: 'Error discovering devices: ' + err.message
    });
  }
});

// POST /api/adms/register-discovered - Register a discovered device
router.post('/register-discovered', requireAuthentication, async (req, res) => {
  try {
    const { serialNumber, name, deviceKey, location, deviceType, description } = req.body;

    // Validation
    if (!serialNumber || !name || !deviceKey) {
      return res.status(400).json({
        error: 'MISSING_REQUIRED_FIELDS',
        message: 'Serial number, name, and device key are required'
      });
    }

    // Check if device was discovered
    const discovered = getDiscoveredDevices(req.tenantId)
      .find(d => d.serialNumber.toUpperCase() === serialNumber.toUpperCase());

    if (!discovered) {
      return res.status(404).json({
        error: 'DEVICE_NOT_DISCOVERED',
        message: 'This device was not found in discovery. Make sure it is pointing to this server.'
      });
    }

    // Check if already registered
    const TenantDevice = req.getTenantModel('Device');
    if (!TenantDevice) {
      return res.status(500).json({
        error: 'MODEL_UNAVAILABLE',
        message: 'Device model not available'
      });
    }

    const existing = await TenantDevice.findOne({
      serialNumber: serialNumber.toUpperCase(),
      tenantId: req.tenantId
    });

    if (existing) {
      return res.status(409).json({
        error: 'DEVICE_ALREADY_REGISTERED',
        message: 'This device is already registered'
      });
    }

    // Create the device
    const newDevice = new TenantDevice({
      name,
      serialNumber: serialNumber.toUpperCase(),
      deviceKey,
      location: location || discovered.ip || 'Unknown',
      deviceType: deviceType || 'fingerprint',
      description: description || `Discovered at ${discovered.firstSeen}`,
      tenantId: req.tenantId,
      isActive: true,
      status: 'online', // Mark as online since it was just discovered
      lastSeen: discovered.lastSeen,
      createdBy: req.user?.username || req.user?.email || 'system', // FIXED: Add required createdBy field
      connectionInfo: {
        lastHeartbeat: discovered.lastSeen,
        ipAddress: discovered.ip
      }
    });

    await newDevice.save();

    // Clear from discovered cache
    clearDiscoveredDevice(req.tenantId, serialNumber);

    // Clear credentials cache so next request fetches fresh
    const cacheKey = `${req.tenantId}-${serialNumber.toUpperCase()}`;
    deviceCredentialsCache.delete(cacheKey);

    logger.info('Device registered from discovery', {
      tenantId: req.tenantId,
      deviceId: newDevice._id,
      serialNumber: newDevice.serialNumber,
      name: newDevice.name
    });

    res.status(201).json({
      success: true,
      message: 'Device registered successfully!',
      device: {
        _id: newDevice._id,
        name: newDevice.name,
        serialNumber: newDevice.serialNumber,
        location: newDevice.location,
        status: newDevice.status,
        lastSeen: newDevice.lastSeen
      }
    });

  } catch (err) {
    logger.error('Error registering discovered device', {
      tenantId: req.tenantId,
      error: err.message
    });
    res.status(500).json({
      error: 'REGISTRATION_ERROR',
      message: 'Error registering device: ' + err.message
    });
  }
});

// POST /api/adms/ping-network - Attempt to discover devices on network (placeholder for future)
router.post('/ping-network', async (req, res) => {
  try {
    // For now, just return discovered devices from cache
    // In future, could implement actual network scanning
    const discoveredDevices = getDiscoveredDevices(req.tenantId);

    res.json({
      success: true,
      message: 'Network scan uses passive discovery. Devices will appear when they connect to this server.',
      discoveredCount: discoveredDevices.length,
      discoveredDevices: discoveredDevices,
      note: 'Configure your device ADMS domain to point to this server, then it will appear here automatically.'
    });

  } catch (err) {
    logger.error('Error in network ping', {
      tenantId: req.tenantId,
      error: err.message
    });
    res.status(500).json({
      error: 'PING_ERROR',
      message: 'Error scanning network: ' + err.message
    });
  }
});

// ==========================================
// COMMAND MANAGEMENT ENDPOINTS
// ==========================================

// DELETE /api/adms/commands/clear/:deviceSN - Clear all pending commands for a device
router.delete('/commands/clear/:deviceSN', requireAuthentication, async (req, res) => {
  try {
    const { deviceSN } = req.params;

    const TenantDeviceCommand = req.getTenantModel('DeviceCommand');
    if (!TenantDeviceCommand) {
      return res.status(500).json({
        error: 'MODEL_UNAVAILABLE',
        message: 'DeviceCommand model not available'
      });
    }

    // Delete all pending commands for this device
    const result = await TenantDeviceCommand.deleteMany({
      deviceSN: deviceSN.toUpperCase(),
      status: 'pending',
      tenantId: req.tenantId
    });

    console.log(`🗑️ [ADMS] Cleared ${result.deletedCount} pending commands for device ${deviceSN}`);

    res.json({
      success: true,
      message: `Cleared ${result.deletedCount} pending command(s)`,
      deletedCount: result.deletedCount,
      deviceSN: deviceSN.toUpperCase()
    });

  } catch (err) {
    console.log(`❌ [ADMS] Error clearing commands: ${err.message}`);
    res.status(500).json({
      error: 'CLEAR_COMMANDS_ERROR',
      message: 'Error clearing commands: ' + err.message
    });
  }
});

// DELETE /api/adms/commands/clear-all - Clear all pending commands for tenant
router.delete('/commands/clear-all', requireAuthentication, async (req, res) => {
  try {
    const TenantDeviceCommand = req.getTenantModel('DeviceCommand');
    if (!TenantDeviceCommand) {
      return res.status(500).json({
        error: 'MODEL_UNAVAILABLE',
        message: 'DeviceCommand model not available'
      });
    }

    // Delete all pending commands for this tenant
    const result = await TenantDeviceCommand.deleteMany({
      status: 'pending',
      tenantId: req.tenantId
    });

    console.log(`🗑️ [ADMS] Cleared ALL ${result.deletedCount} pending commands for tenant ${req.tenantId}`);

    res.json({
      success: true,
      message: `Cleared ${result.deletedCount} pending command(s) for all devices`,
      deletedCount: result.deletedCount
    });

  } catch (err) {
    console.log(`❌ [ADMS] Error clearing all commands: ${err.message}`);
    res.status(500).json({
      error: 'CLEAR_COMMANDS_ERROR',
      message: 'Error clearing commands: ' + err.message
    });
  }
});

// POST /api/adms/commands/download-users/:deviceSN - Request device to upload all users
router.post('/commands/download-users/:deviceSN', requireAuthentication, async (req, res) => {
  try {
    const { deviceSN } = req.params;

    // Verify device exists
    const TenantDevice = req.getTenantModel('Device');
    const device = await TenantDevice.findOne({
      serialNumber: deviceSN.toUpperCase(),
      tenantId: req.tenantId
    });

    if (!device) {
      return res.status(404).json({
        error: 'DEVICE_NOT_FOUND',
        message: 'Device not found'
      });
    }

    const TenantDeviceCommand = req.getTenantModel('DeviceCommand');
    if (!TenantDeviceCommand) {
      return res.status(500).json({
        error: 'MODEL_UNAVAILABLE',
        message: 'DeviceCommand model not available'
      });
    }

    // Create command to request user data from device
    // ZKTeco ADMS protocol: C:ID:DATA QUERY USERINFO
    const commandId = Date.now() + Math.floor(Math.random() * 1000000);
    const rawCommand = `C:${commandId}:DATA QUERY USERINFO`;

    const command = new TenantDeviceCommand({
      deviceSN: deviceSN.toUpperCase(),
      commandId: commandId,
      commandType: 'QUERY_USERINFO',
      rawCommand: rawCommand,
      status: 'pending',
      tenantId: req.tenantId,
      createdBy: req.user?.username || req.user?.email || 'system',
      parameters: { action: 'download_all_users' }
    });

    await command.save();

    console.log(`📥 [ADMS] Download users command queued for ${device.name} (${deviceSN})`);

    res.json({
      success: true,
      message: 'Download users command sent. Device will upload user data on next poll.',
      commandId: commandId,
      deviceName: device.name
    });

  } catch (err) {
    console.log(`❌ [ADMS] Error creating download users command: ${err.message}`);
    res.status(500).json({
      error: 'COMMAND_ERROR',
      message: 'Error sending command: ' + err.message
    });
  }
});

// GET /api/adms/test-connection/:deviceSN - Check if device is actively polling
router.get('/test-connection/:deviceSN', requireAuthentication, async (req, res) => {
  try {
    const { deviceSN } = req.params;

    // Get device info
    const TenantDevice = req.getTenantModel('Device');
    const device = await TenantDevice.findOne({
      serialNumber: deviceSN.toUpperCase(),
      tenantId: req.tenantId
    });

    if (!device) {
      return res.status(404).json({
        error: 'DEVICE_NOT_FOUND',
        message: 'Device not found'
      });
    }

    const now = new Date();
    const lastSeen = device.lastSeen ? new Date(device.lastSeen) : null;
    const timeSinceLastSeen = lastSeen ? (now - lastSeen) / 1000 : null;

    // Device is considered online if seen within last 2 minutes
    const isOnline = lastSeen && timeSinceLastSeen < 120;

    // Check pending commands
    const TenantDeviceCommand = req.getTenantModel('DeviceCommand');
    const pendingCount = TenantDeviceCommand ? await TenantDeviceCommand.countDocuments({
      deviceSN: deviceSN.toUpperCase(),
      status: 'pending',
      tenantId: req.tenantId
    }) : 0;

    const sentCount = TenantDeviceCommand ? await TenantDeviceCommand.countDocuments({
      deviceSN: deviceSN.toUpperCase(),
      status: 'sent',
      tenantId: req.tenantId
    }) : 0;

    res.json({
      success: true,
      device: {
        name: device.name,
        serialNumber: device.serialNumber,
        status: device.status,
        isOnline: isOnline,
        lastSeen: lastSeen,
        lastSeenSeconds: timeSinceLastSeen ? Math.round(timeSinceLastSeen) : null,
        lastSeenFormatted: lastSeen ? lastSeen.toLocaleString() : 'Never'
      },
      commands: {
        pending: pendingCount,
        sent: sentCount,
        note: pendingCount > 0 ? 'Commands waiting to be picked up by device' :
              sentCount > 0 ? 'Commands sent, waiting for device acknowledgment' :
              'No pending commands'
      },
      diagnosis: isOnline
        ? '✅ Device is actively polling and connected'
        : lastSeen
          ? `⚠️ Device last seen ${Math.round(timeSinceLastSeen)} seconds ago - may be offline`
          : '❌ Device has never connected to this server'
    });

  } catch (err) {
    console.log(`❌ [ADMS] Error testing connection: ${err.message}`);
    res.status(500).json({
      error: 'TEST_ERROR',
      message: 'Error testing connection: ' + err.message
    });
  }
});

// ==========================================
// BACKGROUND PROCESSING & STATUS MONITORING
// ==========================================

// Cleanup old cache entries periodically
const cleanupCache = () => {
  setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of deviceCredentialsCache.entries()) {
      if (now - entry.timestamp > CACHE_TTL) {
        deviceCredentialsCache.delete(key);
      }
    }
    
    // Cleanup old failed auth attempts (keep last 24 hours)
    const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
    for (const [key, attempts] of failedAuthAttempts.entries()) {
      const recentAttempts = attempts.filter(attempt =>
        new Date(attempt.timestamp).getTime() > oneDayAgo
      );
      if (recentAttempts.length === 0) {
        failedAuthAttempts.delete(key);
      } else {
        failedAuthAttempts.set(key, recentAttempts);
      }
    }

    // Cleanup expired discovered devices
    for (const [key, device] of discoveredDevicesCache.entries()) {
      if (now - device.timestamp > DISCOVERY_TTL) {
        discoveredDevicesCache.delete(key);
      }
    }

    logger.debug('Cache cleanup completed', {
      deviceCacheEntries: deviceCredentialsCache.size,
      failedAuthEntries: failedAuthAttempts.size,
      discoveredDevices: discoveredDevicesCache.size
    });
  }, 5 * 60 * 1000); // Every 5 minutes
};

// Periodic processing check (per tenant)
const scheduleProcessing = () => {
  setInterval(async () => {
    try {
      for (const [tenantId, status] of processingStatus.entries()) {
        if (!status.isProcessing) {
          // FIXED: Use getTenantModel for tenant-isolated model access
          const getTenantModel = require('../utils/getTenantModel');
          const AttendanceLog = getTenantModel('AttendanceLog', tenantId);

          if (!AttendanceLog) continue;

          const pendingCount = await AttendanceLog.countDocuments({
            processed: false,
            tenantId: tenantId // CRITICAL: Tenant filtering
          });
          
          if (pendingCount > 0) {
            logger.debug('Scheduled processing triggered', {
              tenantId,
              pendingCount
            });
            processRawScans(tenantId);
          }
        }
      }
    } catch (err) {
      logger.error('Error in scheduled processing check', {
        error: err.message
      });
    }
  }, 60000); // Check every minute
};

// Initialize background processes
cleanupCache();
scheduleProcessing();

logger.info('Multi-tenant ADMS initialization complete', {
  features: [
    'Dynamic device communication (single-tenant)',
    'Background business logic processing (per tenant)', 
    'Enhanced security with device authentication and audit trails',
    'Performance optimization with credential caching and cleanup',
    'Dynamic device lookup with tenant isolation',
    'Device identifier tracking in all logs',
    'Security audit and failed authentication logging'
  ]
});

module.exports = router;