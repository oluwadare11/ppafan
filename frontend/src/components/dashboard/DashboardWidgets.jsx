// DashboardWidgets.jsx - Revenue Pie Chart and Financial Summary widgets
import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import { TrendingUp, TrendingDown, DollarSign, CreditCard, PiggyBank, Target } from 'lucide-react';

// Color palette for charts
const CHART_COLORS = [
  '#3B82F6', // blue
  '#8B5CF6', // purple
  '#EC4899', // pink
  '#10B981', // green
  '#F59E0B', // orange
  '#EF4444', // red
  '#6366F1', // indigo
  '#14B8A6', // teal
];

// Revenue Distribution Pie Chart
export const RevenuePieChart = ({ data, title = "Revenue by Department" }) => {
  // Transform data for recharts
  const chartData = data && Array.isArray(data)
    ? data.map((item, index) => ({
        name: item.name || 'Unknown',
        value: item.value || 0,
        color: CHART_COLORS[index % CHART_COLORS.length]
      }))
    : [];

  const totalRevenue = chartData.reduce((sum, item) => sum + item.value, 0);

  // Custom label for pie slices
  const renderLabel = (entry) => {
    const percent = totalRevenue > 0 ? ((entry.value / totalRevenue) * 100).toFixed(0) : 0;
    return `${percent}%`;
  };

  return (
    <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
      {/* Header */}
      <div className="mb-6">
        <h3 className="text-xl font-bold text-gray-900 mb-2">
          {title}
        </h3>
        <p className="text-sm text-gray-600">
          Distribution across departments
        </p>
      </div>

      {/* Chart */}
      {chartData.length > 0 ? (
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={renderLabel}
                outerRadius={100}
                fill="#8884d8"
                dataKey="value"
              >
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                formatter={(value) => `₦${value.toLocaleString()}`}
                contentStyle={{
                  backgroundColor: 'rgba(255, 255, 255, 0.95)',
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px',
                  padding: '8px 12px'
                }}
              />
              <Legend
                verticalAlign="bottom"
                height={36}
                formatter={(value, entry) => (
                  <span className="text-sm text-gray-700">
                    {value}
                  </span>
                )}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="h-80 flex items-center justify-center text-gray-400">
          <p>No revenue data available</p>
        </div>
      )}

      {/* Legend with amounts */}
      <div className="mt-6 space-y-2">
        {chartData.slice(0, 5).map((item, index) => {
          const percentage = totalRevenue > 0 ? ((item.value / totalRevenue) * 100).toFixed(1) : 0;
          return (
            <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-100">
              <div className="flex items-center gap-3">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: item.color }}
                />
                <span className="text-sm font-medium text-gray-700">
                  {item.name}
                </span>
              </div>
              <div className="text-right">
                <p className="text-sm font-semibold text-gray-900">
                  ₦{item.value.toLocaleString()}
                </p>
                <p className="text-xs text-gray-500">
                  {percentage}%
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// Financial Summary Widget - Mobile Responsive & Light Theme
export const FinancialSummary = ({ financial }) => {
  const {
    revenue = 0,
    expenses = 0,
    grossProfit = 0,
    netProfit = 0,
    grossMargin = 0
  } = financial || {};

  const formatValue = (val) => {
    if (val >= 1000000) return `₦${(val / 1000000).toFixed(1)}M`;
    if (val >= 1000) return `₦${(val / 1000).toFixed(0)}K`;
    return `₦${val.toLocaleString()}`;
  };

  const metrics = [
    {
      icon: DollarSign,
      label: 'Revenue',
      value: revenue,
      color: 'from-green-500 to-emerald-600',
      bgColor: 'bg-green-50',
      textColor: 'text-green-600'
    },
    {
      icon: CreditCard,
      label: 'Expenses',
      value: expenses,
      color: 'from-red-500 to-rose-600',
      bgColor: 'bg-red-50',
      textColor: 'text-red-600'
    },
    {
      icon: PiggyBank,
      label: 'Gross Profit',
      value: grossProfit,
      color: 'from-blue-500 to-indigo-600',
      bgColor: 'bg-blue-50',
      textColor: 'text-blue-600'
    },
    {
      icon: Target,
      label: 'Net Profit',
      value: netProfit,
      color: 'from-purple-500 to-pink-600',
      bgColor: 'bg-purple-50',
      textColor: 'text-purple-600',
      subtitle: `${grossMargin.toFixed(1)}% margin`
    }
  ];

  const profitTrend = grossProfit >= 0;

  return (
    <div className="bg-white rounded-xl sm:rounded-2xl p-4 sm:p-6 shadow-sm border border-gray-100">
      {/* Header */}
      <div className="mb-4 sm:mb-6">
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <h3 className="text-base sm:text-lg lg:text-xl font-bold text-gray-900">
            Financial Overview
          </h3>
          {profitTrend ? (
            <div className="flex items-center gap-1 px-2 py-0.5 sm:py-1 bg-green-100 rounded-md">
              <TrendingUp className="w-3 h-3 text-green-600" />
              <span className="text-xs font-semibold text-green-600">Profitable</span>
            </div>
          ) : (
            <div className="flex items-center gap-1 px-2 py-0.5 sm:py-1 bg-red-100 rounded-md">
              <TrendingDown className="w-3 h-3 text-red-600" />
              <span className="text-xs font-semibold text-red-600">Loss</span>
            </div>
          )}
        </div>
      </div>

      {/* Metrics Grid - 2x2 on mobile, 4 columns on larger screens */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3 lg:gap-4">
        {metrics.map((metric, index) => {
          const IconComponent = metric.icon;
          return (
            <div
              key={index}
              className={`${metric.bgColor} rounded-lg sm:rounded-xl p-3 sm:p-4 border border-gray-100`}
            >
              <div className="flex items-center gap-2 mb-2 sm:mb-3">
                <div className={`p-1.5 sm:p-2 rounded-lg bg-gradient-to-br ${metric.color}`}>
                  <IconComponent className="w-3.5 h-3.5 sm:w-4 sm:h-4 lg:w-5 lg:h-5 text-white" />
                </div>
                <p className="text-xs sm:text-sm font-medium text-gray-600 truncate">
                  {metric.label}
                </p>
              </div>
              <p className={`text-base sm:text-lg lg:text-xl font-bold ${metric.textColor} truncate`}>
                {formatValue(metric.value)}
              </p>
              {metric.subtitle && (
                <p className="text-xs text-gray-500 mt-0.5 sm:mt-1 truncate">
                  {metric.subtitle}
                </p>
              )}
            </div>
          );
        })}
      </div>

      {/* Bottom summary - Hidden on very small screens */}
      <div className="hidden sm:block mt-4 sm:mt-6 pt-4 sm:pt-6 border-t border-gray-100">
        <div className="flex items-center justify-between">
          <span className="text-xs sm:text-sm text-gray-600">
            Profit Margin
          </span>
          <div className="flex items-center gap-2">
            <div className="w-20 sm:w-32 h-1.5 sm:h-2 bg-gray-100 rounded-full overflow-hidden">
              <div
                className={`h-full bg-gradient-to-r ${metrics[2].color} transition-all duration-500`}
                style={{ width: `${Math.min(Math.max(grossMargin, 0), 100)}%` }}
              />
            </div>
            <span className="text-xs sm:text-sm font-semibold text-gray-900">
              {grossMargin.toFixed(1)}%
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default { RevenuePieChart, FinancialSummary };
