// AuthContextDefinition.jsx - OPTIMIZED: Faster loading with memoization
import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { AuthContext } from "./AuthContext.jsx";
import { useTenant } from "./TenantProvider.jsx";

// Cache keys - must match the ones used by Attendance.jsx and Accounting.jsx
const ATTENDANCE_CACHE_KEY = 'pumphouse_attendance_cache';
const ACCOUNTING_CACHE_KEY = 'pumphouse_accounting_cache';

/**
 * Preload module data in background after login for faster navigation
 * This runs asynchronously and doesn't block the login flow
 * Aggressively preloads attendance data for super-fast dashboard loading
 */
const preloadModuleData = async (makeRequest) => {
  try {
    console.log('[Preload] Starting aggressive background data preload...');

    // Phase 1: Critical data (staff, departments, positions) - needed by multiple modules
    const [
      staffRes,
      departmentsRes,
      positionsRes
    ] = await Promise.allSettled([
      makeRequest('/api/staff'),
      makeRequest('/api/staff/departments'),
      makeRequest('/api/staff/positions')
    ]);

    const staffData = staffRes.status === 'fulfilled' ? (staffRes.value?.staff || staffRes.value || []) : [];
    const departments = departmentsRes.status === 'fulfilled' ? (departmentsRes.value?.departments || []) : [];
    const positions = positionsRes.status === 'fulfilled' ? (positionsRes.value?.positions || []) : [];

    // Phase 2: Attendance dashboard data (live logs, records, stats) + Accounting
    const [
      attendanceSummaryRes,
      leavesRes,
      holidaysRes,
      accountingSummaryRes,
      invoiceStatsRes
    ] = await Promise.allSettled([
      makeRequest('/api/adms/attendance-summary'),  // Live logs, records, device status
      makeRequest('/api/attendance/leaves'),         // Leave requests
      makeRequest('/api/attendance/holidays'),       // Holidays
      makeRequest('/api/accounting/summary'),        // Accounting overview
      makeRequest('/api/invoices/stats')             // Invoice stats
    ]);

    // Process attendance summary (most important for dashboard speed)
    let attendanceData = [];
    let liveLogData = [];
    let deviceStatus = null;

    if (attendanceSummaryRes.status === 'fulfilled' && attendanceSummaryRes.value) {
      const summary = attendanceSummaryRes.value;
      attendanceData = summary.records || [];
      liveLogData = (summary.recent || []).map(log => ({
        ...log,
        photoUrl: log.photoId ? `/api/adms/photo/${log.photoId}` : null
      }));
      deviceStatus = {
        isOnline: summary.device?.isOnline || false,
        lastSeen: summary.device?.lastSeen || null,
        totalRequests: summary.device?.totalRequests || 0,
        attendanceCount: summary.device?.attendanceCount || 0
      };
      console.log('[Preload] Attendance summary cached:', {
        records: attendanceData.length,
        liveLogs: liveLogData.length
      });
    }

    // Process leaves and holidays
    const leavesData = leavesRes.status === 'fulfilled' ? (leavesRes.value?.leaves || leavesRes.value || []) : [];
    const holidaysData = holidaysRes.status === 'fulfilled' ? (holidaysRes.value?.holidays || holidaysRes.value || []) : [];

    // Calculate basic dashboard stats from preloaded data
    let statsData = null;
    if (staffData.length > 0 && attendanceData.length > 0) {
      const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'Africa/Lagos' });
      const todayRecords = attendanceData.filter(r => r.date === todayStr);
      const presentToday = todayRecords.filter(r => r.checkIn && !r.absent).length;
      const lateToday = todayRecords.filter(r => r.late).length;
      const absentToday = staffData.length - presentToday;

      statsData = {
        totalStaff: staffData.length,
        presentToday,
        lateToday,
        absentToday: Math.max(0, absentToday),
        onLeave: leavesData.filter(l => l.status === 'approved').length
      };
    }

    // Cache all attendance data
    sessionStorage.setItem(ATTENDANCE_CACHE_KEY, JSON.stringify({
      staffData,
      depts: departments,
      pos: positions,
      attendanceData,
      liveLogData,
      deviceStatus,
      statsData,
      leavesData,
      holidaysData,
      timestamp: Date.now()
    }));
    console.log('[Preload] Full attendance cache saved');

    // Cache accounting data
    const accountingSummary = accountingSummaryRes.status === 'fulfilled' ? accountingSummaryRes.value : null;
    const invoiceStats = invoiceStatsRes.status === 'fulfilled' ? invoiceStatsRes.value : null;

    if (accountingSummary || invoiceStats) {
      sessionStorage.setItem(ACCOUNTING_CACHE_KEY, JSON.stringify({
        summary: accountingSummary,
        invoiceStats,
        timestamp: Date.now()
      }));
      console.log('[Preload] Accounting data cached');
    }

    console.log('[Preload] Aggressive background preload completed');
  } catch (err) {
    console.warn('[Preload] Background preload failed (non-critical):', err.message);
    // Don't throw - preloading failure shouldn't affect user experience
  }
};

const AuthProvider = ({ children }) => {
  // ✅ PERFORMANCE FIX: Use tenant info from TenantProvider instead of fetching again
  const { tenantInfo: tenantInfoFromProvider, refreshTenantInfo: refreshTenantFromProvider } = useTenant();

  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [csrfToken, setCsrfToken] = useState(null);

  // Single initialization flag to prevent loops
  const initializedRef = useRef(false);
  const retryCountRef = useRef(0);
  const maxRetries = 3;

  // CRITICAL: Redirect lock to prevent infinite auth loops
  const isRedirectingRef = useRef(false);

  // CRITICAL: Session expired flag - blocks ALL further API calls once set
  const sessionExpiredRef = useRef(false);

  // CRITICAL: Logout lock to prevent multiple simultaneous logout attempts
  const loggingOutRef = useRef(false);

  // Environment detection
  const isDevelopment = import.meta.env.DEV;
  
  // Get API base URL - Direct backend connection
  const getApiUrl = useCallback(() => {
    const apiUrl = import.meta.env.VITE_API_URL || ''; // ✅ Empty for proxy
    return apiUrl;
  }, [isDevelopment]);

  // FIXED: Clean tenant detection without path bleeding
  const getTenantSubdomain = useCallback(() => {
    if (isDevelopment) {
      // DEVELOPMENT: URL parameter detection
      const urlParams = new URLSearchParams(window.location.search);
      const tenantParam = urlParams.get('tenant');
      if (tenantParam) {
        // CRITICAL FIX: Clean tenant ID (remove any path components)
        const cleanTenantId = tenantParam.split('/')[0].toLowerCase().trim();
        return cleanTenantId;
      }
      
      // Fallback: Check hash for SPA routing
      const hash = window.location.hash;
      if (hash.includes('tenant=')) {
        const match = hash.match(/tenant=([^&]+)/);
        if (match) {
          const cleanTenantId = match[1].split('/')[0].toLowerCase().trim();
          return cleanTenantId;
        }
      }
      
      // Development fallback: check subdomain.localhost
      const hostname = window.location.hostname;
      if (hostname.includes('.localhost')) {
        const parts = hostname.split('.');
        if (parts.length >= 2 && parts[1] === 'localhost') {
          const subdomain = parts[0].toLowerCase().trim();
          return subdomain;
        }
      }
      
      
      return null;
    } else {
      // PRODUCTION: Single-tenant Pump House ERP
      const hostname = window.location.hostname;

      // Check for thepumphouseng.com domain (single-tenant)
      // Supports: app.thepumphouseng.com, www.thepumphouseng.com, thepumphouseng.com
      if (hostname.includes('thepumphouseng.com')) {
        return 'pumphouse'; // Always return 'pumphouse' for single-tenant
      }

      // Fallback: check for any subdomain pattern (for flexibility)
      const parts = hostname.split('.');
      if (parts.length >= 2) {
        // If it's a subdomain setup, return 'pumphouse' for single-tenant
        return 'pumphouse';
      }

      return 'pumphouse'; // Default for single-tenant
    }
  }, [isDevelopment]);

  // FIXED: Headers with clean tenant identification
  const getHeaders = useCallback(() => {
    const tenantSubdomain = getTenantSubdomain();
    const headers = {
      'Content-Type': 'application/json',
    };
    
    // Add tenant identification (CLEAN - no path components)
    if (tenantSubdomain && tenantSubdomain !== 'admin') {
      if (isDevelopment) {
        // Development: Use X-Tenant-ID header with CLEAN tenant ID
        headers['X-Tenant-ID'] = tenantSubdomain;
      } else {
        // Production: Use X-Tenant-Subdomain header (for compatibility)
        headers['X-Tenant-Subdomain'] = tenantSubdomain;
      }
    }
    
    if (csrfToken) {
      headers['X-CSRF-Token'] = csrfToken;
    }
    
    return headers;
  }, [getTenantSubdomain, csrfToken, isDevelopment]);

  // User-friendly error message mapping
  const getUserFriendlyError = useCallback((error) => {
    if (!error) return null;
    
    const message = error.message?.toLowerCase() || '';
    const status = error.response?.status;
    
    // Network errors
    if (message.includes('network error') || message.includes('failed to fetch')) {
      return 'Connection problem. Please check your internet and try again.';
    }
    
    // CORS errors
    if (message.includes('cors') || message.includes('blocked by cors policy')) {
      return 'Connection configuration error. Please refresh the page and try again.';
    }
    
    // Rate limiting - ignore in development
    if (status === 429 || message.includes('too many')) {
      console.warn('Rate limit encountered - should be bypassed in development');
      return null;
    }
    
    // Parse server error responses
    if (error.response?.data) {
      const errorData = error.response.data;
      
      if (errorData.error === 'TENANT_NOT_FOUND') {
        return isDevelopment 
          ? `Business '${getTenantSubdomain()}' not found. Please register first or check your URL parameter.`
          : 'Business not found. Please check your web address or contact support.';
      }
      
      if (errorData.error === 'INVALID_DOMAIN') {
        return isDevelopment
          ? 'Use URL parameter: localhost:5173/login?tenant=BUSINESS_NAME'
          : 'Please use a valid business subdomain (e.g., yourcompany.thepumphouseng.com)';
      }
      
      if (errorData.error === 'TENANT_SUSPENDED') {
        return 'This business account is temporarily unavailable. Please contact support.';
      }

      // Subscription and account status errors - show full message from backend
      if (errorData.error === 'ACCOUNT_SUSPENDED') {
        return errorData.message || 'This business account has been suspended. Please contact support.';
      }

      if (errorData.error === 'ACCOUNT_ARCHIVED') {
        return errorData.message || 'This business account is no longer active. Please contact support.';
      }

      if (errorData.error === 'SUBSCRIPTION_INACTIVE') {
        return errorData.message || 'Your subscription has expired. Please renew to continue using the service.';
      }

      if (errorData.error === 'ACCOUNT_INACTIVE') {
        return errorData.message || 'This business account is not active. Please contact your manager.';
      }

      if (errorData.error === 'INVALID_CREDENTIALS') {
        return 'Invalid username or password. Please try again.';
      }
      
      if (errorData.error === 'TOO_MANY_LOGIN_ATTEMPTS') {
        return 'Too many attempts. Please wait a moment and try again.';
      }
      
      if (errorData.message && !errorData.message.includes('429')) {
        return errorData.message;
      }
    }
    
    // Don't show auth errors during initialization
    if (status === 401 && !user) {
      return null;
    }
    
    // Server errors
    if (status >= 500 || message.includes('server error')) {
      return 'Server error. Please try again in a moment.';
    }
    
    return null;
  }, [user, isDevelopment, getTenantSubdomain]);

  // Helper: Clear all auth state and redirect to login immediately
  const forceRedirectToLogin = useCallback(() => {
    if (sessionExpiredRef.current) return; // Already handling
    sessionExpiredRef.current = true;
    isRedirectingRef.current = true;

    console.warn('[Auth] Session expired - clearing all state and redirecting to login');

    // Clear React state synchronously
    setUser(null);
    setCsrfToken(null);
    setError(null);

    // Clear all client storage
    try {
      localStorage.removeItem('user');
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      localStorage.removeItem('kioskUser');
      localStorage.removeItem('authState');
      const keysToRemove = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (key.includes('token') || key.includes('auth') || key.includes('user') || key.includes('session'))) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach(key => localStorage.removeItem(key));
    } catch (e) { /* ignore */ }

    try { sessionStorage.clear(); } catch (e) { /* ignore */ }

    // Clear readable cookies (HTTP-only ones will be cleared by the server on /logout)
    try {
      document.cookie.split(';').forEach(cookie => {
        const name = cookie.split('=')[0].trim();
        if (name) {
          document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
          document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/api/auth;`;
        }
      });
    } catch (e) { /* ignore */ }

    // Fire-and-forget backend logout to clear HTTP-only cookies
    try {
      const logoutUrl = `${getApiUrl()}/api/auth/logout`;
      fetch(logoutUrl, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: '{}' }).catch(() => {});
    } catch (e) { /* ignore */ }

    // Hard redirect to login - NOTHING should stop this
    window.location.href = '/login';
  }, [getApiUrl]);

  // CRITICAL FIX: Enhanced request function with proper credentials handling
  const makeRequest = useCallback(async (url, options = {}) => {
    // CRITICAL: If session has expired, block ALL further API calls
    if (sessionExpiredRef.current) {
      const error = new Error('Session expired');
      error.response = { status: 401, data: { error: 'SESSION_EXPIRED' } };
      throw error;
    }

    const fullUrl = url.startsWith('http') ? url : `${getApiUrl()}${url}`;
    const skipAutoRedirect = options.skipAutoRedirect || false;
    const isFormData = options.body instanceof FormData;

    try {

      // CRITICAL FIX: Ensure credentials is set correctly
      // For FormData, don't set Content-Type - browser sets it with correct boundary
      const baseHeaders = getHeaders();
      if (isFormData) {
        delete baseHeaders['Content-Type'];
      }

      const fetchOptions = {
        method: options.method || 'GET',
        credentials: 'include', // ✅ CRITICAL: Must be here for cookies
        headers: {
          ...baseHeaders,
          ...options.headers
        }
      };

      // Remove Content-Type from custom headers if FormData (safety check)
      if (isFormData && fetchOptions.headers['Content-Type']) {
        delete fetchOptions.headers['Content-Type'];
      }

      // Add body only if provided
      if (options.body) {
        fetchOptions.body = options.body;
      }

      // Add signal only if provided
      if (options.signal) {
        fetchOptions.signal = options.signal;
      }

      const response = await fetch(fullUrl, fetchOptions);

      // Handle rate limiting silently in development
      if (response.status === 429) {
        console.warn('Rate limited - retrying after delay');
        await new Promise(resolve => setTimeout(resolve, 1000));
        throw new Error('Rate limited');
      }

      // Handle 401 Unauthorized - token expired
      if (response.status === 401) {
        const errorData = await response.json().catch(() => ({}));

        // For verify endpoint, don't auto-redirect - let verifySession handle token refresh
        if (url.includes('/api/auth/verify') || skipAutoRedirect) {
          const error = new Error(errorData.message || 'Session expired');
          error.response = { status: 401, data: errorData };
          throw error;
        }

        // CRITICAL: If already redirecting or session already expired, just throw
        if (isRedirectingRef.current || sessionExpiredRef.current) {
          const error = new Error('Session expired');
          error.response = { status: 401, data: { error: 'SESSION_EXPIRED' } };
          throw error;
        }

        // Check if we're already on a public route
        const currentPath = window.location.pathname;
        const PUBLIC_ROUTES = ['/login', '/kiosk/login', '/session-expired', '/verify-email', '/forgot-password', '/register'];
        const isPublicRoute = PUBLIC_ROUTES.some(route => currentPath === route || currentPath.endsWith(route));

        if (!isPublicRoute) {
          // CRITICAL: Go directly to login - no intermediate page
          // This prevents the flash loop caused by /session-expired triggering re-verification
          forceRedirectToLogin();

          // Throw to stop further execution
          const error = new Error('Session expired. Redirecting...');
          error.response = { status: 401, data: { error: 'SESSION_EXPIRED' } };
          throw error;
        }

        const error = new Error('Session expired. Please log in again.');
        error.response = { status: 401, data: { error: 'SESSION_EXPIRED' } };
        throw error;
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const error = new Error(errorData.message || `HTTP ${response.status}`);
        error.response = { status: response.status, data: errorData };
        throw error;
      }

      return response.json();
    } catch (err) {
      if (err.name === 'TypeError' && err.message.includes('fetch')) {
        const networkError = new Error('Network error');
        networkError.response = { status: 0, data: { message: 'Connection failed' } };
        throw networkError;
      }
      throw err;
    }
  }, [getApiUrl, getHeaders, isDevelopment, getTenantSubdomain]);

  // ✅ PERFORMANCE FIX: Removed duplicate fetchTenantInfo - now using TenantProvider's data

  // Try to refresh the access token using the refresh token
  const tryRefreshToken = useCallback(async () => {
    try {
      const fullUrl = `${getApiUrl()}/api/auth/refresh`;
      const response = await fetch(fullUrl, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          ...(() => {
            const tenantSubdomain = getTenantSubdomain();
            if (tenantSubdomain && tenantSubdomain !== 'admin') {
              return isDevelopment
                ? { 'X-Tenant-ID': tenantSubdomain }
                : { 'X-Tenant-Subdomain': tenantSubdomain };
            }
            return {};
          })()
        },
        body: JSON.stringify({})
      });

      if (response.ok) {
        return true; // Token refreshed successfully
      }
      return false;
    } catch (err) {
      console.warn('Token refresh failed:', err.message);
      return false;
    }
  }, [getApiUrl, getTenantSubdomain, isDevelopment]);

  // Single session verification with proper error handling
  // Now includes automatic token refresh on expiration
  const verifySession = useCallback(async () => {
    try {
      const data = await makeRequest('/api/auth/verify');

      if (data?.valid && data?.user) {
        return data.user;
      }
      throw new Error('Invalid session');
    } catch (err) {
      // If token expired, try to refresh it
      if (err.response?.status === 401 &&
          (err.response?.data?.error === 'TOKEN_EXPIRED' || err.response?.data?.error === 'INVALID_TOKEN')) {
        console.log('Access token expired, attempting refresh...');

        const refreshed = await tryRefreshToken();
        if (refreshed) {
          // Token refreshed, retry verification
          console.log('Token refreshed successfully, retrying verification...');
          try {
            const retryData = await makeRequest('/api/auth/verify');
            if (retryData?.valid && retryData?.user) {
              return retryData.user;
            }
          } catch (retryErr) {
            console.warn('Verification failed after token refresh:', retryErr.message);
          }
        }
      }

      // Don't set error for auth failures during initialization
      if (err.response?.status !== 401) {
        const friendlyError = getUserFriendlyError(err);
        if (friendlyError) {
          setError(friendlyError);
        }
      }

      throw err;
    }
  }, [makeRequest, getUserFriendlyError, tryRefreshToken]);

  // Token refresh with proper JSON body
  const scheduleTokenRefresh = useCallback(() => {
    const refreshTimer = setTimeout(async () => {
      // Don't attempt refresh if session already expired
      if (sessionExpiredRef.current) return;

      try {
        await makeRequest('/api/auth/refresh', {
          method: 'POST',
          body: JSON.stringify({}),
          skipAutoRedirect: true // Don't auto-redirect on refresh failure
        });
        scheduleTokenRefresh();
      } catch (error) {
        console.error('Auto token refresh failed:', error);
        // Only handle session expiry if it's not a rate limit error
        if (!error.message.includes('429') && !error.message.includes('Rate limited')) {
          const currentPath = window.location.pathname;
          const PUBLIC_ROUTES = ['/login', '/kiosk/login', '/session-expired', '/verify-email', '/forgot-password', '/register'];
          const isPublicRoute = PUBLIC_ROUTES.some(route => currentPath === route || currentPath.endsWith(route));

          if (!isPublicRoute && !isRedirectingRef.current && !sessionExpiredRef.current) {
            forceRedirectToLogin();
          }
        }
      }
    }, 11 * 60 * 60 * 1000); // 11 hours (refresh before 12h token expires)

    return () => clearTimeout(refreshTimer);
  }, [makeRequest, forceRedirectToLogin]);

  // FIXED: Single initialization without redirect loops
  useEffect(() => {
    if (initializedRef.current) {
      return;
    }

    const initializeAuth = async () => {
      initializedRef.current = true;

      const tenantSubdomain = getTenantSubdomain();

      // CRITICAL: If no tenant context, don't initialize AuthProvider
      if (!tenantSubdomain) {
        setLoading(false);
        return;
      }

      // ✅ PERFORMANCE FIX: Skip auth verify on public routes
      // This saves an unnecessary API call on login page
      const currentPath = window.location.pathname;
      const PUBLIC_ROUTES = ['/login', '/kiosk/login', '/session-expired', '/verify-email', '/forgot-password', '/register'];
      const isPublicRoute = PUBLIC_ROUTES.some(route => currentPath === route || currentPath.endsWith(route));

      if (isPublicRoute) {
        // On public routes, don't verify session - user needs to log in
        setLoading(false);
        return;
      }

      try {
        // Handle super admin access
        if (tenantSubdomain === 'admin') {
          try {
            const data = await makeRequest('/api/admin/auth/verify');
            if (data.valid && data.user.role === 'super_admin') {
              setUser(data.user);
            }
          } catch (error) {
            // No valid super admin session
          }
          setLoading(false);
          return;
        }

        // Regular tenant authentication flow - only on protected routes
        try {
          const user = await verifySession();
          if (user) {
            setUser(user);
            scheduleTokenRefresh();
          }
        } catch (verifyErr) {
          setUser(null);
          setCsrfToken(null);
        }
      } catch (err) {
        console.error("Auth initialization error:", err.message);
        const friendlyError = getUserFriendlyError(err);
        if (friendlyError) {
          setError(friendlyError);
        }
      } finally {
        setLoading(false);
      }
    };

    initializeAuth();
  }, [isDevelopment, getTenantSubdomain, verifySession, scheduleTokenRefresh, getUserFriendlyError, makeRequest]);

  // Enhanced login function with dual-mode support
  const login = async (identifier, password, isKiosk = false, recaptchaToken = null) => {
    setError(null);
    setLoading(true);
    
    try {
      const endpoint = isKiosk ? "/api/auth/kiosk/login" : "/api/auth/login";
      const payload = isKiosk
        ? { staffId: identifier, pin: password.toString() }
        : { username: identifier, password };

      const data = await makeRequest(endpoint, {
        method: 'POST',
        headers: recaptchaToken ? { 'X-Recaptcha-Token': recaptchaToken } : {},
        body: JSON.stringify(payload)
      });

      const { user, csrfToken: newCsrfToken, success } = data;
      
      if (!success || !user) {
        throw new Error("Login failed");
      }
      
      // Handle temporary password scenario
      if (user.requirePasswordChange) {
        return { user, requirePasswordChange: true };
      }
      
      // Normal login flow - reset session expired flags
      sessionExpiredRef.current = false;
      isRedirectingRef.current = false;

      setUser(user);
      if (newCsrfToken) {
        setCsrfToken(newCsrfToken);
      }

      scheduleTokenRefresh();

      // Preload attendance and accounting data in background for faster module loading
      preloadModuleData(makeRequest).catch(() => {
        // Ignore errors - preloading is non-critical
      });

      return { user, success: true };
      
    } catch (err) {
      console.error("Login failed:", err.message);
      const friendlyError = getUserFriendlyError(err);
      if (friendlyError) {
        throw new Error(friendlyError);
      } else {
        throw new Error("Unable to sign in. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  // Email verification and password change
  const verifyEmailAndChangePassword = useCallback(async (tenantId, username, tempPassword, newPassword) => {
    try {
      setLoading(true);
      setError(null);
      
      const data = await makeRequest('/api/public/complete-verification', {
        method: 'POST',
        body: JSON.stringify({
          tenantId,
          username,
          tempPassword,
          newPassword
        })
      });
      
      if (data.success && data.redirectTo) {
        console.log("Email verification and password change completed");
        return { 
          success: true, 
          redirectTo: data.redirectTo,
          message: "Account setup completed successfully!"
        };
      }
      
      throw new Error("Invalid response from server");
      
    } catch (err) {
      console.error("Email verification failed:", err.message);
      const friendlyError = getUserFriendlyError(err);
      throw new Error(friendlyError || "Account setup failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [makeRequest, getUserFriendlyError]);

  // Secure logout - FIXED: Centralized logout with complete state cleanup
  const logout = useCallback(async (skipApiCall = false) => {
    // Prevent multiple simultaneous logout attempts
    if (loggingOutRef.current) {
      console.log('[Auth] Logout already in progress, skipping');
      return;
    }

    loggingOutRef.current = true;

    try {
      // Clear all storage FIRST (synchronously)
      localStorage.removeItem('user');
      sessionStorage.clear();

      // Clear React state
      setUser(null);
      setCsrfToken(null);
      setError(null);
      initializedRef.current = false;
      retryCountRef.current = 0;

      // Call backend logout endpoint if not skipped
      if (!skipApiCall) {
        const isKioskMode = window.location.pathname.startsWith('/kiosk');
        const logoutEndpoint = isKioskMode ? '/api/auth/kiosk-logout' : '/api/auth/logout';

        // Don't await - let it run in background
        makeRequest(logoutEndpoint, { method: 'POST', body: JSON.stringify({}) }).catch(() => {
          // Ignore errors - state is already cleared
        });
      }
    } catch (error) {
      // Even if something fails, ensure state is cleared
      setUser(null);
      setCsrfToken(null);
      setError(null);
      localStorage.removeItem('user');
      sessionStorage.clear();
    } finally {
      // Reset logout flag after a short delay to allow navigation to complete
      setTimeout(() => {
        loggingOutRef.current = false;
      }, 1000);
    }
  }, [makeRequest]);

  // Clear errors after 8 seconds
  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(null), 8000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  // ✅ PERFORMANCE FIX: Use refreshTenantInfo from TenantProvider

  // Memoize isSuperAdmin to avoid recalculation
  const isSuperAdmin = useMemo(() => getTenantSubdomain() === 'admin', [getTenantSubdomain]);

  // Memoize clearError callback
  const clearError = useCallback(() => setError(null), []);

  // ✅ CRITICAL: Memoize context value to prevent unnecessary re-renders
  const contextValue = useMemo(() => ({
    user,
    tenantInfo: tenantInfoFromProvider,
    login,
    logout,
    verifyEmailAndChangePassword,
    loading,
    error,
    refreshTenantInfo: refreshTenantFromProvider,
    isSuperAdmin,
    csrfToken,
    clearError
  }), [
    user,
    tenantInfoFromProvider,
    login,
    logout,
    verifyEmailAndChangePassword,
    loading,
    error,
    refreshTenantFromProvider,
    isSuperAdmin,
    csrfToken,
    clearError
  ]);

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
};

export { AuthProvider };