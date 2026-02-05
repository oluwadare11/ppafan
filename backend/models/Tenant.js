// models/Tenant.js - Simplified for single-tenant Pump House ERP
// Returns fixed business info - no actual database collection needed

const mongoose = require('mongoose');

// Simple schema for storing settings (optional - can be used for branding updates)
const tenantSchema = new mongoose.Schema({
  tenantId: {
    type: String,
    default: 'pumphouse',
    unique: true
  },
  businessName: {
    type: String,
    default: process.env.SYSTEM_NAME || 'Pump House ERP'
  },
  businessType: {
    type: String,
    default: 'Pumps & Machinery'
  },
  subdomain: {
    type: String,
    default: 'pumphouse'
  },
  status: {
    type: String,
    default: 'active'
  },
  contactInfo: {
    email: { type: String, default: '' },
    phone: { type: String, default: '' },
    address: { type: String, default: '' },
    website: { type: String, default: '' }
  },
  branding: {
    logo: { type: String, default: '' },
    primaryColor: { type: String, default: '#2563EB' },
    secondaryColor: { type: String, default: '#10B981' }
  },
  settings: {
    notificationEmails: { type: [String], default: [] },
    primaryNotificationEmail: { type: String, default: '' }, // Primary email for notifications (separate from business email)
    currency: { type: String, default: 'NGN' },
    timezone: { type: String, default: 'Africa/Lagos' },
    vatRate: { type: Number, default: 7.5 }
  },
  subscription: {
    plan: { type: String, default: 'enterprise' },
    status: { type: String, default: 'active' }
  }
}, {
  timestamps: true
});

// Static method to get or create the single tenant record
tenantSchema.statics.getOrCreate = async function() {
  let tenant = await this.findOne({ tenantId: 'pumphouse' });

  if (!tenant) {
    tenant = await this.create({
      tenantId: 'pumphouse',
      businessName: process.env.SYSTEM_NAME || 'Pump House ERP',
      businessType: 'Pumps & Machinery',
      status: 'active',
      subscription: { plan: 'enterprise', status: 'active' }
    });
  }

  return tenant;
};

const Tenant = mongoose.model('Tenant', tenantSchema, 'tenant');

module.exports = Tenant;
