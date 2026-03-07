// StatutoryCompliance.jsx - Statutory compliance settings component
// Manages PAYE, Pension, NHF, NHIS, ITF, NSITF settings

import React, { useCallback } from 'react';
import {
  Calculator,
  Building2,
  Home,
  HeartPulse,
  GraduationCap,
  Shield,
  Info,
  ChevronDown,
  ChevronUp,
  Plus,
  Trash2,
  RotateCcw
} from 'lucide-react';

import {
  FormCard,
  SettingsToggle,
  FormSection,
  FormField,
  FormDivider,
  Tip,
  EnabledBadge
} from '../shared';

// Statutory item configuration
const STATUTORY_ITEMS = [
  {
    id: 'paye',
    name: 'PAYE (Pay As You Earn)',
    description: 'Nigerian income tax with progressive brackets',
    icon: Calculator,
    iconBg: 'bg-orange-100/30',
    iconColor: 'text-orange-600'
  },
  {
    id: 'pension',
    name: 'Contributory Pension',
    description: 'Employee and employer pension contributions',
    icon: Building2,
    iconBg: 'bg-blue-100/30',
    iconColor: 'text-blue-600'
  },
  {
    id: 'nhf',
    name: 'NHF (National Housing Fund)',
    description: '2.5% contribution for housing scheme',
    icon: Home,
    iconBg: 'bg-green-100/30',
    iconColor: 'text-green-600'
  },
  {
    id: 'nhis',
    name: 'NHIS (National Health Insurance)',
    description: 'Health insurance contributions',
    icon: HeartPulse,
    iconBg: 'bg-red-100/30',
    iconColor: 'text-red-600'
  },
  {
    id: 'itf',
    name: 'ITF (Industrial Training Fund)',
    description: '1% annual employer contribution',
    icon: GraduationCap,
    iconBg: 'bg-purple-100/30',
    iconColor: 'text-purple-600'
  },
  {
    id: 'nsitf',
    name: 'NSITF (Nigeria Social Insurance)',
    description: 'Employee compensation scheme',
    icon: Shield,
    iconBg: 'bg-indigo-100/30',
    iconColor: 'text-indigo-600'
  }
];

function StatutoryCompliance({ settings, onChange }) {
  const [expandedItem, setExpandedItem] = React.useState(null);

  // Toggle enabled state
  const handleToggle = useCallback((itemId, enabled) => {
    onChange({
      ...settings,
      [itemId]: {
        ...settings[itemId],
        enabled
      }
    });
  }, [settings, onChange]);

  // Update item settings
  const handleItemChange = useCallback((itemId, field, value) => {
    onChange({
      ...settings,
      [itemId]: {
        ...settings[itemId],
        [field]: value
      }
    });
  }, [settings, onChange]);

  // Toggle expanded state
  const toggleExpanded = useCallback((itemId) => {
    setExpandedItem(prev => prev === itemId ? null : itemId);
  }, []);

  return (
    <div className="space-y-6">
      {/* Header info */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          Statutory Compliance
        </h3>
        <p className="text-sm text-gray-500">
          Configure Nigerian statutory deductions including PAYE, pension, and other mandatory contributions.
        </p>
      </div>

      <Tip>
        These settings apply to all employees unless individual exemptions are configured in Staff Setup.
        Tax brackets follow the current Nigerian PAYE structure.
      </Tip>

      {/* Statutory items */}
      <div className="space-y-4">
        {STATUTORY_ITEMS.map((item) => {
          const itemSettings = settings[item.id] || {};
          const isEnabled = itemSettings.enabled;
          const isExpanded = expandedItem === item.id;

          return (
            <div
              key={item.id}
              className="bg-gray-50/50 rounded-lg border border-gray-200 overflow-hidden"
            >
              {/* Header */}
              <div className="flex items-center justify-between p-4">
                <div className="flex items-center gap-4">
                  <div className={`p-2.5 rounded-lg ${item.iconBg}`}>
                    <item.icon className={`w-5 h-5 ${item.iconColor}`} />
                  </div>
                  <div>
                    <h4 className="font-medium text-gray-900">
                      {item.name}
                    </h4>
                    <p className="text-sm text-gray-500">
                      {item.description}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <EnabledBadge enabled={isEnabled} />
                  <button
                    onClick={() => toggleExpanded(item.id)}
                    className="p-1 text-gray-400 hover:text-gray-600"
                  >
                    {isExpanded ? (
                      <ChevronUp className="w-5 h-5" />
                    ) : (
                      <ChevronDown className="w-5 h-5" />
                    )}
                  </button>
                </div>
              </div>

              {/* Expanded settings */}
              {isExpanded && (
                <div className="border-t border-gray-200 p-4 bg-white">
                  <div className="space-y-4">
                    {/* Enable toggle */}
                    <SettingsToggle
                      label={`Enable ${item.name}`}
                      description={`Apply ${item.name} deductions to eligible employees`}
                      checked={isEnabled}
                      onChange={(checked) => handleToggle(item.id, checked)}
                    />

                    {isEnabled && (
                      <>
                        <FormDivider />

                        {/* Item-specific settings */}
                        {item.id === 'paye' && (
                          <PayeSettings
                            settings={itemSettings}
                            onChange={(field, value) => handleItemChange(item.id, field, value)}
                          />
                        )}

                        {item.id === 'pension' && (
                          <PensionSettings
                            settings={itemSettings}
                            onChange={(field, value) => handleItemChange(item.id, field, value)}
                          />
                        )}

                        {item.id === 'nhf' && (
                          <NhfSettings
                            settings={itemSettings}
                            onChange={(field, value) => handleItemChange(item.id, field, value)}
                          />
                        )}

                        {item.id === 'nhis' && (
                          <NhisSettings
                            settings={itemSettings}
                            onChange={(field, value) => handleItemChange(item.id, field, value)}
                          />
                        )}

                        {item.id === 'itf' && (
                          <ItfSettings
                            settings={itemSettings}
                            onChange={(field, value) => handleItemChange(item.id, field, value)}
                          />
                        )}

                        {item.id === 'nsitf' && (
                          <NsitfSettings
                            settings={itemSettings}
                            onChange={(field, value) => handleItemChange(item.id, field, value)}
                          />
                        )}
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// All 36 Nigerian states + FCT
const NIGERIAN_STATES = [
  'Abia', 'Adamawa', 'Akwa Ibom', 'Anambra', 'Bauchi', 'Bayelsa', 'Benue',
  'Borno', 'Cross River', 'Delta', 'Ebonyi', 'Edo', 'Ekiti', 'Enugu',
  'FCT (Abuja)', 'Gombe', 'Imo', 'Jigawa', 'Kaduna', 'Kano', 'Katsina',
  'Kebbi', 'Kogi', 'Kwara', 'Lagos', 'Nasarawa', 'Niger', 'Ogun', 'Ondo',
  'Osun', 'Oyo', 'Plateau', 'Rivers', 'Sokoto', 'Taraba', 'Yobe', 'Zamfara'
];

// Maps state → commonly used revenue service abbreviation
const STATE_TAX_AUTHORITY = {
  'Lagos': 'LIRS',
  'FCT (Abuja)': 'FCIRS',
  'Rivers': 'RIRS',
  'Kano': 'KGIRS',
  'Ogun': 'OGIIRS',
  'Edo': 'EIRS',
  'Anambra': 'AIRS',
  'Delta': 'DIRS',
  'Imo': 'IMIRS',
  'Kaduna': 'KADIRS',
  'Kwara': 'KWIRS',
  'Oyo': 'OYIRS',
  'Ekiti': 'EKIRS',
};

function getTaxAuthorityLabel(state) {
  if (!state) return 'Tax Authority ID';
  const abbr = STATE_TAX_AUTHORITY[state] || `${state.replace(/\s*\(.*?\)/, '').trim().slice(0, 3).toUpperCase()}IRS`;
  return `${abbr} Registration Number`;
}

// Default NTA 2025 brackets — used for the "Reset to defaults" button
const NTA_2025_BRACKETS = [
  { minIncome: 0,        maxIncome: 800000,   rate: 0  },
  { minIncome: 800000,   maxIncome: 3000000,  rate: 15 },
  { minIncome: 3000000,  maxIncome: 12000000, rate: 18 },
  { minIncome: 12000000, maxIncome: 25000000, rate: 21 },
  { minIncome: 25000000, maxIncome: 50000000, rate: 23 },
  { minIncome: 50000000, maxIncome: null,     rate: 25 },
];

function formatBracketAmount(val) {
  if (val === null || val === undefined || val === '') return '';
  const n = Number(val);
  if (n >= 1000000) return `₦${(n / 1000000).toFixed(n % 1000000 === 0 ? 0 : 1)}M`;
  if (n >= 1000) return `₦${(n / 1000).toFixed(0)}K`;
  return `₦${n}`;
}

// PAYE Settings
function PayeSettings({ settings, onChange }) {
  const selectedState = settings.state || '';
  const taxAuthorityLabel = getTaxAuthorityLabel(selectedState);
  const brackets = settings.taxBrackets?.length ? settings.taxBrackets : NTA_2025_BRACKETS;

  return (
    <div className="space-y-4">

      <FormSection
        title="Tax Jurisdiction"
        description="Select the state where your business operates. This determines the relevant State Revenue Service for PAYE remittance."
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField label="State of Operation">
            <select
              value={selectedState}
              onChange={(e) => onChange('state', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 focus:ring-2 focus:ring-blue-500"
            >
              <option value="">-- Select State --</option>
              {NIGERIAN_STATES.map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
            {selectedState && (
              <p className="text-xs text-gray-500 mt-1">
                Relevant authority: <strong>{STATE_TAX_AUTHORITY[selectedState] || `${selectedState.replace(/\s*\(.*?\)/, '').trim().slice(0, 3).toUpperCase()}IRS`}</strong>
              </p>
            )}
          </FormField>

          <FormField label={taxAuthorityLabel} hint="Optional — appears on PAYE reports">
            <input
              type="text"
              value={settings.taxAuthorityId || ''}
              onChange={(e) => onChange('taxAuthorityId', e.target.value)}
              placeholder={selectedState ? `Enter your ${STATE_TAX_AUTHORITY[selectedState] || 'IRS'} ID` : 'Select a state first'}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 focus:ring-2 focus:ring-blue-500"
            />
          </FormField>
        </div>
      </FormSection>

      <FormDivider />

      <FormSection
        title="Pre-Tax Reliefs (NTA 2025)"
        description="Under the Nigeria Tax Act 2025, the Consolidated Relief Allowance (CRA) is abolished. Taxable income is now: Gross minus pension, NHF, NHIS, and declared personal reliefs (rent, life assurance, mortgage interest, voluntary AVC). Configure per-staff reliefs in Payroll → Staff Setup."
      >
        <div className="rounded-lg bg-blue-50 border border-blue-200 px-4 py-3 text-sm text-blue-800 space-y-1">
          <p className="font-semibold">NTA 2025 — What reduces taxable income:</p>
          <ul className="list-disc list-inside space-y-0.5 text-blue-700">
            <li>Employee pension contribution (8% of pensionable income)</li>
            <li>NHF contribution (2.5% of basic salary) — if enabled</li>
            <li>NHIS employee contribution — if enabled</li>
            <li>Rent relief: 20% of annual rent paid, capped at ₦500,000/year (per-staff)</li>
            <li>Life assurance premiums (per-staff)</li>
            <li>Mortgage interest payments (per-staff)</li>
            <li>Voluntary additional pension contributions (per-staff)</li>
          </ul>
          <p className="mt-2 text-blue-600 text-xs">Per-staff reliefs are set individually in Staff Setup. Statutory deductions (pension, NHF, NHIS) are configured in their respective sections below.</p>
        </div>
      </FormSection>

      <FormDivider />

      <FormSection
        title="Minimum Tax"
        description="Applied when calculated PAYE falls below this rate of total income"
      >
        <FormField label="Minimum Tax Rate" hint="Default: 1%">
          <div className="relative w-32">
            <input
              type="number"
              step="0.1"
              value={settings.minimumTaxRate !== undefined ? settings.minimumTaxRate : 1}
              onChange={(e) => onChange('minimumTaxRate', parseFloat(e.target.value) || 0)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 focus:ring-2 focus:ring-blue-500"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500">%</span>
          </div>
        </FormField>
      </FormSection>

      <FormDivider />

      {/* ── Editable Tax Brackets ── */}
      <FormSection
        title="Tax Brackets"
        description="Progressive income tax bands. PAYE is calculated annually then divided by 12. Edit these if legislation changes."
      >
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs text-gray-500">
            Currently showing <strong>{brackets.length}</strong> brackets.
            Brackets are sorted by minimum income automatically.
          </p>
          <button
            type="button"
            onClick={() => onChange('taxBrackets', NTA_2025_BRACKETS)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reset to NTA 2025
          </button>
        </div>

        {/* Bracket table */}
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-xs text-gray-600 font-medium">
                <th className="px-3 py-2 text-left">#</th>
                <th className="px-3 py-2 text-left">Min Income (₦/year)</th>
                <th className="px-3 py-2 text-left">Max Income (₦/year)</th>
                <th className="px-3 py-2 text-left">Rate (%)</th>
                <th className="px-3 py-2 text-left">Preview</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {brackets.map((bracket, idx) => (
                <tr key={idx} className="bg-white hover:bg-gray-50">
                  <td className="px-3 py-2 text-gray-500 text-xs">{idx + 1}</td>
                  <td className="px-3 py-2">
                    <input
                      type="number"
                      min="0"
                      value={bracket.minIncome}
                      onChange={(e) => {
                        const updated = brackets.map((b, i) =>
                          i === idx ? { ...b, minIncome: parseInt(e.target.value) || 0 } : b
                        );
                        onChange('taxBrackets', [...updated].sort((a, b) => a.minIncome - b.minIncome));
                      }}
                      className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-blue-500"
                    />
                  </td>
                  <td className="px-3 py-2">
                    {bracket.maxIncome === null ? (
                      <span className="text-gray-400 italic text-xs px-2">Unlimited (top band)</span>
                    ) : (
                      <input
                        type="number"
                        min="0"
                        value={bracket.maxIncome}
                        onChange={(e) => {
                          const updated = brackets.map((b, i) =>
                            i === idx ? { ...b, maxIncome: parseInt(e.target.value) || 0 } : b
                          );
                          onChange('taxBrackets', [...updated].sort((a, b) => a.minIncome - b.minIncome));
                        }}
                        className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-blue-500"
                      />
                    )}
                    {bracket.maxIncome !== null && (
                      <button
                        type="button"
                        onClick={() => {
                          const updated = brackets.map((b, i) =>
                            i === idx ? { ...b, maxIncome: null } : b
                          );
                          onChange('taxBrackets', updated);
                        }}
                        className="text-xs text-blue-600 hover:underline mt-0.5 block"
                      >
                        Make top band
                      </button>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <div className="relative w-20">
                      <input
                        type="number"
                        min="0"
                        max="100"
                        step="0.5"
                        value={bracket.rate}
                        onChange={(e) => {
                          const updated = brackets.map((b, i) =>
                            i === idx ? { ...b, rate: parseFloat(e.target.value) || 0 } : b
                          );
                          onChange('taxBrackets', updated);
                        }}
                        className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-blue-500"
                      />
                      <span className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 text-xs">%</span>
                    </div>
                  </td>
                  <td className="px-3 py-2 text-xs text-gray-500">
                    {formatBracketAmount(bracket.minIncome)}
                    {' – '}
                    {bracket.maxIncome === null ? 'above' : formatBracketAmount(bracket.maxIncome)}
                    {' @ '}
                    <span className={`font-semibold ${bracket.rate === 0 ? 'text-green-600' : 'text-gray-700'}`}>
                      {bracket.rate}%
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <button
                      type="button"
                      onClick={() => {
                        const updated = brackets.filter((_, i) => i !== idx);
                        onChange('taxBrackets', updated);
                      }}
                      className="text-red-400 hover:text-red-600 p-1"
                      title="Remove bracket"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Add bracket button */}
        <button
          type="button"
          onClick={() => {
            const lastBracket = brackets[brackets.length - 1];
            const newMin = lastBracket?.maxIncome ?? (lastBracket?.minIncome ?? 0) + 1000000;
            // If last bracket is the top band (null max), insert before it
            const newBracket = { minIncome: newMin, maxIncome: newMin + 5000000, rate: 0 };
            const updated = [...brackets, newBracket].sort((a, b) => a.minIncome - b.minIncome);
            onChange('taxBrackets', updated);
          }}
          className="mt-3 flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
        >
          <Plus className="w-4 h-4" />
          Add Bracket
        </button>

        <Tip>
          PAYE is calculated on annual gross minus earned income deduction, then divided by 12 for monthly deduction.
          The NTA 2025 default (effective Jan 1, 2026) has a 0% first band of ₦800,000.
          Use "Reset to NTA 2025" to restore defaults. Save settings after any changes.
        </Tip>
      </FormSection>
    </div>
  );
}

// Pension Settings
function PensionSettings({ settings, onChange }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <FormField label="Employee Contribution Rate" hint="Default: 8%">
          <div className="relative">
            <input
              type="number"
              step="0.1"
              value={settings.employeeRate || 8}
              onChange={(e) => onChange('employeeRate', parseFloat(e.target.value) || 0)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 focus:ring-2 focus:ring-blue-500"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500">%</span>
          </div>
        </FormField>

        <FormField label="Employer Contribution Rate" hint="Default: 10%">
          <div className="relative">
            <input
              type="number"
              step="0.1"
              value={settings.employerRate || 10}
              onChange={(e) => onChange('employerRate', parseFloat(e.target.value) || 0)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 focus:ring-2 focus:ring-blue-500"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500">%</span>
          </div>
        </FormField>
      </div>

      <FormSection
        title="Pensionable Components"
        description="Select which salary components are included in pension calculation"
      >
        <div className="flex flex-wrap gap-2">
          {['basic', 'housing', 'transport'].map((component) => {
            const components = settings.pensionableComponents || ['basic', 'housing', 'transport'];
            const isIncluded = components.includes(component);
            return (
              <button
                key={component}
                onClick={() => {
                  const newComponents = isIncluded
                    ? components.filter(c => c !== component)
                    : [...components, component];
                  onChange('pensionableComponents', newComponents);
                }}
                className={`px-3 py-1.5 text-sm font-medium rounded-full border transition-colors ${
                  isIncluded
                    ? 'bg-blue-100/30 text-blue-700 border-blue-200'
                    : 'bg-gray-100 text-gray-600 border-gray-200'
                }`}
              >
                {component.charAt(0).toUpperCase() + component.slice(1)}
              </button>
            );
          })}
        </div>
      </FormSection>
    </div>
  );
}

// NHF Settings
function NhfSettings({ settings, onChange }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <FormField label="Contribution Rate" hint="Default: 2.5%">
          <div className="relative">
            <input
              type="number"
              step="0.1"
              value={settings.rate || 2.5}
              onChange={(e) => onChange('rate', parseFloat(e.target.value) || 0)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 focus:ring-2 focus:ring-blue-500"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500">%</span>
          </div>
        </FormField>

        <FormField label="Calculation Base">
          <select
            value={settings.calculationBase || 'basic'}
            onChange={(e) => onChange('calculationBase', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 focus:ring-2 focus:ring-blue-500"
          >
            <option value="basic">Basic Salary Only</option>
            <option value="gross">Gross Salary</option>
          </select>
        </FormField>
      </div>

      <FormField label="Minimum Salary Threshold">
        <input
          type="number"
          value={settings.minimumSalary || 3000}
          onChange={(e) => onChange('minimumSalary', parseInt(e.target.value) || 0)}
          className="w-full md:w-48 px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 focus:ring-2 focus:ring-blue-500"
        />
        <p className="text-xs text-gray-500 mt-1">NHF only applies if salary exceeds this amount</p>
      </FormField>
    </div>
  );
}

// NHIS Settings
function NhisSettings({ settings, onChange }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <FormField label="Employee Contribution Rate" hint="Default: 5%">
          <div className="relative">
            <input
              type="number"
              step="0.1"
              value={settings.employeeRate || 5}
              onChange={(e) => onChange('employeeRate', parseFloat(e.target.value) || 0)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 focus:ring-2 focus:ring-blue-500"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500">%</span>
          </div>
        </FormField>

        <FormField label="Employer Contribution Rate" hint="Default: 10%">
          <div className="relative">
            <input
              type="number"
              step="0.1"
              value={settings.employerRate || 10}
              onChange={(e) => onChange('employerRate', parseFloat(e.target.value) || 0)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 focus:ring-2 focus:ring-blue-500"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500">%</span>
          </div>
        </FormField>
      </div>

      <FormField label="Calculation Base">
        <select
          value={settings.calculationBase || 'basic'}
          onChange={(e) => onChange('calculationBase', e.target.value)}
          className="w-full md:w-48 px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 focus:ring-2 focus:ring-blue-500"
        >
          <option value="basic">Basic Salary Only</option>
          <option value="gross">Gross Salary</option>
        </select>
      </FormField>
    </div>
  );
}

// ITF Settings
function ItfSettings({ settings, onChange }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <FormField label="Contribution Rate" hint="Default: 1%">
          <div className="relative">
            <input
              type="number"
              step="0.1"
              value={settings.rate || 1}
              onChange={(e) => onChange('rate', parseFloat(e.target.value) || 0)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 focus:ring-2 focus:ring-blue-500"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500">%</span>
          </div>
        </FormField>

        <FormField label="Minimum Staff Count" hint="Default: 5">
          <input
            type="number"
            value={settings.minimumStaff || 5}
            onChange={(e) => onChange('minimumStaff', parseInt(e.target.value) || 0)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 focus:ring-2 focus:ring-blue-500"
          />
        </FormField>
      </div>

      <FormField label="Calculation Type">
        <select
          value={settings.calculationType || 'annual'}
          onChange={(e) => onChange('calculationType', e.target.value)}
          className="w-full md:w-48 px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 focus:ring-2 focus:ring-blue-500"
        >
          <option value="annual">Annual (lump sum)</option>
          <option value="monthly">Monthly (prorated)</option>
        </select>
      </FormField>

      <Tip>
        ITF is mandatory for employers with 5 or more employees or an annual turnover of N50 million.
      </Tip>
    </div>
  );
}

// NSITF Settings
function NsitfSettings({ settings, onChange }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <FormField label="Employer Contribution Rate" hint="Default: 1%">
          <div className="relative">
            <input
              type="number"
              step="0.1"
              value={settings.employerRate || 1}
              onChange={(e) => onChange('employerRate', parseFloat(e.target.value) || 0)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 focus:ring-2 focus:ring-blue-500"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500">%</span>
          </div>
        </FormField>

        <FormField label="Calculation Base">
          <select
            value={settings.calculationBase || 'gross'}
            onChange={(e) => onChange('calculationBase', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 focus:ring-2 focus:ring-blue-500"
          >
            <option value="basic">Basic Salary Only</option>
            <option value="gross">Gross Salary</option>
          </select>
        </FormField>
      </div>

      <Tip>
        NSITF (Employee Compensation Scheme) provides compensation for work-related injuries/deaths.
        This is an employer-only contribution.
      </Tip>
    </div>
  );
}

export default StatutoryCompliance;
