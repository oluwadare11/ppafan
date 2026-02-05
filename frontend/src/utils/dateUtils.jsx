/**
 * Date/Time Utilities for Lagos Timezone (WAT - UTC+1)
 * Current Lagos time reference: December 25, 2025 13:11 (1:11 PM)
 */

const LAGOS_TIMEZONE = 'Africa/Lagos'; // WAT (West Africa Time) - UTC+1

/**
 * Get current date/time in Lagos timezone
 * @returns {Date} Current Lagos date/time
 */
export const getLagosNow = () => {
  return new Date(new Date().toLocaleString('en-US', { timeZone: LAGOS_TIMEZONE }));
};

/**
 * Convert any date to Lagos timezone
 * @param {Date|string} date - Date to convert
 * @returns {Date} Date in Lagos timezone
 */
export const toLagosTime = (date) => {
  if (!date) return null;
  const dateObj = new Date(date);
  if (isNaN(dateObj.getTime())) return null;

  return new Date(dateObj.toLocaleString('en-US', { timeZone: LAGOS_TIMEZONE }));
};

/**
 * Get today's date in YYYY-MM-DD format (Lagos timezone)
 * @returns {string} Today's date string
 */
export const getTodayString = () => {
  const now = getLagosNow();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/**
 * Get date N days ago from today (Lagos timezone)
 * @param {number} days - Number of days to go back
 * @returns {string} Date string in YYYY-MM-DD format
 */
export const getDaysAgo = (days) => {
  const now = getLagosNow();
  now.setDate(now.getDate() - days);

  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/**
 * Get the first day of current month (Lagos timezone)
 * @returns {string} First day of month in YYYY-MM-DD format
 */
export const getFirstDayOfMonth = () => {
  const now = getLagosNow();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}-01`;
};

/**
 * Get the last day of current month (Lagos timezone)
 * @returns {string} Last day of month in YYYY-MM-DD format
 */
export const getLastDayOfMonth = () => {
  const now = getLagosNow();
  const year = now.getFullYear();
  const month = now.getMonth();

  // Get first day of next month, then subtract 1 day
  const lastDay = new Date(year, month + 1, 0);

  const lastYear = lastDay.getFullYear();
  const lastMonth = String(lastDay.getMonth() + 1).padStart(2, '0');
  const lastDate = String(lastDay.getDate()).padStart(2, '0');
  return `${lastYear}-${lastMonth}-${lastDate}`;
};

/**
 * Get the first day of last month (Lagos timezone)
 * @returns {string} First day of last month in YYYY-MM-DD format
 */
export const getFirstDayOfLastMonth = () => {
  const now = getLagosNow();
  const year = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
  const month = now.getMonth() === 0 ? 12 : now.getMonth();
  return `${year}-${String(month).padStart(2, '0')}-01`;
};

/**
 * Get the last day of last month (Lagos timezone)
 * @returns {string} Last day of last month in YYYY-MM-DD format
 */
export const getLastDayOfLastMonth = () => {
  const now = getLagosNow();
  // First day of current month minus 1 day
  const lastDay = new Date(now.getFullYear(), now.getMonth(), 0);

  const year = lastDay.getFullYear();
  const month = String(lastDay.getMonth() + 1).padStart(2, '0');
  const day = String(lastDay.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/**
 * Format date for display
 * @param {Date|string} date - Date to format
 * @param {string} format - Format type: 'short', 'medium', 'long', 'time', 'datetime'
 * @returns {string} Formatted date string
 */
export const formatDate = (date, format = 'medium') => {
  if (!date) return '-';

  const dateObj = new Date(date);
  if (isNaN(dateObj.getTime())) return 'Invalid Date';

  const options = { timeZone: LAGOS_TIMEZONE };

  switch (format) {
    case 'short':
      // 25/12/2025
      return dateObj.toLocaleDateString('en-GB', options);

    case 'medium':
      // Dec 25, 2025
      return dateObj.toLocaleDateString('en-US', {
        ...options,
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      });

    case 'long':
      // December 25, 2025
      return dateObj.toLocaleDateString('en-US', {
        ...options,
        month: 'long',
        day: 'numeric',
        year: 'numeric'
      });

    case 'time':
      // 1:11 PM
      return dateObj.toLocaleTimeString('en-US', {
        ...options,
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      });

    case 'datetime':
      // Dec 25, 2025 1:11 PM
      return dateObj.toLocaleString('en-US', {
        ...options,
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      });

    default:
      return dateObj.toLocaleDateString('en-US', options);
  }
};

/**
 * Format time for display
 * @param {Date|string} date - Date/time to format
 * @returns {string} Formatted time string (e.g., "1:11 PM")
 */
export const formatTime = (date) => {
  return formatDate(date, 'time');
};

/**
 * Get relative time string (e.g., "2 hours ago", "just now")
 * @param {Date|string} date - Date to compare
 * @returns {string} Relative time string
 */
export const getRelativeTime = (date) => {
  if (!date) return '-';

  const dateObj = new Date(date);
  if (isNaN(dateObj.getTime())) return 'Invalid Date';

  const now = getLagosNow();
  const diffMs = now - dateObj;
  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSeconds < 60) return 'just now';
  if (diffMinutes < 60) return `${diffMinutes} minute${diffMinutes !== 1 ? 's' : ''} ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
  if (diffDays < 7) return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;

  return formatDate(date, 'medium');
};

/**
 * Check if a date is today (Lagos timezone)
 * @param {Date|string} date - Date to check
 * @returns {boolean} True if date is today
 */
export const isToday = (date) => {
  if (!date) return false;

  const dateObj = toLagosTime(date);
  if (!dateObj) return false;

  const today = getLagosNow();

  return dateObj.getFullYear() === today.getFullYear() &&
         dateObj.getMonth() === today.getMonth() &&
         dateObj.getDate() === today.getDate();
};

/**
 * Check if date is valid
 * @param {Date|string} date - Date to validate
 * @returns {boolean} True if valid
 */
export const isValidDate = (date) => {
  if (!date) return false;
  const dateObj = new Date(date);
  return !isNaN(dateObj.getTime());
};

/**
 * Legacy UTC formatters (kept for backward compatibility)
 */
export const formatUTCTime = (timestamp) => {
  if (!timestamp || isNaN(new Date(timestamp).getTime())) return '-';
  return new Date(timestamp).toLocaleTimeString('en-US', {
    timeZone: 'UTC',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
};

export const formatUTCDate = (date) => {
  if (!date || isNaN(new Date(date).getTime())) return '-';
  return new Date(date).toLocaleDateString('en-US', { timeZone: 'UTC' });
};

/**
 * Date range presets for Lagos timezone
 */
export const DATE_PRESETS = {
  today: {
    label: 'Today',
    getRange: () => {
      const today = getTodayString();
      return { start: today, end: today };
    }
  },
  yesterday: {
    label: 'Yesterday',
    getRange: () => {
      const yesterday = getDaysAgo(1);
      return { start: yesterday, end: yesterday };
    }
  },
  last7days: {
    label: 'Last 7 Days',
    getRange: () => ({
      start: getDaysAgo(6),
      end: getTodayString()
    })
  },
  last30days: {
    label: 'Last 30 Days',
    getRange: () => ({
      start: getDaysAgo(29),
      end: getTodayString()
    })
  },
  thisMonth: {
    label: 'This Month',
    getRange: () => ({
      start: getFirstDayOfMonth(),
      end: getTodayString()
    })
  },
  lastMonth: {
    label: 'Last Month',
    getRange: () => ({
      start: getFirstDayOfLastMonth(),
      end: getLastDayOfLastMonth()
    })
  }
};
