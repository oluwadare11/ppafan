// middleware/twoFactor.js - Two-Factor Authentication with TOTP
const speakeasy = require('speakeasy');
const QRCode = require('qrcode');
const logger = require('../utils/logger');

/**
 * Generate 2FA secret for a user
 */
const generate2FASecret = async (username, businessName = 'Opsuite') => {
  try {
    const secret = speakeasy.generateSecret({
      name: `${businessName} (${username})`,
      issuer: 'Opsuite.io',
      length: 32
    });

    // Generate QR code for easy scanning
    const qrCodeDataUrl = await QRCode.toDataURL(secret.otpauth_url);

    logger.info('2FA secret generated', {
      username: username,
      businessName: businessName
    });

    return {
      secret: secret.base32, // Store this in database (encrypted)
      qrCode: qrCodeDataUrl,
      otpauthUrl: secret.otpauth_url,
      backupCodes: generateBackupCodes() // Generate backup codes
    };
  } catch (error) {
    logger.error('Failed to generate 2FA secret', {
      username: username,
      error: error.message
    });
    throw error;
  }
};

/**
 * Generate backup codes (8 codes, 8 characters each)
 */
const generateBackupCodes = (count = 8) => {
  const codes = [];
  const crypto = require('crypto');

  for (let i = 0; i < count; i++) {
    // Generate random 8-character alphanumeric code
    const code = crypto.randomBytes(4).toString('hex').toUpperCase();
    codes.push(code);
  }

  return codes;
};

/**
 * Verify TOTP token
 */
const verify2FAToken = (secret, token) => {
  if (!secret || !token) {
    return false;
  }

  try {
    // Allow for 1 time step before and after (30 second window)
    const isValid = speakeasy.totp.verify({
      secret: secret,
      encoding: 'base32',
      token: token.toString().replace(/\s/g, ''), // Remove spaces
      window: 1 // Allow 1 time step variance (±30 seconds)
    });

    logger.debug('2FA token verification', {
      isValid: isValid,
      tokenLength: token.length
    });

    return isValid;
  } catch (error) {
    logger.error('2FA token verification error', {
      error: error.message
    });
    return false;
  }
};

/**
 * Verify backup code
 */
const verifyBackupCode = async (userId, code, TenantUser) => {
  if (!code || !userId) {
    return false;
  }

  try {
    const user = await TenantUser.findById(userId);

    if (!user || !user.twoFactorAuth || !user.twoFactorAuth.backupCodes) {
      return false;
    }

    const bcrypt = require('bcryptjs');
    const cleanCode = code.toUpperCase().replace(/\s/g, '');

    // Check each backup code (they're hashed)
    for (let i = 0; i < user.twoFactorAuth.backupCodes.length; i++) {
      const isMatch = await bcrypt.compare(cleanCode, user.twoFactorAuth.backupCodes[i]);

      if (isMatch) {
        // Remove used backup code
        user.twoFactorAuth.backupCodes.splice(i, 1);
        await user.save();

        logger.info('Backup code used successfully', {
          userId: userId,
          remainingCodes: user.twoFactorAuth.backupCodes.length
        });

        return true;
      }
    }

    return false;
  } catch (error) {
    logger.error('Backup code verification error', {
      userId: userId,
      error: error.message
    });
    return false;
  }
};

/**
 * 2FA Required Middleware
 * Checks if user has 2FA enabled and verified in current session
 */
const require2FA = async (req, res, next) => {
  // Only apply to admin and super_admin roles
  if (!req.user || !['admin', 'super_admin'].includes(req.user.role)) {
    return next();
  }

  // Check if 2FA is verified in current session
  if (req.user.twoFactorVerified) {
    return next();
  }

  // Get user from database
  const TenantUser = req.getTenantModel ? req.getTenantModel('User') : null;

  if (!TenantUser) {
    logger.error('Cannot verify 2FA - no tenant model', {
      userId: req.user.id,
      path: req.path
    });
    return res.status(500).json({
      error: 'SYSTEM_ERROR',
      message: 'System error during 2FA verification'
    });
  }

  const user = await TenantUser.findById(req.user.id);

  if (!user) {
    return res.status(401).json({
      error: 'USER_NOT_FOUND',
      message: 'User not found'
    });
  }

  // Check if user has 2FA enabled
  if (!user.twoFactorAuth || !user.twoFactorAuth.enabled) {
    // 2FA not enabled yet - allow but mark for setup
    req.require2FASetup = true;
    return next();
  }

  // 2FA enabled but not verified in this session
  logger.warn('2FA verification required', {
    userId: req.user.id,
    username: req.user.username,
    path: req.path
  });

  return res.status(403).json({
    error: 'TWO_FACTOR_REQUIRED',
    message: 'Two-factor authentication verification required',
    requires2FA: true
  });
};

/**
 * Optional 2FA check (doesn't block, just flags)
 */
const optional2FACheck = async (req, res, next) => {
  if (req.user && ['admin', 'super_admin'].includes(req.user.role)) {
    const TenantUser = req.getTenantModel ? req.getTenantModel('User') : null;

    if (TenantUser) {
      try {
        const user = await TenantUser.findById(req.user.id);
        if (user && user.twoFactorAuth && user.twoFactorAuth.enabled) {
          req.has2FAEnabled = true;
          req.is2FAVerified = req.user.twoFactorVerified || false;
        }
      } catch (error) {
        logger.error('Error checking 2FA status', {
          error: error.message
        });
      }
    }
  }
  next();
};

module.exports = {
  generate2FASecret,
  generateBackupCodes,
  verify2FAToken,
  verifyBackupCode,
  require2FA,
  optional2FACheck
};
