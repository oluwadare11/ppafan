// PayrollDashboard.jsx - Main dashboard view for payroll module
// Shows overview of payroll data, upcoming payments, deductions, and key metrics

import React, { useState, useEffect, useCallback } from 'react';
import { useTenant } from '../../../context/TenantProvider.jsx';
import {
  DollarSign,
  Users,
  TrendingUp,
  TrendingDown,
  Calculator,
  Calendar,
  AlertCircle,
  CheckCircle,
  Clock,
  RefreshCw,
  Building2,
  FileText,
  Wallet,
  ArrowRight,
  PieChart,
  Settings,
  CreditCard,
  ChevronRight
} from 'lucide-react';
import {
  LineChart, Line, BarChart, Bar, PieChart as RechartsPie, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';

import { SkeletonLine, Alert } from '../shared';

const CHART_COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899'];

function PayrollDashboard({ onNavigateToTab }) {
  const { makeRequest } = useTenant();

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
      setError('Failed to load payroll dashboard data');
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
    return `₦${new Intl.NumberFormat('en-NG', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount || 0)}`;
  };

  // Get period label
  const getPeriodLabel = (period) => {
    if (!period) return '';
    const [year, month] = period.split('-');
    const date = new Date(year, parseInt(month) - 1, 1);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse space-y-2">
          <SkeletonLine width="w-48" />
          <SkeletonLine width="w-64" />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="bg-white rounded-xl shadow-sm border p-4">
              <div className="animate-pulse space-y-3">
                <div className="h-4 bg-gray-200 rounded w-1/2"></div>
                <div className="h-8 bg-gray-200 rounded w-3/4"></div>
              </div>
            </div>
          ))}
        </div>
        <div className="animate-pulse space-y-3">
          {[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
            <SkeletonLine key={i} width={i % 2 === 0 ? "w-full" : "w-3/4"} />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <Alert
        type="error"
        message={error}
        action={fetchDashboard}
        actionLabel="Retry"
      />
    );
  }

  // Calculate metrics
  const currentPeriod = dashboard?.currentPeriod || {};
  const staffSummary = dashboard?.staffSummary || {};
  const ytdTotals = dashboard?.ytdTotals || {};
  const monthlyTrends = dashboard?.monthlyTrends || [];
  const loanSummary = dashboard?.loanSummary || {};
  const upcomingPayment = dashboard?.upcomingPayment || {};
  const deductionBreakdown = dashboard?.deductionBreakdown || {};

  // Determine setup completion state
  const totalStaff = staffSummary.totalActiveStaff || 0;
  const configuredStaff = staffSummary.configuredStaff || 0;
  const unconfiguredStaff = totalStaff - configuredStaff;
  // hasRunPayroll: true only when there are actual payroll records for the current period
  const hasRunPayroll = (currentPeriod?.employeeCount || 0) > 0;
  const isFirstRun = !hasRunPayroll;
  const hasUnconfigured = unconfiguredStaff > 0 && configuredStaff === 0;

  // Calculate change percentage
  const previousPeriod = monthlyTrends[monthlyTrends.length - 2];
  const payrollChange = previousPeriod && currentPeriod?.netPayroll
    ? ((currentPeriod.netPayroll - previousPeriod.netPayroll) / previousPeriod.netPayroll) * 100
    : 0;

  // Prepare deduction breakdown for pie chart (use deductionBreakdown from API)
  const deductionData = [];
  if (deductionBreakdown.paye) deductionData.push({ name: 'PAYE', value: deductionBreakdown.paye });
  if (deductionBreakdown.pension) deductionData.push({ name: 'Pension', value: deductionBreakdown.pension });
  if (deductionBreakdown.nhf) deductionData.push({ name: 'NHF', value: deductionBreakdown.nhf });
  if (deductionBreakdown.nhis) deductionData.push({ name: 'NHIS', value: deductionBreakdown.nhis });
  if (deductionBreakdown.attendance) deductionData.push({ name: 'Attendance', value: deductionBreakdown.attendance });
  if (deductionBreakdown.loans) deductionData.push({ name: 'Loans', value: deductionBreakdown.loans });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">
            Payroll Dashboard
          </h3>
          <p className="text-sm text-gray-500">
            Overview of payroll for {getPeriodLabel(currentPeriod?.period) || 'current period'}
          </p>
        </div>
        <button
          onClick={fetchDashboard}
          className="inline-flex items-center gap-2 px-3 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      {/* Payroll Workflow Guide — shown when first-run or setup incomplete */}
      {(isFirstRun || hasUnconfigured) && (
        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-7 h-7 bg-blue-600 rounded-full flex items-center justify-center flex-shrink-0">
              <CheckCircle className="w-4 h-4 text-white" />
            </div>
            <h4 className="font-semibold text-blue-900">
              {isFirstRun ? 'Payroll Setup Guide — Run your first payroll in 4 steps' : 'Finish setting up payroll'}
            </h4>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              {
                step: '1',
                title: 'Configure Settings',
                desc: 'Set PAYE, Pension, NHF rates and pay day',
                icon: Settings,
                tab: 'settings',
                done: false,
                color: 'blue'
              },
              {
                step: '2',
                title: 'Set Up Staff Salaries',
                desc: `${configuredStaff}/${totalStaff} staff configured`,
                icon: Users,
                tab: 'staff-setup',
                done: configuredStaff > 0 && unconfiguredStaff === 0,
                partial: configuredStaff > 0 && unconfiguredStaff > 0,
                color: 'green'
              },
              {
                step: '3',
                title: 'Generate Payroll',
                desc: 'Calculate salaries, deductions, and taxes',
                icon: Calculator,
                tab: 'process',
                done: hasRunPayroll,
                color: 'purple'
              },
              {
                step: '4',
                title: 'Process & Report',
                desc: 'Mark as paid and download reports',
                icon: CreditCard,
                tab: 'reports',
                done: currentPeriod?.status === 'paid',
                color: 'orange'
              }
            ].map((item) => {
              const Icon = item.icon;
              const colorMap = {
                blue: { bg: 'bg-blue-100', text: 'text-blue-700', btn: 'bg-blue-600 hover:bg-blue-700' },
                green: { bg: 'bg-green-100', text: 'text-green-700', btn: 'bg-green-600 hover:bg-green-700' },
                purple: { bg: 'bg-purple-100', text: 'text-purple-700', btn: 'bg-purple-600 hover:bg-purple-700' },
                orange: { bg: 'bg-orange-100', text: 'text-orange-700', btn: 'bg-orange-600 hover:bg-orange-700' }
              };
              const c = colorMap[item.color];
              return (
                <button
                  key={item.step}
                  onClick={() => onNavigateToTab?.(item.tab)}
                  className="text-left p-4 bg-white rounded-lg border border-gray-200 hover:border-blue-300 hover:shadow-sm transition-all group"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className={`w-8 h-8 ${c.bg} rounded-lg flex items-center justify-center`}>
                      {item.done
                        ? <CheckCircle className="w-4 h-4 text-green-600" />
                        : <Icon className={`w-4 h-4 ${c.text}`} />
                      }
                    </div>
                    <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${item.done ? 'bg-green-100 text-green-700' : item.partial ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100 text-gray-500'}`}>
                      {item.done ? 'Done' : item.partial ? 'In progress' : `Step ${item.step}`}
                    </span>
                  </div>
                  <p className="text-sm font-semibold text-gray-900 mb-0.5">{item.title}</p>
                  <p className="text-xs text-gray-500">{item.desc}</p>
                  <div className={`mt-2 flex items-center gap-1 text-xs font-medium ${c.text} group-hover:gap-2 transition-all`}>
                    {item.done ? 'View' : 'Go'} <ChevronRight className="w-3 h-3" />
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Unconfigured staff warning banner (shown when some but not all are configured) */}
      {!isFirstRun && unconfiguredStaff > 0 && configuredStaff > 0 && (
        <div className="flex items-center justify-between p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-yellow-900">{unconfiguredStaff} staff are not configured for payroll</p>
              <p className="text-xs text-yellow-700">They will be excluded from payroll calculations until a salary is set.</p>
            </div>
          </div>
          <button
            onClick={() => onNavigateToTab?.('staff-setup')}
            className="flex-shrink-0 text-sm font-medium text-yellow-800 hover:text-yellow-900 underline ml-4"
          >
            Fix now
          </button>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        {/* Total Staff */}
        <div className="bg-white rounded-xl shadow-sm border p-3 sm:p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-500 text-xs">Total Staff</p>
              <p className="text-2xl font-bold text-gray-900">
                {staffSummary.totalActiveStaff || 0}
              </p>
              {staffSummary.configuredStaff > 0 && (
                <p className="text-xs text-green-600">
                  {staffSummary.configuredStaff} configured
                </p>
              )}
            </div>
            <div className="p-3 bg-blue-100 rounded-lg">
              <Users className="h-6 w-6 text-blue-600" />
            </div>
          </div>
        </div>

        {/* Gross Payroll */}
        <div className="bg-white rounded-xl shadow-sm border p-3 sm:p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-500 text-xs">Gross Payroll</p>
              <p className="text-2xl font-bold text-gray-900">
                {formatCurrency(currentPeriod?.grossPayroll, true)}
              </p>
              <p className="text-xs text-gray-500">
                This month
              </p>
            </div>
            <div className="p-3 bg-green-100 rounded-lg">
              <DollarSign className="h-6 w-6 text-green-600" />
            </div>
          </div>
        </div>

        {/* Total Deductions */}
        <div className="bg-white rounded-xl shadow-sm border p-3 sm:p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-500 text-xs">Total Deductions</p>
              <p className="text-2xl font-bold text-red-600">
                {formatCurrency(currentPeriod?.totalDeductions, true)}
              </p>
              <p className="text-xs text-gray-500">
                Statutory + Other
              </p>
            </div>
            <div className="p-3 bg-red-100 rounded-lg">
              <TrendingDown className="h-6 w-6 text-red-600" />
            </div>
          </div>
        </div>

        {/* Net Payroll */}
        <div className="bg-white rounded-xl shadow-sm border p-3 sm:p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-500 text-xs">Net Payroll</p>
              <p className="text-2xl font-bold text-green-600">
                {formatCurrency(currentPeriod?.netPayroll, true)}
              </p>
              {!currentPeriod?.netPayroll && (currentPeriod?.grossPayroll || 0) > 0 ? (
                <p className="text-xs text-amber-600">Generate payroll to see net</p>
              ) : payrollChange !== 0 && (
                <p className={`text-xs flex items-center gap-1 ${payrollChange > 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {payrollChange > 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                  {Math.abs(payrollChange).toFixed(1)}% vs last month
                </p>
              )}
            </div>
            <div className="p-3 bg-purple-100 rounded-lg">
              <Wallet className="h-6 w-6 text-purple-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Current Period Status & Quick Actions */}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-6">
        {/* Current Period Status */}
        <div className="bg-white rounded-xl shadow-sm border p-6">
          <h4 className="text-base font-semibold text-gray-900 mb-4">
            Current Period Status
          </h4>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-gray-600">Period</span>
              <span className="font-medium text-gray-900">
                {getPeriodLabel(currentPeriod?.period) || 'Not set'}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-gray-600">Status</span>
              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-sm font-medium rounded-full ${
                currentPeriod?.status === 'paid'
                  ? 'bg-green-100 text-green-700'
                  : currentPeriod?.status === 'approved'
                  ? 'bg-blue-100 text-blue-700'
                  : currentPeriod?.status === 'pending_approval'
                  ? 'bg-yellow-100 text-yellow-700'
                  : currentPeriod?.status === 'generated'
                  ? 'bg-purple-100 text-purple-700'
                  : 'bg-gray-100 text-gray-700'
              }`}>
                {currentPeriod?.status === 'paid' && <CheckCircle className="w-3.5 h-3.5" />}
                {currentPeriod?.status === 'approved' && <CheckCircle className="w-3.5 h-3.5" />}
                {currentPeriod?.status === 'pending_approval' && <Clock className="w-3.5 h-3.5" />}
                {currentPeriod?.status === 'generated' && <FileText className="w-3.5 h-3.5" />}
                {!currentPeriod?.status && <AlertCircle className="w-3.5 h-3.5" />}
                {currentPeriod?.status?.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) || 'Not Generated'}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-gray-600">Employees</span>
              <span className="font-medium text-gray-900">
                {currentPeriod?.employeeCount || 0}
              </span>
            </div>

            <div className="pt-4 border-t">
              <button
                onClick={() => onNavigateToTab?.('process')}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
              >
                {!currentPeriod?.status || currentPeriod?.status === 'not_generated'
                  ? 'Generate Payroll'
                  : 'View Payroll'}
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Deduction Breakdown */}
        <div className="bg-white rounded-xl shadow-sm border p-6">
          <h4 className="text-base font-semibold text-gray-900 mb-4">
            Deduction Breakdown
          </h4>

          {deductionData.length > 0 ? (
            <div>
              <div className="h-36">
                <ResponsiveContainer width="100%" height="100%">
                  <RechartsPie>
                    <Pie
                      data={deductionData}
                      cx="50%"
                      cy="50%"
                      innerRadius={32}
                      outerRadius={58}
                      dataKey="value"
                    >
                      {deductionData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => formatCurrency(value)} />
                  </RechartsPie>
                </ResponsiveContainer>
              </div>
              <div className="mt-2 space-y-1">
                {deductionData.map((entry, index) => {
                  const total = deductionData.reduce((s, d) => s + d.value, 0);
                  const pct = total > 0 ? Math.round((entry.value / total) * 100) : 0;
                  return (
                    <div key={entry.name} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: CHART_COLORS[index % CHART_COLORS.length] }} />
                        <span className="text-gray-600 truncate">{entry.name}</span>
                      </div>
                      <span className="text-gray-500 flex-shrink-0 ml-2">{pct}%</span>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-48 text-gray-400">
              <PieChart className="w-10 h-10 mb-2" />
              <p className="text-sm">No deduction data</p>
            </div>
          )}
        </div>

        {/* Quick Actions */}
        <div className="bg-white rounded-xl shadow-sm border p-6">
          <h4 className="text-base font-semibold text-gray-900 mb-4">
            Quick Actions
          </h4>

          <div className="space-y-3">
            <button
              onClick={() => onNavigateToTab?.('staff-setup')}
              className="w-full flex items-center gap-3 p-3 text-left hover:bg-gray-50 rounded-lg transition-colors"
            >
              <div className="p-2 bg-blue-100 rounded-lg">
                <Users className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="font-medium text-gray-900">Staff Setup</p>
                <p className="text-xs text-gray-500">Configure staff salaries</p>
              </div>
            </button>

            <button
              onClick={() => onNavigateToTab?.('settings')}
              className="w-full flex items-center gap-3 p-3 text-left hover:bg-gray-50 rounded-lg transition-colors"
            >
              <div className="p-2 bg-purple-100 rounded-lg">
                <Building2 className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <p className="font-medium text-gray-900">Payroll Settings</p>
                <p className="text-xs text-gray-500">Statutory & deduction rules</p>
              </div>
            </button>

            <button
              onClick={() => onNavigateToTab?.('reports')}
              className="w-full flex items-center gap-3 p-3 text-left hover:bg-gray-50 rounded-lg transition-colors"
            >
              <div className="p-2 bg-green-100 rounded-lg">
                <FileText className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="font-medium text-gray-900">Reports</p>
                <p className="text-xs text-gray-500">Generate payroll reports</p>
              </div>
            </button>
          </div>
        </div>
      </div>

      {/* Loan Summary & Upcoming Payment */}
      <div className="grid sm:grid-cols-2 gap-4 lg:gap-6">
        {/* Loan Summary Widget */}
        <div className="bg-white rounded-xl shadow-sm border p-6">
          <h4 className="text-base font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Wallet className="w-5 h-5 text-purple-600" />
            Active Loans
          </h4>

          {loanSummary.activeLoans > 0 ? (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="bg-purple-50 rounded-lg p-2 sm:p-3">
                  <p className="text-lg sm:text-2xl font-bold text-purple-700">{loanSummary.activeLoans}</p>
                  <p className="text-xs text-purple-600">Active Loans</p>
                </div>
                <div className="bg-red-50 rounded-lg p-2 sm:p-3">
                  <p className="text-sm sm:text-lg font-bold text-red-700">{formatCurrency(loanSummary.totalOutstanding, true)}</p>
                  <p className="text-xs text-red-600">Outstanding</p>
                </div>
                <div className="bg-blue-50 rounded-lg p-2 sm:p-3">
                  <p className="text-sm sm:text-lg font-bold text-blue-700">{formatCurrency(loanSummary.monthlyDeductions, true)}</p>
                  <p className="text-xs text-blue-600 leading-tight">Monthly Deduction</p>
                </div>
              </div>
              <button
                onClick={() => onNavigateToTab?.('loans')}
                className="w-full text-sm text-purple-600 hover:text-purple-800 font-medium py-1"
              >
                Manage loans
              </button>
            </div>
          ) : (
            <div className="text-center py-6 text-gray-400">
              <Wallet className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No active loans</p>
            </div>
          )}
        </div>

        {/* Upcoming Payment Widget */}
        <div className="bg-white rounded-xl shadow-sm border p-6">
          <h4 className="text-base font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Calendar className="w-5 h-5 text-green-600" />
            Upcoming Payment
          </h4>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-gray-600">Pay Day</span>
              <span className="font-medium text-gray-900">
                {upcomingPayment.date
                  ? new Date(upcomingPayment.date).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
                  : `${upcomingPayment.payDay || 25}th of each month`}
              </span>
            </div>

            {upcomingPayment.daysUntil !== undefined && (
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Days Until</span>
                <span className={`inline-flex items-center gap-1.5 px-3 py-1 text-sm font-bold rounded-full ${
                  upcomingPayment.daysUntil <= 3
                    ? 'bg-red-100 text-red-700'
                    : upcomingPayment.daysUntil <= 7
                    ? 'bg-yellow-100 text-yellow-700'
                    : 'bg-green-100 text-green-700'
                }`}>
                  <Clock className="w-3.5 h-3.5" />
                  {upcomingPayment.daysUntil} days
                </span>
              </div>
            )}

            <div className="flex items-center justify-between">
              <span className="text-gray-600">Est. Net Payroll</span>
              <span className="font-bold text-green-600 text-lg">
                {formatCurrency(currentPeriod?.netPayroll, true)}
              </span>
            </div>

            <div className="pt-2 border-t">
              <button
                onClick={() => onNavigateToTab?.('process')}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg transition-colors"
              >
                Process Payments
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Payroll Trend Chart */}
      {monthlyTrends.length > 1 && (
        <div className="bg-white rounded-xl shadow-sm border p-6">
          <h4 className="text-base font-semibold text-gray-900 mb-4">
            Payroll Trend (Last {monthlyTrends.length} Months)
          </h4>

          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={monthlyTrends}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis
                  dataKey="label"
                  fontSize={12}
                  tickFormatter={(value) => value?.split(' ')[0]}
                />
                <YAxis
                  tickFormatter={(v) => `₦${(v/1000000).toFixed(1)}M`}
                  fontSize={12}
                />
                <Tooltip formatter={(value) => formatCurrency(value)} />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="grossPayroll"
                  stroke="#3B82F6"
                  strokeWidth={2}
                  name="Gross Payroll"
                  dot={{ fill: '#3B82F6' }}
                />
                <Line
                  type="monotone"
                  dataKey="netPayroll"
                  stroke="#10B981"
                  strokeWidth={2}
                  name="Net Payroll"
                  dot={{ fill: '#10B981' }}
                />
                <Line
                  type="monotone"
                  dataKey="totalDeductions"
                  stroke="#EF4444"
                  strokeWidth={2}
                  name="Deductions"
                  dot={{ fill: '#EF4444' }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* YTD Summary */}
      {ytdTotals?.netPayroll > 0 && (
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-xl shadow-sm p-6 text-white">
          <h4 className="text-base font-semibold mb-4 opacity-90">
            Year-to-Date Summary
          </h4>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <div>
              <p className="text-blue-200 text-xs">Gross Payroll</p>
              <p className="text-2xl font-bold">
                {formatCurrency(ytdTotals.grossPayroll, true)}
              </p>
            </div>
            <div>
              <p className="text-blue-200 text-xs">Total Deductions</p>
              <p className="text-2xl font-bold">
                {formatCurrency(ytdTotals.totalDeductions, true)}
              </p>
            </div>
            <div>
              <p className="text-blue-200 text-xs">Net Payroll</p>
              <p className="text-2xl font-bold">
                {formatCurrency(ytdTotals.netPayroll, true)}
              </p>
            </div>
            <div>
              <p className="text-blue-200 text-xs">Avg Monthly</p>
              <p className="text-2xl font-bold">
                {formatCurrency(ytdTotals.netPayroll / Math.max(monthlyTrends.length, 1), true)}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* No Data State */}
      {!currentPeriod?.period && !monthlyTrends.length && (
        <div className="bg-white rounded-xl shadow-sm border p-8 text-center">
          <Calculator className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h4 className="text-lg font-medium text-gray-900 mb-2">
            No Payroll Data Yet
          </h4>
          <p className="text-gray-500 mb-4">
            Start by configuring staff salaries and generating your first payroll.
          </p>
          <button
            onClick={() => onNavigateToTab?.('staff-setup')}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
          >
            Configure Staff
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}

export default PayrollDashboard;
