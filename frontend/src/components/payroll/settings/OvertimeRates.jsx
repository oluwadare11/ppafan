// OvertimeRates.jsx - Overtime settings component
// Configure overtime rates, caps, and calculation rules

import React, { useCallback } from 'react';
import {
  Clock,
  Sun,
  Moon,
  Calendar,
  AlertCircle
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

// Calculation base options
const CALCULATION_BASE_OPTIONS = [
  { value: 'basic_only', label: 'Basic Salary Only' },
  { value: 'basic_plus_allowances', label: 'Basic + Housing + Transport' },
  { value: 'gross', label: 'Gross Salary' }
];

function OvertimeRates({ settings, onChange }) {
  // Update a field
  const updateField = useCallback((field, value) => {
    onChange({
      ...settings,
      [field]: value
    });
  }, [settings, onChange]);

  // Update rates
  const updateRate = useCallback((rateType, value) => {
    onChange({
      ...settings,
      rates: {
        ...settings.rates,
        [rateType]: value
      }
    });
  }, [settings, onChange]);

  // Update night shift definition
  const updateNightShift = useCallback((field, value) => {
    onChange({
      ...settings,
      nightShiftDefinition: {
        ...settings.nightShiftDefinition,
        [field]: value
      }
    });
  }, [settings, onChange]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            Overtime Rates
          </h3>
          <p className="text-sm text-gray-500">
            Configure overtime calculation rules and multipliers
          </p>
        </div>
        <EnabledBadge enabled={settings.enabled} />
      </div>

      <SettingsToggle
        label="Enable Overtime"
        description="Allow overtime calculation and payments"
        checked={settings.enabled}
        onChange={(checked) => updateField('enabled', checked)}
      />

      {settings.enabled && (
        <>
          <Tip>
            Overtime is calculated based on hours worked beyond the standard working hours.
            Different multipliers apply for weekdays, weekends, and holidays.
          </Tip>

          {/* Calculation Settings */}
          <FormCard
            title="Calculation Settings"
            description="How overtime pay is calculated"
            icon={Clock}
            iconBgColor="bg-blue-100/30"
            iconColor="text-blue-600"
          >
            <div className="space-y-4">
              <FormField label="Calculation Base" hint="Which components to use for hourly rate">
                <select
                  value={settings.calculationBase || 'basic_only'}
                  onChange={(e) => updateField('calculationBase', e.target.value)}
                  className="w-full md:w-64 px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 focus:ring-2 focus:ring-blue-500"
                >
                  {CALCULATION_BASE_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </FormField>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField label="Minimum Overtime Minutes" hint="Hours below this don't count">
                  <div className="relative">
                    <input
                      type="number"
                      value={settings.minimumMinutes || 30}
                      onChange={(e) => updateField('minimumMinutes', parseInt(e.target.value) || 0)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 focus:ring-2 focus:ring-blue-500"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500">min</span>
                  </div>
                </FormField>

                <FormField label="Maximum Hours per Month" hint="Cap on overtime hours">
                  <div className="relative">
                    <input
                      type="number"
                      value={settings.maxHoursPerMonth || 50}
                      onChange={(e) => updateField('maxHoursPerMonth', parseInt(e.target.value) || 0)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 focus:ring-2 focus:ring-blue-500"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500">hrs</span>
                  </div>
                </FormField>
              </div>

              <SettingsToggle
                label="Require Approval"
                description="Overtime must be approved before being paid"
                checked={settings.requiresApproval}
                onChange={(checked) => updateField('requiresApproval', checked)}
              />
            </div>
          </FormCard>

          {/* Overtime Rates */}
          <FormCard
            title="Rate Multipliers"
            description="Overtime pay multipliers for different scenarios"
            icon={Sun}
            iconBgColor="bg-yellow-100/30"
            iconColor="text-yellow-600"
          >
            <div className="space-y-6">
              {/* Weekday Rate */}
              <div className="flex items-center justify-between p-4 bg-gray-50/50 rounded-lg">
                <div>
                  <h4 className="font-medium text-gray-900">Weekday Overtime</h4>
                  <p className="text-sm text-gray-500">Regular weekday hours beyond standard</p>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    step="0.1"
                    value={settings.rates?.weekday || 1.5}
                    onChange={(e) => updateRate('weekday', parseFloat(e.target.value) || 1)}
                    className="w-20 px-3 py-2 text-center border border-gray-300 rounded-lg bg-white text-gray-900 focus:ring-2 focus:ring-blue-500"
                  />
                  <span className="text-gray-500">x</span>
                </div>
              </div>

              {/* Weekend Rate */}
              <div className="flex items-center justify-between p-4 bg-gray-50/50 rounded-lg">
                <div>
                  <h4 className="font-medium text-gray-900">Weekend Overtime</h4>
                  <p className="text-sm text-gray-500">Saturday and Sunday work</p>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    step="0.1"
                    value={settings.rates?.weekend || 2.0}
                    onChange={(e) => updateRate('weekend', parseFloat(e.target.value) || 1)}
                    className="w-20 px-3 py-2 text-center border border-gray-300 rounded-lg bg-white text-gray-900 focus:ring-2 focus:ring-blue-500"
                  />
                  <span className="text-gray-500">x</span>
                </div>
              </div>

              {/* Holiday Rate */}
              <div className="flex items-center justify-between p-4 bg-gray-50/50 rounded-lg">
                <div>
                  <h4 className="font-medium text-gray-900">Holiday Overtime</h4>
                  <p className="text-sm text-gray-500">Public holidays and special days</p>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    step="0.1"
                    value={settings.rates?.holiday || 2.5}
                    onChange={(e) => updateRate('holiday', parseFloat(e.target.value) || 1)}
                    className="w-20 px-3 py-2 text-center border border-gray-300 rounded-lg bg-white text-gray-900 focus:ring-2 focus:ring-blue-500"
                  />
                  <span className="text-gray-500">x</span>
                </div>
              </div>

              {/* Night Shift Rate */}
              <div className="flex items-center justify-between p-4 bg-gray-50/50 rounded-lg">
                <div>
                  <h4 className="font-medium text-gray-900">Night Shift</h4>
                  <p className="text-sm text-gray-500">Work during night hours</p>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    step="0.1"
                    value={settings.rates?.nightShift || 1.25}
                    onChange={(e) => updateRate('nightShift', parseFloat(e.target.value) || 1)}
                    className="w-20 px-3 py-2 text-center border border-gray-300 rounded-lg bg-white text-gray-900 focus:ring-2 focus:ring-blue-500"
                  />
                  <span className="text-gray-500">x</span>
                </div>
              </div>
            </div>
          </FormCard>

          {/* Night Shift Definition */}
          <FormCard
            title="Night Shift Hours"
            description="Define what constitutes night shift"
            icon={Moon}
            iconBgColor="bg-indigo-100/30"
            iconColor="text-indigo-600"
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField label="Start Hour (24h)">
                <select
                  value={settings.nightShiftDefinition?.startHour || 22}
                  onChange={(e) => updateNightShift('startHour', parseInt(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 focus:ring-2 focus:ring-blue-500"
                >
                  {Array.from({ length: 24 }).map((_, i) => (
                    <option key={i} value={i}>
                      {String(i).padStart(2, '0')}:00 ({i === 0 ? 'Midnight' : i < 12 ? `${i} AM` : i === 12 ? '12 PM' : `${i - 12} PM`})
                    </option>
                  ))}
                </select>
              </FormField>

              <FormField label="End Hour (24h)">
                <select
                  value={settings.nightShiftDefinition?.endHour || 6}
                  onChange={(e) => updateNightShift('endHour', parseInt(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 focus:ring-2 focus:ring-blue-500"
                >
                  {Array.from({ length: 24 }).map((_, i) => (
                    <option key={i} value={i}>
                      {String(i).padStart(2, '0')}:00 ({i === 0 ? 'Midnight' : i < 12 ? `${i} AM` : i === 12 ? '12 PM' : `${i - 12} PM`})
                    </option>
                  ))}
                </select>
              </FormField>
            </div>

            <p className="text-sm text-gray-500 mt-4">
              Night shift hours: {settings.nightShiftDefinition?.startHour || 22}:00 - {settings.nightShiftDefinition?.endHour || 6}:00
            </p>
          </FormCard>
        </>
      )}
    </div>
  );
}

export default OvertimeRates;
