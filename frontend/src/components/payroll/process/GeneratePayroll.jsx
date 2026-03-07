// GeneratePayroll.jsx — Step 2: Generate payroll for the selected period

import React, { useState } from 'react';
import { useTenant } from '../../../context/TenantProvider.jsx';
import {
  Play,
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  Users,
  DollarSign,
  Calculator,
  Info
} from 'lucide-react';

import { ConfirmDialog } from '../shared';

// ─── Preflight Summary Modal ───
function PreflightModal({ isOpen, onClose, onConfirm, preflight, periodLabel, isRegenerate }) {
  if (!isOpen) return null;
  const { configured = 0, unconfigured = 0 } = preflight || {};
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full">
        <div className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-1">
            {isRegenerate ? 'Regenerate' : 'Generate'} Payroll — {periodLabel}
          </h3>
          <p className="text-sm text-gray-500 mb-5">Review before proceeding</p>

          <div className="space-y-3 mb-6">
            <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-green-600" />
                <span className="text-sm font-medium text-gray-900">Staff to be included</span>
              </div>
              <span className="text-sm font-bold text-green-700">{configured} staff</span>
            </div>

            {unconfigured > 0 && (
              <div className="flex items-center justify-between p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-yellow-600" />
                  <span className="text-sm font-medium text-gray-900">Unconfigured — will be skipped</span>
                </div>
                <span className="text-sm font-bold text-yellow-700">{unconfigured} staff</span>
              </div>
            )}

            {unconfigured > 0 && (
              <p className="text-xs text-gray-500 px-1">
                Unconfigured staff have no base salary set. Go to <strong>Staff Setup</strong> tab to configure them.
              </p>
            )}
          </div>

          <div className="flex gap-3">
            <button onClick={onClose} className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm font-medium transition-colors">
              Cancel
            </button>
            <button
              onClick={onConfirm}
              className={`flex-1 px-4 py-2 text-white rounded-lg text-sm font-medium transition-colors ${
                isRegenerate ? 'bg-yellow-600 hover:bg-yellow-700' : 'bg-blue-600 hover:bg-blue-700'
              }`}
            >
              {isRegenerate ? 'Regenerate' : 'Generate'} for {configured} Staff
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main GeneratePayroll Component ───
function GeneratePayroll({ period, periodStatus, settings, onSuccess, onError }) {
  const { makeRequest } = useTenant();
  const [generating, setGenerating] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [showPreflight, setShowPreflight] = useState(false);
  const [preflight, setPreflight] = useState(null);
  const [preflightLoading, setPreflightLoading] = useState(false);
  const [result, setResult] = useState(null);

  const canGenerate = !periodStatus || periodStatus.status === 'not_generated';
  const canRegenerate = periodStatus && ['generated', 'draft'].includes(periodStatus.status);
  const isPaid = periodStatus?.status === 'paid';

  const handleGenerate = async (isRegenerate = false) => {
    setGenerating(true);
    setResult(null);

    try {
      const data = await makeRequest('/api/payroll/process/generate', {
        method: 'POST',
        data: { period, regenerate: isRegenerate }
      });

      setResult(data);
      onSuccess(`Payroll generated successfully for ${data.results?.processed || 0} staff members`);
    } catch (err) {
      onError(err.message || 'Failed to generate payroll');
    } finally {
      setGenerating(false);
      setShowConfirm(false);
    }
  };

  const handleGenerateClick = async () => {
    setPreflightLoading(true);
    try {
      const staffRes = await makeRequest('/api/payroll/staff-setup');
      const allStaff = staffRes.staff || staffRes || [];
      const configured = allStaff.filter(s => s.baseSalary > 0).length;
      const unconfigured = allStaff.length - configured;
      setPreflight({ configured, unconfigured, total: allStaff.length });
    } catch {
      setPreflight({ configured: 0, unconfigured: 0, total: 0 });
    } finally {
      setPreflightLoading(false);
      setShowPreflight(true);
    }
  };

  const handlePreflightConfirm = () => {
    setShowPreflight(false);
    if (canRegenerate) {
      setShowConfirm(true);
    } else {
      handleGenerate(false);
    }
  };

  const getPeriodLabel = () => {
    if (!period) return '';
    const [year, month] = period.split('-');
    const date = new Date(year, parseInt(month) - 1, 1);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
  };

  return (
    <div className="space-y-4">
      {/* Info card */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-start gap-4">
          <div className="p-3 bg-blue-100/30 rounded-lg">
            <Calculator className="w-6 h-6 text-blue-600" />
          </div>
          <div className="flex-1">
            <h4 className="text-lg font-semibold text-gray-900 mb-2">
              Step 2: Generate Payroll for {getPeriodLabel()}
            </h4>
            <p className="text-sm text-gray-600 mb-4">
              Click generate to calculate payroll. All bonuses, overtime, and deductions reviewed in Step 1 will be included.
            </p>
            <ul className="grid grid-cols-1 md:grid-cols-3 gap-2 text-sm text-gray-600">
              <li className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                Base salary + allowances + PAYE + Pension
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                Attendance deductions (lateness/absence)
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                Bonuses + overtime + loan deductions
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* Status tips */}
      {periodStatus?.status === 'generated' && (
        <div className="flex items-start gap-3 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-blue-700">
            Payroll has been generated. You can regenerate if adjustments were changed, or proceed to payslips.
          </p>
        </div>
      )}
      {isPaid && (
        <div className="flex items-start gap-3 p-4 bg-purple-50 border border-purple-200 rounded-lg">
          <CheckCircle className="w-5 h-5 text-purple-600 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-purple-700">Payroll has been paid. No further changes can be made.</p>
        </div>
      )}

      {/* Generate button */}
      <div>
        {(canGenerate || canRegenerate) && (
          <button
            onClick={handleGenerateClick}
            disabled={generating || preflightLoading}
            className={`flex items-center justify-center gap-2 px-8 py-3.5 text-white font-semibold rounded-lg transition-colors disabled:opacity-50 text-base ${
              canRegenerate ? 'bg-yellow-600 hover:bg-yellow-700' : 'bg-blue-600 hover:bg-blue-700'
            }`}
          >
            {generating ? (
              <><RefreshCw className="w-5 h-5 animate-spin" /> Generating...</>
            ) : preflightLoading ? (
              <><RefreshCw className="w-5 h-5 animate-spin" /> Checking staff...</>
            ) : (
              <>
                {canRegenerate ? <RefreshCw className="w-5 h-5" /> : <Play className="w-5 h-5" />}
                {canRegenerate ? 'Regenerate Payroll' : 'Generate Payroll'}
              </>
            )}
          </button>
        )}

        {isPaid && (
          <p className="flex items-center gap-2 text-sm text-purple-600">
            <CheckCircle className="w-5 h-5" />
            Payroll has been paid
          </p>
        )}
      </div>

      {/* Result summary */}
      {result && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-6">
          <div className="flex items-center gap-3 mb-4">
            <CheckCircle className="w-6 h-6 text-green-600" />
            <h4 className="text-lg font-semibold text-green-800">Payroll Generated Successfully</h4>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white rounded-lg p-4">
              <div className="flex items-center gap-2 text-gray-500 mb-1">
                <Users className="w-4 h-4" />
                <span className="text-sm">Processed</span>
              </div>
              <p className="text-2xl font-bold text-gray-900">{result.results?.processed || 0}</p>
            </div>

            <div className="bg-white rounded-lg p-4">
              <div className="flex items-center gap-2 text-gray-500 mb-1">
                <AlertTriangle className="w-4 h-4" />
                <span className="text-sm">Failed</span>
              </div>
              <p className="text-2xl font-bold text-gray-900">{result.results?.failed || 0}</p>
            </div>

            <div className="bg-white rounded-lg p-4">
              <div className="flex items-center gap-2 text-gray-500 mb-1">
                <DollarSign className="w-4 h-4" />
                <span className="text-sm">Total Net Pay</span>
              </div>
              <p className="text-2xl font-bold text-gray-900">
                {'\u20A6'}{(result.summary?.totalNetPay || 0).toLocaleString()}
              </p>
            </div>

            <div className="bg-white rounded-lg p-4">
              <div className="flex items-center gap-2 text-gray-500 mb-1">
                <Info className="w-4 h-4" />
                <span className="text-sm">Working Days</span>
              </div>
              <p className="text-2xl font-bold text-gray-900">{result.workingDays || 0}</p>
            </div>
          </div>

          {result.errors && result.errors.length > 0 && (
            <div className="mt-4 p-4 bg-yellow-50 rounded-lg">
              <p className="text-sm font-medium text-yellow-800 mb-2">Some records had errors:</p>
              <ul className="text-sm text-yellow-700 space-y-1">
                {result.errors.slice(0, 5).map((err, idx) => (
                  <li key={idx}>{err.employeeId}: {err.error}</li>
                ))}
                {result.errors.length > 5 && <li>... and {result.errors.length - 5} more</li>}
              </ul>
            </div>
          )}
        </div>
      )}

      <PreflightModal
        isOpen={showPreflight}
        onClose={() => setShowPreflight(false)}
        onConfirm={handlePreflightConfirm}
        preflight={preflight}
        periodLabel={getPeriodLabel()}
        isRegenerate={canRegenerate}
      />

      <ConfirmDialog
        isOpen={showConfirm}
        onClose={() => setShowConfirm(false)}
        onConfirm={() => handleGenerate(true)}
        title="Regenerate Payroll?"
        message={`This will recalculate payroll for ${getPeriodLabel()}. Existing data will be replaced. Bonuses and overtime entries will be preserved.`}
        confirmText="Regenerate"
        confirmVariant="warning"
      />
    </div>
  );
}

export default GeneratePayroll;
