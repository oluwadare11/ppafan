// src/components/kiosk/QuickSell/ItemsGrid.jsx
// OPTIMIZED: Smaller cards with readable text, barcode scanner support
import { useState, useRef, useEffect } from 'react';
import { formatCurrency } from '../../../utils/formatters';
import { Package, AlertCircle, Barcode } from 'lucide-react';

function ItemsGrid({ items, onAddToCart, search, onSearchChange, onBack, selectedSection, selectedCategory, tenantInfo }) {
  // Barcode scanner state
  const [barcodeInput, setBarcodeInput] = useState('');
  const [scannerFocused, setScannerFocused] = useState(false);
  const barcodeInputRef = useRef(null);

  // Handle barcode scan/search
  const handleBarcodeSearch = (barcode) => {
    if (!barcode.trim()) return;

    const found = items.find(item => item.barcode === barcode.trim());
    if (found) {
      onAddToCart(found);
      setBarcodeInput('');
      // Flash success feedback
      if (barcodeInputRef.current) {
        barcodeInputRef.current.style.borderColor = '#10b981';
        setTimeout(() => {
          if (barcodeInputRef.current) {
            barcodeInputRef.current.style.borderColor = colors.border;
          }
        }, 500);
      }
    } else {
      alert(`No item found with barcode: ${barcode}`);
      setBarcodeInput('');
    }
  };
  // FIXED: Stock alert constants - use item's reorderLevel or defaults
  const DEFAULT_REORDER_LEVEL = 10;
  const CRITICAL_MULTIPLIER = 0.5; // Critical = 50% of reorder level

  // Helper to get item's low stock threshold
  const getItemReorderLevel = (item) => item.reorderLevel || DEFAULT_REORDER_LEVEL;
  const getItemCriticalLevel = (item) => Math.floor(getItemReorderLevel(item) * CRITICAL_MULTIPLIER);

  // Count low stock items (uses each item's own reorderLevel)
  const lowStockItems = items.filter(item =>
    item.type === 'product' &&
    item.quantity !== undefined &&
    item.quantity <= getItemReorderLevel(item) &&
    item.quantity > 0
  );

  const criticalStockItems = items.filter(item =>
    item.type === 'product' &&
    item.quantity !== undefined &&
    item.quantity <= getItemCriticalLevel(item) &&
    item.quantity > 0
  );

  // Helper function to adjust color brightness
  const adjustBrightness = (color, percent) => {
    const hex = color.replace('#', '');
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);

    const adjust = (val) => {
      const adjusted = val + (val * percent) / 100;
      return Math.min(255, Math.max(0, Math.round(adjusted)));
    };

    const newR = adjust(r);
    const newG = adjust(g);
    const newB = adjust(b);

    return `#${newR.toString(16).padStart(2, '0')}${newG.toString(16).padStart(2, '0')}${newB.toString(16).padStart(2, '0')}`;
  };

  // Convert hex to rgba
  const hexToRgba = (hex, opacity) => {
    const h = hex.replace('#', '');
    const r = parseInt(h.substring(0, 2), 16);
    const g = parseInt(h.substring(2, 4), 16);
    const b = parseInt(h.substring(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${opacity})`;
  };

  // Generate colors from tenant branding
  const getSectionColors = () => {
    const baseColor = tenantInfo?.branding?.primaryColor || '#3b82f6';
    const darkColor = adjustBrightness(baseColor, -20);
    const textDarkColor = adjustBrightness(baseColor, -40);

    return {
      bg: baseColor,
      bgLight: hexToRgba(baseColor, 0.15),
      bgCard: `linear-gradient(135deg, ${baseColor} 0%, ${darkColor} 100%)`,
      border: baseColor,
      text: '#ffffff',
      textDark: textDarkColor,
      shadow: hexToRgba(baseColor, 0.3)
    };
  };

  const colors = getSectionColors();

  if (items.length === 0) {
    return (
      <div style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <h2 
            style={{
              fontSize: '2rem',
              fontWeight: '700',
              color: '#ffffff',
              marginBottom: '0.5rem',
              textShadow: '0 2px 4px rgba(0,0,0,0.3)'
            }}
          >
            {selectedSection}
          </h2>
          <div
            style={{
              width: '8rem',
              height: '4px',
              margin: '0 auto',
              borderRadius: '9999px',
              background: colors.bg
            }}
          ></div>
        </div>

        <div style={{ marginBottom: '1.5rem' }}>
          <div style={{ marginBottom: '1rem' }}>
            <input
              type="text"
              placeholder="Search items by name..."
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              style={{
                width: '100%',
                padding: '1rem',
                fontSize: '14px',
                border: `2px solid ${colors.border}`,
                borderRadius: '0.75rem',
                fontFamily: 'Inter, sans-serif',
                backgroundColor: 'rgba(255, 255, 255, 0.95)',
                color: '#1f2937',
                boxSizing: 'border-box'
              }}
            />
          </div>

          <button
            onClick={onBack}
            style={{
              padding: '0.5rem 1.5rem',
              fontSize: '13px',
              fontWeight: '600',
              border: '1px solid rgba(255, 255, 255, 0.3)',
              borderRadius: '0.5rem',
              background: 'rgba(255, 255, 255, 0.1)',
              color: '#ffffff',
              cursor: 'pointer',
              fontFamily: 'Inter, sans-serif',
              backdropFilter: 'blur(10px)'
            }}
          >
            ← Back
          </button>
        </div>

        <div style={{ textAlign: 'center', padding: '4rem' }}>
          <Package size={64} style={{ color: 'rgba(255, 255, 255, 0.3)', margin: '0 auto 1rem' }} />
          <p style={{ fontSize: '1.125rem', fontWeight: '600', color: '#ffffff', margin: 0 }}>No items found</p>
          <p style={{ fontSize: '0.875rem', color: 'rgba(255, 255, 255, 0.7)', marginTop: '0.5rem' }}>Try adjusting your search</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
      {/* Title */}
      <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
        <h2
          style={{
            fontSize: '2rem',
            fontWeight: '700',
            color: '#ffffff',
            marginBottom: '0.5rem',
            fontFamily: 'Inter, sans-serif',
            textShadow: '0 2px 4px rgba(0,0,0,0.3)'
          }}
        >
          {selectedSection}
        </h2>
        <div
          style={{
            width: '8rem',
            height: '4px',
            margin: '0 auto',
            borderRadius: '9999px',
            background: colors.bg
          }}
        ></div>
      </div>


      {/* Search Bar & Barcode Scanner */}
      <div style={{ marginBottom: '1.5rem' }}>
        {/* Barcode Scanner Row */}
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem' }}>
          <div style={{ flex: 1, position: 'relative' }}>
            <Barcode
              size={18}
              style={{
                position: 'absolute',
                left: '0.75rem',
                top: '50%',
                transform: 'translateY(-50%)',
                color: colors.textDark
              }}
            />
            <input
              ref={barcodeInputRef}
              type="text"
              placeholder="Scan or enter barcode..."
              value={barcodeInput}
              onChange={(e) => setBarcodeInput(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleBarcodeSearch(barcodeInput)}
              onFocus={() => setScannerFocused(true)}
              onBlur={() => setScannerFocused(false)}
              style={{
                width: '100%',
                padding: '0.75rem 0.75rem 0.75rem 2.5rem',
                fontSize: '14px',
                border: `2px solid ${scannerFocused ? colors.border : '#e5e7eb'}`,
                borderRadius: '0.5rem',
                fontFamily: 'Inter, sans-serif',
                backgroundColor: 'rgba(255, 255, 255, 0.95)',
                color: '#1f2937',
                boxSizing: 'border-box',
                transition: 'all 0.2s'
              }}
            />
          </div>
          <button
            onClick={() => handleBarcodeSearch(barcodeInput)}
            style={{
              padding: '0.75rem 1rem',
              background: `linear-gradient(135deg, ${colors.bg} 0%, ${colors.textDark} 100%)`,
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

        {/* Search Input */}
        <div style={{ marginBottom: '0.75rem' }}>
          <input
            type="text"
            placeholder="Search items by name..."
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            style={{
              width: '100%',
              padding: '0.75rem 1rem',
              fontSize: '14px',
              border: `2px solid ${colors.border}`,
              borderRadius: '0.5rem',
              fontFamily: 'Inter, sans-serif',
              backgroundColor: 'rgba(255, 255, 255, 0.95)',
              color: '#1f2937',
              backdropFilter: 'blur(10px)',
              boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
              boxSizing: 'border-box'
            }}
          />
        </div>

        {/* Back Button */}
        <button
          onClick={onBack}
          style={{
            padding: '0.5rem 1.5rem',
            fontSize: '13px',
            fontWeight: '600',
            border: '1px solid rgba(255, 255, 255, 0.3)',
            borderRadius: '0.5rem',
            background: 'rgba(255, 255, 255, 0.1)',
            color: '#ffffff',
            cursor: 'pointer',
            fontFamily: 'Inter, sans-serif',
            backdropFilter: 'blur(10px)',
            transition: 'all 0.3s ease'
          }}
          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.2)'}
          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.1)'}
        >
          ← Back
        </button>
      </div>

      {/* Items Grid - SMALLER CARDS - Mobile Responsive */}
      <div
        className="items-grid-container"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(min(160px, 45%), 1fr))',
          gap: '0.5rem',
          paddingBottom: '2rem'
        }}
      >
        {items.map(item => (
          <ItemCard key={item._id} item={item} onAddToCart={onAddToCart} sectionColors={colors} />
        ))}
      </div>
    </div>
  );
}

function ItemCard({ item, onAddToCart, sectionColors }) {
  // FIXED: Use item's reorderLevel for consistent stock alerts
  const reorderLevel = item.reorderLevel || 10;
  const criticalLevel = Math.floor(reorderLevel * 0.5);

  const isLowStock = item.type === 'product' && item.quantity <= reorderLevel && item.quantity > criticalLevel;
  const isCriticalStock = item.type === 'product' && item.quantity <= criticalLevel && item.quantity > 0;
  const isOutOfStock = item.type === 'product' && item.quantity === 0;

  return (
    <button
      onClick={() => !isOutOfStock && onAddToCart(item)}
      disabled={isOutOfStock}
      style={{
        padding: '0',
        border: `2px solid ${isCriticalStock ? '#dc2626' : isLowStock ? '#f59e0b' : sectionColors.border}`,
        borderRadius: '0.75rem',
        background: isCriticalStock ? '#fef2f2' : isLowStock ? '#fffbeb' : '#ffffff',
        textAlign: 'left',
        cursor: isOutOfStock ? 'not-allowed' : 'pointer',
        opacity: isOutOfStock ? 0.6 : 1,
        transition: 'all 0.3s ease',
        fontFamily: 'Inter, system-ui, sans-serif',
        boxShadow: `0 2px 4px ${sectionColors.shadow}`,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        height: '100%'
      }}
      onMouseEnter={(e) => {
        if (!isOutOfStock) {
          e.currentTarget.style.transform = 'translateY(-4px) scale(1.02)';
          e.currentTarget.style.boxShadow = `0 8px 16px ${sectionColors.shadow}`;
        }
      }}
      onMouseLeave={(e) => {
        if (!isOutOfStock) {
          e.currentTarget.style.transform = 'translateY(0) scale(1)';
          e.currentTarget.style.boxShadow = `0 2px 4px ${sectionColors.shadow}`;
        }
      }}
    >
      {/* Item Image or Colored Header */}
      {item.image ? (
        <div style={{ position: 'relative', width: '100%', height: '120px', overflow: 'hidden' }}>
          <img
            src={item.image}
            alt={item.name}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover'
            }}
          />
          {/* Gradient overlay for text readability */}
          <div
            style={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              padding: '0.5rem 0.75rem',
              background: 'linear-gradient(to top, rgba(0,0,0,0.8), transparent)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-end'
            }}
          >
            <span
              style={{
                fontSize: '0.65rem',
                fontWeight: '600',
                padding: '0.15rem 0.5rem',
                borderRadius: '9999px',
                background: 'rgba(255, 255, 255, 0.9)',
                color: '#1f2937'
              }}
            >
              {item.type === 'product' ? 'Product' : 'Service'}
            </span>
            {(isLowStock || isCriticalStock) && !isOutOfStock && (
              <AlertCircle size={14} style={{ color: isCriticalStock ? '#dc2626' : '#fbbf24' }} />
            )}
          </div>
        </div>
      ) : (
        /* Colored Header - COMPACT */
        <div
          style={{
            padding: '0.75rem',
            background: sectionColors.bgCard,
            color: sectionColors.text,
            position: 'relative',
            overflow: 'hidden',
            minHeight: '80px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center'
          }}
        >
          <div
            style={{
              position: 'absolute',
              width: '80px',
              height: '80px',
              borderRadius: '50%',
              background: 'rgba(255, 255, 255, 0.1)',
              top: '-20px',
              right: '-20px',
              filter: 'blur(15px)'
            }}
          />

          <div style={{ position: 'relative', zIndex: 1 }}>
            {/* Item Name - SMALLER with proper wrapping */}
            <h3
              style={{
                fontSize: '0.75rem',
                fontWeight: '700',
                color: '#ffffff',
                margin: '0 0 0.4rem 0',
                lineHeight: '1.3',
                minHeight: '2rem',
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
                wordBreak: 'break-word',
                overflowWrap: 'break-word',
                hyphens: 'auto'
              }}
            >
              {item.name}
            </h3>

            {/* Type Badge - SMALLER */}
            <span
              style={{
                display: 'inline-block',
                padding: '0.15rem 0.5rem',
                fontSize: '0.65rem',
                fontWeight: '600',
                borderRadius: '9999px',
                background: 'rgba(255, 255, 255, 0.25)',
                color: '#ffffff'
              }}
            >
              {item.type === 'product' ? 'Product' : 'Service'}
            </span>

            {(isLowStock || isCriticalStock) && !isOutOfStock && (
              <div style={{
                position: 'absolute',
                top: '0.5rem',
                right: '0.5rem',
                background: isCriticalStock ? '#dc2626' : '#f59e0b',
                color: '#ffffff',
                padding: '0.25rem 0.5rem',
                borderRadius: '9999px',
                fontSize: '0.6rem',
                fontWeight: '700',
                display: 'flex',
                alignItems: 'center',
                gap: '0.25rem'
              }}>
                <AlertCircle size={10} />
                {isCriticalStock ? 'CRITICAL' : 'LOW'}
              </div>
            )}
          </div>
        </div>
      )}

      {/* White Content Area - COMPACT */}
      <div style={{ padding: '0.5rem', flex: 1, display: 'flex', flexDirection: 'column' }}>
        {/* Item name if image is shown */}
        {item.image && (
          <h3
            style={{
              fontSize: '0.75rem',
              fontWeight: '700',
              color: '#1f2937',
              margin: '0 0 0.5rem 0',
              lineHeight: '1.3',
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
              wordBreak: 'break-word',
              overflowWrap: 'break-word',
              hyphens: 'auto'
            }}
          >
            {item.name}
          </h3>
        )}

        {/* Details - SMALLER TEXT */}
        <div style={{ fontSize: '0.65rem', color: '#6b7280', marginBottom: '0.5rem', flex: 1 }}>
          {item.category && (
            <p style={{ margin: '0 0 0.25rem 0', fontWeight: '500' }}>
              📁 {typeof item.category === 'string' ? item.category : item.category.name}
            </p>
          )}
          {item.type === 'product' && (
            <p style={{
              margin: 0,
              color: isCriticalStock ? '#dc2626' : isLowStock ? '#f59e0b' : '#6b7280',
              fontWeight: (isCriticalStock || isLowStock) ? '700' : '400'
            }}>
              📦 {item.quantity} {item.unit || 'units'}
              {isCriticalStock && ' ⚠️'}
              {isLowStock && ' ⚡'}
            </p>
          )}
        </div>

        {/* Price - COMPACT */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingTop: '0.5rem',
            borderTop: `1px solid ${sectionColors.bgLight}`,
            marginTop: 'auto'
          }}
        >
          <div style={{ flex: 1 }}>
            <p style={{ fontSize: '0.6rem', color: '#6b7280', margin: '0 0 0.15rem 0' }}>Price</p>
            <span style={{ fontSize: '1rem', fontWeight: '700', color: sectionColors.textDark, lineHeight: 1 }}>
              {formatCurrency(item.price)}
            </span>
          </div>
          {isOutOfStock && (
            <span style={{ fontSize: '0.65rem', fontWeight: '600', color: '#dc2626' }}>
              Out
            </span>
          )}
        </div>
      </div>
    </button>
  );
}

export default ItemsGrid;