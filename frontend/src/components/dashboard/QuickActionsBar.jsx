// QuickActionsBar.jsx - Quick access buttons for common dashboard actions
import React from 'react';
import {
  Plus, ShoppingCart, Package, Users, FileText, Download,
  TrendingUp, Settings, Calendar, Bell
} from 'lucide-react';

const QuickActionsBar = ({ onAction, navigateWithTenant }) => {
  const actions = [
    {
      id: 'new-sale',
      label: 'New Sale',
      icon: ShoppingCart,
      color: 'from-blue-500 to-indigo-600',
      hoverColor: 'hover:from-blue-600 hover:to-indigo-700',
      path: '/pos'
    },
    {
      id: 'add-product',
      label: 'Add Product',
      icon: Package,
      color: 'from-green-500 to-emerald-600',
      hoverColor: 'hover:from-green-600 hover:to-emerald-700',
      path: '/inventory'
    },
    {
      id: 'new-customer',
      label: 'New Customer',
      icon: Users,
      color: 'from-purple-500 to-pink-600',
      hoverColor: 'hover:from-purple-600 hover:to-pink-700',
      path: '/customers'
    },
    {
      id: 'reports',
      label: 'Reports',
      icon: TrendingUp,
      color: 'from-orange-500 to-red-600',
      hoverColor: 'hover:from-orange-600 hover:to-red-700',
      path: '/reports'
    },
    {
      id: 'export',
      label: 'Export Data',
      icon: Download,
      color: 'from-gray-500 to-slate-600',
      hoverColor: 'hover:from-gray-600 hover:to-slate-700',
      action: 'export'
    }
  ];

  const handleActionClick = (action) => {
    if (action.action && onAction) {
      onAction(action.action);
    } else if (action.path && navigateWithTenant) {
      navigateWithTenant(action.path);
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-lg border border-gray-100 dark:border-gray-700">
      {/* Header */}
      <div className="mb-6">
        <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1">
          Quick Actions
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Jump to common tasks
        </p>
      </div>

      {/* Actions Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {actions.map((action) => {
          const IconComponent = action.icon;
          return (
            <button
              key={action.id}
              onClick={() => handleActionClick(action)}
              className={`
                group relative
                bg-gradient-to-br ${action.color} ${action.hoverColor}
                text-white rounded-xl p-4
                transition-all duration-300
                transform hover:scale-105 hover:shadow-xl
                flex flex-col items-center justify-center gap-2
              `}
            >
              {/* Icon */}
              <div className="p-2 bg-white/20 backdrop-blur-sm rounded-lg group-hover:bg-white/30 transition-colors">
                <IconComponent className="w-6 h-6" />
              </div>

              {/* Label */}
              <span className="text-sm font-semibold text-center">
                {action.label}
              </span>

              {/* Shine effect on hover */}
              <div className="absolute inset-0 bg-white/0 group-hover:bg-white/10 rounded-xl transition-colors" />
            </button>
          );
        })}
      </div>

      {/* Additional Actions (Overflow Menu) */}
      <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-600">
        <div className="flex items-center justify-between">
          <button
            onClick={() => navigateWithTenant && navigateWithTenant('/settings')}
            className="flex items-center gap-2 px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
          >
            <Settings className="w-4 h-4" />
            Settings
          </button>

          <button
            onClick={() => navigateWithTenant && navigateWithTenant('/calendar')}
            className="flex items-center gap-2 px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
          >
            <Calendar className="w-4 h-4" />
            Calendar
          </button>

          <button
            onClick={() => onAction && onAction('notifications')}
            className="flex items-center gap-2 px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors relative"
          >
            <Bell className="w-4 h-4" />
            Alerts
            {/* Notification badge */}
            <span className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default QuickActionsBar;
