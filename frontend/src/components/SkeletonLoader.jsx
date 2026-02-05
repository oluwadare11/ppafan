// SkeletonLoader.jsx - Skeleton loading states for modules
import React from 'react';

// Base skeleton pulse animation
const Skeleton = ({ className = '' }) => (
  <div className={`animate-pulse bg-gray-200 rounded ${className}`}></div>
);

// Dashboard skeleton
export const DashboardSkeleton = () => (
  <div className="p-4 sm:p-6 lg:p-8 space-y-6 bg-gray-50 min-h-screen">
    {/* Header */}
    <div className="flex items-center justify-between">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-10 w-32" />
    </div>

    {/* Stat Cards */}
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="bg-white rounded-xl p-4 shadow-sm">
          <Skeleton className="h-4 w-20 mb-3" />
          <Skeleton className="h-8 w-24 mb-2" />
          <Skeleton className="h-3 w-16" />
        </div>
      ))}
    </div>

    {/* Charts */}
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="bg-white rounded-xl p-6 shadow-sm">
        <Skeleton className="h-6 w-32 mb-4" />
        <Skeleton className="h-64 w-full" />
      </div>
      <div className="bg-white rounded-xl p-6 shadow-sm">
        <Skeleton className="h-6 w-32 mb-4" />
        <Skeleton className="h-64 w-full" />
      </div>
    </div>
  </div>
);

// POS skeleton
export const POSSkeleton = () => (
  <div className="flex h-screen bg-gray-100">
    {/* Products grid */}
    <div className="flex-1 p-4 overflow-auto">
      <div className="flex items-center justify-between mb-4">
        <Skeleton className="h-10 w-64" />
        <div className="flex gap-2">
          <Skeleton className="h-10 w-24" />
          <Skeleton className="h-10 w-24" />
        </div>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
        {[...Array(15)].map((_, i) => (
          <div key={i} className="bg-white rounded-lg p-3 shadow-sm">
            <Skeleton className="h-24 w-full mb-2" />
            <Skeleton className="h-4 w-3/4 mb-2" />
            <Skeleton className="h-5 w-1/2" />
          </div>
        ))}
      </div>
    </div>

    {/* Cart sidebar */}
    <div className="hidden lg:block w-80 bg-white shadow-lg p-4">
      <Skeleton className="h-8 w-32 mb-4" />
      {[1, 2, 3].map((i) => (
        <div key={i} className="flex items-center gap-3 py-3 border-b">
          <Skeleton className="h-12 w-12 rounded" />
          <div className="flex-1">
            <Skeleton className="h-4 w-24 mb-2" />
            <Skeleton className="h-3 w-16" />
          </div>
        </div>
      ))}
      <div className="mt-auto pt-4">
        <Skeleton className="h-12 w-full rounded-lg" />
      </div>
    </div>
  </div>
);

// Inventory skeleton
export const InventorySkeleton = () => (
  <div className="p-4 sm:p-6 space-y-6 bg-gray-50 min-h-screen">
    {/* Header */}
    <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl p-6">
      <Skeleton className="h-8 w-48 bg-blue-400/50 mb-2" />
      <Skeleton className="h-4 w-64 bg-blue-400/30" />
    </div>

    {/* Stat Cards */}
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="bg-white rounded-lg p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <Skeleton className="h-12 w-12 rounded-lg" />
            <div>
              <Skeleton className="h-4 w-16 mb-2" />
              <Skeleton className="h-6 w-12" />
            </div>
          </div>
        </div>
      ))}
    </div>

    {/* Table */}
    <div className="bg-white rounded-xl shadow-sm overflow-hidden">
      <div className="p-4 border-b flex items-center justify-between">
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-10 w-48" />
      </div>
      <div className="p-4 space-y-3">
        {[...Array(8)].map((_, i) => (
          <div key={i} className="flex items-center gap-4">
            <Skeleton className="h-10 w-10 rounded" />
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-4 w-24 ml-auto" />
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-8 w-8 rounded" />
          </div>
        ))}
      </div>
    </div>
  </div>
);

// Accounting skeleton
export const AccountingSkeleton = () => (
  <div className="p-4 sm:p-6 space-y-6 bg-gray-50 min-h-screen">
    {/* Header */}
    <div className="bg-gradient-to-r from-emerald-600 to-teal-600 rounded-xl p-6">
      <Skeleton className="h-8 w-40 bg-emerald-400/50 mb-2" />
      <Skeleton className="h-4 w-56 bg-emerald-400/30" />
    </div>

    {/* Stat Cards */}
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="bg-white rounded-lg p-4 shadow-sm">
          <Skeleton className="h-4 w-20 mb-3" />
          <Skeleton className="h-7 w-28" />
        </div>
      ))}
    </div>

    {/* Tabs */}
    <div className="flex gap-2 overflow-x-auto pb-2">
      {[1, 2, 3, 4, 5].map((i) => (
        <Skeleton key={i} className="h-10 w-28 rounded-lg flex-shrink-0" />
      ))}
    </div>

    {/* Content */}
    <div className="bg-white rounded-xl shadow-sm p-6">
      <Skeleton className="h-64 w-full" />
    </div>
  </div>
);

// Attendance skeleton
export const AttendanceSkeleton = () => (
  <div className="p-4 sm:p-6 space-y-6 bg-gray-50 min-h-screen">
    {/* Header */}
    <div className="bg-gradient-to-r from-purple-600 to-indigo-600 rounded-xl p-6">
      <Skeleton className="h-8 w-40 bg-purple-400/50 mb-2" />
      <Skeleton className="h-4 w-64 bg-purple-400/30" />
    </div>

    {/* Tabs */}
    <div className="flex gap-2 overflow-x-auto pb-2">
      {[1, 2, 3, 4, 5, 6].map((i) => (
        <Skeleton key={i} className="h-10 w-32 rounded-lg flex-shrink-0" />
      ))}
    </div>

    {/* Content */}
    <div className="bg-white rounded-xl shadow-sm p-6">
      <div className="space-y-4">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="flex items-center gap-4 p-3 border-b">
            <Skeleton className="h-10 w-10 rounded-full" />
            <div className="flex-1">
              <Skeleton className="h-4 w-32 mb-2" />
              <Skeleton className="h-3 w-24" />
            </div>
            <Skeleton className="h-6 w-20 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  </div>
);

// Settings skeleton
export const SettingsSkeleton = () => (
  <div className="p-4 sm:p-6 space-y-6 bg-gray-50 min-h-screen">
    {/* Header */}
    <div className="bg-gradient-to-r from-gray-700 to-gray-900 rounded-xl p-6">
      <Skeleton className="h-8 w-32 bg-gray-500/50 mb-2" />
      <Skeleton className="h-4 w-48 bg-gray-500/30" />
    </div>

    {/* Settings sections */}
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="bg-white rounded-xl shadow-sm p-6">
          <Skeleton className="h-6 w-32 mb-4" />
          <div className="space-y-3">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-3/4" />
          </div>
        </div>
      ))}
    </div>
  </div>
);

// Generic module skeleton
export const ModuleSkeleton = () => (
  <div className="p-4 sm:p-6 space-y-6 bg-gray-50 min-h-screen">
    <div className="bg-white rounded-xl shadow-sm p-6">
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-500">Loading module...</p>
        </div>
      </div>
    </div>
  </div>
);

export default {
  DashboardSkeleton,
  POSSkeleton,
  InventorySkeleton,
  AccountingSkeleton,
  AttendanceSkeleton,
  SettingsSkeleton,
  ModuleSkeleton
};
