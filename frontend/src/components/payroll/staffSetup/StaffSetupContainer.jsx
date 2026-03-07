// StaffSetupContainer.jsx - Staff payroll setup management
// Configure individual staff payroll settings

import React, { useState, useMemo, useCallback } from 'react';
import {
  Search,
  Filter,
  Edit2,
  Users,
  DollarSign,
  Building2,
  ChevronDown,
  X,
  AlertTriangle,
  CheckCircle
} from 'lucide-react';

import {
  StaffTableSkeleton,
  MobileListSkeleton,
  NoStaffSetupEmptyState,
  SearchEmptyState,
  StatusBadge,
  EnabledBadge,
  Tip
} from '../shared';

import StaffPayrollModal from './StaffPayrollModal';

function StaffSetupContainer({
  staff = [],
  settings,
  onUpdateStaff,
  onBulkUpdate,
  setError,
  setSuccess
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterDepartment, setFilterDepartment] = useState('');
  const [filterStatus, setFilterStatus] = useState('all'); // all, configured, unconfigured
  const [sortBy, setSortBy] = useState('name');
  const [editingStaff, setEditingStaff] = useState(null);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  // Check for mobile on resize
  React.useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Get unique departments
  const departments = useMemo(() => {
    const depts = [...new Set(staff.map(s => s.department).filter(Boolean))];
    return depts.sort();
  }, [staff]);

  // Filter and sort staff
  const filteredStaff = useMemo(() => {
    let result = [...staff];

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(s =>
        s.fullName?.toLowerCase().includes(query) ||
        s.firstName?.toLowerCase().includes(query) ||
        s.lastName?.toLowerCase().includes(query) ||
        s.employeeId?.toLowerCase().includes(query) ||
        s.email?.toLowerCase().includes(query)
      );
    }

    // Department filter
    if (filterDepartment) {
      result = result.filter(s => s.department === filterDepartment);
    }

    // Status filter
    if (filterStatus === 'configured') {
      result = result.filter(s => s.baseSalary > 0);
    } else if (filterStatus === 'unconfigured') {
      result = result.filter(s => !s.baseSalary || s.baseSalary === 0);
    }

    // Sort
    result.sort((a, b) => {
      if (sortBy === 'name') {
        return (a.fullName || '').localeCompare(b.fullName || '');
      } else if (sortBy === 'salary') {
        return (b.baseSalary || 0) - (a.baseSalary || 0);
      } else if (sortBy === 'department') {
        return (a.department || '').localeCompare(b.department || '');
      }
      return 0;
    });

    return result;
  }, [staff, searchQuery, filterDepartment, filterStatus, sortBy]);

  // Stats
  const stats = useMemo(() => {
    const configured = staff.filter(s => s.baseSalary > 0);
    return {
      total: staff.length,
      configured: configured.length,
      unconfigured: staff.length - configured.length,
      totalSalary: configured.reduce((sum, s) => sum + (s.baseSalary || 0), 0)
    };
  }, [staff]);

  // Handle staff update
  const handleSaveStaff = useCallback(async (staffId, data) => {
    try {
      await onUpdateStaff(staffId, data);
      setEditingStaff(null);
    } catch (err) {
      // Error handled by parent
    }
  }, [onUpdateStaff]);

  // Clear filters
  const clearFilters = useCallback(() => {
    setSearchQuery('');
    setFilterDepartment('');
    setFilterStatus('all');
  }, []);

  if (staff.length === 0) {
    return <NoStaffSetupEmptyState />;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">
            Staff Payroll Setup
          </h3>
          <p className="text-sm text-gray-500">
            Configure salary and payroll settings for each staff member
          </p>
        </div>

        {/* Stats badges */}
        <div className="flex flex-wrap gap-2 items-center">
          <span className="px-3 py-1.5 bg-green-100/30 text-green-700 text-sm font-medium rounded-lg flex items-center gap-1.5">
            <CheckCircle className="w-3.5 h-3.5" />
            {stats.configured} of {stats.total} configured
          </span>
          {stats.unconfigured > 0 && (
            <span className="px-3 py-1.5 bg-yellow-100/30 text-yellow-700 text-sm font-medium rounded-lg flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5" />
              {stats.unconfigured} pending
            </span>
          )}
        </div>
      </div>

      {/* Progress bar */}
      {stats.total > 0 && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700">Setup Progress</span>
            <span className="text-sm font-bold text-gray-900">
              {Math.round((stats.configured / stats.total) * 100)}%
            </span>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-2.5">
            <div
              className={`h-2.5 rounded-full transition-all duration-500 ${
                stats.configured === stats.total ? 'bg-green-500' : 'bg-blue-500'
              }`}
              style={{ width: `${Math.round((stats.configured / stats.total) * 100)}%` }}
            />
          </div>
          {stats.unconfigured > 0 && (
            <p className="text-xs text-gray-500 mt-2">
              <span className="font-medium text-yellow-700">{stats.unconfigured} staff</span> without a salary will be excluded from payroll calculations.
            </p>
          )}
        </div>
      )}

      <Tip>
        Staff members need a base salary configured to be included in payroll processing.
        Statutory exemptions can be set per employee.
      </Tip>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
        <div className="flex flex-col md:flex-row gap-4">
          {/* Search */}
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by name, ID, or email..."
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 focus:ring-2 focus:ring-blue-500"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Department filter */}
          <select
            value={filterDepartment}
            onChange={(e) => setFilterDepartment(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Departments</option>
            {departments.map(dept => (
              <option key={dept} value={dept}>{dept}</option>
            ))}
          </select>

          {/* Status filter */}
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Staff</option>
            <option value="configured">Configured</option>
            <option value="unconfigured">Not Configured</option>
          </select>

          {/* Sort */}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 focus:ring-2 focus:ring-blue-500"
          >
            <option value="name">Sort by Name</option>
            <option value="salary">Sort by Salary</option>
            <option value="department">Sort by Department</option>
          </select>
        </div>
      </div>

      {/* Results */}
      {filteredStaff.length === 0 ? (
        <SearchEmptyState query={searchQuery || filterDepartment || filterStatus} onClear={clearFilters} />
      ) : isMobile ? (
        // Mobile card view
        <div className="space-y-3">
          {filteredStaff.map((member) => (
            <MobileStaffCard
              key={member._id}
              staff={member}
              onEdit={() => setEditingStaff(member)}
            />
          ))}
        </div>
      ) : (
        // Desktop table view
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Employee
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Department
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Base Salary
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredStaff.map((member) => (
                  <tr key={member._id} className="hover:bg-gray-50">
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-blue-100/30 flex items-center justify-center text-blue-600 font-medium">
                          {(member.firstName?.[0] || '') + (member.lastName?.[0] || '')}
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">
                            {member.fullName}
                          </p>
                          <p className="text-sm text-gray-500">
                            {member.employeeId} {member.position && `| ${member.position}`}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <span className="text-gray-700">
                        {member.department || '-'}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      {member.baseSalary > 0 ? (
                        <span className="font-medium text-gray-900">
                          ₦{member.baseSalary.toLocaleString()}
                        </span>
                      ) : (
                        <span className="text-gray-400">Not set</span>
                      )}
                    </td>
                    <td className="px-4 py-4">
                      {member.baseSalary > 0 ? (
                        <StatusBadge status="active" label="Configured" showDot />
                      ) : (
                        <StatusBadge status="pending" label="Pending" showDot />
                      )}
                    </td>
                    <td className="px-4 py-4 text-right">
                      <button
                        onClick={() => setEditingStaff(member)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-blue-600 hover:bg-blue-50/20 rounded-lg transition-colors"
                      >
                        <Edit2 className="w-4 h-4" />
                        Configure
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Results count */}
      <div className="text-sm text-gray-500 text-center">
        Showing {filteredStaff.length} of {staff.length} staff members
      </div>

      {/* Edit Modal */}
      {editingStaff && (
        <StaffPayrollModal
          staff={editingStaff}
          settings={settings}
          onSave={handleSaveStaff}
          onClose={() => setEditingStaff(null)}
        />
      )}
    </div>
  );
}

// Mobile staff card component
function MobileStaffCard({ staff, onEdit }) {
  const isConfigured = staff.baseSalary > 0;

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-blue-100/30 flex items-center justify-center text-blue-600 font-medium text-lg">
            {(staff.firstName?.[0] || '') + (staff.lastName?.[0] || '')}
          </div>
          <div>
            <p className="font-medium text-gray-900">
              {staff.fullName}
            </p>
            <p className="text-sm text-gray-500">
              {staff.employeeId}
            </p>
          </div>
        </div>
        {isConfigured ? (
          <StatusBadge status="active" label="Configured" size="xs" showDot />
        ) : (
          <StatusBadge status="pending" label="Pending" size="xs" showDot />
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 mb-4">
        <div>
          <p className="text-xs text-gray-500">Department</p>
          <p className="text-sm font-medium text-gray-700">
            {staff.department || '-'}
          </p>
        </div>
        <div>
          <p className="text-xs text-gray-500">Base Salary</p>
          <p className="text-sm font-medium text-gray-700">
            {isConfigured ? `₦${staff.baseSalary.toLocaleString()}` : 'Not set'}
          </p>
        </div>
      </div>

      <button
        onClick={onEdit}
        className="w-full py-2 text-sm font-medium text-blue-600 bg-blue-50/20 hover:bg-blue-100/30 rounded-lg transition-colors flex items-center justify-center gap-2"
      >
        <Edit2 className="w-4 h-4" />
        Configure Payroll
      </button>
    </div>
  );
}

export default StaffSetupContainer;
