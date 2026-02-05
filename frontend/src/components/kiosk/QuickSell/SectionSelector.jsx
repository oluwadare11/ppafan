// src/components/kiosk/QuickSell/SectionSelector.jsx

/**
 * Dynamic Section Selector Component
 * Displays category sections derived from POS items
 * Uses tenant branding colors for styling
 */
function SectionSelector({ sections, selectedSection, onSelectSection, tenantInfo }) {
  // If a section is selected, don't show the selector
  if (selectedSection) {
    return null;
  }

  // Helper function to adjust color brightness
  const adjustBrightness = (color, percent) => {
    // Simple brightness adjustment - convert hex to RGB, adjust, convert back
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

  // Generate color for each section based on index and tenant branding
  const getSectionColor = (index) => {
    const colors = [
      tenantInfo?.branding?.primaryColor || '#3b82f6',
      tenantInfo?.branding?.secondaryColor || '#10b981',
      tenantInfo?.branding?.accentColor || '#a855f7'
    ];
    const baseColor = colors[index % colors.length];
    const darkerColor = adjustBrightness(baseColor, -20);

    return {
      base: baseColor,
      darker: darkerColor,
      gradient: `linear-gradient(135deg, ${baseColor} 0%, ${darkerColor} 100%)`
    };
  };

  // Empty state when no sections available
  if (!sections || sections.length === 0) {
    return (
      <div
        style={{
          padding: '3rem',
          fontFamily: 'Inter, system-ui, sans-serif',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '60vh'
        }}
      >
        <div
          style={{
            background: 'rgba(255, 255, 255, 0.95)',
            padding: '3rem',
            borderRadius: '1.5rem',
            boxShadow: '0 20px 40px rgba(0, 0, 0, 0.2)',
            textAlign: 'center',
            maxWidth: '600px'
          }}
        >
          <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>📦</div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: '700', color: '#1f2937', marginBottom: '1rem' }}>
            No Items Configured
          </h2>
          <p style={{ fontSize: '1rem', color: '#6b7280', marginBottom: '1.5rem' }}>
            Please add items in POS Admin to get started. Items can optionally be assigned to categories.
          </p>
          <div
            style={{
              background: '#f3f4f6',
              padding: '1rem',
              borderRadius: '0.5rem',
              fontSize: '0.875rem',
              color: '#4b5563',
              textAlign: 'left'
            }}
          >
            <strong>How to add items:</strong>
            <ol style={{ marginTop: '0.5rem', paddingLeft: '1.5rem' }}>
              <li>Go to POS Admin</li>
              <li>Add or edit POS items</li>
              <li>Optionally set the "Category" field for each item</li>
              <li>Categories will appear here automatically</li>
            </ol>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        padding: 'clamp(1rem, 4vw, 2rem)',
        fontFamily: 'Inter, system-ui, sans-serif'
      }}
    >
      {/* Title */}
      <div style={{ textAlign: 'center', marginBottom: 'clamp(1.5rem, 4vw, 2rem)' }}>
        <p style={{ fontSize: 'clamp(1rem, 2.5vw, 1.5rem)', color: 'rgba(255, 255, 255, 0.95)', fontWeight: '500' }}>
          Select a category to begin
        </p>
      </div>

      {/* Section Cards - Compact Square Grid */}
      <div
        style={{
          maxWidth: '900px',
          margin: '0 auto',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
          gap: '1rem',
          justifyItems: 'center',
          padding: '0 1rem'
        }}
      >
        {sections.map((sectionName, index) => {
          const colors = getSectionColor(index);

          return (
            <button
              key={sectionName}
              onClick={() => onSelectSection(sectionName)}
              style={{
                width: '100%',
                maxWidth: '160px',
                aspectRatio: '1 / 1',
                padding: '1rem 0.75rem',
                border: 'none',
                borderRadius: '0.75rem',
                background: colors.gradient,
                color: '#ffffff',
                fontSize: '0.875rem',
                fontWeight: '700',
                cursor: 'pointer',
                position: 'relative',
                overflow: 'hidden',
                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.2)',
                transition: 'all 0.3s ease',
                fontFamily: 'Inter, sans-serif',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                textAlign: 'center'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-4px) scale(1.02)';
                e.currentTarget.style.boxShadow = '0 8px 20px rgba(0, 0, 0, 0.3)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0) scale(1)';
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.2)';
              }}
            >
              {/* Decorative circle */}
              <div
                style={{
                  position: 'absolute',
                  width: '80px',
                  height: '80px',
                  borderRadius: '50%',
                  background: 'rgba(255, 255, 255, 0.1)',
                  top: '50%',
                  left: '50%',
                  transform: 'translate(-50%, -50%)',
                  filter: 'blur(20px)'
                }}
              />

              {/* Section name with proper text wrapping */}
              <span
                style={{
                  position: 'relative',
                  zIndex: 1,
                  wordWrap: 'break-word',
                  overflowWrap: 'break-word',
                  hyphens: 'auto',
                  maxWidth: '100%',
                  lineHeight: '1.3',
                  display: '-webkit-box',
                  WebkitLineClamp: 3,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                  padding: '0 0.25rem'
                }}
              >
                {sectionName}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default SectionSelector;
