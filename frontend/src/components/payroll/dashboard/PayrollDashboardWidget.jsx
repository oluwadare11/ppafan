// PayrollDashboardWidget.jsx - Dashboard widget for payroll summary
// Phase 3: Analytics integration for main dashboard

import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTenant } from '../../../context/TenantProvider.jsx';
import {
  DollarSign,
  Users,
  TrendingUp,
  TrendingDown,
  Calculator,
  Calendar,
  ChevronRight,
  AlertCircle,
  CheckCircle,
  Clock,
  RefreshCw
} from 'lucide-react';

function PayrollDashboardWidget({ onNavigate }) {
  const { makeRequest } = useTenant();
  const navigate = useNavigate();

  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Fetch dashboard data
  const fetchDashboard = useCallback(async () => {

    try {
      setLoading(true);
      setError('');
      const response = await makeRequest('/api/payroll/analytics/dashboard?months=6');
      setDashboard(response);
    } catch (err) {
      console.error('Error fetching payroll dashboard:', err);
      setError('Failed to load payroll data');
    } finally {
      setLoading(false);
    }
  }, [makeRequest]);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  // Format currency
  const formatCurrency = (amount, short = false) => {
    if (short && amount >= 1000000) {
      return `₦${(amount / 1000000).toFixed(1)}M`;
    }
    if (short && amount >= 1000) {
      return `₦${(amount / 1000).toFixed(0)}K`;
    }
    return new Intl.NumberFormat('en-NG', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount || 0);
  };

  // Get period label
  const getPeriodLabel = (period) => {
    if (!period) return '';
    const [year, month] = period.split('-');
    const date = new Date(year, parseInt(month) - 1, 1);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short' });
  };

  // Handle navigation
  const handleNavigate = () => {
    if (onNavigate) {
      onNavigate();
    } else {
      navigate('/payroll');
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-gray-200 rounded w-1/3"></div>
          <div className="grid grid-cols-3 gap-4">
            <div className="h-20 bg-gray-200 rounded"></div>
            <div className="h-20 bg-gray-200 rounded"></div>
            <div className="h-20 bg-gray-200 rounded"></div>
          </div>
          <div className="h-32 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Payroll Summary</h3>
          <button
            onClick={fetchDashboard}
            className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
        <div className="flex items-center justify-center py-8 text-center">
          <div>
            <AlertCircle className="w-10 h-10 text-red-400 mx-auto mb-2" />
            <p className="text-gray-500 text-sm">{error}</p>
            <button
              onClick={fetchDashboard}
              className="mt-2 text-sm text-blue-600 hover:text-blue-700"
            >
              Try again
            </button>
          </div>
        </div>
      </div>
    );
  }

  // No data state
  if (!dashboard || !dashboard.currentPeriod) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Payroll Summary</h3>
        </div>
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <Calculator className="w-10 h-10 text-gray-300 mb-2" />
          <p className="text-gray-500 text-sm mb-3">No payroll data available</p>
          <button
            onClick={handleNavigate}
            className="text-sm text-blue-600 hover:text-blue-700 font-medium"
          >
            Go to Payroll
          </button>
        </div>
      </div>
    );
  }

  // Calculate trend (comparing first and last in monthlyTrends)
  const trends = dashboard.monthlyTrends || [];
  const latestTrend = trends[trends.length - 1];
  const previousTrend = trends[trends.length - 2];
  const payrollChange = previousTrend && latestTrend
    ? ((latestTrend.grossPayroll - previousTrend.grossPayroll) / previousTrend.grossPayroll) * 100
    : 0;

  // For the current period: use netPayroll if generated, else fall back to grossPayroll (pre-calculated)
  const currentNetPay = dashboard.currentPeriod?.netPayroll || 0;
  const currentGrossPay = dashboard.currentPeriod?.grossPayroll || 0;
  const isGenerated = currentNetPay > 0;
  const displayPayAmount = isGenerated ? currentNetPay : currentGrossPay;
  const displayPayLabel = isGenerated ? 'Net Pay' : 'Gross Pay';

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-100/30 rounded-lg">
            <Calculator className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Payroll</h3>
            <p className="text-sm text-gray-500">
              {getPeriodLabel(dashboard.currentPeriod?.period)}
            </p>
          </div>
        </div>
        <button
          onClick={handleNavigate}
          className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700 font-medium"
        >
          View all
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-3 gap-2 sm:gap-4 mb-6">
        <div className="text-center">
          <div className="flex items-center justify-center gap-1 text-gray-500 mb-1">
            <Users className="w-4 h-4" />
            <span className="text-xs">Staff</span>
          </div>
          <p className="text-xl sm:text-2xl font-bold text-gray-900">
            {dashboard.staffSummary?.totalActiveStaff || 0}
          </p>
          {dashboard.staffSummary?.unconfiguredStaff > 0 && (
            <p className="text-xs text-yellow-600">
              {dashboard.staffSummary.unconfiguredStaff} not configured
            </p>
          )}
        </div>

        <div className="text-center">
          <div className="flex items-center justify-center gap-1 text-gray-500 mb-1">
            <DollarSign className="w-4 h-4" />
            <span className="text-xs">{displayPayLabel}</span>
          </div>
          <p className="text-xl sm:text-2xl font-bold text-green-600">
            {formatCurrency(displayPayAmount, true)}
          </p>
          <div className="flex items-center justify-center text-xs">
            {!isGenerated && displayPayAmount > 0 ? (
              <span className="text-gray-400">not generated</span>
            ) : payrollChange !== 0 ? (
              <span className={`flex items-center gap-0.5 ${payrollChange > 0 ? 'text-green-600' : 'text-red-600'}`}>
                {payrollChange > 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                {Math.abs(payrollChange).toFixed(1)}%
              </span>
            ) : null}
          </div>
        </div>

        <div className="text-center">
          <div className="flex items-center justify-center gap-1 text-gray-500 mb-1">
            <TrendingDown className="w-4 h-4" />
            <span className="text-xs">Deductions</span>
          </div>
          <p className="text-xl sm:text-2xl font-bold text-red-600">
            {formatCurrency(dashboard.currentPeriod?.totalDeductions, true)}
          </p>
        </div>
      </div>

      {/* Mini Trend Chart */}
      {trends.length > 1 && (
        <div className="mb-4">
          <div className="flex items-center justify-between text-xs text-gray-500 mb-2">
            <span>Monthly Trend</span>
            <span>Last {trends.length} months</span>
          </div>
          <div className="flex items-end justify-between h-16 gap-1">
            {trends.map((trend, idx) => {
              // Use net pay if generated, otherwise fall back to gross pay
              const trendAmount = trend.netPayroll > 0 ? trend.netPayroll : trend.grossPayroll || 0;
              const maxPayroll = Math.max(...trends.map(t => (t.netPayroll > 0 ? t.netPayroll : t.grossPayroll) || 1));
              const height = (trendAmount / maxPayroll) * 100;
              const label = trend.netPayroll > 0
                ? `${trend.label}: ₦${formatCurrency(trend.netPayroll)}`
                : `${trend.label}: ₦${formatCurrency(trend.grossPayroll)} (gross)`;

              return (
                <div
                  key={trend.period}
                  className="flex-1 flex flex-col items-center"
                  title={label}
                >
                  <div
                    className={`w-full rounded-t transition-all ${
                      idx === trends.length - 1
                        ? 'bg-blue-500'
                        : 'bg-gray-200'
                    }`}
                    style={{ height: `${Math.max(height, 5)}%` }}
                  />
                  <span className="text-[10px] text-gray-400 mt-1">{trend.label?.split(' ')[0]}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Status Badge */}
      <div className="flex items-center justify-between pt-4 border-t border-gray-200">
        <div className="flex items-center gap-2">
          {dashboard.currentPeriod?.status === 'paid' ? (
            <>
              <CheckCircle className="w-4 h-4 text-green-500" />
              <span className="text-sm text-green-600">Paid</span>
            </>
          ) : dashboard.currentPeriod?.status === 'approved' ? (
            <>
              <CheckCircle className="w-4 h-4 text-blue-500" />
              <span className="text-sm text-blue-600">Approved</span>
            </>
          ) : dashboard.currentPeriod?.employeeCount > 0 ? (
            <>
              <Clock className="w-4 h-4 text-yellow-500" />
              <span className="text-sm text-yellow-600">
                {dashboard.currentPeriod?.status === 'pending_approval' ? 'Pending Approval' : 'Processing'}
              </span>
            </>
          ) : (
            <>
              <AlertCircle className="w-4 h-4 text-gray-400" />
              <span className="text-sm text-gray-500">Not Generated</span>
            </>
          )}
        </div>

        {/* YTD Total — use net if available, else gross */}
        {(dashboard.ytdTotals?.netPayroll > 0 || dashboard.ytdTotals?.grossPayroll > 0) && (
          <div className="text-right">
            <p className="text-xs text-gray-500">
              YTD {dashboard.ytdTotals?.netPayroll > 0 ? 'Net' : 'Gross'}
            </p>
            <p className="text-sm font-semibold text-gray-900">
              ₦{formatCurrency(dashboard.ytdTotals.netPayroll > 0 ? dashboard.ytdTotals.netPayroll : dashboard.ytdTotals.grossPayroll, true)}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export default PayrollDashboardWidget;
