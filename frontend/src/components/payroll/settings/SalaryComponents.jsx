// SalaryComponents.jsx - Salary allowances management
// Recurring monthly allowances assigned per staff (Housing, Transport, Meal, etc.)
// One-time bonuses (13th month, performance, BIK) are handled in the Adjustments step.

import React, { useState, useCallback } from 'react';
import {
  Plus,
  Edit2,
  Trash2,
  DollarSign,
  Percent,
  GripVertical,
  X,
  Check
} from 'lucide-react';

import {
  FormCard,
  FormField,
  FormActions,
  StatusBadge,
  ComponentTypeBadges,
  ConfirmDialog,
  NoSalaryComponentsEmptyState,
  Tip
} from '../shared';

// Salary components are allowances only — recurring monthly items assigned per staff.
// 13th month, performance bonus, BIK etc. are one-time bonuses added during
// the Adjustments step of payroll processing, not recurring components.

const CALCULATION_TYPES = [
  { value: 'fixed', label: 'Fixed Amount', icon: DollarSign },
  { value: 'percentage', label: 'Percentage', icon: Percent }
];

const PERCENTAGE_OF_OPTIONS = [
  { value: 'basic', label: 'Basic Salary' },
  { value: 'gross', label: 'Gross Salary' }
];

function SalaryComponents({ components = [], onChange }) {
  const [editingComponent, setEditingComponent] = useState(null);
  const [isAdding, setIsAdding] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  // Add new component
  const handleAdd = useCallback(() => {
    setEditingComponent({
      code: '',
      name: '',
      type: 'allowance',
      calculationType: 'fixed',
      defaultValue: 0,
      percentageOf: null,
      isTaxable: true,
      isPensionable: false,
      isActive: true,
      description: ''
    });
    setIsAdding(true);
  }, []);

  // Edit component
  const handleEdit = useCallback((component) => {
    setEditingComponent({ ...component });
    setIsAdding(false);
  }, []);

  // Save component
  const handleSave = useCallback(() => {
    if (!editingComponent.code || !editingComponent.name) return;

    const updatedComponents = isAdding
      ? [...components, editingComponent]
      : components.map(c => c.code === editingComponent.code ? editingComponent : c);

    onChange(updatedComponents);
    setEditingComponent(null);
    setIsAdding(false);
  }, [editingComponent, isAdding, components, onChange]);

  // Delete component
  const handleDelete = useCallback(() => {
    if (!deleteConfirm) return;

    const updatedComponents = components.filter(c => c.code !== deleteConfirm.code);
    onChange(updatedComponents);
    setDeleteConfirm(null);
  }, [deleteConfirm, components, onChange]);

  // Cancel editing
  const handleCancel = useCallback(() => {
    setEditingComponent(null);
    setIsAdding(false);
  }, []);

  // Update editing component field
  const updateField = useCallback((field, value) => {
    setEditingComponent(prev => ({
      ...prev,
      [field]: value
    }));
  }, []);

  const activeComponents = components.filter(c => c.isActive);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">
            Salary Components
          </h3>
          <p className="text-sm text-gray-500">
            Recurring monthly allowances assigned per staff member
          </p>
        </div>

        <button
          onClick={handleAdd}
          disabled={editingComponent !== null}
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Component
        </button>
      </div>

      <Tip>
        These are <strong>recurring monthly allowances</strong> (e.g. Housing, Transport, Meal, Utility).
        For one-time or annual payments like <strong>13th Month, Performance Bonus, or Leave Allowance</strong>,
        use the Adjustments step when processing payroll — they are handled separately so they
        don't inflate monthly pension calculations and receive correct PAYE treatment.
      </Tip>

      {/* Add/Edit Form */}
      {editingComponent && (
        <div className="bg-blue-50/20 rounded-lg border border-blue-200 p-4 md:p-6">
          <h4 className="font-medium text-gray-900 mb-4">
            {isAdding ? 'Add New Component' : 'Edit Component'}
          </h4>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField label="Component Code" required>
              <input
                type="text"
                value={editingComponent.code}
                onChange={(e) => updateField('code', e.target.value.toUpperCase().replace(/\s/g, '_'))}
                placeholder="e.g., HOUSING"
                disabled={!isAdding}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
              />
            </FormField>

            <FormField label="Component Name" required>
              <input
                type="text"
                value={editingComponent.name}
                onChange={(e) => updateField('name', e.target.value)}
                placeholder="e.g., Housing Allowance"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 focus:ring-2 focus:ring-blue-500"
              />
            </FormField>

            {/* Type is always 'allowance' — bonuses are handled in payroll Adjustments step */}

            <FormField label="Calculation Type">
              <select
                value={editingComponent.calculationType}
                onChange={(e) => updateField('calculationType', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 focus:ring-2 focus:ring-blue-500"
              >
                {CALCULATION_TYPES.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </FormField>

            {editingComponent.calculationType === 'fixed' ? (
              <FormField label="Default Amount">
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">N</span>
                  <input
                    type="number"
                    value={editingComponent.defaultValue || 0}
                    onChange={(e) => updateField('defaultValue', parseFloat(e.target.value) || 0)}
                    className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </FormField>
            ) : (
              <>
                <FormField label="Percentage Value">
                  <div className="relative">
                    <input
                      type="number"
                      step="0.1"
                      value={editingComponent.defaultValue || 0}
                      onChange={(e) => updateField('defaultValue', parseFloat(e.target.value) || 0)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 focus:ring-2 focus:ring-blue-500"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500">%</span>
                  </div>
                </FormField>

                <FormField label="Percentage Of">
                  <select
                    value={editingComponent.percentageOf || 'basic'}
                    onChange={(e) => updateField('percentageOf', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 focus:ring-2 focus:ring-blue-500"
                  >
                    {PERCENTAGE_OF_OPTIONS.map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </FormField>
              </>
            )}

            <FormField label="Description">
              <input
                type="text"
                value={editingComponent.description || ''}
                onChange={(e) => updateField('description', e.target.value)}
                placeholder="Optional description"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 focus:ring-2 focus:ring-blue-500"
              />
            </FormField>
          </div>

          <div className="flex flex-wrap gap-4 mt-4 pt-4 border-t border-blue-200">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={editingComponent.isTaxable}
                onChange={(e) => updateField('isTaxable', e.target.checked)}
                className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
              />
              <span className="text-gray-700">Taxable</span>
            </label>

            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={editingComponent.isPensionable}
                onChange={(e) => updateField('isPensionable', e.target.checked)}
                className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
              />
              <span className="text-gray-700">Pensionable</span>
            </label>

            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={editingComponent.isActive}
                onChange={(e) => updateField('isActive', e.target.checked)}
                className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
              />
              <span className="text-gray-700">Active</span>
            </label>
          </div>

          <div className="flex justify-end gap-3 mt-4">
            <button
              onClick={handleCancel}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={!editingComponent.code || !editingComponent.name}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {isAdding ? 'Add Component' : 'Save Changes'}
            </button>
          </div>
        </div>
      )}

      {/* Components List */}
      {activeComponents.length === 0 && !editingComponent ? (
        <NoSalaryComponentsEmptyState onAdd={handleAdd} />
      ) : (
        <div className="space-y-3">
          {activeComponents.map((component) => (
            <div
              key={component.code}
              className="flex items-center justify-between p-4 bg-white rounded-lg border border-gray-200 hover:border-gray-300 transition-colors"
            >
              <div className="flex items-center gap-4">
                <div className="p-2 rounded-lg bg-blue-100/30">
                  <DollarSign className="w-5 h-5 text-blue-600" />
                </div>

                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="font-medium text-gray-900">
                      {component.name}
                    </h4>
                    <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
                      {component.code}
                    </span>
                  </div>
                  <p className="text-sm text-gray-500">
                    {component.calculationType === 'fixed'
                      ? `N${(component.defaultValue || 0).toLocaleString()}`
                      : `${component.defaultValue || 0}% of ${component.percentageOf}`
                    }
                    {component.description && ` - ${component.description}`}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <ComponentTypeBadges
                  isTaxable={component.isTaxable}
                  isPensionable={component.isPensionable}
                />

                <div className="flex gap-1">
                  <button
                    onClick={() => handleEdit(component)}
                    disabled={editingComponent !== null}
                    className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setDeleteConfirm(component)}
                    disabled={editingComponent !== null}
                    className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50/20 rounded-lg transition-colors disabled:opacity-50"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={deleteConfirm !== null}
        onClose={() => setDeleteConfirm(null)}
        onConfirm={handleDelete}
        title="Delete Component?"
        message={`Are you sure you want to delete "${deleteConfirm?.name}"? This will remove it from all future payroll calculations.`}
        type="danger"
        confirmLabel="Delete"
      />
    </div>
  );
}

export default SalaryComponents;
