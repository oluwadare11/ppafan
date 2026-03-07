// ProcessPayments.jsx - Process payments and mark as paid
// Phase 2: Payment processing workflow

import React, { useState, useEffect, useCallback } from 'react';
import { useTenant } from '../../../context/TenantProvider.jsx';
import {
  CreditCard,
  CheckCircle,
  DollarSign,
  Users,
  Building,
  AlertTriangle,
  Calendar,
  FileText,
  Clock,
  Download,
  ArrowRight,
  ChevronRight
} from 'lucide-react';

import { SkeletonLine, ConfirmDialog, Tip } from '../shared';

function ProcessPayments({ period, periodStatus, onSuccess, onError, onNavigateToReports }) {
  const { makeRequest } = useTenant();
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState(null);
  const [showProcessDialog, setShowProcessDialog] = useState(false);
  const [confirmChecked, setConfirmChecked] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('bank_transfer');
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState('');
  const [justProcessed, setJustProcessed] = useState(false);

  const canProcess = ['generated', 'approved'].includes(periodStatus?.status);
  const isProcessed = periodStatus?.status === 'paid';

  // Fetch payment status
  const fetchPaymentStatus = useCallback(async () => {
    if (!period) return;

    try {
      setLoading(true);
      const data = await makeRequest(`/api/payroll/payments/status/${period}`, {
        method: 'GET'
      });
      setPaymentStatus(data);
    } catch (err) {
      if (err.message?.includes('404') || err.message?.includes('not found')) {
        setPaymentStatus(null);
      } else {
        console.error('Error fetching payment status:', err);
      }
    } finally {
      setLoading(false);
    }
  }, [period, makeRequest]);

  useEffect(() => {
    fetchPaymentStatus();
  }, [fetchPaymentStatus]);

  // Process payments
  const handleProcess = async () => {
    setProcessing(true);
    try {
      const data = await makeRequest('/api/payroll/payments/process', {
        method: 'POST',
        data: {
          period,
          paymentMethod,
          paymentDate,
          notes
        }
      });

      setJustProcessed(true);
      onSuccess(`Payments processed for ${data.summary?.staffCount || 0} staff members. Reference: ${data.paymentReference}`);
      fetchPaymentStatus();

    } catch (err) {
      onError(err.message || 'Failed to process payments');
    } finally {
      setProcessing(false);
      setShowProcessDialog(false);
      setConfirmChecked(false);
    }
  };

  // Download payment summary as CSV
  const handleDownloadCSV = () => {
    if (!paymentStatus?.paid) return;
    const rows = [
      ['Period', getPeriodLabel()],
      ['Payment Date', paymentStatus.paid.paymentDate ? new Date(paymentStatus.paid.paymentDate).toLocaleDateString() : 'N/A'],
      ['Payment Method', paymentMethod || 'N/A'],
      ['Staff Count', paymentStatus.paid.count || 0],
      ['Total Amount', paymentStatus.paid.totalAmount || 0],
      ['Payment Reference', paymentStatus.paid.paymentReference || 'N/A'],
      [],
      ['Employee', 'Net Pay', 'Status'],
    ];
    // Add staff rows if available
    (paymentStatus.paid.staff || []).forEach(s => {
      rows.push([s.name || s.employeeNumber, s.netPay || 0, 'Paid']);
    });
    const csv = rows.map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `payroll-payment-${period}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const getPeriodLabel = () => {
    if (!period) return '';
    const [year, month] = period.split('-');
    const date = new Date(year, parseInt(month) - 1, 1);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
  };

  if (loading) {
    return (
      <div className="animate-pulse space-y-3">
        {[1, 2, 3, 4, 5, 6].map(i => (
          <SkeletonLine key={i} width={i % 2 === 0 ? "w-full" : "w-3/4"} />
        ))}
      </div>
    );
  }

  // Not ready for payment
  if (!canProcess && !isProcessed) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 text-center">
        <AlertTriangle className="w-12 h-12 text-yellow-500 mx-auto mb-4" />
        <h4 className="text-lg font-semibold text-gray-900 mb-2">
          Payroll Not Ready for Payment
        </h4>
        <p className="text-gray-500">
          Payroll must be generated before payments can be processed.
          Current status: {periodStatus?.status || 'not generated'}
        </p>
      </div>
    );
  }

  // Already paid
  if (isProcessed && paymentStatus?.paid?.count > 0) {
    return (
      <div className="space-y-6">
        {/* Success banner */}
        <div className="bg-green-50 border border-green-200 rounded-lg p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-green-100 rounded-full">
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
            <div>
              <h4 className="text-lg font-semibold text-green-800">
                Payments Processed Successfully
              </h4>
              <p className="text-green-600">
                All payments for {getPeriodLabel()} have been processed.
              </p>
            </div>
          </div>
        </div>

        {/* Payment summary */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center gap-3 mb-2">
              <Users className="w-5 h-5 text-gray-400" />
              <span className="text-sm text-gray-500">Staff Paid</span>
            </div>
            <p className="text-3xl font-bold text-gray-900">
              {paymentStatus?.paid?.count || 0}
            </p>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center gap-3 mb-2">
              <DollarSign className="w-5 h-5 text-gray-400" />
              <span className="text-sm text-gray-500">Total Amount</span>
            </div>
            <p className="text-3xl font-bold text-green-600">
              ₦{(paymentStatus?.paid?.totalAmount || 0).toLocaleString()}
            </p>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center gap-3 mb-2">
              <Calendar className="w-5 h-5 text-gray-400" />
              <span className="text-sm text-gray-500">Payment Date</span>
            </div>
            <p className="text-xl font-bold text-gray-900">
              {paymentStatus?.paid?.paymentDate
                ? new Date(paymentStatus.paid.paymentDate).toLocaleDateString()
                : 'N/A'}
            </p>
          </div>
        </div>

        {/* Payment reference */}
        {paymentStatus?.paid?.paymentReference && (
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="flex items-center gap-2 text-sm">
              <FileText className="w-4 h-4 text-gray-400" />
              <span className="text-gray-500">Payment Reference:</span>
              <span className="font-mono font-medium text-gray-900">
                {paymentStatus.paid.paymentReference}
              </span>
            </div>
          </div>
        )}

        {/* Download payment summary */}
        <button
          onClick={handleDownloadCSV}
          className="flex items-center gap-2 px-4 py-2 border border-gray-200 text-gray-700 hover:bg-gray-50 rounded-lg text-sm font-medium transition-colors"
        >
          <Download className="w-4 h-4" />
          Download Payment Summary (CSV)
        </button>

        {/* Post-payment next steps checklist */}
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-5">
          <h5 className="font-semibold text-blue-900 mb-3 flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-blue-600" />
            What to do next
          </h5>
          <div className="space-y-2">
            {[
              { label: 'Download PAYE deduction schedule for this period', hint: 'Required for tax compliance filing' },
              { label: 'Download Pension schedule (Employer + Employee contributions)', hint: 'Submit to pension fund administrators' },
              { label: 'Download Payroll Register', hint: 'Full breakdown of all staff earnings and deductions' },
              { label: 'Email payslips to staff', hint: 'Go to the Payslips step and click "Email to Staff"' },
            ].map((item, i) => (
              <div key={i} className="flex items-start gap-3 p-2 rounded-lg hover:bg-blue-100/50 transition-colors">
                <div className="w-5 h-5 mt-0.5 rounded border-2 border-blue-300 flex-shrink-0 bg-white" />
                <div>
                  <p className="text-sm font-medium text-blue-900">{item.label}</p>
                  <p className="text-xs text-blue-600">{item.hint}</p>
                </div>
              </div>
            ))}
          </div>
          <button
            onClick={() => onNavigateToReports?.()}
            className="mt-4 flex items-center gap-2 text-sm font-medium text-blue-700 hover:text-blue-900 transition-colors"
          >
            Go to Reports <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  // Ready to process
  return (
    <div className="space-y-6">
      {/* Info card */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-start gap-4">
          <div className="p-3 bg-purple-100 rounded-lg">
            <CreditCard className="w-6 h-6 text-purple-600" />
          </div>
          <div className="flex-1">
            <h4 className="text-lg font-semibold text-gray-900 mb-2">
              Process Payments for {getPeriodLabel()}
            </h4>
            <p className="text-sm text-gray-600 mb-4">
              Process payments for all approved payroll records. This will mark the payroll as paid
              and record the payment details.
            </p>
          </div>
        </div>
      </div>

      <Tip>
        After processing, payments cannot be reversed through the system. Ensure all details
        are correct before proceeding.
      </Tip>

      {/* Payment summary */}
      {paymentStatus && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <div className="flex items-center gap-2 text-gray-500 mb-1">
              <Users className="w-4 h-4" />
              <span className="text-sm">Total Staff</span>
            </div>
            <p className="text-2xl font-bold text-gray-900">
              {paymentStatus.totalStaff || 0}
            </p>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <div className="flex items-center gap-2 text-gray-500 mb-1">
              <Clock className="w-4 h-4" />
              <span className="text-sm">Pending</span>
            </div>
            <p className="text-2xl font-bold text-yellow-600">
              {paymentStatus.unpaid?.count || 0}
            </p>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <div className="flex items-center gap-2 text-gray-500 mb-1">
              <CheckCircle className="w-4 h-4" />
              <span className="text-sm">Paid</span>
            </div>
            <p className="text-2xl font-bold text-green-600">
              {paymentStatus.paid?.count || 0}
            </p>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <div className="flex items-center gap-2 text-gray-500 mb-1">
              <DollarSign className="w-4 h-4" />
              <span className="text-sm">Amount to Pay</span>
            </div>
            <p className="text-2xl font-bold text-gray-900">
              ₦{(paymentStatus.unpaid?.totalAmount || 0).toLocaleString()}
            </p>
          </div>
        </div>
      )}

      {/* Process button */}
      {paymentStatus?.unpaid?.count > 0 && (
        <div className="flex justify-center">
          <button
            onClick={() => setShowProcessDialog(true)}
            className="flex items-center gap-2 px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white font-medium rounded-lg transition-colors"
          >
            <CreditCard className="w-5 h-5" />
            Process {paymentStatus.unpaid.count} Payments
          </button>
        </div>
      )}

      {/* Process dialog — inline (not using ConfirmDialog so we can add custom checkbox) */}
      {showProcessDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full">
            <div className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-1">Process Payments</h3>
              <p className="text-sm text-gray-500 mb-5">
                {paymentStatus?.unpaid?.count || 0} staff members · ₦{(paymentStatus?.unpaid?.totalAmount || 0).toLocaleString()} total
              </p>

              <div className="space-y-4 mb-5">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Payment Method</label>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900"
                  >
                    <option value="bank_transfer">Bank Transfer</option>
                    <option value="cash">Cash</option>
                    <option value="cheque">Cheque</option>
                    <option value="other">Other</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Payment Date</label>
                  <input
                    type="date"
                    value={paymentDate}
                    onChange={(e) => setPaymentDate(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Notes (optional)</label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={2}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900"
                    placeholder="Add any notes about this payment..."
                  />
                </div>

                {/* 2-step confirmation checkbox */}
                <label className="flex items-start gap-3 p-3 bg-amber-50 border border-amber-200 rounded-lg cursor-pointer">
                  <input
                    type="checkbox"
                    checked={confirmChecked}
                    onChange={(e) => setConfirmChecked(e.target.checked)}
                    className="mt-0.5 w-4 h-4 accent-amber-600"
                  />
                  <span className="text-sm text-amber-900">
                    I confirm all payroll amounts are correct. I understand that payments cannot be reversed through the system.
                  </span>
                </label>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => { setShowProcessDialog(false); setConfirmChecked(false); }}
                  className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleProcess}
                  disabled={processing || !confirmChecked}
                  className="flex-1 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {processing ? 'Processing...' : `Process ${paymentStatus?.unpaid?.count || 0} Payments`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ProcessPayments;
