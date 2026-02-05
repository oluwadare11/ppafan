// context/TenantProvider.jsx - Simplified for single-tenant PPAfan
import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from './AuthContext.jsx';

const TenantContext = createContext();

export const useTenant = () => {
  const context = useContext(TenantContext);
  if (!context) {
    throw new Error('useTenant must be used within a TenantProvider');
  }
  return context;
};

export const TenantProvider = ({ children }) => {
  const [tenantInfo, setTenantInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  const authContext = useContext(AuthContext);
  const logout = authContext?.logout;

  const isDevelopment = useMemo(() => import.meta.env.DEV, []);

  // Single tenant - always 'pumphouse'
  const currentTenant = 'pumphouse';
  const hasTenantContext = true;

  // Create headers for API requests
  const createHeaders = useCallback(() => {
    return {
      'Content-Type': 'application/json',
    };
  }, []);

  // API request wrapper
  const makeRequest = useCallback(async (endpoint, options = {}) => {
    const apiUrl = import.meta.env.VITE_API_URL || '';
    let fullUrl = endpoint.startsWith('http') ? endpoint : `${apiUrl}${endpoint}`;

    const { data, params, ...fetchOptions } = options;

    // Handle query parameters
    if (params && typeof params === 'object') {
      const queryString = Object.entries(params)
        .filter(([, value]) => value !== undefined && value !== null && value !== '')
        .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
        .join('&');

      if (queryString) {
        fullUrl += (fullUrl.includes('?') ? '&' : '?') + queryString;
      }
    }

    const headers = {
      ...createHeaders(),
      ...options.headers
    };

    const method = (options.method || 'GET').toUpperCase();
    if (!data && (method === 'DELETE' || method === 'GET')) {
      delete headers['Content-Type'];
    }

    // Handle FormData uploads
    const isFormData = data instanceof FormData;
    if (isFormData) {
      delete headers['Content-Type'];
    }

    const requestOptions = {
      credentials: 'include',
      mode: 'cors',
      headers,
      ...fetchOptions
    };

    if (data) {
      requestOptions.body = isFormData ? data : JSON.stringify(data);
    }

    const response = await fetch(fullUrl, requestOptions);

    if (!response.ok) {
      // Handle authentication failure
      if (response.status === 401) {
        // Check if we're in a kiosk route
        const isKioskRoute = window.location.pathname.startsWith('/kiosk/');
        const loginPath = isKioskRoute ? '/kiosk/login' : '/login';

        console.log('[TenantProvider] Authentication expired - redirecting to', loginPath);

        if (logout) {
          await logout(true);
        } else {
          localStorage.removeItem('user');
          sessionStorage.clear();

          // Clear kiosk-specific storage if in kiosk route
          if (isKioskRoute) {
            localStorage.removeItem('kioskUser');
            localStorage.removeItem('kioskAuthToken');
          }
        }

        navigate(loginPath, { replace: true });
        throw new Error('Authentication expired. Please log in again.');
      }

      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `HTTP ${response.status}: ${response.statusText}`);
    }

    return response.json();
  }, [createHeaders, navigate, logout]);

  // Simple navigation (no tenant parameter needed)
  const navigateWithTenant = useCallback((path, options = {}) => {
    navigate(path, options);
  }, [navigate]);

  // Fetch tenant/business info on mount
  useEffect(() => {
    let mounted = true;

    const fetchTenantInfo = async () => {
      setLoading(true);
      setError(null);

      try {
        const data = await makeRequest('/api/tenant/info');

        if (mounted && data?.tenant) {
          setTenantInfo(data.tenant);
        }
      } catch (err) {
        if (mounted) {
          console.warn("Failed to fetch tenant info:", err.message);
          // Set fallback info
          setTenantInfo({
            businessName: 'PPAfan',
            businessType: 'Attendance Management',
            branding: {
              primaryColor: '#2563EB',
              secondaryColor: '#10B981',
              logo: null
            },
            subscription: { plan: 'enterprise', status: 'active' }
          });
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    fetchTenantInfo();

    return () => {
      mounted = false;
    };
  }, [makeRequest]);

  // Refresh tenant info
  const refreshTenantInfo = useCallback(async () => {
    try {
      const data = await makeRequest('/api/tenant/info');
      if (data?.tenant) {
        setTenantInfo(data.tenant);
        return data.tenant;
      }
    } catch (err) {
      console.warn("Failed to refresh tenant info:", err.message);
    }
    return tenantInfo;
  }, [makeRequest, tenantInfo]);

  // Apply brand colors as CSS variables
  useEffect(() => {
    if (tenantInfo?.branding) {
      const { primaryColor, secondaryColor } = tenantInfo.branding;
      const root = document.documentElement;

      root.style.setProperty('--brand-primary', primaryColor || '#2563EB');
      root.style.setProperty('--brand-secondary', secondaryColor || '#10B981');

      const hexToRgb = (hex) => {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? {
          r: parseInt(result[1], 16),
          g: parseInt(result[2], 16),
          b: parseInt(result[3], 16)
        } : { r: 37, g: 99, b: 235 };
      };

      const primary = hexToRgb(primaryColor || '#2563EB');
      const secondary = hexToRgb(secondaryColor || '#10B981');

      root.style.setProperty('--brand-primary-rgb', `${primary.r}, ${primary.g}, ${primary.b}`);
      root.style.setProperty('--brand-secondary-rgb', `${secondary.r}, ${secondary.g}, ${secondary.b}`);
      root.style.setProperty('--brand-primary-light', `rgba(${primary.r}, ${primary.g}, ${primary.b}, 0.1)`);
      root.style.setProperty('--brand-primary-hover', `rgba(${primary.r}, ${primary.g}, ${primary.b}, 0.9)`);
    }
  }, [tenantInfo?.branding]);

  // URL helpers (simplified - no tenant parameter)
  const getTenantLoginUrl = useCallback(() => '/login', []);
  const getTenantDashboardUrl = useCallback(() => '/dashboard', []);

  const contextValue = useMemo(() => ({
    tenantInfo,
    currentTenant,
    hasTenantContext,
    loading,
    error,
    navigateWithTenant,
    getTenantLoginUrl,
    getTenantDashboardUrl,
    makeRequest,
    createHeaders,
    refreshTenantInfo,
    clearError: () => setError(null),
    isDevelopment
  }), [
    tenantInfo,
    loading,
    error,
    navigateWithTenant,
    getTenantLoginUrl,
    getTenantDashboardUrl,
    makeRequest,
    createHeaders,
    refreshTenantInfo,
    isDevelopment
  ]);

  return (
    <TenantContext.Provider value={contextValue}>
      {children}
    </TenantContext.Provider>
  );
};
