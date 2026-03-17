// Single-Tenant Aware Staff Routes with FIXED Employee Code Management
const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const rateLimit = require('express-rate-limit');
const { requireEitherAuthentication } = require('../middleware/cookieAuth');
const { identifyTenant, addTenantHelpers, requireActiveTenant } = require('../middleware/tenant');
const logger = require('../utils/logger');

// Rate limiter for verify-code endpoint (public, needs protection)
const verifyCodeLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: process.env.NODE_ENV === 'development' ? 10000 : 120, // 120/min for kiosk (bypass in dev)
  message: {
    success: false,
    message: 'Too many verification requests. Please wait a moment.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true
});

// PUBLIC ENDPOINT: Verify employee code (for kiosk login)
// This needs to be BEFORE authentication middleware
router.get('/verify-code/:employeeCode', verifyCodeLimiter, identifyTenant, addTenantHelpers, requireActiveTenant, async (req, res) => {
  try {
    const { employeeCode } = req.params;

    // Accept 1-4 digits (will be normalized to 4 digits)
    if (!employeeCode || !/^\d{1,4}$/.test(employeeCode)) {
      return res.status(400).json({
        success: false,
        message: 'Employee code must be 1-4 digits'
      });
    }

    // Normalize to 4 digits (e.g., "1" → "0001", "20" → "0020")
    const normalizedEmployeeCode = String(employeeCode).trim().padStart(4, '0');

    const TenantStaff = req.getTenantModel('Staff');

    if (!TenantStaff) {
      return res.status(500).json({
        success: false,
        message: 'Staff model not available for this tenant'
      });
    }

    // Find staff by normalized employee code
    const staff = await TenantStaff.findOne({
      tenantId: req.tenantId,
      employeeId: normalizedEmployeeCode,
      status: 'active'
    }).select('firstName lastName employeeId');

    if (!staff) {
      logger.debug('Employee code not found', {
        tenantId: req.tenantId,
        employeeCode: employeeCode
      });

      return res.status(404).json({
        success: false,
        message: 'Employee code not found'
      });
    }

    logger.debug('Employee code verified', {
      tenantId: req.tenantId,
      staffId: staff._id,
      employeeCode: employeeCode
    });

    res.json({
      success: true,
      staff: {
        firstName: staff.firstName,
        lastName: staff.lastName,
        employeeId: staff.employeeId
      }
    });
  } catch (error) {
    logger.error('Employee code verification error', {
      tenantId: req.tenantId,
      error: error.message
    });

    res.status(500).json({
      success: false,
      message: 'Failed to verify employee code'
    });
  }
});

// COMPLETE MIDDLEWARE STACK FOR ALL OTHER ROUTES
router.use(identifyTenant);
router.use(addTenantHelpers);
router.use(requireActiveTenant);
router.use(requireEitherAuthentication);

// Validate PIN: 4-6 digits, no repetitive or sequential patterns
const validatePin = (pin) => {
  if (!pin) return true; // PIN is optional
  if (!/^\d{4,6}$/.test(pin)) return false; // Must be 4-6 digits
  if (/^(\d)\1+$/.test(pin)) return false; // No repetitive digits (e.g., 1111)
  if (/^(?:012|123|234|345|456|567|678|789|987|876|765|654|543|432|321|210)$/.test(pin)) return false; // No sequential digits
  return true;
};

// Validate Employee Code - accepts 1-4 digits, will be auto-padded to 4 digits
const validateEmployeeCode = (code) => {
  if (!code) return { valid: false, message: 'Employee code is required' };

  // Must be string of 1-4 digits (will be padded to 4)
  const codeStr = String(code).trim();
  if (!/^\d{1,4}$/.test(codeStr)) {
    return { valid: false, message: 'Employee code must be 1-4 digits (1-9999)' };
  }

  // Convert to number and validate range (0 not allowed, 1-9999 only)
  const codeNum = parseInt(codeStr, 10);
  if (codeNum < 1 || codeNum > 9999) {
    return { valid: false, message: 'Employee code must be between 1 and 9999' };
  }

  return { valid: true };
};

// ===========================================
// DEPARTMENT MANAGEMENT ENDPOINTS
// ===========================================

// GET /api/staff/departments - Get all departments for current tenant
router.get('/departments', async (req, res) => {
  try {
    const TenantStaff = req.getTenantModel('Staff');
    
    if (!TenantStaff) {
      return res.status(500).json({ 
        error: 'TENANT_MODEL_UNAVAILABLE',
        message: 'Staff model not available for this tenant' 
      });
    }

    const departments = await TenantStaff.getTenantDepartments(req.tenantId);
    
    logger.debug('Departments fetched', {
      tenantId: req.tenantId,
      count: departments.length,
      userId: req.user.id
    });

    res.json({
      success: true,
      departments,
      count: departments.length
    });

  } catch (err) {
    logger.error('Error fetching departments', {
      tenantId: req.tenantId,
      error: err.message,
      userId: req.user.id
    });
    res.status(500).json({ 
      error: 'FETCH_DEPARTMENTS_FAILED',
      message: 'Failed to fetch departments: ' + err.message 
    });
  }
});

// POST /api/staff/departments - Add new department
router.post('/departments', async (req, res) => {
  try {
    const { name, description } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({
        error: 'MISSING_DEPARTMENT_NAME',
        message: 'Department name is required'
      });
    }

    const TenantStaff = req.getTenantModel('Staff');
    
    if (!TenantStaff) {
      return res.status(500).json({ 
        error: 'TENANT_MODEL_UNAVAILABLE',
        message: 'Staff model not available for this tenant' 
      });
    }

    const newDepartment = await TenantStaff.addDepartment(
      req.tenantId, 
      { name: name.trim(), description: description?.trim() || '' }, 
      req.user.username
    );

    logger.info('Department added', {
      tenantId: req.tenantId,
      departmentName: newDepartment.name,
      addedBy: req.user.username
    });

    res.status(201).json({
      success: true,
      message: 'Department added successfully',
      department: {
        _id: newDepartment._id,
        name: newDepartment.name,
        description: newDepartment.description,
        createdAt: newDepartment.createdAt
      }
    });

  } catch (err) {
    logger.error('Error adding department', {
      tenantId: req.tenantId,
      error: err.message,
      userId: req.user.id
    });

    if (err.message === 'Department already exists') {
      return res.status(409).json({
        error: 'DEPARTMENT_EXISTS',
        message: 'A department with this name already exists'
      });
    }

    res.status(500).json({ 
      error: 'ADD_DEPARTMENT_FAILED',
      message: 'Failed to add department: ' + err.message 
    });
  }
});

// DELETE /api/staff/departments/:name - Remove department
router.delete('/departments/:name', async (req, res) => {
  try {
    const departmentName = decodeURIComponent(req.params.name);

    const TenantStaff = req.getTenantModel('Staff');
    
    if (!TenantStaff) {
      return res.status(500).json({ 
        error: 'TENANT_MODEL_UNAVAILABLE',
        message: 'Staff model not available for this tenant' 
      });
    }

    const result = await TenantStaff.removeDepartment(
      req.tenantId, 
      departmentName, 
      req.user.username
    );

    logger.info('Department removed', {
      tenantId: req.tenantId,
      departmentName: departmentName,
      removedBy: req.user.username
    });

    res.json({
      success: true,
      message: result.message
    });

  } catch (err) {
    logger.error('Error removing department', {
      tenantId: req.tenantId,
      error: err.message,
      userId: req.user.id
    });

    if (err.message.includes('staff member(s) are assigned')) {
      return res.status(400).json({
        error: 'DEPARTMENT_IN_USE',
        message: err.message
      });
    }

    res.status(500).json({ 
      error: 'REMOVE_DEPARTMENT_FAILED',
      message: 'Failed to remove department: ' + err.message 
    });
  }
});

// ===========================================
// POSITION MANAGEMENT ENDPOINTS
// ===========================================

// GET /api/staff/positions - Get all positions for current tenant
router.get('/positions', async (req, res) => {
  try {
    const { department } = req.query;
    
    const TenantStaff = req.getTenantModel('Staff');
    
    if (!TenantStaff) {
      return res.status(500).json({ 
        error: 'TENANT_MODEL_UNAVAILABLE',
        message: 'Staff model not available for this tenant' 
      });
    }

    const positions = await TenantStaff.getTenantPositions(req.tenantId, department);
    
    logger.debug('Positions fetched', {
      tenantId: req.tenantId,
      count: positions.length,
      department: department || 'all',
      userId: req.user.id
    });

    res.json({
      success: true,
      positions,
      count: positions.length,
      department: department || null
    });

  } catch (err) {
    logger.error('Error fetching positions', {
      tenantId: req.tenantId,
      error: err.message,
      userId: req.user.id
    });
    res.status(500).json({ 
      error: 'FETCH_POSITIONS_FAILED',
      message: 'Failed to fetch positions: ' + err.message 
    });
  }
});

// POST /api/staff/positions - Add new position
router.post('/positions', async (req, res) => {
  try {
    const { name, department, description, requiresPin } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({
        error: 'MISSING_POSITION_NAME',
        message: 'Position name is required'
      });
    }

    if (!department || !department.trim()) {
      return res.status(400).json({
        error: 'MISSING_DEPARTMENT',
        message: 'Department is required for position'
      });
    }

    const TenantStaff = req.getTenantModel('Staff');
    
    if (!TenantStaff) {
      return res.status(500).json({ 
        error: 'TENANT_MODEL_UNAVAILABLE',
        message: 'Staff model not available for this tenant' 
      });
    }

    const newPosition = await TenantStaff.addPosition(
      req.tenantId, 
      { 
        name: name.trim(), 
        department: department.trim(), 
        description: description?.trim() || '',
        requiresPin: requiresPin || false
      }, 
      req.user.username
    );

    logger.info('Position added', {
      tenantId: req.tenantId,
      positionName: newPosition.name,
      department: newPosition.department,
      addedBy: req.user.username
    });

    res.status(201).json({
      success: true,
      message: 'Position added successfully',
      position: {
        _id: newPosition._id,
        name: newPosition.name,
        department: newPosition.department,
        description: newPosition.description,
        requiresPin: newPosition.requiresPin,
        createdAt: newPosition.createdAt
      }
    });

  } catch (err) {
    logger.error('Error adding position', {
      tenantId: req.tenantId,
      error: err.message,
      userId: req.user.id
    });

    if (err.message === 'Department does not exist') {
      return res.status(400).json({
        error: 'INVALID_DEPARTMENT',
        message: 'The specified department does not exist'
      });
    }

    if (err.message === 'Position already exists in this department') {
      return res.status(409).json({
        error: 'POSITION_EXISTS',
        message: 'A position with this name already exists in this department'
      });
    }

    res.status(500).json({ 
      error: 'ADD_POSITION_FAILED',
      message: 'Failed to add position: ' + err.message 
    });
  }
});

// POST /api/staff/positions/cleanup - Remove duplicate positions and fix typos
router.post('/positions/cleanup', async (req, res) => {
  try {
    const TenantStaff = req.getTenantModel('Staff');

    if (!TenantStaff) {
      return res.status(500).json({
        error: 'TENANT_MODEL_UNAVAILABLE',
        message: 'Staff model not available for this tenant'
      });
    }

    const configRecord = await TenantStaff.findOne({
      tenantId: req.tenantId,
      employeeId: `CONFIG_${req.tenantId}`
    });

    if (!configRecord || !configRecord.tenantConfiguration) {
      return res.status(404).json({
        error: 'CONFIG_NOT_FOUND',
        message: 'No configuration found for this tenant'
      });
    }

    const positions = configRecord.tenantConfiguration.positions;
    const originalCount = positions.length;

    // Track unique positions and removed ones
    const seen = new Set();
    const removed = [];
    const renamed = [];

    // Filter positions, removing duplicates and fixing typos
    const cleanedPositions = positions.filter(pos => {
      // Fix "Chief Electrical Engineering" typo
      if (pos.name === 'Chief Electrical Engineering') {
        // Check if "Chief Electrical Engineer" already exists
        const correctExists = positions.some(p =>
          p.name === 'Chief Electrical Engineer' && p.department === pos.department && p !== pos
        );

        if (correctExists) {
          removed.push({ name: pos.name, department: pos.department, reason: 'duplicate with typo' });
          return false; // Remove this duplicate
        } else {
          // Rename it
          pos.name = 'Chief Electrical Engineer';
          renamed.push({ from: 'Chief Electrical Engineering', to: 'Chief Electrical Engineer', department: pos.department });
        }
      }

      // Remove duplicates (case-insensitive)
      const key = `${pos.name.toLowerCase()}_${pos.department.toLowerCase()}`;
      if (seen.has(key)) {
        removed.push({ name: pos.name, department: pos.department, reason: 'duplicate' });
        return false;
      }
      seen.add(key);
      return true;
    });

    // Update the config record
    configRecord.tenantConfiguration.positions = cleanedPositions;
    configRecord.tenantConfiguration.lastUpdated = new Date();
    configRecord.tenantConfiguration.updatedBy = req.user.username;

    await configRecord.save();

    logger.info('Position cleanup completed', {
      tenantId: req.tenantId,
      originalCount,
      finalCount: cleanedPositions.length,
      removed: removed.length,
      renamed: renamed.length,
      cleanedBy: req.user.username
    });

    res.json({
      success: true,
      message: `Cleanup completed. Removed ${removed.length} duplicates, renamed ${renamed.length} positions.`,
      summary: {
        originalCount,
        finalCount: cleanedPositions.length,
        removed,
        renamed
      }
    });

  } catch (err) {
    logger.error('Error cleaning up positions', {
      tenantId: req.tenantId,
      error: err.message,
      userId: req.user.id
    });
    res.status(500).json({
      error: 'CLEANUP_FAILED',
      message: 'Failed to cleanup positions: ' + err.message
    });
  }
});

// DELETE /api/staff/positions/:name/:department - Remove position
router.delete('/positions/:name/:department', async (req, res) => {
  try {
    const positionName = decodeURIComponent(req.params.name);
    const departmentName = decodeURIComponent(req.params.department);

    const TenantStaff = req.getTenantModel('Staff');
    
    if (!TenantStaff) {
      return res.status(500).json({ 
        error: 'TENANT_MODEL_UNAVAILABLE',
        message: 'Staff model not available for this tenant' 
      });
    }

    const result = await TenantStaff.removePosition(
      req.tenantId, 
      positionName, 
      departmentName,
      req.user.username
    );

    logger.info('Position removed', {
      tenantId: req.tenantId,
      positionName: positionName,
      department: departmentName,
      removedBy: req.user.username
    });

    res.json({
      success: true,
      message: result.message
    });

  } catch (err) {
    logger.error('Error removing position', {
      tenantId: req.tenantId,
      error: err.message,
      userId: req.user.id
    });

    if (err.message.includes('staff member(s) are assigned')) {
      return res.status(400).json({
        error: 'POSITION_IN_USE',
        message: err.message
      });
    }

    res.status(500).json({ 
      error: 'REMOVE_POSITION_FAILED',
      message: 'Failed to remove position: ' + err.message 
    });
  }
});

// ===========================================
// STAFF MANAGEMENT ENDPOINTS (UPDATED)
// ===========================================

// Get all staff members - UPDATED with tenant isolation
router.get('/', async (req, res) => {
  try {
    const TenantStaff = req.getTenantModel('Staff');
    
    if (!TenantStaff) {
      return res.status(500).json({ 
        error: 'TENANT_MODEL_UNAVAILABLE',
        message: 'Staff model not available for this tenant' 
      });
    }

    const staff = await TenantStaff.find({
      tenantId: req.tenantId,
      employeeId: { $not: /^CONFIG_/ }
    })
      .select('_id firstName lastName employeeId department position baseSalary bonuses employmentType dateOfEmployment status kioskAccess')
      .lean();
    
    logger.debug('Staff list fetched', {
      tenantId: req.tenantId,
      count: staff.length,
      userId: req.user.id
    });

    res.json({
      success: true,
      staff,
      count: staff.length
    });

  } catch (err) {
    logger.error('Error fetching staff', {
      tenantId: req.tenantId,
      error: err.message,
      userId: req.user.id
    });
    res.status(500).json({ 
      error: 'FETCH_STAFF_FAILED',
      message: 'Server error: ' + err.message 
    });
  }
});

// Get a single staff member - UPDATED with tenant isolation
router.get('/:id', async (req, res) => {
  try {
    const TenantStaff = req.getTenantModel('Staff');
    
    if (!TenantStaff) {
      return res.status(500).json({ 
        error: 'TENANT_MODEL_UNAVAILABLE',
        message: 'Staff model not available for this tenant' 
      });
    }

    const staff = await TenantStaff.findOne({
      _id: req.params.id,
      tenantId: req.tenantId,
      employeeId: { $not: /^CONFIG_/ }
    }).lean();
    
    if (!staff) {
      return res.status(404).json({ 
        error: 'STAFF_NOT_FOUND',
        message: 'Staff member not found' 
      });
    }

    logger.debug('Staff member fetched', {
      tenantId: req.tenantId,
      staffId: req.params.id,
      userId: req.user.id
    });

    res.json({
      success: true,
      staff
    });

  } catch (err) {
    logger.error('Error fetching staff member', {
      tenantId: req.tenantId,
      staffId: req.params.id,
      error: err.message,
      userId: req.user.id
    });
    res.status(500).json({ 
      error: 'FETCH_STAFF_FAILED',
      message: 'Server error: ' + err.message 
    });
  }
});

// Create a new staff member - UPDATED with manual employee code
router.post('/', async (req, res) => {
  try {
    const {
      employeeId,
      firstName,
      lastName,
      email,
      phoneNumber,
      department,
      position,
      dateOfEmployment,
      employmentType,
      workSchedule,
      subBusiness,
      bankDetails,
      baseSalary,
      bonuses,
      pin
    } = req.body;

    // UPDATED: Validate employee code (now required and manual)
    if (!employeeId) {
      return res.status(400).json({ 
        error: 'MISSING_EMPLOYEE_CODE',
        message: 'Employee code is required' 
      });
    }

    const empCodeValidation = validateEmployeeCode(employeeId);
    if (!empCodeValidation.valid) {
      return res.status(400).json({ 
        error: 'INVALID_EMPLOYEE_CODE',
        message: empCodeValidation.message 
      });
    }

    // Basic validation
    if (!firstName) {
      return res.status(400).json({ 
        error: 'MISSING_REQUIRED_FIELDS',
        message: 'First name is required' 
      });
    }

    // Validate email format if provided
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ 
        error: 'INVALID_EMAIL_FORMAT',
        message: 'Invalid email format' 
      });
    }

    // Validate phoneNumber format if provided
    if (phoneNumber && !/^\+?\d{10,15}$/.test(phoneNumber)) {
      return res.status(400).json({ 
        error: 'INVALID_PHONE_FORMAT',
        message: 'Invalid phone number format' 
      });
    }

    // Validate numeric fields
    if (baseSalary !== undefined && (isNaN(baseSalary) || baseSalary < 0)) {
      return res.status(400).json({ 
        error: 'INVALID_BASE_SALARY',
        message: 'Invalid baseSalary' 
      });
    }
    if (bonuses !== undefined && (isNaN(bonuses) || bonuses < 0)) {
      return res.status(400).json({ 
        error: 'INVALID_BONUSES',
        message: 'Invalid bonuses' 
      });
    }

    // Validate PIN if provided
    if (pin && !validatePin(pin)) {
      return res.status(400).json({ 
        error: 'INVALID_PIN',
        message: 'PIN must be 4-6 digits, not repetitive or sequential' 
      });
    }

    const TenantStaff = req.getTenantModel('Staff');
    const TenantUser = req.getTenantModel('User');

    if (!TenantStaff) {
      return res.status(500).json({ 
        error: 'TENANT_MODEL_UNAVAILABLE',
        message: 'Staff model not available for this tenant' 
      });
    }

    // UPDATED: Normalize employee code (pad with zeros if needed, but keep as-is)
    const normalizedEmployeeId = String(employeeId).trim().padStart(4, '0');

    // Check for duplicate employeeId within tenant
    const existingStaff = await TenantStaff.findOne({ 
      employeeId: normalizedEmployeeId,
      tenantId: req.tenantId 
    });
    
    if (existingStaff) {
      return res.status(400).json({ 
        error: 'EMPLOYEE_ID_EXISTS',
        message: `Employee code ${normalizedEmployeeId} is already assigned to ${existingStaff.firstName} ${existingStaff.lastName}` 
      });
    }

    // Create staff record
    // Store PIN only for staff with kioskAccess enabled
    const shouldStorePinInStaff = req.body.kioskAccess && pin;

    const staff = new TenantStaff({
      employeeId: normalizedEmployeeId,
      firstName,
      lastName: lastName || '',
      email,
      phoneNumber,
      department: department || '',
      position,
      dateOfEmployment,
      employmentType: employmentType || 'full-time',
      workSchedule: workSchedule || 'Mon-Sat 8:00-17:00',
      subBusiness: subBusiness || department || 'General',
      bankDetails: bankDetails || {},
      baseSalary: baseSalary || 0,
      bonuses: bonuses || 0,
      kioskAccess: req.body.kioskAccess || false, // FIX: Save kioskAccess to staff record
      pin: shouldStorePinInStaff ? await bcrypt.hash(pin, 10) : undefined, // Hash PIN before storing
      tenantId: req.tenantId
    });

    await staff.save();

    // Create User record only if kioskAccess is enabled with PIN
    const shouldCreateKioskUser = req.body.kioskAccess && pin;
    let kioskUserCreated = false;
    let kioskUserError = null;

    if (TenantUser && shouldCreateKioskUser) {
      try {
        // Check if user already exists with this employeeCode
        const existingUser = await TenantUser.findOne({
          employeeCode: normalizedEmployeeId,
          tenantId: req.tenantId
        });

        if (!existingUser) {
          const bcrypt = require('bcryptjs');
          const hashedPin = await bcrypt.hash(pin, 10);

          const user = new TenantUser({
            staffId: staff._id,
            username: `${firstName.toLowerCase()}.${lastName ? lastName.toLowerCase() : 'user'}.${normalizedEmployeeId}`,
            email: email || `${normalizedEmployeeId}@${req.tenant?.subdomain || 'staff'}.opsuite.io`,
            role: 'staff', // All kiosk users get 'staff' role
            confirmed: true,
            employeeCode: normalizedEmployeeId,
            accessType: 'kiosk_only',
            pin: hashedPin,
            status: 'active',
            tenantId: req.tenantId
          });
          await user.save();
          kioskUserCreated = true;

          // Link user to staff record
          staff.userId = user._id;
          await staff.save();

          logger.info('Kiosk user created for staff', {
            tenantId: req.tenantId,
            staffId: staff._id,
            employeeCode: normalizedEmployeeId,
            username: user.username,
            createdBy: req.user.username
          });
        } else {
          kioskUserCreated = true; // User already exists, consider it a success
        }
      } catch (userError) {
        kioskUserError = userError.message;
        logger.error('Failed to create kiosk user account', {
          tenantId: req.tenantId,
          staffId: staff._id,
          error: userError.message
        });
      }
    }

    logger.info('Staff member created', {
      tenantId: req.tenantId,
      staffId: staff._id,
      employeeId: normalizedEmployeeId,
      position,
      kioskUserCreated,
      createdBy: req.user.username
    });

    // Build response with kiosk status
    const response = {
      success: true,
      message: 'Staff member created successfully',
      staff: {
        _id: staff._id,
        employeeId: staff.employeeId,
        firstName: staff.firstName,
        lastName: staff.lastName,
        department: staff.department,
        position: staff.position,
        employmentType: staff.employmentType,
        kioskAccess: staff.kioskAccess,
        createdAt: staff.createdAt
      }
    };

    // Add kiosk user status to response
    if (shouldCreateKioskUser) {
      response.kioskUserCreated = kioskUserCreated;
      if (kioskUserError) {
        response.kioskUserError = kioskUserError;
        response.message = 'Staff member created but kiosk user account failed. Kiosk login will not work.';
      } else if (kioskUserCreated) {
        response.message = 'Staff member created successfully with kiosk access enabled.';
      }
    }

    res.status(201).json(response);

  } catch (err) {
    logger.error('Error creating staff member', {
      tenantId: req.tenantId,
      error: err.message,
      userId: req.user.id
    });

    if (err.code === 11000) {
      return res.status(409).json({
        error: 'DUPLICATE_EMPLOYEE_ID',
        message: 'Employee code already exists'
      });
    }

    res.status(500).json({ 
      error: 'CREATE_STAFF_FAILED',
      message: 'Server error: ' + err.message 
    });
  }
});

// Update a staff member - UPDATED with manual employee code validation
router.put('/:id', async (req, res) => {
  try {
    const {
      employeeId,
      firstName,
      lastName,
      email,
      phoneNumber,
      department,
      position,
      dateOfEmployment,
      employmentType,
      workSchedule,
      subBusiness,
      bankDetails,
      baseSalary,
      bonuses,
      pin
    } = req.body;

    const TenantStaff = req.getTenantModel('Staff');
    const TenantUser = req.getTenantModel('User');

    if (!TenantStaff) {
      return res.status(500).json({ 
        error: 'TENANT_MODEL_UNAVAILABLE',
        message: 'Staff model not available for this tenant' 
      });
    }

    // Find staff with proper tenant isolation
    const staff = await TenantStaff.findOne({
      _id: req.params.id,
      tenantId: req.tenantId,
      employeeId: { $not: /^CONFIG_/ }
    });
    
    if (!staff) {
      return res.status(404).json({ 
        error: 'STAFF_NOT_FOUND',
        message: 'Staff member not found' 
      });
    }

    // UPDATED: Validate and check employeeId if provided and different
    if (employeeId && employeeId !== staff.employeeId) {
      const empCodeValidation = validateEmployeeCode(employeeId);
      if (!empCodeValidation.valid) {
        return res.status(400).json({ 
          error: 'INVALID_EMPLOYEE_CODE',
          message: empCodeValidation.message 
        });
      }

      const normalizedEmployeeId = String(employeeId).trim().padStart(4, '0');
      
      const existingStaff = await TenantStaff.findOne({ 
        employeeId: normalizedEmployeeId, 
        tenantId: req.tenantId,
        _id: { $ne: req.params.id } 
      });
      if (existingStaff) {
        return res.status(400).json({ 
          error: 'EMPLOYEE_ID_IN_USE',
          message: `Employee code ${normalizedEmployeeId} is already assigned to ${existingStaff.firstName} ${existingStaff.lastName}` 
        });
      }
    }

    // Validate email format if provided
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ 
        error: 'INVALID_EMAIL_FORMAT',
        message: 'Invalid email format' 
      });
    }

    // Validate phoneNumber format if provided
    if (phoneNumber && !/^\+?\d{10,15}$/.test(phoneNumber)) {
      return res.status(400).json({ 
        error: 'INVALID_PHONE_FORMAT',
        message: 'Invalid phone number format' 
      });
    }

    // Validate numeric fields
    if (baseSalary !== undefined && (isNaN(baseSalary) || baseSalary < 0)) {
      return res.status(400).json({ 
        error: 'INVALID_BASE_SALARY',
        message: 'Invalid baseSalary' 
      });
    }
    if (bonuses !== undefined && (isNaN(bonuses) || bonuses < 0)) {
      return res.status(400).json({ 
        error: 'INVALID_BONUSES',
        message: 'Invalid bonuses' 
      });
    }

    // Validate PIN if provided
    if (pin && !validatePin(pin)) {
      return res.status(400).json({ 
        error: 'INVALID_PIN',
        message: 'PIN must be 4-6 digits, not repetitive or sequential' 
      });
    }

    // Update staff fields
    staff.employeeId = employeeId || staff.employeeId;
    staff.firstName = firstName || staff.firstName;
    staff.lastName = lastName !== undefined ? lastName : staff.lastName;
    staff.email = email || staff.email;
    staff.phoneNumber = phoneNumber || staff.phoneNumber;
    staff.department = department !== undefined ? department : staff.department;
    staff.position = position || staff.position;
    staff.dateOfEmployment = dateOfEmployment || staff.dateOfEmployment;
    staff.employmentType = employmentType || staff.employmentType;
    staff.workSchedule = workSchedule || staff.workSchedule;
    staff.subBusiness = subBusiness || staff.subBusiness;
    staff.bankDetails = bankDetails || staff.bankDetails;
    staff.baseSalary = baseSalary !== undefined ? baseSalary : staff.baseSalary;
    staff.bonuses = bonuses !== undefined ? bonuses : staff.bonuses;

    // Handle kioskAccess and PIN - only kioskAccess triggers kiosk user creation
    const kioskAccessValue = req.body.kioskAccess !== undefined ? req.body.kioskAccess : staff.kioskAccess;
    staff.kioskAccess = kioskAccessValue;

    // Store PIN only for kiosk-enabled staff (hashed)
    const shouldStorePinInStaff = kioskAccessValue && pin;
    if (shouldStorePinInStaff) {
      staff.pin = await bcrypt.hash(pin, 10);
    } else if (!kioskAccessValue) {
      staff.pin = undefined; // Clear PIN if kiosk access is disabled
    }

    await staff.save();

    // Update or create User document only for kioskAccess-enabled staff
    const shouldManageKioskUser = kioskAccessValue && pin;
    let kioskUserUpdated = false;
    let kioskUserError = null;

    if (TenantUser) {
      try {
        if (shouldManageKioskUser) {
          const bcrypt = require('bcryptjs');
          const hashedPin = await bcrypt.hash(pin, 10);

          let user = await TenantUser.findOne({
            staffId: staff._id,
            tenantId: req.tenantId
          });

          if (user) {
            // Update existing user
            user.username = `${staff.firstName.toLowerCase()}.${staff.lastName ? staff.lastName.toLowerCase() : 'user'}.${staff.employeeId}`;
            user.email = staff.email || `${staff.employeeId}@${req.tenant?.subdomain || 'staff'}.opsuite.io`;
            user.employeeCode = staff.employeeId;
            user.pin = hashedPin; // FIX: Hash the PIN before saving
            user.accessType = 'kiosk_only';
            user.status = 'active';
            await user.save();
            kioskUserUpdated = true;
          } else {
            // Create new user
            user = new TenantUser({
              staffId: staff._id,
              username: `${staff.firstName.toLowerCase()}.${staff.lastName ? staff.lastName.toLowerCase() : 'user'}.${staff.employeeId}`,
              email: staff.email || `${staff.employeeId}@${req.tenant?.subdomain || 'staff'}.opsuite.io`,
              role: 'staff', // All kiosk users get 'staff' role
              confirmed: true,
              employeeCode: staff.employeeId,
              accessType: 'kiosk_only',
              pin: hashedPin,
              status: 'active',
              tenantId: req.tenantId
            });
            await user.save();
            staff.userId = user._id;
            await staff.save();
            kioskUserUpdated = true;
          }
        } else if (!kioskAccessValue) {
          // Delete kiosk user if kioskAccess is disabled (per spec: turning off toggle should delete user)
          const result = await TenantUser.deleteOne(
            { staffId: staff._id, tenantId: req.tenantId, accessType: 'kiosk_only' }
          );
          if (result.deletedCount > 0) {
            staff.userId = undefined;
            await staff.save();
            kioskUserUpdated = true;
            logger.info('Kiosk user deleted due to kioskAccess disabled', {
              tenantId: req.tenantId,
              staffId: staff._id
            });
          }
        }
      } catch (userError) {
        kioskUserError = userError.message;
        logger.error('Failed to update kiosk user account', {
          tenantId: req.tenantId,
          staffId: staff._id,
          error: userError.message
        });
      }
    }

    logger.info('Staff member updated', {
      tenantId: req.tenantId,
      staffId: staff._id,
      kioskUserUpdated,
      updatedBy: req.user.username
    });

    // Build response with kiosk status
    const response = {
      success: true,
      message: 'Staff member updated successfully',
      staff: {
        _id: staff._id,
        employeeId: staff.employeeId,
        firstName: staff.firstName,
        lastName: staff.lastName,
        department: staff.department,
        position: staff.position,
        employmentType: staff.employmentType,
        kioskAccess: staff.kioskAccess,
        updatedAt: staff.updatedAt
      }
    };

    // Add kiosk user status to response
    if (shouldManageKioskUser) {
      response.kioskUserUpdated = kioskUserUpdated;
      if (kioskUserError) {
        response.kioskUserError = kioskUserError;
        response.message = 'Staff member updated but kiosk user account failed. Kiosk login may not work.';
      }
    }

    res.json(response);

  } catch (err) {
    logger.error('Error updating staff member', {
      tenantId: req.tenantId,
      staffId: req.params.id,
      error: err.message,
      userId: req.user.id
    });

    res.status(500).json({ 
      error: 'UPDATE_STAFF_FAILED',
      message: 'Server error: ' + err.message 
    });
  }
});

// Delete a staff member - UPDATED with enhanced tenant isolation
router.delete('/:id', async (req, res) => {
  try {
    const TenantStaff = req.getTenantModel('Staff');
    const TenantUser = req.getTenantModel('User');

    if (!TenantStaff) {
      return res.status(500).json({ 
        error: 'TENANT_MODEL_UNAVAILABLE',
        message: 'Staff model not available for this tenant' 
      });
    }

    // FIRST: Deactivate linked users
    try {
      await TenantStaff.deactivateLinkedUsers(req.params.id, req.tenantId);
    } catch (error) {
      console.error('Warning: Failed to deactivate linked users:', error.message);
      // Continue with deletion even if user deactivation fails
    }

    // THEN: Delete staff
    const staff = await TenantStaff.findOneAndDelete({
      _id: req.params.id,
      tenantId: req.tenantId,
      employeeId: { $not: /^CONFIG_/ }
    });

    if (!staff) {
      return res.status(404).json({
        error: 'STAFF_NOT_FOUND',
        message: 'Staff member not found'
      });
    }

    logger.info('Staff member deleted', {
      tenantId: req.tenantId,
      staffId: staff._id,
      employeeId: staff.employeeId,
      deletedBy: req.user.username
    });

    res.json({ 
      success: true,
      message: 'Staff member deleted successfully' 
    });

  } catch (err) {
    logger.error('Error deleting staff member', {
      tenantId: req.tenantId,
      staffId: req.params.id,
      error: err.message,
      userId: req.user.id
    });

    res.status(500).json({
      error: 'DELETE_STAFF_FAILED',
      message: 'Server error: ' + err.message
    });
  }
});

// ============================================
// STAFF SALES & COMMISSION ENDPOINTS
// ============================================

// Get staff sales report with commission calculations
router.get('/:id/sales-report', async (req, res) => {
  try {
    const TenantStaff = req.getTenantModel('Staff');
    const POSTransaction = req.getTenantModel('POSTransaction');

    if (!TenantStaff || !POSTransaction) {
      return res.status(500).json({
        error: 'MODELS_UNAVAILABLE',
        message: 'Required models not available'
      });
    }

    // Get staff member
    const staff = await TenantStaff.findOne({
      _id: req.params.id,
      tenantId: req.tenantId
    });

    if (!staff) {
      return res.status(404).json({
        error: 'STAFF_NOT_FOUND',
        message: 'Staff member not found'
      });
    }

    // Parse date range from query
    const { startDate, endDate, period } = req.query;
    let dateFilter = {};

    const now = new Date();
    if (period === 'today') {
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      dateFilter = { createdAt: { $gte: todayStart } };
    } else if (period === 'week') {
      const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      dateFilter = { createdAt: { $gte: weekStart } };
    } else if (period === 'month') {
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      dateFilter = { createdAt: { $gte: monthStart } };
    } else if (period === 'year') {
      const yearStart = new Date(now.getFullYear(), 0, 1);
      dateFilter = { createdAt: { $gte: yearStart } };
    } else if (startDate && endDate) {
      dateFilter = {
        createdAt: {
          $gte: new Date(startDate),
          $lte: new Date(endDate)
        }
      };
    }

    // Get all sales for this staff member
    const sales = await POSTransaction.find({
      tenantId: req.tenantId,
      staffId: staff._id,
      status: 'completed',
      ...dateFilter
    }).sort({ createdAt: -1 });

    // Calculate totals
    const totalSales = sales.reduce((sum, sale) => sum + sale.totalAmount, 0);
    const totalTransactions = sales.length;
    const totalCommission = sales.reduce((sum, sale) => sum + (sale.commissionAmount || 0), 0);
    const unpaidCommission = sales.filter(s => !s.commissionPaid).reduce((sum, sale) => sum + (sale.commissionAmount || 0), 0);
    const paidCommission = totalCommission - unpaidCommission;

    // Calculate averages
    const averageSale = totalTransactions > 0 ? totalSales / totalTransactions : 0;

    // Calculate commission based on staff's current settings if not already set on transactions
    let projectedCommission = 0;
    if (staff.commission?.enabled) {
      if (staff.commission.type === 'percentage') {
        projectedCommission = totalSales * (staff.commission.rate / 100);
      } else if (staff.commission.type === 'fixed_per_sale') {
        projectedCommission = totalTransactions * staff.commission.fixedAmount;
      }
    }

    // Get sales by category/department breakdown
    const salesByCategory = {};
    const salesByPaymentMethod = {};
    sales.forEach(sale => {
      // Category breakdown
      if (!salesByCategory[sale.category]) {
        salesByCategory[sale.category] = { count: 0, total: 0 };
      }
      salesByCategory[sale.category].count++;
      salesByCategory[sale.category].total += sale.totalAmount;

      // Payment method breakdown
      if (!salesByPaymentMethod[sale.paymentMethod]) {
        salesByPaymentMethod[sale.paymentMethod] = { count: 0, total: 0 };
      }
      salesByPaymentMethod[sale.paymentMethod].count++;
      salesByPaymentMethod[sale.paymentMethod].total += sale.totalAmount;
    });

    // Monthly target progress
    let targetProgress = 0;
    if (staff.commission?.monthlyTarget > 0) {
      // Get this month's sales
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const monthSales = await POSTransaction.find({
        tenantId: req.tenantId,
        staffId: staff._id,
        status: 'completed',
        createdAt: { $gte: monthStart }
      });
      const monthTotal = monthSales.reduce((sum, s) => sum + s.totalAmount, 0);
      targetProgress = (monthTotal / staff.commission.monthlyTarget) * 100;
    }

    res.json({
      success: true,
      staff: {
        _id: staff._id,
        name: `${staff.firstName} ${staff.lastName}`,
        employeeId: staff.employeeId,
        department: staff.department,
        commissionSettings: staff.commission || { enabled: false }
      },
      period: period || 'custom',
      dateRange: dateFilter.createdAt || null,
      summary: {
        totalSales,
        totalTransactions,
        averageSale: Math.round(averageSale * 100) / 100,
        totalCommission: Math.round(totalCommission * 100) / 100,
        unpaidCommission: Math.round(unpaidCommission * 100) / 100,
        paidCommission: Math.round(paidCommission * 100) / 100,
        projectedCommission: Math.round(projectedCommission * 100) / 100,
        targetProgress: Math.round(targetProgress * 100) / 100
      },
      breakdown: {
        byCategory: salesByCategory,
        byPaymentMethod: salesByPaymentMethod
      },
      recentSales: sales.slice(0, 20).map(s => ({
        _id: s._id,
        date: s.createdAt,
        totalAmount: s.totalAmount,
        items: s.items.length,
        paymentMethod: s.paymentMethod,
        commissionAmount: s.commissionAmount,
        commissionPaid: s.commissionPaid
      }))
    });

  } catch (err) {
    logger.error('Error getting staff sales report', {
      tenantId: req.tenantId,
      staffId: req.params.id,
      error: err.message
    });
    res.status(500).json({
      error: 'SALES_REPORT_FAILED',
      message: 'Server error: ' + err.message
    });
  }
});

// Get all staff sales summary (leaderboard)
router.get('/sales/summary', async (req, res) => {
  try {
    const TenantStaff = req.getTenantModel('Staff');
    const POSTransaction = req.getTenantModel('POSTransaction');

    if (!TenantStaff || !POSTransaction) {
      return res.status(500).json({
        error: 'MODELS_UNAVAILABLE',
        message: 'Required models not available'
      });
    }

    // Parse date range
    const { period } = req.query;
    let dateFilter = {};
    const now = new Date();

    if (period === 'today') {
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      dateFilter = { createdAt: { $gte: todayStart } };
    } else if (period === 'week') {
      const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      dateFilter = { createdAt: { $gte: weekStart } };
    } else if (period === 'month') {
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      dateFilter = { createdAt: { $gte: monthStart } };
    } else {
      // Default to current month
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      dateFilter = { createdAt: { $gte: monthStart } };
    }

    // Aggregate sales by staff
    const salesByStaff = await POSTransaction.aggregate([
      {
        $match: {
          tenantId: req.tenantId,
          status: 'completed',
          staffId: { $ne: null },
          ...dateFilter
        }
      },
      {
        $group: {
          _id: '$staffId',
          totalSales: { $sum: '$totalAmount' },
          totalTransactions: { $sum: 1 },
          totalCommission: { $sum: { $ifNull: ['$commissionAmount', 0] } },
          averageSale: { $avg: '$totalAmount' }
        }
      },
      {
        $sort: { totalSales: -1 }
      }
    ]);

    // Get staff details
    const staffIds = salesByStaff.map(s => s._id);
    const staffList = await TenantStaff.find({
      _id: { $in: staffIds },
      tenantId: req.tenantId
    }).select('firstName lastName employeeId department commission');

    const staffMap = {};
    staffList.forEach(s => {
      staffMap[s._id.toString()] = s;
    });

    // Combine data
    const leaderboard = salesByStaff.map((sale, index) => {
      const staff = staffMap[sale._id.toString()] || {};
      return {
        rank: index + 1,
        staffId: sale._id,
        name: `${staff.firstName || ''} ${staff.lastName || ''}`.trim() || 'Unknown',
        employeeId: staff.employeeId || 'N/A',
        department: staff.department || 'N/A',
        totalSales: sale.totalSales,
        totalTransactions: sale.totalTransactions,
        averageSale: Math.round(sale.averageSale * 100) / 100,
        totalCommission: Math.round(sale.totalCommission * 100) / 100,
        commissionEnabled: staff.commission?.enabled || false,
        commissionRate: staff.commission?.rate || 0
      };
    });

    // Calculate totals
    const grandTotalSales = leaderboard.reduce((sum, s) => sum + s.totalSales, 0);
    const grandTotalTransactions = leaderboard.reduce((sum, s) => sum + s.totalTransactions, 0);
    const grandTotalCommission = leaderboard.reduce((sum, s) => sum + s.totalCommission, 0);

    res.json({
      success: true,
      period: period || 'month',
      dateRange: dateFilter.createdAt || null,
      totals: {
        sales: grandTotalSales,
        transactions: grandTotalTransactions,
        commission: Math.round(grandTotalCommission * 100) / 100,
        staffWithSales: leaderboard.length
      },
      leaderboard
    });

  } catch (err) {
    logger.error('Error getting staff sales summary', {
      tenantId: req.tenantId,
      error: err.message
    });
    res.status(500).json({
      error: 'SALES_SUMMARY_FAILED',
      message: 'Server error: ' + err.message
    });
  }
});

// Update staff commission settings
router.put('/:id/commission', async (req, res) => {
  try {
    const TenantStaff = req.getTenantModel('Staff');

    if (!TenantStaff) {
      return res.status(500).json({
        error: 'MODEL_UNAVAILABLE',
        message: 'Staff model not available'
      });
    }

    const { enabled, rate, type, fixedAmount, monthlyTarget, targetBonusRate, tiers, notes } = req.body;

    const staff = await TenantStaff.findOneAndUpdate(
      {
        _id: req.params.id,
        tenantId: req.tenantId
      },
      {
        $set: {
          'commission.enabled': enabled !== undefined ? enabled : false,
          'commission.rate': rate || 0,
          'commission.type': type || 'percentage',
          'commission.fixedAmount': fixedAmount || 0,
          'commission.monthlyTarget': monthlyTarget || 0,
          'commission.targetBonusRate': targetBonusRate || 0,
          'commission.tiers': tiers || [],
          'commission.notes': notes || '',
          'commission.lastUpdated': new Date(),
          'commission.updatedBy': req.user?.username || 'system'
        }
      },
      { new: true }
    );

    if (!staff) {
      return res.status(404).json({
        error: 'STAFF_NOT_FOUND',
        message: 'Staff member not found'
      });
    }

    logger.info('Staff commission updated', {
      tenantId: req.tenantId,
      staffId: staff._id,
      commissionEnabled: enabled,
      commissionRate: rate
    });

    res.json({
      success: true,
      message: 'Commission settings updated',
      commission: staff.commission
    });

  } catch (err) {
    logger.error('Error updating staff commission', {
      tenantId: req.tenantId,
      staffId: req.params.id,
      error: err.message
    });
    res.status(500).json({
      error: 'UPDATE_COMMISSION_FAILED',
      message: 'Server error: ' + err.message
    });
  }
});

// Mark commissions as paid for a staff member
router.post('/:id/commission/pay', async (req, res) => {
  try {
    const POSTransaction = req.getTenantModel('POSTransaction');

    if (!POSTransaction) {
      return res.status(500).json({
        error: 'MODEL_UNAVAILABLE',
        message: 'POSTransaction model not available'
      });
    }

    const { transactionIds } = req.body;
    const now = new Date();

    // If specific transactions provided, mark those
    // Otherwise mark all unpaid for this staff
    let updateQuery = {
      tenantId: req.tenantId,
      staffId: req.params.id,
      status: 'completed',
      commissionPaid: false
    };

    if (transactionIds && transactionIds.length > 0) {
      updateQuery._id = { $in: transactionIds };
    }

    const result = await POSTransaction.updateMany(
      updateQuery,
      {
        $set: {
          commissionPaid: true,
          commissionPaidAt: now
        }
      }
    );

    logger.info('Commission payments marked', {
      tenantId: req.tenantId,
      staffId: req.params.id,
      transactionsUpdated: result.modifiedCount
    });

    res.json({
      success: true,
      message: `${result.modifiedCount} transaction(s) marked as commission paid`,
      modifiedCount: result.modifiedCount
    });

  } catch (err) {
    logger.error('Error marking commission paid', {
      tenantId: req.tenantId,
      staffId: req.params.id,
      error: err.message
    });
    res.status(500).json({
      error: 'PAY_COMMISSION_FAILED',
      message: 'Server error: ' + err.message
    });
  }
});

module.exports = router;