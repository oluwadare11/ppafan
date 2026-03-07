// LoansTab.jsx — Standalone Loans & Advances manager
// Manages multi-period loan/advance schedules for all staff.
// This is intentionally separate from payroll generation because loans
// span multiple pay periods and should be accessible year-round.

import React, { useState, useEffect, useCallback } from 'react';
import { useTenant } from '../../../context/TenantProvider.jsx';
import {
  Landmark,
  Plus,
  X,
  RefreshCw,
  AlertTriangle,
  Lock
} from 'lucide-react';

import { Alert, ConfirmDialog } from '../shared';

function LoansTab({ modules, onGoToSettings }) {
  const { makeRequest } = useTenant();
  const [loans, setLoans] = useState([]);
  const [cancellingLoanId, setCancellingLoanId] = useState(null); // loan _id pending cancel confirm
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showForm, setShowForm] = useState(false);

  const now = new Date();
  const currentPeriod = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  const [form, setForm] = useState({
    employeeNumber: '',
    type: 'loan',
    description: '',
    originalAmount: '',
    monthlyDeduction: '',
    startPeriod: currentPeriod,
    notes: ''
  });

  const fetchData = useCallback(async () => {
    
    setLoading(true);
    try {
      const [loanRes, staffRes] = await Promise.all([
        makeRequest('/api/payroll/loans?status=active'),
        makeRequest('/api/payroll/staff-setup')
      ]);
      setLoans(loanRes.loans || []);
      setStaff(staffRes.staff || staffRes);
    } catch (err) {
      setError(err.message || 'Failed to load loans');
    } finally {
      setLoading(false);
    }
  }, [makeRequest]);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    if (success) {
      const t = setTimeout(() => setSuccess(''), 5000);
      return () => clearTimeout(t);
    }
  }, [success]);

  const handleAdd = async (e) => {
    e.preventDefault();
    try {
      await makeRequest('/api/payroll/loans', {
        method: 'POST',
        data: {
          ...form,
          originalAmount: Number(form.originalAmount),
          monthlyDeduction: Number(form.monthlyDeduction)
        }
      });
      setForm({
        employeeNumber: '', type: 'loan', description: '',
        originalAmount: '', monthlyDeduction: '', startPeriod: currentPeriod, notes: ''
      });
      setShowForm(false);
      setSuccess('Loan created successfully');
      fetchData();
    } catch (err) {
      setError(err.message || 'Failed to create loan');
    }
  };

  const handleCancel = async () => {
    if (!cancellingLoanId) return;
    try {
      await makeRequest(`/api/payroll/loans/${cancellingLoanId}/cancel`, { method: 'PUT' });
      setCancellingLoanId(null);
      setSuccess('Loan cancelled. Future deductions will not be applied.');
      fetchData();
    } catch (err) {
      setCancellingLoanId(null);
      setError(err.message || 'Failed to cancel loan');
    }
  };

  const repaymentMonths = form.originalAmount && form.monthlyDeduction && Number(form.monthlyDeduction) > 0
    ? Math.ceil(Number(form.originalAmount) / Number(form.monthlyDeduction))
    : null;

  if (modules?.loans === false) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="w-14 h-14 bg-gray-100 rounded-full flex items-center justify-center mb-4">
          <Lock className="w-7 h-7 text-gray-400" />
        </div>
        <h3 className="text-base font-semibold text-gray-700 mb-1">Loans & Advances are disabled</h3>
        <p className="text-sm text-gray-500 max-w-xs">
          Enable the Loans module in{' '}
          {onGoToSettings ? (
            <button
              className="text-blue-600 underline hover:text-blue-700"
              onClick={onGoToSettings}
            >
              Settings → Processing
            </button>
          ) : 'Settings → Processing'}{' '}
          to manage employee loans.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-orange-600 to-orange-700 rounded-xl p-5 sm:p-6 text-white">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h3 className="text-xl font-bold">Loans & Advances</h3>
            <p className="text-orange-100 text-sm mt-1">
              Manage employee loans and salary advances. Deductions apply automatically each pay period.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={fetchData}
              disabled={loading}
              className="p-2.5 bg-white/10 hover:bg-white/20 rounded-lg transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={() => setShowForm(true)}
              className="flex items-center gap-2 px-4 py-2.5 bg-white text-orange-700 font-semibold rounded-lg hover:bg-orange-50 transition-colors text-sm"
            >
              <Plus className="w-4 h-4" />
              New Loan / Advance
            </button>
          </div>
        </div>
      </div>

      {/* Alerts */}
      {error && <Alert type="error" message={error} onDismiss={() => setError('')} />}
      {success && <Alert type="success" message={success} onDismiss={() => setSuccess('')} />}

      {/* Add form */}
      {showForm && (
        <div className="bg-white rounded-xl shadow-sm border border-orange-200 overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
            <h4 className="font-semibold text-gray-900">New Loan / Advance</h4>
            <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600">
              <X className="w-5 h-5" />
            </button>
          </div>
          <form onSubmit={handleAdd} className="p-6 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Employee *</label>
                <select
                  value={form.employeeNumber}
                  onChange={e => setForm(f => ({ ...f, employeeNumber: e.target.value }))}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm bg-white text-gray-900 focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                  required
                >
                  <option value="">Select employee...</option>
                  {staff.map(s => (
                    <option key={s.employeeId || s.employeeNumber} value={s.employeeId || s.employeeNumber}>
                      {s.firstName} {s.lastName} ({s.employeeId || s.employeeNumber})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Type *</label>
                <select
                  value={form.type}
                  onChange={e => setForm(f => ({ ...f, type: e.target.value }))}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm bg-white text-gray-900 focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                >
                  <option value="loan">Loan</option>
                  <option value="advance">Salary Advance</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Total Amount (₦) *</label>
                <input
                  type="number"
                  value={form.originalAmount}
                  onChange={e => setForm(f => ({ ...f, originalAmount: e.target.value }))}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm bg-white text-gray-900 focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                  required min="1" placeholder="0"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Monthly Deduction (₦) *</label>
                <input
                  type="number"
                  value={form.monthlyDeduction}
                  onChange={e => setForm(f => ({ ...f, monthlyDeduction: e.target.value }))}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm bg-white text-gray-900 focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                  required min="1" placeholder="0"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Start Period *</label>
                <input
                  type="month"
                  value={form.startPeriod}
                  onChange={e => setForm(f => ({ ...f, startPeriod: e.target.value }))}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm bg-white text-gray-900 focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Description</label>
                <input
                  type="text"
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm bg-white text-gray-900 focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                  placeholder="e.g. Personal loan, housing advance"
                />
              </div>
            </div>

            {repaymentMonths && (
              <p className="text-sm text-orange-700 bg-orange-50 rounded-lg px-4 py-2.5">
                Estimated repayment: <strong>{repaymentMonths} month{repaymentMonths !== 1 ? 's' : ''}</strong>
                {' '}(₦{Number(form.monthlyDeduction).toLocaleString()}/month)
              </p>
            )}

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 font-medium"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-6 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg text-sm font-medium transition-colors"
              >
                Create {form.type === 'advance' ? 'Advance' : 'Loan'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Active loans list */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-100">
          <h4 className="font-semibold text-gray-900">
            Active Loans & Advances
            {loans.length > 0 && (
              <span className="ml-2 px-2.5 py-0.5 text-xs font-medium bg-orange-100 text-orange-700 rounded-full">
                {loans.length}
              </span>
            )}
          </h4>
          <p className="text-xs text-gray-500 mt-0.5">
            Monthly deductions are applied automatically when payroll is generated.
          </p>
        </div>

        {loading && loans.length === 0 ? (
          <div className="px-6 py-10 text-center text-sm text-gray-400">Loading...</div>
        ) : loans.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <Landmark className="w-8 h-8 text-gray-300 mx-auto mb-3" />
            <p className="text-sm text-gray-500">No active loans or advances</p>
            <p className="text-xs text-gray-400 mt-1">
              Click "New Loan / Advance" to register an employee loan
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {loans.map(loan => {
              const progress = loan.originalAmount > 0
                ? Math.min(100, ((loan.totalRepaid || 0) / loan.originalAmount * 100)).toFixed(0)
                : 0;
              return (
                <div key={loan._id} className="px-6 py-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3 flex-1">
                      <div className="p-2 bg-orange-100 rounded-lg mt-0.5">
                        <Landmark className="w-4 h-4 text-orange-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-semibold text-gray-900">{loan.employeeName}</p>
                          <span className="px-2 py-0.5 text-xs font-medium bg-orange-100 text-orange-700 rounded-full">
                            {loan.type === 'advance' ? 'Advance' : 'Loan'}
                          </span>
                        </div>
                        {loan.description && (
                          <p className="text-xs text-gray-500 mt-0.5">{loan.description}</p>
                        )}
                        <div className="mt-2 grid grid-cols-3 gap-3 text-xs">
                          <div>
                            <span className="text-gray-400">Total</span>
                            <p className="font-semibold text-gray-900 mt-0.5">₦{loan.originalAmount.toLocaleString()}</p>
                          </div>
                          <div>
                            <span className="text-gray-400">Monthly</span>
                            <p className="font-semibold text-orange-700 mt-0.5">₦{loan.monthlyDeduction.toLocaleString()}</p>
                          </div>
                          <div>
                            <span className="text-gray-400">Balance</span>
                            <p className="font-semibold text-gray-900 mt-0.5">₦{(loan.remainingBalance || 0).toLocaleString()}</p>
                          </div>
                        </div>
                        <div className="mt-2.5">
                          <div className="w-full bg-gray-200 rounded-full h-1.5">
                            <div
                              className="bg-orange-500 h-1.5 rounded-full transition-all"
                              style={{ width: `${progress}%` }}
                            />
                          </div>
                          <p className="text-xs text-gray-400 mt-1">
                            {progress}% repaid · {loan.repayments?.length || 0} payment{(loan.repayments?.length || 0) !== 1 ? 's' : ''} made
                          </p>
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => setCancellingLoanId(loan._id)}
                      className="flex items-center gap-1 px-3 py-1.5 text-xs text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg font-medium transition-colors flex-shrink-0"
                    >
                      <X className="w-3.5 h-3.5" />
                      Cancel
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {loans.length > 0 && (
        <div className="bg-orange-50 rounded-lg px-4 py-3 flex items-start gap-3">
          <AlertTriangle className="w-4 h-4 text-orange-600 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-orange-700">
            Loan deductions are applied automatically when payroll is generated for each period.
            Cancelling a loan stops future deductions but does not reverse payments already made.
          </p>
        </div>
      )}

      {/* Confirm cancel dialog */}
      <ConfirmDialog
        isOpen={!!cancellingLoanId}
        onClose={() => setCancellingLoanId(null)}
        onConfirm={handleCancel}
        title="Cancel Loan?"
        message="This will stop all future deductions for this loan. Payments already made will not be reversed. This action cannot be undone."
        confirmText="Yes, Cancel Loan"
        confirmVariant="danger"
      />
    </div>
  );
}

export default LoansTab;
