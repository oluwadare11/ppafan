// src/utils/formatters.js

export const formatCurrency = (amount) => {
  // Handle undefined, null, or non-numeric values
  if (amount === undefined || amount === null || isNaN(amount)) {
    return '₦0.00';
  }
  
  // Ensure amount is a number
  const numericAmount = Number(amount);
  if (isNaN(numericAmount)) {
    return '₦0.00';
  }
  
  return `₦${numericAmount.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

export const formatReceiptCurrency = (amount) => {
  // Handle undefined, null, or non-numeric values
  if (amount === undefined || amount === null || isNaN(amount)) {
    return 'N0.00';
  }
  
  // Ensure amount is a number
  const numericAmount = Number(amount);
  if (isNaN(numericAmount)) {
    return 'N0.00';
  }
  
  return `N${numericAmount.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

export const formatDate = (dateString) => {
  if (!dateString) return 'N/A';
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return 'Invalid Date';
    return date.toLocaleDateString('en-NG', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  } catch {
    return 'Invalid Date';
  }
};

// Additional utility formatters
export const formatNumber = (number) => {
  if (number === undefined || number === null || isNaN(number)) {
    return '0';
  }
  
  const numericValue = Number(number);
  if (isNaN(numericValue)) {
    return '0';
  }
  
  return numericValue.toLocaleString('en-NG');
};

export const formatPercentage = (value) => {
  if (value === undefined || value === null || isNaN(value)) {
    return '0%';
  }
  
  const numericValue = Number(value);
  if (isNaN(numericValue)) {
    return '0%';
  }
  
  return `${numericValue.toFixed(1)}%`;
};