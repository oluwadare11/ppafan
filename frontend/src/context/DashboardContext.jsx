// DashboardContext.jsx - Smart caching and state management for dashboard
import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useTenant } from './TenantProvider.jsx';

const DashboardContext = createContext();

// Cache configuration
const CACHE_CONFIG = {
  CACHE_KEY_PREFIX: 'pumphouse_dashboard_',
  DEFAULT_TTL: 5 * 60 * 1000, // 5 minutes
  MAX_TTL: 15 * 60 * 1000,     // 15 minutes
  BACKGROUND_REFRESH_INTERVAL: 5 * 60 * 1000, // Refresh every 5 minutes
  STALE_WHILE_REVALIDATE: true // Show stale data while fetching fresh data
};

// Cache utilities
const CacheUtils = {
  // Generate cache key for tenant and date range
  getCacheKey: (tenantId, startDate, endDate) => {
    return `${CACHE_CONFIG.CACHE_KEY_PREFIX}${tenantId}_${startDate}_${endDate}`;
  },

  // Save data to localStorage with timestamp
  saveToCache: (key, data, ttl = CACHE_CONFIG.DEFAULT_TTL) => {
    try {
      const cacheItem = {
        data,
        timestamp: Date.now(),
        ttl,
        expiresAt: Date.now() + ttl
      };
      localStorage.setItem(key, JSON.stringify(cacheItem));
      return true;
    } catch (error) {
      console.warn('Failed to save to cache:', error);
      return false;
    }
  },

  // Get data from localStorage
  getFromCache: (key) => {
    try {
      const cached = localStorage.getItem(key);
      if (!cached) return null;

      const cacheItem = JSON.parse(cached);
      const now = Date.now();

      // Check if cache is expired
      if (now > cacheItem.expiresAt) {
        localStorage.removeItem(key);
        return null;
      }

      // Check if cache is stale (past 50% of TTL)
      const isStale = now > (cacheItem.timestamp + (cacheItem.ttl * 0.5));

      return {
        data: cacheItem.data,
        isStale,
        age: now - cacheItem.timestamp
      };
    } catch (error) {
      console.warn('Failed to read from cache:', error);
      return null;
    }
  },

  // Clear cache for specific tenant
  clearTenantCache: (tenantId) => {
    try {
      const keys = Object.keys(localStorage);
      const prefix = `${CACHE_CONFIG.CACHE_KEY_PREFIX}${tenantId}_`;
      keys.forEach(key => {
        if (key.startsWith(prefix)) {
          localStorage.removeItem(key);
        }
      });
      return true;
    } catch (error) {
      console.warn('Failed to clear cache:', error);
      return false;
    }
  },

  // Clear all dashboard caches
  clearAllCache: () => {
    try {
      const keys = Object.keys(localStorage);
      keys.forEach(key => {
        if (key.startsWith(CACHE_CONFIG.CACHE_KEY_PREFIX)) {
          localStorage.removeItem(key);
        }
      });
      return true;
    } catch (error) {
      console.warn('Failed to clear all cache:', error);
      return false;
    }
  }
};

export const DashboardProvider = ({ children }) => {
  const { currentTenant, makeRequest } = useTenant();

  const [dashboardData, setDashboardData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [lastFetch, setLastFetch] = useState(null);
  const [cacheStatus, setCacheStatus] = useState({ isCached: false, isStale: false, age: 0 });

  // Refs for managing intervals and preventing duplicate fetches
  const backgroundRefreshInterval = useRef(null);
  const fetchInProgress = useRef(false);
  const isTabVisible = useRef(true);

  // Track tab visibility to pause refresh when tab is not active
  useEffect(() => {
    const handleVisibilityChange = () => {
      isTabVisible.current = !document.hidden;

      // Resume background refresh when tab becomes visible
      if (isTabVisible.current && dashboardData) {
        const timeSinceLastFetch = Date.now() - (lastFetch || 0);
        if (timeSinceLastFetch > CACHE_CONFIG.BACKGROUND_REFRESH_INTERVAL) {
          fetchDashboardData(true); // Silent refresh
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [dashboardData, lastFetch]);

  // Fetch dashboard data with caching
  const fetchDashboardData = useCallback(async (silent = false, dateRange = null) => {
    // Prevent duplicate fetches
    if (fetchInProgress.current) {
      console.log('Fetch already in progress, skipping...');
      return;
    }

    try {
      fetchInProgress.current = true;

      // Set loading state (skip if silent refresh)
      if (!silent) {
        setLoading(true);
      } else {
        setRefreshing(true);
      }
      setError(null);

      // Determine date range (default to today)
      const today = new Date().toISOString().split('T')[0];
      const { startDate = today, endDate = today } = dateRange || {};

      // Check cache first
      const cacheKey = CacheUtils.getCacheKey(currentTenant, startDate, endDate);
      const cached = CacheUtils.getFromCache(cacheKey);

      // If we have valid cache and this is not a forced refresh
      if (cached && !silent && CACHE_CONFIG.STALE_WHILE_REVALIDATE) {
        console.log('📦 Using cached data (age: ${cached.age}ms, stale: ${cached.isStale})');
        setDashboardData(cached.data);
        setCacheStatus({
          isCached: true,
          isStale: cached.isStale,
          age: cached.age
        });
        setLoading(false);

        // If cache is stale, fetch fresh data in background
        if (cached.isStale) {
          console.log('🔄 Cache is stale, fetching fresh data...');
          setRefreshing(true);
        } else {
          // Cache is fresh, no need to fetch
          fetchInProgress.current = false;
          return;
        }
      }

      // Fetch fresh data from API
      console.log('🌐 Fetching fresh dashboard data from API...');
      const params = new URLSearchParams({ startDate, endDate });
      const response = await makeRequest(`/api/dashboard/overview?${params}`);

      if (response.success && response.data) {
        // Update state
        setDashboardData(response.data);
        setLastFetch(Date.now());
        setCacheStatus({
          isCached: false,
          isStale: false,
          age: 0
        });

        // Save to cache
        const ttl = response.data.ttl || CACHE_CONFIG.DEFAULT_TTL;
        CacheUtils.saveToCache(cacheKey, response.data, ttl);
        console.log('✅ Dashboard data fetched and cached successfully');
      } else {
        throw new Error('Invalid response format from dashboard API');
      }

    } catch (err) {
      console.error('Dashboard fetch error:', err);
      setError(err.message || 'Failed to fetch dashboard data');

      // If fetch fails and we have cached data, keep using it
      if (dashboardData) {
        console.log('⚠️ Fetch failed, keeping existing data');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
      fetchInProgress.current = false;
    }
  }, [currentTenant, makeRequest, dashboardData]);

  // Setup background refresh interval
  useEffect(() => {
    // Clear existing interval
    if (backgroundRefreshInterval.current) {
      clearInterval(backgroundRefreshInterval.current);
    }

    // Only setup background refresh if we have data and tab is visible
    if (dashboardData && isTabVisible.current) {
      backgroundRefreshInterval.current = setInterval(() => {
        if (isTabVisible.current) {
          console.log('🔄 Background refresh triggered');
          fetchDashboardData(true); // Silent refresh
        }
      }, CACHE_CONFIG.BACKGROUND_REFRESH_INTERVAL);
    }

    return () => {
      if (backgroundRefreshInterval.current) {
        clearInterval(backgroundRefreshInterval.current);
      }
    };
  }, [dashboardData, fetchDashboardData]);

  // Initial fetch on mount
  useEffect(() => {
    if (currentTenant) {
      fetchDashboardData(false);
    }
  }, [currentTenant]); // Only refetch when tenant changes

  // Manual refresh function
  const refreshDashboard = useCallback((silent = false) => {
    return fetchDashboardData(silent);
  }, [fetchDashboardData]);

  // Clear cache function
  const clearCache = useCallback(() => {
    CacheUtils.clearTenantCache(currentTenant);
    setCacheStatus({ isCached: false, isStale: false, age: 0 });
    console.log('🗑️ Dashboard cache cleared');
  }, [currentTenant]);

  // Clear cache on logout (when tenant changes to null)
  useEffect(() => {
    if (!currentTenant) {
      CacheUtils.clearAllCache();
    }
  }, [currentTenant]);

  const value = {
    dashboardData,
    loading,
    refreshing,
    error,
    lastFetch,
    cacheStatus,
    refreshDashboard,
    clearCache,
    fetchDashboardData
  };

  return (
    <DashboardContext.Provider value={value}>
      {children}
    </DashboardContext.Provider>
  );
};

// Custom hook to use dashboard context
export const useDashboard = () => {
  const context = useContext(DashboardContext);
  if (!context) {
    throw new Error('useDashboard must be used within a DashboardProvider');
  }
  return context;
};

export default DashboardContext;
