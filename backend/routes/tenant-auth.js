// routes/tenant-auth.js - SECURE Tenant Authentication with Full Tenant Isolation
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const cookieParser = require('cookie-parser');
const { identifyTenant, addTenantHelpers } = require('../middleware/tenant');
const {
  generateTokenPair,
  refreshAccessToken,
  revokeRefreshToken,
  setSecureCookies,
  clearAuthCookies,
  extractToken,
  secureLog
} = require('../utils/secureAuth');

// Security enhancements - 2FA, reCAPTCHA, Session Management
const { recaptchaMiddleware } = require('../middleware/recaptcha');
const { generate2FASecret, verify2FAToken, verifyBackupCode } = require('../middleware/twoFactor');
const { requireAuthentication } = require('../middleware/cookieAuth');
const { sessionTracking } = require('../middleware/sessionManager');
const logger = require('../utils/logger');

const router = express.Router();

// Enable cookie parsing
router.use(cookieParser());

// Apply tenant identification to all routes
router.use(identifyTenant);
router.use(addTenantHelpers);

// Rate limiting for login attempts
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 50, // 50 attempts per IP per tenant
  message: {
    error: 'TOO_MANY_LOGIN_ATTEMPTS',
    message: 'Too many login attempts. Please try again after 15 minutes.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

const kioskLoginLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 30, // 30 attempts per 5 minutes - more generous for busy cashiers
  message: {
    error: 'TOO_MANY_KIOSK_ATTEMPTS',
    message: 'Too many login attempts. Please wait a few minutes and try again.',
  },
  standardHeaders: true,
  legacyHeaders: false,
  // Skip rate limiting for successful requests
  skipSuccessfulRequests: true,
});

const forgotPasswordLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // 3 attempts per hour
  message: {
    error: 'TOO_MANY_RESET_REQUESTS',
    message: 'Too many password reset requests. Please try again in an hour.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * CRITICAL SECURITY: Validate tenant-user relationship
 * This prevents username collision attacks across tenants
 */
const validateTenantUserBinding = (user, tenantId) => {
  // Ensure user belongs to the correct tenant
  if (user.tenantId && user.tenantId !== tenantId) {
    secureLog('critical', 'TENANT_ISOLATION_VIOLATION: User from different tenant attempted login', {
      userTenantId: user.tenantId,
      requestTenantId: tenantId,
      userId: user._id,
      username: user.username
    });
    return false;
  }
  return true;
};

/**
 * SECURE TENANT ADMIN LOGIN
 * POST /api/auth/login
 * Enhanced with reCAPTCHA v3 and Session Tracking
 */
router.post('/login',
  loginLimiter,
  recaptchaMiddleware({ action: 'login', minScore: 0.5 }),
  sessionTracking,
  async (req, res) => {
  try {
    const { username, password } = req.body;

    // Basic validation
    if (!username || !password) {
      secureLog('warn', 'Login attempt with missing credentials', {
        tenantId: req.tenantId,
        ip: req.ip
      });
      return res.status(400).json({ 
        error: 'MISSING_CREDENTIALS',
        message: 'Username and password are required' 
      });
    }

    // CRITICAL: Ensure tenant context exists
    if (!req.tenant || !req.tenantId) {
      secureLog('critical', 'Login attempt without tenant context', {
        username: username,
        ip: req.ip,
        origin: req.headers.origin
      });
      return res.status(400).json({
        error: 'TENANT_CONTEXT_MISSING',
        message: 'Invalid tenant context. Please use the correct subdomain.'
      });
    }

    // ================================================================
    // SUBSCRIPTION STATUS CHECK - Block login for inactive subscriptions
    // Industry standard: prevent login instead of allowing then blocking
    // ================================================================
    if (req.tenant.status === 'suspended') {
      secureLog('warn', 'Login blocked: Tenant suspended', {
        tenantId: req.tenantId,
        businessName: req.tenant.businessName,
        username: username,
        ip: req.ip
      });
      return res.status(403).json({
        error: 'ACCOUNT_SUSPENDED',
        message: 'This business account has been suspended. Please contact support for assistance.',
        supportEmail: 'support@opsuite.io'
      });
    }

    if (req.tenant.status === 'archived') {
      secureLog('warn', 'Login blocked: Tenant archived', {
        tenantId: req.tenantId,
        businessName: req.tenant.businessName,
        username: username,
        ip: req.ip
      });
      return res.status(403).json({
        error: 'ACCOUNT_ARCHIVED',
        message: 'This business account is no longer active. Please contact support for assistance.',
        supportEmail: 'support@opsuite.io'
      });
    }

    // ================================================================
    // SUBSCRIPTION CHECK - Simplified for single-tenant (always active)
    // ================================================================
    // Single-tenant Pump House ERP - subscription is always active
    // No grace period checks needed
    // ================================================================

    // Regular login - check tenant-specific users collection
    const TenantUser = req.getTenantModel('User');
    if (!TenantUser) {
      secureLog('error', 'Failed to get tenant user model', {
        tenantId: req.tenantId
      });
      return res.status(500).json({
        error: 'SYSTEM_ERROR',
        message: 'System error during authentication'
      });
    }

   const user = await TenantUser.findOne({ username }).select('+password');

    if (!user) {
      secureLog('warn', 'Login failed: User not found', {
        tenantId: req.tenantId,
        username: username,
        ip: req.ip
      });
      return res.status(400).json({ 
        error: 'INVALID_CREDENTIALS',
        message: 'Invalid username or password' 
      });
    }

    // CRITICAL SECURITY: Validate tenant-user binding
    if (!validateTenantUserBinding(user, req.tenantId)) {
      return res.status(403).json({
        error: 'TENANT_ISOLATION_VIOLATION',
        message: 'Access denied'
      });
    }

    if (!user.confirmed) {
      secureLog('warn', 'Login failed: User not confirmed', {
        tenantId: req.tenantId,
        username: username,
        userId: user._id,
        ip: req.ip
      });
      return res.status(403).json({ 
        error: 'ACCOUNT_NOT_CONFIRMED',
        message: 'Account not confirmed by admin' 
      });
    }

    if (!user.password) {
      secureLog('warn', 'Login failed: No password set', {
        tenantId: req.tenantId,
        username: username,
        userId: user._id,
        ip: req.ip
      });
      return res.status(400).json({ 
        error: 'INVALID_CREDENTIALS',
        message: 'Invalid username or password' 
      });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      secureLog('warn', 'Login failed: Incorrect password', {
        tenantId: req.tenantId,
        username: username,
        userId: user._id,
        ip: req.ip
      });
      return res.status(400).json({
        error: 'INVALID_CREDENTIALS',
        message: 'Invalid username or password'
      });
    }

    // 2FA validation if enabled
    if (user.twoFactorAuth && user.twoFactorAuth.enabled) {
      const { twoFactorCode } = req.body;

      if (!twoFactorCode) {
        secureLog('info', 'Login requires 2FA code', {
          tenantId: req.tenantId,
          username: username,
          userId: user._id,
          ip: req.ip
        });
        return res.status(200).json({
          requires2FA: true,
          message: 'Two-factor authentication code required',
          userId: user._id
        });
      }

      // Verify 2FA code
      const isValid2FA = verify2FAToken(user.twoFactorAuth.secret, twoFactorCode);

      if (!isValid2FA) {
        // Try backup code
        const backupCodeValid = await verifyBackupCode(user._id, twoFactorCode, TenantUser);

        if (!backupCodeValid) {
          secureLog('warn', '2FA verification failed', {
            tenantId: req.tenantId,
            username: username,
            userId: user._id,
            ip: req.ip
          });
          return res.status(400).json({
            error: 'INVALID_2FA_CODE',
            message: 'Invalid two-factor authentication code'
          });
        }

        secureLog('info', 'Login successful with backup code', {
          tenantId: req.tenantId,
          username: username,
          userId: user._id,
          ip: req.ip
        });
      }
    }

    // Generate secure token pair
    const { accessToken, refreshToken } = generateTokenPair({
      id: user._id,
      username: user.username,
      role: user.role,
      tenantId: req.tenantId // CRITICAL: Include tenantId in token
    });

    // Set secure cookies with sessionId for CSRF token generation
    const csrfToken = setSecureCookies(res, accessToken, refreshToken, {
      sessionId: `user_${user._id}`
    });

    // Update last login
    user.lastLogin = new Date();
    await user.save();

    secureLog('info', 'Tenant user login successful', {
      tenantId: req.tenantId,
      username: username,
      userId: user._id,
      role: user.role,
      businessName: req.tenant.businessName,
      ip: req.ip
    });

    res.json({
      success: true,
      user: {
        id: user._id,
        username: user.username,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        permissions: user.permissions || {},
        accessType: user.accessType,
        tenantId: req.tenantId,
        businessName: req.tenant.businessName,
        lastLogin: user.lastLogin
      },
      csrfToken
    });

  } catch (error) {
    secureLog('error', 'Login error', {
      tenantId: req.tenantId,
      error: error.message,
      ip: req.ip
    });

    res.status(500).json({ 
      error: 'LOGIN_ERROR',
      message: 'Server error during login' 
    });
  }
});

/**
 * KIOSK LOGIN - Employee Code + PIN
 * POST /api/auth/kiosk-login
 */
router.post('/kiosk-login',
  kioskLoginLimiter,
  sessionTracking,
  async (req, res) => {
  try {
    const { employeeCode, pin } = req.body;

    // Validation
    if (!employeeCode || !pin) {
      secureLog('warn', 'Kiosk login attempt with missing credentials', {
        tenantId: req.tenantId,
        ip: req.ip
      });
      return res.status(400).json({
        error: 'MISSING_CREDENTIALS',
        message: 'Employee code and PIN are required'
      });
    }

    // Validate format - Employee code: 1-4 digits (will be normalized), PIN: 4-6 digits
    if (!/^\d{1,4}$/.test(employeeCode)) {
      return res.status(400).json({
        error: 'INVALID_EMPLOYEE_CODE',
        message: 'Employee code must be 1-4 digits'
      });
    }

    if (!/^\d{4,6}$/.test(pin)) {
      return res.status(400).json({
        error: 'INVALID_PIN',
        message: 'PIN must be 4-6 digits'
      });
    }

    // Normalize employee code to 4 digits (e.g., "1" → "0001", "20" → "0020")
    const normalizedEmployeeCode = String(employeeCode).trim().padStart(4, '0');

    // CRITICAL: Ensure tenant context exists
    if (!req.tenant || !req.tenantId) {
      secureLog('critical', 'Kiosk login attempt without tenant context', {
        employeeCode: normalizedEmployeeCode,
        ip: req.ip
      });
      return res.status(400).json({
        error: 'TENANT_CONTEXT_MISSING',
        message: 'Invalid tenant context'
      });
    }

    // SUBSCRIPTION STATUS CHECK - Block kiosk login for inactive subscriptions
    if (req.tenant.status === 'suspended' || req.tenant.status === 'archived') {
      secureLog('warn', 'Kiosk login blocked: Tenant inactive', {
        tenantId: req.tenantId,
        status: req.tenant.status,
        employeeCode: normalizedEmployeeCode,
        ip: req.ip
      });
      return res.status(403).json({
        error: 'ACCOUNT_INACTIVE',
        message: 'This business account is not active. Please contact your manager.'
      });
    }

    // Single-tenant Pump House ERP - subscription is always active
    // No subscription check needed for kiosk login

    const TenantUser = req.getTenantModel('User');
    if (!TenantUser) {
      return res.status(500).json({
        error: 'SYSTEM_ERROR',
        message: 'System error during authentication'
      });
    }

    // Find user by normalized employee code (with PIN field selected)
    const user = await TenantUser.findOne({
      employeeCode: normalizedEmployeeCode,
      tenantId: req.tenantId,
      accessType: { $in: ['kiosk_only', 'both'] }
    }).select('+pin');

    if (!user || !user.confirmed || !user.pin) {
      secureLog('warn', 'Kiosk login failed: Invalid credentials', {
        tenantId: req.tenantId,
        employeeCode: employeeCode,
        ip: req.ip
      });
      return res.status(400).json({
        error: 'INVALID_CREDENTIALS',
        message: 'Invalid employee code or PIN'
      });
    }

    // Check if account is locked
    if (user.isLocked()) {
      const lockMinutes = Math.ceil((user.lockedUntil - Date.now()) / 60000);
      secureLog('warn', 'Kiosk login attempt on locked account', {
        tenantId: req.tenantId,
        userId: user._id,
        employeeCode: employeeCode,
        lockMinutes: lockMinutes,
        ip: req.ip
      });
      return res.status(403).json({
        error: 'ACCOUNT_LOCKED',
        message: `Account is locked. Please try again in ${lockMinutes} minutes.`
      });
    }

    // Check if account is inactive
    if (user.status !== 'active') {
      secureLog('warn', 'Kiosk login attempt on inactive account', {
        tenantId: req.tenantId,
        userId: user._id,
        employeeCode: employeeCode,
        status: user.status,
        ip: req.ip
      });
      return res.status(403).json({
        error: 'ACCOUNT_INACTIVE',
        message: 'Account is not active. Please contact your administrator.'
      });
    }

    // CRITICAL SECURITY: Validate tenant-user binding
    if (!validateTenantUserBinding(user, req.tenantId)) {
      return res.status(403).json({
        error: 'TENANT_ISOLATION_VIOLATION',
        message: 'Access denied'
      });
    }

    // Verify PIN
    const isMatch = await bcrypt.compare(pin.toString(), user.pin);
    if (!isMatch) {
      // Increment failed attempts
      await user.incrementLoginAttempts();

      secureLog('warn', 'Kiosk login failed: Incorrect PIN', {
        tenantId: req.tenantId,
        employeeCode: employeeCode,
        userId: user._id,
        failedAttempts: user.failedLoginAttempts + 1,
        ip: req.ip
      });

      return res.status(400).json({
        error: 'INVALID_CREDENTIALS',
        message: 'Invalid employee code or PIN'
      });
    }

    // Reset failed attempts on successful login
    await user.resetLoginAttempts();

    // Update last login info
    await TenantUser.findByIdAndUpdate(user._id, {
      lastLogin: new Date(),
      lastLoginIP: req.ip
    });

    // Generate secure token pair
    const { accessToken, refreshToken } = generateTokenPair({
      id: user._id,
      username: user.username,
      role: user.role,
      tenantId: req.tenantId // CRITICAL: Include tenantId in token
    });

    // Set secure cookies with kiosk prefix to separate from admin auth
    const csrfToken = setSecureCookies(res, accessToken, refreshToken, {
      prefix: 'kiosk',
      sessionId: `user_${user._id}`
    });

    secureLog('info', 'Kiosk login successful', {
      tenantId: req.tenantId,
      username: user.username,
      userId: user._id,
      employeeCode: employeeCode,
      role: user.role,
      ip: req.ip
    });

    res.json({
      success: true,
      user: {
        id: user._id,
        username: user.username,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        tenantId: req.tenantId,
        businessName: req.tenant.businessName
      },
      csrfToken
    });

  } catch (error) {
    secureLog('error', 'Kiosk login error', {
      tenantId: req.tenantId,
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      ip: req.ip
    });

    res.status(500).json({
      error: 'KIOSK_LOGIN_ERROR',
      message: 'Server error during kiosk login'
    });
  }
});

/**
 * KIOSK VERIFY - Verify kiosk session is valid
 * GET /api/auth/kiosk-verify
 * Used by kiosk components to check if user is authenticated
 */
router.get('/kiosk-verify', async (req, res) => {
  try {
    const accessToken = req.cookies?.kioskAccessToken;

    if (!accessToken) {
      return res.status(401).json({
        authenticated: false,
        error: 'NO_TOKEN',
        message: 'No kiosk session found'
      });
    }

    // Verify the token
    try {
      const decoded = jwt.verify(accessToken, process.env.JWT_SECRET);

      // Validate tenant binding
      if (decoded.tenantId !== req.tenantId) {
        return res.status(403).json({
          authenticated: false,
          error: 'TENANT_MISMATCH',
          message: 'Invalid session'
        });
      }

      // Get user info with staffId for sales tracking
      const TenantUser = req.getTenantModel('User');
      const user = await TenantUser.findById(decoded.id).select('username firstName lastName role status staffId');

      if (!user || user.status !== 'active') {
        return res.status(401).json({
          authenticated: false,
          error: 'USER_NOT_FOUND',
          message: 'User not found or inactive'
        });
      }

      // Get staff commission settings if staff is linked
      let staffInfo = null;
      if (user.staffId) {
        const TenantStaff = req.getTenantModel('Staff');
        const staff = await TenantStaff.findById(user.staffId).select('firstName lastName employeeId commission');
        if (staff) {
          staffInfo = {
            staffId: staff._id,
            employeeId: staff.employeeId,
            name: `${staff.firstName} ${staff.lastName}`,
            commissionEnabled: staff.commission?.enabled || false,
            commissionRate: staff.commission?.rate || 0,
            commissionType: staff.commission?.type || 'percentage'
          };
        }
      }

      res.json({
        authenticated: true,
        user: {
          id: user._id,
          username: user.username,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role,
          tenantId: decoded.tenantId,
          staffId: user.staffId || null,
          staff: staffInfo
        }
      });
    } catch (jwtError) {
      // Try to refresh the token
      const refreshToken = req.cookies?.kioskRefreshToken;
      if (!refreshToken) {
        return res.status(401).json({
          authenticated: false,
          error: 'TOKEN_EXPIRED',
          message: 'Session expired. Please log in again.'
        });
      }

      try {
        // Verify refresh token
        const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);

        // Generate new access token
        const newAccessToken = jwt.sign(
          { id: decoded.id, username: decoded.username, role: decoded.role, tenantId: decoded.tenantId },
          process.env.JWT_SECRET,
          { expiresIn: '15m' }
        );

        // Set new access token cookie
        res.cookie('kioskAccessToken', newAccessToken, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          maxAge: 15 * 60 * 1000 // 15 minutes
        });

        // Get user info
        const TenantUser = req.getTenantModel('User');
        const user = await TenantUser.findById(decoded.id).select('username firstName lastName role');

        res.json({
          authenticated: true,
          refreshed: true,
          user: {
            id: user._id,
            username: user.username,
            firstName: user.firstName,
            lastName: user.lastName,
            role: user.role,
            tenantId: decoded.tenantId
          }
        });
      } catch (refreshError) {
        return res.status(401).json({
          authenticated: false,
          error: 'SESSION_INVALID',
          message: 'Session invalid. Please log in again.'
        });
      }
    }
  } catch (error) {
    secureLog('error', 'Kiosk verify error', {
      tenantId: req.tenantId,
      error: error.message,
      ip: req.ip
    });

    res.status(500).json({
      authenticated: false,
      error: 'VERIFY_ERROR',
      message: 'Error verifying session'
    });
  }
});

/**
 * KIOSK LOGOUT - Clear kiosk-specific cookies
 * POST /api/auth/kiosk-logout
 */
router.post('/kiosk-logout', async (req, res) => {
  try {
    const refreshToken = req.cookies?.kioskRefreshToken;

    // Revoke refresh token if it exists
    if (refreshToken) {
      try {
        revokeRefreshToken(refreshToken);
      } catch (error) {
        // Token might already be invalid, continue with logout
      }
    }

    // Clear kiosk auth cookies with prefix
    clearAuthCookies(res, { prefix: 'kiosk' });

    secureLog('info', 'Kiosk logout successful', {
      tenantId: req.tenantId,
      ip: req.ip
    });

    res.json({
      success: true,
      message: 'Logged out successfully'
    });

  } catch (error) {
    secureLog('error', 'Kiosk logout error', {
      tenantId: req.tenantId,
      error: error.message,
      ip: req.ip
    });

    // Still clear cookies even if there's an error
    clearAuthCookies(res, { prefix: 'kiosk' });

    res.status(500).json({
      error: 'LOGOUT_ERROR',
      message: 'Error during logout'
    });
  }
});

/**
 * SECURE FORGOT PASSWORD (Tenant-specific)
 * POST /api/auth/forgot-password
 */
router.post('/forgot-password', forgotPasswordLimiter, async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        error: 'EMAIL_REQUIRED',
        message: 'Email address is required'
      });
    }

    // CRITICAL: Ensure tenant context exists
    if (!req.tenant || !req.tenantId) {
      secureLog('critical', 'Password reset attempt without tenant context', {
        email: email,
        ip: req.ip
      });
      return res.status(400).json({
        error: 'TENANT_CONTEXT_MISSING',
        message: 'Invalid tenant context'
      });
    }

    // Always return success to prevent email enumeration
    const standardResponse = {
      success: true,
      message: 'If an account exists with this email, you will receive password reset instructions.'
    };

    const TenantUser = req.getTenantModel('User');
    if (!TenantUser) {
      return res.json(standardResponse);
    }

    // Check if user exists in this tenant
    const user = await TenantUser.findOne({ 
      email: email.toLowerCase(),
      confirmed: true 
    });

    if (!user) {
      secureLog('info', 'Password reset requested for non-existent user', {
        tenantId: req.tenantId,
        email: email,
        ip: req.ip
      });
      return res.json(standardResponse);
    }

    // CRITICAL SECURITY: Validate tenant-user binding
    if (!validateTenantUserBinding(user, req.tenantId)) {
      return res.json(standardResponse);
    }

    // Generate secure reset token
    const crypto = require('crypto');
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenHash = crypto.createHash('sha256').update(resetToken).digest('hex');

    // Store reset token with 15-minute expiry
    user.passwordResetToken = resetTokenHash;
    user.passwordResetExpires = Date.now() + 15 * 60 * 1000; // 15 minutes
    await user.save();

    // Send tenant-specific reset email
    const sendEmail = require('../utils/email');
    const resetUrl = process.env.NODE_ENV === 'development' 
      ? `http://${req.tenant.subdomain}.localhost:5173/reset-password?token=${resetToken}`
      : `https://${req.tenant.subdomain}.opsuite.io/reset-password?token=${resetToken}`;

    try {
      await sendEmail(user.email, 'password_reset', {
        businessName: req.tenant.businessName,
        username: user.username,
        resetUrl: resetUrl,
        expiryMinutes: 15
      }, req.tenant);

      secureLog('info', 'Password reset email sent', {
        tenantId: req.tenantId,
        userId: user._id,
        email: user.email,
        ip: req.ip
      });
    } catch (emailError) {
      secureLog('error', 'Password reset email failed', {
        tenantId: req.tenantId,
        userId: user._id,
        error: emailError.message
      });
    }

    res.json(standardResponse);

  } catch (error) {
    secureLog('error', 'Forgot password error', {
      tenantId: req.tenantId,
      error: error.message,
      ip: req.ip
    });

    res.json({
      success: true,
      message: 'If an account exists with this email, you will receive password reset instructions.'
    });
  }
});

/**
 * SECURE RESET PASSWORD (Tenant-specific)
 * POST /api/auth/reset-password
 */
router.post('/reset-password', async (req, res) => {
  try {
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
      return res.status(400).json({
        error: 'MISSING_FIELDS',
        message: 'Token and new password are required'
      });
    }

    // Password strength validation
    if (newPassword.length < 8) {
      return res.status(400).json({
        error: 'WEAK_PASSWORD',
        message: 'Password must be at least 8 characters long'
      });
    }

    const hasUpperCase = /[A-Z]/.test(newPassword);
    const hasLowerCase = /[a-z]/.test(newPassword);
    const hasNumbers = /\d/.test(newPassword);
    const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(newPassword);

    if (!(hasUpperCase && hasLowerCase && hasNumbers && hasSpecialChar)) {
      return res.status(400).json({
        error: 'WEAK_PASSWORD',
        message: 'Password must contain uppercase, lowercase, numbers, and special characters'
      });
    }

    // CRITICAL: Ensure tenant context exists
    if (!req.tenant || !req.tenantId) {
      secureLog('critical', 'Password reset attempt without tenant context', {
        ip: req.ip
      });
      return res.status(400).json({
        error: 'TENANT_CONTEXT_MISSING',
        message: 'Invalid tenant context'
      });
    }

    const TenantUser = req.getTenantModel('User');
    if (!TenantUser) {
      return res.status(500).json({
        error: 'SYSTEM_ERROR',
        message: 'System error during password reset'
      });
    }

    // Hash the token to find the user
    const crypto = require('crypto');
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

    const user = await TenantUser.findOne({
      passwordResetToken: hashedToken,
      passwordResetExpires: { $gt: Date.now() }
    });

    if (!user) {
      secureLog('warn', 'Password reset failed: Invalid or expired token', {
        tenantId: req.tenantId,
        ip: req.ip
      });
      return res.status(400).json({
        error: 'INVALID_TOKEN',
        message: 'Invalid or expired reset token'
      });
    }

    // CRITICAL SECURITY: Validate tenant-user binding
    if (!validateTenantUserBinding(user, req.tenantId)) {
      return res.status(403).json({
        error: 'TENANT_ISOLATION_VIOLATION',
        message: 'Access denied'
      });
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 12);

    // Update user password and clear reset fields
    user.password = hashedPassword;
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    user.passwordChangedAt = new Date();
    await user.save();

    secureLog('info', 'Password reset successful', {
      tenantId: req.tenantId,
      userId: user._id,
      username: user.username,
      ip: req.ip
    });

    res.json({
      success: true,
      message: 'Password reset successfully'
    });

  } catch (error) {
    secureLog('error', 'Reset password error', {
      tenantId: req.tenantId,
      error: error.message,
      ip: req.ip
    });

    res.status(500).json({
      error: 'RESET_PASSWORD_ERROR',
      message: 'Server error during password reset'
    });
  }
});

/**
 * TOKEN REFRESH ENDPOINT
 * POST /api/auth/refresh
 */
router.post('/refresh', async (req, res) => {
  try {
    const refreshToken = req.cookies?.refreshToken;

    if (!refreshToken) {
      return res.status(401).json({
        error: 'NO_REFRESH_TOKEN',
        message: 'Refresh token required'
      });
    }

    // Generate new access token
    const newAccessToken = refreshAccessToken(refreshToken);

    // Cookie options matching secureAuth.js for consistency
    const isDevelopment = process.env.NODE_ENV === 'development';
    const cookieOptions = isDevelopment
      ? {
          httpOnly: true,
          secure: false,
          path: '/',
          maxAge: 15 * 60 * 1000 // 15 minutes
        }
      : {
          httpOnly: true,
          secure: true,
          sameSite: 'lax',
          domain: process.env.COOKIE_DOMAIN || '.thepumphouseng.com',
          path: '/',
          maxAge: 15 * 60 * 1000 // 15 minutes
        };

    // Set new access token cookie
    res.cookie('accessToken', newAccessToken, cookieOptions);

    secureLog('info', 'Token refreshed successfully', {
      tenantId: req.tenantId,
      ip: req.ip
    });

    res.json({
      success: true,
      message: 'Token refreshed successfully'
    });

  } catch (error) {
    secureLog('warn', 'Token refresh failed', {
      tenantId: req.tenantId,
      error: error.message,
      ip: req.ip
    });

    // Clear cookies if refresh fails
    clearAuthCookies(res);

    res.status(401).json({
      error: 'REFRESH_FAILED',
      message: 'Failed to refresh token'
    });
  }
});

/**
 * SECURE LOGOUT
 * POST /api/auth/logout
 */
router.post('/logout', async (req, res) => {
  try {
    const refreshToken = req.cookies?.refreshToken;
    
    // Revoke refresh token if it exists
    if (refreshToken) {
      try {
        revokeRefreshToken(refreshToken);
      } catch (error) {
        // Token might already be invalid, continue with logout
      }
    }

    // Clear all auth cookies
    clearAuthCookies(res);

    secureLog('info', 'User logout successful', {
      tenantId: req.tenantId,
      ip: req.ip
    });

    res.json({ 
      success: true, 
      message: 'Logged out successfully' 
    });

  } catch (error) {
    secureLog('error', 'Logout error', {
      tenantId: req.tenantId,
      error: error.message,
      ip: req.ip
    });

    // Still clear cookies even if there's an error
    clearAuthCookies(res);

    res.status(500).json({ 
      error: 'LOGOUT_ERROR',
      message: 'Error during logout' 
    });
  }
});

/**
 * SECURE TOKEN VERIFICATION WITH TENANT VALIDATION
 * GET /api/auth/verify
 */
router.get('/verify', async (req, res) => {
  try {
    const token = extractToken(req);
    
    if (!token) {
      return res.status(401).json({ 
        error: 'NO_TOKEN',
        message: 'No authentication token provided' 
      });
    }

    const jwt = require('jsonwebtoken');
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // CRITICAL SECURITY: Verify token belongs to this tenant
    if (decoded.tenantId !== req.tenantId) {
      secureLog('critical', 'Token verification failed: Tenant mismatch', {
        tokenTenantId: decoded.tenantId,
        requestTenantId: req.tenantId,
        userId: decoded.id,
        ip: req.ip
      });
      return res.status(401).json({ 
        error: 'TENANT_TOKEN_MISMATCH',
        message: 'Token not valid for this tenant' 
      });
    }

    // Check if user still exists in the correct tenant
    const TenantUser = req.getTenantModel('User');
    if (!TenantUser) {
      return res.status(500).json({
        error: 'SYSTEM_ERROR',
        message: 'System error during verification'
      });
    }

    const user = await TenantUser.findById(decoded.id).select('username firstName lastName role permissions accessType confirmed tenantId');

    if (!user || !user.confirmed) {
      secureLog('warn', 'Token verification failed: User not found or not confirmed', {
        tenantId: req.tenantId,
        userId: decoded.id,
        ip: req.ip
      });
      return res.status(401).json({ 
        error: 'USER_NOT_FOUND',
        message: 'User not found or account deactivated' 
      });
    }

    // CRITICAL SECURITY: Double-check tenant-user binding
    if (!validateTenantUserBinding(user, req.tenantId)) {
      return res.status(401).json({
        error: 'TENANT_ISOLATION_VIOLATION',
        message: 'Access denied'
      });
    }

    res.json({
      valid: true,
      user: {
        id: decoded.id,
        username: user.username,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        permissions: user.permissions || {},
        accessType: user.accessType,
        tenantId: req.tenantId,
        businessName: req.tenant.businessName
      }
    });

  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      secureLog('info', 'Token expired during verification', {
        tenantId: req.tenantId,
        ip: req.ip
      });
      return res.status(401).json({ 
        error: 'TOKEN_EXPIRED',
        message: 'Token has expired' 
      });
    }

    secureLog('warn', 'Token verification failed', {
      tenantId: req.tenantId,
      error: error.message,
      ip: req.ip
    });

    res.status(401).json({ 
      error: 'INVALID_TOKEN',
      message: 'Invalid authentication token' 
    });
  }
});

/**
 * SETUP 2FA FOR USER
 * POST /api/auth/setup-2fa
 */
router.post('/setup-2fa', requireAuthentication, async (req, res) => {
  try {
    const userId = req.user.id;
    const TenantUser = req.getTenantModel('User');

    if (!TenantUser) {
      return res.status(500).json({
        error: 'SYSTEM_ERROR',
        message: 'System error'
      });
    }

    const user = await TenantUser.findById(userId);

    if (!user) {
      return res.status(404).json({
        error: 'USER_NOT_FOUND',
        message: 'User not found'
      });
    }

    if (user.twoFactorAuth && user.twoFactorAuth.enabled) {
      return res.status(400).json({
        error: '2FA_ALREADY_ENABLED',
        message: '2FA is already enabled for this account'
      });
    }

    // Generate 2FA secret
    const { secret, qrCode, backupCodes } = await generate2FASecret(
      user.username,
      req.tenant?.businessName || 'Opsuite'
    );

    // Hash backup codes before storing
    const hashedBackupCodes = await Promise.all(
      backupCodes.map(code => bcrypt.hash(code, 10))
    );

    // Store secret (encrypted) and hashed backup codes
    user.twoFactorAuth = {
      enabled: false, // Not enabled until verified
      secret: secret,
      backupCodes: hashedBackupCodes,
      enabledAt: null
    };

    await user.save();

    logger.info('2FA setup initiated', {
      userId: user._id,
      username: user.username,
      tenantId: req.tenantId
    });

    res.json({
      success: true,
      qrCode: qrCode,
      backupCodes: backupCodes, // Send plain backup codes ONCE
      message: 'Scan the QR code with your authenticator app and save the backup codes'
    });

  } catch (error) {
    logger.error('2FA setup failed', {
      userId: req.user.id,
      error: error.message,
      stack: error.stack
    });

    res.status(500).json({
      error: '2FA_SETUP_FAILED',
      message: 'Failed to setup two-factor authentication'
    });
  }
});

/**
 * VERIFY AND ENABLE 2FA
 * POST /api/auth/verify-2fa
 */
router.post('/verify-2fa', requireAuthentication, async (req, res) => {
  try {
    const { token } = req.body;
    const userId = req.user.id;

    if (!token) {
      return res.status(400).json({
        error: 'TOKEN_REQUIRED',
        message: 'Verification token required'
      });
    }

    const TenantUser = req.getTenantModel('User');
    const user = await TenantUser.findById(userId);

    if (!user || !user.twoFactorAuth || !user.twoFactorAuth.secret) {
      return res.status(400).json({
        error: '2FA_NOT_SETUP',
        message: '2FA has not been set up'
      });
    }

    if (user.twoFactorAuth.enabled) {
      return res.status(400).json({
        error: '2FA_ALREADY_ENABLED',
        message: '2FA is already enabled'
      });
    }

    // Verify the token
    const isValid = verify2FAToken(user.twoFactorAuth.secret, token);

    if (!isValid) {
      logger.warn('2FA verification failed', {
        userId: user._id,
        username: user.username
      });
      return res.status(400).json({
        error: 'INVALID_TOKEN',
        message: 'Invalid verification code'
      });
    }

    // Enable 2FA
    user.twoFactorAuth.enabled = true;
    user.twoFactorAuth.enabledAt = new Date();
    await user.save();

    logger.info('2FA enabled successfully', {
      userId: user._id,
      username: user.username,
      tenantId: req.tenantId
    });

    res.json({
      success: true,
      message: 'Two-factor authentication enabled successfully'
    });

  } catch (error) {
    logger.error('2FA verification failed', {
      userId: req.user.id,
      error: error.message
    });

    res.status(500).json({
      error: '2FA_VERIFICATION_FAILED',
      message: 'Failed to verify two-factor authentication'
    });
  }
});

/**
 * DISABLE 2FA
 * POST /api/auth/disable-2fa
 */
router.post('/disable-2fa', requireAuthentication, async (req, res) => {
  try {
    const { password } = req.body;
    const userId = req.user.id;

    if (!password) {
      return res.status(400).json({
        error: 'PASSWORD_REQUIRED',
        message: 'Password required to disable 2FA'
      });
    }

    const TenantUser = req.getTenantModel('User');
    const user = await TenantUser.findById(userId);

    if (!user) {
      return res.status(404).json({
        error: 'USER_NOT_FOUND',
        message: 'User not found'
      });
    }

    // Verify password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({
        error: 'INVALID_PASSWORD',
        message: 'Invalid password'
      });
    }

    // Disable 2FA
    user.twoFactorAuth = {
      enabled: false,
      secret: null,
      backupCodes: [],
      enabledAt: null
    };

    await user.save();

    logger.info('2FA disabled', {
      userId: user._id,
      username: user.username,
      tenantId: req.tenantId
    });

    res.json({
      success: true,
      message: 'Two-factor authentication disabled'
    });

  } catch (error) {
    logger.error('2FA disable failed', {
      userId: req.user.id,
      error: error.message
    });

    res.status(500).json({
      error: '2FA_DISABLE_FAILED',
      message: 'Failed to disable two-factor authentication'
    });
  }
});

module.exports = router;