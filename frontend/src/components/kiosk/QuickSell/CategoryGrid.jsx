// src/components/kiosk/QuickSell/CategoryGrid.jsx
import { Grid3x3, Sparkles, Package, AlertCircle } from 'lucide-react';
import { formatCurrency } from '../../../utils/formatters';

function CategoryGrid({ categories, selectedSection, onSelectCategory, onBack, items, onAddToCart, tenantInfo }) {
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
    const lightColor = adjustBrightness(baseColor, 20);
    const darkColor = adjustBrightness(baseColor, -20);
    const textDarkColor = adjustBrightness(baseColor, -40);

    return {
      bg: baseColor,
      light: lightColor,
      dark: darkColor,
      textDark: textDarkColor,
      shadow: hexToRgba(baseColor, 0.3),
      bgLight: hexToRgba(baseColor, 0.15),
      bgCard: `linear-gradient(135deg, ${baseColor} 0%, ${darkColor} 100%)`
    };
  };

  const colors = getSectionColors();

  // Filter categories for selected section
  const sectionCategories = categories.filter(cat => cat.department === selectedSection);

  // Filter items WITHOUT category for this section
  const categoryLessItems = items.filter(item => {
    const hasNoCategory = !item.category || item.category === '' || item.category === null;
    const matchesSection = item.department === selectedSection;
    return hasNoCategory && matchesSection;
  });

  const hasCategories = sectionCategories.length > 0;
  const hasCategoryLessItems = categoryLessItems.length > 0;

  if (!hasCategories && !hasCategoryLessItems) {
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
              margin: '0 auto 2rem',
              borderRadius: '9999px',
              background: `linear-gradient(90deg, ${colors.bg}, ${colors.light})`
            }}
          ></div>
        </div>

        <div style={{ textAlign: 'center', padding: '4rem' }}>
          <Grid3x3 size={64} style={{ color: 'rgba(255, 255, 255, 0.3)', margin: '0 auto 1rem' }} />
          <p style={{ fontSize: '1.125rem', fontWeight: '600', color: '#ffffff', margin: 0 }}>
            No categories or items found for {selectedSection}
          </p>
          <p style={{ fontSize: '0.875rem', color: 'rgba(255, 255, 255, 0.7)', marginTop: '0.5rem' }}>
            Please add categories or items in the admin panel
          </p>
          
          <button
            onClick={onBack}
            style={{
              marginTop: '2rem',
              padding: '0.75rem 2rem',
              fontSize: '14px',
              fontWeight: '600',
              border: '1px solid rgba(255, 255, 255, 0.3)',
              borderRadius: '0.75rem',
              background: 'rgba(255, 255, 255, 0.1)',
              color: '#ffffff',
              cursor: 'pointer',
              fontFamily: 'Inter, sans-serif',
              backdropFilter: 'blur(10px)',
              transition: 'all 0.3s ease'
            }}
          >
            ← Back to Sections
          </button>
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
            background: `linear-gradient(90deg, ${colors.bg}, ${colors.light})`
          }}
        ></div>
      </div>

      {/* Back Button */}
      <div style={{ marginBottom: '2rem' }}>
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
          ← Back to Sections
        </button>
      </div>

      {/* Categories Section */}
      {hasCategories && (
        <div style={{ marginBottom: '2.5rem' }}>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))',
              gap: '1.25rem'
            }}
          >
            {sectionCategories.map((category) => (
              <button
                key={category._id}
                onClick={() => onSelectCategory(category)}
                style={{
                  padding: '2rem 1.5rem',
                  border: 'none',
                  borderRadius: '1.5rem',
                  background: `linear-gradient(135deg, ${colors.bg} 0%, ${colors.dark} 100%)`,
                  color: '#ffffff',
                  fontSize: '1.5rem',
                  fontWeight: '700',
                  cursor: 'pointer',
                  position: 'relative',
                  overflow: 'hidden',
                  boxShadow: '0 10px 30px rgba(0, 0, 0, 0.3)',
                  transition: 'all 0.3s ease',
                  fontFamily: 'Inter, sans-serif',
                  textAlign: 'center',
                  minHeight: '160px'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-8px) scale(1.02)';
                  e.currentTarget.style.boxShadow = '0 20px 40px rgba(0, 0, 0, 0.4)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0) scale(1)';
                  e.currentTarget.style.boxShadow = '0 10px 30px rgba(0, 0, 0, 0.3)';
                }}
              >
                {/* Decorative background */}
                <div
                  style={{
                    position: 'absolute',
                    width: '200px',
                    height: '200px',
                    borderRadius: '50%',
                    background: 'rgba(255, 255, 255, 0.1)',
                    top: '-50px',
                    right: '-50px',
                    filter: 'blur(60px)'
                  }}
                />
                
                {/* Icon */}
                <div style={{ marginBottom: '1rem', position: 'relative', zIndex: 1 }}>
                  <Sparkles size={48} style={{ margin: '0 auto' }} />
                </div>
                
                {/* Category name */}
                <span style={{ position: 'relative', zIndex: 1, display: 'block' }}>
                  {category.name}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Category-less Items Section */}
      {hasCategoryLessItems && (
        <div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(135px, 1fr))',
              gap: '0.65rem'
            }}
          >
            {categoryLessItems.map(item => (
              <ItemCard 
                key={item._id} 
                item={item} 
                onAddToCart={onAddToCart} 
                sectionColors={colors} 
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ItemCard({ item, onAddToCart, sectionColors }) {
  const isLowStock = item.type === 'product' && item.quantity < 10;
  const isOutOfStock = item.type === 'product' && item.quantity === 0;

  return (
    <button
      onClick={() => !isOutOfStock && onAddToCart(item)}
      disabled={isOutOfStock}
      style={{
        padding: '0',
        border: `2px solid ${sectionColors.bg}`,
        borderRadius: '0.75rem',
        background: '#ffffff',
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
      {/* Colored Header */}
      <div 
        style={{
          padding: '0.6rem',
          background: sectionColors.bgCard,
          color: '#ffffff',
          position: 'relative',
          overflow: 'hidden',
          minHeight: '70px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center'
        }}
      >
        <div
          style={{
            position: 'absolute',
            width: '65px',
            height: '65px',
            borderRadius: '50%',
            background: 'rgba(255, 255, 255, 0.1)',
            top: '-15px',
            right: '-15px',
            filter: 'blur(12px)'
          }}
        />
        
        <div style={{ position: 'relative', zIndex: 1 }}>
          {/* Item Name */}
          <h3
            style={{
              fontSize: '0.7rem',
              fontWeight: '700',
              color: '#ffffff',
              margin: '0 0 0.35rem 0',
              lineHeight: '1.2',
              minHeight: '1.8rem',
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden'
            }}
          >
            {item.name}
          </h3>

          {/* Type Badge */}
          <span
            style={{
              display: 'inline-block',
              padding: '0.1rem 0.4rem',
              fontSize: '0.6rem',
              fontWeight: '600',
              borderRadius: '9999px',
              background: 'rgba(255, 255, 255, 0.25)',
              color: '#ffffff'
            }}
          >
            {item.type === 'product' ? 'Product' : 'Service'}
          </span>

          {isLowStock && !isOutOfStock && (
            <AlertCircle size={12} style={{ color: '#fbbf24', position: 'absolute', top: '0.6rem', right: '0.6rem' }} />
          )}
        </div>
      </div>

      {/* White Content Area */}
      <div style={{ padding: '0.6rem', flex: 1, display: 'flex', flexDirection: 'column' }}>
        {/* Details */}
        <div style={{ fontSize: '0.6rem', color: '#6b7280', marginBottom: '0.4rem', flex: 1 }}>
          {item.type === 'product' && (
            <p style={{ margin: 0, color: isLowStock ? '#f59e0b' : '#6b7280', fontWeight: isLowStock ? '600' : '400' }}>
              📦 {item.quantity} {item.unit || 'units'}
            </p>
          )}
        </div>

        {/* Price */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingTop: '0.4rem',
            borderTop: `1px solid ${sectionColors.bgLight}`,
            marginTop: 'auto'
          }}
        >
          <div style={{ flex: 1 }}>
            <p style={{ fontSize: '0.55rem', color: '#6b7280', margin: '0 0 0.1rem 0' }}>Price</p>
            <span style={{ fontSize: '0.9rem', fontWeight: '700', color: sectionColors.textDark, lineHeight: 1 }}>
              {formatCurrency(item.price)}
            </span>
          </div>
          {isOutOfStock && (
            <span style={{ fontSize: '0.6rem', fontWeight: '600', color: '#dc2626' }}>
              Out
            </span>
          )}
        </div>
      </div>
    </button>
  );
}

export default CategoryGrid;