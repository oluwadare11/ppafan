import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ArcElement } from 'chart.js';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { FaChartBar, FaUsers, FaFileExport, FaClock, FaServer } from 'react-icons/fa';
import { MdWork, MdEvent, MdSchedule, MdAccessTime } from 'react-icons/md';
import { useTenant } from '../context/TenantProvider';
import Dashboard from './attendance/Dashboard';
import EnhancedShiftManagement from './attendance/ShiftManagement';
import DeviceManagement from './attendance/DeviceManagement';
import HolidayAndLeave from './attendance/HolidayLeave';
import LeaveManagement from './attendance/leave/LeaveManagement';
import Reports from './attendance/Reports';
import StaffManagement from './attendance/StaffManagement';
import { formatDate, formatTime, isValidDate } from '../utils/dateUtils';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ArcElement);

const DEFAULT_SHIFT = { resumptionTime: '08:00', closingTime: '17:00' };

// Business-type-aware position templates
const BUSINESS_TYPE_POSITIONS = {
  'salon-spa': [
    'Manager', 'Assistant Manager', 'Senior Stylist', 'Stylist', 'Junior Stylist',
    'Nail Technician', 'Massage Therapist', 'Esthetician', 'Colorist',
    'Receptionist', 'Cleaner', 'Beauty Consultant', 'Spa Therapist'
  ],
  'restaurant-food': [
    'Manager', 'Assistant Manager', 'Head Chef', 'Sous Chef', 'Line Cook',
    'Prep Cook', 'Server', 'Bartender', 'Host/Hostess', 'Busser',
    'Dishwasher', 'Cashier', 'Delivery Driver', 'Kitchen Assistant'
  ],
  'retail-store': [
    'Store Manager', 'Assistant Manager', 'Shift Supervisor', 'Sales Associate',
    'Cashier', 'Stock Clerk', 'Visual Merchandiser', 'Loss Prevention',
    'Customer Service Representative', 'Inventory Specialist', 'Cleaner'
  ],
  'gym-fitness': [
    'Manager', 'Assistant Manager', 'Personal Trainer', 'Fitness Instructor',
    'Group Fitness Instructor', 'Gym Assistant', 'Receptionist', 'Cleaner',
    'Maintenance Technician', 'Nutritionist', 'Membership Consultant'
  ],
  'healthcare-clinic': [
    'Practice Manager', 'Nurse', 'Medical Assistant', 'Receptionist',
    'Billing Specialist', 'Lab Technician', 'X-Ray Technician',
    'Physical Therapist', 'Medical Secretary', 'Cleaner', 'Security'
  ],
  'auto-services': [
    'Service Manager', 'Mechanic', 'Auto Technician', 'Service Advisor',
    'Parts Specialist', 'Cashier', 'Detailer', 'Tire Technician',
    'Oil Change Technician', 'Receptionist', 'Cleaner'
  ],
  'professional-services': [
    'Manager', 'Senior Consultant', 'Consultant', 'Junior Consultant',
    'Administrative Assistant', 'Receptionist', 'Account Manager',
    'Project Manager', 'Research Analyst', 'Cleaner'
  ],
  'education-training': [
    'Director', 'Training Manager', 'Instructor', 'Teaching Assistant',
    'Academic Coordinator', 'Registrar', 'Administrative Assistant',
    'IT Support', 'Cleaner', 'Security', 'Librarian'
  ],
  'event-planning': [
    'Event Manager', 'Event Coordinator', 'Event Planner', 'Setup Crew',
    'Catering Coordinator', 'AV Technician', 'Security', 'Cleaner',
    'Decorator', 'Transportation Coordinator'
  ],
  'consulting-firm': [
    'Managing Partner', 'Senior Consultant', 'Consultant', 'Junior Consultant',
    'Business Analyst', 'Project Manager', 'Administrative Assistant',
    'Receptionist', 'IT Support', 'Cleaner'
  ],
  'engineering-services': [
    'Engineering Manager', 'Senior Engineer', 'Engineer', 'Junior Engineer',
    'CAD Technician', 'Project Manager', 'Quality Assurance',
    'Administrative Assistant', 'IT Support', 'Cleaner'
  ],
  'architecture-construction': [
    'Project Manager', 'Architect', 'Construction Manager', 'Site Supervisor',
    'Foreman', 'Carpenter', 'Electrician', 'Plumber', 'Laborer',
    'Safety Officer', 'Administrative Assistant', 'Cleaner'
  ],
  'legal-services': [
    'Managing Partner', 'Senior Attorney', 'Attorney', 'Paralegal',
    'Legal Assistant', 'Receptionist', 'Court Clerk', 'Legal Secretary',
    'IT Support', 'Cleaner', 'Security'
  ],
  'accounting-finance': [
    'Managing Partner', 'Senior Accountant', 'Accountant', 'Junior Accountant',
    'Bookkeeper', 'Tax Preparer', 'Auditor', 'Financial Analyst',
    'Administrative Assistant', 'Receptionist', 'IT Support', 'Cleaner'
  ],
  'real-estate': [
    'Broker', 'Real Estate Agent', 'Property Manager', 'Leasing Agent',
    'Administrative Assistant', 'Receptionist', 'Marketing Coordinator',
    'Maintenance Technician', 'Cleaner', 'Security'
  ],
  'insurance-agency': [
    'Agency Manager', 'Insurance Agent', 'Claims Adjuster', 'Underwriter',
    'Customer Service Representative', 'Administrative Assistant',
    'Receptionist', 'IT Support', 'Cleaner'
  ],
  'marketing-agency': [
    'Creative Director', 'Account Manager', 'Graphic Designer', 'Copywriter',
    'Social Media Manager', 'Digital Marketing Specialist', 'Web Developer',
    'Project Manager', 'Administrative Assistant', 'Receptionist', 'IT Support'
  ],
  'it-services': [
    'IT Manager', 'Senior Developer', 'Developer', 'Junior Developer',
    'System Administrator', 'Network Technician', 'Help Desk Technician',
    'Project Manager', 'Quality Assurance', 'Administrative Assistant', 'Cleaner'
  ],
  'place-of-worship': [
    'Administrative Manager', 'Secretary', 'Bookkeeper', 'Custodian',
    'Security', 'Maintenance', 'Receptionist', 'Event Coordinator',
    'Youth Coordinator', 'Music Director', 'Cleaner'
  ],
  'other-business': [
    'Manager', 'Assistant Manager', 'Supervisor', 'Team Lead',
    'Customer Service Representative', 'Administrative Assistant',
    'Receptionist', 'Cashier', 'IT Support', 'Cleaner', 'Security'
  ]
};

function Attendance() {
  // FIXED: Use tenant context instead of AuthContext
  const { 
    hasTenantContext, 
    makeRequest, 
    navigateWithTenant, 
    tenantInfo,
    currentTenant 
  } = useTenant();
  
  // Core UI state
  const [activeSection, setActiveSection] = useState('dashboard');
  const [isNavOpen, setIsNavOpen] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  // Loading states - separated for better UX
  const [initialLoading, setInitialLoading] = useState(true);
  const [dataLoading, setDataLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  
  // Data states with sensible defaults
  const [staff, setStaff] = useState([]);
  const [attendanceRecords, setAttendanceRecords] = useState([]);
  const [liveLogs, setLiveLogs] = useState([]);
  const [shifts, setShifts] = useState([]);
  const [leaveRequests, setLeaveRequests] = useState([]);
  const [holidays, setHolidays] = useState([]);
  const [devices, setDevices] = useState([]);
  
  // DYNAMIC: Department and position state - initialized with PumpHouse defaults
  const [departments, setDepartments] = useState([
    'Management', 'Operations', 'Customer Service', 'Engineering', 'Admin', 'PumpHouse'
  ]);
  const [positions, setPositions] = useState([
    'Manager', 'Assistant Manager', 'Supervisor', 'Staff', 'Cashier',
    'Chief Electrical Engineer', 'Project Engineer', 'Technician',
    'Accountant', 'Admin Officer', 'Business Development Executive',
    'Driver', 'Cleaner'
  ]);
  const [businessType, setBusinessType] = useState('other-business');
  
  // Default dashboard stats to render immediately
  const [dashboardStats, setDashboardStats] = useState({
    totalStaff: 0,
    presentToday: 0,
    absentToday: 0,
    lateToday: 0,
  });
  
  const [deviceStatus, setDeviceStatus] = useState({
    isOnline: false,
    lastSeen: null,
    totalRequests: 0,
    attendanceCount: 0
  });
  
  const [chartData, setChartData] = useState({ labels: [], datasets: [] });
  
  // Report/filter states
  const [reportPage, setReportPage] = useState(1);
  const [reportTotalPages, setReportTotalPages] = useState(1);
  const [filterDate, setFilterDate] = useState(new Date().toISOString().split('T')[0]);
  const [reportMode, setReportMode] = useState('day');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [shiftPage, setShiftPage] = useState(1);
  const [shiftTotalPages, setShiftTotalPages] = useState(1);
  const [shiftStaffFilter, setShiftStaffFilter] = useState('');
  const [selectedStaff, setSelectedStaff] = useState(null);
  const [editingShift, setEditingShift] = useState(null);
  const [lastFetchTime, setLastFetchTime] = useState(null);

  // Form states - REMOVED HARDCODED DEFAULT VALUES
  const [newStaff, setNewStaff] = useState({
    employeeId: '',
    firstName: '',
    lastName: '',
    email: '',
    phoneNumber: '',
    department: '', // No default value
    position: '', // No default value
    dateOfEmployment: '',
    employmentType: 'full-time',
    workSchedule: 'Mon-Fri 9:00-17:00',
    bankName: '',
    accountNumber: '',
    accountName: '',
    card: '',
    group: 1,
    timeZone: '0000000100000000',
    verifyMode: 0,
    pin: '',
  });
  const [editingStaff, setEditingStaff] = useState(null);
  const [newShift, setNewShift] = useState({ 
    employeeId: '', 
    selectedDays: [], 
    resumptionTime: '', 
    closingTime: '' 
  });
  const [newLeave, setNewLeave] = useState({ employeeId: '', startDate: '', endDate: '', reason: '' });
  const [editingLeave, setEditingLeave] = useState(null);
  const [newHoliday, setNewHoliday] = useState({ name: '', startDate: '', endDate: '' });
  const [manualEntry, setManualEntry] = useState({
    employeeId: '',
    date: '',
    checkIn: '',
    checkOut: '',
    status: 'present',
    remarks: '',
  });

  // Updated sidebar items with new navigation structure
  // Order: Dashboard -> Device Mgt -> Staff Mgt -> Schedule Mgt -> Holiday & Leave -> Reports
  const sidebarItems = [
    { id: 'dashboard', icon: FaChartBar, label: 'Dashboard' },
    { id: 'devices', icon: FaServer, label: 'Devices' },
    { id: 'staff', icon: FaUsers, label: 'Staff' },
    { id: 'shifts', icon: MdWork, label: 'Shifts' },
    { id: 'leave',    icon: MdEvent, label: 'Leave' },
    { id: 'holidays', icon: FaClock, label: 'Holidays' },
    { id: 'reports', icon: FaFileExport, label: 'Reports' },
  ];

  const todayStr = useMemo(() => {
    return new Date().toLocaleDateString('en-CA', { timeZone: 'Africa/Lagos' });
  }, []);

  const ATTENDANCE_CACHE_KEY = 'pumphouse_attendance_cache';

  // CRITICAL: Tenant context validation with aggressive cache loading for instant dashboard
  useEffect(() => {
    if (!hasTenantContext) {
      console.error('No tenant context - redirecting...');
      navigateWithTenant('/login');
      return;
    }

    // Try to load cached data instantly for SUPER FAST dashboard render
    // This data is preloaded after login by AuthContextDefinition
    let cacheLoaded = false;
    try {
      const cached = sessionStorage.getItem(ATTENDANCE_CACHE_KEY);
      if (cached) {
        const {
          staffData, depts, pos, attendanceData, liveLogData,
          statsData, deviceStatus: cachedDeviceStatus,
          leavesData, holidaysData, timestamp
        } = JSON.parse(cached);

        // Use cache if less than 5 minutes old
        if (Date.now() - timestamp < 5 * 60 * 1000) {
          console.log('[Attendance] Using preloaded cache for instant dashboard');

          // Core data
          if (staffData?.length) setStaff(staffData);
          if (depts?.length) setDepartments(depts);
          if (pos?.length) setPositions(pos);

          // Live monitoring data (super fast dashboard!)
          if (attendanceData?.length) setAttendanceRecords(attendanceData);
          if (liveLogData?.length) setLiveLogs(liveLogData);

          // Dashboard stats
          if (statsData) {
            setDashboardStats(statsData);
          } else if (staffData?.length) {
            setDashboardStats(prev => ({ ...prev, totalStaff: staffData.length }));
          }

          // Device status for live monitoring
          if (cachedDeviceStatus) {
            setDeviceStatus(cachedDeviceStatus);
          }

          // Leaves and holidays
          if (leavesData?.length) setLeaveRequests(leavesData);
          if (holidaysData?.length) setHolidays(holidaysData);

          cacheLoaded = true;
        }
      }
    } catch (e) {
      console.warn('Invalid attendance cache');
    }

    setInitialLoading(false);

    // Background refresh - even if cache is loaded, refresh in background for fresh data
    const startBackgroundLoading = async () => {
      // Only show loading indicator if no cache was loaded
      if (!cacheLoaded) setDataLoading(true);

      try {
        // Load departments and positions first
        const [deptRes, posRes, staffRes] = await Promise.all([
          fetchDepartments(),
          fetchPositions(),
          fetchStaffData()
        ]);

        // Update cache for next load
        const existingCache = sessionStorage.getItem(ATTENDANCE_CACHE_KEY);
        const existing = existingCache ? JSON.parse(existingCache) : {};
        sessionStorage.setItem(ATTENDANCE_CACHE_KEY, JSON.stringify({
          ...existing,
          staffData: staffRes || [],
          depts: deptRes || [],
          pos: posRes || [],
          timestamp: Date.now()
        }));
      } catch (err) {
        console.error('Background loading error:', err);
        if (!cacheLoaded) {
          setError('Failed to load some data. Retrying...');
          setTimeout(startBackgroundLoading, 3000);
        }
      } finally {
        setDataLoading(false);
      }
    };

    startBackgroundLoading();
  }, [hasTenantContext, navigateWithTenant]);

  // FIXED: Fetch departments using tenant-aware API
  const fetchDepartments = useCallback(async () => {
    try {
      const response = await makeRequest('/api/staff/departments');
      setDepartments(response.departments || []);
      return response.departments || [];
    } catch (err) {
      console.error('Failed to fetch departments:', err);
      // Set default departments if fetch fails (includes PumpHouse-specific departments)
      setDepartments(['Management', 'Operations', 'Customer Service', 'Engineering', 'Admin', 'PumpHouse']);
      throw err;
    }
  }, [makeRequest]);

  // FIXED: Fetch positions using tenant-aware API
  const fetchPositions = useCallback(async () => {
    try {
      const response = await makeRequest('/api/staff/positions');
      setPositions(response.positions || []);
      return response.positions || [];
    } catch (err) {
      console.error('Failed to fetch positions:', err);
      // Set PumpHouse-specific default positions if fetch fails
      const pumpHousePositions = [
        'Manager', 'Assistant Manager', 'Supervisor', 'Staff', 'Cashier',
        'Chief Electrical Engineering', 'Project Engineer', 'Technician',
        'Accountant', 'Admin Officer', 'Business Development Executive',
        'Driver', 'Cleaner'
      ];
      setPositions(pumpHousePositions);
      throw err;
    }
  }, [makeRequest]);

  // FIXED: Add department management functions
  const handleAddDepartment = useCallback(async (departmentName) => {
    if (!departmentName.trim()) {
      setError('Department name is required');
      return false;
    }

    try {
      setActionLoading(true);
      await makeRequest('/api/staff/departments', {
        method: 'POST',
        body: JSON.stringify({ name: departmentName.trim() })
      });
      
      await fetchDepartments();
      setSuccess('Department added successfully!');
      setTimeout(() => setSuccess(''), 3000);
      return true;
    } catch (err) {
      console.error('Failed to add department:', err);
      setError('Failed to add department: ' + (err.message || 'Unknown error'));
      return false;
    } finally {
      setActionLoading(false);
    }
  }, [makeRequest, fetchDepartments]);

  const handleRemoveDepartment = useCallback(async (departmentName) => {
    if (!window.confirm(`Are you sure you want to remove the department "${departmentName}"?`)) {
      return false;
    }

    try {
      setActionLoading(true);
      await makeRequest(`/api/staff/departments/${encodeURIComponent(departmentName)}`, {
        method: 'DELETE'
      });
      
      await fetchDepartments();
      setSuccess('Department removed successfully!');
      setTimeout(() => setSuccess(''), 3000);
      return true;
    } catch (err) {
      console.error('Failed to remove department:', err);
      setError('Failed to remove department: ' + (err.message || 'Unknown error'));
      return false;
    } finally {
      setActionLoading(false);
    }
  }, [makeRequest, fetchDepartments]);

  // FIXED: Add position management functions
  const handleAddPosition = useCallback(async (positionName, department) => {
    if (!positionName.trim() || !department.trim()) {
      setError('Position name and department are required');
      return false;
    }

    try {
      setActionLoading(true);
      await makeRequest('/api/staff/positions', {
        method: 'POST',
        body: JSON.stringify({ 
          name: positionName.trim(), 
          department: department.trim() 
        })
      });
      
      await fetchPositions();
      setSuccess('Position added successfully!');
      setTimeout(() => setSuccess(''), 3000);
      return true;
    } catch (err) {
      console.error('Failed to add position:', err);
      setError('Failed to add position: ' + (err.message || 'Unknown error'));
      return false;
    } finally {
      setActionLoading(false);
    }
  }, [makeRequest, fetchPositions]);

  const handleRemovePosition = useCallback(async (positionName, department) => {
    if (!window.confirm(`Are you sure you want to remove the position "${positionName}" from "${department}"?`)) {
      return false;
    }

    try {
      setActionLoading(true);
      await makeRequest(`/api/staff/positions/${encodeURIComponent(positionName)}/${encodeURIComponent(department)}`, {
        method: 'DELETE'
      });
      
      await fetchPositions();
      setSuccess('Position removed successfully!');
      setTimeout(() => setSuccess(''), 3000);
      return true;
    } catch (err) {
      console.error('Failed to remove position:', err);
      setError('Failed to remove position: ' + (err.message || 'Unknown error'));
      return false;
    } finally {
      setActionLoading(false);
    }
  }, [makeRequest, fetchPositions]);

  // FIXED: Staff data fetcher using tenant-aware API
  const fetchStaffData = useCallback(async () => {
    try {
      const response = await makeRequest('/api/staff');
      const staffData = response.staff || response || [];
      setStaff(staffData);

      const activeCount = staffData.filter(s => s.status === 'active').length;
      setDashboardStats(prev => ({
        ...prev,
        totalStaff: activeCount,
        absentToday: activeCount
      }));
      
      return staffData;
    } catch (err) {
      console.error('Failed to fetch staff:', err);
      throw err;
    }
  }, [makeRequest]);

  // Background data loader
  useEffect(() => {
    if (staff.length === 0) return;

    const loadBackgroundData = async () => {
      try {
        const [attendanceRes, leavesRes, holidaysRes, shiftsRes, devicesRes] = await Promise.allSettled([
          fetchAttendanceSummary(),
          makeRequest('/api/attendance/leaves'),
          makeRequest('/api/attendance/holidays'),
          fetchShifts(),
          fetchDevices()
        ]);

        if (leavesRes.status === 'fulfilled') {
          setLeaveRequests(leavesRes.value.data || leavesRes.value || []);
        }
        if (holidaysRes.status === 'fulfilled') {
          setHolidays(holidaysRes.value.data || holidaysRes.value || []);
        }

        setDataLoading(false);
        setError('');
      } catch (err) {
        console.error('Background data loading failed:', err);
        setDataLoading(false);
      }
    };

    loadBackgroundData();
  }, [staff.length]);

  // FIXED: Fetch devices using tenant-aware API
  const fetchDevices = useCallback(async () => {
    try {
      const response = await makeRequest('/api/devices');
      setDevices(response.devices || []);
    } catch (err) {
      console.error('Failed to fetch devices:', err);
    }
  }, [makeRequest]);

  // FIXED: Optimized attendance summary fetcher using tenant-aware API
  const fetchAttendanceSummary = useCallback(async () => {
    try {
      const now = Date.now();
      if (lastFetchTime && (now - lastFetchTime) < 3000) {
        return;
      }

      const params = { mode: reportMode, page: reportPage };
      if (reportMode === 'day') {
        params.startDate = filterDate;
      } else if (reportMode === 'custom') {
        params.startDate = customStartDate;
        params.endDate = customEndDate;
      } else {
        params.startDate = new Date().toISOString().split('T')[0];
      }

      const response = await makeRequest('/api/adms/attendance-summary', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      const records = response.records || [];
      setAttendanceRecords(records);
      
      const processedLiveLogs = (response.recent || []).map(log => ({
        ...log,
        photoUrl: log.photoId ? `/api/adms/photo/${log.photoId}` : null
      }));
      setLiveLogs(processedLiveLogs);
      
      setDeviceStatus({
        isOnline: response.device?.isOnline || false,
        lastSeen: response.device?.lastSeen || null,
        totalRequests: response.device?.totalRequests || 0,
        attendanceCount: response.device?.attendanceCount || 0,
      });
      
      setReportTotalPages(response.totalPages || 1);
      setLastFetchTime(now);
      
      if (staff.length > 0) {
        calculateDashboardStats(staff, records);
        updateChartData(records, 'today');
      }

      // Update session cache with attendance data for faster subsequent loads
      try {
        const cached = sessionStorage.getItem(ATTENDANCE_CACHE_KEY);
        if (cached) {
          const existing = JSON.parse(cached);
          sessionStorage.setItem(ATTENDANCE_CACHE_KEY, JSON.stringify({
            ...existing,
            attendanceData: records,
            liveLogData: processedLiveLogs,
            statsData: dashboardStats,
            timestamp: Date.now()
          }));
        }
      } catch (e) { /* ignore cache errors */ }

      return records;
    } catch (err) {
      console.error('Failed to fetch attendance summary:', err);
      throw err;
    }
  }, [reportMode, filterDate, customStartDate, customEndDate, reportPage, lastFetchTime, staff, makeRequest]);

  // Calculate dashboard stats
  const calculateDashboardStats = useCallback((staffData, attendanceData) => {
    if (!staffData?.length) {
      setDashboardStats({
        totalStaff: 0,
        presentToday: 0,
        absentToday: 0,
        lateToday: 0,
      });
      return;
    }

    const totalStaff = staffData.filter(s => s.status === 'active').length;
    const todayRecords = attendanceData.filter(record => {
      if (!record) return false;
      const dateStr = record.date || (record.timestamp && isValidDate(record.timestamp)
        ? new Date(record.timestamp).toLocaleDateString('en-CA', { timeZone: 'Africa/Lagos' })
        : null);
      return dateStr === todayStr;
    });

    if (todayRecords.length === 0) {
      setDashboardStats({
        totalStaff,
        presentToday: 0,
        absentToday: totalStaff,
        lateToday: 0,
      });
      return;
    }

    const uniqueStaffPresent = new Set();
    const uniqueStaffLate = new Set();

    todayRecords.forEach(record => {
      if (!record?.employeeId) return;
      
      const isPresent = record.checkIn || record.checkOut || !record.absent;
      
      if (isPresent) {
        uniqueStaffPresent.add(record.employeeId);
      }

      if (record.late && isPresent) {
        uniqueStaffLate.add(record.employeeId);
      }
    });

    setDashboardStats({
      totalStaff,
      presentToday: uniqueStaffPresent.size,
      absentToday: totalStaff - uniqueStaffPresent.size,
      lateToday: uniqueStaffLate.size,
    });
  }, [todayStr]);

  // Update chart data
  const updateChartData = useCallback((data, period) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const labels = [];
    const datasets = [];
    const staffMap = new Map(staff.map(s => [s.employeeId, `${s.firstName} ${s.lastName || ''}`]));
    const colors = ['#22C55E', '#EF4444', '#3B82F6', '#F59E0B', '#8B5CF6', '#EC4899', '#10B981', '#F97316'];

    if (period === 'today') {
      const todayRecords = data.filter(record => {
        if (!record) return false;
        const dateStr = record.date || (record.timestamp && isValidDate(record.timestamp) 
          ? new Date(record.timestamp).toLocaleDateString('en-CA', { timeZone: 'Africa/Lagos' }).split('T')[0] 
          : null);
        return dateStr === todayStr;
      });

      if (todayRecords.length === 0) {
        setChartData({
          labels: [today.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'Africa/Lagos' })],
          datasets: [],
        });
        return;
      }

      const uniqueStaff = [...new Set(todayRecords.map(record => record.employeeId))];
      labels.push(today.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'Africa/Lagos' }));

      uniqueStaff.forEach((employeeId, index) => {
        const employeeRecord = todayRecords.find(record => record.employeeId === employeeId);
        if (!employeeRecord) return;

        const isPresent = employeeRecord.checkIn || employeeRecord.checkOut || !employeeRecord.absent;
        const isLate = employeeRecord.late && isPresent;
        const isAbsent = employeeRecord.absent || !isPresent;

        datasets.push(
          {
            label: `${staffMap.get(employeeId) || employeeId} (Present)`,
            data: [isPresent ? 1 : 0],
            backgroundColor: colors[index % colors.length],
            stack: 'Stack 0',
          },
          {
            label: `${staffMap.get(employeeId) || employeeId} (Late)`,
            data: [isLate ? 1 : 0],
            backgroundColor: colors[(index + 1) % colors.length],
            stack: 'Stack 1',
          },
          {
            label: `${staffMap.get(employeeId) || employeeId} (Absent)`,
            data: [isAbsent ? 1 : 0],
            backgroundColor: colors[(index + 2) % colors.length],
            stack: 'Stack 2',
          }
        );
      });
    }

    setChartData({ labels, datasets });
  }, [staff, todayStr]);

  // Staff helper functions
  const getStaffName = useCallback((record) => {
    if (!record) return 'Unknown Staff';
    if (record.staffName) return record.staffName;
    
    let employeeId = record.employeeId;
    if (typeof record.employeeId === 'object') {
      employeeId = record.employeeId._id || record.employeeId;
    }
    if (!employeeId && record.staffId) {
      employeeId = record.staffId;
    }
    
    const staffMember = staff.find(s => s.employeeId === employeeId);
    return staffMember ? `${staffMember.firstName} ${staffMember.lastName || ''}`.trim() : 'Unknown Staff';
  }, [staff]);

  const getStaffPosition = useCallback((record) => {
    if (!record) return 'Unknown Position';
    if (record.position) return record.position;
    
    let employeeId = record.employeeId;
    if (typeof record.employeeId === 'object') {
      employeeId = record.employeeId._id || record.employeeId;
    }
    if (!employeeId && record.staffId) {
      employeeId = record.staffId;
    }
    
    const staffMember = staff.find(s => s.employeeId === employeeId);
    return staffMember?.position || 'Unknown Position';
  }, [staff]);

  // FIXED: Fetch shifts using tenant-aware API
  const fetchShifts = useCallback(async () => {
    try {
      const url = `/api/attendance/shifts?page=${shiftPage}&limit=100${shiftStaffFilter ? `&staffId=${shiftStaffFilter}` : ''}`;
      const response = await makeRequest(url);
      
      setShifts(Array.isArray(response.shifts) ? response.shifts : []);
      setShiftTotalPages(response.totalPages || 1);
    } catch (error) {
      console.error('Error fetching shifts:', error);
    }
  }, [shiftPage, shiftStaffFilter, makeRequest]);

  // Auto-refresh functionality for dashboard
  useEffect(() => {
    if (activeSection !== 'dashboard' || staff.length === 0) return;

    const interval = setInterval(() => {
      fetchAttendanceSummary().catch(err => 
        console.error('Silent refresh failed:', err)
      );
    }, 30000);

    return () => clearInterval(interval);
  }, [activeSection, staff.length, fetchAttendanceSummary]);

  // Generate employee ID function - starts from 101, reserves 1000+ for admin
  const generateEmployeeId = useCallback(async () => {
    try {
      // Get all existing IDs as numbers for comparison
      const existingIds = staff.map(s => parseInt(s.employeeId, 10)).filter(id => !isNaN(id));

      // Start from 101, reserve 1000+ for admin accounts
      let newId = 101;
      while (existingIds.includes(newId)) {
        newId++;
        // Stop at 999 - IDs 1000+ are reserved for admin
        if (newId >= 1000) throw new Error('No available Employee IDs (max 999 for regular staff)');
      }

      // Return as 4-digit padded string (backend expects 4 digits)
      return newId.toString().padStart(4, '0');
    } catch (err) {
      setError('Error generating Employee ID: ' + err.message);
      throw err;
    }
  }, [staff]);

  // FIXED: CRUD operations using tenant-aware API
  const handleAddStaff = useCallback(async (e) => {
    e.preventDefault();
    try {
      setActionLoading(true);
      const employeeId = await generateEmployeeId();
      const staffData = {
        ...newStaff,
        employeeId,
        subBusiness: newStaff.department || 'General',
        bankDetails: {
          bankName: newStaff.bankName,
          accountNumber: newStaff.accountNumber,
          accountName: newStaff.accountName,
        },
      };
      const response = await makeRequest('/api/staff', {
        method: 'POST',
        body: JSON.stringify(staffData)
      });
      setStaff([...staff, response.staff || response]);
      setNewStaff({
        employeeId: '',
        firstName: '',
        lastName: '',
        email: '',
        phoneNumber: '',
        department: '',
        position: '',
        dateOfEmployment: '',
        employmentType: 'full-time',
        workSchedule: 'Mon-Fri 9:00-17:00',
        bankName: '',
        accountNumber: '',
        accountName: '',
        card: '',
        group: 1,
        timeZone: '0000000100000000',
        verifyMode: 0,
        pin: '',
      });
      setSuccess('Staff added successfully!');
      setTimeout(() => setSuccess(''), 3000);
      setError('');
      
      fetchAttendanceSummary().catch(console.error);
    } catch (err) {
      console.error('Failed to add staff:', err);
      setError('Failed to add staff: ' + (err.message || 'Unknown error'));
    } finally {
      setActionLoading(false);
    }
  }, [staff, newStaff, fetchAttendanceSummary, makeRequest, generateEmployeeId]);

  const handleEditStaff = useCallback(async (e) => {
    e.preventDefault();
    try {
      setActionLoading(true);
      const staffData = {
        ...editingStaff,
        bankDetails: {
          bankName: editingStaff.bankName,
          accountNumber: editingStaff.accountNumber,
          accountName: editingStaff.accountName,
        },
      };
      const response = await makeRequest(`/api/staff/${editingStaff._id}`, {
        method: 'PUT',
        body: JSON.stringify(staffData)
      });
      setStaff(staff.map(s => s._id === editingStaff._id ? (response.staff || response) : s));
      setEditingStaff(null);
      setSuccess('Staff updated successfully!');
      setTimeout(() => setSuccess(''), 3000);
      setError('');
    } catch (err) {
      console.error('Failed to update staff:', err);
      setError('Failed to update staff: ' + (err.message || 'Unknown error'));
    } finally {
      setActionLoading(false);
    }
  }, [staff, editingStaff, makeRequest]);

  const handleDeleteStaff = useCallback(async (staffId) => {
    try {
      setActionLoading(true);
      await makeRequest(`/api/staff/${staffId}`, {
        method: 'DELETE'
      });
      setStaff(staff.filter(s => s._id !== staffId));
      setSuccess('Staff deleted successfully!');
      setTimeout(() => setSuccess(''), 3000);
      setError('');
    } catch (err) {
      console.error('Failed to delete staff:', err);
      setError('Failed to delete staff: ' + (err.message || 'Unknown error'));
    } finally {
      setActionLoading(false);
    }
  }, [staff, makeRequest]);

  // FIXED: Manual entry handler using tenant-aware API
  const handleManualEntry = useCallback(async (e) => {
    e.preventDefault();
    try {
      setActionLoading(true);
      await makeRequest('/api/attendance/manual', {
        method: 'POST',
        body: JSON.stringify(manualEntry)
      });
      setManualEntry({
        employeeId: '',
        date: '',
        checkIn: '',
        checkOut: '',
        status: 'present',
        remarks: '',
      });
      setSuccess('Manual entry submitted successfully!');
      setTimeout(() => setSuccess(''), 3000);
      setError('');
      
      fetchAttendanceSummary().catch(console.error);
    } catch (err) {
      console.error('Failed to submit manual entry:', err);
      setError('Failed to submit manual entry: ' + (err.message || 'Unknown error'));
    } finally {
      setActionLoading(false);
    }
  }, [manualEntry, fetchAttendanceSummary, makeRequest]);

  // FIXED: Shift management handlers using tenant-aware API
  // Now accepts shiftData parameter with isFullDayReference and isHalfDay flags
  const handleAddShift = useCallback(async (e, shiftData = null) => {
    e.preventDefault();

    // Use shiftData if provided (from ShiftManagement component), otherwise use state
    const data = shiftData || newShift;
    const employeeId = data.employeeId || newShift.employeeId;
    const resumptionTime = data.resumptionTime || newShift.resumptionTime;
    const closingTime = data.closingTime || newShift.closingTime;
    const isFullDayReference = data.isFullDayReference || false;
    const isHalfDay = data.isHalfDay || false;
    const dayOfWeek = data.dayOfWeek; // Single day from ShiftManagement loop

    if (!employeeId || !resumptionTime || !closingTime) {
      setError('Please fill in all required fields');
      return;
    }

    try {
      setActionLoading(true);

      // If single day provided (from ShiftManagement loop), create single shift
      if (dayOfWeek) {
        await makeRequest('/api/attendance/shifts', {
          method: 'POST',
          body: JSON.stringify({
            employeeId,
            dayOfWeek,
            resumptionTime,
            closingTime,
            isFullDayReference,
            isHalfDay
          })
        });
      } else if (newShift.selectedDays?.length) {
        // Bulk create shifts for all selected days
        const shifts = newShift.selectedDays.map(day => ({
          employeeId,
          dayOfWeek: day,
          resumptionTime,
          closingTime,
          isFullDayReference: false,
          isHalfDay: false
        }));

        await makeRequest('/api/attendance/shifts/bulk', {
          method: 'POST',
          body: JSON.stringify({ shifts })
        });

        setNewShift({ employeeId: '', selectedDays: [], resumptionTime: '', closingTime: '' });
        setSelectedStaff(null);
        setEditingShift(null);

        setSuccess(`Shift schedule created for ${newShift.selectedDays.length} day(s)!`);
        setTimeout(() => setSuccess(''), 3000);
      }

      setError('');
      await fetchShifts();

    } catch (err) {
      console.error('Failed to create shift:', err);
      setError('Failed to create shift: ' + (err.message || 'Unknown error'));
    } finally {
      setActionLoading(false);
    }
  }, [newShift, fetchShifts, makeRequest]);

  const handleDeleteShift = useCallback(async (shiftId) => {
    if (!window.confirm('Are you sure you want to delete this shift?')) {
      return;
    }

    try {
      setActionLoading(true);
      await makeRequest(`/api/attendance/shifts/${shiftId}`, {
        method: 'DELETE'
      });
      
      setSuccess('Shift deleted successfully!');
      setTimeout(() => setSuccess(''), 3000);
      setError('');
      
      await fetchShifts();
      
    } catch (err) {
      console.error('Failed to delete shift:', err);
      setError('Failed to delete shift: ' + (err.message || 'Unknown error'));
    } finally {
      setActionLoading(false);
    }
  }, [fetchShifts, makeRequest]);

  // FIXED: Leave management handlers using tenant-aware API
  const handleAddLeave = useCallback(async (e) => {
    e.preventDefault();
    if (!newLeave.employeeId || !newLeave.startDate || !newLeave.endDate) {
      setError('Please fill in all required fields');
      return;
    }

    try {
      setActionLoading(true);
      
      const response = await makeRequest('/api/attendance/leaves', {
        method: 'POST',
        body: JSON.stringify({
          employeeId: newLeave.employeeId,
          startDate: newLeave.startDate,
          endDate: newLeave.endDate,
          reason: newLeave.reason,
          leaveType: 'Annual'
        })
      });
      
      setLeaveRequests(prev => [response, ...prev]);
      
      setNewLeave({ employeeId: '', startDate: '', endDate: '', reason: '' });
      
      setSuccess('Leave request added successfully!');
      setTimeout(() => setSuccess(''), 3000);
      setError('');
      
    } catch (err) {
      console.error('Failed to add leave request:', err);
      setError('Failed to add leave request: ' + (err.message || 'Unknown error'));
    } finally {
      setActionLoading(false);
    }
  }, [newLeave, makeRequest]);

  const handleEditLeave = useCallback(async (e) => {
    e.preventDefault();
    if (!editingLeave) return;

    try {
      setActionLoading(true);
      
      const response = await makeRequest(`/api/attendance/leaves/${editingLeave._id}`, {
        method: 'PUT',
        body: JSON.stringify({
          employeeId: editingLeave.employeeId,
          startDate: editingLeave.startDate,
          endDate: editingLeave.endDate,
          reason: editingLeave.reason,
          status: editingLeave.status || 'Pending'
        })
      });
      
      setLeaveRequests(prev => prev.map(leave => 
        leave._id === editingLeave._id ? response : leave
      ));
      
      setEditingLeave(null);
      setNewLeave({ employeeId: '', startDate: '', endDate: '', reason: '' });
      
      setSuccess('Leave request updated successfully!');
      setTimeout(() => setSuccess(''), 3000);
      setError('');
      
    } catch (err) {
      console.error('Failed to update leave request:', err);
      setError('Failed to update leave request: ' + (err.message || 'Unknown error'));
    } finally {
      setActionLoading(false);
    }
  }, [editingLeave, makeRequest]);

  const handleDeleteLeave = useCallback(async (leaveId) => {
    if (!window.confirm('Are you sure you want to delete this leave request?')) {
      return;
    }

    try {
      setActionLoading(true);
      await makeRequest(`/api/attendance/leaves/${leaveId}`, {
        method: 'DELETE'
      });
      
      setLeaveRequests(prev => prev.filter(leave => leave._id !== leaveId));
      
      setSuccess('Leave request deleted successfully!');
      setTimeout(() => setSuccess(''), 3000);
      setError('');
      
    } catch (err) {
      console.error('Failed to delete leave request:', err);
      setError('Failed to delete leave request: ' + (err.message || 'Unknown error'));
    } finally {
      setActionLoading(false);
    }
  }, [makeRequest]);

  // FIXED: Holiday management handlers using tenant-aware API
  const handleAddHoliday = useCallback(async (e) => {
    e.preventDefault();

    if (!newHoliday.name || !newHoliday.startDate) {
      setError('Holiday name and start date are required');
      return;
    }

    try {
      setActionLoading(true);

      const response = await makeRequest('/api/attendance/holidays', {
        method: 'POST',
        body: JSON.stringify({
          name: newHoliday.name.trim(),
          startDate: newHoliday.startDate,
          endDate: newHoliday.endDate || newHoliday.startDate
        })
      });

      const added = response.holidays || (response.holiday ? [response.holiday] : []);
      setHolidays(prevHolidays => [...prevHolidays, ...added]);

      setNewHoliday({ name: '', startDate: '', endDate: '' });

      const count = added.length;
      setSuccess(`${count} holiday${count !== 1 ? 's' : ''} added successfully!`);
      setTimeout(() => setSuccess(''), 3000);
      setError('');

    } catch (err) {
      console.error('Failed to add holiday:', err);
      const errorMessage = err.message || 'Failed to add holiday';
      setError(errorMessage);
    } finally {
      setActionLoading(false);
    }
  }, [newHoliday, makeRequest]);

  const handleDeleteHoliday = useCallback(async (holidayId) => {
    if (!holidayId) {
      setError('Invalid holiday ID');
      return;
    }
    
    if (!window.confirm('Are you sure you want to delete this holiday?')) {
      return;
    }
    
    try {
      setActionLoading(true);
      
      await makeRequest(`/api/attendance/holidays/${holidayId}`, {
        method: 'DELETE'
      });
      
      setHolidays(prevHolidays => 
        prevHolidays.filter(holiday => holiday._id !== holidayId)
      );
      
      setSuccess('Holiday deleted successfully!');
      setTimeout(() => setSuccess(''), 3000);
      setError('');
      
    } catch (err) {
      console.error('Failed to delete holiday:', err);
      const errorMessage = err.message || 'Failed to delete holiday';
      setError(errorMessage);
    } finally {
      setActionLoading(false);
    }
  }, [makeRequest]);

  // FIXED: Force device sync using tenant-aware API
  const forceDeviceSync = useCallback(async () => {
    try {
      setActionLoading(true);
      await makeRequest('/api/adms/force-sync', {
        method: 'POST',
        body: JSON.stringify({})
      });
      setSuccess('Device sync initiated. Data will refresh automatically.');
      setTimeout(() => {
        setSuccess('');
        fetchAttendanceSummary().catch(console.error);
      }, 3000);
    } catch (error) {
      console.error('Error forcing device sync:', error);
      setError('Failed to initiate device sync');
    } finally {
      setActionLoading(false);
    }
  }, [fetchAttendanceSummary, makeRequest]);

  // PDF generation
  const generateReport = useCallback(() => {
    const doc = new jsPDF();
    doc.setFontSize(18);
    doc.text('Attendance Report', 14, 22);

    const tableData = attendanceRecords.map(record => [
      getStaffName(record),
      getStaffPosition(record),
      formatDate(record.date, 'short'),
      record.checkIn ? formatTime(record.checkIn) : '-',
      record.checkOut ? formatTime(record.checkOut) : '-',
      record.lateMinutes > 0 ? `${record.lateMinutes} min` : '-',
      record.earlyLeaveMinutes > 0 ? `${record.earlyLeaveMinutes} min` : '-',
      record.absent ? 'Yes' : 'No',
    ]);

    doc.autoTable({
      head: [['Staff Name', 'Position', 'Date', 'Check-In', 'Check-Out', 'Late', 'Early Leave', 'Absent']],
      body: tableData,
      startY: 30,
      theme: 'grid',
      headStyles: { fillColor: [59, 130, 246] },
      styles: { fontSize: 10 },
    });

    doc.save(`attendance-report-${reportMode === 'day' ? filterDate : reportMode}.pdf`);
  }, [attendanceRecords, getStaffName, getStaffPosition, reportMode, filterDate]);

  // Show initial loading only briefly for authentication check
  if (initialLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white p-6 rounded-lg shadow-lg flex items-center gap-3">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
          <span className="text-gray-700">Loading...</span>
        </div>
      </div>
    );
  }

  // Main render - page loads immediately with default data
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="w-full px-3 sm:px-5 lg:px-8 py-4 sm:py-6 lg:py-8 space-y-4 sm:space-y-6 lg:space-y-8">
        <div className="mb-4 sm:mb-6 lg:mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900">Attendance Management</h1>
              <p className="text-gray-600 text-sm sm:text-base mt-1">Track staff attendance and manage devices</p>
            </div>
            <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
              {dataLoading && (
                <div className="flex items-center gap-2 text-blue-600 bg-blue-50 px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg border border-blue-200">
                  <div className="animate-spin rounded-full h-3 w-3 sm:h-4 sm:w-4 border-b-2 border-blue-600"></div>
                  <span className="text-xs sm:text-sm font-medium">Syncing...</span>
                </div>
              )}
              <div className="text-xs text-gray-500 bg-white px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg border border-gray-200 shadow-sm">
                {staff.length > 0 ? `${staff.length} staff • ${devices.length} devices` : 'Loading...'}
              </div>
            </div>
          </div>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-800 flex items-center gap-2">
            <div className="w-2 h-2 bg-red-500 rounded-full"></div>
            {error}
          </div>
        )}
        {success && (
          <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg text-green-800 flex items-center gap-2">
            <div className="w-2 h-2 bg-green-500 rounded-full"></div>
            {success}
          </div>
        )}

        {/* Action Loading Overlay */}
        {actionLoading && (
          <div className="fixed inset-0 bg-black bg-opacity-20 flex items-center justify-center z-50">
            <div className="bg-white p-6 rounded-lg shadow-lg flex items-center gap-3">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
              Processing...
            </div>
          </div>
        )}

        <div className="sticky top-0 z-10 bg-white shadow-lg rounded-xl mb-4 sm:mb-6 lg:mb-8">
          <div className="flex items-center justify-between px-2 sm:px-4 h-12 sm:h-14 lg:h-16">
            {/* Desktop Navigation */}
            <div className="hidden md:flex space-x-1 lg:space-x-2 overflow-x-auto">
              {sidebarItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => setActiveSection(item.id)}
                  className={`flex items-center gap-1.5 lg:gap-2 px-2 lg:px-4 py-1.5 lg:py-2 text-xs lg:text-sm font-medium rounded-lg transition-colors whitespace-nowrap ${
                    activeSection === item.id
                      ? 'bg-blue-600 text-white shadow-md'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  <item.icon className="text-base lg:text-lg flex-shrink-0" />
                  <span className="hidden lg:inline">{item.label}</span>
                  <span className="lg:hidden">{item.label.split(' ')[0]}</span>
                </button>
              ))}
            </div>

            {/* Mobile Navigation Toggle */}
            <div className="md:hidden flex items-center justify-between w-full">
              <span className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                {sidebarItems.find(item => item.id === activeSection)?.icon &&
                  React.createElement(sidebarItems.find(item => item.id === activeSection).icon, { className: "text-blue-600" })}
                {sidebarItems.find(item => item.id === activeSection)?.label}
              </span>
              <button
                onClick={() => setIsNavOpen(!isNavOpen)}
                className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d={isNavOpen ? 'M6 18L18 6M6 6l12 12' : 'M4 6h16M4 12h16m-7 6h7'} />
                </svg>
              </button>
            </div>
          </div>

          {/* Mobile Navigation Menu */}
          {isNavOpen && (
            <div className="md:hidden bg-white border-t border-gray-200 rounded-b-xl shadow-inner">
              <div className="grid grid-cols-2 gap-1 p-2">
                {sidebarItems.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => {
                      setActiveSection(item.id);
                      setIsNavOpen(false);
                    }}
                    className={`flex items-center gap-2 px-3 py-3 text-sm font-medium rounded-lg transition-colors ${
                      activeSection === item.id
                        ? 'bg-blue-600 text-white shadow-md'
                        : 'text-gray-600 hover:bg-gray-100 bg-gray-50'
                    }`}
                  >
                    <item.icon className="text-lg flex-shrink-0" />
                    <span className="truncate text-xs sm:text-sm">{item.label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* DASHBOARD SECTION */}
        {activeSection === 'dashboard' && (
          <Dashboard
            dashboardStats={dashboardStats}
            chartData={chartData}
            staff={staff}
            attendanceRecords={attendanceRecords}
            liveLogs={liveLogs}
            getStaffName={getStaffName}
            getStaffPosition={getStaffPosition}
            loading={dataLoading}
            fetchAttendanceSummary={fetchAttendanceSummary}
          />
        )}

        {/* STAFF MANAGEMENT SECTION */}
        {activeSection === 'staff' && (
          <StaffManagement
            staff={staff}
            newStaff={newStaff}
            setNewStaff={setNewStaff}
            editingStaff={editingStaff}
            setEditingStaff={setEditingStaff}
            departments={departments}
            positions={positions}
            handleAddStaff={handleAddStaff}
            handleEditStaff={handleEditStaff}
            handleDeleteStaff={handleDeleteStaff}
            generateEmployeeId={generateEmployeeId}
            loading={actionLoading}
          />
        )}

        {/* SCHEDULE MANAGEMENT SECTION (SHIFTS + MANUAL) */}
        {activeSection === 'shifts' && (
          <EnhancedShiftManagement
            shifts={shifts}
            newShift={newShift}
            setNewShift={setNewShift}
            editingShift={editingShift}
            setEditingShift={setEditingShift}
            staff={staff}
            shiftPage={shiftPage}
            setShiftPage={setShiftPage}
            shiftTotalPages={shiftTotalPages}
            shiftStaffFilter={shiftStaffFilter}
            setShiftStaffFilter={setShiftStaffFilter}
            selectedStaff={selectedStaff}
            setSelectedStaff={setSelectedStaff}
            handleAddShift={handleAddShift}
            handleDeleteShift={handleDeleteShift}
            fetchShifts={fetchShifts}
            loading={actionLoading}
            // Manual adjustment props
            manualEntry={manualEntry}
            setManualEntry={setManualEntry}
            handleManualEntry={handleManualEntry}
          />
        )}

        {/* DEVICE MANAGEMENT SECTION */}
        {activeSection === 'devices' && (
          <DeviceManagement
            loading={actionLoading}
          />
        )}

        {/* LEAVE SECTION */}
        {activeSection === 'leave' && (
          <LeaveManagement staff={staff} />
        )}

        {/* HOLIDAYS SECTION */}
        {activeSection === 'holidays' && (
          <HolidayAndLeave
            holidays={holidays}
            newHoliday={newHoliday}
            setNewHoliday={setNewHoliday}
            handleAddHoliday={handleAddHoliday}
            handleDeleteHoliday={handleDeleteHoliday}
            loading={actionLoading}
          />
        )}

        {/* REPORTS SECTION */}
        {activeSection === 'reports' && (
          <Reports
            attendanceRecords={attendanceRecords}
            staff={staff}
            getStaffName={getStaffName}
            getStaffPosition={getStaffPosition}
            generateReport={generateReport}
            reportMode={reportMode}
            setReportMode={setReportMode}
            filterDate={filterDate}
            setFilterDate={setFilterDate}
            customStartDate={customStartDate}
            setCustomStartDate={setCustomStartDate}
            customEndDate={customEndDate}
            setCustomEndDate={setCustomEndDate}
            reportPage={reportPage}
            setReportPage={setReportPage}
            reportTotalPages={reportTotalPages}
            fetchAttendanceSummary={fetchAttendanceSummary}
            loading={dataLoading}
          />
        )}
      </div>
    </div>
  );
}

export default Attendance;