// PayrollContainer.jsx - Main container for Pump House payroll module
// 8-tab layout: Dashboard | Staff Setup | Deductions | Process Payroll | Loans | Reports | Simulator | Settings

import React, { useState, useEffect, useCallback, useMemo, useRef, lazy, Suspense } from 'react';
import { useTenant } from '../../context/TenantProvider.jsx';
import {
  Settings, Users, Calculator, ChartBar, LayoutDashboard,
  AlertCircle, RefreshCw, ListChecks, Landmark, FlaskConical,
  RotateCcw, Lock, Info
} from 'lucide-react';

// Shared components
import {
  TabNavigation, TabPanel, PayrollPageSkeleton, Alert, SkeletonLine
} from './shared';

// Sub-containers
import { PayrollDashboard } from './dashboard';
import SettingsContainer from './settings/SettingsContainer';
import StaffSetupContainer from './staffSetup/StaffSetupContainer';
import ProcessPayrollContainer from './process/ProcessPayrollContainer';
import LoansTab from './process/LoansTab';
import { ReportsContainer } from './reports';
import PayrollSimulator from './simulator/PayrollSimulator';

const DeductionCalendar = lazy(() => import('./deductions/DeductionCalendar'));
const DeductionReport   = lazy(() => import('./deductions/DeductionReport'));

function LazyFallback() {
  return (
    <div className="animate-pulse space-y-3 p-4">
      {[1,2,3,4,5].map(i => <SkeletonLine key={i} width={i % 2 === 0 ? 'w-full' : 'w-3/4'} />)}
    </div>
  );
}

function PayrollContainer() {
  const { makeRequest } = useTenant();

  const [activeTab, setActiveTab]               = useState('dashboard');
  const [settingsScrollTo, setSettingsScrollTo] = useState(null);
  const [settings, setSettings]                 = useState(null);
  const [staff, setStaff]                       = useState([]);
  const [initialLoading, setInitialLoading]     = useState(true);
  const [refreshing, setRefreshing]             = useState(false);
  const [error, setError]                       = useState('');
  const [success, setSuccess]                   = useState('');
  const [deductionView, setDeductionView]       = useState('calendar');

  const [showRecalcModal, setShowRecalcModal] = useState(false);
  const [recalcRunning, setRecalcRunning]     = useState(false);
  const [recalcResult, setRecalcResult]       = useState(null);
  const [recalcStart, setRecalcStart]         = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [recalcEnd, setRecalcEnd] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });

  const [deductionRefreshTick, setDeductionRefreshTick] = useState(0);
  const pollingRef = useRef(null);

  const tabs = useMemo(() => [
    { id: 'dashboard',  label: 'Dashboard',      icon: LayoutDashboard, badge: null },
    { id: 'staff-setup',label: 'Staff Setup',     icon: Users,           badge: staff.length || null },
    { id: 'deductions', label: 'Deductions',      icon: ListChecks,      badge: null },
    { id: 'process',    label: 'Process Payroll', icon: Calculator,      badge: null },
    { id: 'loans',      label: 'Loans',           icon: Landmark,        badge: null },
    { id: 'reports',    label: 'Reports',         icon: ChartBar,        badge: null },
    { id: 'simulator',  label: 'Simulator',       icon: FlaskConical,    badge: null },
    { id: 'settings',   label: 'Settings',        icon: Settings,        badge: null },
  ], [staff.length]);

  useEffect(() => {
    if (error)   { const t = setTimeout(() => setError(''),   5000); return () => clearTimeout(t); }
  }, [error]);
  useEffect(() => {
    if (success) { const t = setTimeout(() => setSuccess(''), 4000); return () => clearTimeout(t); }
  }, [success]);

  const fetchInitialData = useCallback(async () => {
    try {
      const [settingsRes, staffRes] = await Promise.all([
        makeRequest('/api/payroll/settings'),
        makeRequest('/api/payroll/staff-setup')
      ]);
      setSettings(settingsRes);
      setStaff(staffRes.staff || []);
    } catch (err) {
      setError('Failed to load payroll data: ' + err.message);
    } finally {
      setInitialLoading(false);
    }
  }, [makeRequest]);

  useEffect(() => { fetchInitialData(); }, [fetchInitialData]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchInitialData();
    setRefreshing(false);
    setSuccess('Data refreshed');
  }, [fetchInitialData]);

  const updateSettings = useCallback(async (updates) => {
    const response = await makeRequest('/api/payroll/settings', { method: 'PUT', data: updates });
    setSettings(response.settings || response);
    setSuccess('Settings saved');
    return response;
  }, [makeRequest]);

  const updateStaffPayroll = useCallback(async (staffId, data) => {
    await makeRequest(`/api/payroll/staff-setup/${staffId}`, { method: 'PUT', data });
    setStaff(prev => prev.map(s => s._id === staffId ? { ...s, ...data } : s));
    setSuccess('Staff payroll updated');
  }, [makeRequest]);

  const bulkUpdateStaff = useCallback(async (updates) => {
    const response = await makeRequest('/api/payroll/staff-setup/bulk-update', { method: 'POST', data: { updates } });
    const staffRes = await makeRequest('/api/payroll/staff-setup');
    setStaff(staffRes.staff || []);
    setSuccess(`Updated ${response.results?.success || 0} staff members`);
    return response;
  }, [makeRequest]);

  const stopPolling = useCallback(() => {
    if (pollingRef.current) { clearInterval(pollingRef.current); pollingRef.current = null; }
  }, []);
  useEffect(() => () => stopPolling(), [stopPolling]);

  const handleRecalculateAttendance = useCallback(async () => {
    if (!recalcStart || !recalcEnd) return;
    setRecalcRunning(true);
    setRecalcResult(null);
    setShowRecalcModal(false);
    pollingRef.current = setInterval(() => setDeductionRefreshTick(t => t + 1), 10000);
    try {
      const result = await makeRequest('/api/payroll/deductions/recalculate-attendance', {
        method: 'POST', data: { startPeriod: recalcStart, endPeriod: recalcEnd }
      });
      setRecalcResult({ success: true, processed: result.processed, periods: result.periods });
      setSuccess(`Recalculated: ${result.processed} record(s) across ${result.periods} month(s)`);
    } catch (err) {
      setRecalcResult({ success: false, error: err.message });
      setError('Recalculation failed: ' + err.message);
    } finally {
      setRecalcRunning(false);
      stopPolling();
      setDeductionRefreshTick(t => t + 1);
    }
  }, [makeRequest, recalcStart, recalcEnd, stopPolling]);

  if (initialLoading) {
    return <div className="min-h-screen bg-gray-50 p-4 md:p-6"><PayrollPageSkeleton /></div>;
  }

  return (
    <>
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-8">

        {/* Header */}
        <div className="mb-6 md:mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Payroll Management</h1>
              <p className="text-gray-600 mt-1">Configure payroll settings and manage staff compensation</p>
            </div>
            <div className="flex items-center gap-3">
              <span className="hidden md:inline px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-sm text-gray-600">
                {staff.length} staff
              </span>
              <button onClick={handleRefresh} disabled={refreshing}
                className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors" title="Refresh">
                <RefreshCw className={`w-5 h-5 ${refreshing ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>
        </div>

        {/* Messages */}
        {error   && <div className="mb-6"><Alert type="error"   message={error}   onDismiss={() => setError('')}   dismissible /></div>}
        {success && <div className="mb-6"><Alert type="success" message={success} onDismiss={() => setSuccess('')} autoDismiss autoDismissTimeout={3000} /></div>}

        {/* Tab Navigation */}
        <div className="mb-6">
          <TabNavigation tabs={tabs} activeTab={activeTab} onChange={setActiveTab} variant="boxed" scrollable />
        </div>

        {/* Tab Panels */}
        <TabPanel id="dashboard" activeTab={activeTab}>
          <PayrollDashboard onNavigateToTab={setActiveTab} />
        </TabPanel>

        <TabPanel id="staff-setup" activeTab={activeTab}>
          <StaffSetupContainer
            staff={staff} settings={settings}
            onUpdateStaff={updateStaffPayroll} onBulkUpdate={bulkUpdateStaff}
            setError={setError} setSuccess={setSuccess}
          />
        </TabPanel>

        <TabPanel id="deductions" activeTab={activeTab}>
          {settings?.modules?.attendanceDeductions === false ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="w-14 h-14 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                <Lock className="w-7 h-7 text-gray-400" />
              </div>
              <h3 className="text-base font-semibold text-gray-700 mb-1">Attendance Deductions are disabled</h3>
              <p className="text-sm text-gray-500 max-w-xs">
                Enable in{' '}
                <button className="text-blue-600 underline hover:text-blue-700" onClick={() => setActiveTab('settings')}>
                  Settings → Deduction Rules
                </button>
              </p>
            </div>
          ) : (
            <>
              {recalcRunning && (
                <div className="flex items-start gap-3 mb-4 px-4 py-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <Info className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-blue-700">Recalculation running in the background. Refreshing every 10 seconds.</p>
                  <RotateCcw className="w-4 h-4 text-blue-500 animate-spin flex-shrink-0 mt-0.5" />
                </div>
              )}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-6">
                <div className="flex gap-2">
                  {['calendar','report'].map(v => (
                    <button key={v} onClick={() => setDeductionView(v)}
                      className={`px-3 py-2 rounded-lg text-sm font-medium capitalize transition-colors ${deductionView === v ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'}`}>
                      {v}
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => setDeductionRefreshTick(t => t + 1)} className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg" title="Refresh">
                    <RefreshCw className="w-4 h-4" />
                  </button>
                  <button onClick={() => { setRecalcResult(null); setShowRecalcModal(true); }} disabled={recalcRunning}
                    className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50">
                    <RotateCcw className={`w-4 h-4 ${recalcRunning ? 'animate-spin' : ''}`} />
                    <span className="hidden sm:inline">{recalcRunning ? 'Recalculating...' : 'Recalculate Deductions'}</span>
                    <span className="sm:hidden">{recalcRunning ? 'Working...' : 'Recalculate'}</span>
                  </button>
                </div>
              </div>
              <Suspense fallback={<LazyFallback />}>
                {deductionView === 'calendar'
                  ? <DeductionCalendar refreshTick={deductionRefreshTick} />
                  : <DeductionReport recalculating={recalcRunning} refreshTick={deductionRefreshTick} />}
              </Suspense>
            </>
          )}
        </TabPanel>

        <TabPanel id="process" activeTab={activeTab}>
          <ProcessPayrollContainer settings={settings} onNavigateToTab={(tab, scrollTo) => {
            setActiveTab(tab);
            if (scrollTo) setSettingsScrollTo(scrollTo);
          }} />
        </TabPanel>

        <TabPanel id="loans" activeTab={activeTab}>
          <LoansTab modules={settings?.modules} onGoToSettings={() => { setActiveTab('settings'); setSettingsScrollTo('loans'); }} />
        </TabPanel>

        <TabPanel id="reports" activeTab={activeTab}>
          <ReportsContainer />
        </TabPanel>

        <TabPanel id="simulator" activeTab={activeTab}>
          <div className="mb-6">
            <h2 className="text-lg font-semibold text-gray-900">Payroll Simulator</h2>
            <p className="text-sm text-gray-500 mt-0.5">
              Test payroll calculations using your live settings. Nothing is saved.
            </p>
          </div>
          <PayrollSimulator />
        </TabPanel>

        <TabPanel id="settings" activeTab={activeTab}>
          <SettingsContainer
            settings={settings} onUpdateSettings={updateSettings}
            setError={setError} setSuccess={setSuccess}
            scrollTarget={settingsScrollTo}
            onScrollTargetHandled={() => setSettingsScrollTo(null)}
          />
        </TabPanel>

      </div>
    </div>

    {/* Recalculate Deductions Modal */}
    {showRecalcModal && (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-xl shadow-xl w-full max-w-sm">
          <div className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-semibold text-gray-900">Recalculate Attendance Deductions</h3>
              <button onClick={() => setShowRecalcModal(false)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>
            <div className="flex items-start gap-2 mb-4 p-3 bg-blue-50 rounded-lg">
              <Info className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-blue-700">
                Recalculates lateness, early leave, and absence deductions only.
                PAYE, pension, and loans are not affected. Paid payroll is skipped.
              </p>
            </div>
            <div className="space-y-4 mb-5">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">From (month)</label>
                <input type="month" value={recalcStart} onChange={e => setRecalcStart(e.target.value)} max={recalcEnd}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white text-gray-900 focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">To (month)</label>
                <input type="month" value={recalcEnd} onChange={e => setRecalcEnd(e.target.value)} min={recalcStart}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white text-gray-900 focus:ring-2 focus:ring-blue-500" />
              </div>
            </div>
            {recalcResult?.success === false && <p className="text-xs text-red-600 mb-3">{recalcResult.error}</p>}
            <div className="flex gap-3">
              <button onClick={() => setShowRecalcModal(false)} className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg">Cancel</button>
              <button onClick={handleRecalculateAttendance} disabled={!recalcStart || !recalcEnd}
                className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg disabled:opacity-50">
                <RotateCcw className="w-4 h-4" /> Start
              </button>
            </div>
          </div>
        </div>
      </div>
    )}
    </>
  );
}

export default PayrollContainer;
