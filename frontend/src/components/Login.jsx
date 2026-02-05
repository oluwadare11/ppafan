// Login.jsx - PPAfan Attendance System - Clean, Fast Login
import React, { useState, useEffect, useContext, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Eye, EyeOff, ArrowRight, AlertCircle } from "lucide-react";
import { AuthContext } from "../context/AuthContext.jsx";
import { useTenant } from "../context/TenantProvider.jsx";

// reCAPTCHA Site Key - replace with your actual key from Google reCAPTCHA admin
const RECAPTCHA_SITE_KEY = import.meta.env.VITE_RECAPTCHA_SITE_KEY || '';

const Login = () => {
  const { login, user, loading: authLoading, error: authError } = useContext(AuthContext);
  const { tenantInfo, navigateWithTenant, getTenantDashboardUrl } = useTenant();
  const navigate = useNavigate();

  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({ username: "", password: "" });
  const [errors, setErrors] = useState({});
  const [apiMessage, setApiMessage] = useState("");

  // Get reCAPTCHA token with retry logic
  const getRecaptchaToken = useCallback(async () => {
    if (!RECAPTCHA_SITE_KEY) {
      console.log('reCAPTCHA not configured');
      return null;
    }

    // Wait for grecaptcha to be ready with timeout
    const waitForRecaptcha = () => new Promise((resolve) => {
      if (window.grecaptcha && window.grecaptcha.execute) {
        resolve(true);
        return;
      }

      let attempts = 0;
      const maxAttempts = 20; // 10 seconds max
      const checkInterval = setInterval(() => {
        attempts++;
        if (window.grecaptcha && window.grecaptcha.execute) {
          clearInterval(checkInterval);
          resolve(true);
        } else if (attempts >= maxAttempts) {
          clearInterval(checkInterval);
          resolve(false);
        }
      }, 500);
    });

    const ready = await waitForRecaptcha();
    if (!ready) {
      console.warn('reCAPTCHA not ready after timeout');
      return null;
    }

    try {
      const token = await window.grecaptcha.execute(RECAPTCHA_SITE_KEY, { action: 'login' });
      console.log('reCAPTCHA token generated successfully');
      return token;
    } catch (err) {
      console.warn('reCAPTCHA token generation failed:', err);
      return null;
    }
  }, []);

  // Pre-fill username if available
  useEffect(() => {
    const lastUser = localStorage.getItem("lastLoginUser");
    if (lastUser) setFormData(prev => ({ ...prev, username: lastUser }));
  }, []);

  // Get the first permitted route for a user (PPAfan: attendance is default)
  const getFirstPermittedRoute = useCallback((userData) => {
    if (!userData || userData.role === 'admin') return '/';
    if (userData.role === 'custom' && userData.permissions) {
      const moduleRoutes = [
        { key: 'attendance', route: '/' },
        { key: 'settings', route: '/settings' },
      ];
      const first = moduleRoutes.find(m => userData.permissions[m.key] === true);
      return first ? first.route : '/';
    }
    return '/';
  }, []);

  // Redirect if already logged in
  useEffect(() => {
    if (user && !authLoading) {
      const redirectRoute = getFirstPermittedRoute(user);
      navigateWithTenant(redirectRoute, { replace: true });
    }
  }, [user, authLoading, navigateWithTenant, getFirstPermittedRoute]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors(prev => ({ ...prev, [name]: "" }));
    if (apiMessage) setApiMessage("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validate
    const newErrors = {};
    if (!formData.username) newErrors.username = "Username is required";
    if (!formData.password) newErrors.password = "Password is required";
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setLoading(true);
    setApiMessage("");

    try {
      // Get reCAPTCHA token if configured
      const recaptchaToken = await getRecaptchaToken();

      const { user } = await login(formData.username, formData.password, false, recaptchaToken);
      localStorage.setItem("lastLoginUser", formData.username);

      if (user.requirePasswordChange) {
        navigate('/change-password', { state: { tempToken: user.token, username: user.username } });
        return;
      }

      const redirectRoute = getFirstPermittedRoute(user);
      navigateWithTenant(redirectRoute, { replace: true });
    } catch (error) {
      setApiMessage(error.message || "Login failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const businessName = tenantInfo?.businessName || 'PPAfan';
  const logoUrl = tenantInfo?.branding?.logo;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-blue-900 to-slate-800 p-4">
      <div className="w-full max-w-md">
        {/* Logo & Header */}
        <div className="text-center mb-8">
          <div className="mx-auto w-32 h-20 sm:w-40 sm:h-24 mb-4 bg-white rounded-xl p-2 shadow-lg">
            <img
              src={logoUrl || "/ppafan-logo.png"}
              alt={businessName}
              className="w-full h-full object-contain"
              onError={(e) => { e.target.src = "/ppafan-logo.png"; }}
            />
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white mb-2">{businessName}</h1>
          <p className="text-white/70 text-sm">Sign in to manage attendance</p>
          <div className="w-16 h-1 bg-gradient-to-r from-blue-500 to-cyan-400 rounded-full mx-auto mt-3"></div>
        </div>

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="bg-white/95 backdrop-blur-md rounded-2xl shadow-2xl p-6 sm:p-8">
          <div className="text-center mb-6">
            <h2 className="text-xl font-bold text-gray-800">Welcome Back</h2>
            <p className="text-gray-500 text-sm mt-1">Enter your credentials</p>
          </div>

          {/* Error Message */}
          {(apiMessage || authError) && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
              <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
              <p className="text-red-600 text-sm">{apiMessage || authError}</p>
            </div>
          )}

          {/* Username */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">Username</label>
            <input
              type="text"
              name="username"
              value={formData.username}
              onChange={handleInputChange}
              placeholder="Enter username"
              autoComplete="username"
              className={`w-full px-4 py-3 border rounded-xl focus:outline-none focus:ring-2 transition-all ${
                errors.username ? "border-red-300 focus:ring-red-200" : "border-gray-300 focus:ring-blue-200 focus:border-blue-400"
              }`}
            />
            {errors.username && <p className="text-red-500 text-xs mt-1">{errors.username}</p>}
          </div>

          {/* Password */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                name="password"
                value={formData.password}
                onChange={handleInputChange}
                placeholder="Enter password"
                autoComplete="current-password"
                className={`w-full px-4 py-3 pr-12 border rounded-xl focus:outline-none focus:ring-2 transition-all ${
                  errors.password ? "border-red-300 focus:ring-red-200" : "border-gray-300 focus:ring-blue-200 focus:border-blue-400"
                }`}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
            {errors.password && <p className="text-red-500 text-xs mt-1">{errors.password}</p>}
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading || authLoading}
            className="w-full bg-gradient-to-r from-blue-600 to-cyan-500 text-white py-3 rounded-xl font-semibold hover:from-blue-700 hover:to-cyan-600 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loading || authLoading ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
            ) : (
              <>Sign In <ArrowRight className="w-5 h-5" /></>
            )}
          </button>

        </form>

        {/* Footer */}
        <p className="text-center text-white/40 text-xs mt-6">
          © 2026 {businessName}. Attendance Management System
        </p>
      </div>
    </div>
  );
};

export default Login;
