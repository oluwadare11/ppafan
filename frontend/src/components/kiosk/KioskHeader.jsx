import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTenant } from '../../context/TenantProvider';
import { ShoppingCart, Package, Users, LogOut } from 'lucide-react';

/**
 * Unified Kiosk Header Component
 * Provides role-based navigation for kiosk mode
 * - Cashier: QuickSell + Inventory
 * - Manager/Receptionist/Customer Service: QuickSell + Inventory + Visitor
 */
function KioskHeader() {
  const navigate = useNavigate();
  const location = useLocation();
  const { tenantInfo, loading: tenantLoading } = useTenant();
  const [kioskUser, setKioskUser] = useState(null);

  // Validate and load kiosk user on mount
  // Note: Auth is cookie-based, so we only check for user data in localStorage
  useEffect(() => {
    try {
      const storedUser = localStorage.getItem('kioskUser');

      if (!storedUser) {
        console.warn('No kiosk user found, redirecting to login');
        navigate('/kiosk/login', { replace: true });
        return;
      }

      const parsedUser = JSON.parse(storedUser);

      // Validate user has minimum required fields (backend returns 'id', not '_id')
      if (!parsedUser || (!parsedUser.id && !parsedUser._id) || !parsedUser.role) {
        console.warn('Invalid kiosk user data, redirecting to login');
        localStorage.removeItem('kioskUser');
        navigate('/kiosk/login', { replace: true });
        return;
      }

      setKioskUser(parsedUser);
    } catch (error) {
      console.error('Error parsing kiosk user data:', error);
      localStorage.removeItem('kioskUser');
      navigate('/kiosk/login', { replace: true });
    }
  }, [navigate]);

  // Extract display name from user data
  const getDisplayName = () => {
    if (kioskUser?.firstName) return kioskUser.firstName;
    if (kioskUser?.username) {
      const firstName = kioskUser.username.split('.')[0];
      return firstName.charAt(0).toUpperCase() + firstName.slice(1).toLowerCase();
    }
    return 'Staff';
  };

  // Get role display text
  const getRoleDisplay = () => {
    if (!kioskUser?.role) return 'Staff';
    return kioskUser.role.charAt(0).toUpperCase() + kioskUser.role.slice(1).toLowerCase();
  };

  // Define menu items based on role
  const getMenuItems = () => {
    const baseItems = [
      { path: '/kiosk/quicksell', label: 'QuickSell', icon: ShoppingCart },
      { path: '/kiosk/inventory', label: 'StockFlow', icon: Package }
    ];

    // Add Visitor for Tier 3 tenants only
    // Tier 1: Basic POS, Tier 2: +Inventory, Tier 3: +Visitor
    const tier = tenantInfo?.tier || 1;
    if (tier >= 3) {
      baseItems.push({
        path: '/kiosk/visitor',
        label: 'Visitor',
        icon: Users
      });
    }

    return baseItems;
  };

  const menuItems = getMenuItems();

  // Check if current path is active
  const isActive = (path) => location.pathname === path;

  // Get theme color based on current page
  const getThemeColor = () => {
    if (location.pathname === '/kiosk/quicksell') return tenantInfo?.branding?.primaryColor || '#3b82f6';
    if (location.pathname === '/kiosk/inventory') return '#10b981';
    if (location.pathname === '/kiosk/visitor') return '#14b8a6';
    return tenantInfo?.branding?.primaryColor || '#3b82f6';
  };

  const themeColor = getThemeColor();

  // Handle logout
  const handleLogout = async () => {
    try {
      // Clear localStorage first
      localStorage.removeItem('kioskAuthToken');
      localStorage.removeItem('kioskUser');
      localStorage.removeItem('csrfToken');

      // Call backend to clear HTTP-only cookies
      const tenantId = tenantInfo?.tenantId || new URLSearchParams(window.location.search).get('tenant');
      const apiUrl = import.meta.env.VITE_API_URL || '';

      await fetch(`${apiUrl}/api/auth/kiosk-logout`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'X-Tenant-ID': tenantId
        }
      });
    } catch (error) {
      console.error('Kiosk logout error:', error);
    } finally {
      // Force full page reload to kiosk login to clear all state
      const tenantParam = new URLSearchParams(window.location.search).get('tenant');
      window.location.href = tenantParam ? `/kiosk/login?tenant=${tenantParam}` : '/kiosk/login';
    }
  };

  // Show loading state while validating user or loading tenant
  if (!kioskUser || tenantLoading) {
    return (
      <header className="sticky top-0 z-50 backdrop-blur-md shadow-md bg-white">
        <div className="max-w-full px-6 py-3">
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
          </div>
        </div>
      </header>
    );
  }

  return (
    <header
      className="sticky top-0 z-50 backdrop-blur-md shadow-md"
      style={{
        background: 'rgba(255, 255, 255, 0.95)',
        borderBottom: `2px solid ${themeColor}`
      }}
    >
      <div className="max-w-full px-6 py-3">
        <div className="flex items-center justify-between">
          {/* Navigation Tabs */}
          <nav className="flex items-center space-x-2">
            {menuItems.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.path);

              return (
                <button
                  key={item.path}
                  onClick={() => navigate(item.path)}
                  className="flex items-center space-x-2 px-4 py-2 rounded-lg font-medium transition-all duration-200"
                  style={{
                    background: active ? themeColor : 'transparent',
                    color: active ? '#ffffff' : '#4b5563',
                    transform: active ? 'translateY(-2px)' : 'none',
                    boxShadow: active ? `0 4px 12px ${themeColor}40` : 'none'
                  }}
                >
                  <Icon size={20} />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>

          {/* User Info and Logout */}
          <div className="flex items-center space-x-4">
            {/* User Display */}
            <div className="text-right">
              <div className="text-sm font-semibold text-gray-800">
                {getRoleDisplay()}: {getDisplayName()}
              </div>
              <div className="text-xs text-gray-500">
                {tenantInfo?.businessName || 'Pump House ERP'}
              </div>
            </div>

            {/* Logout Button */}
            <button
              onClick={handleLogout}
              className="flex items-center space-x-2 px-4 py-2 rounded-lg font-medium transition-all duration-200 bg-red-50 text-red-600 hover:bg-red-100"
              title="Logout"
            >
              <LogOut size={18} />
              <span>Logout</span>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}

export default KioskHeader;
