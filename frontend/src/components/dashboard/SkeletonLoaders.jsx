// SkeletonLoaders.jsx - Beautiful animated skeleton loaders for dashboard
import React from 'react';

// Base shimmer animation keyframes (defined in CSS)
const shimmerStyle = `
  @keyframes shimmer {
    0% {
      background-position: -1000px 0;
    }
    100% {
      background-position: 1000px 0;
    }
  }
`;

// Base Skeleton component with shimmer effect
export const Skeleton = ({ width = '100%', height = '20px', className = '', circle = false }) => {
  return (
    <div
      className={`
        animate-pulse
        bg-gradient-to-r from-gray-200 via-gray-300 to-gray-200
        dark:from-gray-700 dark:via-gray-600 dark:to-gray-700
        ${circle ? 'rounded-full' : 'rounded-md'}
        ${className}
      `}
      style={{
        width,
        height,
        backgroundSize: '1000px 100%',
        animation: 'shimmer 2s infinite linear'
      }}
    />
  );
};

// KPI Card Skeleton with shimmer effect
export const KPICardSkeleton = () => {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-100 dark:border-gray-700">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          {/* Icon placeholder */}
          <Skeleton circle width="48px" height="48px" className="mb-4" />

          {/* Title */}
          <Skeleton width="120px" height="16px" className="mb-3" />

          {/* Value */}
          <Skeleton width="140px" height="32px" className="mb-2" />

          {/* Trend indicator */}
          <div className="flex items-center gap-2 mt-2">
            <Skeleton width="60px" height="14px" />
            <Skeleton width="80px" height="14px" />
          </div>
        </div>
      </div>
    </div>
  );
};

// Chart Skeleton with animated bars
export const ChartSkeleton = ({ title = 'Chart', height = '300px' }) => {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-100 dark:border-gray-700">
      {/* Chart title */}
      <div className="mb-6">
        <Skeleton width="200px" height="24px" className="mb-2" />
        <Skeleton width="150px" height="14px" />
      </div>

      {/* Chart area with animated bars */}
      <div className="flex items-end justify-between gap-2" style={{ height }}>
        {[80, 60, 90, 70, 85, 75, 95, 65].map((heightPercent, index) => (
          <div
            key={index}
            className="flex-1 bg-gradient-to-t from-blue-200 to-blue-300 dark:from-blue-900 dark:to-blue-800 rounded-t-md animate-pulse"
            style={{
              height: `${heightPercent}%`,
              animationDelay: `${index * 0.1}s`
            }}
          />
        ))}
      </div>

      {/* X-axis placeholder */}
      <div className="flex justify-between mt-4">
        {[1, 2, 3, 4, 5, 6, 7, 8].map((_, index) => (
          <Skeleton key={index} width="40px" height="12px" />
        ))}
      </div>
    </div>
  );
};

// Table Skeleton with rows
export const TableSkeleton = ({ rows = 5, columns = 4, title = 'Table' }) => {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
      {/* Table header */}
      <div className="p-6 border-b border-gray-100 dark:border-gray-700">
        <Skeleton width="180px" height="24px" className="mb-2" />
        <Skeleton width="120px" height="14px" />
      </div>

      {/* Table body */}
      <div className="divide-y divide-gray-100 dark:divide-gray-700">
        {Array.from({ length: rows }).map((_, rowIndex) => (
          <div key={rowIndex} className="p-4 flex items-center gap-4">
            {Array.from({ length: columns }).map((_, colIndex) => (
              <div key={colIndex} className={colIndex === 0 ? 'flex-1' : 'w-24'}>
                <Skeleton
                  width={colIndex === 0 ? '100%' : '80px'}
                  height="16px"
                  className={rowIndex % 2 === 0 ? 'opacity-100' : 'opacity-70'}
                />
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
};

// Pie Chart Skeleton
export const PieChartSkeleton = ({ title = 'Distribution' }) => {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-100 dark:border-gray-700">
      {/* Title */}
      <div className="mb-6">
        <Skeleton width="200px" height="24px" className="mb-2" />
        <Skeleton width="150px" height="14px" />
      </div>

      {/* Pie chart circle */}
      <div className="flex flex-col items-center justify-center">
        <div className="relative w-48 h-48">
          {/* Animated pie segments */}
          <div className="absolute inset-0">
            <Skeleton circle width="100%" height="100%" className="opacity-80" />
          </div>
          <div className="absolute inset-4">
            <div className="w-full h-full bg-white dark:bg-gray-800 rounded-full" />
          </div>
        </div>

        {/* Legend */}
        <div className="mt-6 space-y-2 w-full">
          {[1, 2, 3, 4].map((_, index) => (
            <div key={index} className="flex items-center gap-3">
              <Skeleton circle width="12px" height="12px" />
              <Skeleton width="120px" height="14px" />
              <Skeleton width="60px" height="14px" className="ml-auto" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// Financial Summary Skeleton
export const FinancialSummarySkeleton = () => {
  return (
    <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-gray-800 dark:to-gray-900 rounded-xl p-6 shadow-sm border border-blue-100 dark:border-gray-700">
      {/* Header */}
      <div className="mb-6">
        <Skeleton width="180px" height="24px" className="mb-2" />
        <Skeleton width="140px" height="14px" />
      </div>

      {/* Financial metrics */}
      <div className="space-y-4">
        {[1, 2, 3, 4].map((_, index) => (
          <div key={index} className="flex items-center justify-between p-4 bg-white/50 dark:bg-gray-800/50 rounded-lg">
            <div className="flex items-center gap-3">
              <Skeleton circle width="40px" height="40px" />
              <div>
                <Skeleton width="100px" height="16px" className="mb-2" />
                <Skeleton width="80px" height="12px" />
              </div>
            </div>
            <Skeleton width="100px" height="28px" />
          </div>
        ))}
      </div>
    </div>
  );
};

// Full Dashboard Skeleton - combines all skeleton components
export const DashboardSkeleton = () => {
  return (
    <div className="p-6 space-y-6">
      {/* Header section */}
      <div className="mb-8">
        <Skeleton width="300px" height="32px" className="mb-2" />
        <Skeleton width="200px" height="16px" />
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <KPICardSkeleton />
        <KPICardSkeleton />
        <KPICardSkeleton />
        <KPICardSkeleton />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartSkeleton height="300px" />
        <PieChartSkeleton />
      </div>

      {/* Financial Summary */}
      <FinancialSummarySkeleton />

      {/* Tables Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <TableSkeleton rows={5} columns={3} />
        <TableSkeleton rows={5} columns={3} />
      </div>
    </div>
  );
};

// Add shimmer keyframes to document
if (typeof document !== 'undefined') {
  const styleSheet = document.createElement('style');
  styleSheet.textContent = shimmerStyle;
  document.head.appendChild(styleSheet);
}

export default {
  Skeleton,
  KPICardSkeleton,
  ChartSkeleton,
  TableSkeleton,
  PieChartSkeleton,
  FinancialSummarySkeleton,
  DashboardSkeleton
};
