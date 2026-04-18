// App.jsx - PPAfan Attendance Management System
import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import React, { useContext, useEffect, useState, memo, Suspense, lazy } from "react";
import { AuthContext } from "./context/AuthContext.jsx";
import { AuthProvider } from "./context/AuthContextDefinition.jsx";
import { TenantProvider, useTenant } from "./context/TenantProvider.jsx";

// =============================================================================
// CRITICAL: Login and SessionExpired loaded immediately for fast initial render
// =============================================================================
import Login from "./components/Login";
import SessionExpired from "./components/SessionExpired";

// =============================================================================
// LAZY LOADED COMPONENTS - Only loaded when user navigates to them
// =============================================================================

// Core Layout
const Sidebar = lazy(() => import("./components/Sidebar"));

// Main Modules (loaded after login)
const Attendance = lazy(() => import("./components/Attendance"));
const Settings = lazy(() => import("./components/Settings"));
const Payroll = lazy(() => import("./components/Payroll"));

// Toast notifications
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

// Simple loading spinner - shown only in content area, sidebar stays visible
const LazyLoadSpinner = () => (
  <div className="flex items-center justify-center min-h-[60vh] w-full">
    <div className="text-center">
      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mx-auto mb-3"></div>
      <p className="text-sm text-gray-500">Loading...</p>
    </div>
  </div>
);

// =============================================================================
// PRELOAD: Load all modules after initial render for instant navigation
// =============================================================================
const preloadModules = () => {
  // First batch - Core modules (most used)
  import("./components/Attendance");

  // Second batch - Settings and Payroll
  setTimeout(() => {
    import("./components/Settings");
    import("./components/Payroll");
  }, 100);
};

// Trigger preload after page becomes idle
if (typeof window !== 'undefined') {
  if ('requestIdleCallback' in window) {
    window.requestIdleCallback(preloadModules, { timeout: 1500 });
  } else {
    setTimeout(preloadModules, 800);
  }
}

// Service Worker registration
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then((registration) => {
        console.log('Service Worker registered:', registration.scope);
      })
      .catch((error) => {
        console.log('Service Worker registration failed:', error);
      });
  });
}

// Error Boundary
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Error Boundary caught an error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex items-center justify-center min-h-screen bg-gray-50">
          <div className="text-center max-w-md mx-auto p-8">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-red-500 font-bold text-xl">!</span>
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-4">Something went wrong</h1>
            <p className="text-gray-600 mb-6">Please try refreshing the page.</p>
            <button
              onClick={() => window.location.reload()}
              className="w-full bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition font-medium"
            >
              Refresh Page
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

// Protected Route Component
const ProtectedRoute = memo(({ children, isKiosk, requiredPermission }) => {
  const { user, loading } = useContext(AuthContext);
  const location = useLocation();

  // For kiosk routes, check localStorage for kioskUser
  const kioskUser = isKiosk ? (() => {
    try {
      const stored = localStorage.getItem('kioskUser');
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  })() : null;

  const activeUser = isKiosk ? kioskUser : user;

  // Show loading only during initial auth check, not during navigation
  if (loading && !kioskUser && !user) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mx-auto mb-3"></div>
          <p className="text-gray-500 text-sm">Verifying session...</p>
        </div>
      </div>
    );
  }

  if (!activeUser) {
    // For kiosk routes, include redirect parameter
    if (isKiosk) {
      return <Navigate to={`/kiosk/login`} replace state={{ from: location }} />;
    }
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  // Permission check for admin routes (not kiosk)
  if (!isKiosk && requiredPermission && activeUser.role === 'custom') {
    const hasPermission = activeUser.permissions?.[requiredPermission] === true;
    if (!hasPermission) {
      // Redirect to first permitted module instead of showing access denied
      const moduleRoutes = [
        { key: 'attendance', route: '/' },
        { key: 'payroll', route: '/payroll' },
        { key: 'settings', route: '/settings' },
      ];
      const firstPermitted = moduleRoutes.find(m => activeUser.permissions?.[m.key] === true);
      if (firstPermitted) {
        return <Navigate to={firstPermitted.route} replace />;
      }
      // Fallback: no permissions at all
      return (
        <div className="flex items-center justify-center min-h-[60vh] bg-gray-50">
          <div className="text-center max-w-md mx-auto p-8">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-red-500 font-bold text-xl">!</span>
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-4">Access Denied</h1>
            <p className="text-gray-600 mb-6">You don't have permission to access any module. Contact your administrator.</p>
            <button
              onClick={() => window.history.back()}
              className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition font-medium"
            >
              Go Back
            </button>
          </div>
        </div>
      );
    }
  }

  return children;
});

// Main App Routes
const AppRoutes = memo(() => {
  const { user, loading, error } = useContext(AuthContext);
  const { tenantInfo, loading: tenantLoading } = useTenant();
  const [showSidebar, setShowSidebar] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    const isKioskRoute = location.pathname.startsWith("/kiosk");
    const isPublicRoute = ["/login", "/kiosk/login"].includes(location.pathname);
    const shouldShowSidebar = user && !isKioskRoute && !isPublicRoute;
    setShowSidebar(shouldShowSidebar);
    setMobileMenuOpen(false);
  }, [location.pathname, user]);

  // Only show full-page loading on initial app load, not during navigation
  if ((loading || tenantLoading) && !user) {
    return (
      <div className="flex items-center justify-center min-h-screen w-full bg-gradient-to-br from-blue-50 to-indigo-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-600 mx-auto mb-6"></div>
          <h2 className="text-xl font-semibold text-gray-700 mb-2">Loading PPAfan...</h2>
          <p className="text-gray-500">Please wait</p>
        </div>
      </div>
    );
  }

  if (error && !loading && !user) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-red-50">
        <div className="text-center max-w-md mx-auto p-8">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-red-500 font-bold text-xl">!</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Connection Problem</h1>
          <p className="text-gray-600 mb-6">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="bg-red-600 text-white px-6 py-3 rounded-lg hover:bg-red-700 transition font-medium"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Mobile Menu Button */}
      {showSidebar && (
        <button
          onClick={() => setMobileMenuOpen(true)}
          className="fixed top-4 right-4 z-[100] p-2 bg-gray-800 text-white rounded-lg shadow-lg md:hidden hover:bg-gray-700 transition-colors"
          aria-label="Open menu"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
      )}

      {/* Sidebar - ALWAYS visible when authenticated, uses fallback={null} so no flash */}
      {showSidebar && (
        <Suspense fallback={null}>
          <Sidebar isOpen={mobileMenuOpen} onClose={() => setMobileMenuOpen(false)} />
        </Suspense>
      )}

      {/* Main Content - block element fills width minus sidebar margin */}
      <main className={`min-h-screen transition-all duration-300 ${showSidebar ? "md:ml-60" : ""}`}>
        <Suspense fallback={<LazyLoadSpinner />}>
          <Routes>
            {/* Public Routes */}
            <Route path="/login" element={<Login />} />
            <Route path="/session-expired" element={<SessionExpired />} />

            {/* Protected Routes - NO individual Suspense, handled by outer Suspense */}
            <Route path="/" element={
              <ProtectedRoute requiredPermission="attendance">
                <Attendance />
              </ProtectedRoute>
            } />
            <Route path="/attendance" element={
              <ProtectedRoute requiredPermission="attendance">
                <Attendance />
              </ProtectedRoute>
            } />
            <Route path="/settings" element={
              <ProtectedRoute requiredPermission="settings">
                <Settings />
              </ProtectedRoute>
            } />
            <Route path="/payroll" element={
              <ProtectedRoute requiredPermission="payroll">
                <Payroll />
              </ProtectedRoute>
            } />

            {/* Fallback */}
            <Route path="*" element={<Navigate to="/login" replace />} />
          </Routes>
        </Suspense>
      </main>
    </div>
  );
});

// Main App Component
function App() {
  return (
    <ErrorBoundary>
      <TenantProvider>
        <AuthProvider>
          <AppRoutes />
          <ToastContainer
            position="top-right"
            autoClose={3000}
            hideProgressBar={false}
            newestOnTop={false}
            closeOnClick
            rtl={false}
            pauseOnFocusLoss
            draggable
            pauseOnHover
            theme="colored"
          />
        </AuthProvider>
      </TenantProvider>
    </ErrorBoundary>
  );
}

export default App;
