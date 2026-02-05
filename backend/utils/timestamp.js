/**
 * FIXED Timestamp formatting utilities for email notifications
 * Properly handles Lagos timezone (WAT = UTC+1) without double adjustment
 */

/**
 * Format timestamp for email display with FIXED Lagos timezone
 * @param {Date} timestamp - The timestamp to format
 * @param {string} type - 'time', 'date', or 'datetime'
 * @returns {string} Formatted timestamp string
 */
const formatTimestampForEmail = (timestamp, type = 'datetime') => {
  try {
    if (!timestamp) return 'N/A';
    
    const date = new Date(timestamp);
    if (isNaN(date.getTime())) return 'Invalid Date';

    // FIXED: Lagos is UTC+1, so we need to handle this properly
    // The timestamp from device is already in local time, so we just format it
    const lagosDate = new Date(date.getTime());

    switch (type) {
      case 'time':
        return lagosDate.toLocaleTimeString('en-US', {
          hour: 'numeric',
          minute: '2-digit',
          second: '2-digit',
          hour12: true,
        });

      case 'date':
        return lagosDate.toLocaleDateString('en-US', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        });

      case 'datetime':
        return lagosDate.toLocaleString('en-US', {
          weekday: 'short',
          year: 'numeric',
          month: 'short',
          day: 'numeric',
          hour: 'numeric',
          minute: '2-digit',
          hour12: true,
        });

      case 'short-date':
        return lagosDate.toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        });

      case 'short-time':
        return lagosDate.toLocaleTimeString('en-US', {
          hour: 'numeric',
          minute: '2-digit',
          hour12: true,
        });

      default:
        return lagosDate.toLocaleString('en-US');
    }
  } catch (err) {
    console.error('Error formatting timestamp:', err.message);
    return 'Format Error';
  }
};

/**
 * Get current Lagos time (FIXED)
 * @returns {Date} Current time in Lagos timezone
 */
const getCurrentLagosTime = () => {
  const now = new Date();
  // Lagos is UTC+1, so add 1 hour to UTC
  const lagosTime = new Date(now.getTime() + (1 * 60 * 60 * 1000));
  return lagosTime;
};

/**
 * Check if timestamp is today in Lagos timezone (FIXED)
 * @param {Date} timestamp - The timestamp to check
 * @returns {boolean} True if timestamp is today
 */
const isToday = (timestamp) => {
  try {
    const now = getCurrentLagosTime();
    const today = now.toDateString();
    const checkDate = new Date(timestamp).toDateString();
    return today === checkDate;
  } catch (err) {
    console.error('Error checking if today:', err.message);
    return false;
  }
};

/**
 * Get relative time string (e.g., "2 hours ago", "just now") - FIXED
 * @param {Date} timestamp - The timestamp to compare
 * @returns {string} Relative time string
 */
const getRelativeTime = (timestamp) => {
  try {
    const now = getCurrentLagosTime();
    const diff = now - new Date(timestamp);
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (seconds < 60) return 'just now';
    if (minutes < 60) return `${minutes} minute${minutes !== 1 ? 's' : ''} ago`;
    if (hours < 24) return `${hours} hour${hours !== 1 ? 's' : ''} ago`;
    if (days < 7) return `${days} day${days !== 1 ? 's' : ''} ago`;
    
    return formatTimestampForEmail(timestamp, 'short-date');
  } catch (err) {
    console.error('Error getting relative time:', err.message);
    return 'Unknown';
  }
};

/**
 * Format duration between two timestamps - FIXED
 * @param {Date} startTime - Start timestamp
 * @param {Date} endTime - End timestamp
 * @returns {string} Formatted duration string
 */
const formatDuration = (startTime, endTime) => {
  try {
    if (!startTime || !endTime) return 'N/A';
    
    const start = new Date(startTime);
    const end = new Date(endTime);
    
    if (isNaN(start.getTime()) || isNaN(end.getTime())) return 'Invalid Duration';
    
    const diffMs = end - start;
    if (diffMs < 0) return 'Invalid Duration';
    
    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    
    if (hours === 0) {
      return `${minutes} minute${minutes !== 1 ? 's' : ''}`;
    } else if (minutes === 0) {
      return `${hours} hour${hours !== 1 ? 's' : ''}`;
    } else {
      return `${hours}h ${minutes}m`;
    }
  } catch (err) {
    console.error('Error formatting duration:', err.message);
    return 'Format Error';
  }
};

/**
 * Parse time string (HH:mm) and create Date object for today - FIXED
 * @param {string} timeString - Time in HH:mm format
 * @param {Date} baseDate - Base date to use (defaults to Lagos today)
 * @returns {Date} Date object with time set
 */
const parseTimeString = (timeString, baseDate = getCurrentLagosTime()) => {
  try {
    if (!timeString || !/^\d{1,2}:\d{2}$/.test(timeString)) {
      throw new Error('Invalid time format');
    }
    
    const [hours, minutes] = timeString.split(':').map(Number);
    const date = new Date(baseDate);
    date.setHours(hours, minutes, 0, 0);
    
    return date;
  } catch (err) {
    console.error('Error parsing time string:', err.message);
    return null;
  }
};

/**
 * Get Lagos timezone offset - FIXED
 * @returns {string} Timezone offset string
 */
const getLagosTimezoneOffset = () => {
  return '+1'; // Lagos is UTC+1 (WAT - West Africa Time)
};

/**
 * Get date string in Lagos timezone (YYYY-MM-DD format)
 * @param {Date} timestamp - The timestamp to format
 * @returns {string} Date string in YYYY-MM-DD format
 */
const getLagosDateString = (timestamp) => {
  try {
    const date = new Date(timestamp);
    if (isNaN(date.getTime())) return null;

    // Use toLocaleDateString with en-CA locale which gives YYYY-MM-DD format
    return date.toLocaleDateString('en-CA', { timeZone: 'Africa/Lagos' });
  } catch (err) {
    console.error('Error getting Lagos date string:', err.message);
    return null;
  }
};

/**
 * Get day of week in Lagos timezone
 * @param {Date} timestamp - The timestamp to check
 * @returns {string} Day of week (e.g., "Monday", "Tuesday")
 */
const getLagosDayOfWeek = (timestamp) => {
  try {
    const date = new Date(timestamp);
    if (isNaN(date.getTime())) return null;

    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      timeZone: 'Africa/Lagos'
    });
  } catch (err) {
    console.error('Error getting Lagos day of week:', err.message);
    return null;
  }
};

/**
 * Create a Date object representing a specific time in Lagos timezone
 * Used for comparing clock-in/out times against shift times
 * @param {Date} timestamp - The reference timestamp (to get the date)
 * @param {string} timeString - Time in HH:mm format (e.g., "08:00")
 * @returns {Date} Date object in UTC representing the Lagos time
 */
const createLagosShiftTime = (timestamp, timeString) => {
  try {
    if (!timeString || !/^\d{1,2}:\d{2}$/.test(timeString)) {
      throw new Error('Invalid time format');
    }

    const date = new Date(timestamp);
    if (isNaN(date.getTime())) return null;

    const [hours, minutes] = timeString.split(':').map(Number);

    // Get the date in Lagos timezone
    const lagosDateStr = date.toLocaleDateString('en-CA', { timeZone: 'Africa/Lagos' });

    // Create an ISO string for that date and time in Lagos
    // Lagos is UTC+1, so we subtract 1 hour from the target time to get UTC
    const lagosTimeStr = `${lagosDateStr}T${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00.000+01:00`;

    return new Date(lagosTimeStr);
  } catch (err) {
    console.error('Error creating Lagos shift time:', err.message);
    return null;
  }
};

/**
 * Convert UTC timestamp to Lagos time - FIXED HELPER
 * @param {Date} utcTimestamp - UTC timestamp
 * @returns {Date} Lagos time
 */
const convertUTCToLagos = (utcTimestamp) => {
  try {
    const utc = new Date(utcTimestamp);
    // Add 1 hour for Lagos (UTC+1)
    return new Date(utc.getTime() + (1 * 60 * 60 * 1000));
  } catch (err) {
    console.error('Error converting UTC to Lagos time:', err.message);
    return new Date();
  }
};

/**
 * Convert Lagos time to UTC - FIXED HELPER
 * @param {Date} lagosTimestamp - Lagos timestamp
 * @returns {Date} UTC time
 */
const convertLagosToUTC = (lagosTimestamp) => {
  try {
    const lagos = new Date(lagosTimestamp);
    // Subtract 1 hour from Lagos to get UTC
    return new Date(lagos.getTime() - (1 * 60 * 60 * 1000));
  } catch (err) {
    console.error('Error converting Lagos to UTC time:', err.message);
    return new Date();
  }
};

module.exports = {
  formatTimestampForEmail,
  getCurrentLagosTime,
  isToday,
  getRelativeTime,
  formatDuration,
  parseTimeString,
  getLagosTimezoneOffset,
  convertUTCToLagos,
  convertLagosToUTC,
  getLagosDateString,
  getLagosDayOfWeek,
  createLagosShiftTime,
};