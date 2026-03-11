// middleware/recaptcha.js - Google reCAPTCHA v3 Verification
const fetch = require('node-fetch');
const logger = require('../utils/logger');

const RECAPTCHA_SECRET_KEY = process.env.RECAPTCHA_SECRET_KEY;
const RECAPTCHA_MIN_SCORE = parseFloat(process.env.RECAPTCHA_MIN_SCORE || '0.5');
const RECAPTCHA_VERIFY_URL = 'https://www.google.com/recaptcha/api/siteverify';
const isDevelopment = process.env.NODE_ENV === 'development';

/**
 * Verify reCAPTCHA token
 */
const verifyRecaptcha = async (token, remoteIp = null) => {
  if (!RECAPTCHA_SECRET_KEY) {
    logger.error('RECAPTCHA_SECRET_KEY not configured');
    throw new Error('reCAPTCHA not configured');
  }

  try {
    const params = new URLSearchParams({
      secret: RECAPTCHA_SECRET_KEY,
      response: token
    });

    if (remoteIp) {
      params.append('remoteip', remoteIp);
    }

    const response = await fetch(RECAPTCHA_VERIFY_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: params
    });

    let data;
    try {
      data = await response.json();
    } catch (_) {
      return { success: false, score: 0, action: null, hostname: null, errorCodes: ['invalid-response'] };
    }

    logger.debug('reCAPTCHA verification response', {
      success: data.success,
      score: data.score,
      action: data.action,
      hostname: data.hostname
    });

    return {
      success: data.success === true,
      score: data.score || 0,
      action: data.action || null,
      hostname: data.hostname || null,
      errorCodes: data['error-codes'] || []
    };
  } catch (error) {
    logger.error('reCAPTCHA verification failed', { error: error.message });
    return { success: false, score: 0, action: null, hostname: null, errorCodes: ['network-error'] };
  }
};

/**
 * reCAPTCHA Middleware
 * Validates reCAPTCHA token from frontend
 */
const recaptchaMiddleware = (options = {}) => {
  const {
    minScore = RECAPTCHA_MIN_SCORE,
    action = null,
    bypassInDev = true
  } = options;

  return async (req, res, next) => {
    // PUMP HOUSE ERP: reCAPTCHA disabled for single-tenant deployment
    // To re-enable, set RECAPTCHA_ENABLED=true in .env
    const recaptchaEnabled = process.env.RECAPTCHA_ENABLED === 'true';
    if (!recaptchaEnabled) {
      logger.debug('reCAPTCHA disabled for Pump House ERP single-tenant');
      return next();
    }

    // Bypass in development if configured
    if (isDevelopment && bypassInDev) {
      logger.debug('reCAPTCHA bypassed in development mode');
      return next();
    }

    // Extract token from header or body
    const token = req.headers['x-recaptcha-token'] || req.body?.recaptchaToken;

    if (!token) {
      logger.warn('reCAPTCHA token missing', {
        path: req.path,
        ip: req.ip
      });
      return res.status(400).json({
        error: 'RECAPTCHA_TOKEN_MISSING',
        message: 'reCAPTCHA verification required'
      });
    }

    try {
      const result = await verifyRecaptcha(token, req.ip);

      if (!result.success) {
        logger.warn('reCAPTCHA verification failed', {
          path: req.path,
          ip: req.ip,
          errorCodes: result.errorCodes
        });
        return res.status(400).json({
          error: 'RECAPTCHA_VERIFICATION_FAILED',
          message: 'reCAPTCHA verification failed. Please try again.',
          details: isDevelopment ? result.errorCodes : undefined
        });
      }

      // Check score (v3 only)
      if (result.score < minScore) {
        logger.warn('reCAPTCHA score too low', {
          path: req.path,
          ip: req.ip,
          score: result.score,
          minScore: minScore
        });
        return res.status(400).json({
          error: 'RECAPTCHA_SCORE_TOO_LOW',
          message: 'Verification failed. You may be a bot.',
          score: isDevelopment ? result.score : undefined
        });
      }

      // Check action if specified
      if (action && result.action !== action) {
        logger.warn('reCAPTCHA action mismatch', {
          path: req.path,
          ip: req.ip,
          expected: action,
          received: result.action
        });
        return res.status(400).json({
          error: 'RECAPTCHA_ACTION_MISMATCH',
          message: 'Invalid reCAPTCHA action'
        });
      }

      // Attach reCAPTCHA result to request
      req.recaptcha = {
        score: result.score,
        action: result.action,
        hostname: result.hostname
      };

      logger.info('reCAPTCHA verification successful', {
        path: req.path,
        ip: req.ip,
        score: result.score,
        action: result.action
      });

      next();
    } catch (error) {
      logger.error('reCAPTCHA middleware error', {
        path: req.path,
        ip: req.ip,
        error: error.message
      });

      // Fail closed in production, open in development
      if (isDevelopment) {
        logger.warn('Allowing request despite reCAPTCHA error (development mode)');
        return next();
      }

      return res.status(500).json({
        error: 'RECAPTCHA_VERIFICATION_ERROR',
        message: 'Unable to verify reCAPTCHA. Please try again.'
      });
    }
  };
};

module.exports = {
  recaptchaMiddleware,
  verifyRecaptcha
};
