// TierWidgets.jsx - Placeholder widgets for Tier 2 & 3 features
// TODO: Replace placeholder data with real API calls when modules are ready

import React from 'react';
import { Users, DollarSign, Calendar, TrendingUp, MessageSquare, Monitor, UserCheck, Lock, CheckCircle } from 'lucide-react';

// =============================================================================
// TIER 2 WIDGETS (Growth Plan) - Attendance & Payroll
// =============================================================================

/**
 * Attendance Widget - Shows today's attendance metrics
 *
 * TODO: When Attendance module is ready:
 * 1. Create endpoint: GET /api/attendance/today-summary
 * 2. Response format: { present, absent, late, total, rate }
 * 3. Replace placeholder data with: const data = await makeRequest('/api/attendance/today-summary')
 * 4. Update dashboard.js backend to fetch real attendance data (lines 307-336)
 */
export const AttendanceWidget = ({ data = null, isLocked = false }) => {
  // Placeholder data - TODO: Remove when real data available
  const placeholderData = {
    present: 0,
    late: 0,
    total: 0,
    rate: 0
  };

  const attendance = data || placeholderData;

  if (isLocked) {
    return <LockedFeatureCard feature="Attendance Tracking" tier="Growth" />;
  }

  return (
    <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-bold text-gray-900">
            Today's Attendance
          </h3>
          <p className="text-sm text-gray-600">
            Staff presence overview
          </p>
        </div>
        <div className="p-3 rounded-xl bg-blue-100">
          <Users className="w-6 h-6 text-blue-600" />
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div className="text-center p-4 bg-green-50 rounded-lg border border-green-100">
          <p className="text-3xl font-bold text-green-600">
            {attendance.present}
          </p>
          <p className="text-sm text-gray-600">Present</p>
        </div>
        <div className="text-center p-4 bg-yellow-50 rounded-lg border border-yellow-100">
          <p className="text-3xl font-bold text-yellow-600">
            {attendance.late}
          </p>
          <p className="text-sm text-gray-600">Late</p>
        </div>
      </div>

      {/* Attendance Rate */}
      <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-100">
        <span className="text-sm font-medium text-gray-700">
          Attendance Rate
        </span>
        <span className="text-lg font-bold text-blue-600">
          {attendance.rate}%
        </span>
      </div>

      {/* TODO Note */}
      {!data && (
        <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-100">
          <p className="text-xs text-blue-600">
            📝 Placeholder: Real data will show when Attendance module is connected
          </p>
        </div>
      )}
    </div>
  );
};

/**
 * Payroll Summary Widget - Shows upcoming payroll information
 * Connected to real payroll data from /api/payroll/summary
 */
export const PayrollWidget = ({ data = null, isLocked = false }) => {
  // Default data when no payroll data available
  const defaultData = {
    nextPaymentDate: 'Not configured',
    totalDue: 0,
    pendingCount: 0,
    processedCount: 0,
    hasPayrollData: false,
    settingsConfigured: false
  };

  const payroll = data || defaultData;

  if (isLocked) {
    return <LockedFeatureCard feature="Payroll Management" tier="Growth" />;
  }

  return (
    <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-bold text-gray-900">
            Payroll Summary
          </h3>
          <p className="text-sm text-gray-600">
            {payroll.settingsConfigured ? 'Upcoming payments' : 'Configure payroll settings'}
          </p>
        </div>
        <div className="p-3 rounded-xl bg-green-100">
          <DollarSign className="w-6 h-6 text-green-600" />
        </div>
      </div>

      {/* Next Payment */}
      <div className="mb-4 p-4 bg-gray-50 rounded-lg border border-gray-100">
        <div className="flex items-center gap-2 mb-2">
          <Calendar className="w-4 h-4 text-gray-500" />
          <span className="text-sm text-gray-600">Next Payment</span>
        </div>
        <p className="text-xl font-bold text-gray-900">
          {payroll.nextPaymentDate}
        </p>
        {payroll.paymentDay && (
          <p className="text-xs text-gray-500 mt-1">
            Scheduled for day {payroll.paymentDay} each month
          </p>
        )}
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-2 gap-4">
        <div className="p-3 bg-green-50 rounded-lg border border-green-100">
          <p className="text-2xl font-bold text-green-600">
            ₦{(payroll.totalDue || 0).toLocaleString()}
          </p>
          <p className="text-xs text-gray-600">Total Due</p>
        </div>
        <div className="p-3 bg-blue-50 rounded-lg border border-blue-100">
          <p className="text-2xl font-bold text-blue-600">
            {payroll.pendingCount || 0}
          </p>
          <p className="text-xs text-gray-600">Pending</p>
        </div>
      </div>

      {/* Processed count */}
      {payroll.processedCount > 0 && (
        <div className="mt-3 flex items-center gap-2 text-sm text-gray-600">
          <CheckCircle className="w-4 h-4 text-green-500" />
          <span>{payroll.processedCount} processed this period</span>
        </div>
      )}

      {/* Setup prompt if not configured */}
      {!payroll.settingsConfigured && (
        <div className="mt-4 p-3 bg-amber-50 rounded-lg border border-amber-100">
          <p className="text-xs text-amber-700">
            Configure payroll settings to enable automatic payment scheduling
          </p>
        </div>
      )}
    </div>
  );
};

// =============================================================================
// TIER 3 WIDGETS (Pro/Enterprise) - Marketing, Signage, Visitors
// =============================================================================

/**
 * Marketing Metrics Widget - Shows campaign performance
 *
 * TODO: When Marketing module is ready:
 * 1. Create endpoint: GET /api/marketing/dashboard-summary
 * 2. Response format: { activeCampaigns, totalReach, responseRate, roi }
 * 3. Replace placeholder data with real API call
 * 4. Update dashboard.js backend (lines 347-354)
 */
export const MarketingWidget = ({ data = null, isLocked = false }) => {
  const placeholderData = {
    activeCampaigns: 0,
    totalReach: 0,
    responseRate: 0,
    roi: 0
  };

  const marketing = data || placeholderData;

  if (isLocked) {
    return <LockedFeatureCard feature="Marketing Analytics" tier="Pro" />;
  }

  return (
    <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-bold text-gray-900">
            Marketing Overview
          </h3>
          <p className="text-sm text-gray-600">Campaign performance</p>
        </div>
        <div className="p-3 rounded-xl bg-gradient-to-br from-purple-500 to-pink-600">
          <MessageSquare className="w-6 h-6 text-white" />
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex justify-between p-3 bg-gray-50 rounded-lg">
          <span className="text-sm text-gray-600">Active Campaigns</span>
          <span className="font-bold text-gray-900">{marketing.activeCampaigns}</span>
        </div>
        <div className="flex justify-between p-3 bg-gray-50 rounded-lg">
          <span className="text-sm text-gray-600">Total Reach</span>
          <span className="font-bold text-gray-900">{marketing.totalReach.toLocaleString()}</span>
        </div>
        <div className="flex justify-between p-3 bg-gray-50 rounded-lg">
          <span className="text-sm text-gray-600">Response Rate</span>
          <span className="font-bold text-purple-600">{marketing.responseRate}%</span>
        </div>
      </div>

      {!data && (
        <div className="mt-4 p-3 bg-purple-50 rounded-lg">
          <p className="text-xs text-purple-600">
            Connect Marketing module to see campaign data
          </p>
        </div>
      )}
    </div>
  );
};

/**
 * Digital Signage Widget - Shows display metrics
 * Shows Active Screens and Screen Layout configuration
 */
export const SignageWidget = ({ data = null, isLocked = false }) => {
  const placeholderData = {
    activeScreens: 0,
    totalScreens: 0,
    screenLayout: 'Not configured'
  };

  const signage = data || placeholderData;

  if (isLocked) {
    return <LockedFeatureCard feature="Digital Signage" tier="Pro" />;
  }

  // Format screen layout display
  const formatLayout = (layout) => {
    if (!layout) return 'Not configured';
    const layouts = {
      'fullscreen': 'Full Screen',
      'main-ticker': 'Main + Ticker',
      'split-headlines': 'Split + Sidebar',
      'quad': 'Quad View'
    };
    return layouts[layout] || layout;
  };

  return (
    <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-bold text-gray-900">
            Digital Signage
          </h3>
          <p className="text-sm text-gray-600">Screen management</p>
        </div>
        <div className="p-3 rounded-xl bg-gradient-to-br from-orange-500 to-red-600">
          <Monitor className="w-6 h-6 text-white" />
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex justify-between p-3 bg-gray-50 rounded-lg">
          <span className="text-sm text-gray-600">Active Screens</span>
          <span className="font-bold text-orange-600">{signage.activeScreens || 0}</span>
        </div>
        <div className="flex justify-between p-3 bg-gray-50 rounded-lg">
          <span className="text-sm text-gray-600">Total Configured</span>
          <span className="font-bold text-gray-900">{signage.totalScreens || 0}</span>
        </div>
        <div className="flex justify-between p-3 bg-gray-50 rounded-lg">
          <span className="text-sm text-gray-600">Screen Layout</span>
          <span className="font-bold text-blue-600">{formatLayout(signage.screenLayout)}</span>
        </div>
      </div>

      {!data && (
        <div className="mt-4 p-3 bg-orange-50 rounded-lg">
          <p className="text-xs text-orange-600">
            Configure screens in Signage module to see data
          </p>
        </div>
      )}
    </div>
  );
};

/**
 * Visitor Management Widget - Shows visitor stats
 * Shows Total Today, Checked In, and Expecting (pre-registered not yet checked in)
 */
export const VisitorWidget = ({ data = null, isLocked = false }) => {
  const placeholderData = {
    todayCount: 0,
    checkedIn: 0,
    expecting: 0
  };

  const visitors = data || placeholderData;

  if (isLocked) {
    return <LockedFeatureCard feature="Visitor Management" tier="Pro" />;
  }

  return (
    <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-bold text-gray-900">
            Visitor Stats
          </h3>
          <p className="text-sm text-gray-600">Today's visitors</p>
        </div>
        <div className="p-3 rounded-xl bg-gradient-to-br from-teal-500 to-cyan-600">
          <UserCheck className="w-6 h-6 text-white" />
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex justify-between p-3 bg-gray-50 rounded-lg">
          <span className="text-sm text-gray-600">Total Today</span>
          <span className="font-bold text-gray-900">{visitors.todayCount || 0}</span>
        </div>
        <div className="flex justify-between p-3 bg-gray-50 rounded-lg">
          <span className="text-sm text-gray-600">Checked In</span>
          <span className="font-bold text-teal-600">{visitors.checkedIn || 0}</span>
        </div>
        <div className="flex justify-between p-3 bg-gray-50 rounded-lg">
          <span className="text-sm text-gray-600">Expecting</span>
          <span className="font-bold text-amber-600">{visitors.expecting || 0}</span>
        </div>
      </div>

      {!data && (
        <div className="mt-4 p-3 bg-teal-50 rounded-lg">
          <p className="text-xs text-teal-600">
            Configure Visitor module to see visitor data
          </p>
        </div>
      )}
    </div>
  );
};

// =============================================================================
// LOCKED FEATURE CARD - Shows upgrade prompt for unavailable features
// =============================================================================

const LockedFeatureCard = ({ feature, tier }) => {
  return (
    <div className="relative bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-800 dark:to-gray-900 rounded-2xl p-6 shadow-lg border-2 border-dashed border-gray-300 dark:border-gray-600 overflow-hidden">
      {/* Lock overlay */}
      <div className="absolute inset-0 bg-white/50 dark:bg-gray-900/50 backdrop-blur-sm flex items-center justify-center z-10">
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center">
            <Lock className="w-8 h-8 text-white" />
          </div>
          <h4 className="text-lg font-bold text-gray-900 dark:text-white mb-2">
            {feature}
          </h4>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            Available in {tier} plan
          </p>
          <button className="px-6 py-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg font-semibold hover:from-purple-700 hover:to-pink-700 transition-all">
            Upgrade Now
          </button>
        </div>
      </div>

      {/* Blurred preview content */}
      <div className="opacity-30 blur-sm">
        <div className="h-6 w-32 bg-gray-300 dark:bg-gray-700 rounded mb-4" />
        <div className="space-y-2">
          <div className="h-16 bg-gray-300 dark:bg-gray-700 rounded" />
          <div className="h-16 bg-gray-300 dark:bg-gray-700 rounded" />
        </div>
      </div>
    </div>
  );
};

export default {
  AttendanceWidget,
  PayrollWidget,
  MarketingWidget,
  SignageWidget,
  VisitorWidget,
  LockedFeatureCard
};
