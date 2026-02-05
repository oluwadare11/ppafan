// src/components/kiosk/QuickSell/ModifierSelectionModal.jsx
import { useState, useEffect } from 'react';
import { X, CheckCircle2 } from 'lucide-react';
import { formatCurrency } from '../../../utils/formatters';

function ModifierSelectionModal({ item, onConfirm, onClose }) {
  // Initialize state with default selections
  const [selectedModifiers, setSelectedModifiers] = useState({});
  const [validationErrors, setValidationErrors] = useState([]);

  useEffect(() => {
    // Set default selections when modal opens
    const defaults = {};
    item.modifiers?.forEach((modifier, modIndex) => {
      const defaultOptions = modifier.options
        .map((opt, optIndex) => opt.isDefault ? optIndex : null)
        .filter(idx => idx !== null);

      if (defaultOptions.length > 0) {
        if (modifier.type === 'single') {
          defaults[modIndex] = defaultOptions[0];
        } else {
          defaults[modIndex] = defaultOptions;
        }
      } else {
        defaults[modIndex] = modifier.type === 'single' ? null : [];
      }
    });
    setSelectedModifiers(defaults);
  }, [item]);

  const handleSingleSelection = (modifierIndex, optionIndex) => {
    setSelectedModifiers({
      ...selectedModifiers,
      [modifierIndex]: optionIndex
    });
  };

  const handleMultipleSelection = (modifierIndex, optionIndex) => {
    const currentSelections = selectedModifiers[modifierIndex] || [];
    const isSelected = currentSelections.includes(optionIndex);

    setSelectedModifiers({
      ...selectedModifiers,
      [modifierIndex]: isSelected
        ? currentSelections.filter(idx => idx !== optionIndex)
        : [...currentSelections, optionIndex]
    });
  };

  const calculateAdditionalCost = () => {
    let total = 0;
    item.modifiers?.forEach((modifier, modIndex) => {
      const selection = selectedModifiers[modIndex];

      if (modifier.type === 'single' && selection !== null && selection !== undefined) {
        total += modifier.options[selection]?.price || 0;
      } else if (modifier.type === 'multiple' && Array.isArray(selection)) {
        selection.forEach(optIndex => {
          total += modifier.options[optIndex]?.price || 0;
        });
      }
    });
    return total;
  };

  const validateAndConfirm = () => {
    const errors = [];

    item.modifiers?.forEach((modifier, modIndex) => {
      if (modifier.required) {
        const selection = selectedModifiers[modIndex];
        if (
          (modifier.type === 'single' && (selection === null || selection === undefined)) ||
          (modifier.type === 'multiple' && (!Array.isArray(selection) || selection.length === 0))
        ) {
          errors.push(`Please select an option for "${modifier.name}"`);
        }
      }
    });

    if (errors.length > 0) {
      setValidationErrors(errors);
      return;
    }

    // Build selected modifiers data
    const modifiersData = item.modifiers?.map((modifier, modIndex) => {
      const selection = selectedModifiers[modIndex];
      const selectedOptions = [];

      if (modifier.type === 'single' && selection !== null && selection !== undefined) {
        const option = modifier.options[selection];
        if (option) {
          selectedOptions.push({
            optionName: option.name,
            price: option.price || 0
          });
        }
      } else if (modifier.type === 'multiple' && Array.isArray(selection)) {
        selection.forEach(optIndex => {
          const option = modifier.options[optIndex];
          if (option) {
            selectedOptions.push({
              optionName: option.name,
              price: option.price || 0
            });
          }
        });
      }

      return {
        modifierName: modifier.name,
        selectedOptions
      };
    }).filter(mod => mod.selectedOptions.length > 0);

    onConfirm({
      modifiers: modifiersData,
      additionalCost: calculateAdditionalCost()
    });
  };

  const additionalCost = calculateAdditionalCost();
  const finalPrice = item.price + additionalCost;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 50,
        fontFamily: 'Inter, system-ui, sans-serif',
        padding: '1rem'
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: '#ffffff',
          borderRadius: '1rem',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
          width: '100%',
          maxWidth: '600px',
          maxHeight: '90vh',
          overflow: 'auto'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            position: 'sticky',
            top: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '1.5rem',
            borderBottom: '1px solid #e5e7eb',
            background: '#ffffff',
            zIndex: 1
          }}
        >
          <div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: '700', color: '#1f2937', margin: 0 }}>
              Customize Your Item
            </h2>
            <p style={{ fontSize: '0.875rem', color: '#6b7280', marginTop: '0.25rem' }}>
              {item.name}
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              padding: '0.5rem',
              border: 'none',
              background: 'transparent',
              cursor: 'pointer',
              color: '#6b7280'
            }}
          >
            <X size={24} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '1.5rem' }}>
          {/* Validation Errors */}
          {validationErrors.length > 0 && (
            <div
              style={{
                padding: '0.75rem',
                marginBottom: '1rem',
                borderRadius: '0.5rem',
                background: '#fee2e2',
                border: '1px solid #fecaca'
              }}
            >
              {validationErrors.map((error, idx) => (
                <p key={idx} style={{ fontSize: '0.875rem', color: '#dc2626', margin: '0.25rem 0' }}>
                  {error}
                </p>
              ))}
            </div>
          )}

          {/* Modifiers */}
          {item.modifiers?.map((modifier, modIndex) => (
            <div
              key={modIndex}
              style={{
                marginBottom: '1.5rem',
                padding: '1rem',
                borderRadius: '0.75rem',
                background: '#f9fafb',
                border: '1px solid #e5e7eb'
              }}
            >
              <div style={{ marginBottom: '0.75rem' }}>
                <h3 style={{ fontSize: '1rem', fontWeight: '600', color: '#111827', margin: 0 }}>
                  {modifier.name}
                  {modifier.required && (
                    <span style={{ color: '#dc2626', marginLeft: '0.25rem' }}>*</span>
                  )}
                </h3>
                <p style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '0.25rem' }}>
                  {modifier.type === 'single' ? 'Choose one' : 'Choose multiple'}
                </p>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {modifier.options.map((option, optIndex) => {
                  const isSelected = modifier.type === 'single'
                    ? selectedModifiers[modIndex] === optIndex
                    : selectedModifiers[modIndex]?.includes(optIndex);

                  return (
                    <button
                      key={optIndex}
                      onClick={() => {
                        if (modifier.type === 'single') {
                          handleSingleSelection(modIndex, optIndex);
                        } else {
                          handleMultipleSelection(modIndex, optIndex);
                        }
                        setValidationErrors([]);
                      }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '0.75rem 1rem',
                        border: `2px solid ${isSelected ? '#8b5cf6' : '#e5e7eb'}`,
                        borderRadius: '0.5rem',
                        background: isSelected ? '#f3e8ff' : '#ffffff',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                        textAlign: 'left'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <div
                          style={{
                            width: '20px',
                            height: '20px',
                            borderRadius: modifier.type === 'single' ? '50%' : '0.25rem',
                            border: `2px solid ${isSelected ? '#8b5cf6' : '#d1d5db'}`,
                            background: isSelected ? '#8b5cf6' : '#ffffff',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                          }}
                        >
                          {isSelected && <CheckCircle2 size={14} color="#ffffff" />}
                        </div>
                        <span
                          style={{
                            fontSize: '0.875rem',
                            fontWeight: isSelected ? '600' : '400',
                            color: '#1f2937'
                          }}
                        >
                          {option.name}
                        </span>
                      </div>
                      {option.price > 0 && (
                        <span style={{ fontSize: '0.875rem', fontWeight: '600', color: '#059669' }}>
                          +{formatCurrency(option.price)}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}

          {/* Price Summary */}
          <div
            style={{
              marginTop: '1.5rem',
              padding: '1rem',
              borderRadius: '0.75rem',
              background: 'linear-gradient(135deg, #dbeafe 0%, #e0e7ff 100%)'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
              <span style={{ fontSize: '0.875rem', color: '#6b7280' }}>Base Price</span>
              <span style={{ fontSize: '0.875rem', fontWeight: '600', color: '#1f2937' }}>
                {formatCurrency(item.price)}
              </span>
            </div>
            {additionalCost > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                <span style={{ fontSize: '0.875rem', color: '#6b7280' }}>Modifiers</span>
                <span style={{ fontSize: '0.875rem', fontWeight: '600', color: '#059669' }}>
                  +{formatCurrency(additionalCost)}
                </span>
              </div>
            )}
            <div
              style={{
                borderTop: '1px solid rgba(0,0,0,0.1)',
                paddingTop: '0.5rem',
                marginTop: '0.5rem'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.875rem', fontWeight: '600', color: '#1f2937' }}>Total</span>
                <span style={{ fontSize: '1.5rem', fontWeight: '700', color: '#1f2937' }}>
                  {formatCurrency(finalPrice)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            position: 'sticky',
            bottom: 0,
            padding: '1.5rem',
            borderTop: '1px solid #e5e7eb',
            background: '#ffffff'
          }}
        >
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button
              onClick={onClose}
              style={{
                flex: 1,
                padding: '0.75rem',
                border: '1px solid #e5e7eb',
                borderRadius: '0.5rem',
                background: '#ffffff',
                color: '#374151',
                fontSize: '0.875rem',
                fontWeight: '600',
                cursor: 'pointer',
                fontFamily: 'Inter, sans-serif'
              }}
            >
              Cancel
            </button>
            <button
              onClick={validateAndConfirm}
              style={{
                flex: 1,
                padding: '0.75rem',
                border: 'none',
                borderRadius: '0.5rem',
                background: '#8b5cf6',
                color: '#ffffff',
                fontSize: '0.875rem',
                fontWeight: '600',
                cursor: 'pointer',
                fontFamily: 'Inter, sans-serif'
              }}
            >
              Add to Cart - {formatCurrency(finalPrice)}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ModifierSelectionModal;
