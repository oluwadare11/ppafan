// middleware/upload.js
// Multer upload middleware for file uploads
// Used by signage and other routes requiring file upload capabilities

const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, '../uploads');
const tempDir = path.join(uploadsDir, 'temp');

try {
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }
} catch (error) {
  console.error('Error creating upload directories:', error.message);
}

// Allowed MIME types for signage media - expanded video support
const ALLOWED_TYPES = {
  image: ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'],
  video: [
    'video/mp4',
    'video/webm',
    'video/ogg',
    'video/quicktime',      // .mov files
    'video/x-msvideo',      // .avi files
    'video/x-matroska',     // .mkv files
    'video/x-m4v',          // .m4v files
    'video/mpeg'            // .mpeg files
  ],
  audio: ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/ogg', 'audio/aac']
};

// Flatten allowed types for validation
const ALL_ALLOWED_TYPES = [
  ...ALLOWED_TYPES.image,
  ...ALLOWED_TYPES.video,
  ...ALLOWED_TYPES.audio
];

// Memory storage for processing (files are moved to final location by route handler)
const memoryStorage = multer.memoryStorage();

// Disk storage with temp directory
const diskStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, tempDir);
  },
  filename: (req, file, cb) => {
    // Generate unique filename
    const uniqueId = crypto.randomBytes(8).toString('hex');
    const ext = path.extname(file.originalname).toLowerCase();
    const filename = `temp_${Date.now()}_${uniqueId}${ext}`;
    cb(null, filename);
  }
});

// File filter for signage media
const mediaFileFilter = (req, file, cb) => {
  if (ALL_ALLOWED_TYPES.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`Invalid file type: ${file.mimetype}. Allowed types: images, videos, and audio files.`), false);
  }
};

// General file filter (allows common document types too)
const generalFileFilter = (req, file, cb) => {
  const documentTypes = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain',
    'text/csv'
  ];

  const allowedTypes = [...ALL_ALLOWED_TYPES, ...documentTypes];

  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`Invalid file type: ${file.mimetype}`), false);
  }
};

// Create multer instance for signage media (100MB limit for videos)
const signageUpload = multer({
  storage: diskStorage,
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB max
    files: 1
  },
  fileFilter: mediaFileFilter
});

// Create multer instance for general uploads (10MB limit)
const generalUpload = multer({
  storage: diskStorage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB max
    files: 1
  },
  fileFilter: generalFileFilter
});

// Memory-based upload for smaller files (used when immediate processing needed)
const memoryUpload = multer({
  storage: memoryStorage,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB max for memory
    files: 1
  },
  fileFilter: mediaFileFilter
});

// Export the signage upload as default (used by routes/signage.js)
module.exports = signageUpload;

// Also export named variants
module.exports.signageUpload = signageUpload;
module.exports.generalUpload = generalUpload;
module.exports.memoryUpload = memoryUpload;
module.exports.ALLOWED_TYPES = ALLOWED_TYPES;
module.exports.ALL_ALLOWED_TYPES = ALL_ALLOWED_TYPES;
