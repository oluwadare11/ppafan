// src/components/kiosk/QuickSell/Cart.jsx
import { formatCurrency } from '../../../utils/formatters';
import { ShoppingCart, Trash2, Plus, Minus, User, Percent, Home, Users, ClipboardList, Pause, Play, X, ChevronRight } from 'lucide-react';

function Cart({
  cart,
  customerDetails,
  discount,
  applyVAT,
  heldCarts = [],
  calculateSubtotal,
  calculateVAT,
  calculateTotal,
  onUpdateQty,
  onRemoveItem,
  onClearCart,
  onHoldCart,
  onRecallCart,
  onDeleteHeldCart,
  onOpenCustomer,
  onRemoveCustomer,
  onSetDiscount,
  onSetApplyVAT,
  onCheckout,
  onHomeClick,
  onCustomersClick,
  onOrdersClick,
  onCloseCart
}) {
  const subtotal = calculateSubtotal();
  const vat = calculateVAT();
  const total = calculateTotal();

  return (
    <div className="cart-container">
      {/* Compact Header with Icon Menu */}
      <div className="cart-header">
        <div className="cart-header-row">
          {/* Mobile Close Button */}
          {onCloseCart && (
            <button
              onClick={onCloseCart}
              className="cart-close-btn"
            >
              <ChevronRight size={20} />
            </button>
          )}
          <div className="cart-title">
            <ShoppingCart size={20} style={{ color: '#3b82f6' }} />
            <h2>Cart</h2>
          </div>
          {cart.length > 0 && (
            <button
              onClick={onClearCart}
              className="cart-clear-btn"
            >
              <Trash2 size={14} />
            </button>
          )}
        </div>

        {/* Compact Icon-Only Buttons */}
        <div className="cart-nav-buttons">
          <button onClick={onHomeClick} className="cart-nav-btn" title="Home">
            <Home size={16} style={{ color: '#6b7280' }} />
          </button>

          <button onClick={onCustomersClick} className="cart-nav-btn" title="Customer">
            <Users size={16} style={{ color: '#6b7280' }} />
          </button>

          <button onClick={onOrdersClick} className="cart-nav-btn" title="Orders">
            <ClipboardList size={16} style={{ color: '#6b7280' }} />
          </button>
        </div>
      </div>

      {/* Cart Items - LARGER, NO SCROLL CONSTRAINTS */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '0.75rem' }}>
        {cart.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
            <ShoppingCart size={48} style={{ color: '#d1d5db', marginBottom: '0.75rem' }} />
            <p style={{ fontSize: '0.875rem', fontWeight: '600', color: '#6b7280', margin: 0 }}>Cart is empty</p>
            <p style={{ fontSize: '0.75rem', color: '#9ca3af', marginTop: '0.25rem' }}>Add items to start</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {cart.map(item => (
              <CartItem
                key={item.cartItemId || item._id}
                item={item}
                onUpdateQty={onUpdateQty}
                onRemove={onRemoveItem}
              />
            ))}
          </div>
        )}
      </div>

      {/* Customer, Discount, VAT & Totals - Ultra Compact */}
      {cart.length > 0 && (
        <div style={{ padding: '0.5rem', borderTop: '1px solid #e5e7eb', background: '#f9fafb' }}>
          {/* Row 1: Customer + Discount + VAT - Improved sizing for legibility */}
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
            {/* Customer Button */}
            {customerDetails.name ? (
              <div style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                gap: '0.375rem',
                padding: '0.5rem 0.75rem',
                border: '2px solid #10b981',
                borderRadius: '0.375rem',
                background: '#d1fae5',
                minWidth: 0
              }}>
                <User size={16} style={{ color: '#10b981', flexShrink: 0 }} />
                <span style={{ flex: 1, fontSize: '0.8125rem', fontWeight: '600', color: '#065f46', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {customerDetails.name}
                </span>
                <button
                  onClick={onRemoveCustomer}
                  style={{
                    padding: '0.25rem',
                    border: 'none',
                    background: 'transparent',
                    color: '#dc2626',
                    cursor: 'pointer',
                    flexShrink: 0
                  }}
                >
                  <X size={14} />
                </button>
              </div>
            ) : (
              <button
                onClick={onOpenCustomer}
                style={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.375rem',
                  padding: '0.5rem 0.75rem',
                  border: '2px solid #e5e7eb',
                  borderRadius: '0.375rem',
                  background: '#ffffff',
                  cursor: 'pointer',
                  fontFamily: 'Inter, sans-serif',
                  minWidth: 0,
                  transition: 'all 0.2s ease'
                }}
                title="Add Customer (Optional)"
              >
                <User size={16} style={{ color: '#3b82f6', flexShrink: 0 }} />
                <span style={{ fontSize: '0.8125rem', fontWeight: '500', color: '#374151' }}>Customer</span>
              </button>
            )}

            {/* Discount Input */}
            <div style={{ display: 'flex', alignItems: 'center', width: '80px' }}>
              <input
                type="number"
                min="0"
                max="100"
                value={discount || ''}
                onChange={(e) => onSetDiscount(Number(e.target.value))}
                placeholder="% Off"
                title="Discount %"
                style={{
                  width: '100%',
                  padding: '0.5rem 0.5rem',
                  border: '2px solid #e5e7eb',
                  borderRadius: '0.375rem',
                  fontSize: '0.8125rem',
                  fontWeight: '500',
                  fontFamily: 'Inter, sans-serif',
                  textAlign: 'center'
                }}
              />
            </div>

            {/* VAT Toggle */}
            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.375rem',
                padding: '0.5rem 0.75rem',
                border: `2px solid ${applyVAT ? '#3b82f6' : '#e5e7eb'}`,
                borderRadius: '0.375rem',
                background: applyVAT ? '#dbeafe' : '#ffffff',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                transition: 'all 0.2s ease'
              }}
              title="Apply 7.5% VAT"
            >
              <span style={{ fontSize: '0.8125rem', fontWeight: '600', color: applyVAT ? '#2563eb' : '#374151' }}>VAT</span>
              <input
                type="checkbox"
                checked={applyVAT}
                onChange={(e) => onSetApplyVAT(e.target.checked)}
                style={{ width: '14px', height: '14px', cursor: 'pointer' }}
              />
            </label>
          </div>

          {/* Totals - Compact */}
          <div style={{ padding: '0.75rem', background: '#ffffff', borderRadius: '0.375rem', marginBottom: '0.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
              <span style={{ fontSize: '0.75rem', color: '#6b7280' }}>Subtotal:</span>
              <span style={{ fontSize: '0.75rem', fontWeight: '600', color: '#1f2937' }}>{formatCurrency(subtotal)}</span>
            </div>

            {applyVAT && (
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                <span style={{ fontSize: '0.75rem', color: '#6b7280' }}>VAT:</span>
                <span style={{ fontSize: '0.75rem', fontWeight: '600', color: '#1f2937' }}>{formatCurrency(vat)}</span>
              </div>
            )}

            {discount > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                <span style={{ fontSize: '0.75rem', color: '#10b981' }}>Discount ({discount}%):</span>
                <span style={{ fontSize: '0.75rem', fontWeight: '600', color: '#10b981' }}>
                  -{formatCurrency((subtotal + vat) * (discount / 100))}
                </span>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '0.5rem', borderTop: '2px solid #e5e7eb' }}>
              <span style={{ fontSize: '0.875rem', fontWeight: '700', color: '#1f2937' }}>Total:</span>
              <span style={{ fontSize: '1rem', fontWeight: '700', color: '#3b82f6' }}>{formatCurrency(total)}</span>
            </div>
          </div>

          {/* Hold and Checkout Buttons */}
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
            <button
              onClick={onHoldCart}
              style={{
                flex: 1,
                padding: '0.75rem',
                border: 'none',
                borderRadius: '0.375rem',
                background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                color: '#ffffff',
                fontSize: '0.875rem',
                fontWeight: '700',
                cursor: 'pointer',
                transition: 'all 0.3s ease',
                fontFamily: 'Inter, sans-serif',
                boxShadow: '0 2px 4px rgba(245, 158, 11, 0.3)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.375rem'
              }}
            >
              <Pause size={14} />
              Hold
            </button>
            <button
              onClick={onCheckout}
              style={{
                flex: 2,
                padding: '0.75rem',
                border: 'none',
                borderRadius: '0.375rem',
                background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                color: '#ffffff',
                fontSize: '0.875rem',
                fontWeight: '700',
                cursor: 'pointer',
                transition: 'all 0.3s ease',
                fontFamily: 'Inter, sans-serif',
                boxShadow: '0 2px 4px rgba(59, 130, 246, 0.3)'
              }}
            >
              Checkout
            </button>
          </div>


        </div>
      )}

      <style>
        {`
          .cart-container {
            width: 100%;
            height: 100%;
            padding: 1rem;
            box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
            display: flex;
            flex-direction: column;
            border-left: 1px solid rgba(59, 130, 246, 0.2);
            max-height: 100vh;
            overflow-y: hidden;
            background: rgba(255, 255, 255, 0.95);
            backdrop-filter: blur(20px);
            font-family: Inter, system-ui, sans-serif;
          }

          .cart-header {
            padding: 0.75rem;
            border-bottom: 1px solid #e5e7eb;
            background: #f9fafb;
          }

          .cart-header-row {
            display: flex;
            align-items: center;
            justify-content: space-between;
            margin-bottom: 0.5rem;
          }

          .cart-title {
            display: flex;
            align-items: center;
            gap: 0.5rem;
            flex: 1;
          }

          .cart-title h2 {
            font-size: 1rem;
            font-weight: 700;
            color: #1f2937;
            margin: 0;
          }

          .cart-clear-btn {
            padding: 0.25rem;
            border: none;
            border-radius: 0.375rem;
            background: #fee2e2;
            color: #dc2626;
            cursor: pointer;
            transition: all 0.3s ease;
          }

          .cart-close-btn {
            display: none;
            padding: 0.25rem;
            border: none;
            border-radius: 0.375rem;
            background: #f3f4f6;
            color: #6b7280;
            cursor: pointer;
            margin-right: 0.5rem;
          }

          .cart-nav-buttons {
            display: flex;
            justify-content: center;
            gap: 0.5rem;
            width: 100%;
          }

          .cart-nav-btn {
            flex: 1;
            max-width: 80px;
            padding: 0.5rem 0.75rem;
            border: 1px solid #e5e7eb;
            border-radius: 0.375rem;
            background: #ffffff;
            cursor: pointer;
            transition: all 0.2s ease;
            display: flex;
            align-items: center;
            justify-content: center;
          }

          .cart-nav-btn:hover {
            background: #f3f4f6;
            border-color: #d1d5db;
          }

          @media (max-width: 768px) {
            .cart-container {
              border-left: none;
              padding: 0.75rem;
            }

            .cart-close-btn {
              display: flex;
              align-items: center;
              justify-content: center;
              padding: 0.5rem;
              min-width: 44px;
              min-height: 44px;
            }

            .cart-nav-btn {
              padding: 0.75rem;
              min-width: 44px;
              min-height: 44px;
            }

            .cart-nav-btn span {
              font-size: 0.6875rem;
            }

            .cart-clear-btn {
              padding: 0.5rem;
              min-width: 44px;
              min-height: 44px;
            }
          }

          /* Cart item mobile improvements */
          @media (max-width: 480px) {
            .cart-container {
              padding: 0.5rem;
            }
          }
        `}
      </style>
    </div>
  );
}

function CartItem({ item, onUpdateQty, onRemove }) {
  const itemTotal = (item.price + (item.modifierCost || 0)) * item.cartQty;

  return (
    <div
      style={{
        padding: '0.5rem',
        border: '1px solid #e5e7eb',
        borderRadius: '0.25rem',
        background: '#ffffff'
      }}
    >
      {/* Single row layout for compact view */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        {/* Item Info */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <h4 style={{
            fontSize: '0.75rem',
            fontWeight: '600',
            color: '#1f2937',
            margin: 0,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis'
          }}>
            {item.name}
          </h4>
          <p style={{ fontSize: '0.625rem', color: '#6b7280', margin: '0.125rem 0 0 0' }}>
            {formatCurrency(item.price)} × {item.cartQty}
          </p>

          {/* Modifiers - Compact */}
          {item.selectedModifiers && item.selectedModifiers.length > 0 && (
            <p style={{ fontSize: '0.5625rem', color: '#8b5cf6', margin: '0.125rem 0 0 0' }}>
              + {item.selectedModifiers.flatMap(m => m.selectedOptions.map(o => o.optionName)).join(', ')}
            </p>
          )}
        </div>

        {/* Qty Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
          <button
            onClick={() => onUpdateQty(item._id, item.cartQty - 1, item.cartItemId)}
            style={{
              width: '22px',
              height: '22px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '1px solid #e5e7eb',
              borderRadius: '0.25rem',
              background: '#f9fafb',
              cursor: 'pointer'
            }}
          >
            <Minus size={10} />
          </button>
          <span style={{ width: '20px', textAlign: 'center', fontWeight: '600', fontSize: '0.6875rem' }}>
            {item.cartQty}
          </span>
          <button
            onClick={() => onUpdateQty(item._id, item.cartQty + 1, item.cartItemId)}
            style={{
              width: '22px',
              height: '22px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '1px solid #e5e7eb',
              borderRadius: '0.25rem',
              background: '#f9fafb',
              cursor: 'pointer'
            }}
          >
            <Plus size={10} />
          </button>
        </div>

        {/* Total */}
        <span style={{ fontSize: '0.75rem', fontWeight: '700', color: '#1f2937', minWidth: '60px', textAlign: 'right' }}>
          {formatCurrency(itemTotal)}
        </span>

        {/* Delete */}
        <button
          onClick={() => onRemove(item._id, item.cartItemId)}
          style={{
            padding: '0.25rem',
            border: 'none',
            background: 'transparent',
            color: '#dc2626',
            cursor: 'pointer'
          }}
        >
          <Trash2 size={12} />
        </button>
      </div>
    </div>
  );
}

export default Cart;