// routes/settings.js - Unified Tenant-Specific Settings Management with Tenant Model Sync
const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { requireAuthentication } = require('../middleware/cookieAuth');
const { identifyTenant, addTenantHelpers, requireActiveTenant } = require('../middleware/tenant');
const Tenant = require('../models/Tenant');
const logger = require('../utils/logger');

// Configure multer for logo uploads
const logoStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../uploads', req.tenantId, 'branding');
    fs.mkdirSync(uploadDir, { recursive: true });
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueId = crypto.randomBytes(8).toString('hex');
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `logo_${uniqueId}${ext}`);
  }
});

const logoUpload = multer({
  storage: logoStorage,
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only JPEG, PNG, GIF, WebP, and SVG are allowed.'));
    }
  }
});

// COMPLETE MIDDLEWARE STACK FOR TENANT ISOLATION
router.use(identifyTenant);
router.use(addTenantHelpers);
router.use(requireActiveTenant);
router.use(requireAuthentication);

// GET /api/settings - Get tenant-specific settings (merged from both models)
router.get('/', async (req, res) => {
  try {
    // Get or create Tenant model data (source of truth for branding/business info)
    // Use getOrCreate for single-tenant to ensure tenant record exists
    const tenant = await Tenant.getOrCreate();

    // Get Settings model (operational settings)
    const TenantSettings = req.getTenantModel('Settings');
    let settings = null;
    
    if (TenantSettings) {
      try {
        settings = await TenantSettings.findOne({ tenantId: req.tenantId });
      } catch (err) {
        logger.warn('Settings model query failed, using tenant defaults', {
          tenantId: req.tenantId,
          error: err.message
        });
      }
    }

    logger.debug('Settings fetched successfully', {
      tenantId: req.tenantId,
      businessName: tenant.businessName,
      userId: req.user.id,
      hasSettings: !!settings
    });

    // MERGED RESPONSE: Tenant model is source of truth for branding/contact
    // FIXED: Use explicit checks instead of || to preserve empty strings
    const getNotificationEmails = () => {
      // Priority: Settings model notificationRecipients -> Tenant settings notificationEmails -> empty array
      if (settings?.emailSettings?.notificationRecipients?.length > 0) {
        return settings.emailSettings.notificationRecipients;
      }
      if (tenant.settings?.notificationEmails?.length > 0) {
        return tenant.settings.notificationEmails;
      }
      return [''];
    };

    const getPrimaryNotificationEmail = () => {
      // Priority: Tenant settings primaryNotificationEmail -> Tenant contactInfo email (fallback)
      // FIXED: Now reading from Tenant model which saves correctly
      if (tenant.settings?.primaryNotificationEmail !== undefined &&
          tenant.settings?.primaryNotificationEmail !== null &&
          tenant.settings?.primaryNotificationEmail !== '') {
        return tenant.settings.primaryNotificationEmail;
      }
      // Fallback to business contact email if no primary notification email is set
      return tenant.contactInfo?.email || '';
    };

    const responseData = {
      businessName: tenant.businessName,
      businessType: tenant.businessType,
      contactInfo: {
        email: tenant.contactInfo?.email || '',
        phone: tenant.contactInfo?.phone || '',
        address: tenant.contactInfo?.address || '',
        website: tenant.contactInfo?.website || ''
      },
      branding: {
        logo: tenant.branding?.logo || '',
        primaryColor: tenant.branding?.primaryColor || '#3B82F6',
        secondaryColor: tenant.branding?.secondaryColor || '#10B981'
      },
      settings: {
        notificationEmails: getNotificationEmails(),
        notificationEmail: getPrimaryNotificationEmail(),
        timezone: tenant.settings?.timezone || settings?.systemSettings?.timezone || 'Africa/Lagos',
        currency: tenant.settings?.currency || settings?.systemSettings?.currency || 'NGN',
        vatRate: tenant.settings?.vatRate ?? settings?.systemSettings?.vatRate ?? 7.5
      },
      // Include operational settings if available
      posSettings: settings?.posSettings || {},
      inventorySettings: settings?.inventorySettings || {},
      attendanceSettings: settings?.attendanceSettings || {},
      payrollSettings: settings?.payrollSettings || {}
    };

    res.json(responseData);

  } catch (error) {
    logger.error('Failed to fetch tenant settings', {
      tenantId: req.tenantId,
      error: error.message,
      userId: req.user.id,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });

    res.status(500).json({
      error: 'SETTINGS_FETCH_ERROR',
      message: 'Failed to retrieve settings: ' + error.message
    });
  }
});

// PUT /api/settings/update - Update tenant-specific settings with BIDIRECTIONAL SYNC
router.put('/update', async (req, res) => {
  try {
    const {
      businessName,
      businessType,
      contactInfo,
      branding,
      settings
    } = req.body;

    // Validate required fields
    if (!businessName || !businessName.trim()) {
      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'Business name is required'
      });
    }

    // Validate email formats if provided
    if (contactInfo?.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactInfo.email)) {
      return res.status(400).json({
        error: 'INVALID_EMAIL',
        message: 'Invalid business email format'
      });
    }

    if (settings?.notificationEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(settings.notificationEmail)) {
      return res.status(400).json({
        error: 'INVALID_NOTIFICATION_EMAIL',
        message: 'Invalid notification email format'
      });
    }

    // Validate notification emails array
    if (settings?.notificationEmails) {
      const invalidEmails = settings.notificationEmails.filter(email => 
        email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
      );
      if (invalidEmails.length > 0) {
        return res.status(400).json({
          error: 'INVALID_NOTIFICATION_EMAILS',
          message: `Invalid email addresses: ${invalidEmails.join(', ')}`
        });
      }
    }

    // Validate color codes
    const colorRegex = /^#[0-9A-F]{6}$/i;
    if (branding?.primaryColor && !colorRegex.test(branding.primaryColor)) {
      return res.status(400).json({
        error: 'INVALID_PRIMARY_COLOR',
        message: 'Primary color must be a valid hex color code'
      });
    }

    if (branding?.secondaryColor && !colorRegex.test(branding.secondaryColor)) {
      return res.status(400).json({
        error: 'INVALID_SECONDARY_COLOR',
        message: 'Secondary color must be a valid hex color code'
      });
    }

    // Validate VAT rate
    if (settings?.vatRate !== undefined) {
      const vatRate = parseFloat(settings.vatRate);
      if (isNaN(vatRate) || vatRate < 0 || vatRate > 100) {
        return res.status(400).json({
          error: 'INVALID_VAT_RATE',
          message: 'VAT rate must be between 0 and 100'
        });
      }
    }

    // STEP 1: UPDATE TENANT MODEL (Source of Truth for Branding/Contact)
    const tenantUpdateData = {
      businessName: businessName.trim(),
      businessType: businessType?.trim() || 'general'
    };

    // Update contact info
    if (contactInfo) {
      tenantUpdateData.contactInfo = {
        email: contactInfo.email?.trim() || '',
        phone: contactInfo.phone?.trim() || '',
        address: contactInfo.address?.trim() || '',
        website: contactInfo.website?.trim() || ''
      };
    }

    // Update branding - preserve existing logo if not explicitly changed
    if (branding) {
      // Get the current tenant to preserve existing logo if not updated
      const currentTenant = await Tenant.findOne({ tenantId: req.tenantId });
      const existingLogo = currentTenant?.branding?.logo || null;

      tenantUpdateData.branding = {
        // Only update logo if explicitly provided (including empty string to clear it)
        // Preserve existing logo if branding.logo is undefined
        logo: branding.logo !== undefined ? branding.logo : existingLogo,
        primaryColor: branding.primaryColor || '#3B82F6',
        secondaryColor: branding.secondaryColor || '#10B981'
      };
    }

    // Update system settings in Tenant
    if (settings) {
      tenantUpdateData.settings = {
        timezone: settings.timezone || 'Africa/Lagos',
        currency: settings.currency || 'NGN',
        vatRate: settings.vatRate !== undefined ? parseFloat(settings.vatRate) : 7.5,
        notificationEmails: settings.notificationEmails?.filter(email => email.trim()) || [],
        // FIXED: Store primaryNotificationEmail in Tenant model (not Settings model which has validation issues)
        primaryNotificationEmail: settings.notificationEmail !== undefined
          ? (settings.notificationEmail?.trim() || '')
          : ''
      };
    }

    const updatedTenant = await Tenant.findOneAndUpdate(
      { tenantId: req.tenantId },
      { $set: tenantUpdateData },
      { new: true, runValidators: true, upsert: true }
    );

    logger.info('Tenant model updated', {
      tenantId: req.tenantId,
      updatedBy: req.user.username,
      fields: Object.keys(tenantUpdateData)
    });

    // STEP 2: UPDATE SETTINGS MODEL (Operational Settings + Sync)
    const TenantSettings = req.getTenantModel('Settings');
    
    if (TenantSettings) {
      try {
        let tenantSettings = await TenantSettings.findOne({ tenantId: req.tenantId });
        
        if (!tenantSettings) {
          tenantSettings = new TenantSettings({ tenantId: req.tenantId });
        }

        // Sync business info from Tenant model
        // Note: Only sync fields that exist in Settings schema (name, type, logo, primaryColor, secondaryColor)
        tenantSettings.businessInfo = {
          name: updatedTenant.businessName,
          type: updatedTenant.businessType,
          logo: updatedTenant.branding?.logo || '',
          primaryColor: updatedTenant.branding?.primaryColor || '#3B82F6',
          secondaryColor: updatedTenant.branding?.secondaryColor || '#10B981'
        };

        // Sync system settings from Tenant model
        tenantSettings.systemSettings = {
          ...tenantSettings.systemSettings,
          timezone: updatedTenant.settings?.timezone || 'Africa/Lagos',
          currency: updatedTenant.settings?.currency || 'NGN',
          vatRate: updatedTenant.settings?.vatRate || 7.5,
          notificationEmails: updatedTenant.settings?.notificationEmails || []
        };

        // Update email settings
        // FIXED: Save the exact value provided by user, don't fall back to contact email
        // This allows users to explicitly set a different notification email
        const primaryEmail = settings?.notificationEmail !== undefined
          ? (settings.notificationEmail?.trim() || '')
          : (tenantSettings.emailSettings?.primaryNotificationEmail || updatedTenant.contactInfo?.email || '');

        tenantSettings.emailSettings = {
          ...tenantSettings.emailSettings,
          enableNotifications: true,
          primaryNotificationEmail: primaryEmail,
          notificationRecipients: updatedTenant.settings?.notificationEmails || [],
          enableAttendanceAlerts: tenantSettings.emailSettings?.enableAttendanceAlerts !== false,
          enableInventoryAlerts: tenantSettings.emailSettings?.enableInventoryAlerts !== false
        };

        await tenantSettings.save();

        logger.info('Settings model synced with Tenant', {
          tenantId: req.tenantId,
          updatedBy: req.user.username
        });
      } catch (settingsError) {
        logger.warn('Settings model sync failed (non-critical)', {
          tenantId: req.tenantId,
          error: settingsError.message
        });
      }
    }

    // Return merged response
    // FIXED: Return the actual saved values, not fallbacks
    const responseData = {
      businessName: updatedTenant.businessName,
      businessType: updatedTenant.businessType,
      contactInfo: {
        email: updatedTenant.contactInfo?.email || '',
        phone: updatedTenant.contactInfo?.phone || '',
        address: updatedTenant.contactInfo?.address || '',
        website: updatedTenant.contactInfo?.website || ''
      },
      branding: {
        logo: updatedTenant.branding?.logo || '',
        primaryColor: updatedTenant.branding?.primaryColor || '#3B82F6',
        secondaryColor: updatedTenant.branding?.secondaryColor || '#10B981'
      },
      settings: {
        notificationEmails: updatedTenant.settings?.notificationEmails || [],
        // Return the primary notification email from Tenant model
        // Falls back to contact email only if no primary notification email is set
        notificationEmail: updatedTenant.settings?.primaryNotificationEmail || updatedTenant.contactInfo?.email || '',
        timezone: updatedTenant.settings?.timezone || 'Africa/Lagos',
        currency: updatedTenant.settings?.currency || 'NGN',
        vatRate: updatedTenant.settings?.vatRate ?? 7.5
      }
    };

    res.json(responseData);

  } catch (error) {
    logger.error('Failed to update tenant settings', {
      tenantId: req.tenantId,
      error: error.message,
      userId: req.user.id,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });

    if (error.name === 'ValidationError') {
      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'Invalid data provided',
        details: Object.keys(error.errors).map(key => ({
          field: key,
          message: error.errors[key].message
        }))
      });
    }

    res.status(500).json({
      error: 'SETTINGS_UPDATE_ERROR',
      message: 'Failed to update settings: ' + error.message
    });
  }
});

// PUT /api/settings - Legacy support (redirect to /update)
router.put('/', async (req, res) => {
  req.url = '/update';
  router.handle(req, res);
});

// GET /api/settings/branding - Public branding info (for login pages)
router.get('/branding', async (req, res) => {
  try {
    if (!req.tenant) {
      return res.status(404).json({
        error: 'TENANT_NOT_FOUND',
        message: 'Business not found'
      });
    }

    // Always use Tenant model for branding (source of truth)
    const brandingInfo = {
      businessName: req.tenant.businessName || 'Business',
      businessType: req.tenant.businessType || 'general',
      branding: {
        logo: req.tenant.branding?.logo || null,
        primaryColor: req.tenant.branding?.primaryColor || '#3B82F6',
        secondaryColor: req.tenant.branding?.secondaryColor || '#10B981'
      }
    };

    res.json({ branding: brandingInfo });

  } catch (error) {
    logger.error('Failed to fetch branding info', {
      tenantId: req.tenantId,
      error: error.message
    });

    res.status(500).json({
      error: 'FETCH_BRANDING_FAILED',
      message: 'Failed to fetch branding information'
    });
  }
});

// Helper middleware to handle multer errors properly
const handleMulterError = (uploadMiddleware) => {
  return (req, res, next) => {
    uploadMiddleware(req, res, (err) => {
      if (err) {
        // Handle multer-specific errors
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({
            error: 'FILE_TOO_LARGE',
            message: 'File size exceeds the 2MB limit'
          });
        }
        if (err.code === 'LIMIT_FILE_COUNT') {
          return res.status(400).json({
            error: 'TOO_MANY_FILES',
            message: 'Only one file can be uploaded at a time'
          });
        }
        if (err.code === 'LIMIT_UNEXPECTED_FILE') {
          return res.status(400).json({
            error: 'UNEXPECTED_FIELD',
            message: 'Unexpected field name. Use "logo" as the field name.'
          });
        }
        // Handle custom errors from fileFilter
        if (err.message) {
          return res.status(400).json({
            error: 'UPLOAD_ERROR',
            message: err.message
          });
        }
        // Generic multer error
        return res.status(500).json({
          error: 'UPLOAD_FAILED',
          message: 'Failed to upload file'
        });
      }
      next();
    });
  };
};

// POST /api/settings/logo - Upload logo file (replaces base64 storage)
router.post('/logo', handleMulterError(logoUpload.single('logo')), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        error: 'NO_FILE',
        message: 'No logo file uploaded'
      });
    }

    // Generate the URL path for the logo
    const logoUrl = `/uploads/${req.tenantId}/branding/${req.file.filename}`;

    // Get current tenant to check for old logo
    const currentTenant = await Tenant.findOne({ tenantId: req.tenantId });
    const oldLogo = currentTenant?.branding?.logo;

    // Delete old logo file if it exists and is a file path (not base64)
    if (oldLogo && oldLogo.startsWith('/uploads/') && !oldLogo.startsWith('data:')) {
      const oldLogoPath = path.join(__dirname, '..', oldLogo);
      if (fs.existsSync(oldLogoPath)) {
        try {
          fs.unlinkSync(oldLogoPath);
          logger.info('Deleted old logo file', { tenantId: req.tenantId, oldLogo });
        } catch (err) {
          logger.warn('Failed to delete old logo file', { tenantId: req.tenantId, error: err.message });
        }
      }
    }

    // Update tenant with new logo URL (upsert to create if not exists)
    const updatedTenant = await Tenant.findOneAndUpdate(
      { tenantId: req.tenantId },
      { $set: { 'branding.logo': logoUrl } },
      { new: true, upsert: true }
    );

    logger.info('Logo uploaded successfully', {
      tenantId: req.tenantId,
      logoUrl,
      uploadedBy: req.user?.username
    });

    res.json({
      success: true,
      logoUrl,
      message: 'Logo uploaded successfully'
    });

  } catch (error) {
    // Cleanup uploaded file on error
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }

    logger.error('Logo upload failed', {
      tenantId: req.tenantId,
      error: error.message
    });

    res.status(500).json({
      error: 'UPLOAD_FAILED',
      message: error.message || 'Failed to upload logo'
    });
  }
});

// DELETE /api/settings/logo - Remove logo
router.delete('/logo', async (req, res) => {
  try {
    // Get or create tenant for single-tenant
    const tenant = await Tenant.getOrCreate();
    const currentLogo = tenant.branding?.logo;

    // Delete logo file if it's a file path
    if (currentLogo && currentLogo.startsWith('/uploads/')) {
      const logoPath = path.join(__dirname, '..', currentLogo);
      if (fs.existsSync(logoPath)) {
        fs.unlinkSync(logoPath);
        logger.info('Logo file deleted', { tenantId: req.tenantId });
      }
    }

    // Clear logo in database
    await Tenant.findOneAndUpdate(
      { tenantId: req.tenantId },
      { $set: { 'branding.logo': '' } }
    );

    res.json({
      success: true,
      message: 'Logo removed successfully'
    });

  } catch (error) {
    logger.error('Logo deletion failed', {
      tenantId: req.tenantId,
      error: error.message
    });

    res.status(500).json({
      error: 'DELETE_FAILED',
      message: 'Failed to remove logo'
    });
  }
});

// POST /api/settings/test-email - Send a test email to verify SMTP configuration
router.post('/test-email', async (req, res) => {
  try {
    const { recipientEmail } = req.body;

    if (!recipientEmail) {
      return res.status(400).json({
        error: 'EMAIL_REQUIRED',
        message: 'Recipient email address is required'
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(recipientEmail)) {
      return res.status(400).json({
        error: 'INVALID_EMAIL',
        message: 'Invalid email address format'
      });
    }

    // Import email utility
    const sendEmail = require('../utils/email');

    // Get tenant info for branding
    const tenant = await Tenant.getOrCreate();

    // Send test email
    const result = await sendEmail(recipientEmail, 'daily_business_report', {
      date: new Date().toLocaleDateString('en-NG', { dateStyle: 'full' }),
      totalRevenue: 0,
      totalTransactions: 0,
      avgTransaction: 0,
      totalExpenses: 0,
      netProfit: 0,
      attendanceCount: 0,
      inventoryCount: 0,
      checkoutsCount: 0,
      customersCount: 0,
      dashboardUrl: process.env.FRONTEND_URL || 'https://app.opsuite.io',
      generatedAt: new Date().toLocaleString('en-NG'),
      testEmail: true
    }, tenant);

    logger.info('Test email sent successfully', {
      tenantId: req.tenantId,
      recipient: recipientEmail,
      messageId: result.messageId,
      sentBy: req.user?.username
    });

    res.json({
      success: true,
      message: `Test email sent successfully to ${recipientEmail}`,
      messageId: result.messageId
    });

  } catch (error) {
    logger.error('Test email failed', {
      tenantId: req.tenantId,
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });

    res.status(500).json({
      error: 'EMAIL_SEND_FAILED',
      message: `Failed to send test email: ${error.message}`
    });
  }
});

module.exports = router;