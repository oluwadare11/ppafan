import { useState, useEffect, useContext } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { AuthContext } from '../../context/AuthContext.jsx';
import { Sparkles, Heart, Star, Hash, Lock, ArrowRight, Delete, RotateCcw } from 'lucide-react';
import axios from 'axios';

function KioskLogin() {
  const [employeeCode, setEmployeeCode] = useState('');
  const [pin, setPin] = useState('');
  const [activeField, setActiveField] = useState('employeeCode'); // 'employeeCode' or 'pin'
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingStaff, setLoadingStaff] = useState(false);
  const [staffName, setStaffName] = useState('');
  const [floatingElements, setFloatingElements] = useState([]);
  const { login } = useContext(AuthContext);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // API configuration
  const API_BASE_URL = import.meta.env.VITE_API_URL || "";

  // Clear any admin session on mount
  useEffect(() => {
    localStorage.removeItem('adminAuthToken');
    localStorage.removeItem('adminUser');
    localStorage.removeItem('authToken');
    localStorage.removeItem('user');
    
    console.log('Kiosk login mounted - admin session cleared');
  }, []);

  useEffect(() => {
    // Create floating elements for background animation
    const elements = Array.from({ length: 8 }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      delay: Math.random() * 2,
      duration: 3 + Math.random() * 2
    }));
    setFloatingElements(elements);
  }, []);

  // Fetch staff name when employee code is complete (4 digits)
  // Uses debounce to avoid checking on every keystroke
  useEffect(() => {
    // Clear staff name and any "not found" error while user is still typing
    if (employeeCode.length < 4) {
      setStaffName('');
      // Only clear error if it's the "not found" type (not login errors)
      if (error === 'Employee code not found' || error?.includes('not found')) {
        setError('');
      }
      setLoadingStaff(false);
      return;
    }

    // Debounce the API call - wait 300ms after user stops typing
    const debounceTimer = setTimeout(async () => {
      if (employeeCode.length === 4) {
        setLoadingStaff(true);

        try {
          const tenant = searchParams.get('tenant') || window.location.hostname.split('.')[0];
          const response = await axios.get(
            `${API_BASE_URL}/api/staff/verify-code/${employeeCode}`,
            {
              headers: {
                'X-Tenant-ID': tenant
              },
              withCredentials: true,
              timeout: 5000
            }
          );

          if (response.data.success && response.data.staff) {
            const { firstName, lastName } = response.data.staff;
            setStaffName(`${firstName} ${lastName}`.trim());
            setError(''); // Clear any previous error
            // Auto-switch to PIN field after staff is verified
            setTimeout(() => setActiveField('pin'), 300);
          } else {
            setStaffName('');
            setError('Employee code not found');
          }
        } catch (err) {
          console.error('Staff verification error:', err);
          setStaffName('');
          setError(err.response?.data?.message || 'Employee code not found');
        } finally {
          setLoadingStaff(false);
        }
      }
    }, 300);

    return () => clearTimeout(debounceTimer);
  }, [employeeCode, API_BASE_URL, searchParams, error]);

  const handleKeypadClick = (value) => {
    if (value === 'clear') {
      if (activeField === 'employeeCode') {
        setEmployeeCode('');
      } else {
        setPin('');
      }
    } else if (value === 'backspace') {
      if (activeField === 'employeeCode') {
        setEmployeeCode((prev) => prev.slice(0, -1));
      } else {
        setPin((prev) => prev.slice(0, -1));
      }
    } else {
      if (activeField === 'employeeCode') {
        if (employeeCode.length < 4) {
          setEmployeeCode((prev) => prev + value);
          // Don't auto-switch to PIN - wait for staff verification
        }
      } else {
        if (pin.length < 6) {
          setPin((prev) => prev + value);
        }
      }
    }
    // Clear error when user starts typing
    if (error) setError('');
  };

  const handleLogin = async () => {
    // Validation
    if (!employeeCode || employeeCode.length < 2 || employeeCode.length > 4) {
  setError('Employee code must be 2-4 digits');
    
    setActiveField('employeeCode');
      return;
    }

    if (!pin || pin.length < 4 || pin.length > 6) {
      setError('PIN must be 4-6 digits');
      setActiveField('pin');
      return;
    }

    setError('');
    setLoading(true);

    try {
      console.log('Attempting kiosk login with employee code');

      // Extract tenant ID (same as staff verification)
      const tenant = searchParams.get('tenant') || window.location.hostname.split('.')[0];

      const response = await axios.post(
        `${API_BASE_URL}/api/auth/kiosk-login`,
        { employeeCode, pin },
        {
          headers: {
            'X-Tenant-ID': tenant
          },
          withCredentials: true,
          timeout: 10000
        }
      );

      if (response.data.success) {
        const { user, csrfToken, token } = response.data;

        // Store kiosk-specific auth data
        localStorage.setItem('kioskUser', JSON.stringify(user));
        if (token) {
          localStorage.setItem('kioskAuthToken', token);
        }
        if (csrfToken) {
          localStorage.setItem('csrfToken', csrfToken);
        }

        console.log('Kiosk login successful:', user);

        // Determine redirect destination
        const redirectParam = searchParams.get('redirect');
        let redirectPath = '/kiosk/quicksell'; // Default to QuickSell

        if (redirectParam === 'inventory') {
          redirectPath = '/kiosk/inventory';
        } else if (redirectParam === 'quicksell') {
          redirectPath = '/kiosk/quicksell';
        }

        console.log(`Redirecting to: ${redirectPath}`);

        // Navigate to appropriate kiosk app
        navigate(redirectPath, { replace: true });
      } else {
        setError('Login failed. Please try again.');
      }
    } catch (err) {
      console.error('Kiosk login error:', err);
      
      let errorMessage = 'Login failed. Please check your credentials.';
      
      if (err.response?.data?.message) {
        errorMessage = err.response.data.message;
      } else if (err.response?.data?.error === 'ACCOUNT_LOCKED') {
        errorMessage = err.response.data.message || 'Account is locked. Please try again later.';
      } else if (err.response?.data?.error === 'ACCOUNT_INACTIVE') {
        errorMessage = 'Account is not active. Please contact your administrator.';
      } else if (err.response?.status === 400) {
        errorMessage = 'Invalid employee code or PIN';
      } else if (err.code === 'ECONNABORTED' || err.message.includes('timeout')) {
        errorMessage = 'Connection timeout. Please check your internet connection.';
      }
      
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && employeeCode && pin) {
      handleLogin();
    }
  };

  // Get redirect destination info for display
  const redirectParam = searchParams.get('redirect');
  const kioskAppName = redirectParam === 'inventory' ? 'StockFlow' : 'QuickSell';
  const kioskAppDescription = redirectParam === 'inventory'
    ? 'Inventory Checkout & Management'
    : 'Point of Sale & Services';

  return (
    <div className="min-h-screen relative overflow-hidden bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-600">
      {/* Floating Background Elements */}
      <div className="absolute inset-0">
        {floatingElements.map((element) => (
          <div
            key={element.id}
            className="absolute w-4 h-4 bg-white/10 rounded-full"
            style={{
              left: `${element.x}%`,
              top: `${element.y}%`,
              animation: `float ${element.duration}s ease-in-out infinite ${element.delay}s alternate`
            }}
          />
        ))}
      </div>

      {/* Decorative Icons */}
      <div className="absolute top-20 left-10 text-white/20">
        <Sparkles className="w-8 h-8" />
      </div>
      <div className="absolute top-40 right-20 text-white/20">
        <Heart className="w-6 h-6" />
      </div>
      <div className="absolute bottom-20 left-20 text-white/20">
        <Star className="w-5 h-5" />
      </div>
      <div className="absolute top-60 right-10 text-white/20">
        <Sparkles className="w-4 h-4" />
      </div>

      <div className="relative z-10 flex items-center justify-center min-h-screen p-3 py-2">
        <div className="w-full max-w-md">
          {/* Header */}
          <div className="text-center mb-3">
            <div className="mx-auto w-14 h-14 bg-white/20 backdrop-blur-md rounded-full mb-2 shadow-lg flex items-center justify-center">
              <Sparkles className="w-7 h-7 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-white mb-1">Pump House ERP Kiosk</h1>
            <p className="text-white/80 text-xs">QuickSell | StockFlow</p>
            <div className="w-20 h-0.5 bg-gradient-to-r from-blue-300 to-indigo-300 rounded-full mx-auto mt-2"></div>
          </div>

          <div className="bg-white/95 backdrop-blur-md rounded-2xl shadow-2xl p-5 border border-white/20">
            <div className="text-center mb-4">
              <h2 className="text-xl font-bold text-gray-800 mb-1">Employee Login</h2>
              <p className="text-gray-600 text-xs">Enter your employee code and PIN</p>
            </div>

            {error && (
              <div className={`mb-3 p-3 rounded-lg ${
                error?.includes('subscription') || error?.includes('inactive') || error?.includes('expired') || error?.includes('suspended')
                  ? 'bg-amber-50 border border-amber-300'
                  : 'bg-red-50 border border-red-200'
              }`}>
                <p className={`text-xs text-center font-medium ${
                  error?.includes('subscription') || error?.includes('inactive') || error?.includes('expired') || error?.includes('suspended')
                    ? 'text-amber-700'
                    : 'text-red-600'
                }`}>{error}</p>
                {(error?.includes('subscription') || error?.includes('inactive') || error?.includes('expired') || error?.includes('suspended')) && (
                  <p className="text-xs text-center text-amber-600 mt-2">Please contact your manager for assistance.</p>
                )}
              </div>
            )}

            {/* Employee Code Input */}
            <div className="mb-3">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Employee Code (2-4 digits)
              </label>
              <div
                className={`relative cursor-pointer transition-all duration-200 ${
                  activeField === 'employeeCode' ? 'ring-2 ring-blue-500 rounded-xl' : ''
                }`}
                onClick={() => setActiveField('employeeCode')}
              >
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Hash className={`w-4 h-4 ${activeField === 'employeeCode' ? 'text-blue-500' : 'text-gray-400'}`} />
                </div>
                <div className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg bg-white/80 backdrop-blur-sm min-h-[2.5rem] flex items-center">
                  <div className="flex space-x-1.5">
                    {employeeCode.split('').map((digit, index) => (
                      <div
                        key={index}
                        className="w-8 h-8 bg-blue-100 rounded-md flex items-center justify-center"
                      >
                        <span className="text-lg font-bold text-blue-600">{digit}</span>
                      </div>
                    ))}
                    {employeeCode.length === 0 && (
                      <span className="text-gray-400 text-sm">Enter 2-4 digit code</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Staff Name Display */}
              {loadingStaff && (
                <div className="mt-1.5 flex items-center text-xs text-blue-600">
                  <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-blue-600 mr-1.5"></div>
                  <span>Verifying...</span>
                </div>
              )}
              {staffName && !loadingStaff && (
                <div className="mt-1.5 p-2 bg-green-50 border border-green-200 rounded-md">
                  <p className="text-xs text-green-700">
                    <span className="font-medium">Welcome, {staffName}</span>
                  </p>
                </div>
              )}
            </div>

            {/* PIN Input */}
            <div className="mb-3">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                PIN (4-6 digits)
              </label>
              <div
                className={`relative cursor-pointer transition-all duration-200 ${
                  activeField === 'pin' ? 'ring-2 ring-blue-500 rounded-xl' : ''
                } ${!staffName && employeeCode.length === 4 ? 'opacity-50 cursor-not-allowed' : ''}`}
                onClick={() => staffName && setActiveField('pin')}
                onKeyPress={handleKeyPress}
              >
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className={`w-4 h-4 ${activeField === 'pin' ? 'text-blue-500' : 'text-gray-400'}`} />
                </div>
                <div className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg bg-white/80 backdrop-blur-sm min-h-[2.5rem] flex items-center">
                  <div className="flex space-x-1.5">
                    {pin.split('').map((_, index) => (
                      <div
                        key={index}
                        className="w-2.5 h-2.5 bg-blue-500 rounded-full animate-pulse"
                      />
                    ))}
                    {pin.length === 0 && (
                      <span className="text-gray-400 text-sm">Enter your PIN</span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Active Field Indicator */}
            <div className="mb-2 text-center">
              {staffName && activeField === 'pin' ? (
                <span className="text-xs text-gray-600">
                  Entering: <strong className="text-blue-600">PIN</strong>
                </span>
              ) : (
                <span className="text-xs text-gray-600">
                  Entering: <strong className="text-blue-600">Employee Code</strong>
                </span>
              )}
            </div>

            {/* Numeric Keypad */}
            <div className="mb-3">
              <div className="grid grid-cols-3 gap-2">
                {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((number) => (
                  <button
                    key={number}
                    onClick={() => handleKeypadClick(number)}
                    className="h-11 bg-gradient-to-b from-blue-50 to-blue-100 hover:from-blue-100 hover:to-blue-200 border border-blue-200 rounded-lg font-semibold text-blue-800 transition-all duration-200 transform hover:scale-105 active:scale-95 shadow-sm text-base"
                    disabled={loading}
                  >
                    {number}
                  </button>
                ))}

                {/* Clear button */}
                <button
                  onClick={() => handleKeypadClick('clear')}
                  className="h-11 bg-gradient-to-b from-gray-50 to-gray-100 hover:from-gray-100 hover:to-gray-200 border border-gray-200 rounded-lg font-medium text-gray-700 transition-all duration-200 transform hover:scale-105 active:scale-95 shadow-sm flex items-center justify-center"
                  disabled={loading}
                >
                  <RotateCcw className="w-4 h-4" />
                </button>

                {/* Zero */}
                <button
                  onClick={() => handleKeypadClick('0')}
                  className="h-11 bg-gradient-to-b from-blue-50 to-blue-100 hover:from-blue-100 hover:to-blue-200 border border-blue-200 rounded-lg font-semibold text-blue-800 transition-all duration-200 transform hover:scale-105 active:scale-95 shadow-sm text-base"
                  disabled={loading}
                >
                  0
                </button>

                {/* Backspace button */}
                <button
                  onClick={() => handleKeypadClick('backspace')}
                  className="h-11 bg-gradient-to-b from-gray-50 to-gray-100 hover:from-gray-100 hover:to-gray-200 border border-gray-200 rounded-lg font-medium text-gray-700 transition-all duration-200 transform hover:scale-105 active:scale-95 shadow-sm flex items-center justify-center"
                  disabled={loading}
                >
                  <Delete className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Login Button */}
            <button
              onClick={handleLogin}
              disabled={!employeeCode || !pin || loading}
              className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold py-3 rounded-lg transition-all duration-300 transform hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none shadow-lg flex items-center justify-center space-x-2"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  <span>Logging in...</span>
                </>
              ) : (
                <>
                  <span>Login</span>
                  <ArrowRight className="w-5 h-5" />
                </>
              )}
            </button>

            {/* Help Text */}
            <div className="mt-3 text-center">
              <p className="text-xs text-gray-500">
                Need help? Contact your administrator
              </p>
            </div>
          </div>

          {/* Footer */}
          <div className="mt-3 text-center">
            <p className="text-white/60 text-xs">
              © {new Date().getFullYear()} Pump House ERP. All rights reserved.
            </p>
            {/* reCAPTCHA Attribution (required when badge is hidden) */}
            <p className="text-white/40 text-[10px] mt-1">
              This site is protected by reCAPTCHA and the Google{" "}
              <a
                href="https://policies.google.com/privacy"
                target="_blank"
                rel="noopener noreferrer"
                className="text-white/50 hover:text-white/70 underline"
              >
                Privacy Policy
              </a>{" "}
              and{" "}
              <a
                href="https://policies.google.com/terms"
                target="_blank"
                rel="noopener noreferrer"
                className="text-white/50 hover:text-white/70 underline"
              >
                Terms of Service
              </a>{" "}
              apply.
            </p>
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes float {
          0%, 100% {
            transform: translateY(0px);
          }
          50% {
            transform: translateY(-20px);
          }
        }
      `}</style>
    </div>
  );
}

export default KioskLogin;
