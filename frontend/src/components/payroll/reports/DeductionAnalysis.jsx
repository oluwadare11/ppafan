// DeductionAnalysis.jsx - Deduction Analysis Report Component
// Phase 3: Analyze deductions by category and type

import React, { useState, useEffect, useCallback } from 'react';
import { useTenant } from '../../../context/TenantProvider.jsx';
import {
  PieChart,
  TrendingDown,
  DollarSign,
  Users,
  Percent,
  Download,
  FileText,
  BarChart3
} from 'lucide-react';
import { downloadXLSX, downloadPDF, fmtN } from './exportUtils';

import { SkeletonLine } from '../shared';

function DeductionAnalysis({ period, startPeriod, endPeriod, setError }) {
  const { makeRequest } = useTenant();

  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [departmentFilter, setDepartmentFilter] = useState('');

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

      if (departmentFilter) params.append('department', departmentFilter);

      const response = await makeRequest(`/api/payroll/reports/deduction-analysis?${params}`);
      setReport(response);
    } catch (err) {
      console.error('Error fetching deduction analysis:', err);
      setError('Failed to load deduction analysis report');
    } finally {
      setLoading(false);
    }
  }, [period, startPeriod, endPeriod, departmentFilter, makeRequest, setError]);

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

  // Category colors
  const categoryColors = {
    statutory: { bg: 'bg-blue-500', text: 'text-blue-600', light: 'bg-blue-100/30' },
    attendance: { bg: 'bg-yellow-500', text: 'text-yellow-600', light: 'bg-yellow-100/30' },
    loans: { bg: 'bg-orange-500', text: 'text-orange-600', light: 'bg-orange-100/30' },
    other: { bg: 'bg-purple-500', text: 'text-purple-600', light: 'bg-purple-100/30' }
  };

  const handleExportXLSX = () => {
    try {
      if (!report) { setError('No data to export'); return; }
      const periodLabel = period || `${startPeriod}-to-${endPeriod}`;
      const totalDeds = report.summary?.totalDeductions || 0;
      const headers = ['Category','Deduction Type','Affected Employees','Average','% of Gross','Total Amount','% of Total Deductions'];
      const rows = [];
      Object.entries(report.byCategory || {}).forEach(([catKey, cat]) => {
        (cat.items || []).forEach(item => {
          const pct = totalDeds > 0 ? ((item.total||item.amount||0)/totalDeds*100).toFixed(1) : '0.0';
          rows.push([cat.label||catKey, item.label||item.name||'', item.count||0, item.average||0,
            item.percentageOfGross||0, item.total||item.amount||0, pct+'%']);
        });
      });
      const s = report.summary || {};
      rows.push(['','TOTAL','','','',s.totalDeductions||0,'100%']);
      downloadXLSX(`deduction-analysis-${periodLabel}`, [{ name: 'Deduction Analysis', headers, rows }]);
    } catch { setError('Failed to export'); }
  };

  const handleExportPDF = () => {
    try {
      if (!report) { setError('No data to export'); return; }
      const periodLabel = period || `${startPeriod}-to-${endPeriod}`;
      const s = report.summary || {};
      const totalDeds = s.totalDeductions || 0;
      const summaryCards = [
        { label: 'Employees', value: s.employeeCount || 0 },
        { label: 'Total Gross', value: `₦${fmtN(s.totalGross)}` },
        { label: 'Total Deductions', value: `₦${fmtN(s.totalDeductions)}` },
        { label: 'Deduction Rate', value: `${s.deductionRate || 0}%` }
      ];
      const columns = ['Category','Type','Count','Average','% of Gross','Total','% of Total'];
      const rows = [];
      Object.entries(report.byCategory || {}).forEach(([catKey, cat]) => {
        (cat.items || []).forEach(item => {
          const pct = totalDeds > 0 ? ((item.total||item.amount||0)/totalDeds*100).toFixed(1) : '0.0';
          rows.push([cat.label||catKey, item.label||item.name||'', item.count||0,
            `₦${fmtN(item.average)}`, `${item.percentageOfGross||0}%`, `₦${fmtN(item.total||item.amount)}`, pct+'%']);
        });
      });
      const totalsRow = ['','TOTAL','','','',`₦${fmtN(s.totalDeductions)}`,'100%'];
      downloadPDF(`deduction-analysis-${periodLabel}`, 'Deduction Analysis Report', periodLabel, columns, rows,
        { summaryCards, totalsRow, columnStyles: [2, 3, 5] });
    } catch { setError('Failed to export'); }
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
        No data available
      </div>
    );
  }

  // Calculate total deductions across all categories
  const totalAllCategories = (report.byCategory?.statutory?.subtotal || 0) +
    (report.byCategory?.attendance?.subtotal || 0) +
    (report.byCategory?.other?.subtotal || 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">
              Deduction Analysis
            </h3>
            <p className="text-sm text-gray-500">
              Period: {report.period} | {report.summary?.employeeCount || 0} employees
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

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="flex items-center gap-2 text-gray-500 mb-1">
            <DollarSign className="w-4 h-4" />
            <span className="text-sm">Total Gross</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">
            ₦{formatCurrency(report.summary?.totalGross)}
          </p>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="flex items-center gap-2 text-gray-500 mb-1">
            <TrendingDown className="w-4 h-4" />
            <span className="text-sm">Total Deductions</span>
          </div>
          <p className="text-2xl font-bold text-red-600">
            ₦{formatCurrency(report.summary?.totalDeductions)}
          </p>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="flex items-center gap-2 text-gray-500 mb-1">
            <DollarSign className="w-4 h-4" />
            <span className="text-sm">Total Net</span>
          </div>
          <p className="text-2xl font-bold text-green-600">
            ₦{formatCurrency(report.summary?.totalNet)}
          </p>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="flex items-center gap-2 text-gray-500 mb-1">
            <Percent className="w-4 h-4" />
            <span className="text-sm">Deduction Rate</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">
            {report.summary?.deductionRate || 0}%
          </p>
        </div>
      </div>

      {/* Visual Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Category Distribution */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h4 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <PieChart className="w-5 h-5" />
            Deduction Distribution
          </h4>

          <div className="space-y-4">
            {Object.entries(report.byCategory || {}).map(([key, category]) => {
              const percentage = totalAllCategories > 0
                ? ((category.subtotal / totalAllCategories) * 100).toFixed(1)
                : 0;

              return (
                <div key={key}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium text-gray-700">{category.label}</span>
                    <span className={categoryColors[key]?.text}>
                      ₦{formatCurrency(category.subtotal)} ({percentage}%)
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-3">
                    <div
                      className={`${categoryColors[key]?.bg} h-3 rounded-full transition-all duration-500`}
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Top Deductions */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h4 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <BarChart3 className="w-5 h-5" />
            Top Deductions
          </h4>

          <div className="space-y-3">
            {/* Combine all items and sort by total */}
            {Object.entries(report.byCategory || {})
              .flatMap(([categoryKey, category]) =>
                (category.items || []).map(item => ({
                  ...item,
                  categoryKey,
                  categoryLabel: category.label
                }))
              )
              .sort((a, b) => b.total - a.total)
              .slice(0, 8)
              .map((item, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-2 h-8 rounded ${categoryColors[item.categoryKey]?.bg}`} />
                    <div>
                      <p className="font-medium text-gray-900">{item.label}</p>
                      <p className="text-xs text-gray-500">{item.count} affected | Avg: ₦{formatCurrency(item.average)}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-gray-900">
                      ₦{formatCurrency(item.total)}
                    </p>
                    <p className="text-xs text-gray-500">{item.percentageOfGross}% of gross</p>
                  </div>
                </div>
              ))
            }
          </div>
        </div>
      </div>

      {/* Detailed Breakdown by Category */}
      <div className="space-y-4">
        {Object.entries(report.byCategory || {}).map(([key, category]) => (
          <div
            key={key}
            className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden"
          >
            <div className={`px-4 py-3 ${categoryColors[key]?.light} border-b border-gray-200`}>
              <div className="flex items-center justify-between">
                <h4 className="font-semibold text-gray-900">{category.label}</h4>
                <span className={`font-bold ${categoryColors[key]?.text}`}>
                  ₦{formatCurrency(category.subtotal)}
                </span>
              </div>
            </div>

            {category.items && category.items.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Count</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Average</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">% of Gross</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {category.items.map((item, idx) => (
                      <tr key={idx} className="hover:bg-gray-50/50">
                        <td className="px-4 py-3 font-medium text-gray-900">
                          {item.label}
                        </td>
                        <td className="px-4 py-3 text-right text-gray-600">
                          {item.count}
                        </td>
                        <td className="px-4 py-3 text-right text-gray-600">
                          ₦{formatCurrency(item.average)}
                        </td>
                        <td className="px-4 py-3 text-right text-gray-600">
                          {item.percentageOfGross}%
                        </td>
                        <td className={`px-4 py-3 text-right font-semibold ${categoryColors[key]?.text}`}>
                          ₦{formatCurrency(item.total)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-4 text-center text-gray-500">
                No deductions in this category
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export default DeductionAnalysis;
