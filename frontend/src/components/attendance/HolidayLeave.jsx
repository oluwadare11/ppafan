import React from 'react';
import { FaTrash, FaPlus, FaCalendarAlt } from 'react-icons/fa';

const HolidayLeave = ({
  holidays,
  newHoliday,
  setNewHoliday,
  handleAddHoliday,
  handleDeleteHoliday,
  loading,
}) => {
  const formatDate = (dateStr) =>
    new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="bg-white rounded-xl shadow-lg overflow-hidden">
        {/* Header */}
        <div className="px-4 sm:px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg sm:text-xl font-semibold text-gray-900 flex items-center gap-2">
            <FaCalendarAlt className="text-purple-600" />
            Public Holidays
          </h3>
          <p className="text-sm text-gray-500 mt-0.5">Add and manage company-wide public holidays</p>
        </div>

        <div className="p-4 sm:p-6">
          {/* Add Holiday Form */}
          <form onSubmit={handleAddHoliday} className="mb-6 p-4 bg-purple-50 border border-purple-200 rounded-xl">
            <h4 className="text-sm font-semibold text-gray-700 mb-3">Add New Holiday</h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Holiday Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={newHoliday.name}
                  onChange={(e) => setNewHoliday({ ...newHoliday, name: e.target.value })}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                  placeholder="e.g., Christmas Day"
                  required
                  disabled={loading}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Start Date <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={newHoliday.startDate}
                  onChange={(e) => setNewHoliday({ ...newHoliday, startDate: e.target.value, endDate: newHoliday.endDate || e.target.value })}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                  required
                  disabled={loading}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  End Date <span className="text-gray-400 font-normal text-xs">(multi-day)</span>
                </label>
                <input
                  type="date"
                  value={newHoliday.endDate}
                  min={newHoliday.startDate}
                  onChange={(e) => setNewHoliday({ ...newHoliday, endDate: e.target.value })}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                  disabled={loading}
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={loading}
              className="mt-4 px-5 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors flex items-center gap-2 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <FaPlus /> Add Holiday
            </button>
          </form>

          {/* Mobile Card View */}
          <div className="block sm:hidden space-y-3">
            {holidays && holidays.length > 0 ? (
              holidays.map((holiday) => (
                <div key={holiday._id} className="bg-white border border-gray-200 rounded-lg p-3 flex items-center justify-between">
                  <div>
                    <div className="font-medium text-gray-900 text-sm">{holiday.name}</div>
                    <div className="text-xs text-gray-500">{formatDate(holiday.date)}</div>
                  </div>
                  <button
                    onClick={() => { if (window.confirm('Delete this holiday?')) handleDeleteHoliday(holiday._id); }}
                    className="text-red-600 hover:text-red-900 p-2 hover:bg-red-50 rounded"
                    disabled={loading}
                  >
                    <FaTrash />
                  </button>
                </div>
              ))
            ) : (
              <div className="text-center text-gray-500 py-8 bg-gray-50 rounded-lg">
                No holidays defined yet
              </div>
            )}
          </div>

          {/* Desktop Table View */}
          <div className="hidden sm:block overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Holiday Name
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Date
                  </th>
                  <th className="hidden md:table-cell px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Year
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {holidays && holidays.length > 0 ? (
                  holidays.map((holiday) => (
                    <tr key={holiday._id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{holiday.name}</div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{formatDate(holiday.date)}</div>
                      </td>
                      <td className="hidden md:table-cell px-4 py-3 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{holiday.year || new Date(holiday.date + 'T00:00:00').getFullYear()}</div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-right">
                        <button
                          onClick={() => {
                            if (window.confirm('Are you sure you want to delete this holiday?')) {
                              handleDeleteHoliday(holiday._id);
                            }
                          }}
                          className="text-red-600 hover:text-red-900 p-2 hover:bg-red-50 rounded"
                          title="Delete holiday"
                          disabled={loading}
                        >
                          <FaTrash />
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="4" className="px-6 py-8 text-center text-gray-500">
                      No holidays defined yet
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HolidayLeave;
