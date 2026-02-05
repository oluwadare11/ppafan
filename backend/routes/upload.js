// routes/upload.js - File upload routes with security
const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const { identifyTenant, requireActiveTenant, addTenantHelpers } = require('../middleware/tenant');
const { requireAuthentication } = require('../middleware/cookieAuth');
const rateLimiting = require('../middleware/rateLimiting');
const securityLogger = require('../utils/securityLogger');

const router = express.Router();

// Apply tenant and authentication middleware
// Note: Module access control is handled at app.use() level in server.js
router.use(identifyTenant);
router.use(addTenantHelpers);
router.use(requireActiveTenant);
router.use(requireAuthentication);

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, '../uploads');
const receiptsDir = path.join(uploadsDir, 'receipts');

// Create directories if they don't exist
(async () => {
  try {
    await fs.mkdir(uploadsDir, { recursive: true });
    await fs.mkdir(receiptsDir, { recursive: true });
  } catch (error) {
    console.error('Error creating upload directories:', error);
  }
})();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    try {
      // Create tenant-specific directory
      const tenantDir = path.join(receiptsDir, req.tenantId.toString());
      await fs.mkdir(tenantDir, { recursive: true });
      cb(null, tenantDir);
    } catch (error) {
      cb(error);
    }
  },
  filename: (req, file, cb) => {
    // Generate unique filename
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    const filename = `receipt-${uniqueSuffix}${ext}`;
    cb(null, filename);
  }
});

// File filter
const fileFilter = (req, file, cb) => {
  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'application/pdf'];

  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only JPG, PNG, GIF, and PDF files are allowed.'), false);
  }
};

// Multer upload configuration
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  },
  fileFilter: fileFilter
});

/**
 * POST /api/upload/receipt
 * Upload receipt file
 */
router.post('/receipt', upload.single('receipt'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        error: 'NO_FILE_PROVIDED',
        message: 'Please provide a file to upload'
      });
    }

    securityLogger.logDataModification(req, 'RECEIPT_UPLOAD', {
      resourceType: 'file_upload',
      filename: req.file.filename,
      size: req.file.size,
      mimetype: req.file.mimetype
    });

    // Generate public URL (adjust based on your server setup)
    const receiptUrl = `/uploads/receipts/${req.tenantId}/${req.file.filename}`;

    res.json({
      success: true,
      message: 'Receipt uploaded successfully',
      url: receiptUrl,
      receiptUrl: receiptUrl,
      filename: req.file.filename,
      size: req.file.size,
      mimetype: req.file.mimetype
    });

  } catch (error) {
    securityLogger.logSecurityEvent(req, 'RECEIPT_UPLOAD_ERROR', {
      error: error.message
    });

    // Clean up file if it was uploaded but processing failed
    if (req.file && req.file.path) {
      try {
        await fs.unlink(req.file.path);
      } catch (unlinkError) {
        console.error('Error deleting failed upload:', unlinkError);
      }
    }

    res.status(500).json({
      error: 'UPLOAD_FAILED',
      message: error.message || 'Failed to upload receipt'
    });
  }
});

/**
 * DELETE /api/upload/receipt/:filename
 * Delete receipt file
 */
router.delete('/receipt/:filename', async (req, res) => {
  try {
    const { filename } = req.params;

    // Validate filename to prevent directory traversal
    if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
      return res.status(400).json({
        error: 'INVALID_FILENAME',
        message: 'Invalid filename'
      });
    }

    const filePath = path.join(receiptsDir, req.tenantId.toString(), filename);

    // Check if file exists
    try {
      await fs.access(filePath);
    } catch {
      return res.status(404).json({
        error: 'FILE_NOT_FOUND',
        message: 'Receipt file not found'
      });
    }

    // Delete file
    await fs.unlink(filePath);

    securityLogger.logDataModification(req, 'RECEIPT_DELETE', {
      resourceType: 'file_delete',
      filename
    });

    res.json({
      success: true,
      message: 'Receipt deleted successfully'
    });

  } catch (error) {
    securityLogger.logSecurityEvent(req, 'RECEIPT_DELETE_ERROR', {
      error: error.message
    });

    res.status(500).json({
      error: 'DELETE_FAILED',
      message: 'Failed to delete receipt'
    });
  }
});

// Error handling middleware for multer
router.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        error: 'FILE_TOO_LARGE',
        message: 'File size exceeds 5MB limit'
      });
    }
    return res.status(400).json({
      error: 'UPLOAD_ERROR',
      message: error.message
    });
  }

  if (error) {
    return res.status(400).json({
      error: 'UPLOAD_ERROR',
      message: error.message
    });
  }

  next();
});

module.exports = router;
