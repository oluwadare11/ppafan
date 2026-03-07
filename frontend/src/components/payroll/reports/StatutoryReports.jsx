// StatutoryReports.jsx - Statutory Reports (PAYE, Pension, NHF, NHIS, ITF, NSITF)
// Phase 3: Compliance reports for regulatory bodies

import React, { useState, useEffect, useCallback } from 'react';
import { useTenant } from '../../../context/TenantProvider.jsx';
import {
  Building2,
  Download,
  Users,
  DollarSign,
  FileText,
  ChevronDown,
  ChevronRight,
  Landmark,
  Shield,
  Heart,
  GraduationCap,
  HardHat
} from 'lucide-react';
import { downloadXLSX, downloadPDF, fmtN } from './exportUtils';

import { SkeletonLine } from '../shared';

const REPORT_TYPES = [
  { id: 'paye', label: 'PAYE Tax', icon: Landmark, color: 'blue', description: 'Pay As You Earn tax report' },
  { id: 'pension', label: 'Pension', icon: Shield, color: 'green', description: 'Pension contribution report' },
  { id: 'nhf', label: 'NHF', icon: Building2, color: 'purple', description: 'National Housing Fund' },
  { id: 'nhis', label: 'NHIS', icon: Heart, color: 'red', description: 'National Health Insurance' },
  { id: 'itf', label: 'ITF', icon: GraduationCap, color: 'yellow', description: 'Industrial Training Fund' },
  { id: 'nsitf', label: 'NSITF', icon: HardHat, color: 'orange', description: 'Social Insurance Trust Fund' }
];

function StatutoryReports({ period, startPeriod, endPeriod, setError }) {
  const { makeRequest } = useTenant();

  const [selectedReport, setSelectedReport] = useState('paye');
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [expandedPfa, setExpandedPfa] = useState(null);

  // Fetch selected report
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

      const response = await makeRequest(`/api/payroll/reports/statutory/${selectedReport}?${params}`);
      setReport(response);
    } catch (err) {
      console.error(`Error fetching ${selectedReport} report:`, err);
      setError(`Failed to load ${selectedReport.toUpperCase()} report`);
    } finally {
      setLoading(false);
    }
  }, [period, startPeriod, endPeriod, selectedReport, makeRequest, setError]);

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

  // Export handlers
  const getExportData = () => {
    if (!report) return null;
    const employees = report.employees || [];
    const periodLabel = period || `${startPeriod}-to-${endPeriod}`;
    const filename = `${selectedReport}-report-${periodLabel}`;
    const title = `${selectedReport.toUpperCase()} Statutory Report`;

    let headers, rows, columns, pdfRows, summaryCards, totalsRow;
    if (selectedReport === 'paye') {
      headers = ['Emp #','Employee Name','Department','Gross Income','Taxable Income','PAYE Tax'];
      rows = employees.map(e => [e.employeeNumber||'', e.employeeName||'', e.department||'', e.totalGross||0, e.totalTaxableIncome||0, e.totalPaye||0]);
      columns = headers;
      pdfRows = employees.map(e => [e.employeeNumber||'', e.employeeName||'', e.department||'', `₦${fmtN(e.totalGross)}`, `₦${fmtN(e.totalTaxableIncome)}`, `₦${fmtN(e.totalPaye)}`]);
      totalsRow = ['','TOTAL','',`₦${fmtN(report.totals?.totalGross)}`,`₦${fmtN(report.totals?.totalTaxableIncome)}`,`₦${fmtN(report.totals?.totalPaye)}`];
      summaryCards = [
        { label: 'Employees', value: report.totals?.employeeCount || 0 },
        { label: 'Total Gross', value: `₦${fmtN(report.totals?.totalGross)}` },
        { label: 'Taxable Income', value: `₦${fmtN(report.totals?.totalTaxableIncome)}` },
        { label: 'Total PAYE', value: `₦${fmtN(report.totals?.totalPaye)}` }
      ];
    } else if (selectedReport === 'pension') {
      headers = ['Emp #','Employee Name','PFA','Gross','Employee Contr.','Employer Contr.','Total'];
      rows = employees.map(e => [e.employeeNumber||'', e.employeeName||'', e.pfaName||'', e.totalGross||0, e.employeeContribution||0, e.employerContribution||0, e.totalContribution||0]);
      columns = headers;
      pdfRows = employees.map(e => [e.employeeNumber||'', e.employeeName||'', e.pfaName||'', `₦${fmtN(e.totalGross)}`, `₦${fmtN(e.employeeContribution)}`, `₦${fmtN(e.employerContribution)}`, `₦${fmtN(e.totalContribution)}`]);
      totalsRow = ['','TOTAL','','',`₦${fmtN(report.totals?.totalEmployeeContribution)}`,`₦${fmtN(report.totals?.totalEmployerContribution)}`,`₦${fmtN(report.totals?.totalContribution)}`];
      summaryCards = [
        { label: 'Employees', value: report.totals?.employeeCount || 0 },
        { label: 'Employee Contrib.', value: `₦${fmtN(report.totals?.totalEmployeeContribution)}` },
        { label: 'Employer Contrib.', value: `₦${fmtN(report.totals?.totalEmployerContribution)}` },
        { label: 'Total', value: `₦${fmtN(report.totals?.totalContribution)}` }
      ];
    } else {
      headers = ['Emp #','Employee Name','Department','Gross','Contribution'];
      rows = employees.map(e => [e.employeeNumber||'', e.employeeName||'', e.department||'', e.grossSalary||e.totalGross||0, e.contribution||e.amount||e.totalContribution||0]);
      columns = headers;
      pdfRows = employees.map(e => [e.employeeNumber||'', e.employeeName||'', e.department||'', `₦${fmtN(e.grossSalary||e.totalGross)}`, `₦${fmtN(e.contribution||e.amount||e.totalContribution)}`]);
      totalsRow = ['','TOTAL','','',`₦${fmtN(report.totals?.totalContribution)}`];
      summaryCards = [
        { label: 'Employees', value: report.totals?.employeeCount || 0 },
        { label: 'Total Contribution', value: `₦${fmtN(report.totals?.totalContribution)}` }
      ];
    }
    return { filename, title, periodLabel, headers, rows, columns, pdfRows, summaryCards, totalsRow };
  };

  const handleExportXLSX = () => {
    try {
      const d = getExportData();
      if (!d) { setError('No data to export'); return; }
      downloadXLSX(d.filename, [{ name: d.title, headers: d.headers, rows: d.rows }]);
    } catch { setError('Failed to export'); }
  };

  const handleExportPDF = () => {
    try {
      const d = getExportData();
      if (!d) { setError('No data to export'); return; }
      const numericCols = d.columns.map((_, i) => i).filter(i => i >= 3);
      downloadPDF(d.filename, d.title, d.periodLabel, d.columns, d.pdfRows,
        { summaryCards: d.summaryCards, totalsRow: d.totalsRow, columnStyles: numericCols });
    } catch { setError('Failed to export'); }
  };

  // Render report content based on type
  const renderReportContent = () => {
    if (loading) {
      return (
        <div className="animate-pulse space-y-3">
          {[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
            <SkeletonLine key={i} width={i % 2 === 0 ? "w-full" : "w-3/4"} />
          ))}
        </div>
      );
    }

    if (!report) {
      return (
        <div className="text-center py-8 text-gray-500">
          No data available for this report
        </div>
      );
    }

    switch (selectedReport) {
      case 'paye':
        return renderPAYEReport();
      case 'pension':
        return renderPensionReport();
      case 'nhf':
      case 'nhis':
        return renderContributionReport();
      case 'itf':
      case 'nsitf':
        return renderEmployerReport();
      default:
        return null;
    }
  };

  // PAYE Report
  const renderPAYEReport = () => (
    <div className="space-y-4">
      {/* Tax Authority Info */}
      {report.taxAuthority && (
        <div className="bg-blue-50/20 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center gap-2 text-blue-800 mb-2">
            <Landmark className="w-5 h-5" />
            <span className="font-medium">Tax Authority: {report.taxAuthority.state} State IRS</span>
          </div>
          {report.taxAuthority.lirs && (
            <p className="text-sm text-blue-600">
              LIRS ID: {report.taxAuthority.lirs}
            </p>
          )}
        </div>
      )}

      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <SummaryCard
          label="Total Employees"
          value={report.totals?.employeeCount || 0}
          icon={Users}
        />
        <SummaryCard
          label="Total Gross"
          value={`₦${formatCurrency(report.totals?.totalGross)}`}
          icon={DollarSign}
        />
        <SummaryCard
          label="Taxable Income"
          value={`₦${formatCurrency(report.totals?.totalTaxableIncome)}`}
          icon={FileText}
        />
        <SummaryCard
          label="Total PAYE"
          value={`₦${formatCurrency(report.totals?.totalPaye)}`}
          icon={Landmark}
          highlight
        />
      </div>

      {/* Employee List */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Employee</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tax ID</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Gross</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">PAYE</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {report.employees?.map((emp, idx) => (
                <tr key={idx} className="hover:bg-gray-50/50">
                  <td className="px-4 py-3">
                    <div>
                      <p className="font-medium text-gray-900">{emp.employeeName}</p>
                      <p className="text-sm text-gray-500">{emp.employeeNumber}</p>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {emp.taxId || '-'}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-900">
                    ₦{formatCurrency(emp.totalGross)}
                  </td>
                  <td className="px-4 py-3 text-right font-medium text-blue-600">
                    ₦{formatCurrency(emp.totalPaye)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  // Pension Report
  const renderPensionReport = () => (
    <div className="space-y-4">
      {/* Settings */}
      {report.settings && (
        <div className="bg-green-50/20 border border-green-200 rounded-lg p-4">
          <div className="flex items-center gap-4 text-green-800">
            <span>Employee Rate: <strong>{report.settings.employeeRate}%</strong></span>
            <span>Employer Rate: <strong>{report.settings.employerRate}%</strong></span>
          </div>
        </div>
      )}

      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <SummaryCard
          label="Total Employees"
          value={report.totals?.employeeCount || 0}
          icon={Users}
        />
        <SummaryCard
          label="Employee Contribution"
          value={`₦${formatCurrency(report.totals?.totalEmployeeContribution)}`}
          icon={DollarSign}
        />
        <SummaryCard
          label="Employer Contribution"
          value={`₦${formatCurrency(report.totals?.totalEmployerContribution)}`}
          icon={Building2}
        />
        <SummaryCard
          label="Total Contribution"
          value={`₦${formatCurrency(report.totals?.totalContribution)}`}
          icon={Shield}
          highlight
        />
      </div>

      {/* PFA Summary */}
      {report.pfaSummary && report.pfaSummary.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <h4 className="font-medium text-gray-900 mb-4">By Pension Fund Administrator</h4>
          <div className="space-y-2">
            {report.pfaSummary.map((pfa, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
              >
                <div>
                  <p className="font-medium text-gray-900">{pfa.pfaName || 'Unknown PFA'}</p>
                  <p className="text-sm text-gray-500">{pfa.employeeCount} employees</p>
                </div>
                <p className="font-semibold text-green-600">
                  ₦{formatCurrency(pfa.totalContribution)}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Employee List */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Employee</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Pension PIN</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">PFA</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Employee</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Employer</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {report.employees?.map((emp, idx) => (
                <tr key={idx} className="hover:bg-gray-50/50">
                  <td className="px-4 py-3">
                    <div>
                      <p className="font-medium text-gray-900">{emp.employeeName}</p>
                      <p className="text-sm text-gray-500">{emp.employeeNumber}</p>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {emp.pensionPin || '-'}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {emp.pfaName || '-'}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-900">
                    ₦{formatCurrency(emp.totalEmployeeContribution)}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-900">
                    ₦{formatCurrency(emp.totalEmployerContribution)}
                  </td>
                  <td className="px-4 py-3 text-right font-medium text-green-600">
                    ₦{formatCurrency(emp.totalContribution)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  // Generic Contribution Report (NHF, NHIS)
  const renderContributionReport = () => (
    <div className="space-y-4">
      {/* Settings */}
      {report.settings && (
        <div className="bg-purple-50/20 border border-purple-200 rounded-lg p-4">
          <div className="flex items-center gap-4 text-purple-800">
            {report.settings.rate && (
              <span>Rate: <strong>{report.settings.rate}%</strong></span>
            )}
            {report.settings.employeeRate && (
              <>
                <span>Employee: <strong>{report.settings.employeeRate}%</strong></span>
                <span>Employer: <strong>{report.settings.employerRate}%</strong></span>
              </>
            )}
          </div>
        </div>
      )}

      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <SummaryCard
          label="Total Employees"
          value={report.totals?.employeeCount || 0}
          icon={Users}
        />
        {report.totals?.totalEmployeeContribution !== undefined ? (
          <>
            <SummaryCard
              label="Employee Contribution"
              value={`₦${formatCurrency(report.totals?.totalEmployeeContribution)}`}
              icon={DollarSign}
            />
            <SummaryCard
              label="Total Contribution"
              value={`₦${formatCurrency(report.totals?.totalContribution)}`}
              icon={Building2}
              highlight
            />
          </>
        ) : (
          <SummaryCard
            label="Total Contribution"
            value={`₦${formatCurrency(report.totals?.totalContribution)}`}
            icon={DollarSign}
            highlight
          />
        )}
      </div>

      {/* Employee List */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Employee</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  {selectedReport === 'nhf' ? 'NHF Number' : 'Policy Number'}
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Contribution</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {report.employees?.map((emp, idx) => (
                <tr key={idx} className="hover:bg-gray-50/50">
                  <td className="px-4 py-3">
                    <div>
                      <p className="font-medium text-gray-900">{emp.employeeName}</p>
                      <p className="text-sm text-gray-500">{emp.department || '-'}</p>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {emp.nhfNumber || emp.nhisPolicyNumber || '-'}
                  </td>
                  <td className="px-4 py-3 text-right font-medium text-purple-600">
                    ₦{formatCurrency(emp.totalContribution)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  // Employer-only Reports (ITF, NSITF)
  const renderEmployerReport = () => (
    <div className="space-y-4">
      {/* Settings */}
      {report.settings && (
        <div className="bg-orange-50/20 border border-orange-200 rounded-lg p-4">
          <div className="flex items-center gap-4 text-orange-800">
            <span>Rate: <strong>{report.settings.rate}%</strong> of total payroll</span>
            {(report.settings.itfNumber || report.settings.nsitfNumber) && (
              <span>Registration: <strong>{report.settings.itfNumber || report.settings.nsitfNumber}</strong></span>
            )}
          </div>
        </div>
      )}

      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <SummaryCard
          label="Total Payroll"
          value={`₦${formatCurrency(report.totals?.totalPayroll)}`}
          icon={DollarSign}
        />
        <SummaryCard
          label={`${selectedReport.toUpperCase()} Contribution`}
          value={`₦${formatCurrency(report.totals?.itfContribution || report.totals?.nsitfContribution)}`}
          icon={selectedReport === 'itf' ? GraduationCap : HardHat}
          highlight
        />
      </div>

      {/* Period Breakdown */}
      {report.periodBreakdown && report.periodBreakdown.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-200">
            <h4 className="font-medium text-gray-900">Monthly Breakdown</h4>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Period</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Employees</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Payroll</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Contribution</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {report.periodBreakdown.map((item, idx) => (
                  <tr key={idx} className="hover:bg-gray-50/50">
                    <td className="px-4 py-3 font-medium text-gray-900">
                      {new Date(item.period + '-01').toLocaleDateString('en-US', { year: 'numeric', month: 'long' })}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-600">
                      {item.employeeCount}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-900">
                      ₦{formatCurrency(item.totalPayroll)}
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-orange-600">
                      ₦{formatCurrency(item.itfContribution || item.nsitfContribution)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-4">
      {/* Report Type Selector */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {REPORT_TYPES.map(type => (
          <button
            key={type.id}
            onClick={() => setSelectedReport(type.id)}
            className={`p-4 rounded-lg border-2 transition-all ${
              selectedReport === type.id
                ? `border-${type.color}-500 bg-${type.color}-50${type.color}-900/20`
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <type.icon className={`w-6 h-6 mx-auto mb-2 ${
              selectedReport === type.id
                ? `text-${type.color}-600${type.color}-400`
                : 'text-gray-400'
            }`} />
            <p className={`text-sm font-medium ${
              selectedReport === type.id
                ? 'text-gray-900'
                : 'text-gray-600'
            }`}>
              {type.label}
            </p>
          </button>
        ))}
      </div>

      {/* Report Header */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">
              {report?.reportType || `${selectedReport.toUpperCase()} Report`}
            </h3>
            <p className="text-sm text-gray-500">
              Period: {report?.period || '-'}
            </p>
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

      {/* Report Content */}
      {renderReportContent()}
    </div>
  );
}

// Summary Card Component
function SummaryCard({ label, value, icon: Icon, highlight }) {
  return (
    <div className={`bg-white rounded-lg shadow-sm border p-4 ${
      highlight
        ? 'border-blue-200'
        : 'border-gray-200'
    }`}>
      <div className="flex items-center gap-2 text-gray-500 mb-1">
        <Icon className="w-4 h-4" />
        <span className="text-sm">{label}</span>
      </div>
      <p className={`text-xl font-bold ${
        highlight
          ? 'text-blue-600'
          : 'text-gray-900'
      }`}>
        {value}
      </p>
    </div>
  );
}

export default StatutoryReports;
