// Enhanced Multi-Tenant Aware Staff Model - FIXED Employee Code System
const mongoose = require('mongoose');

// Department schema for tenant-specific departments
const departmentSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  description: { type: String, default: '' },
  isActive: { type: Boolean, default: true },
  createdBy: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
}, { _id: true });

// Position schema for tenant-specific positions
const positionSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  department: { type: String, required: true },
  description: { type: String, default: '' },
  isActive: { type: Boolean, default: true },
  requiresPin: { type: Boolean, default: false },
  createdBy: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
}, { _id: true });

// Biometric data schema for storing fingerprint templates
const biometricFingerprintSchema = new mongoose.Schema({
  fingerId: {
    type: Number,
    required: true,
    min: 0,
    max: 9
  },
  fingerName: {
    type: String,
    enum: [
      'Right Thumb', 'Right Index', 'Right Middle', 'Right Ring', 'Right Little',
      'Left Thumb', 'Left Index', 'Left Middle', 'Left Ring', 'Left Little'
    ]
  },
  template: {
    type: String,  // Base64 encoded template
    required: true
  },
  templateSize: {
    type: Number
  },
  enrolledAt: {
    type: Date,
    default: Date.now
  },
  enrolledBy: {
    type: String
  },
  sourceDeviceSN: {
    type: String  // Which device was used to enroll
  },
  syncedToDevices: [{
    deviceSN: String,
    syncedAt: Date
  }]
}, { _id: true });

// Biometric data schema for storing face templates
const biometricFaceSchema = new mongoose.Schema({
  faceId: {
    type: Number,
    required: true,
    min: 0,
    max: 11
  },
  template: {
    type: String,  // Base64 encoded template (always 1648 bytes)
    required: true
  },
  templateSize: {
    type: Number,
    default: 1648  // Face templates are always 1648 bytes
  },
  enrolledAt: {
    type: Date,
    default: Date.now
  },
  enrolledBy: {
    type: String
  },
  sourceDeviceSN: {
    type: String
  },
  syncedToDevices: [{
    deviceSN: String,
    syncedAt: Date
  }]
}, { _id: true });

const staffSchema = new mongoose.Schema({
  // Employee ID is always stored as 4 digits (0001-9999), auto-padded from input
  // Admin can enter 1-4 digits, system normalizes to 4 digits (e.g., "1" → "0001")
  // CONFIG_ prefix is allowed for tenant configuration records
  employeeId: {
    type: String,
    required: true,
    validate: {
      validator: function(v) {
        // Allow CONFIG_ prefix for configuration records OR 4-digit employee codes
        return /^CONFIG_/.test(v) || /^\d{4}$/.test(v);
      },
      message: 'Employee code must be 4 digits (0001-9999)'
    }
  },
  firstName: { type: String, required: true },
  lastName: { type: String, default: '' },
  email: { type: String },
  phoneNumber: { type: String },
  department: { type: String, default: '' },
  position: { type: String },
  status: {
    type: String,
    enum: ['active', 'inactive', 'terminated'],
    default: 'active',
    required: true
  },
  dateOfEmployment: { type: Date },
  employmentType: { type: String, enum: ['full-time', 'part-time', 'contractor'], default: 'full-time' },
  workSchedule: { type: String, default: 'Mon-Sat 8:00-17:00' },

  // Kiosk Access
  kioskAccess: { type: Boolean, default: false },
  pin: { type: String, select: false }, // Hashed 4-6 digit PIN for kiosk login

  // User Account Link (Optional - for admin app access)
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },

  bankDetails: {
    bankName: { type: String },
    bankCode: { type: String }, // Bank code for payment processing
    accountNumber: { type: String },
    accountName: { type: String },
  },
  baseSalary: { type: Number, default: 0 },
  overtimePay: { type: Number, default: 0 },
  bonuses: { type: Number, default: 0 },
  tax: { type: Number, default: 0 },

  // ============================================
  // PAYROLL CONFIGURATION
  // ============================================
  payroll: {
    // Salary type
    salaryType: {
      type: String,
      enum: ['monthly', 'hourly', 'daily', 'contract'],
      default: 'monthly'
    },

    // Default allowances for this employee (template)
    allowances: [{
      code: { type: String, required: true },
      name: { type: String, required: true },
      amount: { type: Number, default: 0 },
      calculationType: { type: String, enum: ['fixed', 'percentage'], default: 'fixed' },
      percentageOf: { type: String, enum: ['basic', 'gross', null], default: null },
      percentageValue: { type: Number, default: 0 },
      isActive: { type: Boolean, default: true }
    }],

    // Statutory information
    statutoryInfo: {
      tin: { type: String, default: '' }, // Tax Identification Number
      nin: { type: String, default: '' }, // National Identification Number
      rsaPin: { type: String, default: '' }, // Retirement Savings Account PIN
      pfaName: { type: String, default: '' }, // Pension Fund Administrator name
      pfaCode: { type: String, default: '' }, // PFA code
      nhfNumber: { type: String, default: '' }, // National Housing Fund number
      nhisNumber: { type: String, default: '' }, // National Health Insurance number
      nhisProvider: { type: String, default: '' } // NHIS HMO provider
    },

    // Exemptions from statutory deductions
    exemptions: {
      paye: { type: Boolean, default: false },
      pension: { type: Boolean, default: false },
      nhf: { type: Boolean, default: false },
      nhis: { type: Boolean, default: false }
    },

    // Annual tax reliefs (NTA 2025) — declared once per year, applied to all monthly payrolls.
    // These reduce taxable income before PAYE brackets are applied.
    // All values in Naira per annum.
    taxReliefs: {
      annualRent:             { type: Number, default: 0 }, // Actual rent paid — relief = 20% of rent, max ₦500k/yr
      annualLifeAssurance:    { type: Number, default: 0 }, // Annual life assurance premiums
      annualMortgageInterest: { type: Number, default: 0 }, // Mortgage interest on primary residence
      voluntaryPensionAVC:    { type: Number, default: 0 }  // Voluntary Additional Voluntary Contributions
    },

    // Exclude from attendance deduction calculations (e.g. management/directors who don't clock in)
    excludeFromDeductions: { type: Boolean, default: false },

    // Overtime eligibility
    overtimeEligible: { type: Boolean, default: true },

    // Payment preferences
    paymentMethod: {
      type: String,
      enum: ['bank_transfer', 'cash', 'cheque', 'mobile_money'],
      default: 'bank_transfer'
    },

    // Payroll notes
    notes: { type: String, default: '' },

    // Last payroll update
    lastUpdated: { type: Date },
    updatedBy: { type: String }
  },

  // ============================================
  // SALES COMMISSION CONFIGURATION
  // ============================================
  commission: {
    // Whether this staff earns sales commission
    enabled: { type: Boolean, default: false },
    // Commission rate as percentage (0-100)
    rate: { type: Number, default: 0, min: 0, max: 100 },
    // Commission type
    type: {
      type: String,
      enum: ['percentage', 'fixed_per_sale', 'tiered'],
      default: 'percentage'
    },
    // Fixed amount per sale (when type is 'fixed_per_sale')
    fixedAmount: { type: Number, default: 0, min: 0 },
    // Tiered commission rates (when type is 'tiered')
    tiers: [{
      minSales: { type: Number, required: true },
      maxSales: { type: Number },
      rate: { type: Number, required: true, min: 0, max: 100 }
    }],
    // Sales target for bonus
    monthlyTarget: { type: Number, default: 0, min: 0 },
    // Bonus rate when target is met (additional percentage)
    targetBonusRate: { type: Number, default: 0, min: 0, max: 100 },
    // Categories/Departments eligible for commission (empty = all)
    eligibleCategories: [{ type: String }],
    eligibleDepartments: [{ type: String }],
    // Notes
    notes: { type: String, default: '' },
    lastUpdated: { type: Date },
    updatedBy: { type: String }
  },

  // Tenant configuration - stored in special config record
  tenantConfiguration: {
    departments: [departmentSchema],
    positions: [positionSchema],
    defaultDepartments: { type: Boolean, default: false },
    lastUpdated: { type: Date },
    updatedBy: { type: String }
  },
  
  // Visitor Management Fields
  canHostVisitors: {
    type: Boolean,
    default: true
  },
  autoApproveVisitors: {
    type: Boolean,
    default: false
  },
  visitorNotificationEmail: {
    type: String,
    trim: true,
    lowercase: true
  },
  maxVisitorsPerDay: {
    type: Number,
    default: null // null means unlimited
  },

  // Biometric Data Storage
  biometricData: {
    fingerprints: [biometricFingerprintSchema],
    faces: [biometricFaceSchema],
    lastUpdated: { type: Date },
    updatedBy: { type: String }
  },

  // TENANT ISOLATION
  tenantId: { type: String, required: true, index: true },
}, {
  timestamps: true
});

// Enhanced tenant isolation indexes
staffSchema.index({ tenantId: 1, employeeId: 1 }, { unique: true });
staffSchema.index({ tenantId: 1, department: 1 });
staffSchema.index({ tenantId: 1, position: 1 });
staffSchema.index({ tenantId: 1, employmentType: 1 });
staffSchema.index({ tenantId: 1, firstName: 1, lastName: 1 });
staffSchema.index({ tenantId: 1, canHostVisitors: 1, department: 1 });

// Index for biometric queries
staffSchema.index({ tenantId: 1, 'biometricData.fingerprints.fingerId': 1 });
staffSchema.index({ tenantId: 1, 'biometricData.faces.faceId': 1 });

// Pre-save middleware for tenant isolation validation
staffSchema.pre('save', function(next) {
  if (!this.tenantId) {
    return next(new Error('TenantId is required for staff records'));
  }
  
  this.baseSalary = Math.max(0, this.baseSalary || 0);
  this.overtimePay = Math.max(0, this.overtimePay || 0);
  this.bonuses = Math.max(0, this.bonuses || 0);
  this.tax = Math.max(0, this.tax || 0);
  
  next();
});

// STATIC METHODS - attached to schema, not model
staffSchema.statics.getOrCreateTenantConfiguration = async function(targetTenantId, userId = 'system') {
  try {
    let configRecord = await this.findOne({ 
      tenantId: targetTenantId,
      employeeId: `CONFIG_${targetTenantId}`
    });
    
    if (configRecord && configRecord.tenantConfiguration) {
      return {
        departments: configRecord.tenantConfiguration.departments.filter(d => d.isActive),
        positions: configRecord.tenantConfiguration.positions.filter(p => p.isActive)
      };
    }
    
    const defaultDepartments = [
      { name: 'Management', description: 'Management and Administration', createdBy: userId },
      { name: 'Operations', description: 'Day-to-day Operations', createdBy: userId },
      { name: 'Customer Service', description: 'Customer Support and Service', createdBy: userId },
      { name: 'IT', description: 'Information Technology', createdBy: userId },
      { name: 'Engineering', description: 'Engineering Department', createdBy: userId },
      { name: 'Admin', description: 'Administrative Services', createdBy: userId },
      { name: 'PumpHouse', description: 'PumpHouse Operations', createdBy: userId }
    ];

    const defaultPositions = [
      { name: 'Manager', department: 'Management', description: 'Department Manager', createdBy: userId },
      { name: 'Assistant Manager', department: 'Management', description: 'Assistant Manager', createdBy: userId },
      { name: 'Supervisor', department: 'Operations', description: 'Operations Supervisor', createdBy: userId },
      { name: 'Staff', department: 'Operations', description: 'General Staff Member', createdBy: userId },
      { name: 'Cashier', department: 'Customer Service', description: 'Cashier', requiresPin: true, createdBy: userId },
      { name: 'Customer Service Representative', department: 'Customer Service', description: 'Customer Service Rep', createdBy: userId },
      { name: 'IT Support', department: 'IT', description: 'IT Support Specialist', createdBy: userId },
      // Engineering positions
      { name: 'Chief Electrical Engineer', department: 'Engineering', description: 'Chief Electrical Engineer', createdBy: userId },
      { name: 'Project Engineer', department: 'Engineering', description: 'Project Engineer', createdBy: userId },
      { name: 'Technician', department: 'Engineering', description: 'Technical Staff', createdBy: userId },
      // Admin positions
      { name: 'Accountant', department: 'Admin', description: 'Finance and Accounting', createdBy: userId },
      { name: 'Admin Officer', department: 'Admin', description: 'Administrative Officer', createdBy: userId },
      { name: 'Business Development Executive', department: 'Admin', description: 'BDE - Business Development', createdBy: userId },
      // PumpHouse positions
      { name: 'Driver', department: 'PumpHouse', description: 'Driver', createdBy: userId },
      { name: 'Cleaner', department: 'PumpHouse', description: 'Cleaning Staff', createdBy: userId }
    ];
    
    const configurationRecord = new this({
      employeeId: `CONFIG_${targetTenantId}`,
      firstName: 'System',
      lastName: 'Configuration',
      tenantId: targetTenantId,
      tenantConfiguration: {
        departments: defaultDepartments,
        positions: defaultPositions,
        defaultDepartments: true,
        updatedBy: userId
      }
    });
    
    await configurationRecord.save();
    
    return {
      departments: defaultDepartments,
      positions: defaultPositions
    };
  } catch (error) {
    console.error('Error creating tenant configuration:', error);
    return {
      departments: [
        { name: 'Management', description: 'Management and Administration' },
        { name: 'Operations', description: 'Day-to-day Operations' },
        { name: 'Customer Service', description: 'Customer Support and Service' },
        { name: 'Engineering', description: 'Engineering Department' },
        { name: 'Admin', description: 'Administrative Services' },
        { name: 'PumpHouse', description: 'PumpHouse Operations' }
      ],
      positions: [
        { name: 'Manager', department: 'Management', description: 'Department Manager' },
        { name: 'Staff', department: 'Operations', description: 'General Staff Member' },
        { name: 'Cashier', department: 'Customer Service', description: 'Cashier', requiresPin: true },
        { name: 'Chief Electrical Engineer', department: 'Engineering', description: 'Chief Electrical Engineer' },
        { name: 'Project Engineer', department: 'Engineering', description: 'Project Engineer' },
        { name: 'Technician', department: 'Engineering', description: 'Technical Staff' },
        { name: 'Accountant', department: 'Admin', description: 'Finance and Accounting' },
        { name: 'Admin Officer', department: 'Admin', description: 'Administrative Officer' },
        { name: 'Business Development Executive', department: 'Admin', description: 'BDE - Business Development' },
        { name: 'Driver', department: 'PumpHouse', description: 'Driver' },
        { name: 'Cleaner', department: 'PumpHouse', description: 'Cleaning Staff' }
      ]
    };
  }
};

staffSchema.statics.addDepartment = async function(targetTenantId, departmentData, userId) {
  try {
    const { name, description = '' } = departmentData;
    const config = await this.getOrCreateTenantConfiguration(targetTenantId, userId);
    
    const existingDept = config.departments.find(d => 
      d.name.toLowerCase() === name.toLowerCase()
    );
    
    if (existingDept) {
      throw new Error('Department already exists');
    }
    
    let configRecord = await this.findOne({ 
      tenantId: targetTenantId,
      employeeId: `CONFIG_${targetTenantId}`
    });
    
    if (!configRecord) {
      await this.getOrCreateTenantConfiguration(targetTenantId, userId);
      configRecord = await this.findOne({
        tenantId: targetTenantId,
        employeeId: `CONFIG_${targetTenantId}`
      });
    }

    // Safety check - if still null, create it directly
    if (!configRecord) {
      configRecord = new this({
        employeeId: `CONFIG_${targetTenantId}`,
        firstName: 'System',
        lastName: 'Configuration',
        tenantId: targetTenantId,
        tenantConfiguration: {
          departments: [],
          positions: [],
          updatedBy: userId
        }
      });
    }

    if (!configRecord.tenantConfiguration) {
      configRecord.tenantConfiguration = { departments: [], positions: [] };
    }
    
    const newDepartment = {
      name: name.trim(),
      description: description.trim(),
      createdBy: userId,
      isActive: true,
      createdAt: new Date()
    };
    
    configRecord.tenantConfiguration.departments.push(newDepartment);
    configRecord.tenantConfiguration.lastUpdated = new Date();
    configRecord.tenantConfiguration.updatedBy = userId;
    
    await configRecord.save();
    return newDepartment;
  } catch (error) {
    throw error;
  }
};

staffSchema.statics.addPosition = async function(targetTenantId, positionData, userId) {
  try {
    const { name, department, description = '', requiresPin = false } = positionData;
    const config = await this.getOrCreateTenantConfiguration(targetTenantId, userId);
    
    const departmentExists = config.departments.some(d => d.name === department);
    if (!departmentExists) {
      throw new Error('Department does not exist');
    }
    
    const existingPosition = config.positions.find(p => 
      p.name.toLowerCase() === name.toLowerCase() && p.department === department
    );
    
    if (existingPosition) {
      throw new Error('Position already exists in this department');
    }
    
    let configRecord = await this.findOne({
      tenantId: targetTenantId,
      employeeId: `CONFIG_${targetTenantId}`
    });

    // Safety check - if null, create it directly
    if (!configRecord) {
      configRecord = new this({
        employeeId: `CONFIG_${targetTenantId}`,
        firstName: 'System',
        lastName: 'Configuration',
        tenantId: targetTenantId,
        tenantConfiguration: {
          departments: [],
          positions: [],
          updatedBy: userId
        }
      });
    }

    if (!configRecord.tenantConfiguration) {
      configRecord.tenantConfiguration = { departments: [], positions: [] };
    }

    const newPosition = {
      name: name.trim(),
      department: department,
      description: description.trim(),
      requiresPin: requiresPin,
      createdBy: userId,
      isActive: true,
      createdAt: new Date()
    };

    configRecord.tenantConfiguration.positions.push(newPosition);
    configRecord.tenantConfiguration.lastUpdated = new Date();
    configRecord.tenantConfiguration.updatedBy = userId;
    
    await configRecord.save();
    return newPosition;
  } catch (error) {
    throw error;
  }
};

staffSchema.statics.removeDepartment = async function(targetTenantId, departmentName, userId) {
  try {
    const staffCount = await this.countDocuments({
      tenantId: targetTenantId,
      department: departmentName,
      employeeId: { $ne: `CONFIG_${targetTenantId}` }
    });
    
    if (staffCount > 0) {
      throw new Error(`Cannot delete department. ${staffCount} staff member(s) are assigned to this department.`);
    }
    
    const configRecord = await this.findOne({ 
      tenantId: targetTenantId,
      employeeId: `CONFIG_${targetTenantId}`
    });
    
    if (!configRecord || !configRecord.tenantConfiguration) {
      throw new Error('No configuration found');
    }
    
    const department = configRecord.tenantConfiguration.departments.find(d => d.name === departmentName);
    if (department) {
      department.isActive = false;
    }
    
    configRecord.tenantConfiguration.positions.forEach(position => {
      if (position.department === departmentName) {
        position.isActive = false;
      }
    });
    
    configRecord.tenantConfiguration.lastUpdated = new Date();
    configRecord.tenantConfiguration.updatedBy = userId;
    
    await configRecord.save();
    return { success: true, message: 'Department deactivated successfully' };
  } catch (error) {
    throw error;
  }
};

staffSchema.statics.removePosition = async function(targetTenantId, positionName, department, userId) {
  try {
    const staffCount = await this.countDocuments({
      tenantId: targetTenantId,
      position: positionName,
      department: department,
      employeeId: { $ne: `CONFIG_${targetTenantId}` }
    });
    
    if (staffCount > 0) {
      throw new Error(`Cannot delete position. ${staffCount} staff member(s) are assigned to this position.`);
    }
    
    const configRecord = await this.findOne({ 
      tenantId: targetTenantId,
      employeeId: `CONFIG_${targetTenantId}`
    });
    
    if (!configRecord || !configRecord.tenantConfiguration) {
      throw new Error('No configuration found');
    }
    
    const position = configRecord.tenantConfiguration.positions.find(p => 
      p.name === positionName && p.department === department
    );
    if (position) {
      position.isActive = false;
    }
    
    configRecord.tenantConfiguration.lastUpdated = new Date();
    configRecord.tenantConfiguration.updatedBy = userId;
    
    await configRecord.save();
    return { success: true, message: 'Position deactivated successfully' };
  } catch (error) {
    throw error;
  }
};

staffSchema.statics.getTenantDepartments = async function(targetTenantId) {
  try {
    const config = await this.getOrCreateTenantConfiguration(targetTenantId);

    // Remove duplicates based on name (case-insensitive)
    const seen = new Set();
    const uniqueDepartments = config.departments.filter(dept => {
      const key = dept.name.toLowerCase();
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });

    return uniqueDepartments.map(dept => ({
      _id: dept._id,
      name: dept.name,
      description: dept.description,
      createdAt: dept.createdAt
    }));
  } catch (error) {
    console.error('Error getting tenant departments:', error);
    return [];
  }
};

staffSchema.statics.getTenantPositions = async function(targetTenantId, departmentFilter = null) {
  try {
    const config = await this.getOrCreateTenantConfiguration(targetTenantId);
    let positions = config.positions;

    if (departmentFilter) {
      positions = positions.filter(pos => pos.department === departmentFilter);
    }

    // Remove duplicates based on name + department combination (case-insensitive)
    const seen = new Set();
    const uniquePositions = positions.filter(pos => {
      const key = `${pos.name.toLowerCase()}_${pos.department.toLowerCase()}`;
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });

    return uniquePositions.map(pos => ({
      _id: pos._id,
      name: pos.name,
      department: pos.department,
      description: pos.description,
      requiresPin: pos.requiresPin,
      createdAt: pos.createdAt
    }));
  } catch (error) {
    console.error('Error getting tenant positions:', error);
    return [];
  }
};

// Static method to deactivate linked users when staff is deleted/terminated
staffSchema.statics.deactivateLinkedUsers = async function(staffId, tenantId) {
  try {
    const mongoose = require('mongoose');
    const modelName = `User_${tenantId}`;

    if (!mongoose.models[modelName]) {
      console.log(`User model for tenant ${tenantId} not found - skipping user deactivation`);
      return { modified: 0 };
    }

    const UserModel = mongoose.models[modelName];

    const result = await UserModel.updateMany(
      {
        staffId: staffId,
        tenantId: tenantId
      },
      {
        status: 'inactive',
        updatedAt: new Date()
      }
    );

    console.log(`Deactivated ${result.modifiedCount} user(s) linked to staff ${staffId}`);
    return result;
  } catch (error) {
    console.error('Error deactivating linked users:', error);
    throw error;
  }
};

// ============================================================================
// BIOMETRIC DATA METHODS
// ============================================================================

/**
 * Save fingerprint template to staff record
 */
staffSchema.methods.saveFingerprint = async function(fingerprintData) {
  const { fingerId, template, templateSize, enrolledBy, sourceDeviceSN } = fingerprintData;

  if (!this.biometricData) {
    this.biometricData = { fingerprints: [], faces: [] };
  }

  // Remove existing fingerprint with same fingerId
  this.biometricData.fingerprints = this.biometricData.fingerprints.filter(
    fp => fp.fingerId !== fingerId
  );

  // Finger names mapping
  const fingerNames = [
    'Right Thumb', 'Right Index', 'Right Middle', 'Right Ring', 'Right Little',
    'Left Thumb', 'Left Index', 'Left Middle', 'Left Ring', 'Left Little'
  ];

  // Add new fingerprint
  this.biometricData.fingerprints.push({
    fingerId,
    fingerName: fingerNames[fingerId] || `Finger ${fingerId}`,
    template,
    templateSize,
    enrolledAt: new Date(),
    enrolledBy,
    sourceDeviceSN
  });

  this.biometricData.lastUpdated = new Date();
  this.biometricData.updatedBy = enrolledBy;

  return this.save();
};

/**
 * Save face template to staff record
 */
staffSchema.methods.saveFace = async function(faceData) {
  const { faceId, template, templateSize = 1648, enrolledBy, sourceDeviceSN } = faceData;

  if (!this.biometricData) {
    this.biometricData = { fingerprints: [], faces: [] };
  }

  // Remove existing face with same faceId
  this.biometricData.faces = this.biometricData.faces.filter(
    f => f.faceId !== faceId
  );

  // Add new face
  this.biometricData.faces.push({
    faceId,
    template,
    templateSize,
    enrolledAt: new Date(),
    enrolledBy,
    sourceDeviceSN
  });

  this.biometricData.lastUpdated = new Date();
  this.biometricData.updatedBy = enrolledBy;

  return this.save();
};

/**
 * Get fingerprint template by fingerId
 */
staffSchema.methods.getFingerprint = function(fingerId) {
  if (!this.biometricData || !this.biometricData.fingerprints) {
    return null;
  }
  return this.biometricData.fingerprints.find(fp => fp.fingerId === fingerId);
};

/**
 * Get face template by faceId
 */
staffSchema.methods.getFace = function(faceId) {
  if (!this.biometricData || !this.biometricData.faces) {
    return null;
  }
  return this.biometricData.faces.find(f => f.faceId === faceId);
};

/**
 * Mark template as synced to device
 */
staffSchema.methods.markBiometricSynced = async function(type, id, deviceSN) {
  const templates = type === 'fingerprint'
    ? this.biometricData.fingerprints
    : this.biometricData.faces;

  const template = templates.find(t =>
    type === 'fingerprint' ? t.fingerId === id : t.faceId === id
  );

  if (template) {
    if (!template.syncedToDevices) {
      template.syncedToDevices = [];
    }

    // Remove existing sync record for this device
    template.syncedToDevices = template.syncedToDevices.filter(
      s => s.deviceSN !== deviceSN
    );

    // Add new sync record
    template.syncedToDevices.push({
      deviceSN,
      syncedAt: new Date()
    });

    return this.save();
  }
};

/**
 * Check if staff has any biometric data
 */
staffSchema.methods.hasBiometrics = function() {
  return (
    this.biometricData &&
    (
      (this.biometricData.fingerprints && this.biometricData.fingerprints.length > 0) ||
      (this.biometricData.faces && this.biometricData.faces.length > 0)
    )
  );
};

/**
 * Get biometric summary
 */
staffSchema.methods.getBiometricSummary = function() {
  if (!this.biometricData) {
    return {
      hasFingerprints: false,
      hasFaces: false,
      fingerprintCount: 0,
      faceCount: 0
    };
  }

  return {
    hasFingerprints: this.biometricData.fingerprints && this.biometricData.fingerprints.length > 0,
    hasFaces: this.biometricData.faces && this.biometricData.faces.length > 0,
    fingerprintCount: this.biometricData.fingerprints ? this.biometricData.fingerprints.length : 0,
    faceCount: this.biometricData.faces ? this.biometricData.faces.length : 0,
    lastUpdated: this.biometricData.lastUpdated
  };
};

// CRITICAL: Export schema only, no auto-registration
module.exports = { schema: staffSchema };