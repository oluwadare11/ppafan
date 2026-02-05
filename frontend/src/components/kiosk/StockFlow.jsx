// src/components/kiosk/StockFlow.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTenant } from '../../context/TenantProvider';
import { useKioskAuth } from '../../hooks/useKioskAuth';
import { Package, Search, ShoppingCart, X, Check, Barcode, Plus, Minus, Trash2, ChevronRight } from 'lucide-react';
import KioskHeader from './KioskHeader';

/**
 * StockFlow - Inventory Checkout System for Kiosk Mode
 * Deep green theme (#065f46, #047857, #059669, #10b981)
 * Cart follows QuickSell design: 30% width, right sidebar
 */
const StockFlowContent = () => {
  const { tenantInfo, makeRequest, loading: tenantLoading } = useTenant();
  const navigate = useNavigate();

  // State Management
  const [items, setItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [staff, setStaff] = useState([]);
  const [cart, setCart] = useState([]);

  const [filters, setFilters] = useState({
    search: '',
    category: '',
  });

  const [checkoutForm, setCheckoutForm] = useState({
    staffId: '',
    reason: 'operational',
    notes: ''
  });

  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [barcodeInput, setBarcodeInput] = useState('');
  const [showMobileCart, setShowMobileCart] = useState(false);

  // Fetch Functions with kiosk authentication error handling
  const fetchItems = async () => {
    try {
      const response = await makeRequest('/api/inventory', {
        params: { ...filters, limit: 100 }
      });
      // Handle response structure: { items: [...], pagination: {...} }
      const itemsData = Array.isArray(response) ? response : (response.items || []);
      setItems(itemsData.filter(item => item.quantity > 0));
    } catch (err) {
      console.error('Error fetching items:', err);
      // Redirect to kiosk login on auth error
      if (err.message?.includes('401') || err.message?.includes('Authentication expired')) {
        localStorage.removeItem('kioskUser');
        navigate('/kiosk/login');
      }
    }
  };

  const fetchCategories = async () => {
    try {
      const response = await makeRequest('/api/categories');
      // Handle response structure: could be array or { data: [...] }
      const categoriesData = Array.isArray(response) ? response : (response.data || response.categories || []);
      setCategories(categoriesData);
    } catch (err) {
      console.error('Error fetching categories:', err);
      if (err.message?.includes('401') || err.message?.includes('Authentication expired')) {
        localStorage.removeItem('kioskUser');
        navigate('/kiosk/login');
      }
    }
  };

  const fetchStaff = async () => {
    try {
      const response = await makeRequest('/api/staff');
      // Handle response structure: could be array or { data: [...] } or { staff: [...] }
      const staffData = Array.isArray(response) ? response : (response.data || response.staff || []);
      setStaff(staffData);
    } catch (err) {
      console.error('Error fetching staff:', err);
      if (err.message?.includes('401') || err.message?.includes('Authentication expired')) {
        localStorage.removeItem('kioskUser');
        navigate('/kiosk/login');
      }
    }
  };

  useEffect(() => {
    if (!tenantLoading && tenantInfo) {
      fetchItems();
      fetchCategories();
      fetchStaff();
    }
  }, [tenantLoading, tenantInfo]);

  useEffect(() => {
    if (!tenantLoading && tenantInfo) {
      fetchItems();
    }
  }, [filters]);

  // Cart Functions
  const addToCart = (item, quantity = 1) => {
    const existingIndex = cart.findIndex(c => c._id === item._id);
    if (existingIndex >= 0) {
      const newCart = [...cart];
      const newQty = newCart[existingIndex].cartQty + quantity;
      newCart[existingIndex].cartQty = Math.min(newQty, item.quantity);
      setCart(newCart);
    } else {
      setCart([...cart, { ...item, cartQty: Math.min(quantity, item.quantity) }]);
    }
  };

  const updateCartQty = (itemId, newQty) => {
    if (newQty <= 0) {
      removeFromCart(itemId);
    } else {
      setCart(cart.map(item => {
        if (item._id === itemId) {
          const maxQty = items.find(i => i._id === itemId)?.quantity || item.quantity;
          return { ...item, cartQty: Math.min(newQty, maxQty) };
        }
        return item;
      }));
    }
  };

  const removeFromCart = (itemId) => {
    setCart(cart.filter(item => item._id !== itemId));
  };

  const clearCart = () => {
    if (window.confirm('Clear entire cart?')) {
      setCart([]);
      setCheckoutForm({ staffId: '', reason: 'operational', notes: '' });
    }
  };

  // Barcode Search
  const handleBarcodeSearch = async (barcode) => {
    if (!barcode.trim()) return;

    const found = items.find(item => item.barcode === barcode.trim());
    if (found) {
      addToCart(found, 1);
      setBarcodeInput('');
    } else {
      alert(`No item found with barcode: ${barcode}`);
    }
  };

  // Checkout
  const handleCheckout = async () => {
    if (cart.length === 0) {
      alert('Cart is empty');
      return;
    }

    if (!checkoutForm.staffId) {
      alert('Please select a staff member');
      return;
    }

    setLoading(true);
    try {
      const checkoutData = {
        items: cart.map(item => ({
          itemId: item._id,
          quantity: item.cartQty
        })),
        ...checkoutForm
      };

      await makeRequest('/api/inventory-checkouts', {
        method: 'POST',
        data: checkoutData
      });

      setSuccessMessage('Checkout successful!');
      setTimeout(() => setSuccessMessage(''), 3000);

      setCart([]);
      setCheckoutForm({ staffId: '', reason: 'operational', notes: '' });

      // Refresh data
      fetchItems();
    } catch (err) {
      console.error('Checkout error:', err);
      alert('Checkout failed: ' + err.message);
      if (err.message?.includes('401') || err.message?.includes('Authentication expired')) {
        localStorage.removeItem('kioskUser');
        navigate('/kiosk/login');
      }
    } finally {
      setLoading(false);
    }
  };

  // Filter items
  const filteredItems = items.filter(item => {
    const matchesSearch = filters.search
      ? item.name.toLowerCase().includes(filters.search.toLowerCase()) ||
        item.sku?.toLowerCase().includes(filters.search.toLowerCase()) ||
        item.barcode?.includes(filters.search)
      : true;

    const matchesCategory = filters.category
      ? (item.category?._id === filters.category || item.category === filters.category)
      : true;

    return matchesSearch && matchesCategory;
  });

  // Loading state
  if (tenantLoading || !tenantInfo) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #064e3b 0%, #065f46 50%, #047857 100%)'
      }}>
        <div style={{
          textAlign: 'center',
          color: '#ffffff'
        }}>
          <div style={{
            margin: '0 auto 1rem',
            width: '48px',
            height: '48px',
            border: '4px solid rgba(255, 255, 255, 0.3)',
            borderTopColor: '#ffffff',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite'
          }}></div>
          <p style={{ fontSize: '1.125rem', fontWeight: '600' }}>Loading Inventory System...</p>
          <style>{`
            @keyframes spin {
              to { transform: rotate(360deg); }
            }
          `}</style>
        </div>
      </div>
    );
  }

  // Calculate cart total
  const getCartTotal = () => cart.reduce((sum, item) => sum + item.cartQty, 0);

  return (
    <div className="stockflow-container">
      {/* Mobile Cart Toggle Button */}
      <button
        className="mobile-cart-toggle"
        onClick={() => setShowMobileCart(!showMobileCart)}
      >
        <Package size={20} />
        {cart.length > 0 && (
          <span className="cart-badge">{getCartTotal()}</span>
        )}
        <span className="cart-label">Checkout</span>
      </button>

      {/* Mobile Cart Overlay */}
      {showMobileCart && (
        <div
          className="mobile-cart-overlay"
          onClick={() => setShowMobileCart(false)}
        />
      )}

      {/* Main Content */}
      <div className="stockflow-main">
        <KioskHeader />

        {/* Success Notification */}
        {successMessage && (
          <div
            style={{
              position: 'fixed',
              top: '5rem',
              right: '2rem',
              zIndex: 1000,
              background: 'linear-gradient(135deg, #059669 0%, #047857 100%)',
              color: '#ffffff',
              padding: '1rem 1.5rem',
              borderRadius: '0.75rem',
              boxShadow: '0 8px 16px rgba(0, 0, 0, 0.2)',
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              animation: 'slideIn 0.3s ease'
            }}
          >
            <Check size={20} />
            <span style={{ fontWeight: '600' }}>{successMessage}</span>
          </div>
        )}

        {/* Search and Filter Bar */}
        <div className="search-filter-bar">
          {/* Barcode Scanner */}
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <div style={{ flex: 1, position: 'relative' }}>
              <Barcode
                size={18}
                style={{
                  position: 'absolute',
                  left: '0.75rem',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: '#047857'
                }}
              />
              <input
                type="text"
                placeholder="Scan or enter barcode..."
                value={barcodeInput}
                onChange={(e) => setBarcodeInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleBarcodeSearch(barcodeInput)}
                style={{
                  width: '100%',
                  padding: '0.625rem 0.75rem 0.625rem 2.5rem',
                  border: '2px solid #d1fae5',
                  borderRadius: '0.5rem',
                  fontSize: '0.875rem',
                  outline: 'none',
                  transition: 'all 0.2s',
                  fontFamily: 'Inter, sans-serif'
                }}
                onFocus={(e) => e.target.style.borderColor = '#059669'}
                onBlur={(e) => e.target.style.borderColor = '#d1fae5'}
              />
            </div>
            <button
              onClick={() => handleBarcodeSearch(barcodeInput)}
              style={{
                padding: '0.625rem 1rem',
                background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                border: 'none',
                borderRadius: '0.5rem',
                color: '#ffffff',
                fontSize: '0.875rem',
                fontWeight: '600',
                cursor: 'pointer',
                transition: 'all 0.2s',
                fontFamily: 'Inter, sans-serif',
                whiteSpace: 'nowrap'
              }}
              onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
              onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
            >
              Scan
            </button>
          </div>

          {/* Search */}
          <div style={{ position: 'relative' }}>
            <Search
              size={18}
              style={{
                position: 'absolute',
                left: '0.75rem',
                top: '50%',
                transform: 'translateY(-50%)',
                color: '#047857'
              }}
            />
            <input
              type="text"
              placeholder="Search items..."
              value={filters.search}
              onChange={(e) => setFilters({ ...filters, search: e.target.value })}
              style={{
                width: '100%',
                padding: '0.625rem 0.75rem 0.625rem 2.5rem',
                border: '2px solid #d1fae5',
                borderRadius: '0.5rem',
                fontSize: '0.875rem',
                outline: 'none',
                transition: 'all 0.2s',
                fontFamily: 'Inter, sans-serif'
              }}
              onFocus={(e) => e.target.style.borderColor = '#059669'}
              onBlur={(e) => e.target.style.borderColor = '#d1fae5'}
            />
          </div>

          {/* Category Filter */}
          <select
            value={filters.category}
            onChange={(e) => setFilters({ ...filters, category: e.target.value })}
            style={{
              padding: '0.625rem 0.75rem',
              border: '2px solid #d1fae5',
              borderRadius: '0.5rem',
              fontSize: '0.875rem',
              outline: 'none',
              cursor: 'pointer',
              background: '#ffffff',
              fontFamily: 'Inter, sans-serif'
            }}
          >
            <option value="">All Categories</option>
            {categories.map(cat => (
              <option key={cat._id} value={cat._id}>{cat.name}</option>
            ))}
          </select>
        </div>

        {/* Items Grid */}
        <div className="items-grid">
          {filteredItems.map((item) => {
            const stockLevel = item.quantity > 20 ? 'high' : item.quantity > 5 ? 'medium' : 'low';
            const stockColor = stockLevel === 'high' ? '#10b981' : stockLevel === 'medium' ? '#f59e0b' : '#ef4444';

            return (
              <div
                key={item._id}
                style={{
                  background: '#ffffff',
                  border: '2px solid #e5e7eb',
                  borderRadius: '0.75rem',
                  padding: '1rem',
                  transition: 'all 0.2s',
                  cursor: 'pointer'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.boxShadow = '0 8px 16px rgba(0, 0, 0, 0.1)';
                  e.currentTarget.style.borderColor = '#10b981';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.boxShadow = 'none';
                  e.currentTarget.style.borderColor = '#e5e7eb';
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '0.75rem' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '0.875rem', fontWeight: '700', color: '#1f2937', marginBottom: '0.25rem' }}>
                      {item.name}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>
                      SKU: {item.sku || 'N/A'}
                    </div>
                  </div>
                  <div
                    style={{
                      padding: '0.25rem 0.5rem',
                      borderRadius: '0.375rem',
                      background: `${stockColor}15`,
                      color: stockColor,
                      fontSize: '0.75rem',
                      fontWeight: '600'
                    }}
                  >
                    {item.quantity} in stock
                  </div>
                </div>

                {item.category && (
                  <div
                    style={{
                      display: 'inline-block',
                      padding: '0.25rem 0.5rem',
                      background: '#f0fdf4',
                      color: '#047857',
                      borderRadius: '0.375rem',
                      fontSize: '0.75rem',
                      fontWeight: '600',
                      marginBottom: '0.75rem'
                    }}
                  >
                    {typeof item.category === 'object' ? item.category.name : item.category}
                  </div>
                )}

                <button
                  onClick={() => addToCart(item, 1)}
                  style={{
                    width: '100%',
                    background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                    border: 'none',
                    borderRadius: '0.5rem',
                    padding: '0.625rem',
                    color: '#ffffff',
                    fontSize: '0.875rem',
                    fontWeight: '600',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    fontFamily: 'Inter, sans-serif'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.02)'}
                  onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
                >
                  Add to Cart
                </button>
              </div>
            );
          })}
        </div>

        {filteredItems.length === 0 && (
          <div
            style={{
              background: 'rgba(255, 255, 255, 0.95)',
              borderRadius: '0.75rem',
              padding: '3rem',
              textAlign: 'center',
              color: '#6b7280'
            }}
          >
            <Package size={48} style={{ margin: '0 auto 1rem', color: '#d1d5db' }} />
            <p style={{ margin: 0, fontSize: '1rem', fontWeight: '600' }}>No items found</p>
            <p style={{ margin: '0.5rem 0 0', fontSize: '0.875rem' }}>
              Try adjusting your search or filter criteria
            </p>
          </div>
        )}
      </div>

      {/* Cart Sidebar */}
      <div className={`stockflow-cart ${showMobileCart ? 'mobile-visible' : ''}`}>
        {/* Cart Header */}
        <div className="cart-header">
          <div className="cart-header-row">
            {/* Mobile Close Button */}
            <button
              onClick={() => setShowMobileCart(false)}
              className="cart-close-btn"
            >
              <ChevronRight size={20} />
            </button>
            <div className="cart-title">
              <Package size={20} style={{ color: '#059669' }} />
              <h2>Checkout ({cart.length} items)</h2>
            </div>
            {cart.length > 0 && (
              <button
                onClick={clearCart}
                className="cart-clear-btn"
                title="Clear all items"
              >
                <Trash2 size={14} />
              </button>
            )}
          </div>
        </div>

        {/* Cart Items */}
        <div
          style={{
            padding: '0.75rem',
            borderBottom: '1px solid #e5e7eb',
            minHeight: '200px',
            maxHeight: '35vh',
            overflowY: 'auto',
            flex: '1 1 auto'
          }}
        >
          {cart.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2rem 1rem', color: '#9ca3af' }}>
              <Package size={40} style={{ margin: '0 auto 0.75rem', color: '#d1d5db' }} />
              <p style={{ margin: 0, fontSize: '0.875rem', fontWeight: '600' }}>No items selected</p>
              <p style={{ margin: '0.5rem 0 0', fontSize: '0.75rem' }}>
                Select items from inventory to checkout
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {cart.map((item) => (
                <div
                  key={item._id}
                  style={{
                    background: '#ffffff',
                    border: '1px solid #e5e7eb',
                    borderRadius: '0.5rem',
                    padding: '0.625rem'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '0.5rem' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '0.8125rem', fontWeight: '600', color: '#1f2937', marginBottom: '0.125rem' }}>
                        {item.name}
                      </div>
                      <div style={{ fontSize: '0.6875rem', color: '#6b7280' }}>
                        Stock: {item.quantity}
                      </div>
                    </div>
                    <button
                      onClick={() => removeFromCart(item._id)}
                      style={{
                        padding: '0.25rem',
                        border: 'none',
                        background: 'transparent',
                        color: '#dc2626',
                        cursor: 'pointer'
                      }}
                      title="Remove item"
                    >
                      <X size={14} />
                    </button>
                  </div>

                  {/* Quantity Controls - Larger and more accessible */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    background: '#f0fdf4',
                    borderRadius: '0.5rem',
                    padding: '0.5rem'
                  }}>
                    <button
                      onClick={() => updateCartQty(item._id, item.cartQty - 1)}
                      style={{
                        padding: '0.5rem',
                        border: '2px solid #10b981',
                        borderRadius: '0.375rem',
                        background: '#ffffff',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        minWidth: '36px',
                        minHeight: '36px'
                      }}
                    >
                      <Minus size={16} style={{ color: '#059669' }} />
                    </button>
                    <input
                      type="number"
                      value={item.cartQty}
                      onChange={(e) => updateCartQty(item._id, parseInt(e.target.value) || 1)}
                      style={{
                        width: '3.5rem',
                        padding: '0.5rem',
                        border: '2px solid #10b981',
                        borderRadius: '0.375rem',
                        textAlign: 'center',
                        fontSize: '1rem',
                        fontWeight: '700',
                        color: '#065f46',
                        background: '#ffffff'
                      }}
                    />
                    <button
                      onClick={() => updateCartQty(item._id, item.cartQty + 1)}
                      style={{
                        padding: '0.5rem',
                        border: '2px solid #10b981',
                        borderRadius: '0.375rem',
                        background: '#ffffff',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        minWidth: '36px',
                        minHeight: '36px'
                      }}
                    >
                      <Plus size={16} style={{ color: '#059669' }} />
                    </button>
                    <div style={{
                      marginLeft: 'auto',
                      fontSize: '0.875rem',
                      fontWeight: '700',
                      background: '#10b981',
                      padding: '0.375rem 0.625rem',
                      borderRadius: '0.375rem',
                      color: '#ffffff'
                    }}>
                      {item.cartQty}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Checkout Form - Always visible when cart has items */}
        {cart.length > 0 && (
          <div
            style={{
              padding: '0.875rem',
              borderTop: '2px solid #10b981',
              background: 'linear-gradient(180deg, #f0fdf4 0%, #ffffff 100%)',
              flexShrink: 0,
              overflowY: 'auto',
              maxHeight: '50vh'
            }}
          >
            <div style={{
              fontSize: '0.9375rem',
              fontWeight: '700',
              color: '#064e3b',
              marginBottom: '0.875rem',
              paddingBottom: '0.5rem',
              borderBottom: '1px solid #d1fae5'
            }}>
              Checkout Details
            </div>

            {/* Requested By (Staff Selection) */}
            <div style={{ marginBottom: '0.75rem' }}>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '600', color: '#374151', marginBottom: '0.375rem' }}>
                Requested By *
              </label>
              <select
                value={checkoutForm.staffId}
                onChange={(e) => setCheckoutForm({ ...checkoutForm, staffId: e.target.value })}
                required
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  border: '2px solid #d1fae5',
                  borderRadius: '0.375rem',
                  fontSize: '0.8125rem',
                  outline: 'none',
                  fontFamily: 'Inter, sans-serif',
                  background: '#ffffff'
                }}
              >
                <option value="">Select staff member</option>
                {staff.map(member => (
                  <option key={member._id} value={member._id}>
                    {member.firstName} {member.lastName}{member.employeeId ? ` (${member.employeeId})` : ''}
                  </option>
                ))}
              </select>
            </div>

            {/* Reason */}
            <div style={{ marginBottom: '0.75rem' }}>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '600', color: '#374151', marginBottom: '0.375rem' }}>
                Reason *
              </label>
              <select
                value={checkoutForm.reason}
                onChange={(e) => setCheckoutForm({ ...checkoutForm, reason: e.target.value })}
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  border: '2px solid #d1fae5',
                  borderRadius: '0.375rem',
                  fontSize: '0.8125rem',
                  outline: 'none',
                  fontFamily: 'Inter, sans-serif',
                  background: '#ffffff'
                }}
              >
                <option value="operational">Operational Use</option>
                <option value="maintenance">Maintenance</option>
                <option value="project">Project</option>
                <option value="other">Other</option>
              </select>
            </div>

            {/* Notes */}
            <div style={{ marginBottom: '0.75rem' }}>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '600', color: '#374151', marginBottom: '0.375rem' }}>
                Notes (Optional)
              </label>
              <textarea
                value={checkoutForm.notes}
                onChange={(e) => setCheckoutForm({ ...checkoutForm, notes: e.target.value })}
                rows={2}
                placeholder="Additional details..."
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  border: '2px solid #d1fae5',
                  borderRadius: '0.375rem',
                  fontSize: '0.75rem',
                  outline: 'none',
                  resize: 'vertical',
                  fontFamily: 'Inter, sans-serif',
                  background: '#ffffff'
                }}
              />
            </div>

            {/* Summary */}
            <div
              style={{
                background: '#ecfdf5',
                border: '1px solid #a7f3d0',
                borderRadius: '0.375rem',
                padding: '0.625rem',
                marginBottom: '0.75rem'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginBottom: '0.25rem' }}>
                <span style={{ color: '#065f46', fontWeight: '600' }}>Total Items:</span>
                <span style={{ color: '#047857', fontWeight: '700' }}>
                  {cart.reduce((sum, item) => sum + item.cartQty, 0)}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem' }}>
                <span style={{ color: '#065f46', fontWeight: '600' }}>Unique Items:</span>
                <span style={{ color: '#047857', fontWeight: '700' }}>
                  {cart.length}
                </span>
              </div>
            </div>

            {/* Complete Checkout Button */}
            <button
              onClick={handleCheckout}
              disabled={loading || !checkoutForm.staffId}
              style={{
                width: '100%',
                background: loading || !checkoutForm.staffId ? '#d1d5db' : 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                border: 'none',
                borderRadius: '0.5rem',
                padding: '0.75rem',
                color: '#ffffff',
                fontSize: '0.875rem',
                fontWeight: '700',
                cursor: loading || !checkoutForm.staffId ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s',
                fontFamily: 'Inter, sans-serif',
                marginBottom: '0.5rem'
              }}
              onMouseEnter={(e) => {
                if (!loading && checkoutForm.staffId) {
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(16, 185, 129, 0.3)';
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = 'none';
              }}
            >
              {loading ? 'Processing...' : 'Complete Checkout'}
            </button>

            {/* Clear Cart Button */}
            <button
              onClick={clearCart}
              disabled={loading}
              style={{
                width: '100%',
                background: '#ffffff',
                border: '2px solid #e5e7eb',
                borderRadius: '0.5rem',
                padding: '0.625rem',
                color: '#6b7280',
                fontSize: '0.8125rem',
                fontWeight: '600',
                cursor: loading ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s',
                fontFamily: 'Inter, sans-serif',
                opacity: loading ? 0.5 : 1
              }}
              onMouseEnter={(e) => {
                if (!loading) {
                  e.currentTarget.style.borderColor = '#dc2626';
                  e.currentTarget.style.color = '#dc2626';
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = '#e5e7eb';
                e.currentTarget.style.color = '#6b7280';
              }}
            >
              Clear Cart
            </button>
          </div>
        )}

      </div>


      <style>
        {`
          @keyframes slideIn {
            from {
              opacity: 0;
              transform: translateX(100%);
            }
            to {
              opacity: 1;
              transform: translateX(0);
            }
          }

          /* Base Container */
          .stockflow-container {
            display: flex;
            min-height: 100vh;
            width: 100%;
            font-family: Inter, system-ui, sans-serif;
            font-size: 14px;
            background: linear-gradient(135deg, #064e3b 0%, #065f46 50%, #047857 100%);
          }

          /* Main Content Area */
          .stockflow-main {
            width: 70%;
            padding: 1.5rem;
            overflow-y: auto;
            height: 100vh;
          }

          /* Cart Sidebar */
          .stockflow-cart {
            width: 30%;
            padding: 1rem;
            box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
            display: flex;
            flex-direction: column;
            border-left: 1px solid rgba(16, 185, 129, 0.2);
            max-height: 100vh;
            overflow-y: auto;
            background: rgba(255, 255, 255, 0.95);
            backdrop-filter: blur(20px);
          }

          /* Cart Header */
          .cart-header {
            padding: 0.75rem;
            border-bottom: 1px solid #e5e7eb;
            background: #f9fafb;
          }

          .cart-header-row {
            display: flex;
            align-items: center;
            justify-content: space-between;
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

          /* Search Filter Bar */
          .search-filter-bar {
            background: rgba(255, 255, 255, 0.95);
            border-radius: 0.75rem;
            padding: 1rem;
            margin-bottom: 1.5rem;
            display: grid;
            grid-template-columns: 1fr 1fr 1fr;
            gap: 1rem;
            box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
            backdrop-filter: blur(20px);
          }

          /* Items Grid */
          .items-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
            gap: 1rem;
          }

          /* Mobile Toggle Button - Hidden on desktop */
          .mobile-cart-toggle {
            display: none;
          }

          /* Mobile Cart Overlay */
          .mobile-cart-overlay {
            display: none;
          }

          /* MOBILE RESPONSIVE STYLES */
          @media (max-width: 768px) {
            .stockflow-container {
              flex-direction: column;
            }

            .stockflow-main {
              width: 100%;
              padding: 1rem;
              padding-bottom: 5rem;
              height: auto;
              min-height: calc(100vh - 4rem);
            }

            .stockflow-cart {
              position: fixed;
              top: 0;
              right: -100%;
              width: 90%;
              max-width: 360px;
              height: 100vh;
              z-index: 1000;
              transition: right 0.3s ease-in-out;
              box-shadow: -10px 0 30px rgba(0, 0, 0, 0.3);
              border-left: none;
            }

            .stockflow-cart.mobile-visible {
              right: 0;
            }

            .cart-close-btn {
              display: flex;
              align-items: center;
              justify-content: center;
              padding: 0.5rem;
              min-width: 44px;
              min-height: 44px;
            }

            .cart-clear-btn {
              padding: 0.5rem;
              min-width: 44px;
              min-height: 44px;
            }

            .cart-header-row {
              padding: 0.25rem 0;
            }

            .search-filter-bar {
              grid-template-columns: 1fr;
              gap: 0.75rem;
              padding: 0.75rem;
              margin-bottom: 1rem;
            }

            .items-grid {
              grid-template-columns: repeat(2, 1fr);
              gap: 0.75rem;
            }

            .mobile-cart-toggle {
              display: flex;
              align-items: center;
              gap: 0.5rem;
              position: fixed;
              bottom: 1rem;
              right: 1rem;
              z-index: 999;
              background: linear-gradient(135deg, #10b981 0%, #059669 100%);
              color: white;
              border: none;
              border-radius: 50px;
              padding: 0.875rem 1.25rem;
              font-family: Inter, sans-serif;
              font-weight: 700;
              font-size: 0.875rem;
              cursor: pointer;
              box-shadow: 0 4px 20px rgba(16, 185, 129, 0.4);
            }

            .cart-badge {
              background: #ef4444;
              color: white;
              border-radius: 50%;
              min-width: 20px;
              height: 20px;
              display: flex;
              align-items: center;
              justify-content: center;
              font-size: 0.75rem;
              font-weight: 700;
            }

            .cart-label {
              font-weight: 700;
            }

            .mobile-cart-overlay {
              display: block;
              position: fixed;
              inset: 0;
              background: rgba(0, 0, 0, 0.5);
              z-index: 999;
            }
          }

          /* Small Mobile */
          @media (max-width: 480px) {
            .stockflow-main {
              padding: 0.75rem;
              padding-bottom: 5rem;
            }

            .stockflow-cart {
              width: 100%;
              max-width: none;
            }

            .frequent-grid {
              grid-template-columns: 1fr 1fr;
            }

            .items-grid {
              grid-template-columns: 1fr 1fr;
              gap: 0.5rem;
            }

            .mobile-cart-toggle {
              bottom: 0.75rem;
              right: 0.75rem;
              padding: 0.75rem 1rem;
              font-size: 0.8125rem;
            }
          }
        `}
      </style>
    </div>
  );
};

// Main component with authentication guard
const StockFlow = () => {
  const { loading, authenticated, user, logout } = useKioskAuth({
    redirectTo: 'inventory',
    redirectOnFail: true
  });

  // Show loading while checking auth
  if (loading) {
    return (
      <div className="fixed inset-0 bg-gradient-to-br from-emerald-700 via-emerald-600 to-teal-600 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-white/30 border-t-white mb-4 mx-auto"></div>
          <p className="text-white text-lg font-medium">Verifying session...</p>
          <p className="text-white/60 text-sm mt-1">Please wait</p>
        </div>
      </div>
    );
  }

  // If not authenticated, show nothing (redirect will happen)
  if (!authenticated) {
    return (
      <div className="fixed inset-0 bg-gradient-to-br from-emerald-700 via-emerald-600 to-teal-600 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <p className="text-white text-lg font-medium">Authentication Required</p>
          <p className="text-white/60 text-sm mt-1">Redirecting to login...</p>
        </div>
      </div>
    );
  }

  return <StockFlowContent />;
};

export default StockFlow;
