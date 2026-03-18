// StaffPayrollModal.jsx - Modal for editing staff payroll configuration
// Full-featured modal for configuring individual staff payroll settings

import React, { useState, useCallback, useMemo } from 'react';
import {
  X,
  User,
  DollarSign,
  Building2,
  CreditCard,
  Shield,
  Clock,
  Save,
  Loader2
} from 'lucide-react';

import {
  FormField,
  FormSection,
  FormDivider,
  SettingsToggle,
  StatusBadge,
  Tip
} from '../shared';
import NumericInput from '../../shared/NumericInput.jsx';

// Payment methods
const PAYMENT_METHODS = [
  { value: 'bank_transfer', label: 'Bank Transfer' },
  { value: 'cash', label: 'Cash' },
  { value: 'cheque', label: 'Cheque' },
  { value: 'mobile_money', label: 'Mobile Money' }
];

// Salary types
const SALARY_TYPES = [
  { value: 'monthly', label: 'Monthly' },
  { value: 'hourly', label: 'Hourly' },
  { value: 'daily', label: 'Daily' },
  { value: 'contract', label: 'Contract' }
];

function StaffPayrollModal({
  staff,
  settings,
  onSave,
  onClose
}) {
  const [formData, setFormData] = useState({
    baseSalary: staff.baseSalary || 0,
    bankDetails: {
      bankName: staff.bankDetails?.bankName || '',
      bankCode: staff.bankDetails?.bankCode || '',
      accountNumber: staff.bankDetails?.accountNumber || '',
      accountName: staff.bankDetails?.accountName || ''
    },
    payroll: {
      salaryType: staff.payroll?.salaryType || 'monthly',
      allowances: staff.payroll?.allowances || [],
      statutoryInfo: {
        tin: staff.payroll?.statutoryInfo?.tin || '',
        nin: staff.payroll?.statutoryInfo?.nin || '',
        rsaPin: staff.payroll?.statutoryInfo?.rsaPin || '',
        pfaName: staff.payroll?.statutoryInfo?.pfaName || '',
        pfaCode: staff.payroll?.statutoryInfo?.pfaCode || '',
        nhfNumber: staff.payroll?.statutoryInfo?.nhfNumber || '',
        nhisNumber: staff.payroll?.statutoryInfo?.nhisNumber || '',
        nhisProvider: staff.payroll?.statutoryInfo?.nhisProvider || ''
      },
      exemptions: {
        paye: staff.payroll?.exemptions?.paye || false,
        pension: staff.payroll?.exemptions?.pension || false,
        nhf: staff.payroll?.exemptions?.nhf || false,
        nhis: staff.payroll?.exemptions?.nhis || false
      },
      overtimeEligible: staff.payroll?.overtimeEligible !== false,
      excludeFromDeductions: staff.payroll?.excludeFromDeductions || false,
      paymentMethod: staff.payroll?.paymentMethod || 'bank_transfer',
      notes: staff.payroll?.notes || '',
      // NTA 2025 annual tax reliefs — all values in Naira per annum
      taxReliefs: {
        annualRent:              staff.payroll?.taxReliefs?.annualRent              || 0,
        annualLifeAssurance:     staff.payroll?.taxReliefs?.annualLifeAssurance     || 0,
        annualMortgageInterest:  staff.payroll?.taxReliefs?.annualMortgageInterest  || 0,
        voluntaryPensionAVC:     staff.payroll?.taxReliefs?.voluntaryPensionAVC     || 0
      }
    }
  });

  const [isSaving, setIsSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('basic');

  // Tabs
  const tabs = [
    { id: 'basic', label: 'Basic Info', icon: User },
    { id: 'bank', label: 'Bank Details', icon: CreditCard },
    { id: 'allowances', label: 'Allowances', icon: DollarSign },
    { id: 'statutory', label: 'Statutory', icon: Shield },
    { id: 'settings', label: 'Settings', icon: Clock }
  ];

  // Update form field
  const updateField = useCallback((path, value) => {
    setFormData(prev => {
      const newData = { ...prev };
      const keys = path.split('.');
      let current = newData;
      for (let i = 0; i < keys.length - 1; i++) {
        current[keys[i]] = { ...current[keys[i]] };
        current = current[keys[i]];
      }
      current[keys[keys.length - 1]] = value;
      return newData;
    });
  }, []);

  // Handle save
  const handleSave = useCallback(async () => {
    setIsSaving(true);
    try {
      await onSave(staff._id, formData);
    } catch (err) {
      // Error handled by parent
    } finally {
      setIsSaving(false);
    }
  }, [staff._id, formData, onSave]);

  // Available salary components from settings — allowances only.
  // Bonuses (13th month, performance, BIK) are period-specific and handled
  // in the Adjustments step during payroll processing, not here.
  const availableComponents = useMemo(() => {
    return (settings?.salaryComponents || []).filter(c => c.isActive && c.type === 'allowance');
  }, [settings]);

  // Toggle allowance
  const toggleAllowance = useCallback((component) => {
    const currentAllowances = formData.payroll.allowances || [];
    const existingIndex = currentAllowances.findIndex(a => a.code === component.code);

    let newAllowances;
    if (existingIndex >= 0) {
      // Remove if exists
      newAllowances = currentAllowances.filter(a => a.code !== component.code);
    } else {
      // Add new allowance
      newAllowances = [...currentAllowances, {
        code: component.code,
        name: component.name,
        amount: component.calculationType === 'fixed' ? component.defaultValue : 0,
        calculationType: component.calculationType,
        percentageOf: component.percentageOf,
        percentageValue: component.calculationType === 'percentage' ? component.defaultValue : 0,
        isActive: true
      }];
    }

    updateField('payroll.allowances', newAllowances);
  }, [formData.payroll.allowances, updateField]);

  // Update allowance amount
  const updateAllowanceAmount = useCallback((code, value) => {
    const newAllowances = formData.payroll.allowances.map(a =>
      a.code === code
        ? { ...a, amount: parseFloat(value) || 0 }
        : a
    );
    updateField('payroll.allowances', newAllowances);
  }, [formData.payroll.allowances, updateField]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-blue-100/30 flex items-center justify-center text-blue-600 font-medium">
              {(staff.firstName?.[0] || '') + (staff.lastName?.[0] || '')}
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                {staff.fullName}
              </h2>
              <p className="text-sm text-gray-500">
                {staff.employeeId} | {staff.position || 'No position'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isSaving}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 p-2 border-b border-gray-200 overflow-x-auto">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg whitespace-nowrap transition-colors ${
                  isActive
                    ? 'bg-blue-100/30 text-blue-700'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {/* Basic Info Tab */}
          {activeTab === 'basic' && (
            <div className="space-y-4">
              <FormField label="Base Salary (Monthly)" required>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">₦</span>
                  <NumericInput
                    value={formData.baseSalary || 0}
                    onChange={(v) => updateField('baseSalary', v)}
                    placeholder="e.g. 300,000"
                    className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </FormField>

              <FormField label="Salary Type">
                <select
                  value={formData.payroll.salaryType}
                  onChange={(e) => updateField('payroll.salaryType', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 focus:ring-2 focus:ring-blue-500"
                >
                  {SALARY_TYPES.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </FormField>

              <FormField label="Payment Method">
                <select
                  value={formData.payroll.paymentMethod}
                  onChange={(e) => updateField('payroll.paymentMethod', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 focus:ring-2 focus:ring-blue-500"
                >
                  {PAYMENT_METHODS.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </FormField>
            </div>
          )}

          {/* Bank Details Tab */}
          {activeTab === 'bank' && (
            <div className="space-y-4">
              <FormField label="Bank Name">
                <input
                  type="text"
                  value={formData.bankDetails.bankName}
                  onChange={(e) => updateField('bankDetails.bankName', e.target.value)}
                  placeholder="e.g., First Bank"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 focus:ring-2 focus:ring-blue-500"
                />
              </FormField>

              <FormField label="Bank Code">
                <input
                  type="text"
                  value={formData.bankDetails.bankCode}
                  onChange={(e) => updateField('bankDetails.bankCode', e.target.value)}
                  placeholder="e.g., 011"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 focus:ring-2 focus:ring-blue-500"
                />
              </FormField>

              <FormField label="Account Number">
                <input
                  type="text"
                  value={formData.bankDetails.accountNumber}
                  onChange={(e) => updateField('bankDetails.accountNumber', e.target.value)}
                  placeholder="10-digit account number"
                  maxLength={10}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 focus:ring-2 focus:ring-blue-500"
                />
              </FormField>

              <FormField label="Account Name">
                <input
                  type="text"
                  value={formData.bankDetails.accountName}
                  onChange={(e) => updateField('bankDetails.accountName', e.target.value)}
                  placeholder="Account holder name"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 focus:ring-2 focus:ring-blue-500"
                />
              </FormField>
            </div>
          )}

          {/* Allowances Tab */}
          {activeTab === 'allowances' && (
            <div className="space-y-4">
              <Tip>Select allowances to include in this staff member's salary structure. All allowance amounts are <strong>monthly</strong> figures added to the monthly payroll.</Tip>

              {availableComponents.length === 0 ? (
                <p className="text-center text-gray-500 py-4">
                  No salary components configured. Add components in Settings.
                </p>
              ) : (
                <div className="space-y-3">
                  {availableComponents.map((component) => {
                    const staffAllowance = formData.payroll.allowances.find(a => a.code === component.code);
                    const isSelected = !!staffAllowance;

                    return (
                      <div
                        key={component.code}
                        className={`p-4 rounded-lg border transition-colors ${
                          isSelected
                            ? 'border-blue-200 bg-blue-50/20'
                            : 'border-gray-200'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <label className="flex items-center gap-3 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleAllowance(component)}
                              className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                            />
                            <div>
                              <p className="font-medium text-gray-900">
                                {component.name}
                              </p>
                              <p className="text-xs text-gray-500">
                                {component.code} | {component.type}
                              </p>
                            </div>
                          </label>

                          {isSelected && component.calculationType === 'fixed' && (
                            <div className="text-right">
                              <div className="relative w-32">
                                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-500 text-sm">₦</span>
                                <NumericInput
                                  value={staffAllowance?.amount || 0}
                                  onChange={(v) => updateAllowanceAmount(component.code, v)}
                                  placeholder="0"
                                  className="w-full pl-6 pr-2 py-1.5 text-sm border border-gray-300 rounded bg-white text-gray-900"
                                />
                              </div>
                              <span className="text-xs text-gray-400">/month</span>
                            </div>
                          )}

                          {isSelected && component.calculationType === 'percentage' && (
                            <span className="text-sm text-gray-600">
                              {component.defaultValue}% of {component.percentageOf}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Statutory Tab */}
          {activeTab === 'statutory' && (
            <div className="space-y-4">
              <FormSection title="Tax & Pension Information">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField label="TIN (Tax ID)">
                    <input
                      type="text"
                      value={formData.payroll.statutoryInfo.tin}
                      onChange={(e) => updateField('payroll.statutoryInfo.tin', e.target.value)}
                      placeholder="Tax Identification Number"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 focus:ring-2 focus:ring-blue-500"
                    />
                  </FormField>

                  <FormField label="NIN">
                    <input
                      type="text"
                      value={formData.payroll.statutoryInfo.nin}
                      onChange={(e) => updateField('payroll.statutoryInfo.nin', e.target.value)}
                      placeholder="National ID Number"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 focus:ring-2 focus:ring-blue-500"
                    />
                  </FormField>

                  <FormField label="RSA PIN">
                    <input
                      type="text"
                      value={formData.payroll.statutoryInfo.rsaPin}
                      onChange={(e) => updateField('payroll.statutoryInfo.rsaPin', e.target.value)}
                      placeholder="Retirement Savings PIN"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 focus:ring-2 focus:ring-blue-500"
                    />
                  </FormField>

                  <FormField label="PFA Name">
                    <input
                      type="text"
                      value={formData.payroll.statutoryInfo.pfaName}
                      onChange={(e) => updateField('payroll.statutoryInfo.pfaName', e.target.value)}
                      placeholder="Pension Fund Administrator"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 focus:ring-2 focus:ring-blue-500"
                    />
                  </FormField>
                </div>
              </FormSection>

              <FormDivider />

              <FormSection title="Exemptions" description="Exempt this staff from specific deductions">
                <div className="space-y-2">
                  <SettingsToggle
                    label="Exempt from PAYE"
                    description="Do not deduct income tax"
                    checked={formData.payroll.exemptions.paye}
                    onChange={(checked) => updateField('payroll.exemptions.paye', checked)}
                  />
                  <SettingsToggle
                    label="Exempt from Pension"
                    description="Do not deduct pension contributions"
                    checked={formData.payroll.exemptions.pension}
                    onChange={(checked) => updateField('payroll.exemptions.pension', checked)}
                  />
                  <SettingsToggle
                    label="Exempt from NHF"
                    description="Do not deduct housing fund"
                    checked={formData.payroll.exemptions.nhf}
                    onChange={(checked) => updateField('payroll.exemptions.nhf', checked)}
                  />
                  <SettingsToggle
                    label="Exempt from NHIS"
                    description="Do not deduct health insurance"
                    checked={formData.payroll.exemptions.nhis}
                    onChange={(checked) => updateField('payroll.exemptions.nhis', checked)}
                  />
                </div>
              </FormSection>

              <FormDivider />

              <FormSection
                title="Annual Tax Reliefs (NTA 2025)"
                description="Declared once per year. These amounts reduce this employee's taxable income before PAYE brackets are applied. All values are in Naira per annum."
              >
                <div className="p-3 mb-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-700">
                  Pension, NHF, and NHIS deductions are applied automatically. Only enter reliefs the employee
                  is claiming in writing — rent paid, life assurance premiums, mortgage interest, and voluntary AVC.
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    label="Annual Rent Paid (₦)"
                    hint="Relief = 20% of rent, max ₦500,000/yr"
                  >
                    <NumericInput
                      value={formData.payroll.taxReliefs.annualRent}
                      onChange={(v) => updateField('payroll.taxReliefs.annualRent', v)}
                      placeholder="e.g. 1,200,000"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 focus:ring-2 focus:ring-blue-500"
                    />
                    {formData.payroll.taxReliefs.annualRent > 0 && (
                      <p className="text-xs text-green-600 mt-1">
                        Rent relief: ₦{Math.min(formData.payroll.taxReliefs.annualRent * 0.2, 500000).toLocaleString()}/yr
                      </p>
                    )}
                  </FormField>

                  <FormField
                    label="Life Assurance Premiums (₦/yr)"
                    hint="Annual premiums paid on life assurance policies"
                  >
                    <NumericInput
                      value={formData.payroll.taxReliefs.annualLifeAssurance}
                      onChange={(v) => updateField('payroll.taxReliefs.annualLifeAssurance', v)}
                      placeholder="e.g. 240,000"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 focus:ring-2 focus:ring-blue-500"
                    />
                  </FormField>

                  <FormField
                    label="Mortgage Interest (₦/yr)"
                    hint="Interest paid on mortgage for primary residence"
                  >
                    <NumericInput
                      value={formData.payroll.taxReliefs.annualMortgageInterest}
                      onChange={(v) => updateField('payroll.taxReliefs.annualMortgageInterest', v)}
                      placeholder="e.g. 600,000"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 focus:ring-2 focus:ring-blue-500"
                    />
                  </FormField>

                  <FormField
                    label="Voluntary Pension AVC (₦/yr)"
                    hint="Additional Voluntary Contributions above mandatory 8%"
                  >
                    <NumericInput
                      value={formData.payroll.taxReliefs.voluntaryPensionAVC}
                      onChange={(v) => updateField('payroll.taxReliefs.voluntaryPensionAVC', v)}
                      placeholder="e.g. 120,000"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 focus:ring-2 focus:ring-blue-500"
                    />
                  </FormField>
                </div>
              </FormSection>
            </div>
          )}

          {/* Settings Tab */}
          {activeTab === 'settings' && (
            <div className="space-y-4">
              <SettingsToggle
                label="Overtime Eligible"
                description="This staff can receive overtime payments"
                checked={formData.payroll.overtimeEligible}
                onChange={(checked) => updateField('payroll.overtimeEligible', checked)}
              />

              <FormDivider />

              <SettingsToggle
                label="Exclude from Attendance Deductions"
                description="Payroll is processed normally but absences, lateness, and early leave are not deducted. Use for staff who don't clock in/out."
                checked={formData.payroll.excludeFromDeductions}
                onChange={(checked) => updateField('payroll.excludeFromDeductions', checked)}
              />

              <FormDivider />

              <FormField label="Notes">
                <textarea
                  value={formData.payroll.notes}
                  onChange={(e) => updateField('payroll.notes', e.target.value)}
                  placeholder="Additional payroll notes..."
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 focus:ring-2 focus:ring-blue-500"
                />
              </FormField>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-4 border-t border-gray-200">
          <button
            onClick={onClose}
            disabled={isSaving}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving || !formData.baseSalary}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            {isSaving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                Save Changes
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

export default StaffPayrollModal;
