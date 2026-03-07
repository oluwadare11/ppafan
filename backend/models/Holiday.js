// models/Holiday.js — Proper holiday model (replaces employeeId='HOLIDAY' Attendance hack)
const mongoose = require('mongoose');

const holidaySchema = new mongoose.Schema({
  tenantId: { type: String, required: true, index: true },
  name:     { type: String, required: true, maxlength: 200, trim: true },
  date:     { type: String, required: true }, // YYYY-MM-DD — string for O(1) date comparison
  year:     { type: Number, required: true, index: true },
  createdBy:{ type: String, default: 'admin' }
}, { timestamps: true });

// One holiday per date per tenant
holidaySchema.index({ tenantId: 1, date: 1 }, { unique: true });

// CRITICAL: Export schema only — registered lazily via getTenantModel('Holiday')
module.exports = { schema: holidaySchema };
