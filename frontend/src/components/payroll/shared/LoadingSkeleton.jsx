// LoadingSkeleton.jsx - Skeleton loading components
export const SkeletonBox = ({ width = 'w-full', height = 'h-4', className = '' }) => (
  <div className={`${width} ${height} bg-gray-200 rounded animate-pulse ${className}`} />
);
export const SkeletonLine = ({ width = 'w-full', className = '' }) => (
  <div className={`${width} h-4 bg-gray-200 rounded animate-pulse ${className}`} />
);
export const SkeletonCircle = ({ size = 'w-10 h-10', className = '' }) => (
  <div className={`${size} bg-gray-200 rounded-full animate-pulse ${className}`} />
);

export const SettingsCardSkeleton = () => (
  <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 animate-pulse">
    <div className="flex items-center justify-between mb-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-gray-200 rounded-lg" />
        <div className="space-y-2"><div className="w-32 h-4 bg-gray-200 rounded" /><div className="w-48 h-3 bg-gray-200 rounded" /></div>
      </div>
      <div className="w-12 h-6 bg-gray-200 rounded-full" />
    </div>
    <div className="space-y-4">
      {[1,2,3].map(i => <div key={i} className="flex justify-between items-center py-2"><div className="w-24 h-4 bg-gray-200 rounded" /><div className="w-20 h-8 bg-gray-200 rounded" /></div>)}
    </div>
  </div>
);

export const SettingsGridSkeleton = ({ count = 4 }) => (
  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
    {Array.from({ length: count }).map((_, i) => <SettingsCardSkeleton key={i} />)}
  </div>
);

export const StaffRowSkeleton = () => (
  <div className="flex items-center gap-4 p-4 border-b border-gray-100 animate-pulse">
    <div className="w-10 h-10 bg-gray-200 rounded-full" />
    <div className="flex-1 space-y-2"><div className="w-32 h-4 bg-gray-200 rounded" /><div className="w-20 h-3 bg-gray-200 rounded" /></div>
    <div className="w-24 h-4 bg-gray-200 rounded" />
    <div className="w-20 h-6 bg-gray-200 rounded-full" />
    <div className="w-24 h-8 bg-gray-200 rounded" />
  </div>
);

export const StaffTableSkeleton = ({ rows = 5 }) => (
  <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
    <div className="bg-gray-50 p-4 flex gap-4 animate-pulse">
      {[1,2,3,4,5].map(i => <div key={i} className="w-24 h-4 bg-gray-200 rounded" />)}
    </div>
    {Array.from({ length: rows }).map((_, i) => <StaffRowSkeleton key={i} />)}
  </div>
);

export const MobileCardSkeleton = () => (
  <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 space-y-3 animate-pulse">
    <div className="flex items-center gap-3"><div className="w-12 h-12 bg-gray-200 rounded-full" /><div className="space-y-2"><div className="w-32 h-4 bg-gray-200 rounded" /><div className="w-20 h-3 bg-gray-200 rounded" /></div></div>
    <div className="grid grid-cols-2 gap-3"><div className="h-4 bg-gray-200 rounded" /><div className="h-4 bg-gray-200 rounded" /></div>
    <div className="h-9 bg-gray-200 rounded-lg" />
  </div>
);

export const MobileListSkeleton = ({ count = 4 }) => (
  <div className="space-y-3">{Array.from({ length: count }).map((_, i) => <MobileCardSkeleton key={i} />)}</div>
);

export const StatsCardSkeleton = () => (
  <div className="bg-white rounded-lg border border-gray-200 p-4 animate-pulse">
    <div className="flex items-center gap-2 mb-2"><div className="w-8 h-8 bg-gray-200 rounded-full" /><div className="w-24 h-4 bg-gray-200 rounded" /></div>
    <div className="w-32 h-8 bg-gray-200 rounded mt-2" />
    <div className="w-20 h-3 bg-gray-200 rounded mt-2" />
  </div>
);

export const StatsGridSkeleton = ({ count = 4 }) => (
  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">{Array.from({ length: count }).map((_, i) => <StatsCardSkeleton key={i} />)}</div>
);

export const FormSkeleton = ({ fields = 4 }) => (
  <div className="space-y-4 animate-pulse">
    {Array.from({ length: fields }).map((_, i) => (
      <div key={i}><div className="w-24 h-3 bg-gray-200 rounded mb-1" /><div className="h-10 bg-gray-200 rounded-lg" /></div>
    ))}
  </div>
);

export const SalaryComponentSkeleton = () => (
  <div className="p-4 border border-gray-200 rounded-lg animate-pulse">
    <div className="flex items-center justify-between"><div className="w-40 h-4 bg-gray-200 rounded" /><div className="w-16 h-6 bg-gray-200 rounded-full" /></div>
    <div className="w-24 h-3 bg-gray-200 rounded mt-2" />
  </div>
);

export const SalaryComponentsListSkeleton = ({ count = 3 }) => (
  <div className="space-y-3">{Array.from({ length: count }).map((_, i) => <SalaryComponentSkeleton key={i} />)}</div>
);

export const PayrollSummarySkeleton = () => (
  <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-4 animate-pulse">
    <div className="w-48 h-5 bg-gray-200 rounded" />
    {[1,2,3,4,5].map(i => <div key={i} className="flex justify-between"><div className="w-32 h-4 bg-gray-200 rounded" /><div className="w-24 h-4 bg-gray-200 rounded" /></div>)}
    <div className="border-t pt-4 flex justify-between"><div className="w-24 h-6 bg-gray-200 rounded" /><div className="w-32 h-6 bg-gray-200 rounded" /></div>
  </div>
);

export const TabsSkeleton = ({ count = 5 }) => (
  <div className="flex gap-2 p-1 bg-white rounded-lg shadow-sm animate-pulse">
    {Array.from({ length: count }).map((_, i) => <div key={i} className="w-24 h-9 bg-gray-200 rounded-md" />)}
  </div>
);

export const PayrollPageSkeleton = () => (
  <div className="space-y-6">
    <div className="flex justify-between items-start animate-pulse">
      <div className="space-y-2"><div className="w-48 h-8 bg-gray-200 rounded" /><div className="w-64 h-4 bg-gray-200 rounded" /></div>
      <div className="w-32 h-10 bg-gray-200 rounded-lg" />
    </div>
    <TabsSkeleton count={8} />
    <StatsGridSkeleton count={4} />
    <SettingsGridSkeleton count={2} />
  </div>
);

export default SkeletonBox;
