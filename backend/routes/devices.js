// Single-Tenant Device Management Routes - Streamlined (Admin Interface Only)
const express = require('express');
const router = express.Router();
const { requireAuthentication } = require('../middleware/cookieAuth');
const { identifyTenant, addTenantHelpers, requireActiveTenant } = require('../middleware/tenant');
const logger = require('../utils/logger');

// COMPLETE MIDDLEWARE STACK FOR ALL ROUTES
router.use(identifyTenant);
router.use(addTenantHelpers);
router.use(requireActiveTenant);
router.use(requireAuthentication);

// GET /api/devices - List all devices for current tenant
router.get('/', async (req, res) => {
  try {
    const TenantDevice = req.getTenantModel('Device');
    
    if (!TenantDevice) {
      return res.status(500).json({
        error: 'TENANT_MODEL_UNAVAILABLE',
        message: 'Device model not available'
      });
    }

    const devices = await TenantDevice.find({ 
      tenantId: req.tenantId 
    })
      .select('name serialNumber deviceType location status lastSeen isActive statistics connectionInfo createdAt updatedAt')
      .sort({ createdAt: -1 })
      .lean();

    // Calculate online status for each device
    const enrichedDevices = devices.map(device => ({
      ...device,
      isOnline: device.lastSeen && (new Date() - new Date(device.lastSeen)) < 300000, // 5 minutes - matches device polling interval
      timeSinceLastSeen: device.lastSeen ? calculateTimeSince(device.lastSeen) : 'Never',
      healthScore: calculateHealthScore(device)
    }));

    logger.debug('Devices fetched', {
      tenantId: req.tenantId,
      count: devices.length,
      userId: req.user.id
    });

    res.json({
      success: true,
      devices: enrichedDevices,
      count: enrichedDevices.length,
      summary: {
        total: enrichedDevices.length,
        online: enrichedDevices.filter(d => d.isOnline).length,
        offline: enrichedDevices.filter(d => !d.isOnline).length,
        inactive: enrichedDevices.filter(d => !d.isActive).length
      }
    });

  } catch (error) {
    logger.error('Failed to fetch devices', {
      tenantId: req.tenantId,
      error: error.message,
      userId: req.user.id
    });

    res.status(500).json({
      error: 'FETCH_DEVICES_FAILED',
      message: 'Failed to fetch devices'
    });
  }
});

// POST /api/devices - Add new device
router.post('/', async (req, res) => {
  try {
    const { 
      name, 
      serialNumber, 
      deviceKey, 
      deviceType = 'fingerprint',
      location,
      description,
      ipAddress,
      port = 4370
    } = req.body;

    // Validation
    if (!name || !serialNumber || !deviceKey) {
      return res.status(400).json({
        error: 'MISSING_REQUIRED_FIELDS',
        message: 'Device name, serial number, and device key are required'
      });
    }

    // Validate device type
    const validTypes = ['fingerprint', 'face', 'card', 'hybrid'];
    if (!validTypes.includes(deviceType)) {
      return res.status(400).json({
        error: 'INVALID_DEVICE_TYPE',
        message: 'Device type must be: fingerprint, face, card, or hybrid'
      });
    }

    const TenantDevice = req.getTenantModel('Device');
    
    if (!TenantDevice) {
      return res.status(500).json({
        error: 'TENANT_MODEL_UNAVAILABLE',
        message: 'Device model not available'
      });
    }

    // Check if device exists with proper tenant filtering
    const existingDevice = await TenantDevice.findOne({
      serialNumber: serialNumber.trim().toUpperCase(),
      tenantId: req.tenantId
    });

    if (existingDevice) {
      return res.status(409).json({
        error: 'DEVICE_EXISTS',
        message: 'A device with this serial number already exists'
      });
    }

    // Create device with proper tenant isolation
    const device = new TenantDevice({
      name: name.trim(),
      serialNumber: serialNumber.trim().toUpperCase(),
      deviceKey: deviceKey.trim(),
      deviceType: deviceType,
      location: location?.trim() || '',
      description: description?.trim() || '',
      ipAddress: ipAddress?.trim() || null,
      port: port,
      status: 'offline', // Will be updated when device connects
      isActive: true,
      tenantId: req.tenantId,
      createdBy: req.user.username,
      // Initialize statistics
      statistics: {
        totalScans: 0,
        totalUsers: 0,
        totalPhotos: 0,
        uptime: 0,
        errorCount: 0
      }
    });

    await device.save();

    logger.info('Device added', {
      tenantId: req.tenantId,
      deviceId: device._id,
      serialNumber: device.serialNumber,
      name: device.name,
      deviceType: device.deviceType,
      addedBy: req.user.username
    });

    res.status(201).json({
      success: true,
      message: 'Device added successfully',
      device: {
        _id: device._id,
        name: device.name,
        serialNumber: device.serialNumber,
        deviceType: device.deviceType,
        location: device.location,
        status: device.status,
        isActive: device.isActive,
        createdAt: device.createdAt
      }
    });

  } catch (error) {
    logger.error('Failed to add device', {
      tenantId: req.tenantId,
      error: error.message,
      userId: req.user.id
    });

    if (error.code === 11000) {
      return res.status(409).json({
        error: 'DUPLICATE_DEVICE',
        message: 'Device with this serial number already exists'
      });
    }

    res.status(500).json({
      error: 'ADD_DEVICE_FAILED',
      message: 'Failed to add device'
    });
  }
});

// GET /api/devices/:id - Get specific device with detailed information
router.get('/:id', async (req, res) => {
  try {
    const TenantDevice = req.getTenantModel('Device');
    
    if (!TenantDevice) {
      return res.status(500).json({
        error: 'TENANT_MODEL_UNAVAILABLE',
        message: 'Device model not available'
      });
    }

    const device = await TenantDevice.findOne({
      _id: req.params.id,
      tenantId: req.tenantId
    }).lean();

    if (!device) {
      return res.status(404).json({
        error: 'DEVICE_NOT_FOUND',
        message: 'Device not found'
      });
    }

    // Enrich device data
    const enrichedDevice = {
      ...device,
      isOnline: device.lastSeen && (new Date() - new Date(device.lastSeen)) < 300000,
      timeSinceLastSeen: device.lastSeen ? calculateTimeSince(device.lastSeen) : 'Never',
      healthScore: calculateHealthScore(device),
      uptimeFormatted: formatUptime(device.statistics?.uptime || 0)
    };

    res.json({
      success: true,
      device: enrichedDevice
    });

  } catch (error) {
    logger.error('Failed to fetch device', {
      tenantId: req.tenantId,
      deviceId: req.params.id,
      error: error.message,
      userId: req.user.id
    });

    res.status(500).json({
      error: 'FETCH_DEVICE_FAILED',
      message: 'Failed to fetch device'
    });
  }
});

// PUT /api/devices/:id - Update device configuration
router.put('/:id', async (req, res) => {
  try {
    const { 
      name, 
      location, 
      description, 
      deviceType,
      ipAddress,
      port,
      isActive
    } = req.body;

    const TenantDevice = req.getTenantModel('Device');
    
    if (!TenantDevice) {
      return res.status(500).json({
        error: 'TENANT_MODEL_UNAVAILABLE',
        message: 'Device model not available'
      });
    }

    const device = await TenantDevice.findOne({
      _id: req.params.id,
      tenantId: req.tenantId
    });

    if (!device) {
      return res.status(404).json({
        error: 'DEVICE_NOT_FOUND',
        message: 'Device not found'
      });
    }

    // Update allowed fields
    if (name) device.name = name.trim();
    if (location !== undefined) device.location = location.trim();
    if (description !== undefined) device.description = description.trim();
    if (deviceType) {
      const validTypes = ['fingerprint', 'face', 'card', 'hybrid'];
      if (validTypes.includes(deviceType)) {
        device.deviceType = deviceType;
      }
    }
    if (ipAddress !== undefined) device.ipAddress = ipAddress?.trim() || null;
    if (port) device.port = port;
    if (isActive !== undefined) device.isActive = isActive;
    
    device.updatedBy = req.user.username;
    await device.save();

    logger.info('Device updated', {
      tenantId: req.tenantId,
      deviceId: device._id,
      updatedBy: req.user.username
    });

    res.json({
      success: true,
      message: 'Device updated successfully',
      device: {
        _id: device._id,
        name: device.name,
        serialNumber: device.serialNumber,
        deviceType: device.deviceType,
        location: device.location,
        status: device.status,
        isActive: device.isActive,
        updatedAt: device.updatedAt
      }
    });

  } catch (error) {
    logger.error('Failed to update device', {
      tenantId: req.tenantId,
      deviceId: req.params.id,
      error: error.message,
      userId: req.user.id
    });

    res.status(500).json({
      error: 'UPDATE_DEVICE_FAILED',
      message: 'Failed to update device'
    });
  }
});

// DELETE /api/devices/:id - Delete device
router.delete('/:id', async (req, res) => {
  try {
    const TenantDevice = req.getTenantModel('Device');
    
    if (!TenantDevice) {
      return res.status(500).json({
        error: 'TENANT_MODEL_UNAVAILABLE',
        message: 'Device model not available'
      });
    }

    const device = await TenantDevice.findOneAndDelete({
      _id: req.params.id,
      tenantId: req.tenantId
    });

    if (!device) {
      return res.status(404).json({
        error: 'DEVICE_NOT_FOUND',
        message: 'Device not found'
      });
    }

    logger.info('Device deleted', {
      tenantId: req.tenantId,
      deviceId: device._id,
      serialNumber: device.serialNumber,
      deletedBy: req.user.username
    });

    res.json({
      success: true,
      message: 'Device deleted successfully'
    });

  } catch (error) {
    logger.error('Failed to delete device', {
      tenantId: req.tenantId,
      deviceId: req.params.id,
      error: error.message,
      userId: req.user.id
    });

    res.status(500).json({
      error: 'DELETE_DEVICE_FAILED',
      message: 'Failed to delete device'
    });
  }
});

// GET /api/devices/:id/statistics - Get device statistics
router.get('/:id/statistics', async (req, res) => {
  try {
    const TenantDevice = req.getTenantModel('Device');
    
    if (!TenantDevice) {
      return res.status(500).json({
        error: 'TENANT_MODEL_UNAVAILABLE',
        message: 'Device model not available'
      });
    }

    const device = await TenantDevice.findOne({
      _id: req.params.id,
      tenantId: req.tenantId
    }).select('name serialNumber statistics connectionInfo lastSeen createdAt').lean();

    if (!device) {
      return res.status(404).json({
        error: 'DEVICE_NOT_FOUND',
        message: 'Device not found'
      });
    }

    const stats = device.statistics || {};
    const connectionInfo = device.connectionInfo || {};

    res.json({
      success: true,
      statistics: {
        ...stats,
        uptimeFormatted: formatUptime(stats.uptime || 0),
        lastScanFormatted: stats.lastScanTime ? calculateTimeSince(stats.lastScanTime) : 'Never',
        lastErrorFormatted: stats.lastErrorTime ? calculateTimeSince(stats.lastErrorTime) : 'Never',
        connectionStrength: connectionInfo.connectionStrength || 'unknown',
        missedHeartbeats: connectionInfo.missedHeartbeats || 0,
        isOnline: device.lastSeen && (new Date() - new Date(device.lastSeen)) < 300000
      }
    });

  } catch (error) {
    logger.error('Failed to get device statistics', {
      tenantId: req.tenantId,
      deviceId: req.params.id,
      error: error.message,
      userId: req.user.id
    });

    res.status(500).json({
      error: 'GET_DEVICE_STATS_FAILED',
      message: 'Failed to get device statistics'
    });
  }
});

// GET /api/devices/stats/summary - Get tenant device summary
router.get('/stats/summary', async (req, res) => {
  try {
    const TenantDevice = req.getTenantModel('Device');
    
    if (!TenantDevice) {
      return res.status(500).json({
        error: 'TENANT_MODEL_UNAVAILABLE',
        message: 'Device model not available'
      });
    }

    const stats = await TenantDevice.getDeviceStats(req.tenantId);

    res.json({
      success: true,
      summary: stats,
      lastUpdated: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Failed to get device summary', {
      tenantId: req.tenantId,
      error: error.message,
      userId: req.user.id
    });

    res.status(500).json({
      error: 'GET_DEVICE_SUMMARY_FAILED',
      message: 'Failed to get device summary'
    });
  }
});

// PUT /api/devices/:id/settings - Update device settings
router.put('/:id/settings', async (req, res) => {
  try {
    const { settings } = req.body;

    if (!settings || typeof settings !== 'object') {
      return res.status(400).json({
        error: 'INVALID_SETTINGS',
        message: 'Settings object is required'
      });
    }

    const TenantDevice = req.getTenantModel('Device');
    
    if (!TenantDevice) {
      return res.status(500).json({
        error: 'TENANT_MODEL_UNAVAILABLE',
        message: 'Device model not available'
      });
    }

    const device = await TenantDevice.findOne({
      _id: req.params.id,
      tenantId: req.tenantId
    });

    if (!device) {
      return res.status(404).json({
        error: 'DEVICE_NOT_FOUND',
        message: 'Device not found'
      });
    }

    // Update settings (merge with existing)
    device.settings = {
      ...device.settings,
      ...settings
    };
    device.updatedBy = req.user.username;
    
    await device.save();

    logger.info('Device settings updated', {
      tenantId: req.tenantId,
      deviceId: device._id,
      updatedBy: req.user.username
    });

    res.json({
      success: true,
      message: 'Device settings updated successfully',
      settings: device.settings
    });

  } catch (error) {
    logger.error('Failed to update device settings', {
      tenantId: req.tenantId,
      deviceId: req.params.id,
      error: error.message,
      userId: req.user.id
    });

    res.status(500).json({
      error: 'UPDATE_DEVICE_SETTINGS_FAILED',
      message: 'Failed to update device settings'
    });
  }
});

// Helper functions
function calculateTimeSince(date) {
  const diffMs = new Date() - new Date(date);
  const diffMins = Math.floor(diffMs / 60000);
  
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins} minute${diffMins !== 1 ? 's' : ''} ago`;
  
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
  
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;
}

function calculateHealthScore(device) {
  let score = 100;
  
  // Deduct points for being offline
  const isOnline = device.lastSeen && (new Date() - new Date(device.lastSeen)) < 300000;
  if (!isOnline) score -= 30;
  
  // Deduct points for errors
  const errorCount = device.statistics?.errorCount || 0;
  if (errorCount > 0) score -= Math.min(errorCount * 2, 30);
  
  // Deduct points for missed heartbeats
  const missedHeartbeats = device.connectionInfo?.missedHeartbeats || 0;
  if (missedHeartbeats > 0) score -= Math.min(missedHeartbeats * 5, 20);
  
  // Deduct points if not active
  if (!device.isActive) score -= 20;
  
  return Math.max(0, score);
}

function formatUptime(uptimeHours) {
  if (uptimeHours < 1) return `${Math.round(uptimeHours * 60)} minutes`;
  if (uptimeHours < 24) return `${Math.round(uptimeHours)} hours`;
  
  const days = Math.floor(uptimeHours / 24);
  const hours = Math.round(uptimeHours % 24);
  return `${days} day${days !== 1 ? 's' : ''}, ${hours} hour${hours !== 1 ? 's' : ''}`;
}

module.exports = router;