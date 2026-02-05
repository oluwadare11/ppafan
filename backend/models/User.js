// models/User.js - Authentication & User Management Model
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  // Basic Information - MADE OPTIONAL FOR ADMIN USERS
  firstName: {
    type: String,
    required: false, // ✅ CHANGED FROM true TO false
    trim: true,
    maxlength: 50
  },
  lastName: {
    type: String,
    required: false, // ✅ CHANGED FROM true TO false
    trim: true,
    maxlength: 50
  },

  // Authentication Credentials
  username: {
    type: String,
    required: true,
    trim: true,
    lowercase: true,
    minlength: 2, // Allow short usernames like "md"
    maxlength: 50
  },
  email: {
    type: String,
    required: true,
    trim: true,
    lowercase: true
  },

  // Dual Authentication: Password (admin app) + PIN (kiosk app)
  password: {
    type: String, // Hashed - for admin app login
    select: false // Don't return in queries by default
  },
  pin: {
    type: String, // Hashed - for kiosk app login
    select: false // Don't return in queries by default
  },

  // Employee Code for Kiosk Login (always 4 digits, auto-padded)
  employeeCode: {
    type: String,
    trim: true,
    minlength: 4,
    maxlength: 4,
    sparse: true // Allow null, but enforce uniqueness when set
  },

  // Contact Information
  phone: {
    type: String,
    trim: true
  },

  // Role & Access Control
  role: {
    type: String,
    enum: ['admin', 'custom', 'staff'], // admin=full access, custom=limited admin, staff=kiosk users
    required: true
  },
  accessType: {
    type: String,
    enum: ['admin_only', 'kiosk_only', 'both'],
    required: true,
    default: 'admin_only'
  },

  // Permissions - Only for 'custom' role. Admin role has all permissions.
  permissions: {
    type: Object,
    default: {}
    // Structure: {
    //   dashboard: true,
    //   inventory: true,
    //   pos: false,
    //   accounting: true,
    //   crm: false,
    //   attendance: false,
    //   payroll: false,
    //   analytics: false,
    //   marketing: false,
    //   signage: false,
    //   visitor: false,
    //   staffManagement: false,
    //   userManagement: false,
    //   settingsAccess: false,
    //   viewAllBranches: false
    // }
  },

  // Optional Link to Staff Model (for HR integration)
  staffId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Staff',
    default: null
  },

  // Account Status
  status: {
    type: String,
    enum: ['active', 'inactive', 'suspended'],
    default: 'active',
    required: true
  },
  confirmed: {
    type: Boolean,
    default: true // Auto-confirmed for admin-created users
  },

  // Security & Session Management
  lastLogin: {
    type: Date
  },
  lastLoginIP: {
    type: String
  },
  failedLoginAttempts: {
    type: Number,
    default: 0
  },
  lockedUntil: {
    type: Date
  },

  // 2FA (Optional)
  twoFactorEnabled: {
    type: Boolean,
    default: false
  },
  twoFactorSecret: {
    type: String,
    select: false
  },

  // Tenant ID (kept for compatibility, defaults to 'pumphouse')
  tenantId: {
    type: String,
    required: false,
    default: 'pumphouse'
  },

  // Audit Trail
  createdBy: {
    type: String
  },
  updatedBy: {
    type: String
  }
}, {
  timestamps: true
});

// INDEXES for single-tenant
userSchema.index({ username: 1 }, { unique: true });
userSchema.index({ email: 1 }, { unique: true });
userSchema.index({ employeeCode: 1 }, { unique: true, sparse: true });
userSchema.index({ role: 1 });
userSchema.index({ status: 1 });
userSchema.index({ accessType: 1 });

// Pre-save middleware for validation
userSchema.pre('save', async function(next) {
  // Set default tenantId if not provided
  if (!this.tenantId) {
    this.tenantId = 'pumphouse';
  }

  // Role and permissions validation
  if (this.role === 'custom') {
    // Custom role must have at least one permission
    if (!this.permissions || Object.keys(this.permissions).length === 0) {
      return next(new Error('Custom role requires at least one permission'));
    }

    // Validate that at least one permission is set to true
    const hasPermission = Object.values(this.permissions).some(val => val === true);
    if (!hasPermission) {
      return next(new Error('Custom role must have at least one permission enabled'));
    }
  }

  // Access type validation
  if (this.accessType === 'admin_only' || this.accessType === 'both') {
    if (!this.password) {
      return next(new Error('Password required for admin access'));
    }
  }

  if (this.accessType === 'kiosk_only' || this.accessType === 'both') {
    if (!this.pin) {
      return next(new Error('PIN required for kiosk access'));
    }
    if (!this.employeeCode) {
      return next(new Error('Employee code required for kiosk access'));
    }
  }

  // Auto-generate employee code if not provided (for kiosk users)
  if ((this.accessType === 'kiosk_only' || this.accessType === 'both') && !this.employeeCode) {
    // Generate unique 4-digit code
    let code;
    let isUnique = false;

    while (!isUnique) {
      code = Math.floor(1000 + Math.random() * 9000).toString();
      const existing = await this.constructor.findOne({ employeeCode: code });
      if (!existing) {
        isUnique = true;
      }
    }

    this.employeeCode = code;
  }

  next();
});

// Virtual for full name - HANDLE MISSING firstName/lastName
userSchema.virtual('fullName').get(function() {
  if (this.firstName && this.lastName) {
    return `${this.firstName} ${this.lastName}`.trim();
  } else if (this.firstName) {
    return this.firstName.trim();
  } else if (this.lastName) {
    return this.lastName.trim();
  } else {
    return this.username; // Fallback to username if no name provided
  }
});

// Instance Methods
userSchema.methods.toSafeObject = function() {
  const obj = this.toObject();
  delete obj.password;
  delete obj.pin;
  delete obj.twoFactorSecret;
  obj.fullName = this.fullName;
  return obj;
};

// Check if account is locked
userSchema.methods.isLocked = function() {
  return !!(this.lockedUntil && this.lockedUntil > Date.now());
};

// Increment failed login attempts
userSchema.methods.incrementLoginAttempts = async function() {
  // Reset attempts if lock has expired
  if (this.lockedUntil && this.lockedUntil < Date.now()) {
    return await this.updateOne({
      $set: { failedLoginAttempts: 1 },
      $unset: { lockedUntil: 1 }
    });
  }

  // Increment attempts
  const updates = { $inc: { failedLoginAttempts: 1 } };

  // Lock account after 5 failed attempts (15 min cooldown)
  if (this.failedLoginAttempts + 1 >= 5 && !this.isLocked()) {
    updates.$set = { lockedUntil: Date.now() + (15 * 60 * 1000) };
  }

  return await this.updateOne(updates);
};

// Reset failed login attempts on successful login
userSchema.methods.resetLoginAttempts = async function() {
  return await this.updateOne({
    $set: {
      failedLoginAttempts: 0,
      lastLogin: new Date()
    },
    $unset: { lockedUntil: 1 }
  });
};

// Static Methods
userSchema.statics.findByTenant = function(tenantId, filters = {}) {
  // Single tenant - ignore tenantId parameter
  return this.find({ ...filters })
    .select('-password -pin -twoFactorSecret');
};

userSchema.statics.findActiveKioskUsers = function(tenantId) {
  // Single tenant - ignore tenantId parameter
  return this.find({
    status: 'active',
    accessType: { $in: ['kiosk_only', 'both'] }
  })
  .select('username firstName lastName employeeCode role')
  .sort({ firstName: 1 });
};

// Check if employee code is available
userSchema.statics.isEmployeeCodeAvailable = async function(tenantId, employeeCode) {
  // Single tenant - ignore tenantId parameter
  const existing = await this.findOne({ employeeCode });
  return !existing;
};

// CRITICAL: Export schema only, no auto-registration
module.exports = { schema: userSchema };