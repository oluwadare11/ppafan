// components/UserManagement.jsx - Modern User Management with Stunning UI
import React, { useState, useEffect } from 'react';
import { useTenant } from '../context/TenantProvider';
import {
  Plus, Search, Edit, Trash2, User, Mail, Phone, Shield,
  CheckCircle, XCircle, AlertCircle, X, Save, Key, RefreshCw,
  Users as UsersIcon, Briefcase, Eye, EyeOff, Sparkles, Crown,
  UserPlus, ChevronRight, Lock, Unlock, Fingerprint, Hash
} from 'lucide-react';
// Tier config removed - single tenant Pump House ERP

const UserManagement = () => {
  const { makeRequest, tenantInfo } = useTenant();

  // State
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [accessTypeFilter, setAccessTypeFilter] = useState('all');
  const [showModal, setShowModal] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showPinModal, setShowPinModal] = useState(false);
  const [modalMode, setModalMode] = useState('add');
  const [currentUser, setCurrentUser] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showPin, setShowPin] = useState(false);

  // Form state - simplified for Pump House ERP (admin users only, no kiosk creation here)
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    username: '',
    email: '',
    phone: '',
    password: '',
    role: 'admin',
    status: 'active',
    permissions: {
      dashboard: false,
      inventory: false,
      pos: false,
      accounting: false,
      customer: false,
      attendance: false, // Also covers Staff Management
      payroll: false,
      analytics: false,
      settings: false // Covers both Settings page and User Management
    }
  });

  // Password/PIN reset forms
  const [resetPasswordData, setResetPasswordData] = useState({ newPassword: '', confirmPassword: '' });
  const [resetPinData, setResetPinData] = useState({ newPin: '', confirmPin: '' });

  // Admin user limit (fixed at 5 for Pump House ERP)
  const MAX_ADMIN_USERS = 5;
  const adminUserCount = users.filter(u => u.role === 'admin' || u.role === 'custom').length;
  const isAtLimit = adminUserCount >= MAX_ADMIN_USERS;
  const remainingSlots = Math.max(0, MAX_ADMIN_USERS - adminUserCount);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const response = await makeRequest('/api/users');
      setUsers(response.users || []);
      setError('');
    } catch (err) {
      console.error('Error fetching users:', err);
      setError('Failed to load users: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      firstName: '', lastName: '', username: '', email: '', phone: '',
      password: '', role: 'admin', status: 'active',
      permissions: {
        dashboard: false, inventory: false, pos: false, accounting: false,
        customer: false, attendance: false, payroll: false, analytics: false, settings: false
      }
    });
    setError('');
  };

  const handleOpenModal = (mode, user = null) => {
    setModalMode(mode);
    setCurrentUser(user);
    setError('');
    setSuccess('');

    if (mode === 'edit' && user) {
      // For kiosk users, don't allow editing in User Management (only PIN reset)
      if (user.accessType === 'kiosk_only') {
        setCurrentUser(user);
        setShowModal(false); // Don't open edit modal for kiosk users
        return;
      }

      // Map old permissions to new structure
      const oldPerms = user.permissions || {};
      setFormData({
        firstName: user.firstName || '', lastName: user.lastName || '',
        username: user.username || '', email: user.email || '',
        phone: user.phone || '', password: '', role: user.role || 'admin',
        status: user.status || 'active',
        permissions: {
          dashboard: oldPerms.dashboard || false,
          inventory: oldPerms.inventory || false,
          pos: oldPerms.pos || false,
          accounting: oldPerms.accounting || false,
          customer: oldPerms.customer || oldPerms.crm || false,
          attendance: oldPerms.attendance || oldPerms.staffManagement || false,
          payroll: oldPerms.payroll || false,
          analytics: oldPerms.analytics || false,
          settings: oldPerms.settings || oldPerms.settingsAccess || oldPerms.userManagement || false
        }
      });
    } else {
      resetForm();
    }
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setCurrentUser(null);
    resetForm();
  };

  // Simplified validation - only for admin users (no kiosk fields)
  const validateForm = () => {
    if (!formData.firstName || !formData.lastName || !formData.username || !formData.email) {
      setError('First name, last name, username, and email are required');
      return false;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      setError('Invalid email format');
      return false;
    }
    // For custom role, at least one permission must be enabled
    if (formData.role === 'custom') {
      const hasPermission = Object.values(formData.permissions).some(val => val === true);
      if (!hasPermission) {
        setError('Custom role requires at least one module permission to be enabled');
        return false;
      }
    }
    // Password validation for new users
    if (modalMode === 'add' && !formData.password) {
      setError('Password is required');
      return false;
    }
    if (formData.password) {
      if (formData.password.length < 8) {
        setError('Password must be at least 8 characters');
        return false;
      }
      if (!/[A-Z]/.test(formData.password)) {
        setError('Password must contain at least one uppercase letter');
        return false;
      }
      if (!/[a-z]/.test(formData.password)) {
        setError('Password must contain at least one lowercase letter');
        return false;
      }
      if (!/[0-9]/.test(formData.password)) {
        setError('Password must contain at least one number');
        return false;
      }
    }
    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    if (modalMode === 'add' && isAtLimit) {
      setError(`Admin user limit reached (${MAX_ADMIN_USERS} max). Delete an existing admin to add a new one.`);
      return;
    }

    try {
      setError('');
      setLoading(true);

      // Build payload - all users created here are admin_only
      const payload = {
        firstName: formData.firstName,
        lastName: formData.lastName,
        username: formData.username,
        email: formData.email,
        phone: formData.phone || undefined,
        role: formData.role,
        accessType: 'admin_only', // Always admin_only for users created in User Management
        status: formData.status,
        permissions: formData.role === 'custom' ? formData.permissions : {}
      };

      if (modalMode === 'add') {
        payload.password = formData.password;
        await makeRequest('/api/users', { method: 'POST', body: JSON.stringify(payload) });
        setSuccess('User created successfully');
      } else {
        await makeRequest(`/api/users/${currentUser._id}`, { method: 'PUT', body: JSON.stringify(payload) });
        setSuccess('User updated successfully');
      }

      await fetchUsers();
      handleCloseModal();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      console.error('Error saving user:', err);
      setError(err.message || 'Failed to save user');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (userId, username) => {
    if (!window.confirm(`Are you sure you want to delete user "${username}"?`)) return;
    try {
      setError('');
      setLoading(true);
      await makeRequest(`/api/users/${userId}`, { method: 'DELETE' });
      setSuccess('User deleted successfully');
      await fetchUsers();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      console.error('Error deleting user:', err);
      setError(err.message || 'Failed to delete user');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    if (!resetPasswordData.newPassword || !resetPasswordData.confirmPassword) {
      setError('Both password fields are required');
      return;
    }
    if (resetPasswordData.newPassword !== resetPasswordData.confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    if (resetPasswordData.newPassword.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }
    try {
      setError('');
      setLoading(true);
      await makeRequest(`/api/users/${currentUser._id}/reset-password`, {
        method: 'PUT',
        body: JSON.stringify({ newPassword: resetPasswordData.newPassword })
      });
      setSuccess('Password reset successfully');
      setShowPasswordModal(false);
      setResetPasswordData({ newPassword: '', confirmPassword: '' });
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      console.error('Error resetting password:', err);
      setError(err.message || 'Failed to reset password');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPin = async (e) => {
    e.preventDefault();
    if (!resetPinData.newPin || !resetPinData.confirmPin) {
      setError('Both PIN fields are required');
      return;
    }
    if (resetPinData.newPin !== resetPinData.confirmPin) {
      setError('PINs do not match');
      return;
    }
    if (!/^\d{4,6}$/.test(resetPinData.newPin)) {
      setError('PIN must be 4-6 digits');
      return;
    }
    try {
      setError('');
      setLoading(true);
      await makeRequest(`/api/users/${currentUser._id}/reset-pin`, {
        method: 'PUT',
        body: JSON.stringify({ newPin: resetPinData.newPin })
      });
      setSuccess('PIN reset successfully');
      setShowPinModal(false);
      setResetPinData({ newPin: '', confirmPin: '' });
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      console.error('Error resetting PIN:', err);
      setError(err.message || 'Failed to reset PIN');
    } finally {
      setLoading(false);
    }
  };

  // Filtered users
  const filteredUsers = users.filter(u => {
    const searchLower = searchQuery.toLowerCase();
    const matchesSearch =
      (u.firstName?.toLowerCase() || '').includes(searchLower) ||
      (u.lastName?.toLowerCase() || '').includes(searchLower) ||
      (u.username?.toLowerCase() || '').includes(searchLower) ||
      (u.email?.toLowerCase() || '').includes(searchLower) ||
      (u.employeeCode || '').includes(searchQuery);
    const matchesRole = roleFilter === 'all' || u.role === roleFilter;
    const matchesAccessType = accessTypeFilter === 'all' || u.accessType === accessTypeFilter;
    return matchesSearch && matchesRole && matchesAccessType;
  });

  const getRoleBadge = (role) => {
    const badges = {
      admin: { bg: 'bg-purple-100', text: 'text-purple-700', icon: Crown },
      custom: { bg: 'bg-blue-100', text: 'text-blue-700', icon: Shield }
    };
    return badges[role] || { bg: 'bg-gray-100', text: 'text-gray-700', icon: User };
  };

  const getAccessTypeBadge = (accessType) => {
    const badges = {
      admin_only: { label: 'Admin', bg: 'bg-indigo-100', text: 'text-indigo-700', icon: Lock },
      kiosk_only: { label: 'Kiosk', bg: 'bg-amber-100', text: 'text-amber-700', icon: Fingerprint },
      both: { label: 'Full Access', bg: 'bg-emerald-100', text: 'text-emerald-700', icon: Unlock }
    };
    return badges[accessType] || badges.admin_only;
  };

  const getStatusBadge = (status) => {
    const colors = {
      active: 'bg-green-100 text-green-700',
      inactive: 'bg-gray-100 text-gray-600',
      suspended: 'bg-red-100 text-red-700'
    };
    return colors[status] || 'bg-gray-100 text-gray-600';
  };

  if (loading && users.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="relative">
            <div className="w-16 h-16 border-4 border-indigo-200 rounded-full animate-spin border-t-indigo-600 mx-auto"></div>
            <UsersIcon className="w-6 h-6 text-indigo-600 absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2" />
          </div>
          <p className="mt-4 text-gray-600 font-medium">Loading users...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-100 rounded-xl">
              <UsersIcon className="w-6 h-6 text-indigo-600" />
            </div>
            <div>
              <h2 className="text-xl sm:text-2xl font-bold text-gray-900">User Management</h2>
              <p className="text-gray-500 text-sm">Manage accounts & permissions</p>
            </div>
          </div>
        </div>
        <button
          onClick={() => handleOpenModal('add')}
          disabled={isAtLimit}
          className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-xl transition-all font-medium ${
            isAtLimit
              ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
              : 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white hover:from-indigo-700 hover:to-purple-700 shadow-lg shadow-indigo-500/25'
          }`}
          title={isAtLimit ? 'Admin user limit reached' : 'Add new admin user'}
        >
          <UserPlus className="w-5 h-5" />
          <span>Add Admin</span>
        </button>
      </div>

      {/* Messages */}
      {success && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center gap-3 animate-in slide-in-from-top duration-300">
          <div className="p-1 bg-emerald-100 rounded-lg">
            <CheckCircle className="w-5 h-5 text-emerald-600" />
          </div>
          <p className="text-emerald-700 font-medium">{success}</p>
        </div>
      )}

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-2xl flex items-start gap-3 animate-in slide-in-from-top duration-300">
          <div className="p-1 bg-red-100 rounded-lg">
            <AlertCircle className="w-5 h-5 text-red-600" />
          </div>
          <div className="flex-1">
            <p className="text-red-700 font-medium">{error}</p>
          </div>
          <button onClick={() => setError('')} className="text-red-400 hover:text-red-600">
            <X className="w-5 h-5" />
          </button>
        </div>
      )}

      {/* Admin User Limit Card */}
      <div className="relative overflow-hidden bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 rounded-2xl p-6 text-white shadow-xl">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -mr-32 -mt-32"></div>
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/10 rounded-full -ml-24 -mb-24"></div>

        <div className="relative z-10">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <Sparkles className="w-5 h-5" />
                <span className="text-sm font-semibold uppercase tracking-wider opacity-90">
                  Admin Users
                </span>
              </div>
              <h3 className="text-2xl font-bold mb-1">
                {adminUserCount} / {MAX_ADMIN_USERS} Admin Users
              </h3>
              <p className="text-white/80 text-sm">
                Kiosk users are unlimited
              </p>
            </div>

            {/* Progress Ring */}
            <div className="relative w-20 h-20">
              <svg className="w-20 h-20 transform -rotate-90">
                <circle cx="40" cy="40" r="35" stroke="rgba(255,255,255,0.2)" strokeWidth="6" fill="none" />
                <circle
                  cx="40" cy="40" r="35"
                  stroke="white"
                  strokeWidth="6"
                  fill="none"
                  strokeLinecap="round"
                  strokeDasharray={`${(adminUserCount / MAX_ADMIN_USERS) * 220} 220`}
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-lg font-bold">{remainingSlots}</span>
              </div>
            </div>
          </div>

          {isAtLimit && (
            <div className="mt-4 pt-4 border-t border-white/20">
              <p className="text-white/90 text-sm">
                Admin limit reached. Delete an existing admin to add a new one.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
        <div className="flex flex-col lg:flex-row gap-3">
          {/* Search */}
          <div className="flex-1 relative">
            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search by name, email, or code..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-11 pr-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-gray-50 focus:bg-white transition-all"
            />
          </div>

          <div className="flex gap-3">
            {/* Role Filter */}
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-gray-50 focus:bg-white appearance-none min-w-[130px]"
            >
              <option value="all">All Roles</option>
              <option value="admin">Admin</option>
              <option value="custom">Custom</option>
            </select>

            {/* Access Filter */}
            <select
              value={accessTypeFilter}
              onChange={(e) => setAccessTypeFilter(e.target.value)}
              className="px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-gray-50 focus:bg-white appearance-none min-w-[140px]"
            >
              <option value="all">All Access</option>
              <option value="admin_only">Admin Only</option>
              <option value="kiosk_only">Kiosk Only</option>
              <option value="both">Both</option>
            </select>
          </div>
        </div>
      </div>

      {/* Users List - Card Layout for Mobile, Table for Desktop */}
      <div className="space-y-4">
        {filteredUsers.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-12 text-center">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <UsersIcon className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-1">No users found</h3>
            <p className="text-gray-500">
              {searchQuery || roleFilter !== 'all' || accessTypeFilter !== 'all'
                ? 'Try adjusting your filters'
                : 'Click "Add User" to create your first user'}
            </p>
          </div>
        ) : (
          filteredUsers.map((user) => {
            const roleBadge = getRoleBadge(user.role);
            const accessBadge = getAccessTypeBadge(user.accessType);
            const RoleIcon = roleBadge.icon;
            const AccessIcon = accessBadge.icon;

            return (
              <div
                key={user._id}
                className="bg-white rounded-2xl shadow-sm border border-gray-100 hover:shadow-md hover:border-indigo-200 transition-all duration-200 overflow-hidden"
              >
                <div className="p-4 sm:p-5">
                  <div className="flex items-start gap-4">
                    {/* Avatar */}
                    <div className="flex-shrink-0">
                      <div className="w-12 h-12 sm:w-14 sm:h-14 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-xl flex items-center justify-center text-white font-bold text-lg shadow-lg shadow-indigo-500/25">
                        {user.firstName?.charAt(0)}{user.lastName?.charAt(0)}
                      </div>
                    </div>

                    {/* User Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 mb-2">
                        <h3 className="text-lg font-semibold text-gray-900 truncate">
                          {user.firstName} {user.lastName}
                        </h3>
                        <div className="flex flex-wrap gap-2">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-lg ${roleBadge.bg} ${roleBadge.text}`}>
                            <RoleIcon className="w-3 h-3" />
                            {user.role === 'admin' ? 'Admin' : 'Custom'}
                          </span>
                          <span className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-lg ${accessBadge.bg} ${accessBadge.text}`}>
                            <AccessIcon className="w-3 h-3" />
                            {accessBadge.label}
                          </span>
                          <span className={`inline-flex px-2.5 py-1 text-xs font-semibold rounded-lg ${getStatusBadge(user.status)}`}>
                            {user.status}
                          </span>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-500">
                        <span className="flex items-center gap-1">
                          <User className="w-4 h-4" />
                          @{user.username}
                        </span>
                        {user.email && (
                          <span className="flex items-center gap-1">
                            <Mail className="w-4 h-4" />
                            <span className="truncate max-w-[200px]">{user.email}</span>
                          </span>
                        )}
                        {user.employeeCode && (
                          <span className="flex items-center gap-1">
                            <Hash className="w-4 h-4" />
                            {user.employeeCode}
                          </span>
                        )}
                      </div>

                      {user.staffId && (
                        <div className="mt-2 inline-flex items-center gap-1 text-xs text-indigo-600 bg-indigo-50 px-2 py-1 rounded-lg">
                          <Briefcase className="w-3 h-3" />
                          Linked: {user.staffId.firstName} {user.staffId.lastName}
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1">
                      {(user.accessType === 'admin_only' || user.accessType === 'both') && (
                        <button
                          onClick={() => {
                            setCurrentUser(user);
                            setShowPasswordModal(true);
                            setError('');
                          }}
                          className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-xl transition-colors"
                          title="Reset password"
                        >
                          <Key className="w-5 h-5" />
                        </button>
                      )}
                      {(user.accessType === 'kiosk_only' || user.accessType === 'both') && (
                        <button
                          onClick={() => {
                            setCurrentUser(user);
                            setShowPinModal(true);
                            setError('');
                          }}
                          className="p-2 text-amber-600 hover:bg-amber-50 rounded-xl transition-colors"
                          title="Reset PIN"
                        >
                          <RefreshCw className="w-5 h-5" />
                        </button>
                      )}
                      <button
                        onClick={() => handleOpenModal('edit', user)}
                        className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-xl transition-colors"
                        title="Edit user"
                      >
                        <Edit className="w-5 h-5" />
                      </button>
                      <button
                        onClick={() => handleDelete(user._id, user.username)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-xl transition-colors"
                        title="Delete user"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Add/Edit User Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-3 sm:p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full max-h-[95vh] overflow-hidden flex flex-col">
            {/* Modal Header */}
            <div className="px-5 sm:px-6 py-4 border-b border-gray-100 bg-gradient-to-r from-indigo-50 to-purple-50 flex items-center justify-between flex-shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-100 rounded-xl">
                  {modalMode === 'add' ? <UserPlus className="w-5 h-5 text-indigo-600" /> : <Edit className="w-5 h-5 text-indigo-600" />}
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900">
                    {modalMode === 'add' ? 'Add New User' : 'Edit User'}
                  </h3>
                  <p className="text-sm text-gray-500">
                    {modalMode === 'add' ? 'Create a new user account' : 'Update user details'}
                  </p>
                </div>
              </div>
              <button
                onClick={handleCloseModal}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Content */}
            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto">
              <div className="px-5 sm:px-6 py-5 space-y-5">
                {error && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2">
                    <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
                    <p className="text-red-700 text-sm">{error}</p>
                  </div>
                )}

                {/* Basic Info */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">First Name *</label>
                    <input
                      type="text"
                      value={formData.firstName}
                      onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                      className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-gray-50 focus:bg-white"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Last Name *</label>
                    <input
                      type="text"
                      value={formData.lastName}
                      onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                      className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-gray-50 focus:bg-white"
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Username *</label>
                    <input
                      type="text"
                      value={formData.username}
                      onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                      className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-gray-50 focus:bg-white disabled:opacity-60"
                      disabled={modalMode === 'edit'}
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Email *</label>
                    <input
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-gray-50 focus:bg-white"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Phone</label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-gray-50 focus:bg-white"
                  />
                </div>

                {/* Role Selection - Kiosk users are shown but can only reset PIN */}
                {currentUser?.accessType === 'kiosk_only' ? (
                  <div className="p-4 bg-amber-50 rounded-2xl border border-amber-200">
                    <div className="flex items-center gap-2 mb-2">
                      <Fingerprint className="w-5 h-5 text-amber-600" />
                      <h4 className="text-sm font-bold text-amber-900">Kiosk User</h4>
                    </div>
                    <p className="text-sm text-amber-700">
                      This is a kiosk user created in Staff Management. You can only reset their PIN here.
                      To modify other details, go to Staff Management.
                    </p>
                    <p className="text-xs text-amber-600 mt-2">
                      Employee Code: <span className="font-mono font-bold">{currentUser.employeeCode}</span>
                    </p>
                  </div>
                ) : (
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Role Type *</label>
                    <select
                      value={formData.role}
                      onChange={(e) => setFormData({
                        ...formData,
                        role: e.target.value,
                        permissions: e.target.value === 'admin' ? {} : formData.permissions
                      })}
                      className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-gray-50 focus:bg-white appearance-none"
                      required
                    >
                      <option value="admin">Admin (Full Access)</option>
                      <option value="custom">Custom Role (Limited Permissions)</option>
                    </select>
                    <p className="text-xs text-gray-500 mt-1">Admin has full access. Custom role allows selecting specific module permissions.</p>
                  </div>
                )}

                {/* Custom Permissions - For limited admin access */}
                {formData.role === 'custom' && (
                  <div className="p-4 bg-indigo-50 rounded-2xl border border-indigo-200">
                    <h4 className="text-sm font-bold text-indigo-900 mb-3">Module Permissions</h4>
                    <p className="text-xs text-indigo-600 mb-3">Select which modules this user can access. Disabled modules won't appear in their sidebar or be accessible via URL.</p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {[
                        { key: 'dashboard', label: 'Dashboard' },
                        { key: 'inventory', label: 'Inventory' },
                        { key: 'pos', label: 'POS' },
                        { key: 'accounting', label: 'Accounting' },
                        { key: 'customer', label: 'Customers' },
                        { key: 'attendance', label: 'Attendance', hint: 'Includes Staff Management' },
                        { key: 'payroll', label: 'Payroll' },
                        { key: 'analytics', label: 'Analytics' },
                        { key: 'settings', label: 'Settings', hint: 'Includes User Management' }
                      ].map((module) => (
                        <label key={module.key} className="flex items-center gap-2 p-2 bg-white rounded-lg cursor-pointer hover:bg-indigo-100 transition-colors">
                          <input
                            type="checkbox"
                            checked={formData.permissions[module.key] || false}
                            onChange={(e) => setFormData({
                              ...formData,
                              permissions: { ...formData.permissions, [module.key]: e.target.checked }
                            })}
                            className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500"
                          />
                          <div>
                            <span className="text-sm text-gray-700">{module.label}</span>
                            {module.hint && <span className="block text-xs text-gray-400">{module.hint}</span>}
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>
                )}

                {/* Password - Required for new admin users */}
                {modalMode === 'add' && (
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Password * <span className="font-normal text-gray-500">(8+ chars, upper, lower, number)</span>
                    </label>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={formData.password}
                        onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                        className="w-full px-4 py-3 pr-12 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-gray-50 focus:bg-white"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 transform -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600"
                      >
                        {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                      </button>
                    </div>
                  </div>
                )}

                {/* Status (Edit mode only) */}
                {modalMode === 'edit' && (
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Status</label>
                    <select
                      value={formData.status}
                      onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                      className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-gray-50 focus:bg-white appearance-none"
                    >
                      <option value="active">Active</option>
                      <option value="inactive">Inactive</option>
                      <option value="suspended">Suspended</option>
                    </select>
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div className="px-5 sm:px-6 py-4 border-t border-gray-100 bg-gray-50 flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-3 flex-shrink-0">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="px-5 py-2.5 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-100 transition-colors font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl hover:from-indigo-700 hover:to-purple-700 disabled:opacity-50 flex items-center justify-center gap-2 font-medium shadow-lg shadow-indigo-500/25"
                >
                  <Save className="w-4 h-4" />
                  {modalMode === 'add' ? 'Create User' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reset Password Modal */}
      {showPasswordModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 bg-gradient-to-r from-emerald-50 to-teal-50 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-emerald-100 rounded-xl">
                  <Key className="w-5 h-5 text-emerald-600" />
                </div>
                <h3 className="text-lg font-bold text-gray-900">Reset Password</h3>
              </div>
              <button
                onClick={() => {
                  setShowPasswordModal(false);
                  setResetPasswordData({ newPassword: '', confirmPassword: '' });
                  setError('');
                }}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleResetPassword}>
              <div className="px-6 py-5 space-y-4">
                {error && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2">
                    <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
                    <p className="text-red-700 text-sm">{error}</p>
                  </div>
                )}

                <p className="text-sm text-gray-600">
                  Resetting password for: <strong>{currentUser?.firstName} {currentUser?.lastName}</strong>
                </p>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">New Password</label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={resetPasswordData.newPassword}
                      onChange={(e) => setResetPasswordData({ ...resetPasswordData, newPassword: e.target.value })}
                      className="w-full px-4 py-3 pr-12 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600"
                    >
                      {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Confirm Password</label>
                  <input
                    type="password"
                    value={resetPasswordData.confirmPassword}
                    onChange={(e) => setResetPasswordData({ ...resetPasswordData, confirmPassword: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    required
                  />
                </div>
              </div>

              <div className="px-6 py-4 border-t border-gray-100 bg-gray-50 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowPasswordModal(false);
                    setResetPasswordData({ newPassword: '', confirmPassword: '' });
                    setError('');
                  }}
                  className="px-5 py-2.5 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-100 transition-colors font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-5 py-2.5 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 disabled:opacity-50 flex items-center gap-2 font-medium"
                >
                  <Key className="w-4 h-4" />
                  Reset Password
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reset PIN Modal */}
      {showPinModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 bg-gradient-to-r from-amber-50 to-orange-50 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-amber-100 rounded-xl">
                  <Fingerprint className="w-5 h-5 text-amber-600" />
                </div>
                <h3 className="text-lg font-bold text-gray-900">Reset PIN</h3>
              </div>
              <button
                onClick={() => {
                  setShowPinModal(false);
                  setResetPinData({ newPin: '', confirmPin: '' });
                  setError('');
                }}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleResetPin}>
              <div className="px-6 py-5 space-y-4">
                {error && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2">
                    <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
                    <p className="text-red-700 text-sm">{error}</p>
                  </div>
                )}

                <p className="text-sm text-gray-600">
                  Resetting PIN for: <strong>{currentUser?.firstName} {currentUser?.lastName}</strong>
                </p>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">New PIN (4-6 digits)</label>
                  <div className="relative">
                    <input
                      type={showPin ? 'text' : 'password'}
                      value={resetPinData.newPin}
                      onChange={(e) => setResetPinData({ ...resetPinData, newPin: e.target.value })}
                      maxLength="6"
                      className="w-full px-4 py-3 pr-12 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPin(!showPin)}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600"
                    >
                      {showPin ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Confirm PIN</label>
                  <input
                    type="password"
                    value={resetPinData.confirmPin}
                    onChange={(e) => setResetPinData({ ...resetPinData, confirmPin: e.target.value })}
                    maxLength="6"
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500"
                    required
                  />
                </div>
              </div>

              <div className="px-6 py-4 border-t border-gray-100 bg-gray-50 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowPinModal(false);
                    setResetPinData({ newPin: '', confirmPin: '' });
                    setError('');
                  }}
                  className="px-5 py-2.5 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-100 transition-colors font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-5 py-2.5 bg-amber-600 text-white rounded-xl hover:bg-amber-700 disabled:opacity-50 flex items-center gap-2 font-medium"
                >
                  <RefreshCw className="w-4 h-4" />
                  Reset PIN
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserManagement;
