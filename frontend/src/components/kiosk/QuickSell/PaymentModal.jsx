// src/components/kiosk/QuickSell/PaymentModal.jsx
import { useState, useEffect } from 'react';
import { formatCurrency } from '../../../utils/formatters';
import { X, CreditCard, Banknote, Building2, Split, DollarSign, Users, ChevronDown, ChevronUp } from 'lucide-react';

function PaymentModal({
  total,
  paymentMethod,
  onSetPaymentMethod,
  onConfirm,
  onClose,
  loading,
  onSplitPayment,
  gratuity = 0,
  onSetGratuity,
  selectedSalesStaff = null,
  onSetSalesStaff = null,
  makeRequest
}) {
  const [staffList, setStaffList] = useState([]);
  const [staffLoading, setStaffLoading] = useState(false);
  const [showTipOptions, setShowTipOptions] = useState(false); // Collapsible tip section

  // Fetch staff list for staff attribution dropdown
  useEffect(() => {
    if (onSetSalesStaff) {
      fetchStaff();
    }
  }, [onSetSalesStaff]);

  const fetchStaff = async () => {
    setStaffLoading(true);
    try {
      const response = await makeRequest('/api/staff');
      // Backend returns { staff: [...] } not an array directly
      const staffData = response?.staff || response || [];
      const activeStaff = Array.isArray(staffData) ? staffData.filter(s => s.status === 'active') : [];
      setStaffList(activeStaff);
    } catch (err) {
      console.error('Failed to load staff list:', err);
    } finally {
      setStaffLoading(false);
    }
  };
  const paymentMethods = [
    { id: 'cash', name: 'Cash', icon: Banknote, color: '#10b981' },
    { id: 'card', name: 'Card', icon: CreditCard, color: '#3b82f6' },
    { id: 'bank_transfer', name: 'Bank Transfer', icon: Building2, color: '#8b5cf6' }
  ];

  const tipPresets = [
    { label: '10%', value: 10, type: 'percentage' },
    { label: '15%', value: 15, type: 'percentage' },
    { label: '20%', value: 20, type: 'percentage' }
  ];

  const calculateGratuityAmount = (value, type) => {
    if (type === 'percentage') {
      return (total * value) / 100;
    }
    return value;
  };

  const grandTotal = total + gratuity;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 2000,
        fontFamily: 'Inter, system-ui, sans-serif',
        padding: '1rem'
      }}
    >
      <div
        style={{
          background: '#ffffff',
          borderRadius: '1rem',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
          width: '100%',
          maxWidth: '28rem'
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '1.5rem',
            borderBottom: '1px solid #e5e7eb'
          }}
        >
          <h2 style={{ fontSize: '1.25rem', fontWeight: '700', color: '#1f2937', margin: 0 }}>
            Complete Payment
          </h2>
          <button
            onClick={onClose}
            disabled={loading}
            style={{
              padding: '0.5rem',
              border: 'none',
              background: 'transparent',
              cursor: loading ? 'not-allowed' : 'pointer',
              color: '#6b7280',
              opacity: loading ? 0.5 : 1
            }}
          >
            <X size={24} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '1.5rem', maxHeight: 'calc(100vh - 200px)', overflowY: 'auto' }}>
          {/* Total Amount */}
          <div
            style={{
              padding: '1.5rem',
              marginBottom: '1.5rem',
              borderRadius: '0.75rem',
              background: 'linear-gradient(135deg, #dbeafe 0%, #e0e7ff 100%)'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
              <p style={{ fontSize: '0.875rem', color: '#6b7280', margin: 0 }}>Subtotal</p>
              <p style={{ fontSize: '0.875rem', fontWeight: '600', color: '#1f2937', margin: 0 }}>
                {formatCurrency(total)}
              </p>
            </div>
            {gratuity > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <p style={{ fontSize: '0.875rem', color: '#6b7280', margin: 0 }}>Gratuity/Tip</p>
                <p style={{ fontSize: '0.875rem', fontWeight: '600', color: '#059669', margin: 0 }}>
                  {formatCurrency(gratuity)}
                </p>
              </div>
            )}
            <div style={{ borderTop: '1px solid rgba(0,0,0,0.1)', marginTop: '0.5rem', paddingTop: '0.75rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <p style={{ fontSize: '0.875rem', fontWeight: '600', color: '#1f2937', margin: 0 }}>Grand Total</p>
                <p style={{ fontSize: '2rem', fontWeight: '700', color: '#1f2937', margin: 0 }}>
                  {formatCurrency(grandTotal)}
                </p>
              </div>
            </div>
          </div>

          {/* Gratuity/Tip Section - Collapsible */}
          {onSetGratuity && (
            <div style={{ marginBottom: '1.5rem' }}>
              {/* Collapsible Header */}
              <button
                type="button"
                onClick={() => setShowTipOptions(!showTipOptions)}
                disabled={loading}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '0.75rem 1rem',
                  border: `2px solid ${gratuity > 0 ? '#059669' : '#e5e7eb'}`,
                  borderRadius: '0.5rem',
                  background: gratuity > 0 ? '#d1fae5' : '#f9fafb',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  fontFamily: 'Inter, sans-serif',
                  transition: 'all 0.2s ease'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <DollarSign size={16} style={{ color: gratuity > 0 ? '#059669' : '#6b7280' }} />
                  <span style={{ fontSize: '0.875rem', fontWeight: '600', color: gratuity > 0 ? '#065f46' : '#374151' }}>
                    {gratuity > 0 ? `Tip: ${formatCurrency(gratuity)}` : 'Add Tip (Optional)'}
                  </span>
                </div>
                {showTipOptions ? <ChevronUp size={18} style={{ color: '#6b7280' }} /> : <ChevronDown size={18} style={{ color: '#6b7280' }} />}
              </button>

              {/* Collapsible Content */}
              {showTipOptions && (
                <div style={{ marginTop: '0.75rem', padding: '0.75rem', background: '#f9fafb', borderRadius: '0.5rem', border: '1px solid #e5e7eb' }}>
                  {/* Preset Tip Percentages */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.5rem', marginBottom: '0.75rem' }}>
                    {tipPresets.map(preset => {
                      const tipAmount = calculateGratuityAmount(preset.value, preset.type);
                      const isSelected = Math.abs(gratuity - tipAmount) < 0.01;

                      return (
                        <button
                          key={preset.label}
                          onClick={() => onSetGratuity(tipAmount, preset.type, preset.value)}
                          disabled={loading}
                          style={{
                            padding: '0.75rem 0.5rem',
                            border: `2px solid ${isSelected ? '#059669' : '#e5e7eb'}`,
                            borderRadius: '0.5rem',
                            background: isSelected ? '#d1fae5' : '#ffffff',
                            cursor: loading ? 'not-allowed' : 'pointer',
                            transition: 'all 0.3s ease',
                            opacity: loading ? 0.5 : 1
                          }}
                        >
                          <div style={{ fontSize: '0.75rem', fontWeight: '700', color: isSelected ? '#059669' : '#1f2937', marginBottom: '0.25rem' }}>
                            {preset.label}
                          </div>
                          <div style={{ fontSize: '0.65rem', color: '#6b7280' }}>
                            {formatCurrency(tipAmount)}
                          </div>
                        </button>
                      );
                    })}

                    {/* No Tip */}
                    <button
                      onClick={() => onSetGratuity(0, 'none', 0)}
                      disabled={loading}
                      style={{
                        padding: '0.75rem 0.5rem',
                        border: `2px solid ${gratuity === 0 ? '#6b7280' : '#e5e7eb'}`,
                        borderRadius: '0.5rem',
                        background: gratuity === 0 ? '#f3f4f6' : '#ffffff',
                        cursor: loading ? 'not-allowed' : 'pointer',
                        transition: 'all 0.3s ease',
                        opacity: loading ? 0.5 : 1
                      }}
                    >
                      <div style={{ fontSize: '0.75rem', fontWeight: '700', color: gratuity === 0 ? '#1f2937' : '#6b7280' }}>
                        No Tip
                      </div>
                    </button>
                  </div>

                  {/* Custom Tip Amount */}
                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', color: '#6b7280', marginBottom: '0.25rem' }}>
                      Custom Amount
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="Enter custom tip amount"
                      value={gratuity > 0 && !tipPresets.some(p => Math.abs(calculateGratuityAmount(p.value, p.type) - gratuity) < 0.01) ? gratuity : ''}
                      onChange={(e) => onSetGratuity(parseFloat(e.target.value) || 0, 'fixed', parseFloat(e.target.value) || 0)}
                      disabled={loading}
                      style={{
                        width: '100%',
                        padding: '0.5rem',
                        border: '1px solid #d1d5db',
                        borderRadius: '0.5rem',
                        fontSize: '0.875rem',
                        fontFamily: 'Inter, sans-serif',
                        opacity: loading ? 0.5 : 1
                      }}
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Payment Methods */}
          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', color: '#374151', marginBottom: '1rem' }}>
              Select Payment Method
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem' }}>
              {paymentMethods.map(method => {
                const Icon = method.icon;
                const isSelected = paymentMethod === method.id;
                
                return (
                  <button
                    key={method.id}
                    onClick={() => onSetPaymentMethod(method.id)}
                    disabled={loading}
                    style={{
                      padding: '1rem',
                      border: `2px solid ${isSelected ? method.color : '#e5e7eb'}`,
                      borderRadius: '0.75rem',
                      background: isSelected ? `${method.color}15` : '#ffffff',
                      cursor: loading ? 'not-allowed' : 'pointer',
                      transition: 'all 0.3s ease',
                      opacity: loading ? 0.5 : 1
                    }}
                  >
                    <div
                      style={{
                        width: '48px',
                        height: '48px',
                        margin: '0 auto 0.5rem',
                        borderRadius: '50%',
                        background: isSelected ? method.color : '#f3f4f6',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}
                    >
                      <Icon size={24} style={{ color: isSelected ? '#ffffff' : method.color }} />
                    </div>
                    <p style={{ fontSize: '0.75rem', fontWeight: '600', color: '#1f2937', margin: 0, textAlign: 'center' }}>
                      {method.name}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Payment Instructions */}
          {paymentMethod === 'cash' && (
            <div style={{ padding: '0.75rem', borderRadius: '0.5rem', background: '#d1fae5', border: '1px solid #a7f3d0' }}>
              <p style={{ fontSize: '0.875rem', color: '#065f46', margin: 0 }}>
                💵 Collect cash payment from customer
              </p>
            </div>
          )}

          {paymentMethod === 'card' && (
            <div style={{ padding: '0.75rem', borderRadius: '0.5rem', background: '#dbeafe', border: '1px solid #bfdbfe' }}>
              <p style={{ fontSize: '0.875rem', color: '#1e40af', margin: 0 }}>
                💳 Process card payment using POS terminal
              </p>
            </div>
          )}

          {paymentMethod === 'bank_transfer' && (
            <div style={{ padding: '0.75rem', borderRadius: '0.5rem', background: '#e9d5ff', border: '1px solid #d8b4fe' }}>
              <p style={{ fontSize: '0.875rem', color: '#6b21a8', margin: 0 }}>
                🏦 Verify bank transfer confirmation before completing
              </p>
            </div>
          )}

          {/* Staff Attribution - Optional */}
          {onSetSalesStaff && (
            <div style={{ marginTop: '1.5rem' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem', fontWeight: '600', color: '#374151', marginBottom: '0.75rem' }}>
                <Users size={16} />
                Assign to Staff (Optional)
              </label>
              <select
                value={selectedSalesStaff?._id || ''}
                onChange={(e) => {
                  if (!e.target.value) {
                    onSetSalesStaff(null);
                  } else {
                    const staff = staffList.find(s => s._id === e.target.value);
                    onSetSalesStaff(staff || null);
                  }
                }}
                disabled={loading || staffLoading}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  border: '1px solid #d1d5db',
                  borderRadius: '0.5rem',
                  fontSize: '0.875rem',
                  fontFamily: 'Inter, sans-serif',
                  background: '#ffffff',
                  cursor: loading || staffLoading ? 'not-allowed' : 'pointer',
                  opacity: loading || staffLoading ? 0.5 : 1
                }}
              >
                <option value="">— Not attributed to any staff —</option>
                {staffList.map(staff => (
                  <option key={staff._id} value={staff._id}>
                    {staff.firstName} {staff.lastName}{staff.employeeId ? ` (${staff.employeeId})` : ''}
                  </option>
                ))}
              </select>
              <p style={{ fontSize: '0.7rem', color: '#9ca3af', marginTop: '0.5rem', margin: 0 }}>
                Attribute this sale to a staff member for reporting & commission
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '1.5rem', borderTop: '1px solid #e5e7eb' }}>
          {/* Split Payment Option */}
          {onSplitPayment && (
            <button
              type="button"
              onClick={onSplitPayment}
              disabled={loading}
              style={{
                width: '100%',
                padding: '0.75rem',
                border: '2px dashed #f59e0b',
                borderRadius: '0.5rem',
                background: '#fef3c7',
                color: '#92400e',
                fontSize: '0.875rem',
                fontWeight: '600',
                cursor: loading ? 'not-allowed' : 'pointer',
                fontFamily: 'Inter, sans-serif',
                marginBottom: '0.75rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem',
                opacity: loading ? 0.5 : 1
              }}
            >
              <Split size={18} />
              Split Payment
            </button>
          )}

          {/* Action Buttons */}
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              style={{
                flex: 1,
                padding: '0.75rem',
                border: '1px solid #e5e7eb',
                borderRadius: '0.5rem',
                background: '#ffffff',
                color: '#374151',
                fontSize: '0.875rem',
                fontWeight: '600',
                cursor: loading ? 'not-allowed' : 'pointer',
                fontFamily: 'Inter, sans-serif',
                opacity: loading ? 0.5 : 1
              }}
            >
              Cancel
            </button>
            <button
              onClick={() => onConfirm()}
              disabled={loading}
              style={{
                flex: 1,
                padding: '0.75rem',
                border: 'none',
                borderRadius: '0.5rem',
                background: loading ? '#9ca3af' : '#3b82f6',
                color: '#ffffff',
                fontSize: '0.875rem',
                fontWeight: '600',
                cursor: loading ? 'not-allowed' : 'pointer',
                fontFamily: 'Inter, sans-serif',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem'
              }}
            >
              {loading ? (
                <>
                  <div
                    style={{
                      width: '16px',
                      height: '16px',
                      border: '2px solid #ffffff',
                      borderTopColor: 'transparent',
                      borderRadius: '50%',
                      animation: 'spin 1s linear infinite'
                    }}
                  />
                  Processing...
                </>
              ) : (
                'Confirm Payment'
              )}
            </button>
          </div>
        </div>
      </div>

      <style>
        {`
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `}
      </style>
    </div>
  );
}

export default PaymentModal;