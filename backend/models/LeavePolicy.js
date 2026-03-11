const mongoose = require('mongoose');

// Leave Policy defines entitlement, carryover, and eligibility rules for each leave type.
// One document per leaveType. Admins configure this once; the leave-balance system references it.
const leavePolicySchema = new mongoose.Schema({
  tenantId: {
    type: String,
    required: true,
    index: true
  },

  // The leave type key — should match LeaveRequest.leaveType enum
  leaveType: {
    type: String,
    required: true,
    enum: ['annual', 'sick', 'maternity', 'paternity', 'casual', 'emergency', 'compassionate', 'study', 'unpaid', 'other']
  },

  // Human-readable display name
  name: {
    type: String,
    required: true,
    trim: true
  },

  // ── Entitlement ──────────────────────────────────────────────────────────
  // Annual entitlement in working days (0 = unlimited, e.g. for unpaid)
  entitlementDays: {
    type: Number,
    required: true,
    min: 0,
    default: 0
  },

  // How entitlement is credited each year
  accrualMethod: {
    type: String,
    enum: ['upfront', 'monthly'],  // upfront = all on Jan 1; monthly = entitlement/12 per month
    default: 'upfront'
  },

  // ── Carryover ────────────────────────────────────────────────────────────
  carryoverPolicy: {
    type: String,
    enum: ['none', 'limited', 'unlimited'],
    default: 'none'
  },

  // Max days that can be carried over (only when carryoverPolicy = 'limited')
  carryoverMaxDays: {
    type: Number,
    default: 0,
    min: 0
  },

  // Date by which carried-over days must be used (MM-DD format, e.g. '03-31')
  // null = no expiry
  carryoverExpiry: {
    type: String,
    default: null
  },

  // ── Application Rules ────────────────────────────────────────────────────
  // Minimum advance notice in calendar days required when applying
  minNoticeDays: {
    type: Number,
    default: 0,
    min: 0
  },

  // Maximum consecutive days allowed in a single request (0 = no limit)
  maxConsecutiveDays: {
    type: Number,
    default: 0,
    min: 0
  },

  // ── Eligibility ──────────────────────────────────────────────────────────
  genderRestriction: {
    type: String,
    enum: ['none', 'male', 'female'],
    default: 'none'
  },

  // Whether leave is fully paid
  isPaid: {
    type: Boolean,
    default: true
  },

  // Whether a medical/supporting certificate is required
  requiresCertificate: {
    type: Boolean,
    default: false
  },

  // Certificate required only when leave exceeds this many days (0 = always required)
  certificateRequiredAfterDays: {
    type: Number,
    default: 3,
    min: 0
  },

  // New hires get entitlement proportional to months worked in their joining year
  proRatedForNewHires: {
    type: Boolean,
    default: true
  },

  // ── Status ───────────────────────────────────────────────────────────────
  isActive: {
    type: Boolean,
    default: true,
    index: true
  },

  createdBy: { type: String, default: 'system' },
  updatedBy: { type: String, default: 'system' }
}, {
  timestamps: true
});

// Unique policy per leaveType (single-tenant, still compound with tenantId for consistency)
leavePolicySchema.index({ tenantId: 1, leaveType: 1 }, { unique: true });

module.exports = { schema: leavePolicySchema };
