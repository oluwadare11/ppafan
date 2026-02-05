// middleware/inputValidation.js - Simple Input Validation
const validator = require('validator');
const mongoSanitize = require('express-mongo-sanitize');

// Basic sanitization
const sanitizeValue = (value) => {
  if (typeof value !== 'string') return value;
  
  // Basic cleaning
  return value
    .trim()
    .replace(/\0/g, '') // Remove null bytes
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '') // Remove script tags
    .substring(0, 1000); // Limit length
};

// Recursively sanitize object
const sanitizeObject = (obj) => {
  if (obj === null || obj === undefined) return obj;
  
  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeObject(item));
  }
  
  if (typeof obj === 'object') {
    const sanitized = {};
    for (const [key, value] of Object.entries(obj)) {
      const cleanKey = sanitizeValue(key);
      sanitized[cleanKey] = sanitizeObject(value);
    }
    return sanitized;
  }
  
  return sanitizeValue(obj);
};

// Universal sanitization middleware
const sanitizeAndValidate = (req, res, next) => {
  try {
    // Skip body size check for file uploads (multipart/form-data)
    // Multer handles file size limits separately
    const contentType = req.headers['content-type'] || '';
    const isFileUpload = contentType.includes('multipart/form-data');

    // Sanitize all input
    if (req.body && !isFileUpload) {
      req.body = sanitizeObject(req.body);
      req.body = mongoSanitize.sanitize(req.body);
    }

    if (req.query) {
      req.query = sanitizeObject(req.query);
      req.query = mongoSanitize.sanitize(req.query);
    }

    if (req.params) {
      req.params = sanitizeObject(req.params);
    }

    // Basic size check - skip for file uploads (multer handles it)
    if (!isFileUpload) {
      const bodySize = JSON.stringify(req.body || {}).length;
      if (bodySize > 10 * 1024 * 1024) { // 10MB limit for regular requests
        return res.status(413).json({
          error: 'REQUEST_TOO_LARGE',
          message: 'Request body too large'
        });
      }
    }

    next();
  } catch (error) {
    console.error('Input sanitization error:', error);
    return res.status(400).json({
      error: 'INPUT_PROCESSING_ERROR',
      message: 'Unable to process input data'
    });
  }
};

// Simple validation helpers
const validateLogin = (req, res, next) => {
  const { username, password } = req.body;
  
  if (!username || !password) {
    return res.status(400).json({
      error: 'MISSING_CREDENTIALS',
      message: 'Username and password are required'
    });
  }
  
  if (username.length < 3 || username.length > 50) {
    return res.status(400).json({
      error: 'INVALID_USERNAME',
      message: 'Username must be 3-50 characters'
    });
  }
  
  if (password.length < 6) {
    return res.status(400).json({
      error: 'INVALID_PASSWORD',
      message: 'Password must be at least 6 characters'
    });
  }
  
  next();
};

const validatePOSItem = (req, res, next) => {
  const { name, price, type, section, subBusiness } = req.body;
  
  if (!name || !price || !type || !section || !subBusiness) {
    return res.status(400).json({
      error: 'MISSING_FIELDS',
      message: 'Name, price, type, section, and subBusiness are required'
    });
  }
  
  if (typeof price !== 'number' || price < 0) {
    return res.status(400).json({
      error: 'INVALID_PRICE',
      message: 'Price must be a positive number'
    });
  }
  
  if (!['product', 'service', 'subscription'].includes(type)) {
    return res.status(400).json({
      error: 'INVALID_TYPE',
      message: 'Type must be product, service, or subscription'
    });
  }
  
  next();
};

const validateInventoryItem = (req, res, next) => {
  const { name } = req.body;
  
  if (!name || name.length < 1) {
    return res.status(400).json({
      error: 'INVALID_NAME',
      message: 'Item name is required'
    });
  }
  
  if (req.body.sellingPrice !== undefined) {
    const price = parseFloat(req.body.sellingPrice);
    if (isNaN(price) || price < 0) {
      return res.status(400).json({
        error: 'INVALID_PRICE',
        message: 'Selling price must be a positive number'
      });
    }
  }
  
  next();
};

const validatePOSTransaction = (req, res, next) => {
  const { items, total, paymentMethod } = req.body;
  
  if (!items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({
      error: 'INVALID_ITEMS',
      message: 'Transaction must include at least one item'
    });
  }
  
  if (typeof total !== 'number' || total < 0) {
    return res.status(400).json({
      error: 'INVALID_TOTAL',
      message: 'Total must be a positive number'
    });
  }
  
  if (!['cash', 'card', 'mobile', 'bank_transfer'].includes(paymentMethod)) {
    return res.status(400).json({
      error: 'INVALID_PAYMENT_METHOD',
      message: 'Invalid payment method'
    });
  }
  
  // Validate each item
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (!item.itemId || !item.quantity || item.quantity <= 0) {
      return res.status(400).json({
        error: 'INVALID_ITEM',
        message: `Item ${i + 1}: itemId and positive quantity required`
      });
    }
  }
  
  next();
};

module.exports = {
  sanitizeAndValidate,
  validateLogin,
  validatePOSItem,
  validateInventoryItem,
  validatePOSTransaction,
  sanitizeValue,
  sanitizeObject
};