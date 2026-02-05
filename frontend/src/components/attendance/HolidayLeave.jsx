import React, { useState, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaEdit, FaTrash, FaPlus, FaCalendarAlt, FaCheck, FaTimes } from 'react-icons/fa';
import axios from 'axios';
import { AuthContext } from '../../context/AuthContext';

const API_BASE_URL = import.meta.env.VITE_API_URL;

const HolidayLeave = ({
  staff,
  holidays,
  leaveRequests,
  newHoliday,
  setNewHoliday,
  newLeave,
  setNewLeave,
  editingLeave,
  setEditingLeave,
  handleAddHoliday,
  deleteHoliday,
  handleAddLeave,
  deleteLeave,
  handleUpdateLeave,
  isTerminated,
}) => {
  const { logout } = useContext(AuthContext);
  const navigate = useNavigate();

  const getAuthToken = () => {
    return localStorage.getItem('adminAuthToken') || localStorage.getItem('authToken');
  };

  const getAuthHeaders = () => ({
    Authorization: `Bearer ${getAuthToken()}`,
  });

  const [approvingLeave, setApprovingLeave] = useState(null);
  const [activeTab, setActiveTab] = useState('holidays'); // 'holidays' or 'leave'

  // Filter for active staff only
  const activeStaff = staff?.filter(s => s.status === 'active') || [];

  // Approve or reject leave request
  const handleApproveLeave = async (leaveId, action) => {
    if (!window.confirm(`Are you sure you want to ${action} this leave request?`)) {
      return;
    }

    try {
      setApprovingLeave(leaveId);
      
      const response = await axios.post(
        `${API_BASE_URL}/api/attendance/leaves/${leaveId}/approve`,
        { action }, // 'approve' or 'reject'
        {
          headers: getAuthHeaders()
        }
      );

      alert(response.data.message || `Leave request ${action}d successfully!`);
      
      // Refresh page to get updated data
      window.location.reload();
      
    } catch (err) {
      console.error(`Error ${action}ing leave:`, err);
      alert(err.response?.data?.message || `Failed to ${action} leave request`);
    } finally {
      setApprovingLeave(null);
    }
  };
  return (
    <div className="space-y-4 sm:space-y-6 lg:space-y-8">
      {/* Tab Navigation */}
      <div className="bg-white rounded-xl shadow-lg overflow-hidden">
        <div className="flex border-b border-gray-200">
          <button
            onClick={() => setActiveTab('holidays')}
            className={`flex-1 px-3 sm:px-6 py-3 sm:py-4 text-sm sm:text-lg font-semibold transition-all ${
              activeTab === 'holidays'
                ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white'
                : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
            }`}
          >
            <div className="flex items-center justify-center gap-1 sm:gap-2">
              <FaCalendarAlt className="text-base sm:text-xl" />
              <span className="hidden sm:inline">Public </span>Holidays
            </div>
          </button>
          <button
            onClick={() => setActiveTab('leave')}
            className={`flex-1 px-3 sm:px-6 py-3 sm:py-4 text-sm sm:text-lg font-semibold transition-all ${
              activeTab === 'leave'
                ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white'
                : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
            }`}
          >
            <div className="flex items-center justify-center gap-1 sm:gap-2">
              <FaCalendarAlt className="text-base sm:text-xl" />
              <span className="hidden sm:inline">Leave </span>Requests
            </div>
          </button>
        </div>

        {/* Holidays Tab Content */}
        {activeTab === 'holidays' && (
          <div className="p-3 sm:p-4 lg:p-6">
            <div className="mb-4 sm:mb-6">
              <h3 className="text-lg sm:text-xl lg:text-2xl font-semibold text-gray-900 flex items-center gap-2 mb-1 sm:mb-2">
                <FaCalendarAlt className="text-purple-600 text-lg sm:text-xl lg:text-2xl" />
                Manage Public Holidays
              </h3>
              <p className="text-gray-600 text-sm sm:text-base">Add and manage company-wide holidays</p>
            </div>

            {/* Add Holiday Form */}
            <form onSubmit={handleAddHoliday} className="mb-4 sm:mb-6 p-3 sm:p-4 bg-purple-50 rounded-lg">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Holiday Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={newHoliday.name}
                    onChange={(e) => setNewHoliday({ ...newHoliday, name: e.target.value })}
                    className="w-full p-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                    placeholder="e.g., Christmas Day"
                    required
                    disabled={isTerminated}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Date <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={newHoliday.date}
                    onChange={(e) => setNewHoliday({ ...newHoliday, date: e.target.value })}
                    className="w-full p-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                    required
                    disabled={isTerminated}
                  />
                </div>
              </div>
              <button
                type="submit"
                className="mt-4 px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors flex items-center gap-2 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={isTerminated}
              >
                <FaPlus /> Add Holiday
              </button>
            </form>

            {/* Holidays List - Mobile Cards + Desktop Table */}
            {/* Mobile Card View */}
            <div className="block sm:hidden space-y-3">
              {holidays && holidays.length > 0 ? (
                holidays.map((holiday) => (
                  <div key={holiday._id} className="bg-white border border-gray-200 rounded-lg p-3 flex items-center justify-between">
                    <div>
                      <div className="font-medium text-gray-900 text-sm">{holiday.name}</div>
                      <div className="text-xs text-gray-500">
                        {new Date(holiday.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </div>
                    </div>
                    <button
                      onClick={() => { if (window.confirm('Delete this holiday?')) deleteHoliday(holiday._id); }}
                      className="text-red-600 hover:text-red-900 p-2 hover:bg-red-50 rounded"
                      disabled={isTerminated}
                    >
                      <FaTrash />
                    </button>
                  </div>
                ))
              ) : (
                <div className="text-center text-gray-500 py-6">No holidays defined</div>
              )}
            </div>

            {/* Desktop Table View */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Holiday Name
                    </th>
                    <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Date
                    </th>
                    <th className="hidden md:table-cell px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Year
                    </th>
                    <th className="px-3 sm:px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {holidays && holidays.length > 0 ? (
                    holidays.map((holiday) => (
                      <tr key={holiday._id} className="hover:bg-gray-50">
                        <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap">
                          <div className="text-xs sm:text-sm font-medium text-gray-900">{holiday.name}</div>
                        </td>
                        <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap">
                          <div className="text-xs sm:text-sm text-gray-900">
                            {new Date(holiday.date).toLocaleDateString('en-US', {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric',
                            })}
                          </div>
                        </td>
                        <td className="hidden md:table-cell px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">{holiday.year}</div>
                        </td>
                        <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap text-right text-sm font-medium">
                          <button
                            onClick={() => {
                              if (window.confirm('Are you sure you want to delete this holiday?')) {
                                deleteHoliday(holiday._id);
                              }
                            }}
                            className="text-red-600 hover:text-red-900 p-2 hover:bg-red-50 rounded"
                            title="Delete holiday"
                            disabled={isTerminated}
                          >
                            <FaTrash />
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="4" className="px-6 py-8 text-center text-gray-500">
                        No holidays defined
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Leave Requests Tab Content */}
        {activeTab === 'leave' && (
          <div className="p-3 sm:p-4 lg:p-6">
            <div className="mb-4 sm:mb-6">
              <h3 className="text-lg sm:text-xl lg:text-2xl font-semibold text-gray-900 flex items-center gap-2 mb-1 sm:mb-2">
                <FaCalendarAlt className="text-blue-600 text-lg sm:text-xl lg:text-2xl" />
                Leave Requests
              </h3>
              <p className="text-gray-600 text-sm sm:text-base">Create and manage employee leave requests</p>
            </div>

            {/* Add/Edit Leave Form */}
            <form
              onSubmit={editingLeave ? handleUpdateLeave : handleAddLeave}
              className="mb-4 sm:mb-6 p-3 sm:p-4 bg-blue-50 rounded-lg"
            >
              <h4 className="text-base sm:text-lg font-semibold text-gray-900 mb-3 sm:mb-4">
                {editingLeave ? 'Edit Leave Request' : 'Create New Leave Request'}
              </h4>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Employee <span className="text-red-500">*</span>
                    <span className="text-xs font-normal text-gray-500 ml-2">(Active employees only)</span>
                  </label>
                  <select
                    value={editingLeave ? editingLeave.employeeId : newLeave.employeeId}
                    onChange={(e) =>
                      editingLeave
                        ? setEditingLeave({ ...editingLeave, employeeId: e.target.value })
                        : setNewLeave({ ...newLeave, employeeId: e.target.value })
                    }
                    className="w-full p-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    required
                    disabled={isTerminated || editingLeave}
                  >
                    <option value="">Select active employee...</option>
                    {activeStaff.map((s) => (
                      <option key={s._id} value={s.employeeId}>
                        {s.firstName} {s.lastName || ''} ({s.employeeId}) - {s.department}
                      </option>
                    ))}
                  </select>
                  {activeStaff.length === 0 && (
                    <p className="mt-2 text-sm text-orange-600 bg-orange-50 p-2 rounded">
                      No active employees available. All staff may be terminated or inactive.
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Leave Type <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={editingLeave ? editingLeave.leaveType : newLeave.leaveType}
                    onChange={(e) =>
                      editingLeave
                        ? setEditingLeave({ ...editingLeave, leaveType: e.target.value })
                        : setNewLeave({ ...newLeave, leaveType: e.target.value })
                    }
                    className="w-full p-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    required
                    disabled={isTerminated}
                  >
                    <option value="Annual">Annual Leave</option>
                    <option value="Sick">Sick Leave</option>
                    <option value="Maternity">Maternity Leave</option>
                    <option value="Paternity">Paternity Leave</option>
                    <option value="Casual">Casual Leave</option>
                    <option value="Emergency">Emergency Leave</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Start Date <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={editingLeave ? editingLeave.startDate : newLeave.startDate}
                    onChange={(e) =>
                      editingLeave
                        ? setEditingLeave({ ...editingLeave, startDate: e.target.value })
                        : setNewLeave({ ...newLeave, startDate: e.target.value })
                    }
                    className="w-full p-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    required
                    disabled={isTerminated}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    End Date <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={editingLeave ? editingLeave.endDate : newLeave.endDate}
                    onChange={(e) =>
                      editingLeave
                        ? setEditingLeave({ ...editingLeave, endDate: e.target.value })
                        : setNewLeave({ ...newLeave, endDate: e.target.value })
                    }
                    className="w-full p-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    required
                    disabled={isTerminated}
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Reason <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    value={editingLeave ? editingLeave.reason : newLeave.reason}
                    onChange={(e) =>
                      editingLeave
                        ? setEditingLeave({ ...editingLeave, reason: e.target.value })
                        : setNewLeave({ ...newLeave, reason: e.target.value })
                    }
                    className="w-full p-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    rows="3"
                    placeholder="Enter reason for leave..."
                    required
                    disabled={isTerminated}
                  />
                </div>
              </div>

              <div className="flex gap-3 mt-4">
                <button
                  type="submit"
                  className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={isTerminated}
                >
                  <FaPlus /> {editingLeave ? 'Update Leave Request' : 'Create Leave Request'}
                </button>
                {editingLeave && (
                  <button
                    type="button"
                    onClick={() => setEditingLeave(null)}
                    className="px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors flex items-center gap-2 font-medium"
                    disabled={isTerminated}
                  >
                    <FaTimes /> Cancel
                  </button>
                )}
              </div>
            </form>

            {/* Leave Requests List - RESPONSIVE TABLE */}
            <div className="overflow-x-auto -mx-3 sm:mx-0">
              <table className="w-full min-w-[640px]">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-2 sm:px-4 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Employee
                    </th>
                    <th className="px-2 sm:px-4 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden sm:table-cell">
                      Type
                    </th>
                    <th className="px-2 sm:px-4 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Period
                    </th>
                    <th className="px-2 sm:px-4 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider max-w-xs hidden lg:table-cell">
                      Reason
                    </th>
                    <th className="px-2 sm:px-4 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-2 sm:px-4 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {leaveRequests && leaveRequests.length > 0 ? (
                    leaveRequests.map((leave) => {
                      const startDate = new Date(leave.startDate);
                      const endDate = new Date(leave.endDate);
                      const duration = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1;

                      return (
                        <tr key={leave._id} className="hover:bg-gray-50">
                          <td className="px-2 sm:px-4 py-3 sm:py-4">
                            <div className="text-xs sm:text-sm font-medium text-gray-900">
                              {leave.staffName || 'Unknown Staff'}
                            </div>
                            <div className="text-xs text-gray-500">
                              {leave.employeeId}
                            </div>
                            {/* Show type on mobile under name */}
                            <span className="sm:hidden mt-1 inline-block px-2 py-0.5 text-xs font-medium rounded-full bg-blue-100 text-blue-800">
                              {leave.leaveType || 'Annual'}
                            </span>
                          </td>
                          <td className="px-2 sm:px-4 py-3 sm:py-4 whitespace-nowrap hidden sm:table-cell">
                            <span className="px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-800">
                              {leave.leaveType || 'Annual'}
                            </span>
                          </td>
                          <td className="px-2 sm:px-4 py-3 sm:py-4">
                            <div className="text-xs text-gray-900">
                              {startDate.toLocaleDateString('en-US', {
                                month: 'short',
                                day: 'numeric',
                              })}
                              {' - '}
                              {endDate.toLocaleDateString('en-US', {
                                month: 'short',
                                day: 'numeric',
                              })}
                            </div>
                            <div className="text-xs text-gray-500 mt-0.5">{duration} day{duration > 1 ? 's' : ''}</div>
                          </td>
                          <td className="px-2 sm:px-4 py-3 sm:py-4 max-w-xs hidden lg:table-cell">
                            <div className="text-sm text-gray-900 break-words" title={leave.reason}>
                              {leave.reason.length > 50 ? `${leave.reason.substring(0, 50)}...` : leave.reason}
                            </div>
                          </td>
                          <td className="px-2 sm:px-4 py-3 sm:py-4 whitespace-nowrap">
                            <span
                              className={`px-2 sm:px-3 py-1 text-xs font-semibold rounded-full ${
                                leave.status === 'Approved'
                                  ? 'bg-green-100 text-green-800'
                                  : leave.status === 'Rejected'
                                  ? 'bg-red-100 text-red-800'
                                  : 'bg-yellow-100 text-yellow-800'
                              }`}
                            >
                              {leave.status || 'Pending'}
                            </span>
                          </td>
                          <td className="px-2 sm:px-4 py-3 sm:py-4">
                            {/* RESPONSIVE ACTION BUTTONS */}
                            <div className="flex flex-col gap-1.5 sm:gap-2">
                              {/* Show approve/reject buttons only for pending leaves */}
                              {(leave.status === 'Pending' || !leave.status) && (
                                <div className="flex gap-1 sm:gap-2">
                                  <button
                                    onClick={() => handleApproveLeave(leave._id, 'approve')}
                                    className="text-green-600 hover:text-green-900 px-2 sm:px-3 py-1 sm:py-1.5 hover:bg-green-50 rounded flex items-center gap-1 text-xs font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed border border-green-300"
                                    title="Approve leave"
                                    disabled={approvingLeave === leave._id || isTerminated}
                                  >
                                    {approvingLeave === leave._id ? (
                                      <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-green-600"></div>
                                    ) : (
                                      <>
                                        <FaCheck size={10} className="sm:w-3 sm:h-3" />
                                        <span className="hidden sm:inline">Approve</span>
                                      </>
                                    )}
                                  </button>
                                  <button
                                    onClick={() => handleApproveLeave(leave._id, 'reject')}
                                    className="text-red-600 hover:text-red-900 px-2 sm:px-3 py-1 sm:py-1.5 hover:bg-red-50 rounded flex items-center gap-1 text-xs font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed border border-red-300"
                                    title="Reject leave"
                                    disabled={approvingLeave === leave._id || isTerminated}
                                  >
                                    <FaTimes size={10} className="sm:w-3 sm:h-3" />
                                    <span className="hidden sm:inline">Reject</span>
                                  </button>
                                </div>
                              )}

                              <div className="flex gap-1 sm:gap-2">
                                <button
                                  onClick={() =>
                                    setEditingLeave({
                                      _id: leave._id,
                                      employeeId: leave.employeeId,
                                      startDate: leave.startDate.split('T')[0],
                                      endDate: leave.endDate.split('T')[0],
                                      reason: leave.reason || '',
                                      leaveType: leave.leaveType || 'Annual',
                                    })
                                  }
                                  className="text-blue-600 hover:text-blue-900 p-1.5 sm:px-3 sm:py-1.5 hover:bg-blue-50 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed border border-blue-300"
                                  title="Edit leave request"
                                  disabled={isTerminated || leave.status === 'Approved'}
                                >
                                  <FaEdit size={12} />
                                </button>
                                <button
                                  onClick={() => {
                                    if (window.confirm('Are you sure you want to delete this leave request?')) {
                                      deleteLeave(leave._id);
                                    }
                                  }}
                                  className="text-red-600 hover:text-red-900 p-1.5 sm:px-3 sm:py-1.5 hover:bg-red-50 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed border border-red-300"
                                  title="Delete leave request"
                                  disabled={isTerminated}
                                >
                                  <FaTrash size={12} />
                                </button>
                              </div>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan="6" className="px-6 py-8 text-center text-gray-500">
                        No leave requests found
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Info Box */}
            <div className="mt-6 p-4 bg-blue-50 border-l-4 border-blue-500 rounded">
              <div className="flex">
                <div className="flex-shrink-0">
                  <FaCalendarAlt className="h-5 w-5 text-blue-400" />
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-blue-800">Leave Request Information</h3>
                  <div className="mt-2 text-sm text-blue-700">
                    <ul className="list-disc list-inside space-y-1">
                      <li><strong>Pending:</strong> Leave request awaiting approval</li>
                      <li><strong>Approved:</strong> Leave approved - staff marked as on paid leave (no deductions)</li>
                      <li><strong>Rejected:</strong> Leave request declined</li>
                      <li><strong>Past Approval:</strong> Retroactively updates attendance records</li>
                      <li><strong>Future Approval:</strong> Prevents absence marking during leave period</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default HolidayLeave;