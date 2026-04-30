// PayrollRegister.jsx - Payroll Register Report Component
// Phase 3: Full payroll breakdown by employee

import React, { useState, useEffect, useCallback } from 'react';
import { useTenant } from '../../../context/TenantProvider.jsx';
import {
  FileText,
  Download,
  Filter,
  ChevronDown,
  ChevronUp,
  Search,
  Users,
  DollarSign,
  TrendingDown,
  ArrowUpDown
} from 'lucide-react';
import { downloadXLSX, downloadPDF, fmtN } from './exportUtils';

import { SkeletonLine } from '../shared';

function PayrollRegister({ period, startPeriod, endPeriod, setError }) {
  const { makeRequest } = useTenant();

  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [expandedRow, setExpandedRow] = useState(null);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [sortBy, setSortBy] = useState('employeeNumber');
  const [sortOrder, setSortOrder] = useState('asc');

  // Pagination
  const [page, setPage] = useState(1);
  const [limit] = useState(25);

  // Fetch report data
  const fetchReport = useCallback(async () => {
    if (!period && (!startPeriod || !endPeriod)) return;

    try {
      setLoading(true);
      const params = new URLSearchParams();

      if (period) {
        params.append('period', period);
      } else {
        params.append('startPeriod', startPeriod);
        params.append('endPeriod', endPeriod);
      }

      if (departmentFilter) params.append('department', departmentFilter);
      if (statusFilter) params.append('status', statusFilter);
      params.append('page', page);
      params.append('limit', limit);
      params.append('sortBy', sortBy);
      params.append('sortOrder', sortOrder);

      const response = await makeRequest(`/api/payroll/reports/register?${params}`);
      setReport(response);
    } catch (err) {
      console.error('Error fetching payroll register:', err);
      setError('Failed to load payroll register report');
    } finally {
      setLoading(false);
    }
  }, [period, startPeriod, endPeriod, departmentFilter, statusFilter, page, limit, sortBy, sortOrder, makeRequest, setError]);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [departmentFilter, statusFilter, sortBy, sortOrder]);

  // Get unique departments from report
  const departments = report?.records
    ? [...new Set(report.records.map(r => r.department).filter(Boolean))]
    : [];

  // Filter by search term locally
  const filteredRecords = report?.records?.filter(record =>
    record.employeeName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    record.employeeNumber?.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  // Handle sort
  const handleSort = (field) => {
    if (sortBy === field) {
      setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('asc');
    }
  };

  // Format currency
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-NG', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount || 0);
  };

  // Export handlers
  const handleExportXLSX = () => {
    try {
      if (!report?.records?.length) { setError('No data to export'); return; }
      const periodLabel = period || `${startPeriod}-to-${endPeriod}`;
      const headers = ['Emp #','Employee Name','Department','Position','Base Salary','Allowances','Gross Salary','PAYE','Pension','NHF','NHIS','Other Ded.','Total Deductions','Net Salary','Status'];
      const rows = report.records.map(r => [
        r.employeeNumber || '', r.employeeName || '', r.department || '', r.position || '',
        r.baseSalary || 0, r.totalAllowances || 0, r.grossSalary || 0,
        r.paye || 0, r.pension || 0, r.nhf || 0, r.nhis || 0,
        (r.latenessDeduction || 0) + (r.absenceDeduction || 0) + (r.earlyLeaveDeduction || 0) + (r.otherDeductionsAmount || 0),
        r.totalDeductions || 0, r.netSalary || 0, r.status || 'preliminary'
      ]);
      const totals = report.totals || {};
      rows.push(['','TOTAL','','','','',fmtN(totals.grossSalary),'','','','','',fmtN(totals.totalDeductions),fmtN(totals.netSalary),'']);
      downloadXLSX(`payroll-register-${periodLabel}`, [{ name: 'Payroll Register', headers, rows }]);
    } catch { setError('Failed to export report'); }
  };

  const handleExportPDF = () => {
    try {
      if (!report?.records?.length) { setError('No data to export'); return; }
      const periodLabel = period || `${startPeriod}-to-${endPeriod}`;
      const totals = report.totals || {};
      const summaryCards = [
        { label: 'Employees', value: report.pagination?.totalRecords || 0 },
        { label: 'Gross Payroll', value: `₦${fmtN(totals.grossSalary)}` },
        { label: 'Total Deductions', value: `₦${fmtN(totals.totalDeductions)}` },
        { label: 'Net Payroll', value: `₦${fmtN(totals.netSalary)}` }
      ];
      const columns = ['Emp #','Name','Department','Gross','Deductions','Net','Status'];
      const rows = report.records.map(r => [
        r.employeeNumber || '', r.employeeName || '', r.department || '',
        `₦${fmtN(r.grossSalary)}`, `₦${fmtN(r.totalDeductions)}`, `₦${fmtN(r.netSalary)}`, r.status || 'preliminary'
      ]);
      const totalsRow = ['','TOTAL','',`₦${fmtN(totals.grossSalary)}`,`₦${fmtN(totals.totalDeductions)}`,`₦${fmtN(totals.netSalary)}`,''];
      downloadPDF(`payroll-register-${periodLabel}`, 'Payroll Register', periodLabel, columns, rows,
        {
          summaryCards, totalsRow, columnStyles: [3, 4, 5],
          columnWidths: { 0: 16, 1: 48, 2: 36, 3: 32, 4: 32, 5: 32, 6: 22 }
        });
    } catch { setError('Failed to export report'); }
  };

  if (loading) {
    return (
      <div className="animate-pulse space-y-3">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(i => (
          <SkeletonLine key={i} width={i % 2 === 0 ? "w-full" : "w-3/4"} />
        ))}
      </div>
    );
  }

  if (!report) {
    return (
      <div className="text-center py-8 text-gray-500">
        No report data available
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="flex items-center gap-2 text-gray-500 mb-1">
            <Users className="w-4 h-4" />
            <span className="text-sm">Employees</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">
            {report.pagination?.totalRecords || 0}
          </p>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="flex items-center gap-2 text-gray-500 mb-1">
            <DollarSign className="w-4 h-4" />
            <span className="text-sm">Gross Payroll</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">
            ₦{formatCurrency(report.totals?.grossSalary)}
          </p>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="flex items-center gap-2 text-gray-500 mb-1">
            <TrendingDown className="w-4 h-4" />
            <span className="text-sm">Total Deductions</span>
          </div>
          <p className="text-2xl font-bold text-red-600">
            ₦{formatCurrency(report.totals?.totalDeductions)}
          </p>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="flex items-center gap-2 text-gray-500 mb-1">
            <DollarSign className="w-4 h-4" />
            <span className="text-sm">Net Payroll</span>
          </div>
          <p className="text-2xl font-bold text-green-600">
            ₦{formatCurrency(report.totals?.netSalary)}
          </p>
        </div>
      </div>

      {/* Filters & Actions */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search employee..."
                className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 text-sm w-48 focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Department Filter */}
            <select
              value={departmentFilter}
              onChange={(e) => setDepartmentFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 text-sm"
            >
              <option value="">All Departments</option>
              {departments.map(dept => (
                <option key={dept} value={dept}>{dept}</option>
              ))}
            </select>

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 text-sm"
            >
              <option value="">All Status</option>
              <option value="preliminary">Preliminary</option>
              <option value="generated">Generated</option>
              <option value="pending_approval">Pending Approval</option>
              <option value="approved">Approved</option>
              <option value="paid">Paid</option>
            </select>
          </div>

          {/* Export */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleExportXLSX}
              className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-lg transition-colors"
            >
              <Download className="w-4 h-4" />
              XLSX
            </button>
            <button
              onClick={handleExportPDF}
              className="flex items-center gap-1.5 px-3 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-lg transition-colors"
            >
              <FileText className="w-4 h-4" />
              PDF
            </button>
          </div>
        </div>
      </div>

      {/* Data Table */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  <button
                    onClick={() => handleSort('employeeNumber')}
                    className="flex items-center gap-1 hover:text-gray-700"
                  >
                    Employee
                    <ArrowUpDown className="w-3 h-3" />
                  </button>
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Department
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  <button
                    onClick={() => handleSort('grossSalary')}
                    className="flex items-center gap-1 ml-auto hover:text-gray-700"
                  >
                    Gross
                    <ArrowUpDown className="w-3 h-3" />
                  </button>
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Deductions
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  <button
                    onClick={() => handleSort('netSalary')}
                    className="flex items-center gap-1 ml-auto hover:text-gray-700"
                  >
                    Net
                    <ArrowUpDown className="w-3 h-3" />
                  </button>
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-4 py-3 w-10"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredRecords.map((record, idx) => (
                <React.Fragment key={record.employeeNumber || idx}>
                  <tr
                    className={`hover:bg-gray-50/50 cursor-pointer ${
                      expandedRow === idx ? 'bg-gray-50/50' : ''
                    }`}
                    onClick={() => setExpandedRow(expandedRow === idx ? null : idx)}
                  >
                    <td className="px-4 py-3">
                      <div>
                        <p className="font-medium text-gray-900">
                          {record.employeeName}
                        </p>
                        <p className="text-sm text-gray-500">
                          {record.employeeNumber}
                        </p>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {record.department || '-'}
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-gray-900">
                      ₦{formatCurrency(record.grossSalary)}
                    </td>
                    <td className="px-4 py-3 text-right text-red-600">
                      ₦{formatCurrency(record.totalDeductions)}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-green-600">
                      ₦{formatCurrency(record.netSalary)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                        record.status === 'paid'
                          ? 'bg-green-100 text-green-800'
                          : record.status === 'approved'
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}>
                        {record.status || 'preliminary'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {expandedRow === idx ? (
                        <ChevronUp className="w-4 h-4 text-gray-400" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-gray-400" />
                      )}
                    </td>
                  </tr>

                  {/* Expanded Details */}
                  {expandedRow === idx && (
                    <tr>
                      <td colSpan={7} className="px-4 py-4 bg-gray-50">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                          {/* Allowances */}
                          <div>
                            <h5 className="font-medium text-gray-700 mb-2">Allowances</h5>
                            <div className="space-y-1">
                              <div className="flex justify-between">
                                <span className="text-gray-500">Base Salary:</span>
                                <span className="text-gray-900">₦{formatCurrency(record.baseSalary)}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-gray-500">Total Allowances:</span>
                                <span className="text-gray-900">₦{formatCurrency(record.totalAllowances)}</span>
                              </div>
                              {record.overtimePay > 0 && (
                                <div className="flex justify-between">
                                  <span className="text-gray-500">Overtime:</span>
                                  <span className="text-gray-900">₦{formatCurrency(record.overtimePay)}</span>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Statutory Deductions */}
                          <div>
                            <h5 className="font-medium text-gray-700 mb-2">Statutory</h5>
                            <div className="space-y-1">
                              <div className="flex justify-between">
                                <span className="text-gray-500">PAYE:</span>
                                <span className="text-red-600">₦{formatCurrency(record.paye)}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-gray-500">Pension:</span>
                                <span className="text-red-600">₦{formatCurrency(record.pension)}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-gray-500">NHF:</span>
                                <span className="text-red-600">₦{formatCurrency(record.nhf)}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-gray-500">NHIS:</span>
                                <span className="text-red-600">₦{formatCurrency(record.nhis)}</span>
                              </div>
                            </div>
                          </div>

                          {/* Attendance Deductions */}
                          <div>
                            <h5 className="font-medium text-gray-700 mb-2">Attendance</h5>
                            <div className="space-y-1">
                              <div className="flex justify-between">
                                <span className="text-gray-500">Lateness:</span>
                                <span className="text-red-600">₦{formatCurrency(record.latenessDeduction)}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-gray-500">Early Leave:</span>
                                <span className="text-red-600">₦{formatCurrency(record.earlyLeaveDeduction)}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-gray-500">Absence:</span>
                                <span className="text-red-600">₦{formatCurrency(record.absenceDeduction)}</span>
                              </div>
                              {record.lateDays > 0 && (
                                <div className="flex justify-between text-xs text-gray-400">
                                  <span>Late days:</span>
                                  <span>{record.lateDays} ({record.attendanceData?.lateMinutes || 0} min)</span>
                                </div>
                              )}
                              {record.absentDays > 0 && (
                                <div className="flex justify-between text-xs text-gray-400">
                                  <span>Absent days:</span>
                                  <span>{record.absentDays}</span>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Bank Details */}
                          <div>
                            <h5 className="font-medium text-gray-700 mb-2">Bank Details</h5>
                            <div className="space-y-1">
                              <div className="flex justify-between">
                                <span className="text-gray-500">Bank:</span>
                                <span className="text-gray-900">{record.bankDetails?.bankName || '-'}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-gray-500">Account:</span>
                                <span className="text-gray-900">{record.bankDetails?.accountNumber || '-'}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {report.pagination && report.pagination.totalPages > 1 && (
          <div className="px-4 py-3 border-t border-gray-200 flex items-center justify-between">
            <p className="text-sm text-gray-500">
              Showing {((page - 1) * limit) + 1} to {Math.min(page * limit, report.pagination.totalRecords)} of {report.pagination.totalRecords}
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-1 text-sm border border-gray-300 rounded-lg disabled:opacity-50 hover:bg-gray-100"
              >
                Previous
              </button>
              <span className="text-sm text-gray-600">
                Page {page} of {report.pagination.totalPages}
              </span>
              <button
                onClick={() => setPage(p => Math.min(report.pagination.totalPages, p + 1))}
                disabled={page === report.pagination.totalPages}
                className="px-3 py-1 text-sm border border-gray-300 rounded-lg disabled:opacity-50 hover:bg-gray-100"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default PayrollRegister;
