// ProcessingSettings.jsx - Payroll processing settings
// Configure working days, payment cycles, approvals, rounding, loans

import React, { useCallback, useEffect, useRef } from 'react';
import {
  Calendar,
  CheckCircle,
  Calculator,
  Wallet
} from 'lucide-react';

import {
  FormCard,
  FormField,
  FormSection,
  FormDivider,
  SettingsToggle,
  Tip
} from '../shared';

// Days of week
const DAYS_OF_WEEK = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

// Payment cycles
const PAYMENT_CYCLES = [
  { value: 'weekly', label: 'Weekly' },
  { value: 'bi-weekly', label: 'Bi-Weekly' },
  { value: 'monthly', label: 'Monthly' }
];

// Rounding methods
const ROUNDING_METHODS = [
  { value: 'nearest', label: 'Nearest (Standard)' },
  { value: 'up', label: 'Round Up' },
  { value: 'down', label: 'Round Down' }
];

function ProcessingSettings({ settings, leave, loans, onChange, scrollTo, onScrollDone }) {
  const loanCardRef = useRef(null);

  useEffect(() => {
    if (scrollTo === 'loans' && loanCardRef.current) {
      setTimeout(() => {
        loanCardRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
        if (onScrollDone) onScrollDone();
      }, 200);
    }
  }, [scrollTo, onScrollDone]);
  // Update processing field
  const updateProcessing = useCallback((field, value) => {
    onChange('processing', {
      ...settings,
      [field]: value
    });
  }, [settings, onChange]);

  // Update approval settings
  const updateApproval = useCallback((field, value) => {
    onChange('processing', {
      ...settings,
      approval: {
        ...settings.approval,
        [field]: value
      }
    });
  }, [settings, onChange]);

  // Update rounding settings
  const updateRounding = useCallback((field, value) => {
    onChange('processing', {
      ...settings,
      rounding: {
        ...settings.rounding,
        [field]: value
      }
    });
  }, [settings, onChange]);

  // Update loans settings
  const updateLoans = useCallback((field, value) => {
    onChange('loans', {
      ...loans,
      [field]: value
    });
  }, [loans, onChange]);

  // Toggle working day (default: Mon-Fri)
  const toggleWorkingDay = useCallback((day) => {
    const currentDays = settings.workingDaysDefinition || DAYS_OF_WEEK.slice(0, 5);
    const newDays = currentDays.includes(day)
      ? currentDays.filter(d => d !== day)
      : [...currentDays, day];
    updateProcessing('workingDaysDefinition', newDays);
  }, [settings, updateProcessing]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          Processing Settings
        </h3>
        <p className="text-sm text-gray-500">
          Configure payroll processing rules, schedules, and calculations
        </p>
      </div>

      {/* Working Days */}
      <FormCard
        title="Working Days"
        description="Define standard working days and hours"
        icon={Calendar}
        iconBgColor="bg-blue-100/30"
        iconColor="text-blue-600"
      >
        <div className="space-y-4">
          <FormSection title="Working Days per Week">
            <p className="text-xs text-gray-500 mb-2">
              Select which days your organisation works. Working days are counted dynamically per month — no fixed number needed.
            </p>
            <div className="flex flex-wrap gap-2">
              {DAYS_OF_WEEK.map((day) => {
                const isSelected = (settings.workingDaysDefinition || DAYS_OF_WEEK.slice(0, 5)).includes(day);
                return (
                  <button
                    key={day}
                    onClick={() => toggleWorkingDay(day)}
                    className={`px-3 py-1.5 text-sm font-medium rounded-lg border transition-colors ${
                      isSelected
                        ? 'bg-blue-100/30 text-blue-700 border-blue-200'
                        : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'
                    }`}
                  >
                    {day.substring(0, 3)}
                  </button>
                );
              })}
            </div>
          </FormSection>

          <FormField
            label="Fallback Working Hours/Day"
            hint="Used only for staff with no assigned shift"
          >
            <div className="relative w-40">
              <input
                type="number"
                value={settings.workingHoursPerDay || 8}
                onChange={(e) => updateProcessing('workingHoursPerDay', parseInt(e.target.value) || 8)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 focus:ring-2 focus:ring-blue-500"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500">hrs</span>
            </div>
          </FormField>
        </div>
      </FormCard>

      {/* Payment Schedule */}
      <FormCard
        title="Payment Schedule"
        description="Configure payment cycle and dates"
        icon={Wallet}
        iconBgColor="bg-green-100/30"
        iconColor="text-green-600"
      >
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <FormField label="Payment Cycle">
              <select
                value={settings.paymentCycle || 'monthly'}
                onChange={(e) => updateProcessing('paymentCycle', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 focus:ring-2 focus:ring-blue-500"
              >
                {PAYMENT_CYCLES.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </FormField>

            <FormField label="Payment Day" hint="Day of month">
              <input
                type="number"
                min={1}
                max={31}
                value={settings.paymentDay || 28}
                onChange={(e) => updateProcessing('paymentDay', parseInt(e.target.value) || 28)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 focus:ring-2 focus:ring-blue-500"
              />
            </FormField>

            <FormField label="Cutoff Day" hint="Last day to record">
              <input
                type="number"
                min={1}
                max={31}
                value={settings.cutoffDay || 25}
                onChange={(e) => updateProcessing('cutoffDay', parseInt(e.target.value) || 25)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 focus:ring-2 focus:ring-blue-500"
              />
            </FormField>
          </div>

          <SettingsToggle
            label="Auto-generate on Cutoff"
            description="Automatically generate payroll on the cutoff date"
            checked={settings.autoGenerateOnCutoff}
            onChange={(checked) => updateProcessing('autoGenerateOnCutoff', checked)}
          />
        </div>
      </FormCard>

      {/* Approval Workflow */}
      <FormCard
        title="Approval Workflow"
        description="Configure payroll approval requirements"
        icon={CheckCircle}
        iconBgColor="bg-purple-100/30"
        iconColor="text-purple-600"
      >
        <div className="space-y-4">
          <SettingsToggle
            label="Require Approval"
            description="Payroll must be approved before processing"
            checked={settings.approval?.requireApproval !== false}
            onChange={(checked) => updateApproval('requireApproval', checked)}
          />

          {settings.approval?.requireApproval !== false && (
            <>
              <FormDivider />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField label="Approval Levels" hint="Number of approval stages">
                  <input
                    type="number"
                    min={1}
                    max={3}
                    value={settings.approval?.approvalLevels || 1}
                    onChange={(e) => updateApproval('approvalLevels', parseInt(e.target.value) || 1)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 focus:ring-2 focus:ring-blue-500"
                  />
                </FormField>

                <FormField label="Auto-approve Below" hint="N0 = never auto-approve">
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">N</span>
                    <input
                      type="number"
                      value={settings.approval?.autoApproveBelow || 0}
                      onChange={(e) => updateApproval('autoApproveBelow', parseInt(e.target.value) || 0)}
                      className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </FormField>
              </div>
            </>
          )}
        </div>
      </FormCard>

      {/* Rounding */}
      <FormCard
        title="Rounding Rules"
        description="Configure how amounts are rounded"
        icon={Calculator}
        iconBgColor="bg-orange-100/30"
        iconColor="text-orange-600"
      >
        <div className="space-y-4">
          <SettingsToggle
            label="Enable Rounding"
            description="Round calculated amounts"
            checked={settings.rounding?.enabled !== false}
            onChange={(checked) => updateRounding('enabled', checked)}
          />

          {settings.rounding?.enabled !== false && (
            <>
              <FormDivider />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField label="Rounding Method">
                  <select
                    value={settings.rounding?.method || 'nearest'}
                    onChange={(e) => updateRounding('method', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 focus:ring-2 focus:ring-blue-500"
                  >
                    {ROUNDING_METHODS.map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </FormField>

                <FormField label="Precision" hint="0 = whole naira">
                  <input
                    type="number"
                    min={0}
                    max={2}
                    value={settings.rounding?.precision || 0}
                    onChange={(e) => updateRounding('precision', parseInt(e.target.value) || 0)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 focus:ring-2 focus:ring-blue-500"
                  />
                </FormField>
              </div>
            </>
          )}
        </div>
      </FormCard>

      {/* Loan Settings */}
      <div ref={loanCardRef}>
      <FormCard
        title="Loan & Advance Settings"
        description="Configure staff loan and salary advance rules"
        icon={Wallet}
        iconBgColor="bg-indigo-100/30"
        iconColor="text-indigo-600"
      >
        <div className="space-y-4">
          <SettingsToggle
            label="Enable Loans & Advances"
            description="Allow staff to request salary advances and loans"
            checked={loans?.enabled !== false}
            onChange={(checked) => updateLoans('enabled', checked)}
          />

          {loans?.enabled !== false && (
            <>
              <FormDivider />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField label="Max Loan (% of Salary)" hint="Maximum loan as percentage of monthly salary">
                  <div className="relative">
                    <input
                      type="number"
                      value={loans?.maxLoanPercentage || 50}
                      onChange={(e) => updateLoans('maxLoanPercentage', parseInt(e.target.value) || 0)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 focus:ring-2 focus:ring-blue-500"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500">%</span>
                  </div>
                </FormField>

                <FormField label="Max Repayment (% of Salary)" hint="Maximum monthly repayment deduction">
                  <div className="relative">
                    <input
                      type="number"
                      value={loans?.maxRepaymentPercentage || 33}
                      onChange={(e) => updateLoans('maxRepaymentPercentage', parseInt(e.target.value) || 0)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 focus:ring-2 focus:ring-blue-500"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500">%</span>
                  </div>
                </FormField>

                <FormField label="Interest Rate (Annual)" hint="0 for interest-free loans">
                  <div className="relative">
                    <input
                      type="number"
                      step="0.1"
                      value={loans?.interestRate || 0}
                      onChange={(e) => updateLoans('interestRate', parseFloat(e.target.value) || 0)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 focus:ring-2 focus:ring-blue-500"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500">%</span>
                  </div>
                </FormField>

                <FormField label="Max Tenure (Months)">
                  <input
                    type="number"
                    value={loans?.maxTenureMonths || 12}
                    onChange={(e) => updateLoans('maxTenureMonths', parseInt(e.target.value) || 1)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 focus:ring-2 focus:ring-blue-500"
                  />
                </FormField>
              </div>
            </>
          )}
        </div>
      </FormCard>
      </div>
    </div>
  );
}

export default ProcessingSettings;
