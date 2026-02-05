// SessionExpired.jsx - Clean session expiry handler
// This page acts as a "reset checkpoint" to prevent auth loops
import { useEffect, useState } from 'react';

const SessionExpired = () => {
  const [countdown, setCountdown] = useState(3);

  useEffect(() => {
    // CRITICAL: Clear ALL auth data immediately on mount
    const clearAllAuthData = () => {
      // Clear localStorage
      try {
        localStorage.removeItem('user');
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        localStorage.removeItem('kioskUser');
        localStorage.removeItem('authState');
        // Clear any other potential auth keys
        const keysToRemove = [];
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && (key.includes('token') || key.includes('auth') || key.includes('user') || key.includes('session'))) {
            keysToRemove.push(key);
          }
        }
        keysToRemove.forEach(key => localStorage.removeItem(key));
      } catch (e) {
        console.error('Error clearing localStorage:', e);
      }

      // Clear sessionStorage
      try {
        sessionStorage.clear();
      } catch (e) {
        console.error('Error clearing sessionStorage:', e);
      }

      // Clear cookies (auth-related)
      try {
        document.cookie.split(';').forEach(cookie => {
          const name = cookie.split('=')[0].trim();
          if (name.includes('token') || name.includes('auth') || name.includes('session') || name.includes('access') || name.includes('refresh')) {
            document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
          }
        });
      } catch (e) {
        console.error('Error clearing cookies:', e);
      }

      console.log('[SessionExpired] All auth data cleared');
    };

    // Clear immediately
    clearAllAuthData();

    // Countdown timer
    const timer = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          // Hard redirect to login (ensures complete React state reset)
          window.location.href = '/login';
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100">
      <div className="max-w-md w-full mx-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 text-center">
          {/* Icon */}
          <div className="w-20 h-20 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg
              className="w-10 h-10 text-amber-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>

          {/* Title */}
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Session Expired
          </h1>

          {/* Message */}
          <p className="text-gray-600 mb-6">
            Your session has expired due to inactivity. Please log in again to continue.
          </p>

          {/* Countdown */}
          <div className="bg-gray-50 rounded-lg p-4 mb-6">
            <p className="text-sm text-gray-500">
              Redirecting to login in{' '}
              <span className="font-semibold text-blue-600">{countdown}</span>
              {' '}second{countdown !== 1 ? 's' : ''}...
            </p>
          </div>

          {/* Manual redirect button */}
          <button
            onClick={() => window.location.href = '/login'}
            className="w-full bg-blue-600 text-white py-3 px-6 rounded-lg font-medium hover:bg-blue-700 transition-colors"
          >
            Go to Login Now
          </button>

          {/* Security note */}
          <p className="text-xs text-gray-400 mt-6">
            For your security, sessions expire after a period of inactivity.
          </p>
        </div>
      </div>
    </div>
  );
};

export default SessionExpired;
