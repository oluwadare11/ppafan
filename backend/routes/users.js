// routes/users.js - User Management Routes
const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { requireAuthentication } = require('../middleware/cookieAuth');
const { identifyTenant, addTenantHelpers, requireActiveTenant } = require('../middleware/tenant');
const logger = require('../utils/logger');

// COMPLETE MIDDLEWARE STACK FOR ALL ROUTES
router.use(identifyTenant);
router.use(addTenantHelpers);
router.use(requireActiveTenant);
router.use(requireAuthentication);

// Validation helpers
const validatePassword = (password) => {
  if (!password || password.length < 8) return 'Password must be at least 8 characters';
  if (!/[A-Z]/.test(password)) return 'Password must contain at least one uppercase letter';
  if (!/[a-z]/.test(password)) return 'Password must contain at least one lowercase letter';
  if (!/[0-9]/.test(password)) return 'Password must contain at least one number';
  return null;
};

const validatePin = (pin) => {
  if (!pin) return 'PIN is required';
  if (!/^\d{4,6}$/.test(pin)) return 'PIN must be 4-6 digits';
  if (/^(\d)\1+$/.test(pin)) return 'PIN cannot be repetitive (e.g., 1111)';
  if (/^(?:0123|1234|2345|3456|4567|5678|6789|9876|8765|7654|6543|5432|4321|3210)$/.test(pin)) {
    return 'PIN cannot be sequential';
  }
  return null;
};

/**
 * GET /api/users - List all users
 */
router.get('/', async (req, res) => {
  try {
    const TenantUser = req.getTenantModel('User');

    if (!TenantUser) {
      return res.status(500).json({
        error: 'TENANT_MODEL_UNAVAILABLE',
        message: 'User model not available for this tenant'
      });
    }

    const { role, accessType, status } = req.query;
    const filters = {};

    if (role) filters.role = role;
    if (accessType) filters.accessType = accessType;
    if (status) filters.status = status;

    const users = await TenantUser.findByTenant(req.tenantId, filters);

    logger.debug('Users list fetched', {
      tenantId: req.tenantId,
      count: users.length,
      filters,
      requestedBy: req.user.username
    });

    res.json({
      success: true,
      users: users.map(u => u.toSafeObject()),
      count: users.length
    });

  } catch (err) {
    logger.error('Error fetching users', {
      tenantId: req.tenantId,
      error: err.message,
      requestedBy: req.user.username
    });
    res.status(500).json({
      error: 'FETCH_USERS_FAILED',
      message: 'Failed to fetch users: ' + err.message
    });
  }
});

/**
 * POST /api/users - Create new user
 */
router.post('/', async (req, res) => {
  try {
    const {
      firstName,
      lastName,
      username,
      email,
      phone,
      password,
      pin,
      employeeCode,
      role,
      accessType,
      staffId,
      permissions
    } = req.body;

    // Validation
    if (!firstName || !lastName || !username || !email || !role || !accessType) {
      return res.status(400).json({
        error: 'MISSING_REQUIRED_FIELDS',
        message: 'Required fields: firstName, lastName, username, email, role, accessType'
      });
    }

    // Validate access type requirements
    if ((accessType === 'admin_only' || accessType === 'both') && !password) {
      return res.status(400).json({
        error: 'PASSWORD_REQUIRED',
        message: 'Password is required for admin access'
      });
    }

    if ((accessType === 'kiosk_only' || accessType === 'both') && !pin) {
      return res.status(400).json({
        error: 'PIN_REQUIRED',
        message: 'PIN is required for kiosk access'
      });
    }

    // Validate password strength
    if (password) {
      const passwordError = validatePassword(password);
      if (passwordError) {
        return res.status(400).json({
          error: 'INVALID_PASSWORD',
          message: passwordError
        });
      }
    }

    // Validate PIN format
    if (pin) {
      const pinError = validatePin(pin);
      if (pinError) {
        return res.status(400).json({
          error: 'INVALID_PIN',
          message: pinError
        });
      }
    }

    const TenantUser = req.getTenantModel('User');
    const TenantStaff = req.getTenantModel('Staff');

    if (!TenantUser) {
      return res.status(500).json({
        error: 'TENANT_MODEL_UNAVAILABLE',
        message: 'User model not available for this tenant'
      });
    }

    // ADMIN USER LIMIT: Max 5 admin users (admin + custom roles)
    const MAX_ADMIN_USERS = 5;
    if (role === 'admin' || role === 'custom') {
      const adminCount = await TenantUser.countDocuments({
        tenantId: req.tenantId,
        role: { $in: ['admin', 'custom'] },
        status: { $ne: 'inactive' } // Don't count inactive users
      });

      if (adminCount >= MAX_ADMIN_USERS) {
        return res.status(403).json({
          error: 'ADMIN_LIMIT_REACHED',
          message: `Maximum ${MAX_ADMIN_USERS} admin users allowed. Current: ${adminCount}. Delete or deactivate an admin to add a new one.`
        });
      }
    }

    // Check username uniqueness
    const existingUser = await TenantUser.findOne({
      tenantId: req.tenantId,
      username: username.toLowerCase()
    });

    if (existingUser) {
      return res.status(409).json({
        error: 'USERNAME_EXISTS',
        message: 'Username already exists'
      });
    }

    // Check email uniqueness
    const existingEmail = await TenantUser.findOne({
      tenantId: req.tenantId,
      email: email.toLowerCase()
    });

    if (existingEmail) {
      return res.status(409).json({
        error: 'EMAIL_EXISTS',
        message: 'Email already exists'
      });
    }

    // If staffId provided, verify it exists and belongs to tenant
    if (staffId && TenantStaff) {
      const staff = await TenantStaff.findOne({
        _id: staffId,
        tenantId: req.tenantId
      });

      if (!staff) {
        return res.status(400).json({
          error: 'INVALID_STAFF_ID',
          message: 'Staff member not found'
        });
      }

      // Check if staff is already linked to another user
      const linkedUser = await TenantUser.findOne({
        tenantId: req.tenantId,
        staffId: staffId
      });

      if (linkedUser) {
        return res.status(400).json({
          error: 'STAFF_ALREADY_LINKED',
          message: 'This staff member is already linked to another user'
        });
      }
    }

    // Create user object
    const userData = {
      firstName,
      lastName,
      username: username.toLowerCase(),
      email: email.toLowerCase(),
      phone,
      role,
      accessType,
      staffId: staffId || null,
      status: 'active',
      confirmed: true,
      tenantId: req.tenantId,
      createdBy: req.user.username,
      // Add permissions for custom role
      permissions: role === 'custom' ? permissions : {}
    };

    // Hash password if provided
    if (password) {
      userData.password = await bcrypt.hash(password, 10);
    }

    // Hash PIN if provided
    if (pin) {
      userData.pin = await bcrypt.hash(pin.toString(), 10);
    }

    // Set employee code if provided or auto-generate for kiosk users
    if (employeeCode) {
      // Check if employee code is unique
      const existingCode = await TenantUser.findOne({
        tenantId: req.tenantId,
        employeeCode: employeeCode
      });

      if (existingCode) {
        return res.status(409).json({
          error: 'EMPLOYEE_CODE_EXISTS',
          message: 'Employee code already exists'
        });
      }

      userData.employeeCode = employeeCode;
    }

    const user = new TenantUser(userData);
    await user.save();

    logger.info('User created', {
      tenantId: req.tenantId,
      userId: user._id,
      username: user.username,
      role: user.role,
      accessType: user.accessType,
      createdBy: req.user.username
    });

    res.status(201).json({
      success: true,
      message: 'User created successfully',
      user: user.toSafeObject()
    });

  } catch (err) {
    logger.error('Error creating user', {
      tenantId: req.tenantId,
      error: err.message,
      requestedBy: req.user.username
    });

    if (err.code === 11000) {
      return res.status(409).json({
        error: 'DUPLICATE_USER',
        message: 'A user with this username or email already exists'
      });
    }

    res.status(500).json({
      error: 'CREATE_USER_FAILED',
      message: 'Failed to create user: ' + err.message
    });
  }
});

/**
 * GET /api/users/:id - Get single user
 */
router.get('/:id', async (req, res) => {
  try {
    const TenantUser = req.getTenantModel('User');

    if (!TenantUser) {
      return res.status(500).json({
        error: 'TENANT_MODEL_UNAVAILABLE',
        message: 'User model not available for this tenant'
      });
    }

    const user = await TenantUser.findOne({
      _id: req.params.id,
      tenantId: req.tenantId
    }).populate('staffId', 'employeeId firstName lastName department position');

    if (!user) {
      return res.status(404).json({
        error: 'USER_NOT_FOUND',
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      user: user.toSafeObject()
    });

  } catch (err) {
    logger.error('Error fetching user', {
      tenantId: req.tenantId,
      userId: req.params.id,
      error: err.message,
      requestedBy: req.user.username
    });
    res.status(500).json({
      error: 'FETCH_USER_FAILED',
      message: 'Failed to fetch user: ' + err.message
    });
  }
});

/**
 * PUT /api/users/:id - Update user
 */
router.put('/:id', async (req, res) => {
  try {
    const {
      firstName,
      lastName,
      email,
      phone,
      role,
      accessType,
      status,
      staffId
    } = req.body;

    const TenantUser = req.getTenantModel('User');
    const TenantStaff = req.getTenantModel('Staff');

    if (!TenantUser) {
      return res.status(500).json({
        error: 'TENANT_MODEL_UNAVAILABLE',
        message: 'User model not available for this tenant'
      });
    }

    const user = await TenantUser.findOne({
      _id: req.params.id,
      tenantId: req.tenantId
    }).select('+password +pin');

    if (!user) {
      return res.status(404).json({
        error: 'USER_NOT_FOUND',
        message: 'User not found'
      });
    }

    // Check email uniqueness if changed
    if (email && email.toLowerCase() !== user.email) {
      const existingEmail = await TenantUser.findOne({
        tenantId: req.tenantId,
        email: email.toLowerCase(),
        _id: { $ne: user._id }
      });

      if (existingEmail) {
        return res.status(409).json({
          error: 'EMAIL_EXISTS',
          message: 'Email already exists'
        });
      }
    }

    // If staffId changed, verify it exists and isn't linked to another user
    if (staffId !== undefined && staffId !== user.staffId?.toString()) {
      if (staffId && TenantStaff) {
        const staff = await TenantStaff.findOne({
          _id: staffId,
          tenantId: req.tenantId
        });

        if (!staff) {
          return res.status(400).json({
            error: 'INVALID_STAFF_ID',
            message: 'Staff member not found'
          });
        }

        const linkedUser = await TenantUser.findOne({
          tenantId: req.tenantId,
          staffId: staffId,
          _id: { $ne: user._id }
        });

        if (linkedUser) {
          return res.status(400).json({
            error: 'STAFF_ALREADY_LINKED',
            message: 'This staff member is already linked to another user'
          });
        }
      }

      user.staffId = staffId || null;
    }

    // Update fields
    if (firstName) user.firstName = firstName;
    if (lastName) user.lastName = lastName;
    if (email) user.email = email.toLowerCase();
    if (phone !== undefined) user.phone = phone;
    if (role) user.role = role;
    if (accessType) user.accessType = accessType;
    if (status) user.status = status;
    user.updatedBy = req.user.username;

    await user.save();

    logger.info('User updated', {
      tenantId: req.tenantId,
      userId: user._id,
      updatedBy: req.user.username
    });

    res.json({
      success: true,
      message: 'User updated successfully',
      user: user.toSafeObject()
    });

  } catch (err) {
    logger.error('Error updating user', {
      tenantId: req.tenantId,
      userId: req.params.id,
      error: err.message,
      requestedBy: req.user.username
    });
    res.status(500).json({
      error: 'UPDATE_USER_FAILED',
      message: 'Failed to update user: ' + err.message
    });
  }
});

/**
 * DELETE /api/users/:id - Delete user
 */
router.delete('/:id', async (req, res) => {
  try {
    const TenantUser = req.getTenantModel('User');

    if (!TenantUser) {
      return res.status(500).json({
        error: 'TENANT_MODEL_UNAVAILABLE',
        message: 'User model not available for this tenant'
      });
    }

    // Prevent deleting yourself
    if (req.params.id === req.user.id) {
      return res.status(400).json({
        error: 'CANNOT_DELETE_SELF',
        message: 'You cannot delete your own account'
      });
    }

    const user = await TenantUser.findOneAndDelete({
      _id: req.params.id,
      tenantId: req.tenantId
    });

    if (!user) {
      return res.status(404).json({
        error: 'USER_NOT_FOUND',
        message: 'User not found'
      });
    }

    logger.info('User deleted', {
      tenantId: req.tenantId,
      userId: user._id,
      username: user.username,
      deletedBy: req.user.username
    });

    res.json({
      success: true,
      message: 'User deleted successfully'
    });

  } catch (err) {
    logger.error('Error deleting user', {
      tenantId: req.tenantId,
      userId: req.params.id,
      error: err.message,
      requestedBy: req.user.username
    });
    res.status(500).json({
      error: 'DELETE_USER_FAILED',
      message: 'Failed to delete user: ' + err.message
    });
  }
});

/**
 * PUT /api/users/:id/reset-password - Reset password
 */
router.put('/:id/reset-password', async (req, res) => {
  try {
    const { newPassword } = req.body;

    if (!newPassword) {
      return res.status(400).json({
        error: 'NEW_PASSWORD_REQUIRED',
        message: 'New password is required'
      });
    }

    const passwordError = validatePassword(newPassword);
    if (passwordError) {
      return res.status(400).json({
        error: 'INVALID_PASSWORD',
        message: passwordError
      });
    }

    const TenantUser = req.getTenantModel('User');

    if (!TenantUser) {
      return res.status(500).json({
        error: 'TENANT_MODEL_UNAVAILABLE',
        message: 'User model not available for this tenant'
      });
    }

    const user = await TenantUser.findOne({
      _id: req.params.id,
      tenantId: req.tenantId
    }).select('+password');

    if (!user) {
      return res.status(404).json({
        error: 'USER_NOT_FOUND',
        message: 'User not found'
      });
    }

    if (user.accessType === 'kiosk_only') {
      return res.status(400).json({
        error: 'NO_PASSWORD_ACCESS',
        message: 'This user only has kiosk access and does not use a password'
      });
    }

    user.password = await bcrypt.hash(newPassword, 10);
    user.updatedBy = req.user.username;
    await user.save();

    logger.info('User password reset', {
      tenantId: req.tenantId,
      userId: user._id,
      resetBy: req.user.username
    });

    res.json({
      success: true,
      message: 'Password reset successfully'
    });

  } catch (err) {
    logger.error('Error resetting password', {
      tenantId: req.tenantId,
      userId: req.params.id,
      error: err.message,
      requestedBy: req.user.username
    });
    res.status(500).json({
      error: 'RESET_PASSWORD_FAILED',
      message: 'Failed to reset password: ' + err.message
    });
  }
});

/**
 * PUT /api/users/:id/reset-pin - Reset PIN
 */
router.put('/:id/reset-pin', async (req, res) => {
  try {
    const { newPin } = req.body;

    if (!newPin) {
      return res.status(400).json({
        error: 'NEW_PIN_REQUIRED',
        message: 'New PIN is required'
      });
    }

    const pinError = validatePin(newPin);
    if (pinError) {
      return res.status(400).json({
        error: 'INVALID_PIN',
        message: pinError
      });
    }

    const TenantUser = req.getTenantModel('User');

    if (!TenantUser) {
      return res.status(500).json({
        error: 'TENANT_MODEL_UNAVAILABLE',
        message: 'User model not available for this tenant'
      });
    }

    const user = await TenantUser.findOne({
      _id: req.params.id,
      tenantId: req.tenantId
    }).select('+pin');

    if (!user) {
      return res.status(404).json({
        error: 'USER_NOT_FOUND',
        message: 'User not found'
      });
    }

    if (user.accessType === 'admin_only') {
      return res.status(400).json({
        error: 'NO_KIOSK_ACCESS',
        message: 'This user only has admin access and does not use a PIN'
      });
    }

    user.pin = await bcrypt.hash(newPin.toString(), 10);
    user.updatedBy = req.user.username;
    await user.save();

    // SYNC: If user has a linked staff record, update their PIN too
    let staffSynced = false;
    if (user.staffId) {
      const TenantStaff = req.getTenantModel('Staff');
      if (TenantStaff) {
        const staff = await TenantStaff.findOne({
          _id: user.staffId,
          tenantId: req.tenantId
        });
        if (staff) {
          staff.pin = newPin; // Store unhashed for staff (will be hashed on save if needed)
          await staff.save();
          staffSynced = true;
          logger.info('Staff PIN synced from User reset', {
            tenantId: req.tenantId,
            staffId: staff._id,
            userId: user._id
          });
        }
      }
    }

    logger.info('User PIN reset', {
      tenantId: req.tenantId,
      userId: user._id,
      resetBy: req.user.username,
      staffSynced
    });

    res.json({
      success: true,
      message: staffSynced ? 'PIN reset and synced to staff record' : 'PIN reset successfully'
    });

  } catch (err) {
    logger.error('Error resetting PIN', {
      tenantId: req.tenantId,
      userId: req.params.id,
      error: err.message,
      requestedBy: req.user.username
    });
    res.status(500).json({
      error: 'RESET_PIN_FAILED',
      message: 'Failed to reset PIN: ' + err.message
    });
  }
});

/**
 * GET /api/users/staff/available - Get staff members not linked to users
 */
router.get('/staff/available', async (req, res) => {
  try {
    const TenantStaff = req.getTenantModel('Staff');
    const TenantUser = req.getTenantModel('User');

    if (!TenantStaff || !TenantUser) {
      return res.status(500).json({
        error: 'TENANT_MODEL_UNAVAILABLE',
        message: 'Required models not available for this tenant'
      });
    }

    // Get all active staff
    const allStaff = await TenantStaff.find({
      tenantId: req.tenantId,
      status: 'active',
      employeeId: { $not: /^CONFIG_/ }
    }).select('_id employeeId firstName lastName department position email phoneNumber');

    // Get all linked staff IDs
    const linkedStaff = await TenantUser.find({
      tenantId: req.tenantId,
      staffId: { $ne: null }
    }).distinct('staffId');

    // Filter out linked staff
    const availableStaff = allStaff.filter(staff =>
      !linkedStaff.some(linkedId => linkedId.toString() === staff._id.toString())
    );

    res.json({
      success: true,
      staff: availableStaff,
      count: availableStaff.length
    });

  } catch (err) {
    logger.error('Error fetching available staff', {
      tenantId: req.tenantId,
      error: err.message,
      requestedBy: req.user.username
    });
    res.status(500).json({
      error: 'FETCH_STAFF_FAILED',
      message: 'Failed to fetch available staff: ' + err.message
    });
  }
});

/**
 * POST /api/users/generate-employee-code - Generate unique employee code
 */
router.post('/generate-employee-code', async (req, res) => {
  try {
    const TenantUser = req.getTenantModel('User');

    if (!TenantUser) {
      return res.status(500).json({
        error: 'TENANT_MODEL_UNAVAILABLE',
        message: 'User model not available for this tenant'
      });
    }

    // Generate unique 4-digit code
    let code;
    let attempts = 0;
    const maxAttempts = 100;

    while (attempts < maxAttempts) {
      code = Math.floor(1000 + Math.random() * 9000).toString();
      const isAvailable = await TenantUser.isEmployeeCodeAvailable(req.tenantId, code);
      if (isAvailable) {
        break;
      }
      attempts++;
    }

    if (attempts >= maxAttempts) {
      return res.status(500).json({
        error: 'CODE_GENERATION_FAILED',
        message: 'Failed to generate unique employee code'
      });
    }

    res.json({
      success: true,
      employeeCode: code
    });

  } catch (err) {
    logger.error('Error generating employee code', {
      tenantId: req.tenantId,
      error: err.message,
      requestedBy: req.user.username
    });
    res.status(500).json({
      error: 'GENERATE_CODE_FAILED',
      message: 'Failed to generate employee code: ' + err.message
    });
  }
});

module.exports = router;
