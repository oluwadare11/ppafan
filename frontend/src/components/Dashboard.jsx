// Dashboard.jsx - Tier-Aware Dashboard with Beautiful Loading States
import React, { useState, useEffect, useContext, useCallback } from 'react';
import { AuthContext } from '../context/AuthContext.jsx';
import { useTenant } from '../context/TenantProvider.jsx';
import {
  TrendingUp, TrendingDown, ArrowUpRight, ArrowDownRight,
  Filter, Download, RefreshCw, Bell, Clock, Users,
  DollarSign, Package, ShoppingCart, AlertTriangle,
  Calendar, BarChart3, PieChart, Activity, Star,
  CheckCircle, XCircle, Eye, Target
} from 'lucide-react';
import {
  LineChart, Line, AreaChart, Area, PieChart as PieChartContainer,
  Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, BarChart, Bar
} from 'recharts';
import LoadingInsights, { InlineLoader } from './dashboard/LoadingInsights.jsx';
import { DashboardSkeleton } from './dashboard/SkeletonLoaders.jsx';
import EnhancedKPICard, { KPICardVariants } from './dashboard/EnhancedKPICard.jsx';
import { RevenuePieChart, FinancialSummary } from './dashboard/DashboardWidgets.jsx';
import {
  TopItemsTable,
  TopCustomersTable,
  RecentTransactionsTable,
  LowStockAlertsTable
} from './dashboard/DashboardTables.jsx';
import QuickActionsBar from './dashboard/QuickActionsBar.jsx';
import {
  AttendanceWidget
} from './dashboard/TierWidgets.jsx';
// Removed: PayrollWidget, MarketingWidget, SignageWidget, VisitorWidget - not used in Pump House ERP

// Cache helper functions
const CACHE_KEY_PREFIX = 'dashboard_cache_';
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

const getCacheKey = (tenantId, view) => `${CACHE_KEY_PREFIX}${tenantId}_${view}`;

const getCachedData = (tenantId, view) => {
  try {
    const key = getCacheKey(tenantId, view);
    const cached = sessionStorage.getItem(key);
    if (!cached) return null;

    const { data, rawData, timestamp } = JSON.parse(cached);
    const isExpired = Date.now() - timestamp > CACHE_TTL;

    // Return cached data even if expired (we'll refresh in background)
    return { data, rawData, isExpired };
  } catch (e) {
    return null;
  }
};

const setCachedData = (tenantId, view, data, rawData) => {
  try {
    const key = getCacheKey(tenantId, view);
    sessionStorage.setItem(key, JSON.stringify({
      data,
      rawData,
      timestamp: Date.now()
    }));
  } catch (e) {
    console.warn('Failed to cache dashboard data:', e);
  }
};

const Dashboard = () => {
  const { user } = useContext(AuthContext);
  const { tenantInfo, currentTenant, makeRequest, navigateWithTenant } = useTenant();

  // Store raw backend data for tier widgets
  const [rawBackendData, setRawBackendData] = useState(null);

  // Track if we have any cached data (for showing full loader vs inline)
  const [hasInitialData, setHasInitialData] = useState(false);
  const hasInitialDataRef = React.useRef(false);

  const [dashboardData, setDashboardData] = useState({
    kpiMetrics: {
      totalRevenue: 0,
      totalExpenses: 0,
      netProfit: 0,
      activeStaff: 0,
      totalTransactions: 0,
      averageTransactionValue: 0,
      lowStockItems: 0,
      attendanceRate: 0,
      totalCustomers: 0,
      newCustomers: 0,
      inventoryCheckouts: 0,
      totalStaff: 0
    },
    chartData: {
      salesByDate: {},
      attendanceByDate: {},
      revenueBySection: {},
      customersByType: {},
      expensesByCategory: {}
    },
    tableData: {
      topSellingItems: [],
      topCustomers: [],
      lowStockItems: [],
      recentTransactions: [],
      staffPerformance: []
    },
    recentActivities: []
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  // Smart default date ranges - TODAY focused
  const [selectedDashboardView, setSelectedDashboardView] = useState('today');
  const [dateRange, setDateRange] = useState(() => {
    const today = new Date().toISOString().split('T')[0];
    return {
      startDate: today,
      endDate: today
    };
  });

  // Historical range for chart data
  const [historicalRange] = useState(() => {
    const today = new Date();
    const thirtyDaysAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
    return {
      startDate: thirtyDaysAgo.toISOString().split('T')[0],
      endDate: today.toISOString().split('T')[0]
    };
  });

  // Smart date range helper
  const getSmartDateRange = () => {
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    
    switch (selectedDashboardView) {
      case 'today':
        return {
          startDate: todayStr,
          endDate: todayStr,
          label: 'Today'
        };
      case 'week':
        const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
        return {
          startDate: weekAgo.toISOString().split('T')[0],
          endDate: todayStr,
          label: 'Last 7 Days'
        };
      case 'month':
        const monthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
        return {
          startDate: monthAgo.toISOString().split('T')[0],
          endDate: todayStr,
          label: 'Last 30 Days'
        };
      default:
        return {
          startDate: todayStr,
          endDate: todayStr,
          label: 'Today'
        };
    }
  };

  // Transform new backend response to legacy frontend structure
  const transformDashboardData = (newData) => {
    return {
      kpiMetrics: {
        totalRevenue: newData.kpis?.revenue || 0,
        totalExpenses: newData.kpis?.expenses || 0,
        netProfit: newData.financial?.netProfit || 0,
        activeStaff: newData.kpis?.attendance?.present || 0, // Today's present staff
        totalTransactions: newData.kpis?.salesCount || 0,
        averageTransactionValue: newData.kpis?.avgTransaction || 0,
        lowStockItems: newData.kpis?.lowStockCount || 0,
        attendanceRate: newData.kpis?.attendance?.rate || 0,
        totalCustomers: newData.kpis?.totalCustomers || 0,
        newCustomers: newData.kpis?.newCustomers || 0,
        inventoryCheckouts: 0,
        totalStaff: newData.kpis?.attendance?.total || 0
      },
      chartData: {
        salesByDate: (newData.charts?.salesTrend || []).reduce((acc, item) => {
          acc[item.date] = item.sales;
          return acc;
        }, {}),
        attendanceByDate: {},
        revenueBySection: (newData.charts?.revenueBySection || []).reduce((acc, item) => {
          acc[item.name] = item.value;
          return acc;
        }, {}),
        customersByType: {},
        expensesByCategory: {}
      },
      tableData: {
        topSellingItems: newData.tables?.topItems || [],
        topCustomers: newData.tables?.topCustomers || [],
        lowStockItems: newData.alerts?.lowStock || [],
        recentTransactions: newData.tables?.recentTransactions || [],
        staffPerformance: []
      },
      recentActivities: []
    };
  };

  // Fetch dashboard data using TenantProvider's makeRequest
  const fetchDashboardData = useCallback(async (isFilterChange = false) => {
    try {
      // Check for cached data first
      const cached = getCachedData(currentTenant, selectedDashboardView);

      if (cached) {
        // We have cached data - show it immediately
        setDashboardData(cached.data);
        setRawBackendData(cached.rawData);
        setHasInitialData(true);
        hasInitialDataRef.current = true;
        setLoading(false);

        // If cache is fresh and not a forced refresh, use cached data only
        if (!cached.isExpired && !isFilterChange) {
          setRefreshing(false);
          return;
        }

        // Cache exists but expired or forced refresh - fetch fresh data in background
        setRefreshing(true);
      } else if (hasInitialDataRef.current) {
        // No cache for this view but user has seen data before - show inline loader
        setLoading(true);
        setRefreshing(true);
      } else {
        // First ever load - show full loading screen
        setLoading(true);
      }

      setError('');

      console.log('Fetching dashboard data for tenant:', currentTenant);

      const smartRange = getSmartDateRange();

      const kpiParams = new URLSearchParams({
        startDate: smartRange.startDate,
        endDate: smartRange.endDate
      });

      console.log('Dashboard API Call:', {
        kpiRange: smartRange,
        view: selectedDashboardView,
        tenant: currentTenant
      });

      const response = await makeRequest(`/api/dashboard/overview?${kpiParams}`);

      if (response.success && response.data) {
        // Store raw backend data for tier widgets
        setRawBackendData(response.data);

        // Transform new backend structure to legacy frontend structure
        const transformedData = transformDashboardData(response.data);
        setDashboardData(transformedData);
        setHasInitialData(true);
        hasInitialDataRef.current = true;

        // Cache the data for faster subsequent loads
        setCachedData(currentTenant, selectedDashboardView, transformedData, response.data);

        if (selectedDashboardView === 'today') {
          try {
            const historicalParams = new URLSearchParams({
              startDate: historicalRange.startDate,
              endDate: historicalRange.endDate
            });

            const historicalResponse = await makeRequest(`/api/dashboard/overview?${historicalParams}`);
            if (historicalResponse.success && historicalResponse.data) {
              const transformedHistorical = transformDashboardData(historicalResponse.data);
              setDashboardData(prevData => ({
                ...prevData,
                chartData: {
                  ...prevData.chartData,
                  // Only update salesByDate for historical trend chart
                  // Keep all other chart data from the current date-filtered fetch
                  salesByDate: transformedHistorical.chartData.salesByDate,
                  attendanceByDate: transformedHistorical.chartData.attendanceByDate
                }
              }));
            }
          } catch (historicalError) {
            console.warn('Failed to fetch historical chart data:', historicalError.message);
          }
        }
      } else {
        throw new Error('Invalid response format from dashboard API');
      }

      console.log('Dashboard data loaded successfully');

    } catch (error) {
      console.error('Dashboard data fetch error:', error);
      setError(`Failed to fetch dashboard data: ${error.message}`);
      
      setDashboardData({
        kpiMetrics: {
          totalRevenue: 0,
          totalExpenses: 0,
          netProfit: 0,
          activeStaff: 0,
          totalTransactions: 0,
          averageTransactionValue: 0,
          lowStockItems: 0,
          attendanceRate: 0,
          totalCustomers: 0,
          newCustomers: 0,
          inventoryCheckouts: 0,
          totalStaff: 0
        },
        chartData: {
          salesByDate: {},
          attendanceByDate: {},
          revenueBySection: {},
          customersByType: {},
          expensesByCategory: {}
        },
        tableData: {
          topSellingItems: [],
          topCustomers: [],
          lowStockItems: [],
          recentTransactions: [],
          staffPerformance: []
        },
        recentActivities: []
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedDashboardView, historicalRange, currentTenant, makeRequest]);

  // Handle view change
  const handleViewChange = (view) => {
    setSelectedDashboardView(view);
    
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    
    if (view === 'today') {
      setDateRange({
        startDate: todayStr,
        endDate: todayStr
      });
    } else if (view === 'week') {
      const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
      setDateRange({
        startDate: weekAgo.toISOString().split('T')[0],
        endDate: todayStr
      });
    } else if (view === 'month') {
      const monthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
      setDateRange({
        startDate: monthAgo.toISOString().split('T')[0],
        endDate: todayStr
      });
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    fetchDashboardData(true); // Force fresh fetch
  };

  // Format currency dynamically
  const formatCurrency = (amount) => {
    if (typeof amount !== 'number' || isNaN(amount)) return '₦0';

    const currency = tenantInfo?.settings?.currency || 'NGN';
    const locale = currency === 'NGN' ? 'en-NG' : 'en-US';

    try {
      return new Intl.NumberFormat(locale, {
        style: 'currency',
        currency: currency,
        minimumFractionDigits: 0,
        maximumFractionDigits: 2
      }).format(amount);
    } catch (error) {
      return `₦${amount.toLocaleString()}`;
    }
  };

  // Get tier level from tenant info - FIXED: Use correct path to subscription plan
  const getTierLevel = () => {
    const plan = tenantInfo?.subscription?.plan?.toLowerCase();
    if (!plan) return 1;
    if (plan === 'starter') return 1;
    if (plan === 'growth') return 2;
    if (['pro', 'enterprise'].includes(plan)) return 3;
    return 1;
  };

  const currentTier = getTierLevel();

  // Debug log for tier detection
  console.log('Dashboard Tier Detection:', {
    subscription: tenantInfo?.subscription,
    plan: tenantInfo?.subscription?.plan,
    detectedTier: currentTier
  });

  // Format date for chart display (short format: "Dec 20" or "20 Dec")
  const formatChartDate = (dateStr) => {
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    } catch {
      return dateStr;
    }
  };

  // Convert chart data objects to arrays for Recharts with formatted dates
  // Shows exactly 14 days with all days filled (0 for days with no sales)
  const convertSalesByDate = () => {
    const salesData = dashboardData.chartData.salesByDate || {};
    const result = [];
    const today = new Date();

    // Generate last 14 days
    for (let i = 13; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(today.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];

      result.push({
        date: formatChartDate(dateStr),
        fullDate: dateStr,
        sales: salesData[dateStr] || 0
      });
    }

    return result;
  };

  const convertRevenueBySection = () => {
    const colors = ['#8B5CF6', '#06D6A0', '#FFD23F', '#F72585', '#3B82F6', '#EF4444'];
    return Object.entries(dashboardData.chartData.revenueBySection || {}).map(([section, revenue], index) => ({
      name: section,
      value: revenue,
      color: colors[index % colors.length]
    }));
  };

  useEffect(() => {
    if (!user) {
      navigateWithTenant('/login');
      return; // Don't fetch data or set interval if no user
    }

    // Only fetch if we have a user
    fetchDashboardData();

    const interval = setInterval(fetchDashboardData, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [user, navigateWithTenant, fetchDashboardData]);

  // Show loading insights ONLY on true initial load (no cached data ever shown)
  // Once user has seen data, always show inline loader for subsequent fetches
  if (loading && !hasInitialData) {
    return <LoadingInsights message={`Loading ${tenantInfo?.businessName || 'your'} dashboard...`} />;
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Silent refresh indicator - show when refreshing OR loading with cached data */}
      {(refreshing || (loading && hasInitialData)) && <InlineLoader message="Updating..." />}
      {/* Header */}
      <header className="bg-white/95 backdrop-blur-md border-b border-gray-200 sticky top-0 z-50">
        <div className="px-4 sm:px-6 lg:px-8 py-3 sm:py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3 sm:space-x-4 min-w-0">
              <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-r from-purple-600 to-pink-600 rounded-xl flex items-center justify-center flex-shrink-0">
                <span className="text-white font-bold text-base sm:text-lg">
                  {(tenantInfo?.businessName || 'B')[0].toUpperCase()}
                </span>
              </div>
              <div className="min-w-0">
                <h1 className="text-lg sm:text-xl lg:text-2xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent truncate">
                  {tenantInfo?.businessName || 'Business'}
                </h1>
                <p className="text-gray-600 text-xs sm:text-sm hidden sm:block">Real-time business insights</p>
              </div>
            </div>

            <div className="flex items-center space-x-2 sm:space-x-4 lg:space-x-6">
              <div className="text-right hidden md:block">
                <p className="text-base lg:text-lg font-semibold text-gray-900">
                  {new Date().toLocaleTimeString('en-US', {
                    hour: 'numeric',
                    minute: '2-digit',
                    hour12: true
                  })}
                </p>
                <p className="text-xs lg:text-sm text-gray-600">
                  {new Date().toLocaleDateString('en-US', {
                    weekday: 'short',
                    month: 'short',
                    day: 'numeric'
                  })}
                </p>
              </div>

              {/* Dashboard auto-refreshes every 5 minutes */}
            </div>
          </div>
        </div>
      </header>

      <div className="px-4 sm:px-6 lg:px-8 py-4 sm:py-6">
        {/* Error Display */}
        {error && (
          <div className="mb-4 sm:mb-6 bg-red-50 border-l-4 border-red-500 text-red-700 px-3 sm:px-4 py-2 sm:py-3 rounded-lg shadow-sm">
            <div className="flex items-center">
              <AlertTriangle className="w-4 h-4 sm:w-5 sm:h-5 mr-2 sm:mr-3 flex-shrink-0" />
              <span className="text-sm sm:text-base">{error}</span>
            </div>
          </div>
        )}

        {/* Dashboard View Controls */}
        <div className="mb-4 sm:mb-6 lg:mb-8 bg-white rounded-xl shadow-sm border border-gray-100 p-3 sm:p-4 lg:p-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <h2 className="text-base sm:text-lg font-semibold text-gray-900">Dashboard View</h2>
            <div className="flex items-center bg-gray-100 rounded-lg p-1 w-full sm:w-auto">
              <button
                onClick={() => handleViewChange('today')}
                className={`flex-1 sm:flex-none px-3 sm:px-4 py-2 rounded-md text-xs sm:text-sm font-medium transition-colors ${
                  selectedDashboardView === 'today'
                    ? 'bg-white text-purple-600 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Today
              </button>
              <button
                onClick={() => handleViewChange('week')}
                className={`flex-1 sm:flex-none px-3 sm:px-4 py-2 rounded-md text-xs sm:text-sm font-medium transition-colors ${
                  selectedDashboardView === 'week'
                    ? 'bg-white text-purple-600 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Week
              </button>
              <button
                onClick={() => handleViewChange('month')}
                className={`flex-1 sm:flex-none px-3 sm:px-4 py-2 rounded-md text-xs sm:text-sm font-medium transition-colors ${
                  selectedDashboardView === 'month'
                    ? 'bg-white text-purple-600 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Month
              </button>
            </div>
          </div>
        </div>

        {/* KPI Cards - Responsive Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 lg:gap-6 mb-4 sm:mb-6 lg:mb-8">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-3 sm:p-4 lg:p-6 hover:shadow-md transition-all duration-300">
            <div className="flex items-center justify-between">
              <div className="flex-1 min-w-0 overflow-hidden">
                <p className="text-xs sm:text-sm font-medium text-gray-600 mb-0.5 sm:mb-1">Revenue</p>
                <p className="text-sm sm:text-base lg:text-xl font-bold text-gray-900 break-all leading-tight">
                  {formatCurrency(dashboardData.kpiMetrics.totalRevenue)}
                </p>
              </div>
              <div className="w-8 h-8 sm:w-10 sm:h-10 lg:w-12 lg:h-12 rounded-lg flex items-center justify-center bg-gradient-to-r from-green-500 to-emerald-600 flex-shrink-0 ml-2">
                <DollarSign className="w-4 h-4 sm:w-5 sm:h-5 lg:w-6 lg:h-6 text-white" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-3 sm:p-4 lg:p-6 hover:shadow-md transition-all duration-300">
            <div className="flex items-center justify-between">
              <div className="flex-1 min-w-0">
                <p className="text-xs sm:text-sm font-medium text-gray-600 mb-0.5 sm:mb-1">Transactions</p>
                <p className="text-sm sm:text-base lg:text-xl font-bold text-gray-900">{dashboardData.kpiMetrics.totalTransactions}</p>
              </div>
              <div className="w-8 h-8 sm:w-10 sm:h-10 lg:w-12 lg:h-12 rounded-lg flex items-center justify-center bg-gradient-to-r from-blue-500 to-cyan-600 flex-shrink-0 ml-2">
                <ShoppingCart className="w-4 h-4 sm:w-5 sm:h-5 lg:w-6 lg:h-6 text-white" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-3 sm:p-4 lg:p-6 hover:shadow-md transition-all duration-300">
            <div className="flex items-center justify-between">
              <div className="flex-1 min-w-0">
                <p className="text-xs sm:text-sm font-medium text-gray-600 mb-0.5 sm:mb-1">
                  Staff on Duty
                  <span className="text-[10px] sm:text-xs text-gray-400 ml-1">(today)</span>
                </p>
                <p className="text-sm sm:text-base lg:text-xl font-bold text-gray-900">{dashboardData.kpiMetrics.activeStaff}/{dashboardData.kpiMetrics.totalStaff || 0}</p>
              </div>
              <div className="w-8 h-8 sm:w-10 sm:h-10 lg:w-12 lg:h-12 rounded-lg flex items-center justify-center bg-gradient-to-r from-purple-500 to-violet-600 flex-shrink-0 ml-2">
                <Users className="w-4 h-4 sm:w-5 sm:h-5 lg:w-6 lg:h-6 text-white" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-3 sm:p-4 lg:p-6 hover:shadow-md transition-all duration-300">
            <div className="flex items-center justify-between">
              <div className="flex-1 min-w-0">
                <p className="text-xs sm:text-sm font-medium text-gray-600 mb-0.5 sm:mb-1">
                  Low Stock
                  <span className="text-[10px] sm:text-xs text-gray-400 ml-1">(now)</span>
                </p>
                <p className="text-sm sm:text-base lg:text-xl font-bold text-gray-900">{dashboardData.kpiMetrics.lowStockItems}</p>
              </div>
              <div className="w-8 h-8 sm:w-10 sm:h-10 lg:w-12 lg:h-12 rounded-lg flex items-center justify-center bg-gradient-to-r from-orange-500 to-red-600 flex-shrink-0 ml-2">
                <Package className="w-4 h-4 sm:w-5 sm:h-5 lg:w-6 lg:h-6 text-white" />
              </div>
            </div>
          </div>
        </div>

        {/* Quick Actions - Tier Aware & Mobile Responsive */}
        <div className="mb-4 sm:mb-6 lg:mb-8">
          <h2 className="text-base sm:text-lg font-semibold text-gray-900 mb-3 sm:mb-4">Quick Actions</h2>
          <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-2 sm:gap-3 lg:gap-4">
            {/* Tier 1: POS Management */}
            <button
              onClick={() => navigateWithTenant('/pos')}
              className="p-3 sm:p-4 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-600 text-white hover:scale-105 transition-all duration-300 shadow-md hover:shadow-lg"
            >
              <ShoppingCart className="w-5 h-5 sm:w-6 sm:h-6 mx-auto mb-1 sm:mb-2" />
              <p className="text-xs sm:text-sm font-medium truncate">POS</p>
            </button>
            {/* Tier 1: QuickSell Kiosk */}
            <button
              onClick={() => {
                  const kioskUrl = `${window.location.origin}/kiosk/login?redirect=pos`;
                  window.open(kioskUrl, '_blank', 'noopener,noreferrer');
                }}
              className="p-3 sm:p-4 rounded-xl bg-gradient-to-r from-green-500 to-emerald-600 text-white hover:scale-105 transition-all duration-300 shadow-md hover:shadow-lg"
            >
              <Target className="w-5 h-5 sm:w-6 sm:h-6 mx-auto mb-1 sm:mb-2" />
              <p className="text-xs sm:text-sm font-medium truncate">QuickSell</p>
            </button>
            
            {/* Tier 1: Inventory */}
            <button
              onClick={() => navigateWithTenant('/inventory')}
              className="p-3 sm:p-4 rounded-xl bg-gradient-to-r from-purple-500 to-violet-600 text-white hover:scale-105 transition-all duration-300 shadow-md hover:shadow-lg"
            >
              <Package className="w-5 h-5 sm:w-6 sm:h-6 mx-auto mb-1 sm:mb-2" />
              <p className="text-xs sm:text-sm font-medium truncate">Inventory</p>
            </button>
            {/* Tier 1: StockFlow Kiosk */}
            <button
              onClick={() => {
                  const kioskUrl = `${window.location.origin}/kiosk/login?redirect=inventory`;
                  window.open(kioskUrl, '_blank', 'noopener,noreferrer');
                }}
              className="p-3 sm:p-4 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 text-white hover:scale-105 transition-all duration-300 shadow-md hover:shadow-lg"
            >
              <Activity className="w-5 h-5 sm:w-6 sm:h-6 mx-auto mb-1 sm:mb-2" />
              <p className="text-xs sm:text-sm font-medium truncate">StockFlow</p>
            </button>
            {/* Tier 1: Accounting */}
            <button
              onClick={() => navigateWithTenant('/accounting')}
              className="p-3 sm:p-4 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 text-white hover:scale-105 transition-all duration-300 shadow-md hover:shadow-lg"
            >
              <DollarSign className="w-5 h-5 sm:w-6 sm:h-6 mx-auto mb-1 sm:mb-2" />
              <p className="text-xs sm:text-sm font-medium truncate">Accounting</p>
            </button>
            {/* Tier 2+: Attendance */}
            {currentTier >= 2 && (
              <button
                onClick={() => navigateWithTenant('/attendance')}
                className="p-3 sm:p-4 rounded-xl bg-gradient-to-r from-orange-500 to-amber-600 text-white hover:scale-105 transition-all duration-300 shadow-md hover:shadow-lg"
              >
                <Clock className="w-5 h-5 sm:w-6 sm:h-6 mx-auto mb-1 sm:mb-2" />
                <p className="text-xs sm:text-sm font-medium truncate">Attendance</p>
              </button>
            )}
            {/* Tier 2+: Payroll */}
            {currentTier >= 2 && (
              <button
                onClick={() => navigateWithTenant('/payroll')}
                className="p-3 sm:p-4 rounded-xl bg-gradient-to-r from-teal-500 to-cyan-600 text-white hover:scale-105 transition-all duration-300 shadow-md hover:shadow-lg"
              >
                <DollarSign className="w-5 h-5 sm:w-6 sm:h-6 mx-auto mb-1 sm:mb-2" />
                <p className="text-xs sm:text-sm font-medium truncate">Payroll</p>
              </button>
            )}
            {/* Pump House ERP - Only show relevant modules */}
          </div>
        </div>

        {/* Charts Section */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6 lg:gap-8 mb-6 sm:mb-8">
          <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-gray-100 p-4 sm:p-6">
            <div className="flex items-center justify-between mb-4 sm:mb-6">
              <h3 className="text-base sm:text-lg font-semibold text-gray-900">Sales Trends</h3>
              <span className="text-xs sm:text-sm text-gray-500">Last 14 days</span>
            </div>
            <ResponsiveContainer width="100%" height={250}>
              <AreaChart data={convertSalesByDate()} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                <defs>
                  <linearGradient id="salesGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#8B5CF6" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#8B5CF6" stopOpacity={0.05} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis
                  dataKey="date"
                  stroke="#94a3b8"
                  fontSize={10}
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: '#64748b' }}
                  interval="preserveStartEnd"
                />
                <YAxis
                  stroke="#94a3b8"
                  fontSize={10}
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: '#64748b' }}
                  tickFormatter={(value) => value >= 1000 ? `${(value/1000).toFixed(0)}k` : value}
                  width={40}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'white',
                    border: 'none',
                    borderRadius: '12px',
                    boxShadow: '0 10px 40px -10px rgba(0, 0, 0, 0.2)',
                    padding: '12px 16px',
                  }}
                  formatter={(value) => [formatCurrency(value), 'Sales']}
                  labelStyle={{ color: '#374151', fontWeight: 600, marginBottom: 4 }}
                />
                <Area
                  type="monotone"
                  dataKey="sales"
                  stroke="#8B5CF6"
                  strokeWidth={2.5}
                  fill="url(#salesGradient)"
                  name="Sales"
                  dot={false}
                  activeDot={{ r: 6, fill: '#8B5CF6', stroke: 'white', strokeWidth: 2 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 sm:p-6">
            <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-4 sm:mb-6">Revenue by Section</h3>
            <ResponsiveContainer width="100%" height={180}>
              <PieChartContainer>
                <Pie
                  data={convertRevenueBySection()}
                  cx="50%"
                  cy="50%"
                  innerRadius={45}
                  outerRadius={75}
                  paddingAngle={3}
                  dataKey="value"
                >
                  {convertRevenueBySection().map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value) => formatCurrency(value)}
                  contentStyle={{
                    backgroundColor: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
                  }}
                />
              </PieChartContainer>
            </ResponsiveContainer>
            <div className="mt-3 sm:mt-4 space-y-2">
              {convertRevenueBySection().map((item, index) => (
                <div key={index} className="flex items-center justify-between">
                  <div className="flex items-center min-w-0">
                    <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full mr-2 flex-shrink-0" style={{ backgroundColor: item.color }}></div>
                    <span className="text-xs sm:text-sm text-gray-600 truncate">{item.name}</span>
                  </div>
                  <span className="text-xs sm:text-sm font-semibold text-gray-900 ml-2">{formatCurrency(item.value)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Financial Summary - Tier 1 (Accounting Data) */}
        <div className="mb-4 sm:mb-6 lg:mb-8">
          <FinancialSummary
            financial={{
              revenue: dashboardData.kpiMetrics.totalRevenue,
              expenses: dashboardData.kpiMetrics.totalExpenses,
              grossProfit: dashboardData.kpiMetrics.totalRevenue - dashboardData.kpiMetrics.totalExpenses,
              netProfit: dashboardData.kpiMetrics.netProfit,
              grossMargin: dashboardData.kpiMetrics.totalRevenue > 0
                ? ((dashboardData.kpiMetrics.totalRevenue - dashboardData.kpiMetrics.totalExpenses) / dashboardData.kpiMetrics.totalRevenue * 100)
                : 0
            }}
          />
        </div>

        {/* Data Tables - Tier 1 (POS, Inventory, CRM Data) */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 lg:gap-8 mb-4 sm:mb-6 lg:mb-8">
          {/* Top Selling Items (POS) */}
          <TopItemsTable data={dashboardData.tableData.topSellingItems} />

          {/* Top Customers (CRM) */}
          <TopCustomersTable data={dashboardData.tableData.topCustomers} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 lg:gap-8 mb-4 sm:mb-6 lg:mb-8">
          {/* Recent Transactions (POS/Accounting) */}
          <RecentTransactionsTable data={dashboardData.tableData.recentTransactions} />

          {/* Low Stock Alerts (Inventory) */}
          <LowStockAlertsTable data={dashboardData.tableData.lowStockItems} />
        </div>

        {/* Tier 2 Features - Only show if subscribed (Growth Plan) */}
        {currentTier >= 2 && (
          <div className="mb-4 sm:mb-6 lg:mb-8">
            <div className="flex items-center justify-between mb-3 sm:mb-4 lg:mb-6">
              <div>
                <h2 className="text-base sm:text-lg lg:text-xl font-bold text-gray-900">HR & Workforce</h2>
                <p className="text-xs sm:text-sm text-gray-600 mt-0.5 sm:mt-1">Attendance and payroll insights</p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:gap-4 lg:gap-6">
              <AttendanceWidget
                data={rawBackendData?.kpis?.attendance}
                isLocked={false}
              />
            </div>
          </div>
        )}
        {/* Pump House ERP - Payroll, Marketing, Signage, Visitor widgets removed */}
      </div>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-100 px-4 sm:px-6 lg:px-8 py-3 sm:py-4">
        <div className="text-center">
          <p className="text-gray-500 text-xs sm:text-sm">
            © 2025 {tenantInfo?.businessName || 'Business'}. Powered by{' '}
            <a href="https://www.opsuite.io" target="_blank" rel="noopener noreferrer" className="text-purple-600 hover:text-purple-700 font-medium">
  Opsuite.io
            </a>
          </p>
        </div>
      </footer>
    </div>
  );
};

export default Dashboard;