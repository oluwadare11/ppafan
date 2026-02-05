// useKioskAuth.js - Kiosk authentication hook
// Provides kiosk-specific authentication verification and state
// Completely separate from main app authentication

import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || "";

/**
 * Kiosk Authentication Hook
 *
 * Features:
 * - Verifies kiosk session on mount
 * - Redirects to kiosk login if not authenticated
 * - Provides user info and logout function
 * - Completely separate from main app auth (uses kioskAccessToken cookie)
 *
 * @param {Object} options
 * @param {string} options.redirectTo - Where to redirect after login (e.g., 'quicksell', 'inventory', 'visitor')
 * @param {boolean} options.redirectOnFail - Whether to redirect to login on auth failure (default: true)
 * @returns {Object} { user, loading, authenticated, logout, refreshAuth }
 */
export function useKioskAuth(options = {}) {
  const { redirectTo = 'quicksell', redirectOnFail = true } = options;

  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);
  const [error, setError] = useState(null);

  // Track if we've already redirected to avoid loops
  const hasRedirected = useRef(false);

  // Get tenant from URL or hostname
  const getTenant = useCallback(() => {
    return searchParams.get('tenant') || window.location.hostname.split('.')[0];
  }, [searchParams]);

  // Verify kiosk session
  const verifySession = useCallback(async () => {
    const tenant = getTenant();

    try {
      const response = await axios.get(`${API_BASE_URL}/api/auth/kiosk-verify`, {
        headers: {
          'X-Tenant-ID': tenant
        },
        withCredentials: true,
        timeout: 10000
      });

      if (response.data.authenticated) {
        setUser(response.data.user);
        setAuthenticated(true);
        setError(null);

        // Also update localStorage for components that check it
        localStorage.setItem('kioskUser', JSON.stringify(response.data.user));

        return true;
      } else {
        throw new Error(response.data.message || 'Not authenticated');
      }
    } catch (err) {
      console.error('[Kiosk Auth] Session verification failed:', err.response?.data || err.message);

      setUser(null);
      setAuthenticated(false);
      setError(err.response?.data?.message || err.message || 'Authentication failed');

      // Clear any stale kiosk data from localStorage
      localStorage.removeItem('kioskUser');
      localStorage.removeItem('kioskAuthToken');

      return false;
    }
  }, [getTenant]);

  // Redirect to kiosk login
  const redirectToLogin = useCallback(() => {
    if (hasRedirected.current) return;
    hasRedirected.current = true;

    const tenant = getTenant();
    const redirectParam = redirectTo === 'inventory' ? 'inventory'
      : redirectTo === 'visitor' ? 'visitor'
      : 'quicksell';

    console.log('[Kiosk Auth] Redirecting to kiosk login');
    navigate(`/kiosk/login?redirect=${redirectParam}&tenant=${tenant}`, { replace: true });
  }, [getTenant, navigate, redirectTo]);

  // Logout function
  const logout = useCallback(async () => {
    const tenant = getTenant();

    try {
      await axios.post(`${API_BASE_URL}/api/auth/kiosk-logout`, {}, {
        headers: {
          'X-Tenant-ID': tenant
        },
        withCredentials: true
      });
    } catch (err) {
      console.error('[Kiosk Auth] Logout error:', err);
    }

    // Clear local state regardless of server response
    setUser(null);
    setAuthenticated(false);
    localStorage.removeItem('kioskUser');
    localStorage.removeItem('kioskAuthToken');

    // Redirect to login
    hasRedirected.current = false;
    redirectToLogin();
  }, [getTenant, redirectToLogin]);

  // Refresh auth (force re-verify)
  const refreshAuth = useCallback(async () => {
    setLoading(true);
    const result = await verifySession();
    setLoading(false);
    return result;
  }, [verifySession]);

  // Verify session on mount
  useEffect(() => {
    let mounted = true;

    const checkAuth = async () => {
      setLoading(true);

      const isValid = await verifySession();

      if (!mounted) return;

      if (!isValid && redirectOnFail) {
        redirectToLogin();
      }

      setLoading(false);
    };

    checkAuth();

    return () => {
      mounted = false;
    };
  }, [verifySession, redirectOnFail, redirectToLogin]);

  return {
    user,
    loading,
    authenticated,
    error,
    logout,
    refreshAuth,
    getTenant
  };
}

/**
 * Kiosk Auth Guard Component
 * Wraps kiosk pages to enforce authentication
 *
 * Usage:
 * <KioskAuthGuard redirectTo="quicksell">
 *   <QuickSell />
 * </KioskAuthGuard>
 */
export function KioskAuthGuard({ children, redirectTo = 'quicksell' }) {
  const { loading, authenticated, user } = useKioskAuth({ redirectTo, redirectOnFail: true });

  // Show loading while checking auth
  if (loading) {
    return (
      <div className="fixed inset-0 bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-600 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-white/30 border-t-white mb-4 mx-auto"></div>
          <p className="text-white text-lg font-medium">Verifying session...</p>
          <p className="text-white/60 text-sm mt-1">Please wait</p>
        </div>
      </div>
    );
  }

  // If not authenticated, show nothing (redirect will happen)
  if (!authenticated) {
    return (
      <div className="fixed inset-0 bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-600 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <p className="text-white text-lg font-medium">Authentication Required</p>
          <p className="text-white/60 text-sm mt-1">Redirecting to login...</p>
        </div>
      </div>
    );
  }

  // Pass user to children via clone
  return children;
}

export default useKioskAuth;
