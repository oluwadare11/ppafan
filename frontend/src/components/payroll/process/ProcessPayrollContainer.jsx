// ProcessPayrollContainer.jsx — Main container for payroll processing workflow
// 4-step flow: Adjustments → Generate → Payslips → Payments

import React, { useState, useEffect, useCallback } from 'react';
import { useTenant } from '../../../context/TenantProvider.jsx';
import {
  Play,
  CheckCircle,
  FileText,
  CreditCard,
  RefreshCw,
  Calendar,
  Users,
  DollarSign,
  SlidersHorizontal
} from 'lucide-react';

import {
  Alert,
  SkeletonLine
} from '../shared';

import AdjustmentsStep from './AdjustmentsStep';
import GeneratePayroll from './GeneratePayroll';
import GeneratePayslips from './GeneratePayslips';
import ProcessPayments from './ProcessPayments';

const STEPS = [
  { id: 'adjustments', label: 'Adjustments', shortLabel: 'Adjust', icon: SlidersHorizontal, description: 'Bonuses, overtime, deduction preview' },
  { id: 'generate', label: 'Generate', shortLabel: 'Generate', icon: Play, description: 'Generate payroll' },
  { id: 'payslips', label: 'Payslips', shortLabel: 'Payslips', icon: FileText, description: 'Generate payslips' },
  { id: 'payments', label: 'Payments', shortLabel: 'Pay', icon: CreditCard, description: 'Process payments' }
];

function ProcessPayrollContainer({ settings, onNavigateToTab }) {
  const { makeRequest } = useTenant();
  const [activeTab, setActiveTab] = useState('adjustments');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Available periods and current selection
  const [periods, setPeriods] = useState([]);
  const [periodStatuses, setPeriodStatuses] = useState({});
  const [selectedPeriod, setSelectedPeriod] = useState('');
  const [periodStatus, setPeriodStatus] = useState(null);

  // Fetch available periods + their statuses
  const fetchPeriods = useCallback(async () => {
    

    try {
      const data = await makeRequest('/api/payroll/available-periods');
      const periodsArr = data.periods || [];
      setPeriods(periodsArr);

      const statusMap = {};
      periodsArr.forEach(p => {
        if (p.period && p.status) {
          statusMap[p.period] = p.status;
        }
      });
      setPeriodStatuses(statusMap);

      const now = new Date();
      const currentPeriod = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      setSelectedPeriod(currentPeriod);

    } catch (err) {
      console.error('Error fetching periods:', err);
    }
  }, [makeRequest]);

  // Fetch period status
  const fetchPeriodStatus = useCallback(async () => {
    if (!selectedPeriod) return;

    try {
      const data = await makeRequest(`/api/payroll/process/${selectedPeriod}`);
      setPeriodStatus({
        status: data.status,
        staffCount: data.staffCount,
        totals: data.totals
      });
      if (data.status && selectedPeriod) {
        setPeriodStatuses(prev => ({ ...prev, [selectedPeriod]: data.status }));
      }
    } catch (err) {
      if (err.message?.includes('404') || err.message?.includes('not found')) {
        setPeriodStatus({ status: 'not_generated', staffCount: 0 });
      } else {
        console.error('Error fetching period status:', err);
        setPeriodStatus({ status: 'not_generated', staffCount: 0 });
      }
    }
  }, [selectedPeriod, makeRequest]);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await fetchPeriods();
      setLoading(false);
    };
    loadData();
  }, [fetchPeriods]);

  useEffect(() => {
    if (selectedPeriod) {
      fetchPeriodStatus();
    }
  }, [selectedPeriod, fetchPeriodStatus]);

  // Refresh data
  const handleRefresh = useCallback(async () => {
    setLoading(true);
    await fetchPeriods();
    await fetchPeriodStatus();
    setLoading(false);
  }, [fetchPeriods, fetchPeriodStatus]);

  // Clear messages after timeout
  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => setSuccess(''), 5000);
      return () => clearTimeout(timer);
    }
  }, [success]);

  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(''), 10000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  const getStatusSuffix = (status) => {
    switch (status) {
      case 'paid': return ' ✓ Paid';
      case 'approved': return ' · Approved';
      case 'generated': return ' · Generated';
      default: return '';
    }
  };

  const periodOptions = React.useMemo(() => {
    const options = [];
    const now = new Date();

    for (let i = 0; i < 13; i++) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const period = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const baseLabel = date.toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
      const status = periodStatuses[period];
      const label = baseLabel + getStatusSuffix(status);
      options.push({ value: period, label, status });
    }

    return options;
  }, [periodStatuses]);

  const getPeriodLabel = () => {
    if (!selectedPeriod) return '';
    const [year, month] = selectedPeriod.split('-');
    const date = new Date(year, parseInt(month) - 1, 1);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'generated': return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'approved': return 'bg-green-100 text-green-700 border-green-200';
      case 'paid': return 'bg-purple-100 text-purple-700 border-purple-200';
      default: return 'bg-gray-100 text-gray-600 border-gray-200';
    }
  };

  const getStatusLabel = (status) => {
    switch (status) {
      case 'generated': return 'Generated';
      case 'approved': return 'Approved';
      case 'paid': return 'Paid';
      case 'not_generated': return 'Not Generated';
      default: return status || 'Unknown';
    }
  };

  // Step states for 4-step flow
  const getStepState = (stepId) => {
    const status = periodStatus?.status;

    switch (stepId) {
      case 'adjustments':
        // Adjustments are always accessible; mark complete once payroll is generated
        if (status && status !== 'not_generated') return 'complete';
        return 'active';
      case 'generate':
        if (['generated', 'approved', 'paid'].includes(status)) return 'complete';
        if (status === 'not_generated' || !status) return 'active';
        return 'pending';
      case 'payslips':
        if (status === 'paid') return 'complete';
        if (['generated', 'approved'].includes(status)) return 'active';
        return 'pending';
      case 'payments':
        if (status === 'paid') return 'complete';
        if (['generated', 'approved'].includes(status)) return 'active';
        return 'pending';
      default:
        return 'pending';
    }
  };

  if (loading && !selectedPeriod) {
    return (
      <div className="animate-pulse space-y-3">
        {[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
          <SkeletonLine key={i} width={i % 2 === 0 ? "w-full" : "w-3/4"} />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with period selector */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-xl p-5 sm:p-6 text-white">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h3 className="text-xl font-bold">Process Payroll</h3>
            <p className="text-blue-100 text-sm mt-1">
              Review adjustments, generate, create payslips, and process payments
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-blue-300 pointer-events-none" />
              <select
                value={selectedPeriod}
                onChange={(e) => setSelectedPeriod(e.target.value)}
                className="pl-9 pr-4 py-2.5 border border-blue-400/30 rounded-lg bg-white/10 text-white font-medium focus:ring-2 focus:ring-white/30 focus:outline-none appearance-none cursor-pointer backdrop-blur-sm"
              >
                {periodOptions.map(option => (
                  <option key={option.value} value={option.value} className="text-gray-900">
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={handleRefresh}
              disabled={loading}
              className="p-2.5 bg-white/10 hover:bg-white/20 rounded-lg transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      {/* Visual Workflow Stepper */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-6">
        <div className="flex items-center justify-between mb-4">
          <h4 className="text-sm font-semibold text-gray-700 uppercase tracking-wider">Workflow Progress</h4>
          {periodStatus && (
            <span className={`inline-flex px-3 py-1 text-xs font-semibold rounded-full border ${getStatusColor(periodStatus.status)}`}>
              {getStatusLabel(periodStatus.status)}
            </span>
          )}
        </div>

        {/* Steps */}
        <div className="flex items-center justify-between">
          {STEPS.map((step, idx) => {
            const state = getStepState(step.id);
            const StepIcon = step.icon;
            const isActive = activeTab === step.id;

            return (
              <React.Fragment key={step.id}>
                <button
                  onClick={() => setActiveTab(step.id)}
                  className={`flex flex-col items-center gap-2 flex-1 group transition-all ${isActive ? 'scale-105' : ''}`}
                >
                  <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center transition-all ${
                    state === 'complete'
                      ? 'bg-green-500 text-white shadow-sm shadow-green-200'
                      : state === 'active'
                        ? 'bg-blue-600 text-white shadow-sm shadow-blue-200 ring-4 ring-blue-100'
                        : isActive
                          ? 'bg-blue-100 text-blue-600 ring-4 ring-blue-50'
                          : 'bg-gray-100 text-gray-400 group-hover:bg-gray-200'
                  }`}>
                    {state === 'complete' ? (
                      <CheckCircle className="w-5 h-5 sm:w-6 sm:h-6" />
                    ) : (
                      <StepIcon className="w-4 h-4 sm:w-5 sm:h-5" />
                    )}
                  </div>
                  <div className="text-center">
                    <p className={`text-xs sm:text-sm font-medium ${
                      isActive ? 'text-blue-700' : state === 'complete' ? 'text-green-700' : 'text-gray-500'
                    }`}>
                      <span className="hidden sm:inline">{step.label}</span>
                      <span className="sm:hidden">{step.shortLabel}</span>
                    </p>
                  </div>
                </button>

                {idx < STEPS.length - 1 && (
                  <div className={`flex-shrink-0 h-0.5 w-6 sm:w-12 mx-1 rounded ${
                    getStepState(STEPS[idx + 1].id) === 'complete' || getStepState(step.id) === 'complete'
                      ? 'bg-green-300'
                      : 'bg-gray-200'
                  }`} />
                )}
              </React.Fragment>
            );
          })}
        </div>

        {/* Quick Stats (show when payroll is generated) */}
        {periodStatus && periodStatus.staffCount > 0 && (
          <div className="grid grid-cols-3 gap-3 mt-5 pt-5 border-t border-gray-100">
            <div className="text-center">
              <div className="flex items-center justify-center gap-1.5 text-gray-400 mb-1">
                <Users className="w-3.5 h-3.5" />
                <span className="text-xs font-medium">Staff</span>
              </div>
              <p className="text-lg font-bold text-gray-900">{periodStatus.staffCount}</p>
            </div>
            <div className="text-center">
              <div className="flex items-center justify-center gap-1.5 text-gray-400 mb-1">
                <DollarSign className="w-3.5 h-3.5" />
                <span className="text-xs font-medium">Gross</span>
              </div>
              <p className="text-lg font-bold text-gray-900">
                {'\u20A6'}{(periodStatus.totals?.totalGrossPay || 0).toLocaleString()}
              </p>
            </div>
            <div className="text-center">
              <div className="flex items-center justify-center gap-1.5 text-green-500 mb-1">
                <DollarSign className="w-3.5 h-3.5" />
                <span className="text-xs font-medium">Net Pay</span>
              </div>
              <p className="text-lg font-bold text-green-600">
                {'\u20A6'}{(periodStatus.totals?.totalNetPay || 0).toLocaleString()}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Alerts */}
      {error && <Alert type="error" message={error} onDismiss={() => setError('')} />}
      {success && <Alert type="success" message={success} onDismiss={() => setSuccess('')} />}

      {/* Tab content */}
      <div>
        {activeTab === 'adjustments' && (
          <AdjustmentsStep
            period={selectedPeriod}
            periodStatus={periodStatus}
            modules={settings?.modules}
            onError={setError}
            onNext={() => setActiveTab('generate')}
            onGoToOvertimeSettings={onNavigateToTab ? () => onNavigateToTab('settings', 'overtime') : null}
          />
        )}

        {activeTab === 'generate' && (
          <GeneratePayroll
            period={selectedPeriod}
            periodStatus={periodStatus}
            settings={settings}
            onSuccess={(msg) => { setSuccess(msg); fetchPeriodStatus(); }}
            onError={setError}
          />
        )}

        {activeTab === 'payslips' && (
          <GeneratePayslips
            period={selectedPeriod}
            periodStatus={periodStatus}
            onSuccess={(msg) => { setSuccess(msg); fetchPeriodStatus(); }}
            onError={setError}
          />
        )}

        {activeTab === 'payments' && (
          <ProcessPayments
            period={selectedPeriod}
            periodStatus={periodStatus}
            onSuccess={(msg) => { setSuccess(msg); fetchPeriodStatus(); }}
            onError={setError}
            onNavigateToReports={() => onNavigateToTab?.('reports')}
          />
        )}
      </div>
    </div>
  );
}

export default ProcessPayrollContainer;
