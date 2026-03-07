// GeneratePayslips.jsx - Generate and view payslips
// Phase 2: Payslip generation and display

import React, { useState, useEffect, useCallback } from 'react';
import { useTenant } from '../../../context/TenantProvider.jsx';
import {
  FileText,
  Download,
  Send,
  Eye,
  Users,
  CheckCircle,
  AlertTriangle,
  Search,
  X,
  Mail,
  MailCheck,
  RefreshCw,
  Printer
} from 'lucide-react';

import { SkeletonLine, StatusBadge, ConfirmDialog } from '../shared';

function GeneratePayslips({ period, periodStatus, onSuccess, onError }) {
  const { makeRequest } = useTenant();
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [sendingEmails, setSendingEmails] = useState(false);
  const [resendingFor, setResendingFor] = useState(null); // employeeNumber being resent
  const [payslips, setPayslips] = useState([]);
  const [emailedSet, setEmailedSet] = useState(new Set()); // tracks emailed employees
  const [showEmailConfirm, setShowEmailConfirm] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPayslip, setSelectedPayslip] = useState(null);

  const canGenerate = ['generated', 'approved', 'paid'].includes(periodStatus?.status);

  // Auto-load existing payslips on mount / period change
  const fetchExistingPayslips = useCallback(async () => {
    if (!period || !canGenerate) return;
    setLoading(true);
    try {
      const data = await makeRequest(`/api/payroll/payslips/list/${period}`);
      if (data.payslips?.length > 0) {
        setPayslips(data.payslips);
        // Pre-populate emailedSet from backend emailSent flags
        const alreadyEmailed = new Set(
          data.payslips.filter(p => p.emailSent).map(p => p.employeeNumber)
        );
        setEmailedSet(alreadyEmailed);
      }
    } catch {
      // No existing payslips — that's fine, show generate button
    } finally {
      setLoading(false);
    }
  }, [period, canGenerate, makeRequest]);

  useEffect(() => {
    fetchExistingPayslips();
  }, [fetchExistingPayslips]);

  // Generate payslips
  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const data = await makeRequest('/api/payroll/payslips/generate', {
        method: 'POST',
        data: { period }
      });

      setPayslips(data.payslips || []);
      onSuccess(`Generated ${data.count} payslips for ${period}`);

    } catch (err) {
      onError(err.message || 'Failed to generate payslips');
    } finally {
      setGenerating(false);
    }
  };

  // View individual payslip
  const viewPayslip = async (employeeNumber) => {
    try {
      setLoading(true);
      const data = await makeRequest(`/api/payroll/payslips/${employeeNumber}/${period}`, {
        method: 'GET'
      });
      setSelectedPayslip(data.payslip);
    } catch (err) {
      onError(err.message || 'Failed to fetch payslip');
    } finally {
      setLoading(false);
    }
  };

  // Send payslip emails to all staff
  const handleSendEmails = async () => {
    setShowEmailConfirm(false);
    setSendingEmails(true);
    try {
      const data = await makeRequest('/api/payroll/payslips/email', {
        method: 'POST',
        data: { period }
      });
      // Mark all payslips as emailed
      setEmailedSet(new Set(payslips.map(p => p.employeeNumber)));
      onSuccess(data.message || `Sent ${data.sent} payslip emails`);
    } catch (err) {
      onError(err.message || 'Failed to send payslip emails');
    } finally {
      setSendingEmails(false);
    }
  };

  // Resend payslip email to a single staff member
  const handleResendEmail = async (employeeNumber) => {
    setResendingFor(employeeNumber);
    try {
      await makeRequest('/api/payroll/payslips/email/resend', {
        method: 'POST',
        data: { period, employeeNumber }
      });
      setEmailedSet(prev => new Set([...prev, employeeNumber]));
      onSuccess('Payslip email resent successfully');
    } catch (err) {
      onError(err.message || 'Failed to resend payslip email');
    } finally {
      setResendingFor(null);
    }
  };

  // Filter payslips
  const filteredPayslips = payslips.filter(slip => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      slip.employeeName?.toLowerCase().includes(query) ||
      slip.employeeNumber?.toLowerCase().includes(query) ||
      slip.department?.toLowerCase().includes(query)
    );
  });

  const getPeriodLabel = () => {
    if (!period) return '';
    const [year, month] = period.split('-');
    const date = new Date(year, parseInt(month) - 1, 1);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
  };

  // Human-readable labels for earnings keys
  const EARNINGS_LABELS = {
    baseSalary: 'Basic Salary',
    overtime: 'Overtime Pay',
    bonuses: 'Bonuses / 13th Month'
  };

  // Human-readable labels for deduction keys
  const DEDUCTION_LABELS = {
    paye: 'PAYE Tax',
    pension: 'Pension (Employee 8%)',
    nhf: 'NHF (2.5%)',
    nhis: 'NHIS (5%)',
    lateness: 'Lateness Deduction',
    earlyLeave: 'Early Leave Deduction',
    absence: 'Absence Deduction',
    unpaidLeave: 'Unpaid Leave',
    loans: 'Loan Repayment',
    advances: 'Salary Advance',
    other: 'Other Deductions'
  };

  const fmt = (n) => `₦${(n || 0).toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  // Print / Save PDF — opens a styled page in a new tab and triggers print dialog
  const handlePrintPayslip = (payslip) => {
    const periodLabel = getPeriodLabel();
    const earningsRows = Object.entries(payslip.earnings || {})
      .filter(([k, v]) => k !== 'totalEarnings' && (v || 0) > 0)
      .map(([k, v]) => `<tr>
        <td style="padding:7px 0;color:#374151;border-bottom:1px solid #f3f4f6">${EARNINGS_LABELS[k] || k}</td>
        <td style="padding:7px 0;text-align:right;color:#111827;border-bottom:1px solid #f3f4f6">${fmt(v)}</td>
      </tr>`).join('');

    const deductionRows = Object.entries(payslip.deductions || {})
      .filter(([k, v]) => k !== 'totalDeductions' && (v || 0) > 0)
      .map(([k, v]) => `<tr>
        <td style="padding:7px 0;color:#374151;border-bottom:1px solid #f3f4f6">${DEDUCTION_LABELS[k] || k}</td>
        <td style="padding:7px 0;text-align:right;color:#dc2626;border-bottom:1px solid #f3f4f6">-${fmt(v)}</td>
      </tr>`).join('');

    const bank = payslip.bankDetails || {};
    const bankRow = bank.bankName
      ? `<tr style="margin-top:4px">
          <td style="color:#6b7280;font-size:12px">Bank</td>
          <td style="font-weight:600;font-size:12px">${bank.bankName}</td>
          <td style="color:#6b7280;font-size:12px">Account No.</td>
          <td style="font-weight:600;font-size:12px">${bank.accountNumber || ''}</td>
        </tr>
        <tr>
          <td style="color:#6b7280;font-size:12px">Account Name</td>
          <td colspan="3" style="font-weight:600;font-size:12px">${bank.accountName || ''}</td>
        </tr>`
      : '';

    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Payslip — ${payslip.employeeName} — ${periodLabel}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f9fafb; color: #111827; }
    .page { max-width: 680px; margin: 32px auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.10); }
    .header { background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%); padding: 28px 32px; color: white; }
    .header h1 { font-size: 22px; font-weight: 700; margin-bottom: 2px; }
    .header .ref { font-size: 11px; color: #94a3b8; letter-spacing: 0.5px; text-transform: uppercase; }
    .period-badge { display:inline-block; margin-top:10px; padding:3px 12px; background:rgba(255,255,255,0.12); border-radius:20px; font-size:12px; color:#e2e8f0; }
    .body { padding: 28px 32px; }
    .emp-grid { display:grid; grid-template-columns:1fr 1fr; gap:12px 24px; background:#f8fafc; border-radius:8px; padding:16px; margin-bottom:24px; }
    .emp-grid .label { font-size:11px; color:#6b7280; text-transform:uppercase; letter-spacing:0.5px; margin-bottom:2px; }
    .emp-grid .value { font-size:13px; font-weight:600; color:#111827; }
    h3 { font-size:13px; font-weight:700; color:#374151; text-transform:uppercase; letter-spacing:0.5px; margin-bottom:12px; padding-bottom:6px; border-bottom:2px solid #e5e7eb; }
    table { width:100%; border-collapse:collapse; font-size:13px; margin-bottom:24px; }
    .totals-row td { font-weight:700; font-size:14px; padding:10px 0; border-top:2px solid #e5e7eb; }
    .net-pay-box { background:linear-gradient(135deg,#1e293b,#0f172a); border-radius:10px; padding:20px 24px; display:flex; justify-content:space-between; align-items:center; margin-bottom:24px; }
    .net-pay-box .label { color:#94a3b8; font-size:12px; text-transform:uppercase; letter-spacing:0.5px; }
    .net-pay-box .amount { color:#4ade80; font-size:26px; font-weight:800; }
    .bank-table { font-size:12px; width:100%; }
    .bank-table td { padding:4px 0; }
    .footer { background:#f8fafc; border-top:1px solid #e5e7eb; padding:14px 32px; font-size:11px; color:#9ca3af; display:flex; justify-content:space-between; }
    @media print {
      body { background: white; }
      .page { box-shadow: none; margin: 0; border-radius: 0; }
    }
  </style>
</head>
<body>
  <div class="page">
    <div class="header">
      <div class="ref">PAYSLIP REFERENCE</div>
      <h1>${payslip.payslipId || ''}</h1>
      <div class="period-badge">${periodLabel}</div>
    </div>
    <div class="body">
      <div class="emp-grid">
        <div><div class="label">Employee Name</div><div class="value">${payslip.employeeName || ''}</div></div>
        <div><div class="label">Employee ID</div><div class="value">${payslip.employeeNumber || ''}</div></div>
        <div><div class="label">Department</div><div class="value">${payslip.department || '—'}</div></div>
        <div><div class="label">Position</div><div class="value">${payslip.position || '—'}</div></div>
      </div>

      <h3>Earnings</h3>
      <table>
        <tbody>${earningsRows}</tbody>
        <tfoot><tr class="totals-row">
          <td>Total Earnings</td>
          <td style="text-align:right;color:#16a34a">${fmt(payslip.earnings?.totalEarnings)}</td>
        </tr></tfoot>
      </table>

      <h3>Deductions</h3>
      <table>
        <tbody>${deductionRows || '<tr><td colspan="2" style="color:#9ca3af;font-size:12px;padding:8px 0">No deductions this period</td></tr>'}</tbody>
        <tfoot><tr class="totals-row">
          <td>Total Deductions</td>
          <td style="text-align:right;color:#dc2626">-${fmt(payslip.deductions?.totalDeductions)}</td>
        </tr></tfoot>
      </table>

      <div class="net-pay-box">
        <div><div class="label">Net Pay for ${periodLabel}</div></div>
        <div class="amount">${fmt(payslip.netPay)}</div>
      </div>

      ${bank.bankName ? `<h3>Payment Details</h3>
      <table class="bank-table"><tbody>${bankRow}</tbody></table>` : ''}
    </div>
    <div class="footer">
      <span>Generated by Opsuite Payroll</span>
      <span>${payslip.payslipId || ''}</span>
    </div>
  </div>
</body>
</html>`;

    const win = window.open('', '_blank');
    if (win) {
      win.document.write(html);
      win.document.close();
      setTimeout(() => win.print(), 400);
    }
  };

  if (!canGenerate) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 text-center">
        <AlertTriangle className="w-12 h-12 text-yellow-500 mx-auto mb-4" />
        <h4 className="text-lg font-semibold text-gray-900 mb-2">
          Payroll Not Generated
        </h4>
        <p className="text-gray-500">
          Payroll must be generated before payslips can be created.
          Current status: {periodStatus?.status || 'not generated'}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h4 className="text-lg font-semibold text-gray-900">
              Payslips for {getPeriodLabel()}
            </h4>
            <p className="text-sm text-gray-500">
              Generate and view individual payslips for all staff members
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleGenerate}
              disabled={generating}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50"
            >
              {generating ? (
                <>
                  <FileText className="w-4 h-4 animate-pulse" />
                  Generating...
                </>
              ) : (
                <>
                  <FileText className="w-4 h-4" />
                  {payslips.length > 0 ? 'Regenerate Payslips' : 'Generate Payslips'}
                </>
              )}
            </button>

            {payslips.length > 0 && (
              <button
                onClick={() => setShowEmailConfirm(true)}
                disabled={sendingEmails}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50"
              >
                {sendingEmails ? (
                  <>
                    <Send className="w-4 h-4 animate-pulse" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    Email to Staff
                    {emailedSet.size > 0 && (
                      <span className="ml-1 px-1.5 py-0.5 text-xs bg-green-500 rounded-full">
                        {emailedSet.size} sent
                      </span>
                    )}
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Payslips list */}
      {payslips.length > 0 && (
        <>
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by name, ID, or department..."
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Grid of payslip cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredPayslips.map((slip) => (
              <div
                key={slip.payslipId}
                className="bg-white rounded-lg shadow-sm border border-gray-200 p-4"
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="font-medium text-gray-900">
                      {slip.employeeName}
                    </p>
                    <p className="text-sm text-gray-500">
                      {slip.employeeNumber}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className="px-2 py-1 text-xs font-medium bg-green-100 text-green-700 rounded">
                      Generated
                    </span>
                    {emailedSet.has(slip.employeeNumber) ? (
                      <span className="flex items-center gap-1 px-2 py-0.5 text-xs font-medium bg-blue-50 text-blue-600 rounded">
                        <MailCheck className="w-3 h-3" /> Emailed
                      </span>
                    ) : null}
                  </div>
                </div>

                <div className="space-y-2 mb-4">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Department</span>
                    <span className="text-gray-700">{slip.department}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Earnings</span>
                    <span className="text-gray-700">
                      ₦{(slip.earnings?.totalEarnings || 0).toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Deductions</span>
                    <span className="text-red-600">
                      -₦{(slip.deductions?.totalDeductions || 0).toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm font-medium border-t border-gray-200 pt-2">
                    <span className="text-gray-700">Net Pay</span>
                    <span className="text-green-600">
                      ₦{(slip.netPay || 0).toLocaleString()}
                    </span>
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => viewPayslip(slip.employeeNumber)}
                    className="flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                  >
                    <Eye className="w-4 h-4" />
                    View
                  </button>
                  <button
                    onClick={() => handleResendEmail(slip.employeeNumber)}
                    disabled={resendingFor === slip.employeeNumber}
                    title={emailedSet.has(slip.employeeNumber) ? 'Resend email' : 'Send payslip email'}
                    className="flex items-center justify-center gap-1.5 px-3 py-2 text-sm text-green-700 hover:bg-green-50 rounded-lg transition-colors disabled:opacity-50"
                  >
                    {resendingFor === slip.employeeNumber
                      ? <RefreshCw className="w-4 h-4 animate-spin" />
                      : emailedSet.has(slip.employeeNumber)
                        ? <><RefreshCw className="w-3.5 h-3.5" /> Resend</>
                        : <><Mail className="w-3.5 h-3.5" /> Email</>
                    }
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Results count */}
          <div className="text-sm text-gray-500 text-center">
            Showing {filteredPayslips.length} of {payslips.length} payslips
          </div>
        </>
      )}

      {/* Empty state */}
      {payslips.length === 0 && !generating && (
        <div className="bg-gray-50 rounded-lg p-8 text-center">
          <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h4 className="text-lg font-semibold text-gray-900 mb-2">
            No Payslips Generated
          </h4>
          <p className="text-gray-500 mb-4">
            Click "Generate Payslips" to create payslips for all staff members.
          </p>
        </div>
      )}

      {/* Email confirmation dialog */}
      <ConfirmDialog
        isOpen={showEmailConfirm}
        onClose={() => setShowEmailConfirm(false)}
        onConfirm={handleSendEmails}
        title="Email Payslips to All Staff?"
        message={`This will send payslip emails to all ${payslips.length} staff members for ${getPeriodLabel()}. Make sure all payslip amounts are correct before sending — emails cannot be unsent.`}
        confirmText="Send Emails"
        confirmVariant="primary"
      />

      {/* Payslip detail modal */}
      {selectedPayslip && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[92vh] overflow-y-auto flex flex-col">

            {/* Branded header */}
            <div className="sticky top-0 z-10 bg-gradient-to-r from-slate-800 to-slate-900 rounded-t-2xl px-6 py-5 flex items-start justify-between">
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-1">Payslip</p>
                <h3 className="text-lg font-bold text-white leading-tight">
                  {selectedPayslip.employeeName}
                </h3>
                <span className="inline-block mt-1.5 px-3 py-0.5 text-xs font-medium bg-white/10 text-slate-200 rounded-full">
                  {getPeriodLabel()} &nbsp;·&nbsp; {selectedPayslip.payslipId || `PS-${period}-${selectedPayslip.employeeNumber}`}
                </span>
              </div>
              <div className="flex items-center gap-2 mt-1">
                <button
                  onClick={() => handlePrintPayslip(selectedPayslip)}
                  title="Print / Save as PDF"
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-200 hover:text-white bg-white/10 hover:bg-white/20 rounded-lg transition-colors"
                >
                  <Printer className="w-3.5 h-3.5" />
                  Print / PDF
                </button>
                <button
                  onClick={() => setSelectedPayslip(null)}
                  className="p-1.5 text-slate-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Body */}
            <div className="p-6 space-y-6">

              {/* Employee info grid */}
              <div className="grid grid-cols-2 gap-x-6 gap-y-3 bg-gray-50 rounded-xl p-4 text-sm">
                {[
                  ['Name', selectedPayslip.employeeName],
                  ['Employee ID', selectedPayslip.employeeNumber],
                  ['Department', selectedPayslip.department || '—'],
                  ['Position', selectedPayslip.position || '—']
                ].map(([label, value]) => (
                  <div key={label}>
                    <p className="text-xs text-gray-400 uppercase tracking-wide mb-0.5">{label}</p>
                    <p className="font-semibold text-gray-900">{value}</p>
                  </div>
                ))}
              </div>

              {/* Earnings */}
              <div>
                <h4 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3 pb-2 border-b-2 border-gray-100">
                  Earnings
                </h4>
                <div className="space-y-0">
                  {Object.entries(selectedPayslip.earnings || {}).map(([key, value]) => {
                    if (key === 'totalEarnings' || (value || 0) === 0) return null;
                    const label = EARNINGS_LABELS[key] || key;
                    return (
                      <div key={key} className="flex justify-between text-sm py-2 border-b border-gray-50">
                        <span className="text-gray-600">{label}</span>
                        <span className="text-gray-900 font-medium">{fmt(value)}</span>
                      </div>
                    );
                  })}
                  <div className="flex justify-between font-bold text-sm pt-3">
                    <span className="text-gray-900">Total Earnings</span>
                    <span className="text-green-600">{fmt(selectedPayslip.earnings?.totalEarnings)}</span>
                  </div>
                </div>
              </div>

              {/* Deductions */}
              <div>
                <h4 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3 pb-2 border-b-2 border-gray-100">
                  Deductions
                </h4>
                <div className="space-y-0">
                  {Object.entries(selectedPayslip.deductions || {}).filter(([k, v]) => k !== 'totalDeductions' && (v || 0) > 0).length === 0 && (
                    <p className="text-sm text-gray-400 py-2">No deductions this period.</p>
                  )}
                  {Object.entries(selectedPayslip.deductions || {}).map(([key, value]) => {
                    if (key === 'totalDeductions' || (value || 0) === 0) return null;
                    const label = DEDUCTION_LABELS[key] || key;
                    return (
                      <div key={key} className="flex justify-between text-sm py-2 border-b border-gray-50">
                        <span className="text-gray-600">{label}</span>
                        <span className="text-red-600 font-medium">-{fmt(value)}</span>
                      </div>
                    );
                  })}
                  <div className="flex justify-between font-bold text-sm pt-3">
                    <span className="text-gray-900">Total Deductions</span>
                    <span className="text-red-600">-{fmt(selectedPayslip.deductions?.totalDeductions)}</span>
                  </div>
                </div>
              </div>

              {/* Net Pay */}
              <div className="bg-gradient-to-r from-slate-800 to-slate-900 rounded-xl px-5 py-4 flex items-center justify-between">
                <div>
                  <p className="text-xs text-slate-400 uppercase tracking-widest">Net Pay</p>
                  <p className="text-sm text-slate-300 mt-0.5">{getPeriodLabel()}</p>
                </div>
                <span className="text-3xl font-extrabold text-green-400">
                  {fmt(selectedPayslip.netPay)}
                </span>
              </div>

              {/* Bank details */}
              {selectedPayslip.bankDetails?.bankName && (
                <div>
                  <h4 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3 pb-2 border-b-2 border-gray-100">
                    Payment Details
                  </h4>
                  <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                    <div>
                      <p className="text-gray-400 text-xs uppercase tracking-wide mb-0.5">Bank</p>
                      <p className="font-semibold text-gray-900">{selectedPayslip.bankDetails.bankName}</p>
                    </div>
                    <div>
                      <p className="text-gray-400 text-xs uppercase tracking-wide mb-0.5">Account Number</p>
                      <p className="font-semibold text-gray-900">
                        ****{String(selectedPayslip.bankDetails.accountNumber || '').slice(-4)}
                      </p>
                    </div>
                    <div className="col-span-2">
                      <p className="text-gray-400 text-xs uppercase tracking-wide mb-0.5">Account Name</p>
                      <p className="font-semibold text-gray-900">{selectedPayslip.bankDetails.accountName || '—'}</p>
                    </div>
                  </div>
                </div>
              )}

            </div>

            {/* Footer */}
            <div className="border-t border-gray-100 px-6 py-3 flex justify-between items-center text-xs text-gray-400 rounded-b-2xl bg-gray-50">
              <span>Generated by Opsuite Payroll</span>
              <span>{selectedPayslip.payslipId}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default GeneratePayslips;
