// src/components/kiosk/QuickSell/OrdersModal.jsx
import { useState } from 'react';
import { formatCurrency } from '../../../utils/formatters';
import { X, Printer, Search, Calendar, Loader, Clock, ShoppingCart } from 'lucide-react';

function OrdersModal({ orders, heldCarts = [], onReprint, onRecallCart, onDeleteHeldCart, onClose, loading = false }) {
  const [activeTab, setActiveTab] = useState('orders'); // 'orders' or 'held'
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFilter, setDateFilter] = useState('');

  const filteredOrders = orders.filter(order => {
    const matchesSearch = !searchTerm || 
      order.customer?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order._id?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesDate = !dateFilter ||
      new Date(order.createdAt).toLocaleDateString() === new Date(dateFilter).toLocaleDateString();
    
    return matchesSearch && matchesDate;
  });

  const sortedOrders = [...filteredOrders].sort((a, b) => 
    new Date(b.createdAt) - new Date(a.createdAt)
  );

  const filteredHeldCarts = heldCarts.filter(heldCart => {
    if (!searchTerm) return true;
    const matchesCustomer = heldCart.customerDetails?.name?.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesCustomer;
  });

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
          maxWidth: '60rem',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column'
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
          <div>
            <h2 style={{ fontSize: '1.5rem', fontWeight: '700', color: '#1f2937', margin: 0 }}>
              {activeTab === 'orders' ? 'Order History' : 'Held Carts'}
            </h2>
            <p style={{ fontSize: '0.875rem', color: '#6b7280', marginTop: '0.25rem', margin: '0.25rem 0 0 0' }}>
              {loading ? 'Loading...' : activeTab === 'orders' ? `${sortedOrders.length} order(s) found` : `${filteredHeldCarts.length} cart(s) on hold`}
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

        {/* Tabs */}
        <div style={{ display: 'flex', borderBottom: '2px solid #e5e7eb', background: '#f9fafb' }}>
          <button
            onClick={() => setActiveTab('orders')}
            style={{
              flex: 1,
              padding: '1rem',
              border: 'none',
              background: activeTab === 'orders' ? '#ffffff' : 'transparent',
              borderBottom: activeTab === 'orders' ? '2px solid #3b82f6' : '2px solid transparent',
              color: activeTab === 'orders' ? '#3b82f6' : '#6b7280',
              fontWeight: '600',
              fontSize: '0.875rem',
              cursor: 'pointer',
              fontFamily: 'Inter, sans-serif',
              transition: 'all 0.2s',
              marginBottom: '-2px'
            }}
          >
            📋 Completed Orders
          </button>
          <button
            onClick={() => setActiveTab('held')}
            style={{
              flex: 1,
              padding: '1rem',
              border: 'none',
              background: activeTab === 'held' ? '#ffffff' : 'transparent',
              borderBottom: activeTab === 'held' ? '2px solid #3b82f6' : '2px solid transparent',
              color: activeTab === 'held' ? '#3b82f6' : '#6b7280',
              fontWeight: '600',
              fontSize: '0.875rem',
              cursor: 'pointer',
              fontFamily: 'Inter, sans-serif',
              transition: 'all 0.2s',
              marginBottom: '-2px',
              position: 'relative'
            }}
          >
            🛒 Held Carts
            {heldCarts.length > 0 && (
              <span style={{
                position: 'absolute',
                top: '0.5rem',
                right: '1rem',
                background: '#ef4444',
                color: '#ffffff',
                fontSize: '0.75rem',
                fontWeight: '700',
                padding: '0.125rem 0.5rem',
                borderRadius: '9999px',
                minWidth: '1.25rem',
                textAlign: 'center'
              }}>
                {heldCarts.length}
              </span>
            )}
          </button>
        </div>

        {/* Filters */}
        {!loading && (
          <div style={{ padding: '1rem', borderBottom: '1px solid #e5e7eb', background: '#f9fafb' }}>
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <div style={{ flex: 1, position: 'relative' }}>
                <Search size={18} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: '#9ca3af', pointerEvents: 'none' }} />
                <input
                  type="text"
                  placeholder={activeTab === 'orders' ? "Search by customer name or order ID..." : "Search by customer name..."}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  style={{
                    width: '100%',
                    paddingLeft: '2.5rem',
                    paddingRight: '0.75rem',
                    paddingTop: '0.75rem',
                    paddingBottom: '0.75rem',
                    border: '1px solid #e5e7eb',
                    borderRadius: '0.5rem',
                    fontSize: '0.875rem',
                    fontFamily: 'Inter, sans-serif',
                    boxSizing: 'border-box'
                  }}
                />
              </div>
              {activeTab === 'orders' && (
                <div style={{ position: 'relative' }}>
                  <Calendar size={18} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: '#9ca3af', pointerEvents: 'none' }} />
                  <input
                    type="date"
                    value={dateFilter}
                    onChange={(e) => setDateFilter(e.target.value)}
                    style={{
                      paddingLeft: '2.5rem',
                      paddingRight: '0.75rem',
                      paddingTop: '0.75rem',
                      paddingBottom: '0.75rem',
                      border: '1px solid #e5e7eb',
                      borderRadius: '0.5rem',
                      fontSize: '0.875rem',
                      fontFamily: 'Inter, sans-serif'
                    }}
                  />
                </div>
              )}
              {(searchTerm || dateFilter) && (
                <button
                  onClick={() => {
                    setSearchTerm('');
                    setDateFilter('');
                  }}
                  style={{
                    padding: '0.75rem 1.5rem',
                    border: '1px solid #e5e7eb',
                    borderRadius: '0.5rem',
                    background: '#ffffff',
                    color: '#6b7280',
                    fontSize: '0.875rem',
                    fontWeight: '600',
                    cursor: 'pointer',
                    fontFamily: 'Inter, sans-serif'
                  }}
                >
                  Clear
                </button>
              )}
            </div>
          </div>
        )}

        {/* Content Area */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '1rem' }}>
          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
              <Loader size={64} style={{ color: '#3b82f6', animation: 'spin 1s linear infinite' }} />
              <p style={{ fontSize: '1.125rem', fontWeight: '600', color: '#6b7280', margin: '1rem 0 0 0' }}>Loading orders...</p>
            </div>
          ) : activeTab === 'orders' ? (
            // COMPLETED ORDERS TAB
            sortedOrders.length === 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                <Search size={64} style={{ color: '#d1d5db', marginBottom: '1rem' }} />
                <p style={{ fontSize: '1.125rem', fontWeight: '600', color: '#6b7280', margin: 0 }}>No orders found</p>
                <p style={{ fontSize: '0.875rem', color: '#9ca3af', marginTop: '0.5rem' }}>Try adjusting your filters</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {sortedOrders.map(order => (
                  <OrderCard key={order._id} order={order} onReprint={onReprint} />
                ))}
              </div>
            )
          ) : (
            // HELD CARTS TAB
            filteredHeldCarts.length === 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                <ShoppingCart size={64} style={{ color: '#d1d5db', marginBottom: '1rem' }} />
                <p style={{ fontSize: '1.125rem', fontWeight: '600', color: '#6b7280', margin: 0 }}>No held carts</p>
                <p style={{ fontSize: '0.875rem', color: '#9ca3af', marginTop: '0.5rem' }}>Held carts will appear here</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {filteredHeldCarts.map(heldCart => (
                  <HeldCartCard 
                    key={heldCart.id} 
                    heldCart={heldCart} 
                    onRecall={onRecallCart}
                    onDelete={onDeleteHeldCart}
                  />
                ))}
              </div>
            )
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '1rem', borderTop: '1px solid #e5e7eb', background: '#f9fafb' }}>
          <button
            onClick={onClose}
            style={{
              width: '100%',
              padding: '0.75rem',
              border: 'none',
              borderRadius: '0.5rem',
              background: '#3b82f6',
              color: '#ffffff',
              fontSize: '0.875rem',
              fontWeight: '600',
              cursor: 'pointer',
              fontFamily: 'Inter, sans-serif'
            }}
          >
            Close
          </button>
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

function OrderCard({ order, onReprint }) {
  const [expanded, setExpanded] = useState(false);
  
  const date = new Date(order.createdAt);
  const dateStr = date.toLocaleDateString('en-GB');
  const timeStr = date.toLocaleTimeString('en-US', { 
    hour: '2-digit', 
    minute: '2-digit',
    hour12: true 
  });

  const orderTotal = order.totalAmount || order.total || 0;
  const orderSubtotal = order.subtotal || 0;
  const orderVat = order.vat || 0;
  const orderDiscount = order.discount || 0;

  return (
    <div
      style={{
        border: '1px solid #e5e7eb',
        borderRadius: '0.75rem',
        background: '#ffffff',
        overflow: 'hidden'
      }}
    >
      <div
        onClick={() => setExpanded(!expanded)}
        style={{
          padding: '1rem',
          cursor: 'pointer',
          background: expanded ? '#f9fafb' : '#ffffff',
          transition: 'background 0.2s'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
              <span style={{ fontSize: '0.75rem', fontFamily: 'monospace', color: '#6b7280' }}>
                #{order._id?.slice(-8)}
              </span>
              {order.customer?.name && (
                <span style={{ fontSize: '0.875rem', fontWeight: '600', color: '#1f2937' }}>
                  {order.customer.name}
                </span>
              )}
              <span
                style={{
                  padding: '0.25rem 0.75rem',
                  fontSize: '0.75rem',
                  fontWeight: '600',
                  borderRadius: '9999px',
                  background: order.paymentMethod === 'cash' ? '#d1fae5' : order.paymentMethod === 'card' ? '#dbeafe' : '#e9d5ff',
                  color: order.paymentMethod === 'cash' ? '#065f46' : order.paymentMethod === 'card' ? '#1e40af' : '#6b21a8'
                }}
              >
                {order.paymentMethod === 'bank_transfer' ? 'Bank' : order.paymentMethod}
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', fontSize: '0.875rem', color: '#6b7280' }}>
              <span>{dateStr}</span>
              <span>{timeStr}</span>
              <span>{order.items?.length || 0} item(s)</span>
            </div>
          </div>
          <div style={{ textAlign: 'right', display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div>
              <p style={{ fontSize: '0.75rem', color: '#6b7280', margin: '0 0 0.25rem 0' }}>Total</p>
              <p style={{ fontSize: '1.25rem', fontWeight: '700', color: '#1f2937', margin: 0 }}>
                {formatCurrency(orderTotal)}
              </p>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onReprint(order);
              }}
              style={{
                padding: '0.75rem',
                border: 'none',
                borderRadius: '0.5rem',
                background: '#3b82f6',
                color: '#ffffff',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem'
              }}
            >
              <Printer size={16} />
            </button>
          </div>
        </div>
      </div>

      {expanded && (
        <div style={{ padding: '1rem', borderTop: '1px solid #e5e7eb', background: '#f9fafb' }}>
          <h4 style={{ fontSize: '0.875rem', fontWeight: '600', color: '#374151', margin: '0 0 0.75rem 0' }}>
            Order Items:
          </h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1rem' }}>
            {(order.items || []).map((item, idx) => (
              <div
                key={idx}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  padding: '0.75rem',
                  background: '#ffffff',
                  borderRadius: '0.5rem',
                  border: '1px solid #e5e7eb'
                }}
              >
                <span style={{ fontSize: '0.875rem', color: '#1f2937' }}>
                  {item.quantity}x {item.name}
                </span>
                <span style={{ fontSize: '0.875rem', fontWeight: '600', color: '#1f2937' }}>
                  {formatCurrency(item.price * item.quantity)}
                </span>
              </div>
            ))}
          </div>

          <div
            style={{
              padding: '0.75rem',
              background: '#ffffff',
              borderRadius: '0.5rem',
              border: '1px solid #e5e7eb'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
              <span style={{ fontSize: '0.875rem', color: '#6b7280' }}>Subtotal:</span>
              <span style={{ fontSize: '0.875rem', fontWeight: '600', color: '#1f2937' }}>
                {formatCurrency(orderSubtotal)}
              </span>
            </div>
            {order.applyVAT && orderVat > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                <span style={{ fontSize: '0.875rem', color: '#6b7280' }}>VAT (7.5%):</span>
                <span style={{ fontSize: '0.875rem', fontWeight: '600', color: '#1f2937' }}>
                  {formatCurrency(orderVat)}
                </span>
              </div>
            )}
            {orderDiscount > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                <span style={{ fontSize: '0.875rem', color: '#10b981' }}>Discount ({orderDiscount}%):</span>
                <span style={{ fontSize: '0.875rem', fontWeight: '600', color: '#10b981' }}>
                  -{formatCurrency((orderSubtotal + orderVat) * (orderDiscount / 100))}
                </span>
              </div>
            )}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                paddingTop: '0.75rem',
                borderTop: '2px solid #e5e7eb'
              }}
            >
              <span style={{ fontSize: '1rem', fontWeight: '700', color: '#1f2937' }}>Total:</span>
              <span style={{ fontSize: '1.125rem', fontWeight: '700', color: '#3b82f6' }}>
                {formatCurrency(orderTotal)}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function HeldCartCard({ heldCart, onRecall, onDelete }) {
  const [expanded, setExpanded] = useState(false);
  
  const heldTime = new Date(heldCart.timestamp);
  const timeAgo = getTimeAgo(heldCart.timestamp);
  const timeStr = heldTime.toLocaleTimeString('en-US', { 
    hour: '2-digit', 
    minute: '2-digit',
    hour12: true 
  });

  const subtotal = heldCart.cart.reduce((sum, item) => sum + (item.price * item.cartQty), 0);
  const vat = heldCart.applyVAT ? subtotal * 0.075 : 0;
  const discountAmount = (subtotal + vat) * (heldCart.discount / 100);
  const total = subtotal + vat - discountAmount;

  return (
    <div
      style={{
        border: '2px solid #fbbf24',
        borderRadius: '0.75rem',
        background: '#fffbeb',
        overflow: 'hidden'
      }}
    >
      <div
        onClick={() => setExpanded(!expanded)}
        style={{
          padding: '1rem',
          cursor: 'pointer',
          background: expanded ? '#fef3c7' : '#fffbeb',
          transition: 'background 0.2s'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
              <Clock size={16} style={{ color: '#f59e0b' }} />
              <span style={{ fontSize: '0.875rem', fontWeight: '600', color: '#92400e' }}>
                {heldCart.customerDetails?.name || 'Walk-in Customer'}
              </span>
              <span
                style={{
                  padding: '0.25rem 0.75rem',
                  fontSize: '0.75rem',
                  fontWeight: '600',
                  borderRadius: '9999px',
                  background: '#fef3c7',
                  color: '#92400e'
                }}
              >
                {heldCart.section || 'General'}
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', fontSize: '0.875rem', color: '#92400e' }}>
              <span>{timeAgo}</span>
              <span>{timeStr}</span>
              <span>{heldCart.cart.length} item(s)</span>
            </div>
          </div>
          <div style={{ textAlign: 'right', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div>
              <p style={{ fontSize: '0.75rem', color: '#92400e', margin: '0 0 0.25rem 0' }}>Total</p>
              <p style={{ fontSize: '1.25rem', fontWeight: '700', color: '#92400e', margin: 0 }}>
                {formatCurrency(total)}
              </p>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onRecall(heldCart.id);
              }}
              style={{
                padding: '0.75rem 1rem',
                border: 'none',
                borderRadius: '0.5rem',
                background: '#10b981',
                color: '#ffffff',
                cursor: 'pointer',
                fontSize: '0.875rem',
                fontWeight: '600',
                fontFamily: 'Inter, sans-serif'
              }}
            >
              Recall
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete(heldCart.id);
              }}
              style={{
                padding: '0.75rem',
                border: 'none',
                borderRadius: '0.5rem',
                background: '#ef4444',
                color: '#ffffff',
                cursor: 'pointer'
              }}
            >
              <X size={16} />
            </button>
          </div>
        </div>
      </div>

      {expanded && (
        <div style={{ padding: '1rem', borderTop: '2px solid #fbbf24', background: '#fef3c7' }}>
          <h4 style={{ fontSize: '0.875rem', fontWeight: '600', color: '#78350f', margin: '0 0 0.75rem 0' }}>
            Cart Items:
          </h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1rem' }}>
            {heldCart.cart.map((item, idx) => (
              <div
                key={idx}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  padding: '0.75rem',
                  background: '#ffffff',
                  borderRadius: '0.5rem',
                  border: '1px solid #fbbf24'
                }}
              >
                <span style={{ fontSize: '0.875rem', color: '#1f2937' }}>
                  {item.cartQty}x {item.name}
                </span>
                <span style={{ fontSize: '0.875rem', fontWeight: '600', color: '#1f2937' }}>
                  {formatCurrency(item.price * item.cartQty)}
                </span>
              </div>
            ))}
          </div>

          <div
            style={{
              padding: '0.75rem',
              background: '#ffffff',
              borderRadius: '0.5rem',
              border: '2px solid #fbbf24'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
              <span style={{ fontSize: '0.875rem', color: '#6b7280' }}>Subtotal:</span>
              <span style={{ fontSize: '0.875rem', fontWeight: '600', color: '#1f2937' }}>
                {formatCurrency(subtotal)}
              </span>
            </div>
            {heldCart.applyVAT && vat > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                <span style={{ fontSize: '0.875rem', color: '#6b7280' }}>VAT (7.5%):</span>
                <span style={{ fontSize: '0.875rem', fontWeight: '600', color: '#1f2937' }}>
                  {formatCurrency(vat)}
                </span>
              </div>
            )}
            {heldCart.discount > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                <span style={{ fontSize: '0.875rem', color: '#10b981' }}>Discount ({heldCart.discount}%):</span>
                <span style={{ fontSize: '0.875rem', fontWeight: '600', color: '#10b981' }}>
                  -{formatCurrency(discountAmount)}
                </span>
              </div>
            )}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                paddingTop: '0.75rem',
                borderTop: '2px solid #fbbf24'
              }}
            >
              <span style={{ fontSize: '1rem', fontWeight: '700', color: '#1f2937' }}>Total:</span>
              <span style={{ fontSize: '1.125rem', fontWeight: '700', color: '#f59e0b' }}>
                {formatCurrency(total)}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Helper function to get "time ago" string
function getTimeAgo(timestamp) {
  const now = Date.now();
  const diff = now - timestamp;
  const minutes = Math.floor(diff / 60000);
  
  if (minutes < 1) return 'Just now';
  if (minutes === 1) return '1 min ago';
  if (minutes < 60) return `${minutes} mins ago`;
  
  const hours = Math.floor(minutes / 60);
  if (hours === 1) return '1 hour ago';
  return `${hours} hours ago`;
}

export default OrdersModal;