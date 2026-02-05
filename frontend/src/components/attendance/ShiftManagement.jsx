import React, { useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaEdit, FaTrash, FaPlus, FaTimes, FaCheck, FaCalendarAlt, FaClock } from 'react-icons/fa';
import { MdWork, MdAccessTime, MdPerson, MdCalendarToday } from 'react-icons/md';
import axios from 'axios';
import { AuthContext } from '../../context/AuthContext';

const API_BASE_URL = import.meta.env.VITE_API_URL;

const ShiftManagement = ({
  staff,
  shifts,
  shiftStaffFilter,
  setShiftStaffFilter,
  newShift,
  setNewShift,
  editingShift,
  setEditingShift,
  selectedStaff,
  setSelectedStaff,
  handleAddShift,
  handleDeleteShift,
  shiftPage,
  setShiftPage,
  shiftTotalPages,
  manualEntry,
  setManualEntry,
  handleManualEntry,
  loading,
  fetchShifts,
}) => {
  const { logout } = useContext(AuthContext);
  const navigate = useNavigate();

  const getAuthToken = () => {
    return localStorage.getItem('adminAuthToken') || localStorage.getItem('authToken');
  };

  const getAuthHeaders = () => ({
    Authorization: `Bearer ${getAuthToken()}`,
  });

  const [fullDaySelection, setFullDaySelection] = useState(null);
  const [halfDaySelections, setHalfDaySelections] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [bulkMode, setBulkMode] = useState(false);
  const [bulkSelectedStaff, setBulkSelectedStaff] = useState([]);

  // TEMPORARY SHIFTS STATE
  const [tempShifts, setTempShifts] = useState([]);
  const [showTempShiftModal, setShowTempShiftModal] = useState(false);
  const [showTempShiftList, setShowTempShiftList] = useState(false);
  const [tempShiftLoading, setTempShiftLoading] = useState(false);
  const [newTempShift, setNewTempShift] = useState({
    employeeId: '',
    startDate: '',
    endDate: '',
    resumptionTime: '',
    closingTime: '',
    isHalfDay: false,
    isFullDayReference: false,
    reason: ''
  });
  const [editingTempShift, setEditingTempShift] = useState(null);

  // Filter for active staff only
  const activeStaff = staff?.filter(s => s.status === 'active') || [];

  // Fetch temporary shifts
  const fetchTempShifts = async () => {
    try {
      setTempShiftLoading(true);
      const response = await axios.get(`${API_BASE_URL}/api/attendance/temporary-shifts`, {
        headers: getAuthHeaders(),
        params: { includeExpired: 'false' }
      });
      setTempShifts(response.data.shifts || []);
    } catch (err) {
      console.error('Error fetching temporary shifts:', err);
    } finally {
      setTempShiftLoading(false);
    }
  };

  useEffect(() => {
    fetchTempShifts();
  }, []);

  // Create temporary shift
  const handleCreateTempShift = async (e) => {
    e.preventDefault();
    
    if (!newTempShift.employeeId || !newTempShift.startDate || !newTempShift.endDate || 
        !newTempShift.resumptionTime || !newTempShift.closingTime) {
      alert('Please fill all required fields');
      return;
    }

    try {
      setTempShiftLoading(true);
      await axios.post(`${API_BASE_URL}/api/attendance/temporary-shifts`, newTempShift, {
        headers: getAuthHeaders()
      });
      
      // Reset form
      setNewTempShift({
        employeeId: '',
        startDate: '',
        endDate: '',
        resumptionTime: '',
        closingTime: '',
        isHalfDay: false,
        isFullDayReference: false,
        reason: ''
      });
      
      // Refresh list
      await fetchTempShifts();
      setShowTempShiftModal(false);
      alert('Temporary shift created successfully!');
    } catch (err) {
      console.error('Error creating temporary shift:', err);
      alert(err.response?.data?.message || 'Failed to create temporary shift');
    } finally {
      setTempShiftLoading(false);
    }
  };

  // Update temporary shift
  const handleUpdateTempShift = async (e) => {
    e.preventDefault();
    
    if (!editingTempShift) return;

    try {
      setTempShiftLoading(true);
      await axios.put(
        `${API_BASE_URL}/api/attendance/temporary-shifts/${editingTempShift._id}`, 
        editingTempShift,
        { headers: getAuthHeaders() }
      );
      
      setEditingTempShift(null);
      await fetchTempShifts();
      alert('Temporary shift updated successfully!');
    } catch (err) {
      console.error('Error updating temporary shift:', err);
      alert(err.response?.data?.message || 'Failed to update temporary shift');
    } finally {
      setTempShiftLoading(false);
    }
  };

  // Delete temporary shift
  const handleDeleteTempShift = async (shiftId) => {
    if (!window.confirm('Are you sure you want to delete this temporary shift?')) {
      return;
    }

    try {
      setTempShiftLoading(true);
      await axios.delete(`${API_BASE_URL}/api/attendance/temporary-shifts/${shiftId}`, {
        headers: getAuthHeaders()
      });
      
      await fetchTempShifts();
      alert('Temporary shift deleted successfully!');
    } catch (err) {
      console.error('Error deleting temporary shift:', err);
      alert('Failed to delete temporary shift');
    } finally {
      setTempShiftLoading(false);
    }
  };

  // Helper function to sort shifts by day of week
  const sortShiftsByDay = (shifts) => {
    const dayOrder = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    return [...shifts].sort((a, b) => {
      return dayOrder.indexOf(a.dayOfWeek) - dayOrder.indexOf(b.dayOfWeek);
    });
  };

  // Check if staff already has a full day reference shift
  const checkExistingFullDayReference = () => {
    if (!selectedStaff || !shifts) {
      return false;
    }
    
    const staffShifts = shifts.filter(shift => {
      if (!shift) return false;
      
      let shiftStaffId;
      if (shift.staffId === null || shift.staffId === undefined) {
        shiftStaffId = null;
      } else if (typeof shift.staffId === 'object') {
        shiftStaffId = shift.staffId?._id;
      } else {
        shiftStaffId = shift.staffId;
      }
      
      return (shiftStaffId === selectedStaff._id || shift.employeeId === selectedStaff.employeeId);
    });
    
    const fullDayShifts = staffShifts.filter(shift => shift.isFullDayReference === true);
    
    return fullDayShifts.length > 0;
  };

  const getStaffWithShifts = () => {
    if (!staff || !Array.isArray(staff)) return [];
    
    let filteredStaff = activeStaff;
    if (shiftStaffFilter) {
      filteredStaff = activeStaff.filter(s => s.employeeId === shiftStaffFilter);
    }
    
    return filteredStaff.map(staffMember => {
      const staffShifts = shifts?.filter(shift => {
        if (!shift) return false;
        
        let shiftStaffId;
        if (shift.staffId === null || shift.staffId === undefined) {
          shiftStaffId = null;
        } else if (typeof shift.staffId === 'object') {
          shiftStaffId = shift.staffId?._id;
        } else {
          shiftStaffId = shift.staffId;
        }
        
        return shiftStaffId === staffMember._id || shift.employeeId === staffMember.employeeId;
      }) || [];
      
      return {
        ...staffMember,
        shifts: sortShiftsByDay(staffShifts)
      };
    });
  };

  const getShiftConflicts = () => {
    if (!newShift.selectedDays?.length || !selectedStaff || !shifts) return [];
    
    return newShift.selectedDays.map((day) => {
      const existingShift = shifts.find((s) => {
        if (!s) return false;
        
        let shiftStaffId;
        if (s.staffId === null || s.staffId === undefined) {
          shiftStaffId = null;
        } else if (typeof s.staffId === 'object') {
          shiftStaffId = s.staffId?._id;
        } else {
          shiftStaffId = s.staffId;
        }
        
        return (shiftStaffId === selectedStaff._id || s.employeeId === selectedStaff.employeeId) && 
               s.dayOfWeek === day;
      });
      
      return { day, existingShift };
    });
  };

  const handleEditShiftClick = (shift) => {
    const staffMember = activeStaff.find((s) => {
      if (!shift) return false;
      
      let shiftStaffId;
      if (shift.staffId === null || shift.staffId === undefined) {
        shiftStaffId = null;
      } else if (typeof shift.staffId === 'object') {
        shiftStaffId = shift.staffId?._id;
      } else {
        shiftStaffId = shift.staffId;
      }
      
      return s._id === shiftStaffId || s.employeeId === shift.employeeId;
    });
    
    if (!staffMember) {
      return;
    }

    const staffShifts = shifts.filter((s) => {
      if (!s) return false;
      
      let shiftStaffId;
      if (s.staffId === null || s.staffId === undefined) {
        shiftStaffId = null;
      } else if (typeof s.staffId === 'object') {
        shiftStaffId = s.staffId?._id;
      } else {
        shiftStaffId = s.staffId;
      }
      
      return (shiftStaffId === staffMember._id || s.employeeId === staffMember.employeeId) &&
             s.resumptionTime === shift.resumptionTime && 
             s.closingTime === shift.closingTime;
    });

    const fullDayShift = staffShifts.find(s => s.isFullDayReference);
    const halfDayShiftDays = staffShifts.filter(s => s.isHalfDay).map(s => s.dayOfWeek);
    
    setFullDaySelection(fullDayShift?.dayOfWeek || null);
    setHalfDaySelections(halfDayShiftDays);

    setEditingShift(shift);
    setNewShift({
      employeeId: staffMember.employeeId,
      selectedDays: staffShifts.map((s) => s.dayOfWeek),
      resumptionTime: shift.resumptionTime,
      closingTime: shift.closingTime,
    });
    setSelectedStaff(staffMember);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleAddShiftWithFlags = async (e) => {
    e.preventDefault();

    if (!fullDaySelection && !checkExistingFullDayReference()) {
      alert('Please select one day as "Full Day Reference" for payroll rate calculation');
      return;
    }

    try {
      setIsSubmitting(true);

      // Build all shifts and send as single bulk request
      const shifts = newShift.selectedDays.map(dayOfWeek => ({
        employeeId: newShift.employeeId,
        dayOfWeek,
        resumptionTime: newShift.resumptionTime,
        closingTime: newShift.closingTime,
        isFullDayReference: dayOfWeek === fullDaySelection,
        isHalfDay: halfDaySelections.includes(dayOfWeek)
      }));

      const token = getAuthToken();
      const response = await axios.post(`${API_BASE_URL}/api/attendance/shifts/bulk`, { shifts }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      setFullDaySelection(null);
      setHalfDaySelections([]);
      setNewShift({ employeeId: '', selectedDays: [], resumptionTime: '', closingTime: '' });
      setSelectedStaff(null);
      setEditingShift(null);

      if (fetchShifts) await fetchShifts();

      const msg = response.data?.message || `Created shifts for ${shifts.length} day(s)`;
      alert(`${msg}`);
    } catch (err) {
      console.error('Error creating shifts:', err);
      alert(err.response?.data?.message || 'Failed to create shifts');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBulkAssignShifts = async (e) => {
    e.preventDefault();

    if (bulkSelectedStaff.length === 0) {
      alert('Please select at least one staff member');
      return;
    }

    if (!newShift.selectedDays?.length || !newShift.resumptionTime || !newShift.closingTime) {
      alert('Please fill in days and times');
      return;
    }

    if (!fullDaySelection) {
      alert('Please select one day as "Full Day Reference" for payroll rate calculation');
      return;
    }

    try {
      setIsSubmitting(true);

      // Build shifts for all selected staff x all selected days
      const shifts = [];
      for (const staffMember of bulkSelectedStaff) {
        for (const dayOfWeek of newShift.selectedDays) {
          shifts.push({
            employeeId: staffMember.employeeId,
            dayOfWeek,
            resumptionTime: newShift.resumptionTime,
            closingTime: newShift.closingTime,
            isFullDayReference: dayOfWeek === fullDaySelection,
            isHalfDay: halfDaySelections.includes(dayOfWeek)
          });
        }
      }

      const token = getAuthToken();
      const response = await axios.post(`${API_BASE_URL}/api/attendance/shifts/bulk`, { shifts }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      setFullDaySelection(null);
      setHalfDaySelections([]);
      setNewShift({ employeeId: '', selectedDays: [], resumptionTime: '', closingTime: '' });
      setBulkSelectedStaff([]);
      setSelectedStaff(null);
      setEditingShift(null);

      if (fetchShifts) await fetchShifts();

      const msg = response.data?.message || `Assigned shifts for ${bulkSelectedStaff.length} staff member(s)`;
      alert(msg);
    } catch (err) {
      console.error('Error bulk assigning shifts:', err);
      alert(err.response?.data?.message || 'Failed to assign shifts');
    } finally {
      setIsSubmitting(false);
    }
  };

  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  const daysShort = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  return (
    <div className="space-y-4 sm:space-y-6 max-w-7xl mx-auto px-2 sm:px-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <h2 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900">Shift Management</h2>
          <p className="text-gray-500 text-sm sm:text-base mt-1">Create and manage employee work schedules</p>
        </div>
      </div>
      
      {/* REGULAR SHIFT FORM */}
      <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl sm:rounded-2xl shadow-lg sm:shadow-xl border border-blue-100 overflow-hidden">
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-4 sm:px-6 py-3 sm:py-4">
          <h3 className="text-base sm:text-lg lg:text-xl font-semibold text-white flex items-center gap-2">
            <MdWork className="text-xl sm:text-2xl" />
            {editingShift ? 'Edit Shift Schedule' : 'Create New Shift Schedule'}
          </h3>
        </div>

        <form onSubmit={bulkMode ? handleBulkAssignShifts : handleAddShiftWithFlags} className="p-3 sm:p-4 lg:p-6 space-y-4 sm:space-y-6">
          {/* Mode Toggle */}
          <div className="flex items-center gap-3 bg-white rounded-xl p-4 shadow-sm border border-gray-200">
            <button
              type="button"
              onClick={() => {
                setBulkMode(false);
                setBulkSelectedStaff([]);
              }}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                !bulkMode ? 'bg-blue-600 text-white shadow-md' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              Single Staff
            </button>
            <button
              type="button"
              onClick={() => {
                setBulkMode(true);
                setSelectedStaff(null);
                setNewShift(prev => ({ ...prev, employeeId: '' }));
              }}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                bulkMode ? 'bg-blue-600 text-white shadow-md' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              Bulk Assign
            </button>
            {bulkMode && (
              <span className="text-xs text-blue-600 font-medium ml-2">
                Assign the same shift to multiple staff at once
              </span>
            )}
          </div>

          {/* Employee Selection */}
          <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-200">
            {!bulkMode ? (
              <>
                <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-3">
                  <MdPerson className="text-blue-600 text-lg" />
                  Select Employee <span className="text-red-500">*</span>
                  <span className="text-xs font-normal text-gray-500 ml-2">(Active employees only)</span>
                </label>
                <select
                  value={newShift.employeeId}
                  onChange={(e) => {
                    const selected = activeStaff?.find((s) => s.employeeId === e.target.value);
                    setNewShift({ ...newShift, employeeId: e.target.value });
                    setSelectedStaff(selected || null);
                    setFullDaySelection(null);
                    setHalfDaySelections([]);
                  }}
                  className="w-full p-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                  required
                >
                  <option value="">Choose an employee...</option>
                  {activeStaff?.map((s) => (
                    <option key={s._id} value={s.employeeId}>
                      {s.firstName} {s.lastName || ''} • {s.employeeId} • {s.department} - {s.position}
                    </option>
                  ))}
                </select>
              </>
            ) : (
              <>
                <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-3">
                  <MdPerson className="text-blue-600 text-lg" />
                  Select Staff Members <span className="text-red-500">*</span>
                  <span className="text-xs font-normal text-gray-500 ml-2">({bulkSelectedStaff.length} selected)</span>
                </label>
                {/* Quick actions */}
                <div className="flex gap-2 mb-3">
                  <button
                    type="button"
                    onClick={() => setBulkSelectedStaff([...activeStaff])}
                    className="px-3 py-1.5 text-xs font-medium bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 border border-blue-200 transition-colors"
                  >
                    Select All
                  </button>
                  <button
                    type="button"
                    onClick={() => setBulkSelectedStaff([])}
                    className="px-3 py-1.5 text-xs font-medium bg-gray-50 text-gray-700 rounded-lg hover:bg-gray-100 border border-gray-200 transition-colors"
                  >
                    Clear All
                  </button>
                </div>
                {/* Staff checkboxes */}
                <div className="max-h-60 overflow-y-auto border-2 border-gray-200 rounded-lg p-2 space-y-1">
                  {activeStaff?.map((s) => {
                    const isSelected = bulkSelectedStaff.some(bs => bs.employeeId === s.employeeId);
                    return (
                      <label
                        key={s._id}
                        className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-all ${
                          isSelected ? 'bg-blue-50 border border-blue-200' : 'hover:bg-gray-50 border border-transparent'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setBulkSelectedStaff(prev => [...prev, s]);
                            } else {
                              setBulkSelectedStaff(prev => prev.filter(bs => bs.employeeId !== s.employeeId));
                            }
                          }}
                          className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                        />
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                            {s.firstName.charAt(0)}{s.lastName?.charAt(0) || ''}
                          </div>
                          <div className="min-w-0">
                            <span className="text-sm font-medium text-gray-900 block truncate">
                              {s.firstName} {s.lastName || ''}
                            </span>
                            <span className="text-xs text-gray-500 block truncate">
                              {s.employeeId} • {s.department} - {s.position}
                            </span>
                          </div>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </>
            )}

            {activeStaff.length === 0 && (
              <p className="mt-2 text-sm text-orange-600 bg-orange-50 p-2 rounded">
                No active employees available. All staff may be terminated or inactive.
              </p>
            )}

            {!bulkMode && selectedStaff && (
              <div className="mt-4 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border-l-4 border-blue-500">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center text-white font-bold text-lg shadow-md">
                    {selectedStaff.firstName.charAt(0)}{selectedStaff.lastName?.charAt(0) || ''}
                  </div>
                  <div>
                    <h4 className="font-semibold text-gray-900">
                      {selectedStaff.firstName} {selectedStaff.lastName || ''}
                    </h4>
                    <p className="text-sm text-gray-600">
                      {selectedStaff.department} • {selectedStaff.position}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Time Selection - Side by Side */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-200">
              <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-3">
                <MdAccessTime className="text-green-600 text-lg" />
                Resumption Time <span className="text-red-500">*</span>
              </label>
              <input
                type="time"
                value={newShift.resumptionTime}
                onChange={(e) => setNewShift({ ...newShift, resumptionTime: e.target.value })}
                className="w-full p-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all text-lg font-semibold"
                required
              />
            </div>
            <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-200">
              <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-3">
                <MdAccessTime className="text-red-600 text-lg" />
                Closing Time <span className="text-red-500">*</span>
              </label>
              <input
                type="time"
                value={newShift.closingTime}
                onChange={(e) => setNewShift({ ...newShift, closingTime: e.target.value })}
                className="w-full p-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-all text-lg font-semibold"
                required
              />
            </div>
          </div>

          {/* Days Selection - COMPACT GRID LAYOUT */}
          <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-200">
            <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-3">
              <MdCalendarToday className="text-purple-600 text-lg" />
              Select Working Days & Configure Types <span className="text-red-500">*</span>
            </label>
            
            {/* Info Banner */}
            <div className="bg-blue-50 border-l-4 border-blue-500 p-3 mb-4 rounded">
              <p className="text-xs text-blue-800">
                <strong>💡 Quick Guide:</strong> Select days → Mark ONE as "Full Day Reference" (for payroll) → Optionally mark days as "Half Day"
              </p>
              {checkExistingFullDayReference() && (
                <p className="text-xs text-green-700 mt-2 font-semibold">
                  ✅ This staff already has a Full Day Reference shift. You can add half-days without selecting full day reference.
                </p>
              )}
            </div>
            
            {/* Compact Grid Layout for Days */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {days.map((day, index) => {
                const isDaySelected = newShift.selectedDays?.includes(day) || false;
                const isFullDay = fullDaySelection === day;
                const isHalfDay = halfDaySelections.includes(day);
                
                return (
                  <div 
                    key={day} 
                    className={`relative border-2 rounded-lg p-3 transition-all ${
                      isDaySelected 
                        ? 'border-blue-500 bg-blue-50 shadow-md' 
                        : 'border-gray-200 bg-white hover:border-gray-300'
                    }`}
                  >
                    {/* Day Checkbox */}
                    <label className="flex items-center gap-2 cursor-pointer mb-2">
                      <input
                        type="checkbox"
                        checked={isDaySelected}
                        onChange={(e) => {
                          const currentDays = newShift.selectedDays || [];
                          const newDays = e.target.checked
                            ? [...currentDays, day]
                            : currentDays.filter((d) => d !== day);
                          setNewShift({ ...newShift, selectedDays: newDays });
                          
                          if (!e.target.checked) {
                            if (fullDaySelection === day) setFullDaySelection(null);
                            setHalfDaySelections(prev => prev.filter(d => d !== day));
                          }
                        }}
                        className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                      />
                      <span className="font-semibold text-gray-900 text-sm">{daysShort[index]}</span>
                    </label>
                    
                    {/* Type Selectors - Compact */}
                    {isDaySelected && (
                      <div className="space-y-1.5 pl-7">
                        {/* Full Day Radio */}
                        <label className={`flex items-center gap-1.5 cursor-pointer text-xs px-2 py-1 rounded transition-all ${
                          isFullDay ? 'bg-green-100 font-semibold' : 'hover:bg-gray-100'
                        }`}>
                          <input
                            type="radio"
                            name="fullDayReference"
                            checked={isFullDay}
                            onChange={() => setFullDaySelection(day)}
                            className="w-3.5 h-3.5 text-green-600 focus:ring-green-500"
                          />
                          <span className={isFullDay ? 'text-green-700' : 'text-gray-600'}>
                            🟢 Full
                          </span>
                        </label>
                        
                        {/* Half Day Checkbox */}
                        <label className={`flex items-center gap-1.5 cursor-pointer text-xs px-2 py-1 rounded transition-all ${
                          isHalfDay ? 'bg-orange-100 font-semibold' : 'hover:bg-gray-100'
                        }`}>
                          <input
                            type="checkbox"
                            checked={isHalfDay}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setHalfDaySelections(prev => [...prev, day]);
                              } else {
                                setHalfDaySelections(prev => prev.filter(d => d !== day));
                              }
                            }}
                            className="w-3.5 h-3.5 text-orange-600 border-gray-300 rounded focus:ring-orange-500"
                          />
                          <span className={isHalfDay ? 'text-orange-700' : 'text-gray-600'}>
                            🔸 Half
                          </span>
                        </label>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            
            {/* Status Messages - Compact */}
            <div className="mt-4 space-y-2">
              {newShift.selectedDays?.length > 0 && !fullDaySelection && !checkExistingFullDayReference() && (
                <div className="bg-red-50 border-l-4 border-red-500 p-2 rounded text-xs text-red-700 flex items-center gap-2">
                  <span>⚠️</span>
                  <span><strong>Required:</strong> Select one "Full Day Reference" for payroll calculations</span>
                </div>
              )}
              
              {(fullDaySelection || (checkExistingFullDayReference() && newShift.selectedDays?.length > 0)) && (
                <div className="bg-green-50 border-l-4 border-green-500 p-2 rounded text-xs text-green-700 flex items-center gap-2">
                  <span>✅</span>
                  <span>
                    {fullDaySelection && <><strong>{fullDaySelection}</strong> set as Full Day Reference</>}
                    {!fullDaySelection && checkExistingFullDayReference() && <>Full Day Reference already exists</>}
                    {halfDaySelections.length > 0 && ` • ${halfDaySelections.length} half-day(s) configured`}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Schedule Preview & Conflicts - Compact */}
          {newShift.selectedDays?.length > 0 && newShift.resumptionTime && newShift.closingTime && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Preview */}
              <div className="bg-gradient-to-br from-green-50 to-emerald-50 border-l-4 border-green-500 rounded-lg p-4">
                <h4 className="font-semibold text-green-900 text-sm mb-2 flex items-center gap-2">
                  <FaCheck className="text-green-600" /> Schedule Preview
                </h4>
                <p className="text-sm text-gray-700">
                  <span className="font-semibold">{newShift.selectedDays.length} days:</span> {newShift.selectedDays.join(', ')}
                </p>
                <p className="text-sm text-gray-700 mt-1">
                  <span className="font-semibold">Time:</span> {newShift.resumptionTime} - {newShift.closingTime}
                </p>
                {fullDaySelection && (
                  <p className="text-xs text-green-700 mt-2 font-semibold">
                    🟢 Full Day: {fullDaySelection}
                  </p>
                )}
                {halfDaySelections.length > 0 && (
                  <p className="text-xs text-orange-700 mt-1 font-semibold">
                    🔸 Half Days: {halfDaySelections.join(', ')}
                  </p>
                )}
              </div>

              {/* Conflicts */}
              {newShift.employeeId && (
                <div className="bg-yellow-50 border-l-4 border-yellow-500 rounded-lg p-4">
                  <h4 className="font-semibold text-yellow-900 text-sm mb-2">⚡ Conflict Check</h4>
                  <div className="space-y-1 max-h-24 overflow-y-auto">
                    {getShiftConflicts().map(({ day, existingShift }) => (
                      <p key={day} className={`text-xs ${existingShift ? 'text-yellow-700' : 'text-green-700'}`}>
                        <strong>{day}:</strong> {existingShift ? `⚠️ Will replace ${existingShift.resumptionTime}-${existingShift.closingTime}` : '✓ Clear'}
                      </p>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              className="flex-1 px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg hover:from-blue-700 hover:to-indigo-700 transition-all flex items-center justify-center gap-2 font-semibold shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={
                loading ||
                isSubmitting ||
                !newShift.selectedDays?.length ||
                (!fullDaySelection && !bulkMode && !checkExistingFullDayReference()) ||
                (bulkMode && bulkSelectedStaff.length === 0) ||
                (!bulkMode && !newShift.employeeId)
              }
            >
              {isSubmitting ? (
                <>
                  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                  </svg>
                  Processing...
                </>
              ) : loading ? (
                <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                </svg>
              ) : (
                <FaPlus />
              )}
              {editingShift ? 'Update Schedule' : bulkMode ? `Assign to ${bulkSelectedStaff.length} Staff` : 'Create Schedule'}
            </button>
            {editingShift && (
              <button
                type="button"
                onClick={() => {
                  setEditingShift(null);
                  setNewShift({ employeeId: '', selectedDays: [], resumptionTime: '', closingTime: '' });
                  setSelectedStaff(null);
                  setFullDaySelection(null);
                  setHalfDaySelections([]);
                }}
                className="px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-all flex items-center gap-2 font-semibold shadow-lg"
                disabled={isSubmitting}
              >
                <FaTimes /> Cancel
              </button>
            )}
          </div>
        </form>
      </div>

      {/* STAFF SCHEDULE VIEW */}
      <div className="bg-white rounded-xl shadow-lg overflow-hidden">
        <div className="bg-gradient-to-r from-purple-600 to-pink-600 px-6 py-4">
          <h3 className="text-xl font-semibold text-white flex items-center gap-2">
            <MdCalendarToday className="text-2xl" />
            Staff Schedules Overview
          </h3>
        </div>
        
        <div className="p-6">
          {/* Filter */}
          <div className="mb-4">
            <select
              value={shiftStaffFilter}
              onChange={(e) => setShiftStaffFilter(e.target.value)}
              className="w-full md:w-64 p-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
            >
              <option value="">All Active Staff</option>
              {activeStaff?.map((s) => (
                <option key={s._id} value={s.employeeId}>
                  {s.firstName} {s.lastName || ''} ({s.employeeId})
                </option>
              ))}
            </select>
          </div>

          {/* Staff Cards */}
          <div className="space-y-4">
            {getStaffWithShifts().map((staffMember) => (
              <div key={staffMember._id} className="border-2 border-gray-200 rounded-xl p-5 hover:border-blue-300 transition-all">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-600 rounded-full flex items-center justify-center text-white font-bold">
                      {staffMember.firstName.charAt(0)}{staffMember.lastName?.charAt(0) || ''}
                    </div>
                    <div>
                      <h4 className="font-semibold text-gray-900">
                        {staffMember.firstName} {staffMember.lastName || ''}
                      </h4>
                      <p className="text-xs text-gray-500">
                        {staffMember.employeeId} • {staffMember.department}
                      </p>
                    </div>
                  </div>
                  <span className="text-sm font-medium text-gray-600">
                    {staffMember.shifts.length} shift{staffMember.shifts.length !== 1 ? 's' : ''}
                  </span>
                </div>

                {staffMember.shifts.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                    {staffMember.shifts.map((shift) => (
                      <div
                        key={shift._id}
                        className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-lg p-3 border border-gray-200"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-semibold text-sm text-gray-900">{shift.dayOfWeek}</span>
                          <div className="flex gap-1">
                            {shift.isFullDayReference && (
                              <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-semibold">
                                Full
                              </span>
                            )}
                            {shift.isHalfDay && (
                              <span className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full font-semibold">
                                Half
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-1 text-xs text-gray-600 mb-2">
                          <MdAccessTime />
                          <span>{shift.resumptionTime} - {shift.closingTime}</span>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleEditShiftClick(shift)}
                            className="flex-1 px-2 py-1 bg-blue-500 text-white rounded text-xs hover:bg-blue-600 transition-colors flex items-center justify-center gap-1"
                          >
                            <FaEdit /> Edit
                          </button>
                          <button
                            onClick={() => handleDeleteShift(shift._id)}
                            className="flex-1 px-2 py-1 bg-red-500 text-white rounded text-xs hover:bg-red-600 transition-colors flex items-center justify-center gap-1"
                          >
                            <FaTrash /> Delete
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500 text-center py-4">No shifts assigned</p>
                )}
              </div>
            ))}
            
            {getStaffWithShifts().length === 0 && (
              <div className="text-center py-8 bg-gray-50 rounded-lg">
                <MdPerson className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                <p className="text-gray-500 text-lg">No active staff with shifts</p>
                <p className="text-gray-400">Assign shifts to active employees above</p>
              </div>
            )}
          </div>

          {/* Pagination */}
          {shiftTotalPages > 1 && (
            <div className="flex justify-center gap-2 mt-6">
              <button
                onClick={() => setShiftPage(Math.max(1, shiftPage - 1))}
                disabled={shiftPage === 1}
                className="px-4 py-2 border-2 border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors"
              >
                Previous
              </button>
              <span className="px-4 py-2 font-semibold text-gray-700">
                Page {shiftPage} of {shiftTotalPages}
              </span>
              <button
                onClick={() => setShiftPage(Math.min(shiftTotalPages, shiftPage + 1))}
                disabled={shiftPage === shiftTotalPages}
                className="px-4 py-2 border-2 border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors"
              >
                Next
              </button>
            </div>
          )}
        </div>
      </div>

      {/* NEW SECTION: TEMPORARY SHIFT SCHEDULE */}
      <div className="bg-gradient-to-br from-orange-50 to-amber-50 rounded-2xl shadow-xl border border-orange-200 overflow-hidden">
        <div className="bg-gradient-to-r from-orange-600 to-amber-600 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FaCalendarAlt className="text-2xl text-white" />
            <h3 className="text-xl font-semibold text-white">Temporary Shift Schedule</h3>
          </div>
          <button
            onClick={() => setShowTempShiftList(true)}
            className="px-4 py-2 bg-white text-orange-600 rounded-lg hover:bg-orange-50 transition-colors text-sm font-medium flex items-center gap-2"
          >
            <FaCalendarAlt /> View All ({tempShifts.length})
          </button>
        </div>
        
        <div className="p-6">
          <div className="bg-blue-50 border-l-4 border-blue-500 p-4 mb-6 rounded">
            <p className="text-sm text-blue-800">
              <strong>📌 What are Temporary Shifts?</strong><br/>
              Override regular shifts for specific date ranges. Perfect for temporary schedule changes, special projects, or coverage periods.
              Temporary shifts automatically expire after the end date but remain in records.
            </p>
          </div>

          <button
            onClick={() => setShowTempShiftModal(true)}
            className="w-full md:w-auto px-6 py-3 bg-gradient-to-r from-orange-600 to-amber-600 text-white rounded-lg hover:from-orange-700 hover:to-amber-700 transition-all font-semibold shadow-lg flex items-center justify-center gap-2"
          >
            <FaPlus /> Create Temporary Shift
          </button>

          {/* Active Temporary Shifts Summary */}
          {tempShifts.length > 0 && (
            <div className="mt-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {tempShifts.slice(0, 3).map((shift) => (
                <div key={shift._id} className="bg-white rounded-lg p-4 border-2 border-orange-200 hover:border-orange-400 transition-all">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-semibold text-gray-900 text-sm">{shift.staffName}</span>
                    {shift.isFullDayReference && (
                      <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">Full</span>
                    )}
                  </div>
                  <div className="text-xs text-gray-600 space-y-1">
                    <p><FaCalendarAlt className="inline mr-1" /> {shift.startDate} to {shift.endDate}</p>
                    <p><FaClock className="inline mr-1" /> {shift.resumptionTime} - {shift.closingTime}</p>
                    {shift.reason && <p className="text-gray-500 italic">"{shift.reason}"</p>}
                  </div>
                </div>
              ))}
            </div>
          )}

          {tempShifts.length === 0 && (
            <div className="mt-6 text-center py-8 bg-white rounded-lg border-2 border-dashed border-orange-300">
              <FaCalendarAlt className="mx-auto h-12 w-12 text-orange-400 mb-4" />
              <p className="text-gray-500">No active temporary shifts</p>
              <p className="text-gray-400 text-sm">Create one to override regular schedules</p>
            </div>
          )}
        </div>
      </div>

      {/* TEMPORARY SHIFT CREATE/EDIT MODAL */}
      {showTempShiftModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="bg-gradient-to-r from-orange-600 to-amber-600 px-6 py-4 flex items-center justify-between sticky top-0">
              <h3 className="text-xl font-semibold text-white flex items-center gap-2">
                <FaCalendarAlt /> {editingTempShift ? 'Edit' : 'Create'} Temporary Shift
              </h3>
              <button
                onClick={() => {
                  setShowTempShiftModal(false);
                  setEditingTempShift(null);
                  setNewTempShift({
                    employeeId: '',
                    startDate: '',
                    endDate: '',
                    resumptionTime: '',
                    closingTime: '',
                    isHalfDay: false,
                    isFullDayReference: false,
                    reason: ''
                  });
                }}
                className="text-white hover:bg-white hover:bg-opacity-20 rounded-full p-2 transition-colors"
              >
                <FaTimes size={20} />
              </button>
            </div>

            <form onSubmit={editingTempShift ? handleUpdateTempShift : handleCreateTempShift} className="p-6 space-y-6">
              {/* Employee Selection */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Employee <span className="text-red-500">*</span>
                </label>
                <select
                  value={editingTempShift ? editingTempShift.employeeId : newTempShift.employeeId}
                  onChange={(e) => editingTempShift 
                    ? setEditingTempShift({ ...editingTempShift, employeeId: e.target.value })
                    : setNewTempShift({ ...newTempShift, employeeId: e.target.value })}
                  className="w-full p-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                  required
                  disabled={!!editingTempShift}
                >
                  <option value="">Select active employee...</option>
                  {activeStaff?.map((s) => (
                    <option key={s._id} value={s.employeeId}>
                      {s.firstName} {s.lastName || ''} ({s.employeeId})
                    </option>
                  ))}
                </select>
              </div>

              {/* Date Range */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Start Date <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={editingTempShift ? editingTempShift.startDate : newTempShift.startDate}
                    onChange={(e) => editingTempShift 
                      ? setEditingTempShift({ ...editingTempShift, startDate: e.target.value })
                      : setNewTempShift({ ...newTempShift, startDate: e.target.value })}
                    className="w-full p-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    End Date <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={editingTempShift ? editingTempShift.endDate : newTempShift.endDate}
                    onChange={(e) => editingTempShift 
                      ? setEditingTempShift({ ...editingTempShift, endDate: e.target.value })
                      : setNewTempShift({ ...newTempShift, endDate: e.target.value })}
                    className="w-full p-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                    required
                  />
                </div>
              </div>

              {/* Time Range */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Resumption Time <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="time"
                    value={editingTempShift ? editingTempShift.resumptionTime : newTempShift.resumptionTime}
                    onChange={(e) => editingTempShift 
                      ? setEditingTempShift({ ...editingTempShift, resumptionTime: e.target.value })
                      : setNewTempShift({ ...newTempShift, resumptionTime: e.target.value })}
                    className="w-full p-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Closing Time <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="time"
                    value={editingTempShift ? editingTempShift.closingTime : newTempShift.closingTime}
                    onChange={(e) => editingTempShift 
                      ? setEditingTempShift({ ...editingTempShift, closingTime: e.target.value })
                      : setNewTempShift({ ...newTempShift, closingTime: e.target.value })}
                    className="w-full p-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                    required
                  />
                </div>
              </div>

              {/* Shift Type Flags */}
              <div className="space-y-3">
                <label className="flex items-center gap-3 p-3 bg-green-50 border-2 border-green-200 rounded-lg cursor-pointer hover:bg-green-100 transition-colors">
                  <input
                    type="checkbox"
                    checked={editingTempShift ? editingTempShift.isFullDayReference : newTempShift.isFullDayReference}
                    onChange={(e) => editingTempShift 
                      ? setEditingTempShift({ ...editingTempShift, isFullDayReference: e.target.checked })
                      : setNewTempShift({ ...newTempShift, isFullDayReference: e.target.checked })}
                    className="w-5 h-5 text-green-600 rounded focus:ring-green-500"
                  />
                  <div>
                    <span className="font-semibold text-green-900">Full Day Reference</span>
                    <p className="text-xs text-green-700">Use this shift for payroll rate calculations</p>
                  </div>
                </label>

                <label className="flex items-center gap-3 p-3 bg-orange-50 border-2 border-orange-200 rounded-lg cursor-pointer hover:bg-orange-100 transition-colors">
                  <input
                    type="checkbox"
                    checked={editingTempShift ? editingTempShift.isHalfDay : newTempShift.isHalfDay}
                    onChange={(e) => editingTempShift 
                      ? setEditingTempShift({ ...editingTempShift, isHalfDay: e.target.checked })
                      : setNewTempShift({ ...newTempShift, isHalfDay: e.target.checked })}
                    className="w-5 h-5 text-orange-600 rounded focus:ring-orange-500"
                  />
                  <div>
                    <span className="font-semibold text-orange-900">Half Day Shift</span>
                    <p className="text-xs text-orange-700">50% deduction for absences on this shift</p>
                  </div>
                </label>
              </div>

              {/* Reason */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Reason (Optional)
                </label>
                <textarea
                  value={editingTempShift ? editingTempShift.reason : newTempShift.reason}
                  onChange={(e) => editingTempShift 
                    ? setEditingTempShift({ ...editingTempShift, reason: e.target.value })
                    : setNewTempShift({ ...newTempShift, reason: e.target.value })}
                  className="w-full p-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                  rows="3"
                  placeholder="e.g., Special project, temporary coverage, schedule adjustment..."
                />
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 pt-4 border-t">
                <button
                  type="submit"
                  className="flex-1 px-6 py-3 bg-gradient-to-r from-orange-600 to-amber-600 text-white rounded-lg hover:from-orange-700 hover:to-amber-700 transition-all font-semibold shadow-lg flex items-center justify-center gap-2 disabled:opacity-50"
                  disabled={tempShiftLoading}
                >
                  {tempShiftLoading ? (
                    <>
                      <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                      </svg>
                      Processing...
                    </>
                  ) : (
                    <>
                      <FaCheck /> {editingTempShift ? 'Update' : 'Create'} Temporary Shift
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowTempShiftModal(false);
                    setEditingTempShift(null);
                  }}
                  className="px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-all font-semibold"
                  disabled={tempShiftLoading}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* TEMPORARY SHIFT LIST MODAL */}
      {showTempShiftList && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-6xl w-full max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="bg-gradient-to-r from-orange-600 to-amber-600 px-6 py-4 flex items-center justify-between sticky top-0">
              <h3 className="text-xl font-semibold text-white flex items-center gap-2">
                <FaCalendarAlt /> All Temporary Shifts ({tempShifts.length})
              </h3>
              <button
                onClick={() => setShowTempShiftList(false)}
                className="text-white hover:bg-white hover:bg-opacity-20 rounded-full p-2 transition-colors"
              >
                <FaTimes size={20} />
              </button>
            </div>

            <div className="p-6">
              {tempShiftLoading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600"></div>
                </div>
              ) : tempShifts.length === 0 ? (
                <div className="text-center py-12">
                  <FaCalendarAlt className="mx-auto h-16 w-16 text-gray-400 mb-4" />
                  <p className="text-gray-500 text-lg">No temporary shifts found</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Employee</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date Range</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Time</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Reason</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {tempShifts.map((shift) => (
                        <tr key={shift._id} className="hover:bg-gray-50">
                          <td className="px-4 py-4 whitespace-nowrap">
                            <div className="text-sm font-medium text-gray-900">{shift.staffName}</div>
                            <div className="text-xs text-gray-500">{shift.employeeId}</div>
                          </td>
                          <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                            {shift.startDate} to {shift.endDate}
                          </td>
                          <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                            {shift.resumptionTime} - {shift.closingTime}
                          </td>
                          <td className="px-4 py-4 whitespace-nowrap">
                            <div className="flex gap-1">
                              {shift.isFullDayReference && (
                                <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">Full</span>
                              )}
                              {shift.isHalfDay && (
                                <span className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full">Half</span>
                              )}
                              {!shift.isFullDayReference && !shift.isHalfDay && (
                                <span className="text-xs text-gray-500">Regular</span>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-4 text-sm text-gray-600 max-w-xs truncate">
                            {shift.reason || '-'}
                          </td>
                          <td className="px-4 py-4 whitespace-nowrap text-right text-sm font-medium">
                            <div className="flex justify-end gap-2">
                              <button
                                onClick={() => {
                                  setEditingTempShift(shift);
                                  setShowTempShiftList(false);
                                  setShowTempShiftModal(true);
                                }}
                                className="text-blue-600 hover:text-blue-900 p-2 hover:bg-blue-50 rounded"
                                title="Edit"
                              >
                                <FaEdit />
                              </button>
                              <button
                                onClick={() => handleDeleteTempShift(shift._id)}
                                className="text-red-600 hover:text-red-900 p-2 hover:bg-red-50 rounded"
                                title="Delete"
                              >
                                <FaTrash />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MANUAL ATTENDANCE */}
      <div className="bg-gradient-to-br from-red-50 to-pink-50 rounded-2xl shadow-xl border border-red-200 overflow-hidden">
        <div className="bg-gradient-to-r from-red-600 to-pink-600 px-6 py-4">
          <h3 className="text-xl font-semibold text-white flex items-center gap-2">
            <MdWork className="text-2xl" />
            Manual Attendance Entry
          </h3>
        </div>
        
        <div className="p-6">
          <form onSubmit={handleManualEntry} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-white rounded-lg p-4 border border-gray-200">
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Employee <span className="text-red-500">*</span>
                  <span className="text-xs font-normal text-gray-500 ml-2">(Active only)</span>
                </label>
                <select
                  value={manualEntry.employeeId}
                  onChange={(e) => setManualEntry({ ...manualEntry, employeeId: e.target.value })}
                  className="w-full p-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
                  required
                >
                  <option value="">Select active employee...</option>
                  {activeStaff?.map((s) => (
                    <option key={s._id} value={s.employeeId}>
                      {s.firstName} {s.lastName || ''} ({s.employeeId})
                    </option>
                  ))}
                </select>
              </div>
              <div className="bg-white rounded-lg p-4 border border-gray-200">
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Entry Type <span className="text-red-500">*</span>
                </label>
                <select
                  value={manualEntry.type}
                  onChange={(e) => setManualEntry({ ...manualEntry, type: e.target.value })}
                  className="w-full p-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
                  required
                >
                  <option value="in">Clock In</option>
                  <option value="out">Clock Out</option>
                </select>
              </div>
              <div className="bg-white rounded-lg p-4 border border-gray-200">
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Date <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={manualEntry.date}
                  onChange={(e) => setManualEntry({ ...manualEntry, date: e.target.value })}
                  className="w-full p-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
                  required
                />
              </div>
              <div className="bg-white rounded-lg p-4 border border-gray-200">
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Time <span className="text-red-500">*</span>
                </label>
                <input
                  type="time"
                  value={manualEntry.time}
                  onChange={(e) => setManualEntry({ ...manualEntry, time: e.target.value })}
                  className="w-full p-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
                  required
                />
              </div>
            </div>
            <button
              type="submit"
              className="w-full md:w-auto px-8 py-3 bg-gradient-to-r from-red-600 to-pink-600 text-white rounded-lg hover:from-red-700 hover:to-pink-700 transition-all font-semibold shadow-lg flex items-center justify-center gap-2"
            >
              <FaPlus /> Submit Manual Entry
            </button>
          </form>
        </div>
      </div>

      {/* NEW SECTION: ATTENDANCE RECALCULATION TOOL */}
      <div className="bg-gradient-to-br from-cyan-50 to-blue-50 rounded-2xl shadow-xl border border-cyan-200 overflow-hidden">
        <div className="bg-gradient-to-r from-cyan-600 to-blue-600 px-6 py-4">
          <h3 className="text-xl font-semibold text-white flex items-center gap-2">
            <FaCalendarAlt className="text-2xl" />
            Attendance Recalculation Tool
          </h3>
          <p className="text-cyan-50 text-sm mt-1">Recalculate attendance records for a custom date range</p>
        </div>
        
        <div className="p-6">
          <div className="bg-blue-50 border-l-4 border-blue-500 p-4 mb-6 rounded">
            <p className="text-sm text-blue-800">
              <strong>📌 What does this do?</strong><br/>
              This tool will recalculate attendance for the selected date range:
            </p>
            <ul className="text-sm text-blue-700 mt-2 space-y-1 ml-4">
              <li>✅ Updates existing records (recalculates late/early leave/overtime)</li>
              <li>✅ Creates missing absence records for staff with shifts</li>
              <li>✅ Respects temporary shifts (priority over regular)</li>
              <li>✅ Honors approved leaves (paid leave - no deductions)</li>
              <li>✅ Skips holidays and Sundays automatically</li>
              <li>✅ Preserves manual entries</li>
            </ul>
          </div>

          <RecalculationForm
            title="Recalculate Attendance Records"
            endpoint={`${import.meta.env.VITE_API_URL}/api/attendance/recalculate`}
            buttonText="Recalculate Attendance"
            buttonColor="from-cyan-600 to-blue-600"
            confirmMessage="This will update existing attendance records and create missing absences for the selected date range. Continue?"
            loading={loading}
          />
        </div>
      </div>
    </div>
  );
};

// Reusable Recalculation Form Component
const RecalculationForm = ({ title, endpoint, buttonText, buttonColor, confirmMessage, loading }) => {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!startDate || !endDate) {
      alert('Please select both start and end dates');
      return;
    }

    if (new Date(endDate) < new Date(startDate)) {
      alert('End date cannot be before start date');
      return;
    }

    if (!window.confirm(confirmMessage)) {
      return;
    }

    try {
      setIsProcessing(true);
      setResult(null);

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getAuthToken()}`
        },
        body: JSON.stringify({ startDate, endDate })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Recalculation failed');
      }

      setResult({
        success: true,
        message: data.message,
        details: data
      });

      alert(`✅ ${data.message}\n\nProcessing in background. Check server logs for progress.`);

    } catch (err) {
      console.error('Recalculation error:', err);
      setResult({
        success: false,
        message: err.message
      });
      alert(`❌ Error: ${err.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Start Date <span className="text-red-500">*</span>
          </label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="w-full p-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500"
            required
            disabled={loading || isProcessing}
          />
        </div>
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            End Date <span className="text-red-500">*</span>
          </label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="w-full p-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500"
            required
            disabled={loading || isProcessing}
          />
        </div>
      </div>

      <button
        type="submit"
        disabled={loading || isProcessing || !startDate || !endDate}
        className={`w-full md:w-auto px-8 py-3 bg-gradient-to-r ${buttonColor} text-white rounded-lg hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-all font-semibold shadow-lg flex items-center justify-center gap-2`}
      >
        {isProcessing ? (
          <>
            <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
            </svg>
            Processing...
          </>
        ) : (
          <>
            <FaCalendarAlt /> {buttonText}
          </>
        )}
      </button>

      {result && (
        <div className={`mt-4 p-4 rounded-lg border-l-4 ${result.success ? 'bg-green-50 border-green-500' : 'bg-red-50 border-red-500'}`}>
          <p className={`text-sm font-semibold ${result.success ? 'text-green-800' : 'text-red-800'}`}>
            {result.success ? '✅ Success!' : '❌ Error'}
          </p>
          <p className={`text-sm mt-1 ${result.success ? 'text-green-700' : 'text-red-700'}`}>
            {result.message}
          </p>
        </div>
      )}
    </form>
  );
};

export default ShiftManagement;