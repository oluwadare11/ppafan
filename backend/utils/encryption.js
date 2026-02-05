// utils/encryption.js - Field-Level Data Encryption for PII Protection
const crypto = require('crypto');

// Encryption configuration
const ALGORITHM = 'aes-256-gcm';
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || crypto.randomBytes(32);
const IV_LENGTH = 16;
const TAG_LENGTH = 16;

// Ensure encryption key is properly formatted
const getEncryptionKey = () => {
  if (typeof ENCRYPTION_KEY === 'string') {
    return Buffer.from(ENCRYPTION_KEY, 'hex');
  }
  return ENCRYPTION_KEY;
};

// Encrypt sensitive data
const encrypt = (text) => {
  if (!text || typeof text !== 'string') {
    return text; // Return as-is if not a string
  }

  try {
    const key = getEncryptionKey();
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipher(ALGORITHM, key, iv);
    
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const tag = cipher.getAuthTag();
    
    // Combine IV, tag, and encrypted data
    const combined = iv.toString('hex') + ':' + tag.toString('hex') + ':' + encrypted;
    
    return combined;
  } catch (error) {
    console.error('Encryption failed:', error.message);
    return text; // Return original text if encryption fails
  }
};

// Decrypt sensitive data
const decrypt = (encryptedText) => {
  if (!encryptedText || typeof encryptedText !== 'string') {
    return encryptedText; // Return as-is if not a string
  }

  // Check if data is actually encrypted (contains colons)
  if (!encryptedText.includes(':')) {
    return encryptedText; // Return as-is if not encrypted
  }

  try {
    const key = getEncryptionKey();
    const parts = encryptedText.split(':');
    
    if (parts.length !== 3) {
      return encryptedText; // Return as-is if format is incorrect
    }
    
    const iv = Buffer.from(parts[0], 'hex');
    const tag = Buffer.from(parts[1], 'hex');
    const encrypted = parts[2];
    
    const decipher = crypto.createDecipher(ALGORITHM, key, iv);
    decipher.setAuthTag(tag);
    
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  } catch (error) {
    console.error('Decryption failed:', error.message);
    return encryptedText; // Return encrypted text if decryption fails
  }
};

// Encrypt multiple fields in an object
const encryptFields = (obj, fieldsToEncrypt = []) => {
  if (!obj || typeof obj !== 'object') {
    return obj;
  }

  const encrypted = { ...obj };
  
  fieldsToEncrypt.forEach(field => {
    if (encrypted[field]) {
      encrypted[field] = encrypt(encrypted[field]);
    }
  });
  
  return encrypted;
};

// Decrypt multiple fields in an object
const decryptFields = (obj, fieldsToDecrypt = []) => {
  if (!obj || typeof obj !== 'object') {
    return obj;
  }

  const decrypted = { ...obj };
  
  fieldsToDecrypt.forEach(field => {
    if (decrypted[field]) {
      decrypted[field] = decrypt(decrypted[field]);
    }
  });
  
  return decrypted;
};

// Hash sensitive data (one-way encryption for passwords, etc.)
const hash = (text, salt = null) => {
  if (!text || typeof text !== 'string') {
    return text;
  }

  try {
    const saltToUse = salt || crypto.randomBytes(16).toString('hex');
    const hash = crypto.pbkdf2Sync(text, saltToUse, 10000, 64, 'sha512');
    
    return saltToUse + ':' + hash.toString('hex');
  } catch (error) {
    console.error('Hashing failed:', error.message);
    return text;
  }
};

// Verify hashed data
const verifyHash = (text, hashedText) => {
  if (!text || !hashedText || typeof text !== 'string' || typeof hashedText !== 'string') {
    return false;
  }

  try {
    const parts = hashedText.split(':');
    if (parts.length !== 2) {
      return false;
    }
    
    const salt = parts[0];
    const originalHash = parts[1];
    
    const hash = crypto.pbkdf2Sync(text, salt, 10000, 64, 'sha512');
    const newHash = hash.toString('hex');
    
    return originalHash === newHash;
  } catch (error) {
    console.error('Hash verification failed:', error.message);
    return false;
  }
};

// Generate secure random tokens
const generateToken = (length = 32) => {
  return crypto.randomBytes(length).toString('hex');
};

// Generate secure passwords
const generateSecurePassword = (length = 12) => {
  const charset = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%^&*';
  let password = '';
  
  for (let i = 0; i < length; i++) {
    password += charset.charAt(Math.floor(Math.random() * charset.length));
  }
  
  return password;
};

// Encrypt file data
const encryptFileData = (buffer) => {
  if (!Buffer.isBuffer(buffer)) {
    return buffer;
  }

  try {
    const key = getEncryptionKey();
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipher(ALGORITHM, key, iv);
    
    const encrypted = Buffer.concat([cipher.update(buffer), cipher.final()]);
    const tag = cipher.getAuthTag();
    
    // Combine IV, tag, and encrypted data
    return Buffer.concat([iv, tag, encrypted]);
  } catch (error) {
    console.error('File encryption failed:', error.message);
    return buffer;
  }
};

// Decrypt file data
const decryptFileData = (encryptedBuffer) => {
  if (!Buffer.isBuffer(encryptedBuffer)) {
    return encryptedBuffer;
  }

  try {
    const key = getEncryptionKey();
    const iv = encryptedBuffer.slice(0, IV_LENGTH);
    const tag = encryptedBuffer.slice(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
    const encrypted = encryptedBuffer.slice(IV_LENGTH + TAG_LENGTH);
    
    const decipher = crypto.createDecipher(ALGORITHM, key, iv);
    decipher.setAuthTag(tag);
    
    return Buffer.concat([decipher.update(encrypted), decipher.final()]);
  } catch (error) {
    console.error('File decryption failed:', error.message);
    return encryptedBuffer;
  }
};

// Mongoose schema plugin for automatic encryption/decryption
const encryptionPlugin = function(schema, options = {}) {
  const fieldsToEncrypt = options.fields || [];
  
  // Pre-save hook to encrypt fields
  schema.pre('save', function(next) {
    const doc = this;
    
    fieldsToEncrypt.forEach(field => {
      if (doc[field] && doc.isModified(field)) {
        // Only encrypt if field has been modified and is not already encrypted
        if (typeof doc[field] === 'string' && !doc[field].includes(':')) {
          doc[field] = encrypt(doc[field]);
        }
      }
    });
    
    next();
  });
  
  // Add instance methods for decryption
  fieldsToEncrypt.forEach(field => {
    const methodName = `getDecrypted${field.charAt(0).toUpperCase() + field.slice(1)}`;
    
    schema.methods[methodName] = function() {
      return decrypt(this[field]);
    };
  });
  
  // Add static method to find and decrypt
  schema.statics.findAndDecrypt = function(query, fieldsToDecryptParam = fieldsToEncrypt) {
    return this.find(query).then(docs => {
      return docs.map(doc => {
        const decrypted = doc.toObject();
        fieldsToDecryptParam.forEach(field => {
          if (decrypted[field]) {
            decrypted[field] = decrypt(decrypted[field]);
          }
        });
        return decrypted;
      });
    });
  };
};

// PII field detection (for automatic encryption)
const isPIIField = (fieldName) => {
  const piiFields = [
    'email', 'phone', 'phoneNumber', 'address', 'ssn', 'socialSecurityNumber',
    'taxId', 'bankAccount', 'creditCard', 'passport', 'driverLicense',
    'nationalId', 'personalId', 'birthDate', 'dateOfBirth'
  ];
  
  return piiFields.some(pii => 
    fieldName.toLowerCase().includes(pii.toLowerCase())
  );
};

// Automatic PII encryption for objects
const autoEncryptPII = (obj) => {
  if (!obj || typeof obj !== 'object') {
    return obj;
  }

  const encrypted = { ...obj };
  
  Object.keys(encrypted).forEach(key => {
    if (isPIIField(key) && typeof encrypted[key] === 'string') {
      encrypted[key] = encrypt(encrypted[key]);
    }
  });
  
  return encrypted;
};

// Automatic PII decryption for objects
const autoDecryptPII = (obj) => {
  if (!obj || typeof obj !== 'object') {
    return obj;
  }

  const decrypted = { ...obj };
  
  Object.keys(decrypted).forEach(key => {
    if (isPIIField(key) && typeof decrypted[key] === 'string') {
      decrypted[key] = decrypt(decrypted[key]);
    }
  });
  
  return decrypted;
};

// Export encryption utilities
module.exports = {
  // Core encryption functions
  encrypt,
  decrypt,
  
  // Object field encryption
  encryptFields,
  decryptFields,
  
  // Hashing functions
  hash,
  verifyHash,
  
  // Token generation
  generateToken,
  generateSecurePassword,
  
  // File encryption
  encryptFileData,
  decryptFileData,
  
  // Mongoose plugin
  encryptionPlugin,
  
  // Automatic PII handling
  isPIIField,
  autoEncryptPII,
  autoDecryptPII,
  
  // Utilities
  getEncryptionKey
};