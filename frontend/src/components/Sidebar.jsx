// Sidebar.jsx - PPAfan Attendance System Navigation
import { NavLink, useNavigate } from 'react-router-dom';
import {
  Clock, LogOut, Settings, X, ChevronRight, Calculator
} from 'lucide-react';
import { useContext, useEffect, useState } from 'react';
import { AuthContext } from '../context/AuthContext.jsx';
import { useTenant } from '../context/TenantProvider.jsx';

function Sidebar({ isOpen = true, onClose = () => {} }) {
  const { logout, user } = useContext(AuthContext);
  const { tenantInfo } = useTenant();
  const navigate = useNavigate();
  const [logoError, setLogoError] = useState(false);

  useEffect(() => {
    setLogoError(false);
  }, [tenantInfo?.branding?.logo]);

  // Prefetch module on hover
  const prefetchModule = (route) => {
    const moduleMap = {
      '/': () => import('./Attendance'),
      '/attendance': () => import('./Attendance'),
      '/payroll': () => import('./Payroll'),
      '/settings': () => import('./Settings'),
    };
    if (moduleMap[route]) {
      moduleMap[route]();
    }
  };

  // PPAfan navigation items
  const allNavItems = [
    { to: '/', label: 'Attendance', icon: Clock, permissionKey: 'attendance' },
    { to: '/payroll', label: 'Payroll', icon: Calculator, permissionKey: 'payroll' },
  ];

  // Filter nav items based on user permissions
  // Admin role has full access, custom role uses permissions object
  const navItems = allNavItems.filter(item => {
    if (user?.role === 'admin') return true; // Admin has full access
    if (user?.role === 'custom' && user?.permissions) {
      return user.permissions[item.permissionKey] === true;
    }
    return true; // Default show for other roles
  });

  // Check if user can access settings (settings permission covers both Settings page and User Management)
  const canAccessSettings = user?.role === 'admin' || user?.permissions?.settings === true;

  const handleLogout = async () => {
    try {
      await logout();
      onClose();
      window.location.href = '/login';
    } catch (error) {
      console.error('Logout error:', error);
      window.location.href = '/login';
    }
  };

  const handleNavClick = () => {
    if (window.innerWidth < 768) {
      onClose();
    }
  };

  // Get branding - PPAfan defaults
  const primaryColor = tenantInfo?.branding?.primaryColor || '#2563EB';
  const businessName = tenantInfo?.businessName || 'PPAfan';
  const logoUrl = tenantInfo?.branding?.logo || '/ppafan-logo.png';

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 md:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed top-0 left-0 z-50 h-full w-60
          bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950
          text-white shadow-xl
          transform transition-transform duration-300 ease-in-out
          flex flex-col
          ${isOpen ? 'translate-x-0' : '-translate-x-full'}
          md:translate-x-0
        `}
      >
        {/* Header - Logo & Business Name */}
        <div className="flex items-center justify-between px-4 py-5 border-b border-slate-700/50">
          <div className="flex items-center gap-3">
            {logoUrl && !logoError ? (
              <img
                src={logoUrl}
                alt={businessName}
                className="h-9 w-9 rounded-lg object-contain bg-white p-0.5 shadow-sm"
                onError={() => setLogoError(true)}
              />
            ) : (
              <div
                className="h-9 w-9 rounded-lg flex items-center justify-center text-white font-bold text-sm shadow-sm"
                style={{ backgroundColor: primaryColor }}
              >
                {businessName.charAt(0)}
              </div>
            )}
            <div className="flex flex-col">
              <span className="font-semibold text-sm text-white truncate max-w-[140px]">
                {businessName}
              </span>
              <span className="text-[10px] text-slate-400 font-medium">Attendance System</span>
            </div>
          </div>

          {/* Mobile close button */}
          <button
            onClick={onClose}
            className="md:hidden p-1.5 hover:bg-slate-700/50 rounded-lg transition-colors"
          >
            <X className="h-4 w-4 text-slate-400" />
          </button>
        </div>

        {/* Main Navigation */}
        <nav className="flex-1 py-4 overflow-y-auto">
          <div className="px-3 mb-2">
            <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider px-3">
              Menu
            </span>
          </div>
          <ul className="space-y-0.5 px-3">
            {navItems.map((item) => (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  onClick={handleNavClick}
                  onMouseEnter={() => prefetchModule(item.to)}
                  className={({ isActive }) =>
                    `group flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 ${
                      isActive
                        ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/25'
                        : 'text-slate-300 hover:bg-slate-800/60 hover:text-white'
                    }`
                  }
                >
                  {({ isActive }) => (
                    <>
                      <item.icon className={`h-[18px] w-[18px] flex-shrink-0 ${isActive ? 'text-white' : 'text-slate-400 group-hover:text-slate-200'}`} />
                      <span className="text-sm font-medium">{item.label}</span>
                      {isActive && <ChevronRight className="h-4 w-4 ml-auto opacity-60" />}
                    </>
                  )}
                </NavLink>
              </li>
            ))}
          </ul>

          {/* Settings - Only show if user has access */}
          {canAccessSettings && (
            <div className="mt-6 px-3">
              <div className="mb-2">
                <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider px-3">
                  System
                </span>
              </div>
              <NavLink
                to="/settings"
                onClick={handleNavClick}
                onMouseEnter={() => prefetchModule('/settings')}
                className={({ isActive }) =>
                  `group flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 ${
                    isActive
                      ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/25'
                      : 'text-slate-300 hover:bg-slate-800/60 hover:text-white'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <Settings className={`h-[18px] w-[18px] ${isActive ? 'text-white' : 'text-slate-400 group-hover:text-slate-200'}`} />
                    <span className="text-sm font-medium">Settings</span>
                    {isActive && <ChevronRight className="h-4 w-4 ml-auto opacity-60" />}
                  </>
                )}
              </NavLink>
            </div>
          )}
        </nav>

        {/* Bottom Section - User Info & Logout */}
        <div className="mt-auto border-t border-slate-700/50">
          {/* User info */}
          {user && (
            <div className="px-4 py-3">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-sm font-semibold shadow-sm">
                  {user.firstName?.charAt(0) || user.username?.charAt(0) || 'U'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">
                    {user.firstName || user.username}
                  </p>
                  <p className="text-xs text-slate-400 capitalize">{user.role?.replace('_', ' ')}</p>
                </div>
              </div>
            </div>
          )}

          {/* Logout - Always last */}
          <div className="px-3 pb-4">
            <button
              onClick={handleLogout}
              className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg
                bg-slate-800/40 text-slate-300
                hover:bg-red-500/90 hover:text-white
                transition-all duration-200 group"
            >
              <LogOut className="h-4 w-4 group-hover:scale-110 transition-transform" />
              <span className="text-sm font-medium">Sign Out</span>
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}

export default Sidebar;
