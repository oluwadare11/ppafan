import { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import axios from 'axios';
import {
  User,
  Building2,
  Mail,
  Phone,
  Search,
  ArrowRight,
  ArrowLeft,
  Check,
  X,
  QrCode,
  Clock,
  MapPin,
  Briefcase,
  ChevronDown,
  Loader2,
  RefreshCw,
  Home,
  UserPlus,
  FileText,
  AlertCircle,
  CheckCircle2,
  LogIn
} from 'lucide-react';
import { useKioskAuth } from '../../hooks/useKioskAuth';

const API_BASE_URL = import.meta.env.VITE_API_URL || '';

function VisitorKioskContent() {
  const [searchParams] = useSearchParams();
  const tenant = searchParams.get('tenant') || window.location.hostname.split('.')[0];

  // Screen states: 'welcome', 'preregistered', 'walkin', 'host-search', 'confirm', 'success', 'checkout'
  const [screen, setScreen] = useState('welcome');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Tenant/kiosk info
  const [kioskInfo, setKioskInfo] = useState({
    businessName: '',
    logo: null,
    primaryColor: '#3B82F6',
    allowWalkIns: true,
    kioskEnabled: true
  });

  // Pre-registered verification
  const [verificationCode, setVerificationCode] = useState('');
  const [verifiedVisitor, setVerifiedVisitor] = useState(null);

  // Walk-in registration form
  const [visitorForm, setVisitorForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    company: '',
    purpose: '',
    vehiclePlate: '',
    notes: ''
  });

  // Host search
  const [hostSearch, setHostSearch] = useState('');
  const [hostResults, setHostResults] = useState([]);
  const [selectedHost, setSelectedHost] = useState(null);
  const [departments, setDepartments] = useState([]);
  const [selectedDepartment, setSelectedDepartment] = useState('');
  const [searchLoading, setSearchLoading] = useState(false);
  const searchTimeout = useRef(null);

  // Check-in result
  const [checkedInVisitor, setCheckedInVisitor] = useState(null);

  // Checkout
  const [checkoutCode, setCheckoutCode] = useState('');

  // Purpose options
  const purposeOptions = [
    { value: 'Meeting', label: 'Meeting', icon: '📅' },
    { value: 'Interview', label: 'Interview', icon: '👔' },
    { value: 'Delivery', label: 'Delivery', icon: '📦' },
    { value: 'Contractor', label: 'Contractor Work', icon: '🔧' },
    { value: 'Consultation', label: 'Consultation', icon: '💼' },
    { value: 'Tour', label: 'Facility Tour', icon: '🏢' },
    { value: 'Other', label: 'Other', icon: '📝' }
  ];

  // Fetch kiosk info on mount
  useEffect(() => {
    fetchKioskInfo();
    fetchDepartments();
  }, [tenant]);

  const fetchKioskInfo = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/api/visitor-kiosk/info`, {
        headers: { 'X-Tenant-ID': tenant },
        withCredentials: true
      });
      if (response.data.success && response.data.kiosk) {
        const { tenant: tenantData, settings } = response.data.kiosk;
        setKioskInfo({
          businessName: tenantData?.name || 'Your Organization',
          logo: tenantData?.logo || null,
          primaryColor: tenantData?.primaryColor || '#3B82F6',
          allowWalkIns: settings?.allowWalkIns !== false,
          kioskEnabled: true
        });
      }
    } catch (err) {
      console.error('Failed to fetch kiosk info:', err);
    }
  };

  const fetchDepartments = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/api/visitor-kiosk/departments`, {
        headers: { 'X-Tenant-ID': tenant },
        withCredentials: true
      });
      if (response.data.success && response.data.departments) {
        // Departments come as objects with {name, description}, extract names
        const deptNames = response.data.departments.map(d =>
          typeof d === 'string' ? d : d.name
        ).filter(Boolean);
        setDepartments(deptNames);
      }
    } catch (err) {
      console.error('Failed to fetch departments:', err);
    }
  };

  // Host search with debounce
  const searchHosts = useCallback(async (query) => {
    if (!query || query.length < 2) {
      setHostResults([]);
      return;
    }

    setSearchLoading(true);
    try {
      const params = new URLSearchParams({
        q: query,
        department: selectedDepartment
      });

      const response = await axios.get(
        `${API_BASE_URL}/api/visitor-kiosk/staff-autocomplete?${params}`,
        {
          headers: { 'X-Tenant-ID': tenant },
          withCredentials: true
        }
      );

      if (response.data.success) {
        setHostResults(response.data.results || []);
      }
    } catch (err) {
      console.error('Host search failed:', err);
      if (err.response?.status === 429) {
        setError('Too many searches. Please wait a moment.');
      }
    } finally {
      setSearchLoading(false);
    }
  }, [tenant, selectedDepartment]);

  useEffect(() => {
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => {
      searchHosts(hostSearch);
    }, 300);

    return () => clearTimeout(searchTimeout.current);
  }, [hostSearch, searchHosts]);

  // Verify pre-registered visitor
  const handleVerifyCode = async () => {
    if (!verificationCode || verificationCode.length < 4) {
      setError('Please enter your verification code');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await axios.get(
        `${API_BASE_URL}/api/visitor-kiosk/verify?code=${verificationCode}`,
        {
          headers: { 'X-Tenant-ID': tenant },
          withCredentials: true
        }
      );

      if (response.data.success && response.data.visitor) {
        setVerifiedVisitor(response.data.visitor);
        setScreen('confirm');
      } else {
        setError(response.data.message || 'Verification code not found');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Verification failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Register walk-in visitor
  const handleWalkInSubmit = async () => {
    // Validation
    if (!visitorForm.firstName || !visitorForm.lastName) {
      setError('Please enter your full name');
      return;
    }
    if (!selectedHost) {
      setError('Please select who you are here to see');
      return;
    }
    if (!visitorForm.purpose) {
      setError('Please select the purpose of your visit');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await axios.post(
        `${API_BASE_URL}/api/visitor-kiosk/register`,
        {
          ...visitorForm,
          hostId: selectedHost._id,
          hostName: `${selectedHost.firstName} ${selectedHost.lastName}`.trim(),
          hostDepartment: selectedHost.department
        },
        {
          headers: { 'X-Tenant-ID': tenant },
          withCredentials: true
        }
      );

      if (response.data.success) {
        setVerifiedVisitor(response.data.visitor);
        setScreen('confirm');
      } else {
        setError(response.data.message || 'Registration failed');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Complete check-in
  const handleCheckIn = async () => {
    if (!verifiedVisitor) return;

    setLoading(true);
    setError('');

    try {
      const response = await axios.post(
        `${API_BASE_URL}/api/visitor-kiosk/check-in/${verifiedVisitor._id}`,
        {},
        {
          headers: { 'X-Tenant-ID': tenant },
          withCredentials: true
        }
      );

      if (response.data.success) {
        setCheckedInVisitor(response.data.visitor);
        setScreen('success');
        // Auto-reset after 30 seconds
        setTimeout(() => handleReset(), 30000);
      } else {
        setError(response.data.message || 'Check-in failed');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Check-in failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Self checkout
  const handleCheckout = async () => {
    if (!checkoutCode || checkoutCode.length < 4) {
      setError('Please enter your visitor code');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await axios.post(
        `${API_BASE_URL}/api/visitor-kiosk/check-out`,
        { code: checkoutCode },
        {
          headers: { 'X-Tenant-ID': tenant },
          withCredentials: true
        }
      );

      if (response.data.success) {
        setSuccess('You have been checked out. Thank you for visiting!');
        setTimeout(() => {
          handleReset();
        }, 5000);
      } else {
        setError(response.data.message || 'Checkout failed');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Checkout failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Reset to welcome screen
  const handleReset = () => {
    setScreen('welcome');
    setVerificationCode('');
    setVerifiedVisitor(null);
    setVisitorForm({
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
      company: '',
      purpose: '',
      vehiclePlate: '',
      notes: ''
    });
    setHostSearch('');
    setHostResults([]);
    setSelectedHost(null);
    setSelectedDepartment('');
    setCheckedInVisitor(null);
    setCheckoutCode('');
    setError('');
    setSuccess('');
  };

  // Render welcome screen
  const renderWelcome = () => (
    <div className="text-center space-y-8 sm:space-y-10">
      {/* Animated Logo Section */}
      <div className="mb-6 sm:mb-10">
        {kioskInfo.logo ? (
          <div className="inline-block p-4 sm:p-5 bg-white/90 rounded-2xl sm:rounded-3xl shadow-2xl shadow-blue-500/20 backdrop-blur-sm">
            <img src={kioskInfo.logo} alt="Logo" className="h-20 sm:h-28 md:h-32 object-contain" />
          </div>
        ) : (
          <div className="inline-block p-5 sm:p-7 bg-gradient-to-br from-blue-500 via-indigo-500 to-purple-600 rounded-2xl sm:rounded-3xl shadow-2xl shadow-indigo-500/40">
            <Building2 className="w-14 h-14 sm:w-20 sm:h-20 text-white" />
          </div>
        )}
      </div>

      <div className="space-y-3 sm:space-y-4">
        <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-extrabold text-white tracking-tight">
          {kioskInfo.businessName ? `Welcome to ${kioskInfo.businessName}` : 'Welcome'}
        </h1>
        <p className="text-lg sm:text-xl md:text-2xl text-blue-200 font-medium max-w-lg mx-auto">
          How can we help you today?
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 max-w-3xl mx-auto mt-10 sm:mt-14">
        {/* Pre-registered - Glass Card */}
        <button
          onClick={() => setScreen('preregistered')}
          className="group relative flex flex-col items-center gap-4 sm:gap-5 p-6 sm:p-8 bg-white/10 backdrop-blur-xl rounded-2xl sm:rounded-3xl border border-white/20 hover:border-blue-400/50 hover:bg-white/20 transition-all duration-300 hover:scale-[1.02] hover:shadow-xl hover:shadow-blue-500/20"
        >
          <div className="relative">
            <div className="w-16 h-16 sm:w-20 sm:h-20 bg-gradient-to-br from-blue-400 to-blue-600 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-500/40 group-hover:shadow-blue-500/60 transition-all">
              <FileText className="w-8 h-8 sm:w-10 sm:h-10 text-white" />
            </div>
            <div className="absolute -top-1 -right-1 w-4 h-4 bg-green-400 rounded-full border-2 border-white animate-pulse" />
          </div>
          <div className="text-center">
            <h3 className="text-lg sm:text-xl font-bold text-white mb-1">I'm Pre-Registered</h3>
            <p className="text-sm sm:text-base text-blue-200">Enter your verification code</p>
          </div>
        </button>

        {/* Walk-in - Glass Card */}
        {kioskInfo.allowWalkIns && (
          <button
            onClick={() => setScreen('walkin')}
            className="group relative flex flex-col items-center gap-4 sm:gap-5 p-6 sm:p-8 bg-white/10 backdrop-blur-xl rounded-2xl sm:rounded-3xl border border-white/20 hover:border-emerald-400/50 hover:bg-white/20 transition-all duration-300 hover:scale-[1.02] hover:shadow-xl hover:shadow-emerald-500/20"
          >
            <div className="w-16 h-16 sm:w-20 sm:h-20 bg-gradient-to-br from-emerald-400 to-emerald-600 rounded-2xl flex items-center justify-center shadow-lg shadow-emerald-500/40 group-hover:shadow-emerald-500/60 transition-all">
              <UserPlus className="w-8 h-8 sm:w-10 sm:h-10 text-white" />
            </div>
            <div className="text-center">
              <h3 className="text-lg sm:text-xl font-bold text-white mb-1">Walk-In Visitor</h3>
              <p className="text-sm sm:text-base text-blue-200">Register and check in now</p>
            </div>
          </button>
        )}

        {/* Checkout - Glass Card */}
        <button
          onClick={() => setScreen('checkout')}
          className="group relative flex flex-col items-center gap-4 sm:gap-5 p-6 sm:p-8 bg-white/10 backdrop-blur-xl rounded-2xl sm:rounded-3xl border border-white/20 hover:border-amber-400/50 hover:bg-white/20 transition-all duration-300 hover:scale-[1.02] hover:shadow-xl hover:shadow-amber-500/20 sm:col-span-2 sm:max-w-md sm:mx-auto"
        >
          <div className="w-16 h-16 sm:w-20 sm:h-20 bg-gradient-to-br from-amber-400 to-orange-500 rounded-2xl flex items-center justify-center shadow-lg shadow-amber-500/40 group-hover:shadow-amber-500/60 transition-all">
            <LogIn className="w-8 h-8 sm:w-10 sm:h-10 text-white rotate-180" />
          </div>
          <div className="text-center">
            <h3 className="text-lg sm:text-xl font-bold text-white mb-1">Check Out</h3>
            <p className="text-sm sm:text-base text-blue-200">Already visited? Sign out here</p>
          </div>
        </button>
      </div>

      {/* Decorative hint */}
      <p className="text-white/40 text-sm mt-8">
        Tap an option to get started
      </p>
    </div>
  );

  // Render pre-registered verification screen
  const renderPreRegistered = () => (
    <div className="max-w-lg mx-auto space-y-8">
      <button
        onClick={() => setScreen('welcome')}
        className="flex items-center gap-2 text-blue-200 hover:text-white transition-colors font-medium"
      >
        <ArrowLeft className="w-5 h-5" />
        Back to Home
      </button>

      <div className="text-center">
        <div className="w-20 h-20 sm:w-24 sm:h-24 bg-gradient-to-br from-blue-400 to-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg shadow-blue-500/40">
          <QrCode className="w-10 h-10 sm:w-12 sm:h-12 text-white" />
        </div>
        <h2 className="text-2xl sm:text-3xl font-bold text-white">Enter Your Code</h2>
        <p className="text-blue-200 mt-2 text-sm sm:text-base">
          Enter the verification code from your invitation email
        </p>
      </div>

      <div className="bg-white/10 backdrop-blur-xl rounded-2xl sm:rounded-3xl border border-white/20 p-6 sm:p-8 space-y-5">
        <input
          type="text"
          value={verificationCode}
          onChange={(e) => setVerificationCode(e.target.value.toUpperCase())}
          placeholder="e.g., VIS-ABC123"
          className="w-full px-5 py-4 text-xl sm:text-2xl text-center font-mono bg-white/90 border-2 border-blue-200 rounded-xl focus:border-blue-500 focus:ring-4 focus:ring-blue-500/20 transition-all uppercase tracking-widest text-gray-900 placeholder-gray-400"
          autoFocus
        />

        {error && (
          <div className="flex items-center gap-2 text-red-100 bg-red-500/20 border border-red-400/30 p-4 rounded-xl">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <span className="text-sm sm:text-base">{error}</span>
          </div>
        )}

        <button
          onClick={handleVerifyCode}
          disabled={loading || !verificationCode}
          className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-gradient-to-r from-blue-500 to-indigo-600 text-white text-lg sm:text-xl font-bold rounded-xl hover:from-blue-600 hover:to-indigo-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-blue-500/30"
        >
          {loading ? (
            <>
              <Loader2 className="w-6 h-6 animate-spin" />
              Verifying...
            </>
          ) : (
            <>
              Continue
              <ArrowRight className="w-6 h-6" />
            </>
          )}
        </button>
      </div>
    </div>
  );

  // Render walk-in registration screen
  const renderWalkIn = () => (
    <div className="max-w-2xl mx-auto space-y-6">
      <button
        onClick={() => {
          if (selectedHost && !visitorForm.firstName) {
            setSelectedHost(null);
            setHostSearch('');
          } else {
            setScreen('welcome');
            handleReset();
          }
        }}
        className="flex items-center gap-2 text-blue-200 hover:text-white transition-colors font-medium"
      >
        <ArrowLeft className="w-5 h-5" />
        Back to Home
      </button>

      <div className="text-center mb-6">
        <div className="w-16 h-16 sm:w-20 sm:h-20 bg-gradient-to-br from-emerald-400 to-emerald-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-emerald-500/40">
          <UserPlus className="w-8 h-8 sm:w-10 sm:h-10 text-white" />
        </div>
        <h2 className="text-2xl sm:text-3xl font-bold text-white">Visitor Registration</h2>
        <p className="text-blue-200 mt-2 text-sm sm:text-base">Please fill in your details</p>
      </div>

      {error && (
        <div className="flex items-center gap-2 text-red-100 bg-red-500/20 border border-red-400/30 p-4 rounded-xl">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl p-5 sm:p-7 space-y-5">
        {/* Name */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              First Name *
            </label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                value={visitorForm.firstName}
                onChange={(e) => setVisitorForm(prev => ({ ...prev, firstName: e.target.value }))}
                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="John"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Last Name *
            </label>
            <input
              type="text"
              value={visitorForm.lastName}
              onChange={(e) => setVisitorForm(prev => ({ ...prev, lastName: e.target.value }))}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Doe"
            />
          </div>
        </div>

        {/* Contact */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Email
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="email"
                value={visitorForm.email}
                onChange={(e) => setVisitorForm(prev => ({ ...prev, email: e.target.value }))}
                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="john@example.com"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Phone
            </label>
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="tel"
                value={visitorForm.phone}
                onChange={(e) => setVisitorForm(prev => ({ ...prev, phone: e.target.value }))}
                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="+234 800 000 0000"
              />
            </div>
          </div>
        </div>

        {/* Company */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Company
          </label>
          <div className="relative">
            <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              value={visitorForm.company}
              onChange={(e) => setVisitorForm(prev => ({ ...prev, company: e.target.value }))}
              className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Company name"
            />
          </div>
        </div>

        {/* Host Search */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Who are you here to see? *
          </label>

          {selectedHost ? (
            <div className="flex items-center justify-between p-4 bg-green-50 border border-green-200 rounded-lg">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                  <span className="text-green-700 font-semibold text-lg">
                    {selectedHost.firstName[0]}{selectedHost.lastName[0]}
                  </span>
                </div>
                <div>
                  <p className="font-semibold text-gray-900">
                    {selectedHost.firstName} {selectedHost.lastName}
                  </p>
                  <p className="text-sm text-gray-600">{selectedHost.department}</p>
                </div>
              </div>
              <button
                onClick={() => {
                  setSelectedHost(null);
                  setHostSearch('');
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {/* Department filter */}
              {departments.length > 0 && (
                <select
                  value={selectedDepartment}
                  onChange={(e) => setSelectedDepartment(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                >
                  <option value="">All Departments</option>
                  {departments.map(dept => (
                    <option key={dept} value={dept}>{dept}</option>
                  ))}
                </select>
              )}

              {/* Search input */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  value={hostSearch}
                  onChange={(e) => setHostSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Search by name..."
                />
                {searchLoading && (
                  <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-blue-500 animate-spin" />
                )}
              </div>

              {/* Search results */}
              {hostResults.length > 0 && (
                <div className="border border-gray-200 rounded-lg divide-y max-h-48 overflow-y-auto">
                  {hostResults.map(staff => (
                    <button
                      key={staff._id}
                      onClick={() => {
                        setSelectedHost(staff);
                        setHostResults([]);
                        setHostSearch('');
                      }}
                      className="w-full flex items-center gap-3 p-3 hover:bg-gray-50 transition-colors text-left"
                    >
                      <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                        <span className="text-blue-700 font-medium">
                          {staff.firstName[0]}{staff.lastName[0]}
                        </span>
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-gray-900 truncate">
                          {staff.firstName} {staff.lastName}
                        </p>
                        <p className="text-sm text-gray-500 truncate">
                          {staff.position} • {staff.department}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {hostSearch.length >= 2 && hostResults.length === 0 && !searchLoading && (
                <p className="text-sm text-gray-500 text-center py-2">
                  No results found. Try a different name.
                </p>
              )}
            </div>
          )}
        </div>

        {/* Purpose */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Purpose of Visit *
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
            {purposeOptions.map(option => (
              <button
                key={option.value}
                onClick={() => setVisitorForm(prev => ({ ...prev, purpose: option.value }))}
                className={`flex flex-col items-center gap-1 p-2 sm:p-3 rounded-lg border-2 transition-all ${
                  visitorForm.purpose === option.value
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <span className="text-xl sm:text-2xl">{option.icon}</span>
                <span className="text-xs sm:text-sm font-medium text-center">{option.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Vehicle plate (optional) */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Vehicle Plate (if applicable)
          </label>
          <input
            type="text"
            value={visitorForm.vehiclePlate}
            onChange={(e) => setVisitorForm(prev => ({ ...prev, vehiclePlate: e.target.value.toUpperCase() }))}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 uppercase"
            placeholder="ABC-123"
          />
        </div>

        {/* Submit */}
        <button
          onClick={handleWalkInSubmit}
          disabled={loading || !visitorForm.firstName || !visitorForm.lastName || !selectedHost || !visitorForm.purpose}
          className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-gradient-to-r from-emerald-500 to-green-600 text-white text-lg sm:text-xl font-bold rounded-xl hover:from-emerald-600 hover:to-green-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-emerald-500/30"
        >
          {loading ? (
            <>
              <Loader2 className="w-6 h-6 animate-spin" />
              Registering...
            </>
          ) : (
            <>
              Continue
              <ArrowRight className="w-6 h-6" />
            </>
          )}
        </button>
      </div>
    </div>
  );

  // Render confirmation screen
  const renderConfirm = () => (
    <div className="max-w-lg mx-auto space-y-8">
      <div className="text-center">
        <div className="w-20 h-20 sm:w-24 sm:h-24 bg-gradient-to-br from-blue-400 to-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg shadow-blue-500/40">
          <Check className="w-10 h-10 sm:w-12 sm:h-12 text-white" />
        </div>
        <h2 className="text-2xl sm:text-3xl font-bold text-white">Confirm Your Visit</h2>
        <p className="text-blue-200 mt-2 text-sm sm:text-base">Please verify your details are correct</p>
      </div>

      {verifiedVisitor && (
        <div className="bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl p-6 space-y-4">
          <div className="text-center pb-4 border-b border-gray-200">
            <div className="w-16 h-16 bg-gradient-to-br from-blue-400 to-indigo-600 rounded-xl flex items-center justify-center mx-auto mb-3 shadow-lg">
              <span className="text-2xl font-bold text-white">
                {verifiedVisitor.firstName?.[0]}{verifiedVisitor.lastName?.[0]}
              </span>
            </div>
            <h3 className="text-xl font-bold text-gray-900">
              {verifiedVisitor.firstName} {verifiedVisitor.lastName}
            </h3>
            {verifiedVisitor.company && (
              <p className="text-gray-600">{verifiedVisitor.company}</p>
            )}
          </div>

          <div className="space-y-3">
            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
              <User className="w-5 h-5 text-blue-500" />
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wide">Visiting</p>
                <p className="font-semibold text-gray-900">{verifiedVisitor.hostName}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
              <Building2 className="w-5 h-5 text-blue-500" />
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wide">Department</p>
                <p className="font-semibold text-gray-900">{verifiedVisitor.hostDepartment || 'N/A'}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
              <Briefcase className="w-5 h-5 text-blue-500" />
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wide">Purpose</p>
                <p className="font-semibold text-gray-900">{verifiedVisitor.purpose}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 text-red-100 bg-red-500/20 border border-red-400/30 p-4 rounded-xl">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="flex gap-4">
        <button
          onClick={() => setScreen('welcome')}
          className="flex-1 px-5 py-4 bg-white/10 backdrop-blur-sm border border-white/30 text-white text-base sm:text-lg font-semibold rounded-xl hover:bg-white/20 transition-all"
        >
          Cancel
        </button>
        <button
          onClick={handleCheckIn}
          disabled={loading}
          className="flex-1 flex items-center justify-center gap-2 px-5 py-4 bg-gradient-to-r from-emerald-500 to-green-600 text-white text-base sm:text-lg font-bold rounded-xl hover:from-emerald-600 hover:to-green-700 transition-all disabled:opacity-50 shadow-lg shadow-emerald-500/30"
        >
          {loading ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              <span className="hidden sm:inline">Checking In...</span>
              <span className="sm:hidden">...</span>
            </>
          ) : (
            <>
              <Check className="w-5 h-5" />
              Check In
            </>
          )}
        </button>
      </div>
    </div>
  );

  // Render success screen
  const renderSuccess = () => (
    <div className="max-w-lg mx-auto text-center space-y-8">
      <div className="relative inline-block">
        <div className="w-24 h-24 sm:w-28 sm:h-28 bg-gradient-to-br from-emerald-400 to-green-600 rounded-2xl flex items-center justify-center mx-auto shadow-2xl shadow-emerald-500/50">
          <CheckCircle2 className="w-12 h-12 sm:w-16 sm:h-16 text-white" />
        </div>
        {/* Success pulse effect */}
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-400 to-green-600 rounded-2xl animate-ping opacity-30" />
      </div>

      <div>
        <h2 className="text-3xl sm:text-4xl font-extrabold text-white">Welcome!</h2>
        <p className="text-blue-200 mt-2 text-base sm:text-lg">You have been checked in successfully</p>
      </div>

      {checkedInVisitor && (
        <div className="bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl p-6 space-y-5 text-left">
          <div className="text-center pb-4 border-b border-gray-200">
            <p className="text-xs text-gray-500 uppercase tracking-widest font-semibold">Visitor Badge</p>
            <h3 className="text-xl sm:text-2xl font-bold text-gray-900 mt-2">
              {checkedInVisitor.firstName} {checkedInVisitor.lastName}
            </h3>
            {checkedInVisitor.company && (
              <p className="text-gray-600 text-sm">{checkedInVisitor.company}</p>
            )}
          </div>

          <div className="flex justify-center py-2">
            <div className="w-28 h-28 sm:w-32 sm:h-32 bg-gradient-to-br from-gray-100 to-gray-200 rounded-xl flex items-center justify-center shadow-inner">
              <QrCode className="w-20 h-20 sm:w-24 sm:h-24 text-gray-800" />
            </div>
          </div>

          <div className="text-center bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-4">
            <p className="text-xs text-gray-500 uppercase tracking-widest">Your visitor code</p>
            <p className="text-2xl sm:text-3xl font-mono font-bold text-blue-600 tracking-wider mt-1">
              {checkedInVisitor.uniqueCode}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="p-3 bg-gray-50 rounded-lg">
              <p className="text-xs text-gray-500 uppercase">Host</p>
              <p className="font-semibold text-gray-900 truncate">{checkedInVisitor.hostName}</p>
            </div>
            <div className="p-3 bg-gray-50 rounded-lg">
              <p className="text-xs text-gray-500 uppercase">Department</p>
              <p className="font-semibold text-gray-900 truncate">{checkedInVisitor.hostDepartment || 'N/A'}</p>
            </div>
            <div className="col-span-2 p-3 bg-emerald-50 rounded-lg text-center">
              <p className="text-xs text-emerald-600 uppercase font-medium">Check-in time</p>
              <p className="font-bold text-emerald-700">{new Date().toLocaleTimeString()}</p>
            </div>
          </div>
        </div>
      )}

      <p className="text-blue-200/80 text-sm sm:text-base">
        Your host has been notified. Please wait in the reception area.
      </p>

      <button
        onClick={handleReset}
        className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-white/10 backdrop-blur-sm border border-white/30 text-white font-bold rounded-xl hover:bg-white/20 transition-all"
      >
        <Home className="w-5 h-5" />
        Return to Home
      </button>
    </div>
  );

  // Render checkout screen
  const renderCheckout = () => (
    <div className="max-w-lg mx-auto space-y-8">
      <button
        onClick={() => setScreen('welcome')}
        className="flex items-center gap-2 text-blue-200 hover:text-white transition-colors font-medium"
      >
        <ArrowLeft className="w-5 h-5" />
        Back to Home
      </button>

      <div className="text-center">
        <div className="w-20 h-20 sm:w-24 sm:h-24 bg-gradient-to-br from-amber-400 to-orange-500 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg shadow-orange-500/40">
          <LogIn className="w-10 h-10 sm:w-12 sm:h-12 text-white rotate-180" />
        </div>
        <h2 className="text-2xl sm:text-3xl font-bold text-white">Check Out</h2>
        <p className="text-blue-200 mt-2 text-sm sm:text-base">Enter your visitor code to sign out</p>
      </div>

      {success ? (
        <div className="text-center space-y-6">
          <div className="flex items-center gap-3 text-emerald-100 bg-emerald-500/20 border border-emerald-400/30 p-5 rounded-xl justify-center">
            <CheckCircle2 className="w-6 h-6 text-emerald-400" />
            <span className="font-semibold">{success}</span>
          </div>
        </div>
      ) : (
        <div className="bg-white/10 backdrop-blur-xl rounded-2xl sm:rounded-3xl border border-white/20 p-6 sm:p-8 space-y-5">
          <input
            type="text"
            value={checkoutCode}
            onChange={(e) => setCheckoutCode(e.target.value.toUpperCase())}
            placeholder="e.g., VIS-ABC123"
            className="w-full px-5 py-4 text-xl sm:text-2xl text-center font-mono bg-white/90 border-2 border-orange-200 rounded-xl focus:border-orange-500 focus:ring-4 focus:ring-orange-500/20 transition-all uppercase tracking-widest text-gray-900 placeholder-gray-400"
            autoFocus
          />

          {error && (
            <div className="flex items-center gap-2 text-red-100 bg-red-500/20 border border-red-400/30 p-4 rounded-xl">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <span className="text-sm sm:text-base">{error}</span>
            </div>
          )}

          <button
            onClick={handleCheckout}
            disabled={loading || !checkoutCode}
            className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-gradient-to-r from-amber-500 to-orange-600 text-white text-lg sm:text-xl font-bold rounded-xl hover:from-amber-600 hover:to-orange-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-orange-500/30"
          >
            {loading ? (
              <>
                <Loader2 className="w-6 h-6 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                Check Out
                <ArrowRight className="w-6 h-6" />
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );

  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* Animated Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-900">
        {/* Subtle animated pattern overlay */}
        <div className="absolute inset-0 opacity-30" style={{
          backgroundImage: 'radial-gradient(circle at 25% 25%, rgba(255,255,255,0.1) 0%, transparent 50%), radial-gradient(circle at 75% 75%, rgba(255,255,255,0.05) 0%, transparent 50%)'
        }} />
        {/* Floating accent shapes */}
        <div className="absolute top-0 left-0 w-96 h-96 bg-blue-500/20 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2 animate-pulse" />
        <div className="absolute bottom-0 right-0 w-96 h-96 bg-purple-500/20 rounded-full blur-3xl translate-x-1/2 translate-y-1/2 animate-pulse" style={{ animationDelay: '1s' }} />
        <div className="absolute top-1/2 left-1/2 w-64 h-64 bg-indigo-500/10 rounded-full blur-2xl -translate-x-1/2 -translate-y-1/2" />
      </div>

      {/* Header - Glass morphism style */}
      <div className="relative z-10 bg-white/10 backdrop-blur-lg border-b border-white/10">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4 sm:py-5 flex items-center justify-between">
          <div className="flex items-center gap-3 sm:gap-4">
            {kioskInfo.logo ? (
              <div className="p-2 bg-white rounded-xl shadow-lg">
                <img src={kioskInfo.logo} alt="Logo" className="h-10 sm:h-12 object-contain" />
              </div>
            ) : (
              <div className="p-3 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl shadow-lg shadow-blue-500/30">
                <Building2 className="w-6 h-6 sm:w-8 sm:h-8 text-white" />
              </div>
            )}
            <div>
              <span className="block text-lg sm:text-xl font-bold text-white truncate">
                {kioskInfo.businessName || 'Visitor Check-In'}
              </span>
              <span className="text-xs sm:text-sm text-blue-200 font-medium">
                Self-Service Kiosk
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2 px-4 py-2 bg-white/10 rounded-full backdrop-blur-sm border border-white/20">
            <Clock className="w-4 h-4 sm:w-5 sm:h-5 text-blue-300" />
            <span className="font-mono text-sm sm:text-base font-semibold text-white">
              {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-10 md:py-16 pb-24">
        {screen === 'welcome' && renderWelcome()}
        {screen === 'preregistered' && renderPreRegistered()}
        {screen === 'walkin' && renderWalkIn()}
        {screen === 'confirm' && renderConfirm()}
        {screen === 'success' && renderSuccess()}
        {screen === 'checkout' && renderCheckout()}
      </div>

      {/* Footer - Glass morphism */}
      <div className="fixed bottom-0 left-0 right-0 z-10 bg-white/5 backdrop-blur-lg border-t border-white/10 py-3 sm:py-4">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 flex items-center justify-between text-xs sm:text-sm">
          <span className="text-blue-200 font-medium">Visitor Management System</span>
          <span className="text-white/60">Powered by <span className="font-semibold text-blue-300">Pump House ERP</span></span>
        </div>
      </div>
    </div>
  );
}

// Main component with authentication guard
function VisitorKiosk() {
  const { loading, authenticated, user, logout } = useKioskAuth({
    redirectTo: 'visitor',
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

  return <VisitorKioskContent user={user} logout={logout} />;
}

export default VisitorKiosk;
