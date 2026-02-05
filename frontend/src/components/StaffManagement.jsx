// components/StaffManagement.jsx - Staff Management Interface
import React, { useState, useEffect } from 'react';
import { useTenant } from '../context/TenantProvider';
import {
  Plus, Search, Edit, Trash2, User, Mail, Phone, Briefcase,
  Calendar, CheckCircle, XCircle, AlertCircle, X, Save,
  Building, Users as UsersIcon, Eye, EyeOff, Key
} from 'lucide-react';

const StaffManagement = () => {
  const { makeRequest } = useTenant();
  
  // State
  const [staff, setStaff] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [positions, setPositions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState('add');
  const [currentStaff, setCurrentStaff] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  const [formData, setFormData] = useState({
    employeeCode: '',
    firstName: '',
    lastName: '',
    email: '',
    phoneNumber: '',
    department: '',
    position: '',
    dateOfEmployment: '',
    employmentType: 'full-time',
    status: 'active',
    kioskAccess: false,
    pin: ''
  });

  const [showPin, setShowPin] = useState(false);

  useEffect(() => {
    fetchStaff();
    fetchDepartments();
    fetchPositions();
  }, []);

  const fetchStaff = async () => {
    try {
      setLoading(true);
      const response = await makeRequest('/api/staff');
      const staffList = (response.data || response.staff || []).filter(
        s => !s.employeeId?.startsWith('CONFIG_')
      );
      setStaff(staffList);
      setError('');
    } catch (err) {
      console.error('Error fetching staff:', err);
      setError('Failed to load staff: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchDepartments = async () => {
    try {
      const response = await makeRequest('/api/staff/departments');
      setDepartments(response.departments || response.data || []);
    } catch (err) {
      console.error('Error fetching departments:', err);
    }
  };

  const fetchPositions = async () => {
    try {
      const response = await makeRequest('/api/staff/positions');
      setPositions(response.positions || response.data || []);
    } catch (err) {
      console.error('Error fetching positions:', err);
    }
  };

  const resetForm = () => {
    setFormData({
      employeeCode: '',
      firstName: '',
      lastName: '',
      email: '',
      phoneNumber: '',
      department: '',
      position: '',
      dateOfEmployment: '',
      employmentType: 'full-time',
      status: 'active'
    });
    setError('');
  };

  const handleOpenModal = (mode, staffMember = null) => {
    setModalMode(mode);
    setCurrentStaff(staffMember);
    setError('');
    setSuccess('');
    
    if (mode === 'edit' && staffMember) {
      // Handle object types for department and position
      const deptValue = typeof staffMember.department === 'object'
        ? staffMember.department?.name
        : staffMember.department;
      const posValue = typeof staffMember.position === 'object'
        ? staffMember.position?.name
        : staffMember.position;

      setFormData({
        employeeCode: staffMember.employeeId || '',
        firstName: staffMember.firstName || '',
        lastName: staffMember.lastName || '',
        email: staffMember.email || '',
        phoneNumber: staffMember.phoneNumber || '',
        department: deptValue || '',
        position: posValue || '',
        dateOfEmployment: staffMember.dateOfEmployment ?
          new Date(staffMember.dateOfEmployment).toISOString().split('T')[0] : '',
        employmentType: staffMember.employmentType || 'full-time',
        status: staffMember.status || 'active',
        kioskAccess: staffMember.kioskAccess || false,
        pin: '' // Don't pre-fill PIN for security reasons
      });
    } else {
      resetForm();
    }
    
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setCurrentStaff(null);
    resetForm();
  };
const validateForm = () => {
  // ✅ ADD THIS VALIDATION BLOCK
  if (!formData.employeeCode) {
    setError('Employee code is required');
    return false;
  }

  if (!/^\d{2,4}$/.test(formData.employeeCode)) {
    setError('Employee code must be 2-4 digits (00-9999)');
    return false;
  }

  const codeNum = parseInt(formData.employeeCode, 10);
  if (codeNum < 0 || codeNum > 9999) {
    setError('Employee code must be between 00 and 9999');
    return false;
  }

  if (!formData.firstName || !formData.lastName) {
    setError('First name and last name are required');
    return false;
  }

    if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      setError('Invalid email format');
      return false;
    }

    if (!formData.department || !formData.position) {
      setError('Department and position are required');
      return false;
    }

    if (!formData.dateOfEmployment) {
      setError('Employment date is required');
      return false;
    }

    // Kiosk Access validation
    if (formData.kioskAccess) {
      // For new staff or when PIN is being changed
      if (modalMode === 'add' || formData.pin) {
        if (!formData.pin) {
          setError('PIN is required for kiosk access');
          return false;
        }

        if (!/^\d{4,6}$/.test(formData.pin)) {
          setError('PIN must be 4-6 digits');
          return false;
        }

        // Check for repetitive patterns (1111, 111111, etc.)
        const isRepetitive = /^(\d)\1+$/.test(formData.pin);
        if (isRepetitive) {
          setError('PIN cannot be all the same digit');
          return false;
        }

        // Check for sequential patterns
        const digits = formData.pin.split('').map(Number);
        let isSequential = digits.length >= 3;
        let isReverseSequential = digits.length >= 3;

        for (let i = 1; i < digits.length; i++) {
          if (digits[i] !== digits[i - 1] + 1) isSequential = false;
          if (digits[i] !== digits[i - 1] - 1) isReverseSequential = false;
        }

        if (isSequential || isReverseSequential) {
          setError('PIN cannot be sequential (e.g., 1234 or 4321)');
          return false;
        }
      }
    }

    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) return;

    try {
      setError('');
      setLoading(true);

      let payload = {
        ...formData,
        employeeId: formData.employeeCode.padStart(4, '0') // Auto-pad to 4 digits (e.g., "1" → "0001")
      };
      

      if (modalMode === 'add') {
        await makeRequest('/api/staff', {
          method: 'POST',
          body: JSON.stringify(payload)
        });
        setSuccess('Staff member added successfully');
      } else if (modalMode === 'edit') {
        await makeRequest(`/api/staff/${currentStaff._id}`, {
          method: 'PUT',
          body: JSON.stringify(formData)
        });
        setSuccess('Staff member updated successfully');
      }

      await fetchStaff();
      handleCloseModal();
      
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      console.error('Error saving staff:', err);
      setError(err.message || 'Failed to save staff member');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (staffId, name) => {
    if (!window.confirm(`Are you sure you want to delete staff member "${name}"? This will also deactivate any linked user accounts.`)) {
      return;
    }

    try {
      setError('');
      setLoading(true);

      await makeRequest(`/api/staff/${staffId}`, {
        method: 'DELETE'
      });

      setSuccess('Staff member deleted successfully');
      await fetchStaff();

      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      console.error('Error deleting staff:', err);
      setError(err.message || 'Failed to delete staff member');
    } finally {
      setLoading(false);
    }
  };

  // Department Management
  const handleAddDepartment = async (name) => {
    try {
      setError('');
      await makeRequest('/api/staff/departments', {
        method: 'POST',
        body: JSON.stringify({ name })
      });
      setSuccess(`Department "${name}" added successfully`);
      await fetchDepartments();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      console.error('Error adding department:', err);
      setError(err.message || 'Failed to add department');
    }
  };

  const handleDeleteDepartment = async (name) => {
    if (!window.confirm(`Delete "${name}" department? This will also remove all associated positions.`)) {
      return;
    }

    try {
      setError('');
      await makeRequest(`/api/staff/departments/${name}`, {
        method: 'DELETE'
      });
      setSuccess(`Department "${name}" deleted successfully`);
      await fetchDepartments();
      await fetchPositions();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      console.error('Error deleting department:', err);
      setError(err.message || 'Failed to delete department');
    }
  };

  // Position Management
  const handleOpenPositionModal = () => {
    if (departments.length === 0) {
      setError('Please create at least one department first');
      return;
    }

    const name = prompt('Enter position name:');
    if (!name || !name.trim()) return;

    const department = prompt(`Select department for "${name}":\n${departments.map((d, i) => `${i + 1}. ${d.name}`).join('\n')}\n\nEnter department name:`);
    if (!department || !department.trim()) return;

    // Validate department exists
    const deptExists = departments.some(d => d.name.toLowerCase() === department.trim().toLowerCase());
    if (!deptExists) {
      setError('Invalid department. Please select from existing departments.');
      return;
    }

    handleAddPosition(name.trim(), department.trim());
  };

  const handleAddPosition = async (name, department) => {
    try {
      setError('');
      await makeRequest('/api/staff/positions', {
        method: 'POST',
        body: JSON.stringify({ name, department })
      });
      setSuccess(`Position "${name}" added successfully`);
      await fetchPositions();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      console.error('Error adding position:', err);
      setError(err.message || 'Failed to add position');
    }
  };

  const handleDeletePosition = async (name, department) => {
    if (!window.confirm(`Delete "${name}" position from ${department}?`)) {
      return;
    }

    try {
      setError('');
      await makeRequest(`/api/staff/positions/${name}/${department}`, {
        method: 'DELETE'
      });
      setSuccess(`Position "${name}" deleted successfully`);
      await fetchPositions();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      console.error('Error deleting position:', err);
      setError(err.message || 'Failed to delete position');
    }
  };

  const filteredStaff = staff.filter(s => {
    const matchesSearch =
      s.firstName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.lastName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.employeeId?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.email?.toLowerCase().includes(searchQuery.toLowerCase());

    // Handle both string and object department types
    const staffDept = typeof s.department === 'object' ? s.department?.name : s.department;
    const matchesDepartment = departmentFilter === 'all' || staffDept === departmentFilter;
    const matchesStatus = statusFilter === 'all' || s.status === statusFilter;

    return matchesSearch && matchesDepartment && matchesStatus;
  });

  const getStatusBadgeColor = (status) => {
    const colors = {
      active: 'bg-green-100 text-green-800',
      inactive: 'bg-gray-100 text-gray-800',
      terminated: 'bg-red-100 text-red-800'
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  if (loading && staff.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Staff Management</h2>
        <p className="text-gray-600 mt-1">Manage employee records for attendance and payroll integration</p>
      </div>

      {success && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-center">
          <CheckCircle className="w-5 h-5 text-green-600 mr-3" />
          <p className="text-green-700">{success}</p>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center">
          <AlertCircle className="w-5 h-5 text-red-600 mr-3" />
          <p className="text-red-700">{error}</p>
        </div>
      )}

      {/* Department & Position Management Panel */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-6 shadow-sm">
        <div className="flex items-center mb-4">
          <Building className="w-5 h-5 text-blue-600 mr-2" />
          <h3 className="text-lg font-semibold text-gray-900">Configuration</h3>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Departments Section */}
          <div className="bg-white rounded-lg p-4 border border-gray-200">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-semibold text-gray-900 uppercase">Departments</h4>
              <button
                onClick={() => {
                  const name = prompt('Enter department name:');
                  if (name && name.trim()) {
                    handleAddDepartment(name.trim());
                  }
                }}
                className="text-xs px-2 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
              >
                + Add
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {departments.length === 0 ? (
                <p className="text-xs text-gray-500">No departments yet</p>
              ) : (
                departments.map((dept) => {
                  // Handle both string and object name formats
                  const deptName = typeof dept.name === 'object' ? dept.name.name : dept.name;
                  return (
                    <div
                      key={dept._id}
                      className="inline-flex items-center px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-xs"
                    >
                      <span>{deptName}</span>
                      <button
                        onClick={() => handleDeleteDepartment(deptName)}
                        className="ml-2 text-blue-600 hover:text-blue-800"
                        title="Delete department"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Positions Section */}
          <div className="bg-white rounded-lg p-4 border border-gray-200">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-semibold text-gray-900 uppercase">Positions</h4>
              <button
                onClick={() => handleOpenPositionModal()}
                className="text-xs px-2 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
              >
                + Add
              </button>
            </div>
            <div className="space-y-2 max-h-32 overflow-y-auto">
              {positions.length === 0 ? (
                <p className="text-xs text-gray-500">No positions yet</p>
              ) : (
                positions.map((pos) => {
                  // Handle both string and object name formats
                  const posName = typeof pos.name === 'object' ? pos.name.name : pos.name;
                  const posDept = typeof pos.department === 'object' ? pos.department.name : pos.department;
                  return (
                    <div
                      key={pos._id}
                      className="flex items-center justify-between text-xs border-b border-gray-100 pb-1"
                    >
                      <div>
                        <span className="font-medium text-gray-900">{posName}</span>
                        <span className="text-gray-500 ml-2">({posDept})</span>
                      </div>
                      <button
                        onClick={() => handleDeletePosition(posName, posDept)}
                        className="text-red-600 hover:text-red-800"
                        title="Delete position"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Search staff..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          <select
            value={departmentFilter}
            onChange={(e) => setDepartmentFilter(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="all">All Departments</option>
            {departments.map(dept => {
              const deptName = typeof dept.name === 'object' ? dept.name.name : dept.name;
              return <option key={dept._id} value={deptName}>{deptName}</option>;
            })}
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="terminated">Terminated</option>
          </select>

          <button
            onClick={() => handleOpenModal('add')}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 whitespace-nowrap"
          >
            <Plus className="w-5 h-5" />
            Add Staff
          </button>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Employee</th>
                <th className="hidden md:table-cell px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Department</th>
                <th className="hidden lg:table-cell px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Position</th>
                <th className="hidden xl:table-cell px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Employment</th>
                <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="hidden sm:table-cell px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">User Account</th>
                <th className="px-3 sm:px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredStaff.length === 0 ? (
                <tr>
                  <td colSpan="7" className="px-3 sm:px-6 py-8 text-center text-gray-500 text-sm">
                    {searchQuery || departmentFilter !== 'all' || statusFilter !== 'all'
                      ? 'No staff found matching your filters'
                      : 'No staff members yet. Click "Add Staff" to create your first employee record.'}
                  </td>
                </tr>
              ) : (
                filteredStaff.map((staffMember) => (
                  <tr key={staffMember._id} className="hover:bg-gray-50">
                    <td className="px-3 sm:px-6 py-3 sm:py-4">
                      <div className="flex items-center">
                        <div className="flex-shrink-0 h-8 w-8 sm:h-10 sm:w-10 bg-blue-100 rounded-full flex items-center justify-center">
                          <User className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600" />
                        </div>
                        <div className="ml-2 sm:ml-4">
                          <div className="text-sm font-medium text-gray-900">
                            {staffMember.firstName} {staffMember.lastName}
                          </div>
                          <div className="text-xs text-gray-500">{staffMember.employeeId}</div>
                          {/* Show department on mobile */}
                          <div className="md:hidden text-xs text-gray-500 mt-1">
                            {typeof staffMember.department === 'object' ? staffMember.department?.name : staffMember.department || '-'}
                          </div>
                          {staffMember.email && (
                            <div className="hidden sm:flex text-xs text-gray-400 items-center gap-1 mt-1">
                              <Mail className="w-3 h-3" />
                              {staffMember.email}
                            </div>
                          )}
                          {staffMember.phoneNumber && (
                            <div className="hidden sm:flex text-xs text-gray-400 items-center gap-1">
                              <Phone className="w-3 h-3" />
                              {staffMember.phoneNumber}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="hidden md:table-cell px-6 py-4">
                      <div className="text-sm text-gray-900 flex items-center gap-2">
                        <Building className="w-4 h-4 text-gray-400" />
                        {typeof staffMember.department === 'object' ? staffMember.department?.name : staffMember.department || '-'}
                      </div>
                    </td>
                    <td className="hidden lg:table-cell px-6 py-4">
                      <div className="text-sm text-gray-900 flex items-center gap-2">
                        <Briefcase className="w-4 h-4 text-gray-400" />
                        {typeof staffMember.position === 'object' ? staffMember.position?.name : staffMember.position || '-'}
                      </div>
                    </td>
                    <td className="hidden xl:table-cell px-6 py-4">
                      <div className="text-sm text-gray-900">
                        {staffMember.employmentType?.replace('-', ' ') || 'Full-time'}
                      </div>
                      {staffMember.dateOfEmployment && (
                        <div className="text-xs text-gray-500 flex items-center gap-1 mt-1">
                          <Calendar className="w-3 h-3" />
                          {new Date(staffMember.dateOfEmployment).toLocaleDateString()}
                        </div>
                      )}
                    </td>
                    <td className="px-3 sm:px-6 py-3 sm:py-4">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusBadgeColor(staffMember.status)}`}>
                        {staffMember.status || 'active'}
                      </span>
                    </td>
                    <td className="hidden sm:table-cell px-6 py-4">
                      {staffMember.userId ? (
                        <span className="inline-flex items-center px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800" title="Has user account">
                          <CheckCircle className="w-3 h-3 mr-1" />
                          User Account
                        </span>
                      ) : staffMember.kioskAccess ? (
                        <span className="inline-flex items-center px-2 py-1 text-xs font-medium rounded-full bg-orange-100 text-orange-800" title="Kiosk access only">
                          <Key className="w-3 h-3 mr-1" />
                          Kiosk Only
                        </span>
                      ) : (
                        <span className="text-gray-400 text-xs">-</span>
                      )}
                    </td>
                    <td className="px-3 sm:px-6 py-3 sm:py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleOpenModal('edit', staffMember)}
                          className="text-blue-600 hover:text-blue-800 transition-colors p-1"
                          title="Edit staff"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(staffMember._id, `${staffMember.firstName} ${staffMember.lastName}`)}
                          className="text-red-600 hover:text-red-800 transition-colors p-1"
                          title="Delete staff"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-2 sm:p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[95vh] sm:max-h-[90vh] overflow-y-auto">
            <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-200 flex items-center justify-between sticky top-0 bg-white z-10">
              <h3 className="text-lg sm:text-xl font-semibold text-gray-900">
                {modalMode === 'add' ? 'Add New Staff Member' : 'Edit Staff Member'}
              </h3>
              <button
                onClick={handleCloseModal}
                className="text-gray-400 hover:text-gray-600 transition-colors p-1"
              >
                <X className="w-5 h-5 sm:w-6 sm:h-6" />
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="px-4 sm:px-6 py-4 space-y-4 sm:space-y-6">
                {error && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center">
                    <AlertCircle className="w-5 h-5 text-red-600 mr-3" />
                    <p className="text-red-700 text-sm">{error}</p>
                  </div>
                )}

{/* Employee Code Field */}
<div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
  <label className="block text-sm font-medium text-gray-700 mb-2">
    Employee Code * (2-4 digits: 00-9999)
  </label>
  <input
    type="text"
    value={formData.employeeCode || ''}
    onChange={(e) => {
      const value = e.target.value.replace(/\D/g, '').slice(0, 4);
      setFormData({ ...formData, employeeCode: value });
    }}
    maxLength="4"
    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
    required
    disabled={modalMode === 'edit'}
  />
 
</div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      First Name *
                    </label>
                    <input
                      type="text"
                      value={formData.firstName}
                      onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                      className="w-full px-3 sm:px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Last Name *
                    </label>
                    <input
                      type="text"
                      value={formData.lastName}
                      onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                      className="w-full px-3 sm:px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Email
                    </label>
                    <input
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="w-full px-3 sm:px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Phone
                    </label>
                    <input
                      type="tel"
                      value={formData.phoneNumber}
                      onChange={(e) => setFormData({ ...formData, phoneNumber: e.target.value })}
                      className="w-full px-3 sm:px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Department *
                    </label>
                    <select
                      value={formData.department}
                      onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                      className="w-full px-3 sm:px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      required
                    >
                      <option value="">Select Department</option>
                      {departments.map(dept => {
                        const deptName = typeof dept.name === 'object' ? dept.name.name : dept.name;
                        return <option key={dept._id} value={deptName}>{deptName}</option>;
                      })}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Position *
                    </label>
                    <select
                      value={formData.position}
                      onChange={(e) => setFormData({ ...formData, position: e.target.value })}
                      className="w-full px-3 sm:px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      required
                    >
                      <option value="">Select Position</option>
                      {positions
                        .filter(pos => {
                          const posDept = typeof pos.department === 'object' ? pos.department.name : pos.department;
                          return !formData.department || posDept === formData.department;
                        })
                        .map(pos => {
                          const posName = typeof pos.name === 'object' ? pos.name.name : pos.name;
                          return <option key={pos._id} value={posName}>{posName}</option>;
                        })}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Employment Date *
                    </label>
                    <input
                      type="date"
                      value={formData.dateOfEmployment}
                      onChange={(e) => setFormData({ ...formData, dateOfEmployment: e.target.value })}
                      className="w-full px-3 sm:px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Employment Type
                    </label>
                    <select
                      value={formData.employmentType}
                      onChange={(e) => setFormData({ ...formData, employmentType: e.target.value })}
                      className="w-full px-3 sm:px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="full-time">Full-Time</option>
                      <option value="part-time">Part-Time</option>
                      <option value="contractor">Contractor</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Status
                  </label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                    <option value="terminated">Terminated</option>
                  </select>
                </div>

                {/* Kiosk Access Section */}
                <div className="border-t border-gray-200 pt-6 mt-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <Key className="w-5 h-5 text-blue-600" />
                      <h4 className="text-sm font-semibold text-gray-900">Kiosk Access</h4>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.kioskAccess}
                        onChange={(e) => setFormData({ ...formData, kioskAccess: e.target.checked })}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                    </label>
                  </div>

                  {formData.kioskAccess && (
                    <div className="space-y-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
                      <p className="text-xs text-gray-600">
                        Enable this staff member to access kiosk applications (QuickSell POS, StockFlow Inventory)
                      </p>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Staff Code (for kiosk login)
                        </label>
                        <input
                          type="text"
                          value={modalMode === 'edit'
                            ? currentStaff?.employeeId
                            : (formData.employeeCode ? formData.employeeCode.padStart(4, '0') : 'Enter employee code above')}
                          disabled
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-100 text-gray-600 cursor-not-allowed"
                        />
                        <p className="text-xs text-gray-500 mt-1">
                          Staff will use this code along with PIN to login to kiosk
                        </p>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Kiosk PIN * (4-6 digits, no repetitive or sequential patterns)
                        </label>
                        <div className="relative">
                          <input
                            type={showPin ? 'text' : 'password'}
                            value={formData.pin}
                            onChange={(e) => {
                              const value = e.target.value.replace(/\D/g, '').slice(0, 6);
                              setFormData({ ...formData, pin: value });
                            }}
                            maxLength="6"
                            placeholder={modalMode === 'edit' ? 'Enter new PIN to change' : 'Enter 4-6 digit PIN'}
                            className="w-full px-4 py-2 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          />
                          <button
                            type="button"
                            onClick={() => setShowPin(!showPin)}
                            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                          >
                            {showPin ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                          </button>
                        </div>
                        {modalMode === 'edit' && currentStaff?.kioskAccess && (
                          <p className="text-xs text-gray-500 mt-1">
                            Leave empty to keep existing PIN unchanged
                          </p>
                        )}
                        <p className="text-xs text-red-600 mt-1">
                          ⚠️ Avoid: 1111, 123456, 654321, or similar patterns
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="px-4 sm:px-6 py-3 sm:py-4 border-t border-gray-200 flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2 sm:gap-3 sticky bottom-0 bg-white">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm sm:text-base"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm sm:text-base"
                >
                  <Save className="w-4 h-4" />
                  {modalMode === 'add' ? 'Add Staff' : 'Update Staff'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default StaffManagement;
