// ReportsContainer.jsx - Main container for payroll reports
// Phase 3: Reporting & Analytics

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useTenant } from '../../../context/TenantProvider.jsx';
import {
  FileText,
  Building2,
  PieChart,
  TrendingUp,
  Download,
  Filter,
  Calendar,
  RefreshCw,
  ChevronDown,
  AlertCircle
} from 'lucide-react';

import { TabNavigation, TabPanel, SkeletonLine, Alert } from '../shared';

// Report Components
import PayrollRegister from './PayrollRegister';
import StatutoryReports from './StatutoryReports';
import DeductionAnalysis from './DeductionAnalysis';
import DepartmentCosts from './DepartmentCosts';
import VarianceReport from './VarianceReport';

function ReportsContainer() {
  const { makeRequest } = useTenant();

  // Navigation state
  const [activeTab, setActiveTab] = useState('register');

  // Period selection
  const [availablePeriods, setAvailablePeriods] = useState([]);
  const [selectedPeriod, setSelectedPeriod] = useState('');
  const [periodRange, setPeriodRange] = useState({ start: '', end: '' });
  const [useRange, setUseRange] = useState(false);

  // Loading & messages
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Tab configuration
  const tabs = useMemo(() => [
    {
      id: 'register',
      label: 'Payroll Register',
      icon: FileText,
      badge: null
    },
    {
      id: 'statutory',
      label: 'Statutory Reports',
      icon: Building2,
      badge: null
    },
    {
      id: 'deductions',
      label: 'Deduction Analysis',
      icon: PieChart,
      badge: null
    },
    {
      id: 'department',
      label: 'Department Costs',
      icon: TrendingUp,
      badge: null
    },
    {
      id: 'variance',
      label: 'Variance',
      icon: TrendingUp,
      badge: null
    }
  ], []);

  // Fetch available periods
  const fetchPeriods = useCallback(async () => {
    

    try {
      setLoading(true);
      const response = await makeRequest('/api/payroll/available-periods');
      const periods = response.periods || [];
      setAvailablePeriods(periods);

      if (periods.length > 0 && !selectedPeriod) {
        const now = new Date();
        const currentPeriod = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        const best = periods.find(p => p === currentPeriod) || periods[0];
        setSelectedPeriod(best);
        // Set default range to last 3 months
        if (periods.length >= 3) {
          setPeriodRange({
            start: periods[2],
            end: periods[0]
          });
        } else {
          setPeriodRange({
            start: periods[periods.length - 1],
            end: periods[0]
          });
        }
      }
    } catch (err) {
      console.error('Error fetching periods:', err);
      setError('Failed to load available periods');
    } finally {
      setLoading(false);
    }
  }, [makeRequest, selectedPeriod]);

  useEffect(() => {
    fetchPeriods();
  }, [fetchPeriods]);

  // Clear error after timeout
  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(''), 5000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  // Period label formatter
  const getPeriodLabel = (period) => {
    if (!period) return '';
    const [year, month] = period.split('-');
    const date = new Date(year, parseInt(month) - 1, 1);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
  };


  // Loading state
  if (loading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse space-y-2">
          <SkeletonLine width="w-48" />
          <SkeletonLine width="w-64" />
        </div>
        <div className="animate-pulse space-y-3">
          {[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
            <SkeletonLine key={i} width={i % 2 === 0 ? "w-full" : "w-3/4"} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Period Selection */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">
              Payroll Reports
            </h3>
            <p className="text-sm text-gray-500">
              Generate and export payroll reports for compliance and analysis
            </p>
          </div>

          {/* Period Controls */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Single/Range Toggle */}
            <div className="flex items-center bg-gray-100 rounded-lg p-1">
              <button
                onClick={() => setUseRange(false)}
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                  !useRange
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-600'
                }`}
              >
                Single Period
              </button>
              <button
                onClick={() => setUseRange(true)}
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                  useRange
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-600'
                }`}
              >
                Date Range
              </button>
            </div>

            {/* Period Selectors */}
            {!useRange ? (
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-gray-400" />
                <select
                  value={selectedPeriod}
                  onChange={(e) => setSelectedPeriod(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 text-sm focus:ring-2 focus:ring-blue-500"
                >
                  {availablePeriods.map(period => (
                    <option key={period} value={period}>
                      {getPeriodLabel(period)}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-gray-400" />
                <select
                  value={periodRange.start}
                  onChange={(e) => setPeriodRange(prev => ({ ...prev, start: e.target.value }))}
                  className="px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 text-sm focus:ring-2 focus:ring-blue-500"
                >
                  {availablePeriods.map(period => (
                    <option key={period} value={period}>
                      {getPeriodLabel(period)}
                    </option>
                  ))}
                </select>
                <span className="text-gray-500">to</span>
                <select
                  value={periodRange.end}
                  onChange={(e) => setPeriodRange(prev => ({ ...prev, end: e.target.value }))}
                  className="px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 text-sm focus:ring-2 focus:ring-blue-500"
                >
                  {availablePeriods.map(period => (
                    <option key={period} value={period}>
                      {getPeriodLabel(period)}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Refresh */}
            <button
              onClick={fetchPeriods}
              className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              title="Refresh"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <Alert
          type="error"
          message={error}
          onDismiss={() => setError('')}
          dismissible
        />
      )}

      {/* No Periods Available */}
      {availablePeriods.length === 0 && (
        <div className="bg-yellow-50/20 border border-yellow-200 rounded-lg p-6 text-center">
          <AlertCircle className="w-10 h-10 text-yellow-500 mx-auto mb-3" />
          <h4 className="text-lg font-medium text-yellow-800 mb-2">
            No Payroll Data Available
          </h4>
          <p className="text-yellow-600 text-sm">
            Reports require processed payroll data. Process payroll for at least one period to generate reports.
          </p>
        </div>
      )}

      {/* Reports Tabs */}
      {availablePeriods.length > 0 && (
        <>
          <div className="overflow-x-auto">
            <TabNavigation
              tabs={tabs}
              activeTab={activeTab}
              onChange={setActiveTab}
              variant="underline"
              scrollable
            />
          </div>

          {/* Tab Panels */}
          <TabPanel id="register" activeTab={activeTab}>
            <PayrollRegister
              period={useRange ? null : selectedPeriod}
              startPeriod={useRange ? periodRange.start : null}
              endPeriod={useRange ? periodRange.end : null}
              setError={setError}
            />
          </TabPanel>

          <TabPanel id="statutory" activeTab={activeTab}>
            <StatutoryReports
              period={useRange ? null : selectedPeriod}
              startPeriod={useRange ? periodRange.start : null}
              endPeriod={useRange ? periodRange.end : null}
              setError={setError}
            />
          </TabPanel>

          <TabPanel id="deductions" activeTab={activeTab}>
            <DeductionAnalysis
              period={useRange ? null : selectedPeriod}
              startPeriod={useRange ? periodRange.start : null}
              endPeriod={useRange ? periodRange.end : null}
              setError={setError}
            />
          </TabPanel>

          <TabPanel id="department" activeTab={activeTab}>
            <DepartmentCosts
              period={useRange ? null : selectedPeriod}
              startPeriod={useRange ? periodRange.start : null}
              endPeriod={useRange ? periodRange.end : null}
              setError={setError}
            />
          </TabPanel>

          <TabPanel id="variance" activeTab={activeTab}>
            <VarianceReport
              availablePeriods={availablePeriods}
              setError={setError}
            />
          </TabPanel>
        </>
      )}
    </div>
  );
}

export default ReportsContainer;
