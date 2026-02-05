// src/components/kiosk/QuickSell.jsx
import { useState, useEffect, useContext, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../../context/AuthContext.jsx';
import { useTenant } from '../../context/TenantProvider';
import { useOfflineSync } from '../../hooks/useOfflineSync';
import { useKioskAuth } from '../../hooks/useKioskAuth';
import { ShoppingCart } from 'lucide-react';

// Import sub-components
import KioskHeader from '../kiosk/KioskHeader';
import SectionSelector from './QuickSell/SectionSelector';
import ItemsGrid from './QuickSell/ItemsGrid';
import Cart from './QuickSell/Cart';
import CustomerModal from './QuickSell/CustomerModal';
import PaymentModal from './QuickSell/PaymentModal';
import SplitPaymentModal from './QuickSell/SplitPaymentModal';
import OrdersModal from './QuickSell/OrdersModal';
import ModifierSelectionModal from './QuickSell/ModifierSelectionModal';
import ReceiptPrinter from './QuickSell/ReceiptPrinterBW'

function QuickSellContent() {
  // Mobile cart visibility state
  const [showMobileCart, setShowMobileCart] = useState(false);
  const [allItems, setAllItems] = useState([]); // FIXED: Store ALL items for instant client-side filtering
  const [items, setItems] = useState([]);
  const [cart, setCart] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [orders, setOrders] = useState([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [heldCarts, setHeldCarts] = useState([]);

  const [loading, setLoading] = useState(true);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showSplitPaymentModal, setShowSplitPaymentModal] = useState(false);
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [showOrdersModal, setShowOrdersModal] = useState(false);
  const [salesStaff, setSalesStaff] = useState(null); // Optional: staff who made the sale
  const [showModifierModal, setShowModifierModal] = useState(false);
  const [selectedItemForModifiers, setSelectedItemForModifiers] = useState(null);
  const [showSuccessNotification, setShowSuccessNotification] = useState(false);

  const [search, setSearch] = useState('');
  const [selectedSection, setSelectedSection] = useState(null);
  
  const [customerDetails, setCustomerDetails] = useState({
    name: '',
    phone: '',
    email: '',
    dateOfBirth: ''
  });
  const [discount, setDiscount] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [splitPayments, setSplitPayments] = useState(null); // For split payment
  const [applyVAT, setApplyVAT] = useState(false);
  const [gratuity, setGratuity] = useState(0);
  const [gratuityType, setGratuityType] = useState('none'); // none, percentage, fixed
  const [gratuityValue, setGratuityValue] = useState(0); // The percentage or fixed value
  
  const { user, logout } = useContext(AuthContext);
  const { tenantInfo, makeRequest, loading: tenantLoading } = useTenant();
  const navigate = useNavigate();
  const VAT_RATE = 0.075;

  // Offline sync hook
  const {
    isOnline,
    isSyncing,
    queueCount,
    syncTransactions,
    queueTransaction,
    updateQueueCount
  } = useOfflineSync(makeRequest, tenantInfo?.tenantId);

  // FIXED: Extract unique categories from ALL items (not filtered items) for dynamic sections
  const availableSections = useMemo(() => {
    if (allItems.length > 0) {
      // Get unique categories from all items
      const uniqueCategories = [...new Set(allItems.map(item => {
        // Handle both category object and category string
        if (item.category && typeof item.category === 'object') {
          return item.category.name;
        } else if (item.category && typeof item.category === 'string') {
          return item.category;
        }
        return null;
      }).filter(Boolean))];

      // Add "All Items" as first section to show items without category
      return ['All Items', ...uniqueCategories];
    }
    return ['All Items'];
  }, [allItems]);

  // Load held carts from sessionStorage on mount
  useEffect(() => {
    const savedHeldCarts = sessionStorage.getItem('heldCarts');
    if (savedHeldCarts) {
      try {
        const parsed = JSON.parse(savedHeldCarts);
        const oneHourAgo = Date.now() - (60 * 60 * 1000);
        const validCarts = parsed.filter(hc => hc.timestamp > oneHourAgo);
        setHeldCarts(validCarts);
        if (validCarts.length < parsed.length) {
          sessionStorage.setItem('heldCarts', JSON.stringify(validCarts));
        }
      } catch (e) {
        console.error('Error loading held carts:', e);
      }
    }
  }, []);

  useEffect(() => {
    // Only fetch data if tenant is loaded
    if (!tenantLoading && tenantInfo) {
      fetchAllItems(); // Fetch all items to populate sections
      fetchCustomers();
    }
  }, [tenantLoading, tenantInfo]);

  // FIXED: Client-side filtering for INSTANT category switching - no API calls, no loading spinner
  useEffect(() => {
    if (selectedSection && allItems.length > 0) {
      if (selectedSection === 'All Items') {
        setItems(allItems);
      } else {
        // Filter instantly from allItems - NO API call needed!
        const filtered = allItems.filter(item => {
          if (item.category && typeof item.category === 'object') {
            return item.category.name === selectedSection;
          } else if (item.category && typeof item.category === 'string') {
            return item.category === selectedSection;
          }
          return false;
        });
        setItems(filtered);
      }
    }
  }, [selectedSection, allItems]);

  // Set document title
  useEffect(() => {
    document.title = 'QuickSell - POS';
    return () => {
      document.title = 'Pump House ERP';
    };
  }, []);

  const fetchAllItems = async () => {
    try {
      const response = await makeRequest('/api/pos/items');
      // Backend returns { success, items, pagination }
      const activeItems = (response.items || []).filter(item => item.active !== false);
      // FIXED: Store all items for instant client-side filtering
      setAllItems(activeItems);
      setItems(activeItems);
      setLoading(false);
    } catch (err) {
      setLoading(false);
      console.error('Failed to load items:', err);
    }
  };

  const fetchData = async () => {
    try {
      // If "All Items" is selected, fetch all items (including category-less)
      if (selectedSection === 'All Items') {
        await fetchAllItems();
        return;
      }

      // Otherwise, filter by selected category
      const params = { category: selectedSection };

      const response = await makeRequest('/api/pos/items', { params });

      // Backend returns { success, items, pagination }
      const activeItems = (response.items || []).filter(item => item.active !== false);
      setItems(activeItems);
      setLoading(false);
    } catch (err) {
      setLoading(false);
      alert('Failed to load items: ' + (err.message || 'Failed to load items'));
      if (err.message?.includes('401')) {
        localStorage.removeItem('kioskUser');
        navigate('/kiosk/login');
      }
    }
  };

  const fetchCustomers = async () => {
    try {
      const response = await makeRequest('/api/customers', {
        params: { limit: 9999 } // Get all customers for POS kiosk
      });
      // makeRequest returns JSON directly: { customers: [...], stats: {...}, pagination: {...} }
      setCustomers(response.customers || []);
    } catch (err) {
      console.error('Failed to load customers:', err);
    }
  };

  const addToCart = (item) => {
    // Check if item has modifiers
    if (item.modifiers && item.modifiers.length > 0) {
      // Show modifier selection modal
      setSelectedItemForModifiers(item);
      setShowModifierModal(true);
      return;
    }

    // FIXED: Use functional update and unique cartItemId to prevent duplicate bugs
    setCart(prevCart => {
      // Find existing item without modifiers (by _id, no cartItemId with modifiers)
      const existingItem = prevCart.find(i => i._id === item._id && !i.selectedModifiers?.length);
      if (existingItem) {
        // Update quantity of existing item
        return prevCart.map(i =>
          i._id === item._id && !i.selectedModifiers?.length
            ? { ...i, cartQty: Math.min(i.cartQty + 1, item.quantity || 999) }
            : i
        );
      } else {
        // Add new item with unique cartItemId
        return [...prevCart, {
          ...item,
          cartQty: 1,
          selectedModifiers: [],
          cartItemId: `${item._id}_${Date.now()}` // Unique ID for cart tracking
        }];
      }
    });
  };

  const handleModifierConfirm = ({ modifiers, additionalCost }) => {
    const item = selectedItemForModifiers;

    // Create a unique cart item with modifiers
    const cartItem = {
      ...item,
      cartQty: 1,
      selectedModifiers: modifiers,
      modifierCost: additionalCost,
      // Create a unique ID for cart item with modifiers
      cartItemId: `${item._id}_${Date.now()}`
    };

    setCart([...cart, cartItem]);
    setShowModifierModal(false);
    setSelectedItemForModifiers(null);
  };

  // FIXED: Use functional update to prevent stale state issues
  const removeFromCart = (id, cartItemId = null) => {
    setCart(prevCart => prevCart.filter(item => {
      if (cartItemId) {
        return item.cartItemId !== cartItemId;
      }
      // For items without cartItemId, match by _id
      return item._id !== id || item.cartItemId;
    }));
  };

  // FIXED: Use functional update to prevent stale state issues
  const updateCartQty = (id, qty, cartItemId = null) => {
    if (qty <= 0) {
      removeFromCart(id, cartItemId);
    } else {
      setCart(prevCart => prevCart.map(item => {
        const isTarget = cartItemId
          ? item.cartItemId === cartItemId
          : item._id === id && !item.cartItemId;
        return isTarget ? { ...item, cartQty: Math.min(qty, item.quantity || 999) } : item;
      }));
    }
  };

  const handleDeleteCart = () => {
    if (window.confirm('Clear entire cart?')) {
      setCart([]);
      setCustomerDetails({ name: '', phone: '', email: '', dateOfBirth: '' });
      setDiscount(0);
    }
  };

  const handleHoldCart = () => {
    if (cart.length === 0) {
      alert('Cart is empty - nothing to hold');
      return;
    }

    const heldCart = {
      id: Date.now(),
      timestamp: Date.now(),
      cart: [...cart],
      customerDetails: { ...customerDetails },
      discount,
      applyVAT,
      section: selectedSection
    };

    const updatedHeldCarts = [...heldCarts, heldCart];
    setHeldCarts(updatedHeldCarts);
    sessionStorage.setItem('heldCarts', JSON.stringify(updatedHeldCarts));

    setCart([]);
    setCustomerDetails({ name: '', phone: '', email: '', dateOfBirth: '' });
    setDiscount(0);
    setApplyVAT(false);

    alert('✅ Cart held successfully!');
  };

  const handleRecallCart = (heldCartId) => {
  const heldCart = heldCarts.find(hc => hc.id === heldCartId);
  if (!heldCart) return;

  setCart(heldCart.cart);
  setCustomerDetails(heldCart.customerDetails);
  setDiscount(heldCart.discount);
  setApplyVAT(heldCart.applyVAT);
  if (heldCart.section) {
    setSelectedSection(heldCart.section);
  }

  const updatedHeldCarts = heldCarts.filter(hc => hc.id !== heldCartId);
  setHeldCarts(updatedHeldCarts);
  sessionStorage.setItem('heldCarts', JSON.stringify(updatedHeldCarts));

  setShowOrdersModal(false);

  alert('✅ Cart recalled successfully!');
};

  const handleDeleteHeldCart = (heldCartId) => {
    if (window.confirm('Delete this held cart?')) {
      const updatedHeldCarts = heldCarts.filter(hc => hc.id !== heldCartId);
      setHeldCarts(updatedHeldCarts);
      sessionStorage.setItem('heldCarts', JSON.stringify(updatedHeldCarts));
    }
  };

  const calculateSubtotal = () => {
    return cart.reduce((sum, item) => {
      const basePrice = item.price * item.cartQty;
      const modifierCost = (item.modifierCost || 0) * item.cartQty;
      return sum + basePrice + modifierCost;
    }, 0);
  };

  const calculateVAT = () => {
    return applyVAT ? calculateSubtotal() * VAT_RATE : 0;
  };

  const calculateTotal = () => {
    const subtotal = calculateSubtotal();
    const vat = calculateVAT();
    const discountAmount = (subtotal + vat) * (discount / 100);
    return subtotal + vat - discountAmount + gratuity;
  };

  const handleSetGratuity = (amount, type, value) => {
    setGratuity(amount);
    setGratuityType(type);
    setGratuityValue(value);
  };

  const handleCheckout = () => {
    if (cart.length === 0) {
      alert('Cart is empty');
      return;
    }
    setShowPaymentModal(true);
  };

  // Helper function to extract first name from username
  const extractFirstName = (username) => {
    if (!username) return 'Staff';
    const parts = username.split('.');
    return parts[0].charAt(0).toUpperCase() + parts[0].slice(1);
  };

  const confirmPayment = async (splitPaymentsData = null) => {
    if (checkoutLoading) return;

    setCheckoutLoading(true);
    try {
      const subtotal = calculateSubtotal();
      const vat = calculateVAT();
      const discountAmount = (subtotal + vat) * (discount / 100);
      const totalBeforeTip = subtotal + vat - discountAmount;

      const finalTotal = totalBeforeTip + gratuity;

      const transactionData = {
        items: cart.map(item => ({
          itemId: item._id,
          name: item.name,
          quantity: item.cartQty,
          price: item.price,
          type: item.type,
          modifiers: item.selectedModifiers || []
        })),
        subtotal,
        vat,
        gratuity,
        gratuityType,
        gratuityValue,
        totalAmount: finalTotal,
        discount,
        applyVAT,
        paymentMethod: splitPaymentsData ? 'split' : paymentMethod,
        splitPayments: splitPaymentsData || undefined,
        department: 'Sales',
        section: selectedSection || 'General',
        type: 'mixed',
        name: `Sale - ${new Date().toISOString()}`,
        category: (selectedSection && selectedSection !== 'All Items') ? selectedSection : 'Mixed',
        status: 'completed',
        customer: customerDetails.name ? customerDetails : null,
        // Optional: Staff who made the sale (for tracking/commission purposes)
        ...(salesStaff && {
          staffId: salesStaff._id,
          staffName: `${salesStaff.firstName} ${salesStaff.lastName}`.trim(),
          commissionRate: salesStaff.commission?.rate || 0,
          commissionAmount: salesStaff.commission?.enabled
            ? Math.round(finalTotal * (salesStaff.commission.rate / 100) * 100) / 100
            : 0
        }),
        updateInventory: true,
        productItems: cart.filter(item => item.type === 'product').map(item => ({
          itemId: item._id,
          quantity: item.cartQty
        }))
      };

      let response;
      let transactionId;

      // Handle online vs offline
      if (isOnline) {
        // Online: Send request normally
        response = await makeRequest('/api/pos-transactions', {
          method: 'POST',
          data: transactionData
        });
        transactionId = response.data?._id || response._id || `TXN-${Date.now()}`;
      } else {
        // Offline: Queue transaction
        const queueResult = await queueTransaction(transactionData);
        if (queueResult.success) {
          transactionId = `OFFLINE-${queueResult.id}`;
          await updateQueueCount();
        } else {
          throw new Error('Failed to queue offline transaction');
        }
      }

      setShowPaymentModal(false);

      // Show success notification for 1 second
      setShowSuccessNotification(true);
      await new Promise(resolve => setTimeout(resolve, 1000));
      setShowSuccessNotification(false);

      // Print receipt
      const receiptData = {
        transactionId,
        cart,
        customerDetails,
        subtotal: calculateSubtotal(),
        vat: calculateVAT(),
        total: calculateTotal(),
        discount,
        gratuity, // FIXED: Include tip/gratuity in receipt
        section: selectedSection,
        paymentMethod: splitPaymentsData ? 'split' : paymentMethod,
        splitPayments: splitPaymentsData || undefined,
        applyVAT,
        timestamp: new Date(),
        cashier: extractFirstName(user?.username) || 'Staff',
        tenantInfo: tenantInfo,
        isOffline: !isOnline // Mark receipt as offline
      };

      const printer = new ReceiptPrinter();
      await printer.print(receiptData);

      // Reset
      setCart([]);
      setCustomerDetails({ name: '', phone: '', email: '', dateOfBirth: '' });
      setDiscount(0);
      setPaymentMethod('cash');
      setApplyVAT(false);
      setGratuity(0);
      setGratuityType('none');
      setGratuityValue(0);
      setSalesStaff(null);

      // Refetch data to get updated quantities and customer list (only if online)
      if (isOnline) {
        if (selectedSection) {
          fetchData(); // Reload items with updated quantities
        }
        fetchCustomers(); // Reload customers in case new customer was created
      }

    } catch (err) {
      console.error('Checkout error:', err);
      const errorMsg = err.response?.data?.message || err.message;
      const missingFields = err.response?.data?.missing;
      if (missingFields) {
        alert(`Checkout failed: Missing required fields - ${missingFields.join(', ')}`);
      } else {
        alert('Checkout failed: ' + errorMsg);
      }
    } finally {
      setCheckoutLoading(false);
    }
  };

  // Handle split payment
  const handleSplitPayment = () => {
    setShowPaymentModal(false);
    setShowSplitPaymentModal(true);
  };

  const confirmSplitPayment = async (splitPaymentsData) => {
    setSplitPayments(splitPaymentsData);
    setShowSplitPaymentModal(false);
    await confirmPayment(splitPaymentsData);
  };

  const handleOrdersClick = async () => {
    setShowOrdersModal(true);
    setOrdersLoading(true);
    try {
      // FIXED: Fetch recent completed orders with limit for faster loading
      const response = await makeRequest('/api/pos-transactions?status=completed&limit=50&sort=-createdAt');
      setOrders(response || []);
    } catch (err) {
      setShowOrdersModal(false);
      alert('Failed to load orders: ' + err.message);
    } finally {
      setOrdersLoading(false);
    }
  };

  const handleReprintTransaction = async (transaction) => {
    try {
      const receiptData = {
        transactionId: transaction._id,
        cart: transaction.items || [],
        customerDetails: transaction.customer || {},
        subtotal: transaction.subtotal || 0,
        vat: transaction.vat || 0,
        total: transaction.totalAmount || transaction.total || 0,
        discount: transaction.discount || 0,
        section: transaction.section,
        paymentMethod: transaction.paymentMethod || 'cash',
        applyVAT: transaction.applyVAT || false,
        timestamp: transaction.createdAt ? new Date(transaction.createdAt) : new Date(),
        cashier: 'System'
      };

      const printer = new ReceiptPrinter();
      await printer.print(receiptData);
    } catch (err) {
      alert('Reprint failed: ' + err.message);
    }
  };

  const handleBackToSections = () => {
    setSelectedSection(null);
    fetchAllItems(); // Reload all items instead of clearing
  };

  const filteredItems = items.filter(item => {
  // Apply search filter only (category filtering is done by fetchData)
  const matchesSearch = search
    ? (item.name.toLowerCase().includes(search.toLowerCase()) || item.barcode?.includes(search))
    : true;

  return matchesSearch;
});

  // Show loading state while tenant info is loading
  if (tenantLoading || !tenantInfo) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #1e40af 0%, #3b82f6 50%, #60a5fa 100%)'
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
          <p style={{ fontSize: '1.125rem', fontWeight: '600' }}>Loading POS System...</p>
          <style>{`
            @keyframes spin {
              to { transform: rotate(360deg); }
            }
          `}</style>
        </div>
      </div>
    );
  }

  return (
    <div className="quicksell-container">
      {/* Mobile Cart Toggle Button - Fixed at bottom */}
      <button
        className="mobile-cart-toggle"
        onClick={() => setShowMobileCart(!showMobileCart)}
      >
        <ShoppingCart size={20} />
        {cart.length > 0 && (
          <span className="cart-badge">{cart.length}</span>
        )}
        <span className="cart-total">₦{calculateTotal().toLocaleString()}</span>
      </button>

      {/* Mobile Cart Overlay */}
      {showMobileCart && (
        <div
          className="mobile-cart-overlay"
          onClick={() => setShowMobileCart(false)}
        />
      )}

      <div className="quicksell-main">
        <KioskHeader />

        {/* Offline/Online Indicator - Small Pulsing Dot */}
        <div style={{
          position: 'fixed',
          top: '1.25rem',
          right: '1.25rem',
          zIndex: 1000,
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem'
        }}>
          {/* Online/Offline Dot with Tooltip */}
          <div
            className="status-dot-container"
            style={{
              position: 'relative',
              padding: '0.5rem',
              cursor: 'pointer'
            }}
          >
            <div
              style={{
                width: '10px',
                height: '10px',
                borderRadius: '50%',
                background: isOnline ? '#10b981' : '#ef4444',
                boxShadow: isOnline
                  ? '0 0 0 0 rgba(16, 185, 129, 0.7)'
                  : '0 0 0 0 rgba(239, 68, 68, 0.7)',
                animation: isOnline ? 'pulseDot 2s infinite' : 'none'
              }}
            />
            <div
              className="status-tooltip"
              style={{
                position: 'absolute',
                top: '100%',
                right: '0',
                marginTop: '0.25rem',
                padding: '0.375rem 0.75rem',
                background: '#1f2937',
                color: '#ffffff',
                fontSize: '0.75rem',
                fontWeight: '600',
                borderRadius: '0.375rem',
                whiteSpace: 'nowrap',
                opacity: 0,
                pointerEvents: 'none',
                transition: 'opacity 0.2s',
                boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)',
                zIndex: 1001
              }}
            >
              {isOnline ? 'Online' : 'Offline'}
            </div>
            <style>{`
              @keyframes pulseDot {
                0% {
                  box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.7);
                }
                70% {
                  box-shadow: 0 0 0 6px rgba(16, 185, 129, 0);
                }
                100% {
                  box-shadow: 0 0 0 0 rgba(16, 185, 129, 0);
                }
              }
              .status-dot-container:hover .status-tooltip {
                opacity: 1;
              }
            `}</style>
          </div>

          {/* Queue Count Badge */}
          {queueCount > 0 && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.5rem 1rem',
              borderRadius: '9999px',
              background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
              color: '#ffffff',
              fontSize: '0.875rem',
              fontWeight: '600',
              boxShadow: '0 4px 6px rgba(0, 0, 0, 0.2)',
              border: '2px solid rgba(255, 255, 255, 0.3)',
              cursor: isOnline && !isSyncing ? 'pointer' : 'default',
              transition: 'transform 0.2s'
            }}
            onClick={() => isOnline && !isSyncing && syncTransactions()}
            onMouseEnter={(e) => {
              if (isOnline && !isSyncing) {
                e.currentTarget.style.transform = 'scale(1.05)';
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'scale(1)';
            }}
            title={isOnline && !isSyncing ? 'Click to sync now' : ''}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
                <path d="M21 3v5h-5" />
                <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
                <path d="M3 21v-5h5" />
              </svg>
              {queueCount} queued
              {isSyncing && ' (syncing...)'}
            </div>
          )}
        </div>

        {!selectedSection ? (
          <SectionSelector
            sections={availableSections}
            selectedSection={selectedSection}
            onSelectSection={setSelectedSection}
            tenantInfo={tenantInfo}
          />
        ) : loading && allItems.length === 0 ? (
          /* FIXED: Only show loading during INITIAL load - category switching is now INSTANT via client-side filtering */
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '4rem 2rem',
            color: '#ffffff'
          }}>
            <div style={{
              width: '48px',
              height: '48px',
              border: '4px solid rgba(255, 255, 255, 0.3)',
              borderTopColor: '#ffffff',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
              marginBottom: '1rem'
            }}></div>
            <p style={{ fontSize: '1rem', fontWeight: '600' }}>Loading items...</p>
          </div>
        ) : (
          <ItemsGrid
            items={filteredItems}
            onAddToCart={addToCart}
            search={search}
            onSearchChange={setSearch}
            onBack={handleBackToSections}
            selectedSection={selectedSection}
            selectedCategory={null}
            tenantInfo={tenantInfo}
          />
        )}
      </div>

      <div className={`quicksell-cart ${showMobileCart ? 'mobile-visible' : ''}`}>
        <Cart
        cart={cart}
        customerDetails={customerDetails}
        discount={discount}
        applyVAT={applyVAT}
        heldCarts={heldCarts}
        calculateSubtotal={calculateSubtotal}
        calculateVAT={calculateVAT}
        calculateTotal={calculateTotal}
        onUpdateQty={updateCartQty}
        onRemoveItem={removeFromCart}
        onClearCart={handleDeleteCart}
        onHoldCart={handleHoldCart}
        onRecallCart={handleRecallCart}
        onDeleteHeldCart={handleDeleteHeldCart}
        onOpenCustomer={() => setShowCustomerModal(true)}
        onRemoveCustomer={() => setCustomerDetails({ name: '', phone: '', email: '', dateOfBirth: '' })}
        onSetDiscount={setDiscount}
        onSetApplyVAT={setApplyVAT}
        onCheckout={handleCheckout}
        onHomeClick={handleBackToSections}
        onCustomersClick={() => setShowCustomerModal(true)}
        onOrdersClick={handleOrdersClick}
        onCloseCart={() => setShowMobileCart(false)}
      />
      </div>

      {showSuccessNotification && (
        <div
          style={{
            position: 'fixed',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            zIndex: 9999,
            background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
            color: '#ffffff',
            padding: '2rem 3rem',
            borderRadius: '1rem',
            boxShadow: '0 20px 40px rgba(0, 0, 0, 0.3)',
            textAlign: 'center',
            animation: 'slideIn 0.3s ease-out'
          }}
        >
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>✅</div>
          <div style={{ fontSize: '1.5rem', fontWeight: '700' }}>Payment Successful!</div>
          <div style={{ fontSize: '1rem', marginTop: '0.5rem', opacity: 0.9 }}>Preparing receipt...</div>
        </div>
      )}

      {showCustomerModal && (
        <CustomerModal
          customers={customers}
          customerDetails={customerDetails}
          onSave={(data) => {
            setCustomerDetails(data);
            setShowCustomerModal(false);
          }}
          onClose={() => setShowCustomerModal(false)}
          items={items}
          tenantInfo={tenantInfo}
        />
      )}

      {showPaymentModal && (
        <PaymentModal
          total={calculateTotal() - gratuity} /* FIXED: Pass total WITHOUT gratuity to prevent tip compounding */
          paymentMethod={paymentMethod}
          onSetPaymentMethod={setPaymentMethod}
          onConfirm={confirmPayment}
          onClose={() => setShowPaymentModal(false)}
          onSplitPayment={handleSplitPayment}
          loading={checkoutLoading}
          gratuity={gratuity}
          onSetGratuity={handleSetGratuity}
          selectedSalesStaff={salesStaff}
          onSetSalesStaff={setSalesStaff}
          makeRequest={makeRequest}
        />
      )}

      {showSplitPaymentModal && (
        <SplitPaymentModal
          total={calculateTotal()}
          onConfirm={confirmSplitPayment}
          onClose={() => setShowSplitPaymentModal(false)}
          loading={checkoutLoading}
        />
      )}

      {showOrdersModal && (
        <OrdersModal
          orders={orders}
          heldCarts={heldCarts}
          onReprint={handleReprintTransaction}
          onRecallCart={handleRecallCart}
          onDeleteHeldCart={handleDeleteHeldCart}
          onClose={() => setShowOrdersModal(false)}
          loading={ordersLoading}
        />
      )}

      {showModifierModal && selectedItemForModifiers && (
        <ModifierSelectionModal
          item={selectedItemForModifiers}
          onConfirm={handleModifierConfirm}
          onClose={() => {
            setShowModifierModal(false);
            setSelectedItemForModifiers(null);
          }}
        />
      )}

      <style>
        {`
          @keyframes slideIn {
            from {
              opacity: 0;
              transform: translate(-50%, -60%);
            }
            to {
              opacity: 1;
              transform: translate(-50%, -50%);
            }
          }

          /* Base Container */
          .quicksell-container {
            display: flex;
            min-height: 100vh;
            width: 100%;
            font-family: Inter, system-ui, sans-serif;
            font-size: 14px;
            background: linear-gradient(135deg, #1e40af 0%, #3b82f6 50%, #60a5fa 100%);
          }

          /* Main Content Area */
          .quicksell-main {
            width: 70%;
            padding: 1.5rem;
            overflow-y: auto;
            height: 100vh;
          }

          /* Cart Sidebar */
          .quicksell-cart {
            width: 30%;
          }

          /* Mobile Cart Toggle Button - Hidden on desktop */
          .mobile-cart-toggle {
            display: none;
          }

          /* Mobile Cart Overlay */
          .mobile-cart-overlay {
            display: none;
          }

          /* MOBILE RESPONSIVE STYLES */
          @media (max-width: 768px) {
            .quicksell-container {
              flex-direction: column;
            }

            .quicksell-main {
              width: 100%;
              padding: 1rem;
              padding-bottom: 5rem;
              height: auto;
              min-height: calc(100vh - 4rem);
            }

            .quicksell-cart {
              position: fixed;
              top: 0;
              right: -100%;
              width: 90%;
              max-width: 360px;
              height: 100vh;
              z-index: 1000;
              transition: right 0.3s ease-in-out;
              box-shadow: -10px 0 30px rgba(0, 0, 0, 0.3);
            }

            .quicksell-cart.mobile-visible {
              right: 0;
            }

            .mobile-cart-toggle {
              display: flex;
              align-items: center;
              gap: 0.5rem;
              position: fixed;
              bottom: 1rem;
              right: 1rem;
              z-index: 999;
              background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
              color: white;
              border: none;
              border-radius: 50px;
              padding: 0.875rem 1.25rem;
              font-family: Inter, sans-serif;
              font-weight: 700;
              font-size: 0.875rem;
              cursor: pointer;
              box-shadow: 0 4px 20px rgba(59, 130, 246, 0.4);
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

            .cart-total {
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
            .quicksell-main {
              padding: 0.75rem;
              padding-bottom: 5rem;
            }

            .quicksell-cart {
              width: 100%;
              max-width: none;
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
}

// Main component with authentication guard
function QuickSell() {
  const { loading, authenticated, user, logout } = useKioskAuth({
    redirectTo: 'quicksell',
    redirectOnFail: true
  });

  // Show loading while checking auth
  if (loading) {
    return (
      <div className="fixed inset-0 bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-600 flex items-center justify-center">
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
      <div className="fixed inset-0 bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-600 flex items-center justify-center">
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

  return <QuickSellContent />;
}

export default QuickSell;