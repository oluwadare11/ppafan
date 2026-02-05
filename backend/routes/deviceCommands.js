const express = require('express');
const router = express.Router();
const { requireAuthentication } = require('../middleware/cookieAuth');
const { identifyTenant, addTenantHelpers, requireActiveTenant } = require('../middleware/tenant');
const logger = require('../utils/logger');
const {
  generateCommandId,
  buildAddUserCommand,
  buildDeleteUserCommand,
  buildEnrollFingerprintCommand,
  buildEnrollFaceCommand,
  buildUploadFingerprintCommand,
  buildUploadFaceCommand,
  buildRebootCommand,
  buildClearAllUsersCommand,
  buildSyncTimeCommand
} = require('../utils/admsCommands');

// Apply middleware to all routes
router.use(identifyTenant);
router.use(addTenantHelpers);
router.use(requireActiveTenant);
router.use(requireAuthentication);

// ENDPOINT 1: POST /api/device-commands/add-user
// Queue command to add user to device
router.post('/add-user', async (req, res) => {
  try {
    const { deviceSN, pin, name, privilege, group } = req.body;

    // Validation
    if (!deviceSN || !pin || !name) {
      return res.status(400).json({
        error: 'MISSING_REQUIRED_FIELDS',
        message: 'Device serial number, PIN, and name are required'
      });
    }

    const TenantDeviceCommand = req.getTenantModel('DeviceCommand');
    const TenantDevice = req.getTenantModel('Device');

    if (!TenantDeviceCommand || !TenantDevice) {
      return res.status(500).json({
        error: 'MODELS_UNAVAILABLE',
        message: 'Required models not available'
      });
    }

    // Verify device exists and belongs to tenant
    const device = await TenantDevice.findOne({
      serialNumber: deviceSN.toUpperCase(),
      tenantId: req.tenantId,
      isActive: true
    });

    if (!device) {
      return res.status(404).json({
        error: 'DEVICE_NOT_FOUND',
        message: 'Device not found or inactive'
      });
    }

    // Generate command
    const commandId = generateCommandId();
    const rawCommand = buildAddUserCommand(commandId, { pin, name, privilege, group });

    // Create command record
    const command = new TenantDeviceCommand({
      deviceSN: deviceSN.toUpperCase(),
      commandId: commandId,
      commandType: 'ADD_USER',
      rawCommand: rawCommand,
      parameters: { pin, name, privilege, group },
      status: 'pending',
      maxRetries: 3,
      tenantId: req.tenantId,
      createdBy: req.user.username
    });

    await command.save();

    logger.info('Add user command queued', {
      tenantId: req.tenantId,
      deviceSN: deviceSN,
      commandId: commandId,
      pin: pin,
      name: name,
      createdBy: req.user.username
    });

    res.status(201).json({
      success: true,
      message: 'Command queued successfully',
      command: {
        commandId: commandId,
        status: 'pending',
        deviceSN: deviceSN,
        commandType: 'ADD_USER'
      }
    });

  } catch (error) {
    logger.error('Error queuing add user command', {
      tenantId: req.tenantId,
      error: error.message,
      userId: req.user.id
    });
    res.status(500).json({
      error: 'QUEUE_COMMAND_FAILED',
      message: 'Failed to queue command: ' + error.message
    });
  }
});

// ENDPOINT 2: POST /api/device-commands/delete-user
// Queue command to delete user from device
router.post('/delete-user', async (req, res) => {
  try {
    const { deviceSN, pin } = req.body;

    if (!deviceSN || !pin) {
      return res.status(400).json({
        error: 'MISSING_REQUIRED_FIELDS',
        message: 'Device serial number and PIN are required'
      });
    }

    const TenantDeviceCommand = req.getTenantModel('DeviceCommand');
    const TenantDevice = req.getTenantModel('Device');

    if (!TenantDeviceCommand || !TenantDevice) {
      return res.status(500).json({
        error: 'MODELS_UNAVAILABLE',
        message: 'Required models not available'
      });
    }

    // Verify device
    const device = await TenantDevice.findOne({
      serialNumber: deviceSN.toUpperCase(),
      tenantId: req.tenantId,
      isActive: true
    });

    if (!device) {
      return res.status(404).json({
        error: 'DEVICE_NOT_FOUND',
        message: 'Device not found or inactive'
      });
    }

    // Generate command
    const commandId = generateCommandId();
    const rawCommand = buildDeleteUserCommand(commandId, pin);

    // Create command record
    const command = new TenantDeviceCommand({
      deviceSN: deviceSN.toUpperCase(),
      commandId: commandId,
      commandType: 'DELETE_USER',
      rawCommand: rawCommand,
      parameters: { pin },
      status: 'pending',
      maxRetries: 3,
      tenantId: req.tenantId,
      createdBy: req.user.username
    });

    await command.save();

    logger.info('Delete user command queued', {
      tenantId: req.tenantId,
      deviceSN: deviceSN,
      commandId: commandId,
      pin: pin,
      createdBy: req.user.username
    });

    res.status(201).json({
      success: true,
      message: 'Command queued successfully',
      command: {
        commandId: commandId,
        status: 'pending',
        deviceSN: deviceSN,
        commandType: 'DELETE_USER'
      }
    });

  } catch (error) {
    logger.error('Error queuing delete user command', {
      tenantId: req.tenantId,
      error: error.message,
      userId: req.user.id
    });
    res.status(500).json({
      error: 'QUEUE_COMMAND_FAILED',
      message: 'Failed to queue command: ' + error.message
    });
  }
});

// ENDPOINT 3: POST /api/device-commands/enroll-fingerprint
// Queue command to trigger fingerprint enrollment on device
router.post('/enroll-fingerprint', async (req, res) => {
  try {
    const { deviceSN, pin, fingerId = 0 } = req.body;

    if (!deviceSN || !pin) {
      return res.status(400).json({
        error: 'MISSING_REQUIRED_FIELDS',
        message: 'Device serial number and PIN are required'
      });
    }

    // Validate fingerId (0-9)
    if (fingerId < 0 || fingerId > 9) {
      return res.status(400).json({
        error: 'INVALID_FINGER_ID',
        message: 'Finger ID must be between 0 and 9'
      });
    }

    const TenantDeviceCommand = req.getTenantModel('DeviceCommand');
    const TenantDevice = req.getTenantModel('Device');

    if (!TenantDeviceCommand || !TenantDevice) {
      return res.status(500).json({
        error: 'MODELS_UNAVAILABLE',
        message: 'Required models not available'
      });
    }

    // Verify device
    const device = await TenantDevice.findOne({
      serialNumber: deviceSN.toUpperCase(),
      tenantId: req.tenantId,
      isActive: true
    });

    if (!device) {
      return res.status(404).json({
        error: 'DEVICE_NOT_FOUND',
        message: 'Device not found or inactive'
      });
    }

    // Generate command
    const commandId = generateCommandId();
    const rawCommand = buildEnrollFingerprintCommand(commandId, pin, fingerId);

    // Create command record
    const command = new TenantDeviceCommand({
      deviceSN: deviceSN.toUpperCase(),
      commandId: commandId,
      commandType: 'ENROLL_FP',
      rawCommand: rawCommand,
      parameters: { pin, fingerId },
      status: 'pending',
      maxRetries: 3,
      tenantId: req.tenantId,
      createdBy: req.user.username
    });

    await command.save();

    logger.info('Enroll fingerprint command queued', {
      tenantId: req.tenantId,
      deviceSN: deviceSN,
      commandId: commandId,
      pin: pin,
      fingerId: fingerId,
      createdBy: req.user.username
    });

    res.status(201).json({
      success: true,
      message: 'Fingerprint enrollment command queued. Device will prompt user to place finger.',
      command: {
        commandId: commandId,
        status: 'pending',
        deviceSN: deviceSN,
        commandType: 'ENROLL_FP',
        fingerId: fingerId
      }
    });

  } catch (error) {
    logger.error('Error queuing enroll fingerprint command', {
      tenantId: req.tenantId,
      error: error.message,
      userId: req.user.id
    });
    res.status(500).json({
      error: 'QUEUE_COMMAND_FAILED',
      message: 'Failed to queue command: ' + error.message
    });
  }
});

// ENDPOINT: POST /api/device-commands/enroll-face
// Queue command to trigger face enrollment on device
router.post('/enroll-face', async (req, res) => {
  try {
    const { deviceSN, pin, faceId = 0 } = req.body;

    if (!deviceSN || !pin) {
      return res.status(400).json({
        error: 'MISSING_REQUIRED_FIELDS',
        message: 'Device serial number and PIN are required'
      });
    }

    // Validate faceId (0-11)
    if (faceId < 0 || faceId > 11) {
      return res.status(400).json({
        error: 'INVALID_FACE_ID',
        message: 'Face ID must be between 0 and 11'
      });
    }

    const TenantDeviceCommand = req.getTenantModel('DeviceCommand');
    const TenantDevice = req.getTenantModel('Device');

    if (!TenantDeviceCommand || !TenantDevice) {
      return res.status(500).json({
        error: 'MODELS_UNAVAILABLE',
        message: 'Required models not available'
      });
    }

    // Verify device
    const device = await TenantDevice.findOne({
      serialNumber: deviceSN.toUpperCase(),
      tenantId: req.tenantId,
      isActive: true
    });

    if (!device) {
      return res.status(404).json({
        error: 'DEVICE_NOT_FOUND',
        message: 'Device not found or inactive'
      });
    }

    // Generate command
    const commandId = generateCommandId();
    const rawCommand = buildEnrollFaceCommand(commandId, pin, faceId);

    // Create command record
    const command = new TenantDeviceCommand({
      deviceSN: deviceSN.toUpperCase(),
      commandId: commandId,
      commandType: 'ENROLL_FACE',
      rawCommand: rawCommand,
      parameters: { pin, faceId },
      status: 'pending',
      maxRetries: 3,
      tenantId: req.tenantId,
      createdBy: req.user.username
    });

    await command.save();

    logger.info('Enroll face command queued', {
      tenantId: req.tenantId,
      deviceSN: deviceSN,
      commandId: commandId,
      pin: pin,
      faceId: faceId,
      createdBy: req.user.username
    });

    res.status(201).json({
      success: true,
      message: 'Face enrollment command queued. Device will prompt user to look at camera.',
      command: {
        commandId: commandId,
        status: 'pending',
        deviceSN: deviceSN,
        commandType: 'ENROLL_FACE',
        faceId: faceId
      }
    });

  } catch (error) {
    logger.error('Error queuing enroll face command', {
      tenantId: req.tenantId,
      error: error.message,
      userId: req.user.id
    });
    res.status(500).json({
      error: 'QUEUE_COMMAND_FAILED',
      message: 'Failed to queue command: ' + error.message
    });
  }
});

// ENDPOINT: POST /api/device-commands/upload-fingerprint
// Push stored fingerprint template to device
router.post('/upload-fingerprint', async (req, res) => {
  try {
    const { deviceSN, staffId, fingerId } = req.body;

    if (!deviceSN || !staffId || fingerId === undefined) {
      return res.status(400).json({
        error: 'MISSING_REQUIRED_FIELDS',
        message: 'Device serial number, staff ID, and finger ID are required'
      });
    }

    const TenantDeviceCommand = req.getTenantModel('DeviceCommand');
    const TenantDevice = req.getTenantModel('Device');
    const TenantStaff = req.getTenantModel('Staff');

    if (!TenantDeviceCommand || !TenantDevice || !TenantStaff) {
      return res.status(500).json({
        error: 'MODELS_UNAVAILABLE',
        message: 'Required models not available'
      });
    }

    // Verify device
    const device = await TenantDevice.findOne({
      serialNumber: deviceSN.toUpperCase(),
      tenantId: req.tenantId,
      isActive: true
    });

    if (!device) {
      return res.status(404).json({
        error: 'DEVICE_NOT_FOUND',
        message: 'Device not found or inactive'
      });
    }

    // Get staff with biometric data
    const staff = await TenantStaff.findById(staffId);

    if (!staff) {
      return res.status(404).json({
        error: 'STAFF_NOT_FOUND',
        message: 'Staff member not found'
      });
    }

    // Get fingerprint template
    const fingerprint = staff.getFingerprint(fingerId);

    if (!fingerprint) {
      return res.status(404).json({
        error: 'TEMPLATE_NOT_FOUND',
        message: `No fingerprint template found for finger ID ${fingerId}`
      });
    }

    // Generate command
    const commandId = generateCommandId();
    const rawCommand = buildUploadFingerprintCommand(
      commandId,
      staff.employeeId,
      fingerId,
      fingerprint.template
    );

    // Create command record
    const command = new TenantDeviceCommand({
      deviceSN: deviceSN.toUpperCase(),
      commandId: commandId,
      commandType: 'UPLOAD_FP',
      rawCommand: rawCommand,
      parameters: {
        pin: staff.employeeId,
        fingerId,
        staffId: staff._id
      },
      status: 'pending',
      maxRetries: 3,
      tenantId: req.tenantId,
      createdBy: req.user.username
    });

    await command.save();

    logger.info('Upload fingerprint command queued', {
      tenantId: req.tenantId,
      deviceSN: deviceSN,
      commandId: commandId,
      staffId: staffId,
      fingerId: fingerId,
      createdBy: req.user.username
    });

    res.status(201).json({
      success: true,
      message: `Fingerprint template push queued for ${staff.firstName} ${staff.lastName}`,
      command: {
        commandId: commandId,
        status: 'pending',
        deviceSN: deviceSN,
        commandType: 'UPLOAD_FP',
        staffName: `${staff.firstName} ${staff.lastName}`,
        fingerId: fingerId
      }
    });

  } catch (error) {
    logger.error('Error queuing upload fingerprint command', {
      tenantId: req.tenantId,
      error: error.message,
      userId: req.user.id
    });
    res.status(500).json({
      error: 'QUEUE_COMMAND_FAILED',
      message: 'Failed to queue command: ' + error.message
    });
  }
});

// ENDPOINT: POST /api/device-commands/upload-face
// Push stored face template to device
router.post('/upload-face', async (req, res) => {
  try {
    const { deviceSN, staffId, faceId = 0 } = req.body;

    if (!deviceSN || !staffId) {
      return res.status(400).json({
        error: 'MISSING_REQUIRED_FIELDS',
        message: 'Device serial number and staff ID are required'
      });
    }

    const TenantDeviceCommand = req.getTenantModel('DeviceCommand');
    const TenantDevice = req.getTenantModel('Device');
    const TenantStaff = req.getTenantModel('Staff');

    if (!TenantDeviceCommand || !TenantDevice || !TenantStaff) {
      return res.status(500).json({
        error: 'MODELS_UNAVAILABLE',
        message: 'Required models not available'
      });
    }

    // Verify device
    const device = await TenantDevice.findOne({
      serialNumber: deviceSN.toUpperCase(),
      tenantId: req.tenantId,
      isActive: true
    });

    if (!device) {
      return res.status(404).json({
        error: 'DEVICE_NOT_FOUND',
        message: 'Device not found or inactive'
      });
    }

    // Get staff with biometric data
    const staff = await TenantStaff.findById(staffId);

    if (!staff) {
      return res.status(404).json({
        error: 'STAFF_NOT_FOUND',
        message: 'Staff member not found'
      });
    }

    // Get face template
    const face = staff.getFace(faceId);

    if (!face) {
      return res.status(404).json({
        error: 'TEMPLATE_NOT_FOUND',
        message: `No face template found for face ID ${faceId}`
      });
    }

    // Generate command
    const commandId = generateCommandId();
    const rawCommand = buildUploadFaceCommand(
      commandId,
      staff.employeeId,
      faceId,
      face.template
    );

    // Create command record
    const command = new TenantDeviceCommand({
      deviceSN: deviceSN.toUpperCase(),
      commandId: commandId,
      commandType: 'UPLOAD_FACE',
      rawCommand: rawCommand,
      parameters: {
        pin: staff.employeeId,
        faceId,
        staffId: staff._id
      },
      status: 'pending',
      maxRetries: 3,
      tenantId: req.tenantId,
      createdBy: req.user.username
    });

    await command.save();

    logger.info('Upload face command queued', {
      tenantId: req.tenantId,
      deviceSN: deviceSN,
      commandId: commandId,
      staffId: staffId,
      faceId: faceId,
      createdBy: req.user.username
    });

    res.status(201).json({
      success: true,
      message: `Face template push queued for ${staff.firstName} ${staff.lastName}`,
      command: {
        commandId: commandId,
        status: 'pending',
        deviceSN: deviceSN,
        commandType: 'UPLOAD_FACE',
        staffName: `${staff.firstName} ${staff.lastName}`,
        faceId: faceId
      }
    });

  } catch (error) {
    logger.error('Error queuing upload face command', {
      tenantId: req.tenantId,
      error: error.message,
      userId: req.user.id
    });
    res.status(500).json({
      error: 'QUEUE_COMMAND_FAILED',
      message: 'Failed to queue command: ' + error.message
    });
  }
});

// ENDPOINT 4: POST /api/device-commands/reboot
// Queue command to reboot device
router.post('/reboot', async (req, res) => {
  try {
    const { deviceSN } = req.body;

    if (!deviceSN) {
      return res.status(400).json({
        error: 'MISSING_DEVICE_SN',
        message: 'Device serial number is required'
      });
    }

    const TenantDeviceCommand = req.getTenantModel('DeviceCommand');
    const TenantDevice = req.getTenantModel('Device');

    if (!TenantDeviceCommand || !TenantDevice) {
      return res.status(500).json({
        error: 'MODELS_UNAVAILABLE',
        message: 'Required models not available'
      });
    }

    // Verify device
    const device = await TenantDevice.findOne({
      serialNumber: deviceSN.toUpperCase(),
      tenantId: req.tenantId,
      isActive: true
    });

    if (!device) {
      return res.status(404).json({
        error: 'DEVICE_NOT_FOUND',
        message: 'Device not found or inactive'
      });
    }

    // Generate command
    const commandId = generateCommandId();
    const rawCommand = buildRebootCommand(commandId);

    // Create command record
    const command = new TenantDeviceCommand({
      deviceSN: deviceSN.toUpperCase(),
      commandId: commandId,
      commandType: 'REBOOT',
      rawCommand: rawCommand,
      parameters: {},
      status: 'pending',
      maxRetries: 1, // Don't retry reboot commands
      tenantId: req.tenantId,
      createdBy: req.user.username
    });

    await command.save();

    logger.info('Reboot command queued', {
      tenantId: req.tenantId,
      deviceSN: deviceSN,
      commandId: commandId,
      createdBy: req.user.username
    });

    res.status(201).json({
      success: true,
      message: 'Reboot command queued. Device will restart within 5 seconds.',
      command: {
        commandId: commandId,
        status: 'pending',
        deviceSN: deviceSN,
        commandType: 'REBOOT'
      }
    });

  } catch (error) {
    logger.error('Error queuing reboot command', {
      tenantId: req.tenantId,
      error: error.message,
      userId: req.user.id
    });
    res.status(500).json({
      error: 'QUEUE_COMMAND_FAILED',
      message: 'Failed to queue command: ' + error.message
    });
  }
});

// ENDPOINT 5: POST /api/device-commands/sync-all-staff
// Bulk sync all active staff to device
router.post('/sync-all-staff', async (req, res) => {
  try {
    const { deviceSN } = req.body;

    if (!deviceSN) {
      return res.status(400).json({
        error: 'MISSING_DEVICE_SN',
        message: 'Device serial number is required'
      });
    }

    const TenantDeviceCommand = req.getTenantModel('DeviceCommand');
    const TenantDevice = req.getTenantModel('Device');
    const TenantStaff = req.getTenantModel('Staff');

    if (!TenantDeviceCommand || !TenantDevice || !TenantStaff) {
      return res.status(500).json({
        error: 'MODELS_UNAVAILABLE',
        message: 'Required models not available'
      });
    }

    // Verify device
    const device = await TenantDevice.findOne({
      serialNumber: deviceSN.toUpperCase(),
      tenantId: req.tenantId,
      isActive: true
    });

    if (!device) {
      return res.status(404).json({
        error: 'DEVICE_NOT_FOUND',
        message: 'Device not found or inactive'
      });
    }

    // Get all active staff
    const activeStaff = await TenantStaff.find({
      tenantId: req.tenantId,
      status: 'active',
      employeeId: { $not: /^CONFIG_/ }
    });

    if (activeStaff.length === 0) {
      return res.status(400).json({
        error: 'NO_ACTIVE_STAFF',
        message: 'No active staff found to sync'
      });
    }

    // Queue commands for all staff
    const commandIds = [];
    const commands = [];

    for (let i = 0; i < activeStaff.length; i++) {
      const staff = activeStaff[i];
      const commandId = generateCommandId(i); // Pass index to avoid duplicate key errors
      const fullName = `${staff.firstName} ${staff.lastName || ''}`.trim();
      const pin = staff.employeeId; // Use employeeId as PIN

      const rawCommand = buildAddUserCommand(commandId, {
        pin: pin,
        name: fullName,
        privilege: 0,
        group: 1
      });

      commands.push({
        deviceSN: deviceSN.toUpperCase(),
        commandId: commandId,
        commandType: 'ADD_USER',
        rawCommand: rawCommand,
        parameters: { pin: pin, name: fullName, privilege: 0, group: 1 },
        status: 'pending',
        maxRetries: 3,
        tenantId: req.tenantId,
        createdBy: req.user.username
      });

      commandIds.push(commandId);
    }

    // Bulk insert commands
    await TenantDeviceCommand.insertMany(commands);

    logger.info('Bulk sync staff commands queued', {
      tenantId: req.tenantId,
      deviceSN: deviceSN,
      totalStaff: activeStaff.length,
      commandIds: commandIds,
      createdBy: req.user.username
    });

    res.status(201).json({
      success: true,
      message: `Queued ${activeStaff.length} staff members for sync`,
      totalQueued: activeStaff.length,
      commandIds: commandIds,
      deviceSN: deviceSN
    });

  } catch (error) {
    logger.error('Error queuing bulk sync commands', {
      tenantId: req.tenantId,
      error: error.message,
      userId: req.user.id
    });
    res.status(500).json({
      error: 'BULK_SYNC_FAILED',
      message: 'Failed to queue bulk sync: ' + error.message
    });
  }
});

// ENDPOINT 6: POST /api/device-commands/sync-staff
// Sync selected staff to device
router.post('/sync-staff', async (req, res) => {
  try {
    const { deviceSN, staffIds } = req.body;

    if (!deviceSN || !staffIds || !Array.isArray(staffIds) || staffIds.length === 0) {
      return res.status(400).json({
        error: 'INVALID_REQUEST',
        message: 'Device serial number and staff IDs array are required'
      });
    }

    const TenantDeviceCommand = req.getTenantModel('DeviceCommand');
    const TenantDevice = req.getTenantModel('Device');
    const TenantStaff = req.getTenantModel('Staff');

    if (!TenantDeviceCommand || !TenantDevice || !TenantStaff) {
      return res.status(500).json({
        error: 'MODELS_UNAVAILABLE',
        message: 'Required models not available'
      });
    }

    // Verify device
    const device = await TenantDevice.findOne({
      serialNumber: deviceSN.toUpperCase(),
      tenantId: req.tenantId,
      isActive: true
    });

    if (!device) {
      return res.status(404).json({
        error: 'DEVICE_NOT_FOUND',
        message: 'Device not found or inactive'
      });
    }

    // Get selected staff
    const staff = await TenantStaff.find({
      _id: { $in: staffIds },
      tenantId: req.tenantId,
      status: 'active',
      employeeId: { $not: /^CONFIG_/ }
    });

    if (staff.length === 0) {
      return res.status(400).json({
        error: 'NO_STAFF_FOUND',
        message: 'No active staff found with provided IDs'
      });
    }

    // Queue commands for selected staff
    const commandIds = [];
    const commands = [];

    for (let i = 0; i < staff.length; i++) {
      const member = staff[i];
      const commandId = generateCommandId(i); // Pass index to avoid duplicate key errors
      const fullName = `${member.firstName} ${member.lastName || ''}`.trim();
      const pin = member.employeeId;

      const rawCommand = buildAddUserCommand(commandId, {
        pin: pin,
        name: fullName,
        privilege: 0,
        group: 1
      });

      commands.push({
        deviceSN: deviceSN.toUpperCase(),
        commandId: commandId,
        commandType: 'ADD_USER',
        rawCommand: rawCommand,
        parameters: { pin: pin, name: fullName, privilege: 0, group: 1 },
        status: 'pending',
        maxRetries: 3,
        tenantId: req.tenantId,
        createdBy: req.user.username
      });

      commandIds.push(commandId);
    }

    // Bulk insert commands
    await TenantDeviceCommand.insertMany(commands);

    logger.info('Selected staff sync commands queued', {
      tenantId: req.tenantId,
      deviceSN: deviceSN,
      totalStaff: staff.length,
      commandIds: commandIds,
      createdBy: req.user.username
    });

    res.status(201).json({
      success: true,
      message: `Queued ${staff.length} staff members for sync`,
      totalQueued: staff.length,
      commandIds: commandIds,
      deviceSN: deviceSN
    });

  } catch (error) {
    logger.error('Error queuing selected staff sync', {
      tenantId: req.tenantId,
      error: error.message,
      userId: req.user.id
    });
    res.status(500).json({
      error: 'SYNC_STAFF_FAILED',
      message: 'Failed to queue staff sync: ' + error.message
    });
  }
});

// ENDPOINT 7: GET /api/device-commands/status/:commandId
// Check command execution status
router.get('/status/:commandId', async (req, res) => {
  try {
    const { commandId } = req.params;

    const TenantDeviceCommand = req.getTenantModel('DeviceCommand');

    if (!TenantDeviceCommand) {
      return res.status(500).json({
        error: 'MODEL_UNAVAILABLE',
        message: 'DeviceCommand model not available'
      });
    }

    // Find command
    const command = await TenantDeviceCommand.findOne({
      commandId: parseInt(commandId),
      tenantId: req.tenantId
    }).lean();

    if (!command) {
      return res.status(404).json({
        error: 'COMMAND_NOT_FOUND',
        message: 'Command not found'
      });
    }

    // Calculate time elapsed
    const now = new Date();
    const elapsed = command.createdAt ? Math.floor((now - new Date(command.createdAt)) / 1000) : 0;

    res.json({
      success: true,
      command: {
        commandId: command.commandId,
        commandType: command.commandType,
        deviceSN: command.deviceSN,
        status: command.status,
        returnCode: command.returnCode,
        deviceResponse: command.deviceResponse,
        retryCount: command.retryCount,
        createdAt: command.createdAt,
        sentAt: command.sentAt,
        acknowledgedAt: command.acknowledgedAt,
        elapsedSeconds: elapsed,
        parameters: command.parameters
      }
    });

  } catch (error) {
    logger.error('Error fetching command status', {
      tenantId: req.tenantId,
      commandId: req.params.commandId,
      error: error.message,
      userId: req.user.id
    });
    res.status(500).json({
      error: 'FETCH_STATUS_FAILED',
      message: 'Failed to fetch command status: ' + error.message
    });
  }
});

// ENDPOINT 8: GET /api/device-commands/pending/:deviceSN
// View all pending commands for a specific device
router.get('/pending/:deviceSN', async (req, res) => {
  try {
    const { deviceSN } = req.params;

    const TenantDeviceCommand = req.getTenantModel('DeviceCommand');

    if (!TenantDeviceCommand) {
      return res.status(500).json({
        error: 'MODEL_UNAVAILABLE',
        message: 'DeviceCommand model not available'
      });
    }

    // Find pending commands for device
    const commands = await TenantDeviceCommand.find({
      deviceSN: deviceSN.toUpperCase(),
      status: 'pending',
      tenantId: req.tenantId
    })
    .sort({ createdAt: 1 })
    .lean();

    res.json({
      success: true,
      deviceSN: deviceSN.toUpperCase(),
      count: commands.length,
      commands: commands.map(cmd => ({
        commandId: cmd.commandId,
        commandType: cmd.commandType,
        status: cmd.status,
        parameters: cmd.parameters,
        createdAt: cmd.createdAt,
        createdBy: cmd.createdBy
      }))
    });

  } catch (error) {
    logger.error('Error fetching pending commands', {
      tenantId: req.tenantId,
      deviceSN: req.params.deviceSN,
      error: error.message,
      userId: req.user.id
    });
    res.status(500).json({
      error: 'FETCH_PENDING_FAILED',
      message: 'Failed to fetch pending commands: ' + error.message
    });
  }
});

// ENDPOINT 9: GET /api/device-commands/all
// View all commands (global queue view with filters)
router.get('/all', async (req, res) => {
  try {
    const { status, deviceSN, limit = 50, page = 1 } = req.query;

    const TenantDeviceCommand = req.getTenantModel('DeviceCommand');

    if (!TenantDeviceCommand) {
      return res.status(500).json({
        error: 'MODEL_UNAVAILABLE',
        message: 'DeviceCommand model not available'
      });
    }

    // Build query
    const query = { tenantId: req.tenantId };

    if (status) {
      query.status = status;
    }

    if (deviceSN) {
      query.deviceSN = deviceSN.toUpperCase();
    }

    // Get total count
    const total = await TenantDeviceCommand.countDocuments(query);

    // Get paginated commands
    const commands = await TenantDeviceCommand.find(query)
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit))
      .lean();

    res.json({
      success: true,
      total: total,
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages: Math.ceil(total / parseInt(limit)),
      commands: commands.map(cmd => ({
        commandId: cmd.commandId,
        commandType: cmd.commandType,
        deviceSN: cmd.deviceSN,
        status: cmd.status,
        returnCode: cmd.returnCode,
        parameters: cmd.parameters,
        createdAt: cmd.createdAt,
        sentAt: cmd.sentAt,
        acknowledgedAt: cmd.acknowledgedAt,
        createdBy: cmd.createdBy
      }))
    });

  } catch (error) {
    logger.error('Error fetching all commands', {
      tenantId: req.tenantId,
      error: error.message,
      userId: req.user.id
    });
    res.status(500).json({
      error: 'FETCH_ALL_FAILED',
      message: 'Failed to fetch commands: ' + error.message
    });
  }
});

// ENDPOINT 10: DELETE /api/device-commands/:commandId
// Cancel a pending command
router.delete('/:commandId', async (req, res) => {
  try {
    const { commandId } = req.params;

    const TenantDeviceCommand = req.getTenantModel('DeviceCommand');

    if (!TenantDeviceCommand) {
      return res.status(500).json({
        error: 'MODEL_UNAVAILABLE',
        message: 'DeviceCommand model not available'
      });
    }

    // Find and delete command (only if pending)
    const command = await TenantDeviceCommand.findOneAndDelete({
      commandId: parseInt(commandId),
      tenantId: req.tenantId,
      status: 'pending' // Can only cancel pending commands
    });

    if (!command) {
      return res.status(404).json({
        error: 'COMMAND_NOT_FOUND',
        message: 'Command not found or cannot be cancelled (already sent/acknowledged)'
      });
    }

    logger.info('Command cancelled', {
      tenantId: req.tenantId,
      commandId: parseInt(commandId),
      commandType: command.commandType,
      deviceSN: command.deviceSN,
      cancelledBy: req.user.username
    });

    res.json({
      success: true,
      message: 'Command cancelled successfully',
      command: {
        commandId: command.commandId,
        commandType: command.commandType,
        deviceSN: command.deviceSN
      }
    });

  } catch (error) {
    logger.error('Error cancelling command', {
      tenantId: req.tenantId,
      commandId: req.params.commandId,
      error: error.message,
      userId: req.user.id
    });
    res.status(500).json({
      error: 'CANCEL_COMMAND_FAILED',
      message: 'Failed to cancel command: ' + error.message
    });
  }
});

module.exports = router;
