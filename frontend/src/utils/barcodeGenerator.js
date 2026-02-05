/**
 * Barcode Generation Utilities
 * Supports multiple barcode formats for inventory management
 */

/**
 * Generate EAN-13 barcode (13-digit retail standard)
 * Format: Country(3) + Company(4-7) + Product(2-5) + Check(1)
 */
export const generateEAN13 = () => {
  // Generate 12 random digits
  let barcode = '';
  for (let i = 0; i < 12; i++) {
    barcode += Math.floor(Math.random() * 10);
  }

  // Calculate check digit
  const checkDigit = calculateEAN13CheckDigit(barcode);
  return barcode + checkDigit;
};

/**
 * Calculate EAN-13 check digit
 */
const calculateEAN13CheckDigit = (barcode12) => {
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    const digit = parseInt(barcode12[i]);
    // Odd positions (1st, 3rd, 5th...) multiply by 1
    // Even positions (2nd, 4th, 6th...) multiply by 3
    sum += (i % 2 === 0) ? digit : digit * 3;
  }

  const remainder = sum % 10;
  return remainder === 0 ? 0 : 10 - remainder;
};

/**
 * Validate EAN-13 barcode
 */
export const validateEAN13 = (barcode) => {
  if (!/^\d{13}$/.test(barcode)) {
    return false;
  }

  const checkDigit = parseInt(barcode[12]);
  const calculatedCheckDigit = calculateEAN13CheckDigit(barcode.substring(0, 12));

  return checkDigit === calculatedCheckDigit;
};

/**
 * Generate UPC-A barcode (12-digit North American standard)
 */
export const generateUPCA = () => {
  // Generate 11 random digits
  let barcode = '';
  for (let i = 0; i < 11; i++) {
    barcode += Math.floor(Math.random() * 10);
  }

  // Calculate check digit (same algorithm as EAN-13 but for 11 digits)
  let sum = 0;
  for (let i = 0; i < 11; i++) {
    const digit = parseInt(barcode[i]);
    sum += (i % 2 === 0) ? digit * 3 : digit;
  }

  const remainder = sum % 10;
  const checkDigit = remainder === 0 ? 0 : 10 - remainder;

  return barcode + checkDigit;
};

/**
 * Generate SKU-based barcode (alphanumeric)
 * Uses business prefix + timestamp for uniqueness
 */
export const generateSKUBarcode = (prefix = 'INV') => {
  const timestamp = Date.now().toString().slice(-8); // Last 8 digits of timestamp
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  return `${prefix}-${timestamp}-${random}`;
};

/**
 * Generate Code 128 compatible barcode (alphanumeric)
 */
export const generateCode128 = (prefix = 'ITEM') => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = prefix;
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
};

/**
 * Format barcode for display (with spacing)
 */
export const formatBarcode = (barcode, type = 'EAN13') => {
  if (type === 'EAN13' && barcode.length === 13) {
    return `${barcode.slice(0, 1)} ${barcode.slice(1, 7)} ${barcode.slice(7, 13)}`;
  }
  if (type === 'UPCA' && barcode.length === 12) {
    return `${barcode.slice(0, 1)} ${barcode.slice(1, 6)} ${barcode.slice(6, 11)} ${barcode.slice(11)}`;
  }
  return barcode;
};

/**
 * Generate barcode based on type
 */
export const generateBarcode = (type = 'EAN13', options = {}) => {
  const { prefix = 'INV' } = options;

  switch (type) {
    case 'EAN13':
      return generateEAN13();
    case 'UPCA':
      return generateUPCA();
    case 'SKU':
      return generateSKUBarcode(prefix);
    case 'CODE128':
      return generateCode128(prefix);
    default:
      return generateEAN13();
  }
};

/**
 * Barcode type information
 */
export const barcodeTypes = [
  {
    value: 'EAN13',
    label: 'EAN-13 (Retail Standard)',
    description: '13-digit international retail barcode',
    example: '5901234123457'
  },
  {
    value: 'UPCA',
    label: 'UPC-A (North America)',
    description: '12-digit North American retail barcode',
    example: '012345678905'
  },
  {
    value: 'SKU',
    label: 'SKU-Based',
    description: 'Custom SKU format with timestamp',
    example: 'INV-12345678-123'
  },
  {
    value: 'CODE128',
    label: 'Code 128',
    description: 'Alphanumeric high-density barcode',
    example: 'ITEM12AB34CD'
  }
];

/**
 * Render barcode as SVG (simple vertical bars representation)
 * Note: For production, consider using a library like react-barcode or JsBarcode
 */
export const renderBarcodePreview = (barcode) => {
  // This is a simplified representation
  // In production, use a proper barcode library
  return {
    type: 'text',
    value: barcode,
    formatted: formatBarcode(barcode, barcode.length === 13 ? 'EAN13' : 'UPCA')
  };
};
