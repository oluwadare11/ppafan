// SettingsContainer.jsx - Container for all payroll settings
// Phase 1: Statutory, Salary Components, Deductions, Overtime, Processing

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import {
  Scale,
  DollarSign,
  Clock,
  Calendar,
  Settings,
  Percent,
  AlertTriangle,
  X,
  RefreshCw
} from 'lucide-react';

// Shared components
import {
  SubTabs,
  SettingsGridSkeleton,
  FormActions
} from '../shared';

// Settings sub-components
import StatutoryCompliance from './StatutoryCompliance';
import SalaryComponents from './SalaryComponents';
import DeductionRules from './DeductionRules';
import OvertimeRates from './OvertimeRates';
import ProcessingSettings from './ProcessingSettings';

function SettingsContainer({
  settings,
  onUpdateSettings,
  setError,
  setSuccess,
  currentPeriod,
  scrollTarget,
  onScrollTargetHandled
}) {
  const [activeSubTab, setActiveSubTab] = useState('statutory');

  // When parent tells us to scroll to a specific section, switch to the right sub-tab
  useEffect(() => {
    if (!scrollTarget) return;
    if (scrollTarget === 'loans') setActiveSubTab('processing');
    else if (scrollTarget === 'overtime') setActiveSubTab('overtime');
  }, [scrollTarget]);
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [showFirstRunBanner, setShowFirstRunBanner] = useState(true);
  const [rerunBanners, setRerunBanners] = useState([]); // [{module, enabled, message}]

  // Local state for pending changes
  const [pendingChanges, setPendingChanges] = useState({});

  // Warn before leaving with unsaved changes
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (hasChanges) {
        e.preventDefault();
        e.returnValue = 'You have unsaved payroll settings changes. Leave without saving?';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasChanges]);

  // Detect first-run: version 1 AND PAYE has never been explicitly enabled
  const isFirstRun = useMemo(() => {
    if (!settings) return false;
    return settings.version === 1 && !settings.statutory?.paye?.enabled;
  }, [settings]);

  // Sub-tabs configuration
  const subTabs = useMemo(() => [
    { id: 'statutory', label: 'Statutory Compliance', icon: Scale },
    { id: 'components', label: 'Salary Components', icon: DollarSign },
    { id: 'deductions', label: 'Deduction Rules', icon: Percent },
    { id: 'overtime', label: 'Overtime Rates', icon: Clock },
    { id: 'processing', label: 'Processing', icon: Calendar }
  ], []);

  // Handle local changes
  const handleChange = useCallback((section, data) => {
    setPendingChanges(prev => ({
      ...prev,
      [section]: data
    }));
    setHasChanges(true);
  }, []);

  // Save changes
  const handleSave = useCallback(async () => {
    if (!hasChanges) return;

    setIsSaving(true);
    try {
      const response = await onUpdateSettings(pendingChanges);
      setPendingChanges({});
      setHasChanges(false);
      // Check if any module toggles changed and prompt rerun
      if (response?.payrollRerunRecommended && response?.rerunRecommendations?.length > 0) {
        setRerunBanners(response.rerunRecommendations);
      }
    } catch (err) {
      // Error is handled by parent
    } finally {
      setIsSaving(false);
    }
  }, [hasChanges, pendingChanges, onUpdateSettings]);

  // Reset changes
  const handleReset = useCallback(() => {
    setPendingChanges({});
    setHasChanges(false);
  }, []);

  // Get merged settings (original + pending changes)
  const mergedSettings = useMemo(() => {
    if (!settings) return null;

    return {
      ...settings,
      modules: { ...settings.modules, ...pendingChanges.modules },
      statutory: { ...settings.statutory, ...pendingChanges.statutory },
      salaryComponents: pendingChanges.salaryComponents || settings.salaryComponents,
      deductions: { ...settings.deductions, ...pendingChanges.deductions },
      overtime: { ...settings.overtime, ...pendingChanges.overtime },
      processing: { ...settings.processing, ...pendingChanges.processing },
      leave: { ...settings.leave, ...pendingChanges.leave },
      loans: { ...settings.loans, ...pendingChanges.loans }
    };
  }, [settings, pendingChanges]);

  if (!settings) {
    return <SettingsGridSkeleton count={4} />;
  }

  return (
    <div className="space-y-6">
      {/* First-run guidance banner */}
      {isFirstRun && showFirstRunBanner && (
        <div className="flex items-start gap-4 p-4 bg-amber-50 border border-amber-200 rounded-xl">
          <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-amber-900 mb-1">Configure your payroll settings first</p>
            <p className="text-sm text-amber-800">
              Before running payroll, review and confirm your statutory rates: <strong>PAYE</strong>, <strong>Pension</strong> (8% employee + 10% employer is the Nigerian default), <strong>NHF</strong>, and your pay day. Incorrect settings will affect all payroll calculations.
            </p>
          </div>
          <button onClick={() => setShowFirstRunBanner(false)} className="text-amber-500 hover:text-amber-700 flex-shrink-0">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Rerun payroll banners — shown after module toggle saved */}
      {rerunBanners.map((banner, i) => (
        <div key={i} className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-300 rounded-xl">
          <RefreshCw className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-amber-900 mb-1">
              {banner.enabled ? 'Module Enabled — Rerun Payroll' : 'Module Disabled — Rerun Payroll'}
            </p>
            <p className="text-sm text-amber-800">{banner.message}</p>
            {currentPeriod && (
              <p className="text-xs text-amber-700 mt-1">
                Go to <strong>Process Payroll → Generate</strong> and rerun for <strong>{currentPeriod}</strong> to apply this change.
              </p>
            )}
          </div>
          <button
            onClick={() => setRerunBanners(prev => prev.filter((_, j) => j !== i))}
            className="text-amber-500 hover:text-amber-700 flex-shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ))}

      {/* Unsaved changes indicator */}
      {hasChanges && (
        <div className="flex items-center gap-2 px-4 py-2 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800">
          <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
          You have unsaved changes.
        </div>
      )}

      {/* Sub-navigation */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
        <SubTabs
          tabs={subTabs}
          activeTab={activeSubTab}
          onChange={setActiveSubTab}
        />
      </div>

      {/* Content */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 md:p-6">
        {activeSubTab === 'statutory' && (
          <StatutoryCompliance
            settings={mergedSettings.statutory}
            onChange={(data) => handleChange('statutory', data)}
          />
        )}

        {activeSubTab === 'components' && (
          <SalaryComponents
            components={mergedSettings.salaryComponents}
            onChange={(data) => handleChange('salaryComponents', data)}
          />
        )}

        {activeSubTab === 'deductions' && (
          <DeductionRules
            settings={mergedSettings.deductions}
            modules={mergedSettings.modules}
            processing={mergedSettings.processing}
            onChange={(data) => handleChange('deductions', data)}
            onModuleChange={(data) => handleChange('modules', data)}
          />
        )}

        {activeSubTab === 'overtime' && (
          <OvertimeRates
            settings={mergedSettings.overtime}
            onChange={(data) => handleChange('overtime', data)}
          />
        )}

        {activeSubTab === 'processing' && (
          <ProcessingSettings
            settings={mergedSettings.processing}
            leave={mergedSettings.leave}
            loans={mergedSettings.loans}
            onChange={(section, data) => handleChange(section, data)}
            scrollTo={scrollTarget === 'loans' ? 'loans' : null}
            onScrollDone={onScrollTargetHandled}
          />
        )}

        {/* Save/Reset Actions — always visible */}
        <div className="mt-8 pt-6 border-t border-gray-200">
          <div className="flex items-center justify-end gap-3">
            {hasChanges && (
              <button
                type="button"
                onClick={handleReset}
                disabled={isSaving}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors"
              >
                Discard Changes
              </button>
            )}
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving || !hasChanges}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
            >
              {isSaving && <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
              Save Settings
            </button>
          </div>
        </div>
      </div>

      {/* Settings info */}
      <div className="text-sm text-gray-500 text-center">

      </div>
    </div>
  );
}

export default SettingsContainer;
