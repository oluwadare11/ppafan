// PayrollTrendsChart.jsx - Payroll trends analytics chart
// Phase 3: Visual analytics for payroll trends

import React, { useState, useEffect, useCallback } from 'react';
import { useTenant } from '../../../context/TenantProvider.jsx';
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Users,
  Calendar,
  RefreshCw,
  ChevronDown
} from 'lucide-react';

import { SkeletonLine } from '../shared';

function PayrollTrendsChart({ defaultMonths = 12 }) {
  const { makeRequest } = useTenant();

  const [trends, setTrends] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [months, setMonths] = useState(defaultMonths);
  const [selectedMetric, setSelectedMetric] = useState('netPayroll');

  // Metric options
  const metrics = [
    { id: 'netPayroll', label: 'Net Payroll', color: 'green' },
    { id: 'grossPayroll', label: 'Gross Payroll', color: 'blue' },
    { id: 'totalDeductions', label: 'Deductions', color: 'red' },
    { id: 'paye', label: 'PAYE Tax', color: 'purple' },
    { id: 'pension', label: 'Pension', color: 'yellow' },
    { id: 'overtime', label: 'Overtime', color: 'cyan' }
  ];

  // Fetch trends
  const fetchTrends = useCallback(async () => {

    try {
      setLoading(true);
      setError('');
      const response = await makeRequest(`/api/payroll/analytics/trends?months=${months}`);
      setTrends(response);
    } catch (err) {
      console.error('Error fetching trends:', err);
      setError('Failed to load trends data');
    } finally {
      setLoading(false);
    }
  }, [makeRequest, months]);

  useEffect(() => {
    fetchTrends();
  }, [fetchTrends]);

  // Format currency
  const formatCurrency = (amount, short = true) => {
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

  // Get color classes
  const getColorClasses = (color) => {
    const colors = {
      green: { bar: 'bg-green-500', text: 'text-green-600', light: 'bg-green-100/30' },
      blue: { bar: 'bg-blue-500', text: 'text-blue-600', light: 'bg-blue-100/30' },
      red: { bar: 'bg-red-500', text: 'text-red-600', light: 'bg-red-100/30' },
      purple: { bar: 'bg-purple-500', text: 'text-purple-600', light: 'bg-purple-100/30' },
      yellow: { bar: 'bg-yellow-500', text: 'text-yellow-600', light: 'bg-yellow-100/30' },
      cyan: { bar: 'bg-cyan-500', text: 'text-cyan-600', light: 'bg-cyan-100/30' }
    };
    return colors[color] || colors.blue;
  };

  const currentMetric = metrics.find(m => m.id === selectedMetric);
  const colorClasses = getColorClasses(currentMetric?.color);

  if (loading) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="animate-pulse space-y-3">
          {[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
            <SkeletonLine key={i} width={i % 2 === 0 ? "w-full" : "w-3/4"} />
          ))}
        </div>
      </div>
    );
  }

  if (error || !trends) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="text-center py-8">
          <p className="text-gray-500">{error || 'No data available'}</p>
          <button
            onClick={fetchTrends}
            className="mt-2 text-sm text-blue-600 hover:text-blue-700"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  const trendData = trends.overallTrends || [];
  const maxValue = Math.max(...trendData.map(t => t[selectedMetric] || 0), 1);

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Payroll Trends</h3>
          <p className="text-sm text-gray-500">
            {trends.periodRange?.start} to {trends.periodRange?.end}
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Metric Selector */}
          <select
            value={selectedMetric}
            onChange={(e) => setSelectedMetric(e.target.value)}
            className="px-3 py-1.5 border border-gray-300 rounded-lg bg-white text-gray-900 text-sm"
          >
            {metrics.map(metric => (
              <option key={metric.id} value={metric.id}>
                {metric.label}
              </option>
            ))}
          </select>

          {/* Months Selector */}
          <select
            value={months}
            onChange={(e) => setMonths(parseInt(e.target.value))}
            className="px-3 py-1.5 border border-gray-300 rounded-lg bg-white text-gray-900 text-sm"
          >
            <option value={6}>6 months</option>
            <option value={12}>12 months</option>
            <option value={24}>24 months</option>
          </select>

          <button
            onClick={fetchTrends}
            className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Insights */}
      {trends.insights && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className={`p-3 rounded-lg ${colorClasses.light}`}>
            <p className="text-xs text-gray-500 mb-1">Average Monthly</p>
            <p className={`text-lg font-bold ${colorClasses.text}`}>
              {formatCurrency(trends.insights.averageMonthlyPayroll)}
            </p>
          </div>
          <div className="p-3 rounded-lg bg-green-100/30">
            <p className="text-xs text-gray-500 mb-1">Highest Month</p>
            <p className="text-lg font-bold text-green-600">
              {trends.insights.highestPayrollPeriod?.label}
            </p>
          </div>
          <div className="p-3 rounded-lg bg-yellow-100/30">
            <p className="text-xs text-gray-500 mb-1">Lowest Month</p>
            <p className="text-lg font-bold text-yellow-600">
              {trends.insights.lowestPayrollPeriod?.label}
            </p>
          </div>
          <div className="p-3 rounded-lg bg-blue-100/30">
            <p className="text-xs text-gray-500 mb-1">Growth Rate</p>
            <p className={`text-lg font-bold flex items-center gap-1 ${
              parseFloat(trends.insights.payrollGrowthRate) >= 0 ? 'text-green-600' : 'text-red-600'
            }`}>
              {parseFloat(trends.insights.payrollGrowthRate) >= 0 ? (
                <TrendingUp className="w-4 h-4" />
              ) : (
                <TrendingDown className="w-4 h-4" />
              )}
              {trends.insights.payrollGrowthRate}%
            </p>
          </div>
        </div>
      )}

      {/* Chart */}
      <div className="relative">
        {/* Y-axis labels */}
        <div className="absolute left-0 top-0 bottom-8 w-16 flex flex-col justify-between text-xs text-gray-400">
          <span>{formatCurrency(maxValue)}</span>
          <span>{formatCurrency(maxValue / 2)}</span>
          <span>₦0</span>
        </div>

        {/* Chart area */}
        <div className="ml-16 pl-2">
          <div className="flex items-end justify-between h-48 gap-1 border-b border-l border-gray-200 relative">
            {/* Horizontal grid lines */}
            <div className="absolute inset-0 flex flex-col justify-between pointer-events-none">
              <div className="border-b border-dashed border-gray-200" />
              <div className="border-b border-dashed border-gray-200" />
            </div>

            {/* Bars */}
            {trendData.map((trend, idx) => {
              const value = trend[selectedMetric] || 0;
              const height = (value / maxValue) * 100;

              return (
                <div
                  key={trend.period}
                  className="flex-1 flex flex-col items-center justify-end h-full relative group"
                >
                  {/* Tooltip */}
                  <div className="absolute bottom-full mb-2 hidden group-hover:block z-10">
                    <div className="bg-gray-900 text-white text-xs rounded px-2 py-1 whitespace-nowrap">
                      <p className="font-medium">{trend.label}</p>
                      <p>₦{formatCurrency(value, false)}</p>
                      <p className="text-gray-400">{trend.employeeCount} employees</p>
                    </div>
                  </div>

                  {/* Bar */}
                  <div
                    className={`w-full max-w-8 rounded-t ${colorClasses.bar} transition-all duration-300 hover:opacity-80`}
                    style={{ height: `${Math.max(height, 2)}%` }}
                  />
                </div>
              );
            })}
          </div>

          {/* X-axis labels */}
          <div className="flex justify-between mt-2">
            {trendData.map((trend, idx) => (
              <div key={trend.period} className="flex-1 text-center">
                <span className="text-xs text-gray-400 truncate block">
                  {idx % Math.ceil(trendData.length / 6) === 0 || idx === trendData.length - 1
                    ? trend.label?.split(' ')[0]
                    : ''
                  }
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Department Breakdown */}
      {trends.departmentTrends && Object.keys(trends.departmentTrends).length > 0 && (
        <div className="mt-6 pt-6 border-t border-gray-200">
          <h4 className="text-sm font-medium text-gray-700 mb-4">By Department (Latest Month)</h4>
          <div className="space-y-3">
            {Object.entries(trends.departmentTrends)
              .map(([dept, data]) => ({
                department: dept,
                value: data[data.length - 1]?.grossPayroll || 0,
                employees: data[data.length - 1]?.employeeCount || 0
              }))
              .sort((a, b) => b.value - a.value)
              .slice(0, 5)
              .map((dept, idx) => {
                const maxDeptValue = Math.max(...Object.values(trends.departmentTrends)
                  .map(d => d[d.length - 1]?.grossPayroll || 0));
                const percentage = (dept.value / maxDeptValue) * 100;
                const colors = ['bg-blue-500', 'bg-green-500', 'bg-purple-500', 'bg-yellow-500', 'bg-red-500'];

                return (
                  <div key={dept.department}>
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span className="text-gray-700">{dept.department}</span>
                      <span className="text-gray-500">{formatCurrency(dept.value)}</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className={`${colors[idx % colors.length]} h-2 rounded-full transition-all`}
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                );
              })
            }
          </div>
        </div>
      )}
    </div>
  );
}

export default PayrollTrendsChart;
