// DeductionRules.jsx - Deduction rules settings
// Configure lateness, absence, and early leave deduction rules

import React, { useCallback } from 'react';
import {
  Clock,
  UserX,
  LogOut,
  Info,
  ShieldOff,
  ToggleRight
} from 'lucide-react';

import {
  FormCard,
  FormField,
  FormSection,
  FormDivider,
  SettingsToggle,
  Tip,
  EnabledBadge
} from '../shared';

const LATENESS_METHODS = [
  { value: 'salary_based', label: 'Salary-based (minute rate from salary)' },
  { value: 'fixed_rate', label: 'Fixed rate (₦ per minute)' },
  { value: 'flat_fee', label: 'Flat fee per occurrence' }
];

const ABSENCE_METHODS = [
  { value: 'salary_based', label: 'Salary-based (daily base rate)' },
  { value: 'fixed_amount', label: 'Fixed amount per absent day' }
];

const GRACE_MODE_OPTIONS = [
  {
    value: 'threshold',
    label: 'Threshold',
    description: 'Once grace is exceeded, deduct ALL late minutes (recommended)'
  },
  {
    value: 'excess',
    label: 'Excess only',
    description: 'Only deduct the minutes above the grace period'
  }
];

function DeductionRules({ settings, modules, processing, onChange, onModuleChange }) {
  const moduleEnabled = modules?.attendanceDeductions === true;

  const updateSection = useCallback((section, field, value) => {
    onChange({
      ...settings,
      [section]: {
        ...settings[section],
        [field]: value
      }
    });
  }, [settings, onChange]);

  const handleMasterToggle = useCallback((checked) => {
    onModuleChange({ ...modules, attendanceDeductions: checked });
  }, [modules, onModuleChange]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          Deduction Rules
        </h3>
        <p className="text-sm text-gray-500">
          Configure automatic deductions for lateness, absence, and early departure.
          All deductions use base salary only — allowances are not forfeit.
        </p>
      </div>

      {/* ── MASTER MODULE TOGGLE ── */}
      <div className={`flex items-center justify-between p-4 rounded-xl border-2 transition-colors ${
        moduleEnabled
          ? 'border-green-300 bg-green-50/60'
          : 'border-gray-200 bg-gray-50'
      }`}>
        <div className="flex items-center gap-3">
          {moduleEnabled
            ? <ToggleRight className="w-6 h-6 text-green-600" />
            : <ShieldOff className="w-6 h-6 text-gray-400" />
          }
          <div>
            <p className="text-sm font-semibold text-gray-900">
              Attendance Deductions Module
            </p>
            <p className="text-xs text-gray-500 mt-0.5">
              {moduleEnabled
                ? 'Active — lateness, absence, and early leave deductions will be calculated on every payroll run.'
                : 'Off — no attendance deductions will be calculated. Enable to configure and apply deductions.'}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => handleMasterToggle(!moduleEnabled)}
          className={`relative inline-flex h-7 w-12 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-1 ${
            moduleEnabled ? 'bg-green-500' : 'bg-gray-300'
          }`}
          role="switch"
          aria-checked={moduleEnabled}
        >
          <span
            className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
              moduleEnabled ? 'translate-x-5' : 'translate-x-0'
            }`}
          />
        </button>
      </div>

      {/* Off-state notice */}
      {!moduleEnabled && (
        <div className="flex items-start gap-3 p-4 rounded-lg bg-gray-100 border border-gray-200">
          <ShieldOff className="w-5 h-5 text-gray-400 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-gray-500">
            Attendance deductions are <strong>disabled</strong>. Enable the module above to configure lateness, absence, and early leave policies.
            After enabling and saving, you will be prompted to rerun payroll to apply the changes.
          </p>
        </div>
      )}

      {moduleEnabled && (
        <Tip>
          Deductions are calculated automatically from attendance records.
          Working hours per staff are derived from their assigned shift.
        </Tip>
      )}

      {/* Individual deduction cards — only shown when master module is ON */}
      {moduleEnabled && (<>

      {/* Lateness Settings */}
      <FormCard
        title="Lateness Deduction"
        description="Deductions for arriving late to work"
        icon={Clock}
        iconBgColor="bg-yellow-100/30"
        iconColor="text-yellow-600"
        headerRight={<EnabledBadge enabled={settings.lateness?.enabled} />}
        collapsible
      >
        <div className="space-y-4">
          <SettingsToggle
            label="Enable Lateness Deduction"
            description="Automatically deduct from salary for late arrivals"
            checked={settings.lateness?.enabled}
            onChange={(checked) => updateSection('lateness', 'enabled', checked)}
          />

          {settings.lateness?.enabled && (
            <>
              <FormDivider />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField label="Grace Period" hint="No deduction within this window">
                  <div className="relative">
                    <input
                      type="number"
                      min={0}
                      value={settings.lateness?.graceMinutes ?? 5}
                      onChange={(e) => updateSection('lateness', 'graceMinutes', parseInt(e.target.value) || 0)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 focus:ring-2 focus:ring-blue-500"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500">min</span>
                  </div>
                </FormField>

                <FormField label="Deduction Method">
                  <select
                    value={settings.lateness?.method || 'salary_based'}
                    onChange={(e) => updateSection('lateness', 'method', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 focus:ring-2 focus:ring-blue-500"
                  >
                    {LATENESS_METHODS.map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </FormField>
              </div>

              {/* Grace mode toggle */}
              <FormSection title="Grace Period Behaviour">
                <div className="space-y-2">
                  {GRACE_MODE_OPTIONS.map(opt => (
                    <label
                      key={opt.value}
                      className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                        (settings.lateness?.graceMode || 'threshold') === opt.value
                          ? 'border-blue-200 bg-blue-50/40'
                          : 'border-gray-200 hover:bg-gray-50'
                      }`}
                    >
                      <input
                        type="radio"
                        name="lateness-graceMode"
                        value={opt.value}
                        checked={(settings.lateness?.graceMode || 'threshold') === opt.value}
                        onChange={() => updateSection('lateness', 'graceMode', opt.value)}
                        className="mt-0.5 accent-blue-600"
                      />
                      <div>
                        <p className="text-sm font-medium text-gray-900">{opt.label}</p>
                        <p className="text-xs text-gray-500">{opt.description}</p>
                      </div>
                    </label>
                  ))}
                </div>
              </FormSection>

              {/* Method-specific fields */}
              {settings.lateness?.method === 'fixed_rate' && (
                <FormField label="Fixed Rate per Minute" hint="Same rate for all staff regardless of salary">
                  <div className="relative w-44">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">₦</span>
                    <input
                      type="number"
                      min={0}
                      value={settings.lateness?.ratePerMinute || 0}
                      onChange={(e) => updateSection('lateness', 'ratePerMinute', parseFloat(e.target.value) || 0)}
                      className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 focus:ring-2 focus:ring-blue-500"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 text-xs">/min</span>
                  </div>
                </FormField>
              )}

              {settings.lateness?.method === 'flat_fee' && (
                <FormField label="Flat Fee per Late Arrival" hint="Fixed deduction regardless of how late">
                  <div className="relative w-44">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">₦</span>
                    <input
                      type="number"
                      min={0}
                      value={settings.lateness?.flatFee || 0}
                      onChange={(e) => updateSection('lateness', 'flatFee', parseFloat(e.target.value) || 0)}
                      className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </FormField>
              )}

              <FormField label="Maximum Daily Deduction" hint="Leave empty for no limit">
                <div className="relative w-44">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">₦</span>
                  <input
                    type="number"
                    min={0}
                    value={settings.lateness?.maxDailyDeduction || ''}
                    onChange={(e) => updateSection('lateness', 'maxDailyDeduction', e.target.value ? parseFloat(e.target.value) : null)}
                    placeholder="No limit"
                    className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </FormField>
            </>
          )}
        </div>
      </FormCard>

      {/* Absence Settings */}
      <FormCard
        title="Absence Deduction"
        description="Deductions for unexcused absences"
        icon={UserX}
        iconBgColor="bg-red-100/30"
        iconColor="text-red-600"
        headerRight={<EnabledBadge enabled={settings.absence?.enabled} />}
        collapsible
      >
        <div className="space-y-4">
          <SettingsToggle
            label="Enable Absence Deduction"
            description="Automatically deduct from salary for absences"
            checked={settings.absence?.enabled}
            onChange={(checked) => updateSection('absence', 'enabled', checked)}
          />

          {settings.absence?.enabled && (
            <>
              <FormDivider />

              <FormField label="Deduction Method">
                <select
                  value={settings.absence?.method || 'salary_based'}
                  onChange={(e) => updateSection('absence', 'method', e.target.value)}
                  className="w-full md:w-72 px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 focus:ring-2 focus:ring-blue-500"
                >
                  {ABSENCE_METHODS.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </FormField>

              {(settings.absence?.method === 'salary_based' || !settings.absence?.method) && (
                <div className="rounded-lg bg-blue-50/40 border border-blue-100 px-4 py-3 text-sm text-blue-700">
                  Deduction = baseSalary ÷ workingDaysInMonth × absentDays.
                  Allowances are not affected.
                </div>
              )}

              {settings.absence?.method === 'fixed_amount' && (
                <FormField label="Fixed Amount per Absent Day">
                  <div className="relative w-44">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">₦</span>
                    <input
                      type="number"
                      min={0}
                      value={settings.absence?.customAmount || 0}
                      onChange={(e) => updateSection('absence', 'customAmount', parseFloat(e.target.value) || 0)}
                      className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </FormField>
              )}
            </>
          )}
        </div>
      </FormCard>

      {/* Early Leave Settings */}
      <FormCard
        title="Early Leave Deduction"
        description="Deductions for leaving work early"
        icon={LogOut}
        iconBgColor="bg-orange-100/30"
        iconColor="text-orange-600"
        headerRight={<EnabledBadge enabled={settings.earlyLeave?.enabled} />}
        collapsible
      >
        <div className="space-y-4">
          <SettingsToggle
            label="Enable Early Leave Deduction"
            description="Automatically deduct from salary for early departures"
            checked={settings.earlyLeave?.enabled}
            onChange={(checked) => updateSection('earlyLeave', 'enabled', checked)}
          />

          {settings.earlyLeave?.enabled && (
            <>
              <FormDivider />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField label="Grace Period" hint="No deduction within this window">
                  <div className="relative">
                    <input
                      type="number"
                      min={0}
                      value={settings.earlyLeave?.graceMinutes ?? 5}
                      onChange={(e) => updateSection('earlyLeave', 'graceMinutes', parseInt(e.target.value) || 0)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 focus:ring-2 focus:ring-blue-500"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500">min</span>
                  </div>
                </FormField>

                <FormField label="Deduction Method">
                  <select
                    value={settings.earlyLeave?.method || 'salary_based'}
                    onChange={(e) => updateSection('earlyLeave', 'method', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 focus:ring-2 focus:ring-blue-500"
                  >
                    {LATENESS_METHODS.map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </FormField>
              </div>

              {/* Grace mode toggle */}
              <FormSection title="Grace Period Behaviour">
                <div className="space-y-2">
                  {GRACE_MODE_OPTIONS.map(opt => (
                    <label
                      key={opt.value}
                      className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                        (settings.earlyLeave?.graceMode || 'threshold') === opt.value
                          ? 'border-blue-200 bg-blue-50/40'
                          : 'border-gray-200 hover:bg-gray-50'
                      }`}
                    >
                      <input
                        type="radio"
                        name="earlyLeave-graceMode"
                        value={opt.value}
                        checked={(settings.earlyLeave?.graceMode || 'threshold') === opt.value}
                        onChange={() => updateSection('earlyLeave', 'graceMode', opt.value)}
                        className="mt-0.5 accent-blue-600"
                      />
                      <div>
                        <p className="text-sm font-medium text-gray-900">{opt.label}</p>
                        <p className="text-xs text-gray-500">{opt.description}</p>
                      </div>
                    </label>
                  ))}
                </div>
              </FormSection>

              {settings.earlyLeave?.method === 'fixed_rate' && (
                <FormField label="Fixed Rate per Minute" hint="Same rate for all staff regardless of salary">
                  <div className="relative w-44">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">₦</span>
                    <input
                      type="number"
                      min={0}
                      value={settings.earlyLeave?.ratePerMinute || 0}
                      onChange={(e) => updateSection('earlyLeave', 'ratePerMinute', parseFloat(e.target.value) || 0)}
                      className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 focus:ring-2 focus:ring-blue-500"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 text-xs">/min</span>
                  </div>
                </FormField>
              )}

              {settings.earlyLeave?.method === 'flat_fee' && (
                <FormField label="Flat Fee per Early Departure">
                  <div className="relative w-44">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">₦</span>
                    <input
                      type="number"
                      min={0}
                      value={settings.earlyLeave?.flatFee || 0}
                      onChange={(e) => updateSection('earlyLeave', 'flatFee', parseFloat(e.target.value) || 0)}
                      className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </FormField>
              )}

              <FormField label="Maximum Daily Deduction" hint="Leave empty for no limit">
                <div className="relative w-44">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">₦</span>
                  <input
                    type="number"
                    min={0}
                    value={settings.earlyLeave?.maxDailyDeduction || ''}
                    onChange={(e) => updateSection('earlyLeave', 'maxDailyDeduction', e.target.value ? parseFloat(e.target.value) : null)}
                    placeholder="No limit"
                    className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </FormField>
            </>
          )}
        </div>
      </FormCard>

      </>)}
    </div>
  );
}

export default DeductionRules;
