// DepartmentCosts.jsx - Department Costs Report Component
// Phase 3: Analyze payroll costs by department

import React, { useState, useEffect, useCallback } from 'react';
import { useTenant } from '../../../context/TenantProvider.jsx';
import {
  Building2,
  Users,
  DollarSign,
  TrendingUp,
  Download,
  FileText,
  Percent,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { downloadXLSX, downloadPDF, fmtN } from './exportUtils';

import { SkeletonLine } from '../shared';

function DepartmentCosts({ period, startPeriod, endPeriod, setError }) {
  const { makeRequest } = useTenant();

  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState('totalEmployerCost');
  const [sortOrder, setSortOrder] = useState('desc');
  const [expandedDept, setExpandedDept] = useState(null);

  // Fetch report
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

      const response = await makeRequest(`/api/payroll/reports/department-costs?${params}`);
      setReport(response);
    } catch (err) {
      console.error('Error fetching department costs:', err);
      setError('Failed to load department costs report');
    } finally {
      setLoading(false);
    }
  }, [period, startPeriod, endPeriod, makeRequest, setError]);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  // Format currency
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-NG', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount || 0);
  };

  // Sort departments
  const sortedDepartments = React.useMemo(() => {
    if (!report?.departments) return [];
    return [...report.departments].sort((a, b) => {
      const aVal = a[sortBy] || 0;
      const bVal = b[sortBy] || 0;
      return sortOrder === 'desc' ? bVal - aVal : aVal - bVal;
    });
  }, [report?.departments, sortBy, sortOrder]);

  // Handle sort
  const handleSort = (field) => {
    if (sortBy === field) {
      setSortOrder(prev => prev === 'desc' ? 'asc' : 'desc');
    } else {
      setSortBy(field);
      setSortOrder('desc');
    }
  };

  const handleExportXLSX = () => {
    try {
      if (!report?.departments?.length) { setError('No data to export'); return; }
      const periodLabel = period || `${startPeriod}-to-${endPeriod}`;
      const totalCost = report.totals?.totalEmployerCost || 0;
      const headers = ['Department','Head Count','Gross','Net Salary','Employer Pension','Employer NHIS','Total Employer Cost','% of Total'];
      const rows = report.departments.map(d => {
        const pct = totalCost > 0 ? ((d.totalEmployerCost||0)/totalCost*100).toFixed(1) : '0.0';
        return [d.department||'', d.employeeCount||0, d.grossSalary||0, d.netSalary||0, d.employerPension||0, d.employerNhis||0, d.totalEmployerCost||0, pct+'%'];
      });
      const t = report.totals || {};
      rows.push(['TOTAL', t.employeeCount||0, t.grossSalary||0, t.netSalary||0, t.employerPension||0, t.employerNhis||0, t.totalEmployerCost||0, '100%']);
      downloadXLSX(`department-costs-${periodLabel}`, [{ name: 'Department Costs', headers, rows }]);
    } catch { setError('Failed to export'); }
  };

  const handleExportPDF = () => {
    try {
      if (!report?.departments?.length) { setError('No data to export'); return; }
      const periodLabel = period || `${startPeriod}-to-${endPeriod}`;
      const totalCost = report.totals?.totalEmployerCost || 0;
      const t = report.totals || {};
      const summaryCards = [
        { label: 'Total Staff', value: t.employeeCount || 0 },
        { label: 'Net Salaries', value: `₦${fmtN(t.netSalary)}` },
        { label: 'Employer Contrib.', value: `₦${fmtN((t.employerPension||0)+(t.employerNhis||0))}` },
        { label: 'Total Employer Cost', value: `₦${fmtN(t.totalEmployerCost)}` }
      ];
      const columns = ['Department','Staff','Gross','Net','Empl. Pension','Empl. NHIS','Total Cost','%'];
      const rows = report.departments.map(d => {
        const pct = totalCost > 0 ? ((d.totalEmployerCost||0)/totalCost*100).toFixed(1) : '0.0';
        return [d.department||'', d.employeeCount||0, `₦${fmtN(d.grossSalary)}`, `₦${fmtN(d.netSalary)}`,
          `₦${fmtN(d.employerPension)}`, `₦${fmtN(d.employerNhis)}`, `₦${fmtN(d.totalEmployerCost)}`, pct+'%'];
      });
      const totalsRow = ['TOTAL', t.employeeCount||0, `₦${fmtN(t.grossSalary)}`, `₦${fmtN(t.netSalary)}`,
        `₦${fmtN(t.employerPension)}`, `₦${fmtN(t.employerNhis)}`, `₦${fmtN(t.totalEmployerCost)}`, '100%'];
      downloadPDF(`department-costs-${periodLabel}`, 'Department Cost Analysis', periodLabel, columns, rows,
        { summaryCards, totalsRow, columnStyles: [1, 2, 3, 4, 5, 6] });
    } catch { setError('Failed to export'); }
  };

  // Calculate max for progress bars
  const maxCost = Math.max(...(report?.departments?.map(d => d.totalEmployerCost) || [1]));

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
        No data available
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">
              Department Costs Analysis
            </h3>
            <p className="text-sm text-gray-500">
              Period: {report.period} | {report.departments?.length || 0} departments
            </p>
          </div>
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

      {/* Organization Totals */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="flex items-center gap-2 text-gray-500 mb-1">
            <Users className="w-4 h-4" />
            <span className="text-sm">Total Staff</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">
            {report.totals?.employeeCount || 0}
          </p>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="flex items-center gap-2 text-gray-500 mb-1">
            <DollarSign className="w-4 h-4" />
            <span className="text-sm">Net Salaries</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">
            ₦{formatCurrency(report.totals?.netSalary)}
          </p>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="flex items-center gap-2 text-gray-500 mb-1">
            <Building2 className="w-4 h-4" />
            <span className="text-sm">Employer Contributions</span>
          </div>
          <p className="text-2xl font-bold text-purple-600">
            ₦{formatCurrency((report.totals?.employerPension || 0) + (report.totals?.employerNhis || 0))}
          </p>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="flex items-center gap-2 text-gray-500 mb-1">
            <TrendingUp className="w-4 h-4" />
            <span className="text-sm">Total Employer Cost</span>
          </div>
          <p className="text-2xl font-bold text-blue-600">
            ₦{formatCurrency(report.totals?.totalEmployerCost)}
          </p>
        </div>
      </div>

      {/* Visual Department Breakdown */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h4 className="font-semibold text-gray-900 mb-4">Cost Distribution by Department</h4>

        <div className="space-y-4">
          {sortedDepartments.slice(0, 8).map((dept, idx) => {
            const percentage = (dept.totalEmployerCost / maxCost) * 100;
            const colors = [
              'bg-blue-500', 'bg-green-500', 'bg-purple-500', 'bg-yellow-500',
              'bg-red-500', 'bg-indigo-500', 'bg-pink-500', 'bg-teal-500'
            ];

            return (
              <div key={dept.department}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className={`w-3 h-3 rounded-full ${colors[idx % colors.length]}`} />
                    <span className="font-medium text-gray-900">{dept.department}</span>
                    <span className="text-sm text-gray-500">({dept.employeeCount} staff)</span>
                  </div>
                  <div className="text-right">
                    <span className="font-semibold text-gray-900">
                      ₦{formatCurrency(dept.totalEmployerCost)}
                    </span>
                    <span className="text-sm text-gray-500 ml-2">({dept.percentageOfTotal}%)</span>
                  </div>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className={`${colors[idx % colors.length]} h-2 rounded-full transition-all duration-500`}
                    style={{ width: `${percentage}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Detailed Table */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Department
                </th>
                <th
                  className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase cursor-pointer hover:text-gray-700"
                  onClick={() => handleSort('employeeCount')}
                >
                  <div className="flex items-center justify-end gap-1">
                    Staff
                    {sortBy === 'employeeCount' && (sortOrder === 'desc' ? <ChevronDown className="w-3 h-3" /> : <ChevronUp className="w-3 h-3" />)}
                  </div>
                </th>
                <th
                  className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase cursor-pointer hover:text-gray-700"
                  onClick={() => handleSort('grossSalary')}
                >
                  <div className="flex items-center justify-end gap-1">
                    Gross
                    {sortBy === 'grossSalary' && (sortOrder === 'desc' ? <ChevronDown className="w-3 h-3" /> : <ChevronUp className="w-3 h-3" />)}
                  </div>
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                  Net
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                  Employer Pension
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                  Employer NHIS
                </th>
                <th
                  className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase cursor-pointer hover:text-gray-700"
                  onClick={() => handleSort('totalEmployerCost')}
                >
                  <div className="flex items-center justify-end gap-1">
                    Total Cost
                    {sortBy === 'totalEmployerCost' && (sortOrder === 'desc' ? <ChevronDown className="w-3 h-3" /> : <ChevronUp className="w-3 h-3" />)}
                  </div>
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                  % of Total
                </th>
                <th className="px-4 py-3 w-10"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {sortedDepartments.map((dept, idx) => (
                <React.Fragment key={dept.department}>
                  <tr
                    className={`hover:bg-gray-50/50 cursor-pointer ${
                      expandedDept === idx ? 'bg-gray-50/50' : ''
                    }`}
                    onClick={() => setExpandedDept(expandedDept === idx ? null : idx)}
                  >
                    <td className="px-4 py-3 font-medium text-gray-900">
                      {dept.department}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-600">
                      {dept.employeeCount}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-900">
                      ₦{formatCurrency(dept.grossSalary)}
                    </td>
                    <td className="px-4 py-3 text-right text-green-600">
                      ₦{formatCurrency(dept.netSalary)}
                    </td>
                    <td className="px-4 py-3 text-right text-purple-600">
                      ₦{formatCurrency(dept.employerPension)}
                    </td>
                    <td className="px-4 py-3 text-right text-purple-600">
                      ₦{formatCurrency(dept.employerNhis)}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-blue-600">
                      ₦{formatCurrency(dept.totalEmployerCost)}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-600">
                      {dept.percentageOfTotal}%
                    </td>
                    <td className="px-4 py-3">
                      {expandedDept === idx ? (
                        <ChevronUp className="w-4 h-4 text-gray-400" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-gray-400" />
                      )}
                    </td>
                  </tr>

                  {/* Expanded Details */}
                  {expandedDept === idx && (
                    <tr>
                      <td colSpan={9} className="px-4 py-4 bg-gray-50">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                          <div>
                            <p className="text-gray-500">Base Salaries</p>
                            <p className="font-medium text-gray-900">
                              ₦{formatCurrency(dept.baseSalary)}
                            </p>
                          </div>
                          <div>
                            <p className="text-gray-500">Total Allowances</p>
                            <p className="font-medium text-gray-900">
                              ₦{formatCurrency(dept.totalAllowances)}
                            </p>
                          </div>
                          <div>
                            <p className="text-gray-500">Total Deductions</p>
                            <p className="font-medium text-red-600">
                              ₦{formatCurrency(dept.totalDeductions)}
                            </p>
                          </div>
                          <div>
                            <p className="text-gray-500">Average Salary</p>
                            <p className="font-medium text-gray-900">
                              ₦{formatCurrency(dept.averageSalary)}
                            </p>
                          </div>
                          {dept.overtimePay > 0 && (
                            <div>
                              <p className="text-gray-500">Overtime</p>
                              <p className="font-medium text-blue-600">
                                ₦{formatCurrency(dept.overtimePay)}
                              </p>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
            <tfoot className="bg-gray-100 font-semibold">
              <tr>
                <td className="px-4 py-3 text-gray-900">TOTAL</td>
                <td className="px-4 py-3 text-right text-gray-900">
                  {report.totals?.employeeCount}
                </td>
                <td className="px-4 py-3 text-right text-gray-900">
                  ₦{formatCurrency(report.totals?.grossSalary)}
                </td>
                <td className="px-4 py-3 text-right text-green-600">
                  ₦{formatCurrency(report.totals?.netSalary)}
                </td>
                <td className="px-4 py-3 text-right text-purple-600">
                  ₦{formatCurrency(report.totals?.employerPension)}
                </td>
                <td className="px-4 py-3 text-right text-purple-600">
                  ₦{formatCurrency(report.totals?.employerNhis)}
                </td>
                <td className="px-4 py-3 text-right text-blue-600">
                  ₦{formatCurrency(report.totals?.totalEmployerCost)}
                </td>
                <td className="px-4 py-3 text-right text-gray-900">
                  100%
                </td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}

export default DepartmentCosts;
