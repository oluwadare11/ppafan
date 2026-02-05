// DashboardTables.jsx - Mobile-responsive table components for dashboard
import React from 'react';
import { Star, TrendingUp, Package, AlertTriangle, ShoppingCart, Calendar, CreditCard } from 'lucide-react';

// Enhanced Table Component - Mobile Responsive & White Theme
export const EnhancedTable = ({
  title,
  subtitle,
  icon: Icon,
  data = [],
  columns = [],
  emptyMessage = "No data available",
  gradientFrom = 'from-blue-500',
  gradientTo = 'to-indigo-600'
}) => {
  return (
    <div className="bg-white rounded-xl sm:rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
      {/* Header */}
      <div className={`p-3 sm:p-4 lg:p-6 bg-gradient-to-r ${gradientFrom} ${gradientTo}`}>
        <div className="flex items-center gap-2 sm:gap-3 mb-1 sm:mb-2">
          {Icon && (
            <div className="p-1.5 sm:p-2 bg-white/20 backdrop-blur-sm rounded-lg">
              <Icon className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
            </div>
          )}
          <h3 className="text-base sm:text-lg lg:text-xl font-bold text-white">{title}</h3>
        </div>
        {subtitle && (
          <p className="text-xs sm:text-sm text-white/80">{subtitle}</p>
        )}
      </div>

      {/* Table */}
      {data.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                {columns.map((column, index) => (
                  <th
                    key={index}
                    className={`px-2 sm:px-4 lg:px-6 py-2 sm:py-3 text-left text-[10px] sm:text-xs font-semibold text-gray-600 uppercase tracking-wider ${
                      column.align === 'right' ? 'text-right' : ''
                    }`}
                  >
                    {column.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {data.slice(0, 5).map((row, rowIndex) => (
                <tr
                  key={rowIndex}
                  className="hover:bg-gray-50 transition-colors"
                >
                  {columns.map((column, colIndex) => (
                    <td
                      key={colIndex}
                      className={`px-2 sm:px-4 lg:px-6 py-2.5 sm:py-3 lg:py-4 ${column.align === 'right' ? 'text-right' : ''}`}
                    >
                      {column.render ? column.render(row, rowIndex) : row[column.key]}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="p-6 sm:p-8 lg:p-12 text-center">
          <div className="w-12 h-12 sm:w-16 sm:h-16 mx-auto mb-3 sm:mb-4 rounded-full bg-gray-100 flex items-center justify-center">
            {Icon && <Icon className="w-6 h-6 sm:w-8 sm:h-8 text-gray-400" />}
          </div>
          <p className="text-xs sm:text-sm text-gray-500">{emptyMessage}</p>
        </div>
      )}
    </div>
  );
};

// Top Selling Items Table - Mobile Responsive
export const TopItemsTable = ({ data = [] }) => {
  const columns = [
    {
      label: '#',
      key: 'index',
      render: (row, index) => (
        <span className="text-xs sm:text-sm font-semibold text-gray-500">
          {index + 1}
        </span>
      )
    },
    {
      label: 'Item',
      key: 'name',
      render: (row) => (
        <div className="flex items-center gap-1.5 sm:gap-2 min-w-0 max-w-[120px] sm:max-w-[200px]">
          <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-blue-500 flex-shrink-0" />
          <span className="text-xs sm:text-sm font-medium text-gray-900 truncate">
            {row.name}
          </span>
        </div>
      )
    },
    {
      label: 'Qty',
      key: 'quantity',
      align: 'right',
      render: (row) => (
        <span className="text-xs sm:text-sm font-semibold text-gray-700">
          {row.quantity}
        </span>
      )
    },
    {
      label: 'Revenue',
      key: 'revenue',
      align: 'right',
      render: (row) => (
        <span className="text-xs sm:text-sm font-bold text-green-600">
          ₦{row.revenue?.toLocaleString() || 0}
        </span>
      )
    }
  ];

  return (
    <EnhancedTable
      title="Top 5 Best Sellers"
      subtitle="By revenue"
      icon={Star}
      data={data}
      columns={columns}
      emptyMessage="No sales data yet"
      gradientFrom="from-orange-500"
      gradientTo="to-red-600"
    />
  );
};

// Top Customers Table - Mobile Responsive
export const TopCustomersTable = ({ data = [] }) => {
  const columns = [
    {
      label: '#',
      key: 'index',
      render: (row, index) => (
        <span className="text-xs sm:text-sm font-semibold text-gray-500">
          {index + 1}
        </span>
      )
    },
    {
      label: 'Customer',
      key: 'name',
      render: (row) => (
        <div className="min-w-0">
          <p className="text-xs sm:text-sm font-medium text-gray-900 truncate">
            {row.name}
          </p>
        </div>
      )
    },
    {
      label: 'Txns',
      key: 'transactionCount',
      align: 'right',
      render: (row) => (
        <span className="text-xs sm:text-sm font-semibold text-gray-700">
          {row.transactionCount || 0}
        </span>
      )
    },
    {
      label: 'Total',
      key: 'totalSpent',
      align: 'right',
      render: (row) => (
        <span className="text-xs sm:text-sm font-bold text-purple-600">
          ₦{row.totalSpent?.toLocaleString() || 0}
        </span>
      )
    }
  ];

  return (
    <EnhancedTable
      title="Top 5 Customers"
      subtitle="By spending"
      icon={Star}
      data={data}
      columns={columns}
      emptyMessage="No customer data yet"
      gradientFrom="from-purple-500"
      gradientTo="to-pink-600"
    />
  );
};

// Recent Transactions Table - Mobile Responsive
export const RecentTransactionsTable = ({ data = [] }) => {
  const columns = [
    {
      label: 'Item',
      key: 'itemName',
      render: (row) => (
        <span className="text-xs sm:text-sm font-medium text-gray-900 block max-w-[100px] sm:max-w-[150px] truncate">
          {row.itemName || 'N/A'}
        </span>
      )
    },
    {
      label: 'Type',
      key: 'paymentMethod',
      render: (row) => (
        <span className="text-xs sm:text-sm capitalize text-gray-700 truncate">
          {row.paymentMethod?.replace('_', ' ') || 'N/A'}
        </span>
      )
    },
    {
      label: 'Amount',
      key: 'amount',
      align: 'right',
      render: (row) => (
        <span className="text-xs sm:text-sm font-bold text-green-600">
          ₦{row.amount?.toLocaleString() || 0}
        </span>
      )
    }
  ];

  return (
    <EnhancedTable
      title="Recent Sales"
      subtitle="5 Latest"
      icon={ShoppingCart}
      data={data}
      columns={columns}
      emptyMessage="No transactions yet"
      gradientFrom="from-blue-500"
      gradientTo="to-indigo-600"
    />
  );
};

// Low Stock Alerts Table - Mobile Responsive
export const LowStockAlertsTable = ({ data = [] }) => {
  const columns = [
    {
      label: 'Item',
      key: 'name',
      render: (row) => (
        <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
          <AlertTriangle className="w-3 h-3 sm:w-4 sm:h-4 text-yellow-500 flex-shrink-0" />
          <span className="text-xs sm:text-sm font-medium text-gray-900 truncate">
            {row.name}
          </span>
        </div>
      )
    },
    {
      label: 'Stock',
      key: 'quantity',
      align: 'right',
      render: (row) => (
        <span className={`text-xs sm:text-sm font-semibold ${
          row.quantity === 0 ? 'text-red-600' : 'text-yellow-600'
        }`}>
          {row.quantity}
        </span>
      )
    },
    {
      label: 'Reorder',
      key: 'reorderLevel',
      align: 'right',
      render: (row) => (
        <span className="text-xs sm:text-sm text-gray-600">
          {row.reorderLevel}
        </span>
      )
    }
  ];

  return (
    <EnhancedTable
      title="Low Stock Alerts"
      subtitle={data.length > 0 ? `${data.length} items need attention` : "All stocked!"}
      icon={AlertTriangle}
      data={data}
      columns={columns}
      emptyMessage="All items are well stocked!"
      gradientFrom="from-yellow-500"
      gradientTo="to-orange-600"
    />
  );
};

export default {
  EnhancedTable,
  TopItemsTable,
  TopCustomersTable,
  RecentTransactionsTable,
  LowStockAlertsTable
};
