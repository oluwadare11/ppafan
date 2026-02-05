// src/components/kiosk/QuickSell/SplitPaymentModal.jsx
import { useState, useEffect } from 'react';

function SplitPaymentModal({ total, onConfirm, onClose, loading }) {
  const [splitPayments, setSplitPayments] = useState([
    { method: 'cash', amount: 0, reference: '' }
  ]);
  const [error, setError] = useState('');

  // Calculate remaining amount
  const paidAmount = splitPayments.reduce((sum, payment) => sum + (parseFloat(payment.amount) || 0), 0);
  const remainingAmount = total - paidAmount;

  // Check if payment is complete
  const isPaymentComplete = Math.abs(remainingAmount) < 0.01; // Allow 1 cent tolerance

  // Add a new payment method
  const handleAddPayment = () => {
    if (splitPayments.length >= 5) {
      setError('Maximum 5 payment methods allowed');
      return;
    }
    setSplitPayments([...splitPayments, { method: 'cash', amount: 0, reference: '' }]);
    setError('');
  };

  // Remove a payment method
  const handleRemovePayment = (index) => {
    if (splitPayments.length === 1) {
      setError('At least one payment method is required');
      return;
    }
    setSplitPayments(splitPayments.filter((_, i) => i !== index));
    setError('');
  };

  // Update a payment method
  const handleUpdatePayment = (index, field, value) => {
    const updated = [...splitPayments];
    // For amount field, ensure we store a valid number or empty string
    if (field === 'amount') {
      // Allow empty string for typing, otherwise parse as float
      const numValue = value === '' ? '' : parseFloat(value);
      updated[index] = { ...updated[index], [field]: isNaN(numValue) ? '' : numValue };
    } else {
      updated[index] = { ...updated[index], [field]: value };
    }
    setSplitPayments(updated);
    setError('');
  };

  // Auto-fill remaining amount for the last payment
  const handleAutoFill = (index) => {
    if (remainingAmount > 0) {
      handleUpdatePayment(index, 'amount', remainingAmount.toFixed(2));
    }
  };

  // Handle confirm
  const handleConfirm = () => {
    // Validate all payments have amounts
    const invalidPayments = splitPayments.filter(p => !p.amount || parseFloat(p.amount) <= 0);
    if (invalidPayments.length > 0) {
      setError('All payment methods must have a valid amount');
      return;
    }

    // Check if payment is complete
    if (!isPaymentComplete) {
      setError(`Remaining amount: ₦${Math.abs(remainingAmount).toFixed(2)}`);
      return;
    }

    // Confirm split payment
    onConfirm(splitPayments);
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const getPaymentMethodLabel = (method) => {
    switch (method) {
      case 'cash': return 'Cash';
      case 'card': return 'Card';
      case 'bank_transfer': return 'Bank Transfer';
      default: return method;
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.7)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 2000,
        padding: '1rem'
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          background: '#ffffff',
          borderRadius: '1rem',
          width: '100%',
          maxWidth: '600px',
          maxHeight: '90vh',
          overflow: 'auto',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)'
        }}
      >
        {/* Header */}
        <div style={{
          background: 'linear-gradient(135deg, #3b82f6 0%, #1e40af 100%)',
          color: '#ffffff',
          padding: '1.5rem',
          borderTopLeftRadius: '1rem',
          borderTopRightRadius: '1rem'
        }}>
          <h2 style={{ fontSize: '1.5rem', fontWeight: '700', marginBottom: '0.5rem' }}>
            Split Payment
          </h2>
          <p style={{ opacity: 0.9, fontSize: '0.875rem' }}>
            Divide payment across multiple methods
          </p>
        </div>

        {/* Content */}
        <div style={{ padding: '1.5rem' }}>
          {/* Total Amount */}
          <div style={{
            background: 'linear-gradient(135deg, #f3f4f6 0%, #e5e7eb 100%)',
            border: '2px solid #3b82f6',
            borderRadius: '0.75rem',
            padding: '1rem',
            marginBottom: '1.5rem',
            textAlign: 'center'
          }}>
            <div style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '0.25rem' }}>
              Total Amount
            </div>
            <div style={{ fontSize: '2rem', fontWeight: '700', color: '#1f2937' }}>
              {formatCurrency(total)}
            </div>
          </div>

          {/* Split Payments */}
          <div style={{ marginBottom: '1rem' }}>
            <div style={{
              fontSize: '0.875rem',
              fontWeight: '600',
              color: '#4b5563',
              marginBottom: '0.75rem'
            }}>
              Payment Methods ({splitPayments.length})
            </div>

            {splitPayments.map((payment, index) => (
              <div
                key={index}
                style={{
                  background: '#f9fafb',
                  border: '1px solid #e5e7eb',
                  borderRadius: '0.5rem',
                  padding: '1rem',
                  marginBottom: '0.75rem'
                }}
              >
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '0.75rem'
                }}>
                  <span style={{ fontSize: '0.875rem', fontWeight: '600', color: '#374151' }}>
                    Payment {index + 1}
                  </span>
                  {splitPayments.length > 1 && (
                    <button
                      onClick={() => handleRemovePayment(index)}
                      style={{
                        color: '#ef4444',
                        fontSize: '0.875rem',
                        fontWeight: '600',
                        cursor: 'pointer',
                        background: 'none',
                        border: 'none',
                        padding: '0.25rem 0.5rem'
                      }}
                    >
                      Remove
                    </button>
                  )}
                </div>

                {/* Payment Method Selector */}
                <div style={{ marginBottom: '0.75rem' }}>
                  <label style={{
                    display: 'block',
                    fontSize: '0.75rem',
                    fontWeight: '500',
                    color: '#6b7280',
                    marginBottom: '0.25rem'
                  }}>
                    Payment Method
                  </label>
                  <select
                    value={payment.method}
                    onChange={(e) => handleUpdatePayment(index, 'method', e.target.value)}
                    style={{
                      width: '100%',
                      padding: '0.625rem',
                      fontSize: '1rem',
                      border: '1px solid #d1d5db',
                      borderRadius: '0.5rem',
                      background: '#ffffff'
                    }}
                  >
                    <option value="cash">💵 Cash</option>
                    <option value="card">💳 Card</option>
                    <option value="bank_transfer">🏦 Bank Transfer</option>
                  </select>
                </div>

                {/* Amount Input */}
                <div style={{ marginBottom: '0.5rem' }}>
                  <label style={{
                    display: 'block',
                    fontSize: '0.75rem',
                    fontWeight: '500',
                    color: '#6b7280',
                    marginBottom: '0.25rem'
                  }}>
                    Amount (₦)
                  </label>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <input
                      type="number"
                      value={payment.amount || ''}
                      onChange={(e) => handleUpdatePayment(index, 'amount', e.target.value)}
                      placeholder="0.00"
                      step="0.01"
                      min="0"
                      style={{
                        flex: 1,
                        padding: '0.625rem',
                        fontSize: '1.125rem',
                        fontWeight: '600',
                        border: '2px solid #3b82f6',
                        borderRadius: '0.5rem',
                        background: '#ffffff'
                      }}
                    />
                    {remainingAmount > 0 && (
                      <button
                        onClick={() => handleAutoFill(index)}
                        style={{
                          padding: '0.625rem 1rem',
                          fontSize: '0.875rem',
                          fontWeight: '600',
                          color: '#ffffff',
                          background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                          border: 'none',
                          borderRadius: '0.5rem',
                          cursor: 'pointer',
                          whiteSpace: 'nowrap'
                        }}
                      >
                        Auto-fill
                      </button>
                    )}
                  </div>
                </div>

                {/* Reference Input (for card/transfer) */}
                {(payment.method === 'card' || payment.method === 'bank_transfer') && (
                  <div>
                    <label style={{
                      display: 'block',
                      fontSize: '0.75rem',
                      fontWeight: '500',
                      color: '#6b7280',
                      marginBottom: '0.25rem'
                    }}>
                      Reference Number (Optional)
                    </label>
                    <input
                      type="text"
                      value={payment.reference || ''}
                      onChange={(e) => handleUpdatePayment(index, 'reference', e.target.value)}
                      placeholder="Enter reference number"
                      style={{
                        width: '100%',
                        padding: '0.625rem',
                        fontSize: '0.875rem',
                        border: '1px solid #d1d5db',
                        borderRadius: '0.5rem',
                        background: '#ffffff'
                      }}
                    />
                  </div>
                )}
              </div>
            ))}

            {/* Add Payment Button */}
            {splitPayments.length < 5 && (
              <button
                onClick={handleAddPayment}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  fontSize: '0.875rem',
                  fontWeight: '600',
                  color: '#3b82f6',
                  background: '#eff6ff',
                  border: '2px dashed #3b82f6',
                  borderRadius: '0.5rem',
                  cursor: 'pointer'
                }}
              >
                + Add Another Payment Method
              </button>
            )}
          </div>

          {/* Payment Summary */}
          <div style={{
            background: remainingAmount > 0.01 ? '#fef3c7' : '#d1fae5',
            border: `2px solid ${remainingAmount > 0.01 ? '#f59e0b' : '#10b981'}`,
            borderRadius: '0.75rem',
            padding: '1rem',
            marginBottom: '1rem'
          }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              marginBottom: '0.5rem',
              fontSize: '0.875rem',
              color: '#374151'
            }}>
              <span>Paid:</span>
              <span style={{ fontWeight: '600' }}>{formatCurrency(paidAmount)}</span>
            </div>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              fontSize: '1rem',
              fontWeight: '700',
              color: remainingAmount > 0.01 ? '#92400e' : '#065f46'
            }}>
              <span>Remaining:</span>
              <span>{formatCurrency(Math.abs(remainingAmount))}</span>
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div style={{
              background: '#fef2f2',
              border: '1px solid #fca5a5',
              color: '#991b1b',
              padding: '0.75rem',
              borderRadius: '0.5rem',
              fontSize: '0.875rem',
              marginBottom: '1rem'
            }}>
              {error}
            </div>
          )}

          {/* Action Buttons */}
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button
              onClick={onClose}
              disabled={loading}
              style={{
                flex: 1,
                padding: '1rem',
                fontSize: '1rem',
                fontWeight: '600',
                color: '#6b7280',
                background: '#f3f4f6',
                border: 'none',
                borderRadius: '0.75rem',
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.5 : 1
              }}
            >
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              disabled={loading || !isPaymentComplete}
              style={{
                flex: 1,
                padding: '1rem',
                fontSize: '1rem',
                fontWeight: '700',
                color: '#ffffff',
                background: isPaymentComplete
                  ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)'
                  : '#9ca3af',
                border: 'none',
                borderRadius: '0.75rem',
                cursor: (loading || !isPaymentComplete) ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.7 : 1
              }}
            >
              {loading ? 'Processing...' : `Confirm Payment (${splitPayments.length} methods)`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default SplitPaymentModal;
