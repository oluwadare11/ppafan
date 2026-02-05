// EnhancedKPICard.jsx - Beautiful KPI cards with gradients and trends
import React from 'react';
import { TrendingUp, TrendingDown, DollarSign, ShoppingCart, Users, Package, AlertTriangle } from 'lucide-react';

const EnhancedKPICard = ({
  title,
  value,
  subtitle,
  trend,
  trendValue,
  icon: Icon,
  gradientFrom = 'from-blue-500',
  gradientTo = 'to-indigo-600',
  iconColor = 'text-blue-600',
  onClick
}) => {
  const isPositiveTrend = trend === 'up';
  const TrendIcon = isPositiveTrend ? TrendingUp : TrendingDown;
  const trendColor = isPositiveTrend ? 'text-green-600' : 'text-red-600';
  const trendBgColor = isPositiveTrend ? 'bg-green-50' : 'bg-red-50';

  return (
    <div
      className={`
        group relative bg-white dark:bg-gray-800 rounded-2xl p-6
        shadow-lg hover:shadow-2xl transition-all duration-300
        border border-gray-100 dark:border-gray-700
        overflow-hidden
        ${onClick ? 'cursor-pointer' : ''}
      `}
      onClick={onClick}
    >
      {/* Gradient background decoration */}
      <div className={`absolute top-0 right-0 w-32 h-32 bg-gradient-to-br ${gradientFrom} ${gradientTo} opacity-5 rounded-full -mr-16 -mt-16 group-hover:opacity-10 transition-opacity`} />

      {/* Content */}
      <div className="relative z-10">
        {/* Header with icon */}
        <div className="flex items-start justify-between mb-4">
          <div className={`p-3 rounded-xl bg-gradient-to-br ${gradientFrom} ${gradientTo} shadow-lg`}>
            {Icon && <Icon className="w-6 h-6 text-white" />}
          </div>

          {/* Trend badge */}
          {trendValue && (
            <div className={`flex items-center gap-1 px-2 py-1 ${trendBgColor} rounded-lg`}>
              <TrendIcon className={`w-4 h-4 ${trendColor}`} />
              <span className={`text-xs font-semibold ${trendColor}`}>
                {trendValue}
              </span>
            </div>
          )}
        </div>

        {/* Title */}
        <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">
          {title}
        </h3>

        {/* Value */}
        <div className="flex items-baseline gap-2 mb-2">
          <p className="text-3xl font-bold text-gray-900 dark:text-white">
            {value}
          </p>
        </div>

        {/* Subtitle */}
        {subtitle && (
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {subtitle}
          </p>
        )}
      </div>

      {/* Hover effect line */}
      <div className={`absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r ${gradientFrom} ${gradientTo} transform scale-x-0 group-hover:scale-x-100 transition-transform duration-300`} />
    </div>
  );
};

// Predefined KPI card configurations for common metrics
export const KPICardVariants = {
  revenue: {
    icon: DollarSign,
    gradientFrom: 'from-green-500',
    gradientTo: 'to-emerald-600',
    iconColor: 'text-green-600'
  },
  sales: {
    icon: ShoppingCart,
    gradientFrom: 'from-blue-500',
    gradientTo: 'to-indigo-600',
    iconColor: 'text-blue-600'
  },
  customers: {
    icon: Users,
    gradientFrom: 'from-purple-500',
    gradientTo: 'to-pink-600',
    iconColor: 'text-purple-600'
  },
  inventory: {
    icon: Package,
    gradientFrom: 'from-orange-500',
    gradientTo: 'to-red-600',
    iconColor: 'text-orange-600'
  },
  alerts: {
    icon: AlertTriangle,
    gradientFrom: 'from-yellow-500',
    gradientTo: 'to-orange-600',
    iconColor: 'text-yellow-600'
  }
};

export default EnhancedKPICard;
