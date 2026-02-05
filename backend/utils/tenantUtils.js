// utils/tenantUtils.js - Multi-Tenant Helper Functions

/**
 * Get dynamic business templates based on tenant info
 */
function getBusinessTemplates(tenantInfo) {
  const businessName = tenantInfo?.businessName || 'Your Business';
  const website = tenantInfo?.contactInfo?.website || 'yourbusiness.com';
  const email = tenantInfo?.contactInfo?.email || 'info@yourbusiness.com';
  const phone = tenantInfo?.contactInfo?.phone || '';
  const address = tenantInfo?.contactInfo?.address || '';
  
  return {
    // Email templates
    email: {
      welcome: {
        subject: `Welcome to ${businessName}!`,
        html: `
          <h2>Welcome to ${businessName}!</h2>
          <p>Thank you for choosing us. We're excited to serve you!</p>
          <p>Visit us at: ${website}</p>
          <p>Contact us: ${email}</p>
        `
      },
      promotion: {
        subject: `Special Offer from ${businessName}`,
        html: `
          <h2>Special Offer Just for You!</h2>
          <p>Don't miss out on our latest deals at ${businessName}.</p>
          <p>Visit: ${website}</p>
        `
      }
    },

    // SMS templates
    sms: {
      welcome: `Welcome to ${businessName}! We're excited to help you. Visit ${website} or call ${phone}. Reply STOP to opt out.`,
      appointment_reminder: `Hi [Name], reminder: Your appointment at ${businessName} is tomorrow at [time]. See you soon! Reply STOP to opt out.`,
      promotion: `Special offer at ${businessName}! Get [discount]% off this week. Visit ${website} Reply STOP to opt out.`,
      birthday: `Happy Birthday [Name]! Celebrate with us at ${businessName} - enjoy 20% off this month. Reply STOP to opt out.`,
      follow_up: `Hi [Name], thanks for visiting ${businessName}! How was your experience? We'd love your feedback. Reply STOP to opt out.`,
      reactivation: `We miss you at ${businessName}! Come back & enjoy 15% off your next visit. Visit ${website} Reply STOP to opt out.`
    },

    // Receipt templates
    receipt: {
      header: businessName.toUpperCase(),
      subheader: tenantInfo?.businessType || 'Business Services',
      address: address || 'Address not configured',
      contact: phone ? `Tel: ${phone}` : 'Phone not configured',
      email: email,
      website: website,
      footer: `Thank you for choosing ${businessName}!`
    }
  };
}

/**
 * Get tenant-specific default settings
 */
function getTenantDefaults(tenantInfo) {
  const businessName = tenantInfo?.businessName || 'Your Business';
  const email = tenantInfo?.contactInfo?.email || 'info@yourbusiness.com';
  
  return {
    commsMarketing: {
      senderName: businessName,
      senderEmail: email,
      replyToEmail: email,
      emailFooter: `Sent with regards from ${businessName}`,
      sms: {
        senderId: businessName.substring(0, 11) || 'Business'
      }
    },
    pos: {
      receiptHeader: businessName,
      receiptFooter: `Thank you for choosing ${businessName}!`
    }
  };
}

/**
 * Generate PWA manifest based on tenant
 */
function generateTenantManifest(tenantInfo, baseUrl = '') {
  const businessName = tenantInfo?.businessName || 'Business Management';
  const shortName = tenantInfo?.businessName?.replace(/\s+/g, '').substring(0, 12) || 'Business';
  const primaryColor = tenantInfo?.branding?.primaryColor || '#3B82F6';
  const backgroundColor = tenantInfo?.branding?.secondaryColor || '#1e3a8a';
  const logo = tenantInfo?.branding?.logo;
  
  return {
    id: '/kiosk/login',
    name: `${businessName} Kiosk`,
    short_name: shortName,
    description: `${businessName} Point of Sale and Management System`,
    start_url: '/kiosk/login',
    display: 'standalone',
    background_color: backgroundColor,
    theme_color: primaryColor,
    orientation: 'portrait',
    scope: '/',
    icons: [
      {
        src: logo || '/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'maskable any'
      },
      {
        src: logo || '/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable any'
      }
    ],
    shortcuts: [
      {
        name: 'POS System',
        short_name: 'POS',
        description: 'Open Point of Sale',
        url: tenantInfo?.businessType?.includes('salon') ? '/kiosk/pos/salon' : '/kiosk/pos',
        icons: [{ src: logo || '/icon-192.png', sizes: '192x192' }]
      },
      {
        name: 'Inventory',
        short_name: 'Inventory',
        description: 'Inventory Management',
        url: '/kiosk/inventory',
        icons: [{ src: logo || '/icon-192.png', sizes: '192x192' }]
      }
    ],
    categories: ['business', 'productivity', 'retail'],
    prefer_related_applications: false
  };
}

/**
 * Get receipt formatting based on tenant
 */
function formatTenantReceipt(transaction, tenantInfo) {
  const templates = getBusinessTemplates(tenantInfo);
  const receipt = templates.receipt;
  
  return {
    header: receipt.header,
    subheader: receipt.subheader,
    businessInfo: {
      address: receipt.address,
      contact: receipt.contact,
      email: receipt.email,
      website: receipt.website
    },
    transaction: transaction,
    footer: receipt.footer,
    branding: {
      primaryColor: tenantInfo?.branding?.primaryColor || '#000000',
      logo: tenantInfo?.branding?.logo
    }
  };
}

/**
 * Validate and sanitize subdomain
 */
function validateSubdomain(subdomain) {
  if (!subdomain || typeof subdomain !== 'string') {
    return { valid: false, error: 'Subdomain is required' };
  }
  
  // Remove whitespace and convert to lowercase
  const cleaned = subdomain.trim().toLowerCase();
  
  // Check format (alphanumeric and hyphens only)
  if (!/^[a-z0-9-]+$/.test(cleaned)) {
    return { 
      valid: false, 
      error: 'Subdomain can only contain letters, numbers, and hyphens' 
    };
  }
  
  // Check length
  if (cleaned.length < 2 || cleaned.length > 30) {
    return { 
      valid: false, 
      error: 'Subdomain must be between 2 and 30 characters' 
    };
  }
  
  // Check for reserved words
  const reserved = [
    'www', 'api', 'admin', 'support', 'help', 'mail', 'ftp', 'blog',
    'shop', 'store', 'app', 'mobile', 'dev', 'test', 'staging'
  ];
  
  if (reserved.includes(cleaned)) {
    return { 
      valid: false, 
      error: `'${cleaned}' is a reserved subdomain` 
    };
  }
  
  return { valid: true, subdomain: cleaned };
}

/**
 * Extract tenant from request headers/host
 */
function extractTenantFromRequest(req) {
  const host = req.get('host') || req.get('x-forwarded-host') || '';
  const customSubdomain = req.get('x-tenant-subdomain');
  
  // Priority: Custom header > Subdomain extraction
  if (customSubdomain) {
    const validation = validateSubdomain(customSubdomain);
    return validation.valid ? validation.subdomain : null;
  }
  
  // Development: Extract from localhost subdomain
  if (host.includes('localhost')) {
    const parts = host.split('.');
    if (parts.length >= 2 && parts[1].includes('localhost')) {
      const validation = validateSubdomain(parts[0]);
      return validation.valid ? validation.subdomain : null;
    }
  }
  
  // Production: Extract from domain
  if (host.includes('opsuite.io')) {
    const parts = host.split('.');
    if (parts.length >= 3) {
      const validation = validateSubdomain(parts[0]);
      return validation.valid ? validation.subdomain : null;
    }
  }
  
  return null;
}

/**
 * Get cache key for tenant-specific data
 */
function getTenantCacheKey(tenantId, dataType) {
  return `tenant:${tenantId}:${dataType}`;
}

module.exports = {
  getBusinessTemplates,
  getTenantDefaults,
  generateTenantManifest,
  formatTenantReceipt,
  validateSubdomain,
  extractTenantFromRequest,
  getTenantCacheKey
};