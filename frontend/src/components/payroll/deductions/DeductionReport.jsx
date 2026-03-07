// DeductionReport.jsx - Per-employee grouped deduction report
// Sorted by highest total deduction, with PDF/Excel export

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useTenant } from '../../../context/TenantProvider.jsx';
import {
  FileText,
  Download,
  Filter,
  RefreshCw,
  ChevronDown,
  ChevronRight,
  Clock,
  LogOut,
  UserX,
  Users,
  TrendingDown,
  Printer,
  RotateCcw,
  X
} from 'lucide-react';

import { SkeletonLine } from '../shared';
import { downloadXLSX, downloadPDF, fmtN } from '../reports/exportUtils';

function DeductionReport({ recalculating = false, refreshTick = 0 }) {
  const { makeRequest } = useTenant();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [exporting, setExporting] = useState(false);

  // Filters
  const [period, setPeriod] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [departmentFilter, setDepartmentFilter] = useState('');
  const [expandedStaff, setExpandedStaff] = useState(new Set());

  const fetchReport = useCallback(async (showRefresh = false) => {
    

    try {
      if (showRefresh) setRefreshing(true);
      else setLoading(true);

      const result = await makeRequest(`/api/payroll/deductions/calendar/${period}`);
      setData(result);
      setError('');
    } catch (err) {
      setError(err.message || 'Failed to load deduction report');
      setData(null);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [makeRequest, period]);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  // When PayrollContainer triggers a recalculation:
  // - clear the displayed data immediately so stale numbers don't linger
  // - poll every 15 s until the parent signals completion (recalculating → false)
  useEffect(() => {
    if (!recalculating) return;

    // Clear stale data so the UI shows the recalculation is happening
    setData(null);
    setLoading(true);

    const interval = setInterval(() => {
      fetchReport(false); // silent refresh (no full-page skeleton)
    }, 15000);

    return () => clearInterval(interval);
  }, [recalculating, fetchReport]);

  // When recalculation finishes, do one final refresh to show the latest data
  const prevRecalculating = React.useRef(false);
  useEffect(() => {
    if (prevRecalculating.current && !recalculating) {
      fetchReport(true);
    }
    prevRecalculating.current = recalculating;
  }, [recalculating, fetchReport]);

  // External refresh trigger (from PayrollContainer polling or manual refresh button)
  const isFirstReportTick = React.useRef(true);
  useEffect(() => {
    if (isFirstReportTick.current) { isFirstReportTick.current = false; return; }
    fetchReport(true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshTick]);

  // Get departments for filter
  const departments = useMemo(() => {
    if (!data?.staffSummary) return [];
    const depts = new Set(data.staffSummary.map(s => s.department).filter(Boolean));
    return Array.from(depts).sort();
  }, [data?.staffSummary]);

  // Filtered and sorted staff
  const filteredStaff = useMemo(() => {
    if (!data?.staffSummary) return [];
    let list = [...data.staffSummary];
    if (departmentFilter) {
      list = list.filter(s => s.department === departmentFilter);
    }
    return list.sort((a, b) => b.totalDeductions - a.totalDeductions);
  }, [data?.staffSummary, departmentFilter]);

  // Get staff detail breakdown from calendar data
  const getStaffBreakdown = useCallback((employeeNumber) => {
    if (!data?.calendar) return [];
    const entries = [];
    data.calendar.forEach(day => {
      ['lateness', 'earlyLeave', 'absence', 'other'].forEach(type => {
        day[type]?.forEach(event => {
          if (event.employeeNumber === employeeNumber) {
            entries.push({
              date: day.date,
              type,
              amount: event.amount,
              minutes: event.minutes,
              description: event.description
            });
          }
        });
      });
    });
    return entries.sort((a, b) => a.date.localeCompare(b.date));
  }, [data?.calendar]);

  const toggleStaff = (empNum) => {
    setExpandedStaff(prev => {
      const next = new Set(prev);
      if (next.has(empNum)) next.delete(empNum);
      else next.add(empNum);
      return next;
    });
  };

  const getPeriodLabel = () => {
    const [year, month] = period.split('-');
    const d = new Date(year, parseInt(month) - 1, 1);
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
  };

  const formatDate = (dateStr) => {
    try {
      const d = new Date(dateStr + 'T00:00:00');
      return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    } catch {
      return dateStr;
    }
  };

  const typeLabels = {
    lateness: 'Late Arrival',
    earlyLeave: 'Early Leave',
    absence: 'Absent',
    other: 'Other'
  };

  const typeColors = {
    lateness: 'text-orange-700',
    earlyLeave: 'text-yellow-700',
    absence: 'text-red-700',
    other: 'text-gray-700'
  };

  const handleExportXLSX = () => {
    if (!filteredStaff.length) return;
    setExporting(true);
    try {
      const headers = ['#', 'Employee', 'Department', 'Late Days', 'Absent Days', 'Lateness (₦)', 'Early Leave (₦)', 'Absence (₦)', 'Total (₦)'];
      const rows = filteredStaff.map((s, i) => [i+1, s.name, s.department||'', s.lateDays, s.absentDays, s.latenessAmount, s.earlyLeaveAmount, s.absenceAmount, s.totalDeductions]);
      rows.push(['','TOTAL','',totals.staff>0?filteredStaff.reduce((a,x)=>a+x.lateDays,0):0,filteredStaff.reduce((a,x)=>a+x.absentDays,0),totals.lateness,totals.earlyLeave,totals.absence,totals.total]);
      downloadXLSX(`deduction-report-${period}`, [{ name: 'Deduction Report', headers, rows }]);
    } finally { setExporting(false); }
  };

  const handleExportPDF = () => {
    if (!filteredStaff.length) return;
    setExporting(true);
    try {
      const summaryCards = [
        { label: 'Staff', value: totals.staff },
        { label: 'Lateness', value: `₦${fmtN(totals.lateness)}` },
        { label: 'Early Leave', value: `₦${fmtN(totals.earlyLeave)}` },
        { label: 'Absence', value: `₦${fmtN(totals.absence)}` },
        { label: 'Grand Total', value: `₦${fmtN(totals.total)}` }
      ];
      const columns = ['#', 'Employee', 'Department', 'Late Days', 'Absent Days', 'Lateness', 'Early Leave', 'Absence', 'Total'];
      const rows = filteredStaff.map((s, i) => [i+1, s.name, s.department||'', s.lateDays, s.absentDays,
        `₦${fmtN(s.latenessAmount)}`, `₦${fmtN(s.earlyLeaveAmount)}`, `₦${fmtN(s.absenceAmount)}`, `₦${fmtN(s.totalDeductions)}`]);
      const totalsRow = ['','TOTAL','',filteredStaff.reduce((a,x)=>a+x.lateDays,0),filteredStaff.reduce((a,x)=>a+x.absentDays,0),
        `₦${fmtN(totals.lateness)}`,`₦${fmtN(totals.earlyLeave)}`,`₦${fmtN(totals.absence)}`,`₦${fmtN(totals.total)}`];
      downloadPDF(`deduction-report-${period}`, 'Attendance Deduction Report', getPeriodLabel(), columns, rows,
        { summaryCards, totalsRow, columnStyles: [3, 4, 5, 6, 7, 8] });
    } finally { setExporting(false); }
  };

  // Print report
  const handlePrint = () => {
    window.print();
  };

  // Totals
  const totals = useMemo(() => {
    return {
      staff: filteredStaff.length,
      lateness: filteredStaff.reduce((s, x) => s + x.latenessAmount, 0),
      earlyLeave: filteredStaff.reduce((s, x) => s + x.earlyLeaveAmount, 0),
      absence: filteredStaff.reduce((s, x) => s + x.absenceAmount, 0),
      total: filteredStaff.reduce((s, x) => s + x.totalDeductions, 0)
    };
  }, [filteredStaff]);

  if (loading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="flex gap-4 mb-6">
          <SkeletonLine width="w-48" />
          <SkeletonLine width="w-48" />
        </div>
        {[1, 2, 3, 4, 5].map(i => (
          <div key={i} className="bg-white rounded-lg p-4 border border-gray-200">
            <SkeletonLine width={i % 2 === 0 ? "w-full" : "w-3/4"} />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-blue-600" />
            <h3 className="text-lg font-semibold text-gray-900">Deduction Report</h3>
          </div>

          <div className="flex flex-wrap items-center gap-3 sm:ml-auto">
            <input
              type="month"
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm bg-white text-gray-900"
            />

            {departments.length > 0 && (
              <select
                value={departmentFilter}
                onChange={(e) => setDepartmentFilter(e.target.value)}
                className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm bg-white text-gray-900"
              >
                <option value="">All Departments</option>
                {departments.map(d => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            )}

            <button
              onClick={handleExportXLSX}
              disabled={exporting || !filteredStaff.length}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-emerald-600 border border-emerald-700 rounded-lg hover:bg-emerald-700 disabled:opacity-50"
            >
              <Download className="w-4 h-4" />
              XLSX
            </button>
            <button
              onClick={handleExportPDF}
              disabled={exporting || !filteredStaff.length}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-red-600 border border-red-700 rounded-lg hover:bg-red-700 disabled:opacity-50"
            >
              <FileText className="w-4 h-4" />
              PDF
            </button>

            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-700 bg-gray-50 border border-gray-200 rounded-lg hover:bg-gray-100"
            >
              <Printer className="w-4 h-4" />
              Print
            </button>

            <button
              onClick={() => fetchReport(true)}
              disabled={refreshing}
              className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
          {error}
        </div>
      )}

      {/* Totals bar */}
      {filteredStaff.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-center">
            <div>
              <div className="text-xs text-gray-500 mb-1">Staff with Deductions</div>
              <div className="text-xl font-bold text-gray-900">{totals.staff}</div>
            </div>
            <div>
              <div className="text-xs text-gray-500 mb-1">Lateness Total</div>
              <div className="text-xl font-bold text-orange-600">₦{totals.lateness.toLocaleString()}</div>
            </div>
            <div>
              <div className="text-xs text-gray-500 mb-1">Early Leave Total</div>
              <div className="text-xl font-bold text-yellow-600">₦{totals.earlyLeave.toLocaleString()}</div>
            </div>
            <div>
              <div className="text-xs text-gray-500 mb-1">Absence Total</div>
              <div className="text-xl font-bold text-red-600">₦{totals.absence.toLocaleString()}</div>
            </div>
            <div>
              <div className="text-xs text-gray-500 mb-1">Grand Total</div>
              <div className="text-xl font-bold text-gray-900">₦{totals.total.toLocaleString()}</div>
            </div>
          </div>
        </div>
      )}

      {/* Recalculation in progress — shown while PayrollContainer's Recalculate Historical is running */}
      {recalculating && (
        <div className="mb-4 flex items-center gap-3 px-4 py-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
          <RotateCcw className="w-4 h-4 animate-spin flex-shrink-0" />
          <span>Recalculation in progress — refreshing every 15 seconds&hellip;</span>
        </div>
      )}

      {/* Employee list */}
      {!filteredStaff.length ? (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 text-center">
          <TrendingDown className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <h4 className="text-lg font-medium text-gray-700 mb-1">No Deductions Found</h4>
          <p className="text-sm text-gray-500">
            No staff deductions for {getPeriodLabel()}.
            {departmentFilter ? ' Try removing the department filter.' : ''}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filteredStaff.map((staff, idx) => (
            <StaffDeductionRow
              key={staff.employeeNumber}
              staff={staff}
              rank={idx + 1}
              expanded={expandedStaff.has(staff.employeeNumber)}
              onToggle={() => toggleStaff(staff.employeeNumber)}
              breakdown={expandedStaff.has(staff.employeeNumber) ? getStaffBreakdown(staff.employeeNumber) : []}
              formatDate={formatDate}
              typeLabels={typeLabels}
              typeColors={typeColors}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function StaffDeductionRow({ staff, rank, expanded, onToggle, breakdown, formatDate, typeLabels, typeColors }) {
  const hasHighDeduction = staff.totalDeductions > 10000;

  return (
    <div className={`bg-white rounded-lg shadow-sm border ${hasHighDeduction ? 'border-red-200' : 'border-gray-200'}`}>
      <button
        onClick={onToggle}
        className="w-full px-4 py-3 flex items-center gap-3 hover:bg-gray-50 transition-colors"
      >
        {expanded ? (
          <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" />
        ) : (
          <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0" />
        )}

        {/* Rank */}
        <span className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
          rank <= 3 ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600'
        }`}>
          {rank}
        </span>

        {/* Name */}
        <div className="flex-1 text-left min-w-0">
          <div className="font-medium text-gray-900 text-sm truncate">{staff.name}</div>
          <div className="text-xs text-gray-500">{staff.department || 'No department'}</div>
        </div>

        {/* Badges */}
        <div className="hidden md:flex items-center gap-2">
          {staff.lateDays > 0 && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
              <Clock className="w-3 h-3" /> {staff.lateDays}d
            </span>
          )}
          {staff.absentDays > 0 && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
              <UserX className="w-3 h-3" /> {staff.absentDays}d
            </span>
          )}
        </div>

        {/* Amount */}
        <div className="text-right flex-shrink-0">
          <span className="text-sm font-bold text-gray-900">₦{staff.totalDeductions.toLocaleString()}</span>
        </div>
      </button>

      {/* Expanded breakdown */}
      {expanded && breakdown.length > 0 && (
        <div className="border-t border-gray-100 px-4 py-3">
          {/* Mini summary */}
          <div className="flex flex-wrap gap-3 mb-3 text-xs">
            {staff.latenessAmount > 0 && (
              <span className="text-orange-700">Lateness: ₦{staff.latenessAmount.toLocaleString()}</span>
            )}
            {staff.earlyLeaveAmount > 0 && (
              <span className="text-yellow-700">Early Leave: ₦{staff.earlyLeaveAmount.toLocaleString()}</span>
            )}
            {staff.absenceAmount > 0 && (
              <span className="text-red-700">Absence: ₦{staff.absenceAmount.toLocaleString()}</span>
            )}
          </div>

          {/* Day-by-day breakdown */}
          <div className="space-y-1">
            {breakdown.map((entry, i) => (
              <div key={i} className="flex items-center justify-between text-sm py-1 border-b border-gray-50 last:border-0">
                <div className="flex items-center gap-3">
                  <span className="text-gray-500 text-xs w-24">{formatDate(entry.date)}</span>
                  <span className={`font-medium ${typeColors[entry.type] || 'text-gray-700'}`}>
                    {typeLabels[entry.type] || entry.type}
                  </span>
                  {entry.minutes > 0 && (
                    <span className="text-gray-400 text-xs">({entry.minutes} min)</span>
                  )}
                  {entry.description && (
                    <span className="text-gray-400 text-xs hidden md:inline">{entry.description}</span>
                  )}
                </div>
                <span className="font-semibold text-gray-900">₦{entry.amount.toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {expanded && breakdown.length === 0 && (
        <div className="border-t border-gray-100 px-4 py-3 text-sm text-gray-500 text-center">
          No detailed breakdown available for this period.
        </div>
      )}
    </div>
  );
}

export default DeductionReport;
