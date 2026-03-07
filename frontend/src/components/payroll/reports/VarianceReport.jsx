// VarianceReport.jsx - Period-to-Period Variance Report
// Phase 3: Compare payroll between periods

import React, { useState, useEffect, useCallback } from 'react';
import { useTenant } from '../../../context/TenantProvider.jsx';
import {
  TrendingUp,
  TrendingDown,
  ArrowRight,
  Users,
  UserPlus,
  UserMinus,
  DollarSign,
  Download,
  FileText,
  AlertTriangle,
  CheckCircle
} from 'lucide-react';
import { downloadXLSX, downloadPDF, fmtN } from './exportUtils';

import { SkeletonLine } from '../shared';

function VarianceReport({ availablePeriods, setError }) {
  const { makeRequest } = useTenant();

  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [currentPeriod, setCurrentPeriod] = useState('');
  const [previousPeriod, setPreviousPeriod] = useState('');

  // Set default periods
  useEffect(() => {
    if (availablePeriods.length >= 2) {
      setCurrentPeriod(availablePeriods[0]);
      setPreviousPeriod(availablePeriods[1]);
    } else if (availablePeriods.length === 1) {
      setCurrentPeriod(availablePeriods[0]);
    }
  }, [availablePeriods]);

  // Fetch variance report
  const fetchReport = useCallback(async () => {
    if (!currentPeriod || !previousPeriod) return;

    try {
      setLoading(true);
      const params = new URLSearchParams({
        currentPeriod,
        previousPeriod
      });

      const response = await makeRequest(`/api/payroll/reports/variance?${params}`);
      setReport(response);
    } catch (err) {
      console.error('Error fetching variance report:', err);
      setError('Failed to load variance report');
    } finally {
      setLoading(false);
    }
  }, [currentPeriod, previousPeriod, makeRequest, setError]);

  useEffect(() => {
    if (currentPeriod && previousPeriod) {
      fetchReport();
    }
  }, [fetchReport, currentPeriod, previousPeriod]);

  // Format currency
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-NG', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(Math.abs(amount || 0));
  };

  // Get period label
  const getPeriodLabel = (period) => {
    if (!period) return '';
    const [year, month] = period.split('-');
    const date = new Date(year, parseInt(month) - 1, 1);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short' });
  };

  // Variance indicator component
  const VarianceIndicator = ({ current, previous, difference, percentChange, format = 'number', inverse = false }) => {
    const isPositive = difference > 0;
    const isSignificant = Math.abs(parseFloat(percentChange)) >= 5;

    // For some metrics like deductions, an increase is negative
    const color = inverse
      ? (isPositive ? 'text-red-600' : 'text-green-600')
      : (isPositive ? 'text-green-600' : 'text-red-600');

    return (
      <div className="flex items-center gap-2">
        <span className={`flex items-center gap-1 ${color}`}>
          {isPositive ? (
            <TrendingUp className="w-4 h-4" />
          ) : difference < 0 ? (
            <TrendingDown className="w-4 h-4" />
          ) : null}
          {format === 'currency' ? (
            <span>{isPositive ? '+' : '-'}₦{formatCurrency(difference)}</span>
          ) : (
            <span>{isPositive ? '+' : ''}{difference}</span>
          )}
        </span>
        {percentChange !== 'N/A' && (
          <span className={`text-sm ${isSignificant ? 'font-semibold' : ''} ${color}`}>
            ({isPositive ? '+' : ''}{percentChange}%)
          </span>
        )}
      </div>
    );
  };

  const handleExportXLSX = () => {
    try {
      if (!report?.variances) { setError('No data to export'); return; }
      const variances = report.variances || {};
      const summaryHeaders = ['Metric', `${getPeriodLabel(previousPeriod)} (Previous)`, `${getPeriodLabel(currentPeriod)} (Current)`, 'Difference', '% Change'];
      const summaryRows = Object.entries(variances).map(([key, v]) => {
        const label = key.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase());
        const isCount = key === 'employeeCount';
        return [label, isCount ? (v.previous??0) : (v.previous||0), isCount ? (v.current??0) : (v.current||0),
          v.difference ?? 0, v.percentChange != null ? v.percentChange.toFixed(1)+'%' : 'N/A'];
      });
      const empHeaders = ['Employee Name','Current Gross','Previous Gross','Difference','% Change'];
      const empRows = (report.employeeVariances || []).map(e => [
        e.employeeName||'', e.currentGross||0, e.previousGross||0, e.grossDifference||0,
        e.percentChange != null ? e.percentChange.toFixed(1)+'%' : 'N/A'
      ]);
      const sheets = [{ name: 'Summary', headers: summaryHeaders, rows: summaryRows }];
      if (empRows.length) sheets.push({ name: 'Employee Detail', headers: empHeaders, rows: empRows });
      downloadXLSX(`variance-report-${currentPeriod}-vs-${previousPeriod}`, sheets);
    } catch { setError('Failed to export'); }
  };

  const handleExportPDF = () => {
    try {
      if (!report?.variances) { setError('No data to export'); return; }
      const variances = report.variances || {};
      const columns = ['Metric', `${getPeriodLabel(previousPeriod)}`, `${getPeriodLabel(currentPeriod)}`, 'Change', '% Change'];
      const rows = Object.entries(variances).map(([key, v]) => {
        const label = key.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase());
        const isCount = key === 'employeeCount';
        const diff = v.difference ?? 0;
        return [label,
          isCount ? String(v.previous??0) : `₦${fmtN(v.previous)}`,
          isCount ? String(v.current??0) : `₦${fmtN(v.current)}`,
          isCount ? (diff>0?'+':'')+diff : (diff>0?'+':'-')+'₦'+fmtN(diff),
          v.percentChange != null ? (parseFloat(v.percentChange)>0?'+':'')+parseFloat(v.percentChange).toFixed(1)+'%' : 'N/A'
        ];
      });
      downloadPDF(`variance-report-${currentPeriod}-vs-${previousPeriod}`, 'Payroll Variance Report',
        `${getPeriodLabel(previousPeriod)} vs ${getPeriodLabel(currentPeriod)}`, columns, rows,
        { columnStyles: [1, 2, 3] });
    } catch { setError('Failed to export'); }
  };

  if (availablePeriods.length < 2) {
    return (
      <div className="bg-yellow-50/20 border border-yellow-200 rounded-lg p-6 text-center">
        <AlertTriangle className="w-10 h-10 text-yellow-500 mx-auto mb-3" />
        <h4 className="text-lg font-medium text-yellow-800 mb-2">
          Insufficient Data
        </h4>
        <p className="text-yellow-600 text-sm">
          Variance reports require at least two periods of payroll data.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Period Selection */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Current Period
              </label>
              <select
                value={currentPeriod}
                onChange={(e) => setCurrentPeriod(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 text-sm"
              >
                {availablePeriods.map(period => (
                  <option key={period} value={period}>
                    {getPeriodLabel(period)}
                  </option>
                ))}
              </select>
            </div>

            <ArrowRight className="w-5 h-5 text-gray-400 mt-6" />

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Compare With
              </label>
              <select
                value={previousPeriod}
                onChange={(e) => setPreviousPeriod(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 text-sm"
              >
                {availablePeriods.filter(p => p !== currentPeriod).map(period => (
                  <option key={period} value={period}>
                    {getPeriodLabel(period)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleExportXLSX}
              disabled={!report}
              className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-400 text-white text-sm font-medium rounded-lg transition-colors"
            >
              <Download className="w-4 h-4" />
              XLSX
            </button>
            <button
              onClick={handleExportPDF}
              disabled={!report}
              className="flex items-center gap-1.5 px-3 py-2 bg-red-600 hover:bg-red-700 disabled:bg-gray-400 text-white text-sm font-medium rounded-lg transition-colors"
            >
              <FileText className="w-4 h-4" />
              PDF
            </button>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="animate-pulse space-y-3">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(i => (
            <SkeletonLine key={i} width={i % 2 === 0 ? "w-full" : "w-3/4"} />
          ))}
        </div>
      ) : report ? (
        <>
          {/* Key Metrics Variance */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Employee Count */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
              <div className="flex items-center gap-2 text-gray-500 mb-3">
                <Users className="w-4 h-4" />
                <span className="text-sm font-medium">Employee Count</span>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-2xl font-bold text-gray-900">
                    {report.variances?.employeeCount?.current || 0}
                  </p>
                  <p className="text-sm text-gray-500">vs {report.variances?.employeeCount?.previous || 0}</p>
                </div>
                <VarianceIndicator
                  difference={report.variances?.employeeCount?.difference}
                  percentChange={report.variances?.employeeCount?.percentChange}
                />
              </div>
            </div>

            {/* Gross Salary */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
              <div className="flex items-center gap-2 text-gray-500 mb-3">
                <DollarSign className="w-4 h-4" />
                <span className="text-sm font-medium">Gross Payroll</span>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-2xl font-bold text-gray-900">
                    ₦{formatCurrency(report.variances?.grossSalary?.current)}
                  </p>
                  <p className="text-sm text-gray-500">vs ₦{formatCurrency(report.variances?.grossSalary?.previous)}</p>
                </div>
                <VarianceIndicator
                  difference={report.variances?.grossSalary?.difference}
                  percentChange={report.variances?.grossSalary?.percentChange}
                  format="currency"
                />
              </div>
            </div>

            {/* Net Salary */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
              <div className="flex items-center gap-2 text-gray-500 mb-3">
                <DollarSign className="w-4 h-4" />
                <span className="text-sm font-medium">Net Payroll</span>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-2xl font-bold text-green-600">
                    ₦{formatCurrency(report.variances?.netSalary?.current)}
                  </p>
                  <p className="text-sm text-gray-500">vs ₦{formatCurrency(report.variances?.netSalary?.previous)}</p>
                </div>
                <VarianceIndicator
                  difference={report.variances?.netSalary?.difference}
                  percentChange={report.variances?.netSalary?.percentChange}
                  format="currency"
                />
              </div>
            </div>

            {/* Total Deductions */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
              <div className="flex items-center gap-2 text-gray-500 mb-3">
                <TrendingDown className="w-4 h-4" />
                <span className="text-sm font-medium">Total Deductions</span>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-2xl font-bold text-red-600">
                    ₦{formatCurrency(report.variances?.totalDeductions?.current)}
                  </p>
                  <p className="text-sm text-gray-500">vs ₦{formatCurrency(report.variances?.totalDeductions?.previous)}</p>
                </div>
                <VarianceIndicator
                  difference={report.variances?.totalDeductions?.difference}
                  percentChange={report.variances?.totalDeductions?.percentChange}
                  format="currency"
                  inverse
                />
              </div>
            </div>

            {/* Overtime */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
              <div className="flex items-center gap-2 text-gray-500 mb-3">
                <TrendingUp className="w-4 h-4" />
                <span className="text-sm font-medium">Overtime Pay</span>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-2xl font-bold text-blue-600">
                    ₦{formatCurrency(report.variances?.overtimePay?.current)}
                  </p>
                  <p className="text-sm text-gray-500">vs ₦{formatCurrency(report.variances?.overtimePay?.previous)}</p>
                </div>
                <VarianceIndicator
                  difference={report.variances?.overtimePay?.difference}
                  percentChange={report.variances?.overtimePay?.percentChange}
                  format="currency"
                />
              </div>
            </div>

            {/* Attendance Deductions */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
              <div className="flex items-center gap-2 text-gray-500 mb-3">
                <AlertTriangle className="w-4 h-4" />
                <span className="text-sm font-medium">Attendance Deductions</span>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-2xl font-bold text-yellow-600">
                    ₦{formatCurrency((report.variances?.latenessDeduction?.current || 0) + (report.variances?.absenceDeduction?.current || 0))}
                  </p>
                  <p className="text-sm text-gray-500">
                    vs ₦{formatCurrency((report.variances?.latenessDeduction?.previous || 0) + (report.variances?.absenceDeduction?.previous || 0))}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Employee Changes */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* New Employees */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
              <div className="flex items-center gap-2 text-green-600 mb-3">
                <UserPlus className="w-5 h-5" />
                <span className="font-medium">New Employees</span>
                <span className="ml-auto bg-green-100/30 text-green-800 px-2 py-0.5 rounded-full text-sm">
                  {report.employeeChanges?.newEmployees?.length || 0}
                </span>
              </div>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {report.employeeChanges?.newEmployees?.length > 0 ? (
                  report.employeeChanges.newEmployees.map((emp, idx) => (
                    <div key={idx} className="flex items-center justify-between p-2 bg-green-50/20 rounded-lg">
                      <span className="text-sm font-medium text-gray-900">{emp.employeeName}</span>
                      <span className="text-xs text-gray-500">{emp.employeeNumber}</span>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-gray-500 text-center py-2">No new employees</p>
                )}
              </div>
            </div>

            {/* Left Employees */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
              <div className="flex items-center gap-2 text-red-600 mb-3">
                <UserMinus className="w-5 h-5" />
                <span className="font-medium">Left Employees</span>
                <span className="ml-auto bg-red-100/30 text-red-800 px-2 py-0.5 rounded-full text-sm">
                  {report.employeeChanges?.leftEmployees?.length || 0}
                </span>
              </div>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {report.employeeChanges?.leftEmployees?.length > 0 ? (
                  report.employeeChanges.leftEmployees.map((emp, idx) => (
                    <div key={idx} className="flex items-center justify-between p-2 bg-red-50/20 rounded-lg">
                      <span className="text-sm font-medium text-gray-900">{emp.employeeName}</span>
                      <span className="text-xs text-gray-500">{emp.employeeNumber}</span>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-gray-500 text-center py-2">No employees left</p>
                )}
              </div>
            </div>

            {/* Salary Changes */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
              <div className="flex items-center gap-2 text-blue-600 mb-3">
                <DollarSign className="w-5 h-5" />
                <span className="font-medium">Salary Changes</span>
                <span className="ml-auto bg-blue-100/30 text-blue-800 px-2 py-0.5 rounded-full text-sm">
                  {report.employeeChanges?.salaryChanges?.length || 0}
                </span>
              </div>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {report.employeeChanges?.salaryChanges?.length > 0 ? (
                  report.employeeChanges.salaryChanges.map((emp, idx) => (
                    <div key={idx} className="p-2 bg-blue-50/20 rounded-lg">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-gray-900">{emp.employeeName}</span>
                        <span className={`text-sm font-medium ${emp.change > 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {emp.change > 0 ? '+' : ''}₦{formatCurrency(emp.change)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-xs text-gray-500 mt-1">
                        <span>₦{formatCurrency(emp.previousSalary)} → ₦{formatCurrency(emp.currentSalary)}</span>
                        <span className={emp.change > 0 ? 'text-green-600' : 'text-red-600'}>
                          ({emp.percentChange}%)
                        </span>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-gray-500 text-center py-2">No salary changes</p>
                )}
              </div>
            </div>
          </div>

          {/* Detailed Variance Table */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-200">
              <h4 className="font-semibold text-gray-900">Detailed Variance Summary</h4>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Metric</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">{getPeriodLabel(previousPeriod)}</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">{getPeriodLabel(currentPeriod)}</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Change</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">% Change</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {Object.entries(report.variances || {}).map(([key, variance]) => (
                    <tr key={key} className="hover:bg-gray-50/50">
                      <td className="px-4 py-3 font-medium text-gray-900 capitalize">
                        {key.replace(/([A-Z])/g, ' $1').trim()}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-600">
                        {key === 'employeeCount' ? variance.previous : `₦${formatCurrency(variance.previous)}`}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-900">
                        {key === 'employeeCount' ? variance.current : `₦${formatCurrency(variance.current)}`}
                      </td>
                      <td className={`px-4 py-3 text-right font-medium ${
                        variance.difference > 0 ? 'text-green-600' : variance.difference < 0 ? 'text-red-600' : 'text-gray-500'
                      }`}>
                        {key === 'employeeCount'
                          ? (variance.difference > 0 ? '+' : '') + variance.difference
                          : (variance.difference > 0 ? '+' : '-') + '₦' + formatCurrency(variance.difference)
                        }
                      </td>
                      <td className={`px-4 py-3 text-right ${
                        parseFloat(variance.percentChange) > 0 ? 'text-green-600' : parseFloat(variance.percentChange) < 0 ? 'text-red-600' : 'text-gray-500'
                      }`}>
                        {variance.percentChange !== 'N/A'
                          ? (parseFloat(variance.percentChange) > 0 ? '+' : '') + variance.percentChange + '%'
                          : 'N/A'
                        }
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : (
        <div className="text-center py-8 text-gray-500">
          Select periods to compare
        </div>
      )}
    </div>
  );
}

export default VarianceReport;
