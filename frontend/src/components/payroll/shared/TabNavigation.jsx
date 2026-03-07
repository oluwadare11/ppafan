// TabNavigation.jsx - Reusable tab navigation component for payroll module
import { useState, useRef, useEffect, useCallback } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

const VARIANTS = {
  underlined: {
    container: 'border-b border-gray-200',
    list: 'flex gap-0 -mb-px',
    tab: 'px-4 py-3 text-sm font-medium border-b-2 transition-colors',
    active: 'text-blue-600 border-blue-600',
    inactive: 'text-gray-500 border-transparent hover:text-gray-700 hover:border-gray-300'
  },
  pills: {
    container: 'bg-gray-100 p-1 rounded-lg',
    list: 'flex gap-1',
    tab: 'px-4 py-2 text-sm font-medium rounded-md transition-all',
    active: 'bg-white text-gray-900 shadow-sm',
    inactive: 'text-gray-500 hover:text-gray-700'
  },
  boxed: {
    container: 'bg-white shadow-sm rounded-lg p-1 overflow-hidden',
    list: 'flex gap-1',
    tab: 'px-4 py-2 text-sm font-medium rounded-md transition-all flex items-center gap-2',
    active: 'bg-blue-600 text-white shadow-md',
    inactive: 'text-gray-600 hover:bg-gray-100'
  },
  minimal: {
    container: '',
    list: 'flex gap-6',
    tab: 'pb-3 text-sm font-medium border-b-2 transition-colors',
    active: 'text-gray-900 border-gray-900',
    inactive: 'text-gray-500 border-transparent hover:text-gray-700'
  }
};

function TabNavigation({ tabs, activeTab, onChange, variant = 'underlined', size = 'md', fullWidth = false, scrollable = true, showBadges = true, className = '' }) {
  const [showLeftArrow, setShowLeftArrow] = useState(false);
  const [showRightArrow, setShowRightArrow] = useState(false);
  const scrollContainerRef = useRef(null);
  const variantStyles = VARIANTS[variant] || VARIANTS.underlined;

  const checkScrollPosition = useCallback(() => {
    if (!scrollContainerRef.current || !scrollable) return;
    const { scrollLeft, scrollWidth, clientWidth } = scrollContainerRef.current;
    setShowLeftArrow(scrollLeft > 0);
    setShowRightArrow(scrollLeft < scrollWidth - clientWidth - 1);
  }, [scrollable]);

  useEffect(() => {
    checkScrollPosition();
    window.addEventListener('resize', checkScrollPosition);
    return () => window.removeEventListener('resize', checkScrollPosition);
  }, [checkScrollPosition, tabs]);

  const scroll = (direction) => {
    if (!scrollContainerRef.current) return;
    scrollContainerRef.current.scrollBy({ left: direction === 'left' ? -150 : 150, behavior: 'smooth' });
  };

  return (
    <div className={`relative ${variantStyles.container} ${className}`}>
      {scrollable && showLeftArrow && (
        <button onClick={() => scroll('left')} className="absolute left-0 top-1/2 -translate-y-1/2 z-10 p-1 bg-white rounded-full shadow-md border border-gray-200 hover:bg-gray-50" aria-label="Scroll left">
          <ChevronLeft className="w-4 h-4 text-gray-600" />
        </button>
      )}
      <div ref={scrollContainerRef} onScroll={checkScrollPosition}
        className={`${variantStyles.list} ${fullWidth ? 'w-full' : ''} ${scrollable ? 'overflow-x-auto' : ''}`}
        role="tablist" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          const Icon = tab.icon;
          return (
            <button key={tab.id} role="tab" aria-selected={isActive} disabled={tab.disabled}
              onClick={() => !tab.disabled && onChange(tab.id)}
              className={`${variantStyles.tab} ${isActive ? variantStyles.active : variantStyles.inactive} ${fullWidth ? 'flex-1 justify-center' : ''} ${tab.disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'} whitespace-nowrap`}>
              {Icon && <Icon className={`${size === 'sm' ? 'w-3.5 h-3.5' : 'w-4 h-4'}`} />}
              <span>{tab.label}</span>
              {showBadges && tab.badge !== undefined && tab.badge !== null && (
                <span className={`ml-1.5 px-1.5 py-0.5 rounded-full text-xs font-medium ${isActive ? (variant === 'boxed' ? 'bg-blue-500 text-white' : 'bg-blue-100 text-blue-700') : 'bg-gray-100 text-gray-600'}`}>
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>
      {scrollable && showRightArrow && (
        <button onClick={() => scroll('right')} className="absolute right-0 top-1/2 -translate-y-1/2 z-10 p-1 bg-white rounded-full shadow-md border border-gray-200 hover:bg-gray-50" aria-label="Scroll right">
          <ChevronRight className="w-4 h-4 text-gray-600" />
        </button>
      )}
    </div>
  );
}

export function SubTabs({ tabs, activeTab, onChange, className = '' }) {
  return (
    <div className={`flex gap-4 pb-2 border-b border-gray-200 ${className}`}>
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        return (
          <button key={tab.id} onClick={() => onChange(tab.id)} disabled={tab.disabled}
            className={`text-sm font-medium pb-2 border-b-2 -mb-px transition-colors ${isActive ? 'text-blue-600 border-blue-600' : 'text-gray-500 border-transparent hover:text-gray-700'} ${tab.disabled ? 'opacity-50 cursor-not-allowed' : ''}`}>
            {tab.label}
            {tab.count !== undefined && <span className={`ml-1.5 text-xs ${isActive ? 'text-blue-500' : 'text-gray-400'}`}>({tab.count})</span>}
          </button>
        );
      })}
    </div>
  );
}

export function VerticalTabs({ tabs, activeTab, onChange, className = '' }) {
  return (
    <nav className={`space-y-1 ${className}`}>
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        const Icon = tab.icon;
        return (
          <button key={tab.id} onClick={() => onChange(tab.id)} disabled={tab.disabled}
            className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-lg transition-colors ${isActive ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-50'} ${tab.disabled ? 'opacity-50 cursor-not-allowed' : ''}`}>
            {Icon && <Icon className="w-5 h-5" />}
            <span className="flex-1 text-left">{tab.label}</span>
            {tab.badge !== undefined && (
              <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${isActive ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'}`}>{tab.badge}</span>
            )}
          </button>
        );
      })}
    </nav>
  );
}

export function TabPanel({ id, activeTab, children, className = '' }) {
  if (activeTab !== id) return null;
  return <div role="tabpanel" id={`${id}-panel`} aria-labelledby={`tab-${id}`} className={className}>{children}</div>;
}

export default TabNavigation;
