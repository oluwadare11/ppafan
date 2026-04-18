import React, { memo, useState, useCallback, useEffect, useMemo, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bar, Pie, Doughnut, Line } from 'react-chartjs-2';
import { FaFileExport, FaClock, FaCalendarAlt, FaChartBar, FaFilter, FaSync, FaPrint, FaSearch, FaSpinner } from 'react-icons/fa';
import { MdTrendingUp, MdSchedule, MdAccessTime, MdPeople } from 'react-icons/md';
import { formatDate, formatTime } from '../../utils/dateUtils';
import axios from 'axios';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ArcElement, Filler, LineElement, PointElement } from 'chart.js';
import { AuthContext } from '../../context/AuthContext';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ArcElement, Filler, LineElement, PointElement);

const API_BASE_URL = import.meta.env.VITE_API_URL;

const ReportRow = memo(({ record, getStaffName, getStaffPosition }) => {
  const fmtTime = (time) => time ? formatTime(time) : '-';
  const formatMinutes = (minutes) => {
    if (!minutes || minutes <= 0) return '-';
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins === 0 ? `${hours}h` : `${hours}h ${mins}m`;
  };

  const getStatusBadge = (record) => {
    if (record.absent) return <span className="px-2 py-1 bg-gradient-to-r from-red-100 to-red-200 text-red-800 rounded-full text-xs font-semibold">Absent</span>;
    if (record.checkIn && record.checkOut) return <span className="px-2 py-1 bg-gradient-to-r from-green-100 to-green-200 text-green-800 rounded-full text-xs font-semibold">Complete</span>;
    if (record.checkIn) return <span className="px-2 py-1 bg-gradient-to-r from-yellow-100 to-yellow-200 text-yellow-800 rounded-full text-xs font-semibold">Partial</span>;
    return <span className="px-2 py-1 bg-gradient-to-r from-gray-100 to-gray-200 text-gray-800 rounded-full text-xs font-semibold">No Data</span>;
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr + 'T12:00:00.000Z');
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', weekday: 'short' });
  };

  const rowBg = record.absent ? 'bg-red-50' : record.late ? 'bg-amber-50' : record.earlyLeave ? 'bg-orange-50/60' : '';

  return (
    <tr className={`${rowBg} hover:brightness-95 transition-all duration-200 border-b border-gray-100`}>
      <td className="px-2 sm:px-3 py-3 text-xs sm:text-sm"><div className="font-medium text-gray-900">{formatDate(record.date)}</div></td>
      <td className="px-2 sm:px-4 py-3 text-xs sm:text-sm">
        <div className="flex items-center space-x-2">
          <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
            {getStaffName(record).charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <div className="font-medium text-gray-900 truncate text-xs sm:text-sm">{getStaffName(record)}</div>
            <div className="text-xs text-gray-500 truncate lg:hidden">{getStaffPosition(record)}</div>
          </div>
        </div>
      </td>
      <td className="hidden lg:table-cell px-3 py-3 text-xs">
        <span className="px-2 py-1 bg-gradient-to-r from-blue-100 to-blue-200 text-blue-800 rounded-full text-xs font-medium">{getStaffPosition(record)}</span>
      </td>
      <td className="px-2 sm:px-3 py-3 text-xs sm:text-sm">
        <div className="flex items-center gap-1"><span className="text-green-600 text-xs">▶</span><span className="font-mono text-gray-900">{fmtTime(record.checkIn)}</span></div>
      </td>
      <td className="px-2 sm:px-3 py-3 text-xs sm:text-sm">
        <div className="flex items-center gap-1"><span className="text-red-600 text-xs">◀</span><span className="font-mono text-gray-900">{fmtTime(record.checkOut)}</span></div>
      </td>
      <td className="px-2 sm:px-3 py-3 text-xs sm:text-sm text-center">
        {record.late ? <span className="text-amber-600 font-semibold">{formatMinutes(record.lateMinutes)}</span> : <span className="text-gray-400">-</span>}
      </td>
      <td className="px-2 sm:px-3 py-3 text-xs sm:text-sm text-center">
        {record.earlyLeave ? <span className="text-orange-600 font-semibold">{formatMinutes(record.earlyLeaveMinutes)}</span> : <span className="text-gray-400">-</span>}
      </td>
      <td className="px-2 sm:px-3 py-3 text-xs sm:text-sm text-center">{getStatusBadge(record)}</td>
    </tr>
  );
});

ReportRow.displayName = 'ReportRow';

const EnhancedReports = ({ staff, getStaffName, getStaffPosition, loading: parentLoading }) => {
  const { logout } = useContext(AuthContext);
  const navigate = useNavigate();

  const getAuthToken = () => {
    return localStorage.getItem('adminAuthToken') || localStorage.getItem('authToken');
  };

  const getAuthHeaders = () => ({ Authorization: `Bearer ${getAuthToken()}` });

  const [attendanceRecords, setAttendanceRecords] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [filterDate, setFilterDate] = useState(new Date().toISOString().split('T')[0]);
  const [reportPage, setReportPage] = useState(1);
  const [reportTotalPages, setReportTotalPages] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  
  // 7-day chart data states - loads in background
  const [sevenDayChartData, setSevenDayChartData] = useState(null);
  const [loadingSevenDayCharts, setLoadingSevenDayCharts] = useState(false);
  
  // Monthly export states
  const [showMonthlyModal, setShowMonthlyModal] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [generatingPDF, setGeneratingPDF] = useState(false);

  // FIXED: Get active staff IDs to filter records
  const activeStaffIds = useMemo(() => {
    if (!staff?.length) return new Set();
    return new Set(
      staff
        .filter(s => s.status === 'active')
        .map(s => s.employeeId)
    );
  }, [staff]);

  const fetchAttendanceData = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const params = { mode: 'day', page: reportPage, limit: 100 };
      params.startDate = filterDate;
      params.endDate = filterDate;

      const [summaryRes, analyticsRes] = await Promise.all([
        axios.get(`${API_BASE_URL}/api/attendance/report`, { headers: getAuthHeaders(), params }),
        axios.get(`${API_BASE_URL}/api/attendance/analytics`, {
          headers: getAuthHeaders(),
          params: { startDate: params.startDate, endDate: params.endDate, period: 'daily' }
        }).catch(() => ({ data: null }))
      ]);

      // FIXED: Filter out inactive/terminated staff from attendance records
      const activeRecords = (summaryRes.data.attendances || []).filter(record => 
        activeStaffIds.has(record.employeeId)
      );

      setAttendanceRecords(activeRecords);
      setReportTotalPages(summaryRes.data.totalPages || 1);
      setAnalytics(analyticsRes?.data || { today: { present: 0, absent: 0, late: 0 }, attendanceRate: 0, trends: { daily: [] }, departments: [] });
    } catch (err) {
      setError('Failed to fetch attendance data: ' + (err.response?.data?.message || err.message));
    } finally {
      setLoading(false);
    }
  }, [filterDate, reportPage, activeStaffIds]);

  // NEW: Fetch 7-day chart data in background (doesn't block page load)
  const fetchSevenDayChartData = useCallback(async () => {
    if (!staff || staff.length === 0) return;
    
    try {
      setLoadingSevenDayCharts(true);
      
      // Calculate date range for last 7 days
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 6); // Last 7 days including today
      
      const startDateStr = startDate.toISOString().split('T')[0];
      const endDateStr = endDate.toISOString().split('T')[0];
      
      // Fetch attendance data for 7-day period
      const response = await axios.get(`${API_BASE_URL}/api/attendance/analytics`, {
        headers: getAuthHeaders(),
        params: {
          startDate: startDateStr,
          endDate: endDateStr,
          period: 'daily'
        }
      });
      
      const analyticsData = response.data || {};
      
      // Filter the daily trends to only include active staff data
      // The backend analytics should already be filtered, but we'll ensure it
      setSevenDayChartData(analyticsData);
      
    } catch (err) {
      console.error('Failed to fetch 7-day chart data:', err);
      setSevenDayChartData(null);
    } finally {
      setLoadingSevenDayCharts(false);
    }
  }, [staff, activeStaffIds]);

  // Trigger 7-day chart data fetch in background after initial load
  useEffect(() => {
    if (staff.length > 0) {
      // Delay to ensure main content loads first
      const timer = setTimeout(() => {
        fetchSevenDayChartData();
      }, 800);
      
      return () => clearTimeout(timer);
    }
  }, [staff.length, fetchSevenDayChartData]);

  useEffect(() => {
    if (staff.length > 0) {
      const timeoutId = setTimeout(fetchAttendanceData, 300);
      return () => clearTimeout(timeoutId);
    }
  }, [staff.length, fetchAttendanceData]);

  const filteredRecords = useMemo(() => {
    if (!attendanceRecords || !searchTerm) return attendanceRecords || [];
    return attendanceRecords.filter(record => {
      const staffName = getStaffName(record).toLowerCase();
      const position = getStaffPosition(record).toLowerCase();
      return staffName.includes(searchTerm.toLowerCase()) || position.includes(searchTerm.toLowerCase());
    });
  }, [attendanceRecords, searchTerm, getStaffName, getStaffPosition]);

  const handlePrevious = useCallback(() => {
    const d = new Date(filterDate);
    d.setDate(d.getDate() - 1);
    setFilterDate(d.toISOString().split('T')[0]);
    setReportPage(1);
  }, [filterDate]);

  const handleNext = useCallback(() => {
    const d = new Date(filterDate);
    d.setDate(d.getDate() + 1);
    setFilterDate(d.toISOString().split('T')[0]);
    setReportPage(1);
  }, [filterDate]);

  const handleDateChange = useCallback((e) => {
    setFilterDate(e.target.value);
    setReportPage(1);
  }, []);

  // Generate Daily PDF
  const generateDailyPDF = useCallback(async () => {
    try {
      if (!filteredRecords || filteredRecords.length === 0) {
        setError('No attendance records to export');
        setTimeout(() => setError(''), 3000);
        return;
      }

      setGeneratingPDF(true);
      const doc = new jsPDF();
      
      // Try logo
      try {
        const logoImg = new Image();
        logoImg.crossOrigin = 'anonymous';
        await new Promise((resolve, reject) => {
          const timeout = setTimeout(reject, 2000);
          logoImg.onload = () => { clearTimeout(timeout); resolve(); };
          logoImg.onerror = () => { clearTimeout(timeout); reject(); };
          logoImg.src = 'https://thepumphouseng.com/thepumphouseng.com_logo.png';
        });
        doc.addImage(logoImg, 'PNG', 14, 10, 30, 30);
      } catch (err) {
        console.log('Logo not loaded');
      }
      
      // Header
      doc.setFillColor(59, 130, 246);
      doc.rect(0, 0, 210, 50, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(24);
      doc.setFont('helvetica', 'bold');
      doc.text('DAILY ATTENDANCE REPORT', 50, 22);
      doc.setFontSize(11);
      doc.setFont('helvetica', 'normal');
      doc.text(`Generated: ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'Africa/Lagos' })}`, 50, 32);
      doc.setTextColor(0, 0, 0);
      
      let currentY = 58;
      doc.setFillColor(243, 244, 246);
      doc.roundedRect(14, currentY, 182, 12, 2, 2, 'F');
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text(`Report Date: ${new Date(filterDate).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}`, 18, currentY + 8);
      
      currentY += 20;
      
      // Table
      const tableData = filteredRecords.map(record => [
        formatDate(record.date, 'short'), 
        getStaffName(record), 
        getStaffPosition(record),
        record.checkIn ? formatTime(record.checkIn) : '-',
        record.checkOut ? formatTime(record.checkOut) : '-',
        record.lateMinutes > 0 ? `${record.lateMinutes}m` : '-',
        record.earlyLeaveMinutes > 0 ? `${record.earlyLeaveMinutes}m` : '-',
        record.absent ? 'Yes' : 'No'
      ]);

      autoTable(doc, {
        head: [['Date', 'Staff', 'Position', 'Check In', 'Check Out', 'Late', 'Early', 'Absent']],
        body: tableData,
        startY: currentY,
        theme: 'striped',
        headStyles: { fillColor: [59, 130, 246], textColor: 255, fontStyle: 'bold', fontSize: 9, halign: 'center' },
        styles: { fontSize: 9, cellPadding: 2, overflow: 'linebreak', halign: 'center' },
        columnStyles: {
          0: { cellWidth: 24, halign: 'left' },
          1: { cellWidth: 35, halign: 'left' },
          2: { cellWidth: 32, halign: 'left' },
          3: { cellWidth: 20 },
          4: { cellWidth: 20 },
          5: { cellWidth: 15 },
          6: { cellWidth: 15 },
          7: { cellWidth: 18 }
        },
        margin: { left: 14, right: 14 },
        didDrawPage: function() {
          doc.setFontSize(8);
          doc.setTextColor(128);
          doc.text(`Page ${doc.internal.getNumberOfPages()}`, doc.internal.pageSize.width / 2, doc.internal.pageSize.height - 10, { align: 'center' });
        }
      });
      currentY = doc.lastAutoTable.finalY + 12;
      
      // Summary
      if (currentY > 220) { doc.addPage(); currentY = 20; }
      
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      doc.setTextColor(31, 41, 55);
      doc.text('SUMMARY STATISTICS', 14, currentY);
      currentY += 8;
      
      const summaryData = [
        { label: 'Total', value: filteredRecords.length, color: [59, 130, 246] },
        { label: 'Present', value: filteredRecords.filter(r => !r.absent).length, color: [34, 197, 94] },
        { label: 'Absent', value: filteredRecords.filter(r => r.absent).length, color: [239, 68, 68] },
        { label: 'Late', value: filteredRecords.filter(r => r.late).length, color: [245, 158, 11] },
        { label: 'Early Leave', value: filteredRecords.filter(r => r.earlyLeave).length, color: [249, 115, 22] },
        { label: 'Complete', value: filteredRecords.filter(r => r.checkIn && r.checkOut).length, color: [168, 85, 247] }
      ];
      
      const boxWidth = 30;
      const boxHeight = 14;
      const spacing = 2;
      let xPos = 14;
      
      summaryData.forEach((item, idx) => {
        if (idx > 0 && idx % 6 === 0) {
          xPos = 14;
          currentY += boxHeight + spacing;
        }
        
        doc.setFillColor(item.color[0], item.color[1], item.color[2]);
        doc.rect(xPos, currentY, boxWidth, boxHeight, 'F');
        
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(11);
        doc.setTextColor(255, 255, 255);
        doc.text(item.value.toString(), xPos + boxWidth / 2, currentY + 7, { align: 'center' });
        
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7);
        doc.text(item.label, xPos + boxWidth / 2, currentY + 11, { align: 'center' });
        
        xPos += boxWidth + spacing;
      });
      
      // Footer
      const footerY = doc.internal.pageSize.height - 20;
      doc.setDrawColor(229, 231, 235);
      doc.setLineWidth(0.5);
      doc.line(14, footerY, 196, footerY);
      doc.setFontSize(8);
      doc.setTextColor(107, 114, 128);
      doc.text('End of Report', doc.internal.pageSize.width / 2, footerY + 6, { align: 'center' });

      doc.save(`attendance_daily_${filterDate}.pdf`);
      setSuccess('Daily PDF exported successfully!');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      console.error('Failed to generate PDF:', err);
      setError('Failed to generate PDF report: ' + err.message);
      setTimeout(() => setError(''), 3000);
    } finally {
      setGeneratingPDF(false);
    }
  }, [filteredRecords, getStaffName, getStaffPosition, filterDate]);

// Generate Monthly PDF (Landscape, grouped by date) - WITH VIRTUAL ABSENCES
const generateMonthlyPDF = useCallback(async () => {
  try {
    setGeneratingPDF(true);
    setShowMonthlyModal(false);
    
    // Build date strings directly (no timezone issues)
    const startDateStr = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-01`;
    const lastDay = new Date(selectedYear, selectedMonth + 1, 0).getDate();
    const endDateStr = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
    
    console.log(`Fetching data from ${startDateStr} to ${endDateStr}`);
    
    // Fetch existing attendance records from backend
    const response = await axios.get(`${API_BASE_URL}/api/attendance/report`, {
      headers: getAuthHeaders(),
      params: {
        mode: 'custom',
        startDate: startDateStr,
        endDate: endDateStr,
        limit: 1000
      }
    });

    const existingRecords = response.data.attendances || [];
    console.log(`Received ${existingRecords.length} existing attendance records`);
    
    // Get active staff
    const activeStaff = staff.filter(s => s.status === 'active');
    console.log(`Active staff count: ${activeStaff.length}`);
    
    // Fetch shifts for all active staff
    const shifts = {};
    for (const staffMember of activeStaff) {
      try {
        const staffShifts = await axios.get(`${API_BASE_URL}/api/attendance/shifts`, {
          headers: getAuthHeaders(),
          params: { staffId: staffMember._id }
        });
        shifts[staffMember.employeeId] = staffShifts.data.shifts || [];
      } catch (err) {
        console.log(`Could not fetch shifts for ${staffMember.employeeId}`);
        shifts[staffMember.employeeId] = [];
      }
    }
    
    // Generate all working dates (Mon-Sat only) for the month
    const allDates = [];
    let currentDay = 1;
    
    while (currentDay <= lastDay) {
      const dateStr = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-${String(currentDay).padStart(2, '0')}`;
      
      // Check day of week in UTC
      const dateObj = new Date(dateStr + 'T12:00:00.000Z');
      const dayOfWeek = dateObj.toLocaleDateString('en-US', { weekday: 'long', timeZone: 'UTC' });
      
      // Only include Mon-Sat (skip Sundays)
      if (dayOfWeek !== 'Sunday') {
        allDates.push({
          date: dateStr,
          dayOfWeek: dayOfWeek
        });
      }
      
      currentDay++;
    }
    
    console.log(`Generated ${allDates.length} working days for the month`);
    
    // Build complete records (existing + virtual absences)
    const recordsByDate = {};
    
    for (const dateInfo of allDates) {
      const { date, dayOfWeek } = dateInfo;
      recordsByDate[date] = [];
      
      // Get existing records for this date
      const dayExistingRecords = existingRecords.filter(r => r.date === date);
      const clockedInEmployeeIds = new Set(dayExistingRecords.map(r => r.employeeId));
      
      // Add existing records
      recordsByDate[date].push(...dayExistingRecords);
      
      // Create virtual absences for staff who should have worked but didn't clock in
      for (const staffMember of activeStaff) {
        if (clockedInEmployeeIds.has(staffMember.employeeId)) continue;
        
        // FIXED: Handle dateOfEmployment as Date object (not string)
        if (staffMember.dateOfEmployment) {
          const employmentDate = new Date(staffMember.dateOfEmployment);
          const workDate = new Date(date + 'T12:00:00.000Z');
          
          if (workDate < employmentDate) {
            continue; // Skip - not yet employed on this date
          }
        }
        
        // FIXED: Handle employmentEndDate/dateOfTermination as Date object
        if (staffMember.employmentEndDate || staffMember.dateOfTermination) {
          const terminationDate = new Date(staffMember.employmentEndDate || staffMember.dateOfTermination);
          const workDate = new Date(date + 'T12:00:00.000Z');
          
          if (workDate >= terminationDate) {
            continue; // Skip - already terminated on this date
          }
        }
        
        // Check if this staff has a shift for this day
        const staffShifts = shifts[staffMember.employeeId] || [];
        const hasShift = staffShifts.length > 0 && staffShifts.some(shift => shift.dayOfWeek === dayOfWeek);
        
        if (hasShift) {
          // Create virtual absence record
          recordsByDate[date].push({
            employeeId: staffMember.employeeId,
            date: date,
            checkIn: null,
            checkOut: null,
            late: false,
            lateMinutes: 0,
            earlyLeave: false,
            earlyLeaveMinutes: 0,
            absent: true,
            isVirtual: true,
            staffName: `${staffMember.firstName} ${staffMember.lastName || ''}`.trim(),
            position: staffMember.position || 'N/A',
            department: staffMember.department || 'N/A'
          });
        }
      }
      
      // Sort by staff name
      recordsByDate[date].sort((a, b) => {
        const nameA = getStaffName(a);
        const nameB = getStaffName(b);
        return nameA.localeCompare(nameB);
      });
    }
    
    // Only include dates that have records
    const sortedDates = Object.keys(recordsByDate)
      .filter(date => recordsByDate[date].length > 0)
      .sort();
    
    if (sortedDates.length === 0) {
      setError('No attendance records found for selected month');
      setTimeout(() => setError(''), 3000);
      setGeneratingPDF(false);
      return;
    }
    
    console.log(`Processing ${sortedDates.length} dates with attendance data`);

    // Create PDF in LANDSCAPE
    const doc = new jsPDF('landscape');
    
    // Try logo
    try {
      const logoImg = new Image();
      logoImg.crossOrigin = 'anonymous';
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(reject, 2000);
        logoImg.onload = () => { clearTimeout(timeout); resolve(); };
        logoImg.onerror = () => { clearTimeout(timeout); reject(); };
        logoImg.src = 'https://thepumphouseng.com/thepumphouseng.com_logo.png';
      });
      doc.addImage(logoImg, 'PNG', 14, 10, 25, 25);
    } catch (err) {
      console.log('Logo not loaded');
    }
    
    // Header
    doc.setFillColor(59, 130, 246);
    doc.rect(0, 0, 297, 45, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(22);
    doc.setFont('helvetica', 'bold');
    doc.text('MONTHLY ATTENDANCE REPORT', 45, 20);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    const monthName = new Date(selectedYear, selectedMonth).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    doc.text(`Month: ${monthName}`, 45, 30);
    doc.text(`Generated: ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`, 45, 37);
    doc.setTextColor(0, 0, 0);
    
    let currentY = 52;
    
    // Calculate summary statistics
    let totalPresent = 0;
    let totalAbsent = 0;
    let totalLate = 0;
    let totalEarlyLeave = 0;
    let totalRecords = 0;
    
    // Process each date with ENHANCED COLORS
    sortedDates.forEach((dateKey) => {
      const dayRecords = recordsByDate[dateKey];
      totalRecords += dayRecords.length;
      
      // Update summary stats
      totalPresent += dayRecords.filter(r => !r.absent).length;
      totalAbsent += dayRecords.filter(r => r.absent).length;
      totalLate += dayRecords.filter(r => r.late).length;
      totalEarlyLeave += dayRecords.filter(r => r.earlyLeave).length;
      
      // Check if we need a new page
      if (currentY > 170) {
        doc.addPage('landscape');
        currentY = 20;
      }
      
      // Date header colors
      const headerColors = {
        Monday: [59, 130, 246],
        Tuesday: [16, 185, 129],
        Wednesday: [245, 158, 11],
        Thursday: [139, 92, 246],
        Friday: [236, 72, 153],
        Saturday: [249, 115, 22]
      };
      
      const dateObj = new Date(dateKey + 'T12:00:00.000Z');
      const dayOfWeek = dateObj.toLocaleDateString('en-US', { weekday: 'long', timeZone: 'UTC' });
      const headerColor = headerColors[dayOfWeek] || [59, 130, 246];
      
      // Header background (full color)
      doc.setFillColor(...headerColor);
      doc.roundedRect(14, currentY, 269, 8, 2, 2, 'F');
      
      // White text on colored background
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(255, 255, 255);
      const dateStr = dateObj.toLocaleDateString('en-US', { 
        weekday: 'long', 
        month: 'long', 
        day: 'numeric', 
        year: 'numeric',
        timeZone: 'UTC'
      });
      doc.text(dateStr, 18, currentY + 6);
      doc.setTextColor(0, 0, 0);
      currentY += 10;
      
      // Table with STATUS COLORS
      const tableData = dayRecords.map(record => {
        const status = record.absent ? 'Absent' : 
                      record.late ? 'Late' : 
                      record.earlyLeave ? 'Early Leave' : 'Present';
        
        return [
          getStaffName(record),
          getStaffPosition(record),
          record.checkIn ? formatTime(record.checkIn) : '-',
          record.checkOut ? formatTime(record.checkOut) : '-',
          record.lateMinutes > 0 ? `${record.lateMinutes}m` : '-',
          record.earlyLeaveMinutes > 0 ? `${record.earlyLeaveMinutes}m` : '-',
          status
        ];
      });

      autoTable(doc, {
        head: [['Staff Name', 'Position', 'Check In', 'Check Out', 'Late', 'Early', 'Status']],
        body: tableData,
        startY: currentY,
        theme: 'striped',
        headStyles: { 
          fillColor: [59, 130, 246], 
          textColor: 255, 
          fontStyle: 'bold', 
          fontSize: 8,
          halign: 'center' 
        },
        styles: { 
          fontSize: 8,
          cellPadding: 1.5,
          overflow: 'linebreak', 
          halign: 'center' 
        },
        columnStyles: {
          0: { cellWidth: 65, halign: 'left' },
          1: { cellWidth: 55, halign: 'left' },
          2: { cellWidth: 35 },
          3: { cellWidth: 35 },
          4: { cellWidth: 22 },
          5: { cellWidth: 22 },
          6: { cellWidth: 31 }
        },
        didParseCell: function(data) {
          if (data.section === 'body' && data.column.index === 6) {
            const status = data.cell.raw;
            if (status === 'Absent') {
              data.cell.styles.fillColor = [254, 202, 202];
              data.cell.styles.textColor = [153, 27, 27];
              data.cell.styles.fontStyle = 'bold';
            } else if (status === 'Late') {
              data.cell.styles.fillColor = [254, 243, 199];
              data.cell.styles.textColor = [180, 83, 9];
              data.cell.styles.fontStyle = 'bold';
            } else if (status === 'Early Leave') {
              data.cell.styles.fillColor = [255, 237, 213];
              data.cell.styles.textColor = [194, 65, 12];
              data.cell.styles.fontStyle = 'bold';
            } else if (status === 'Present') {
              data.cell.styles.fillColor = [220, 252, 231];
              data.cell.styles.textColor = [21, 128, 61];
              data.cell.styles.fontStyle = 'bold';
            }
          }
        },
        margin: { left: 14, right: 14 },
        didDrawPage: function() {
          doc.setFontSize(8);
          doc.setTextColor(128);
          doc.text(`Page ${doc.internal.getNumberOfPages()}`, doc.internal.pageSize.width / 2, doc.internal.pageSize.height - 10, { align: 'center' });
        }
      });
      
      currentY = doc.lastAutoTable.finalY + 6;
    });
    
   // SUMMARY CARDS SECTION
const summaryHeight = 50; // Title + cards + spacing
if (currentY + summaryHeight > doc.internal.pageSize.height - 30) {
  doc.addPage('landscape');
  currentY = 20;
}

currentY += 10;
    
    // Summary title
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(31, 41, 55);
    doc.text('MONTHLY SUMMARY', 14, currentY);
    currentY += 10;
    
    // Summary cards data
    const summaryData = [
      { label: 'Total Records', value: totalRecords, color: [59, 130, 246] },
      { label: 'Total Present', value: totalPresent, color: [34, 197, 94] },
      { label: 'Total Absent', value: totalAbsent, color: [239, 68, 68] },
      { label: 'Total Late', value: totalLate, color: [245, 158, 11] },
      { label: 'Total Early Leave', value: totalEarlyLeave, color: [249, 115, 22] },
      { label: 'Attendance Rate', value: `${totalRecords > 0 ? Math.round((totalPresent / totalRecords) * 100) : 0}%`, color: [168, 85, 247] }
    ];
    
    const cardWidth = 42;
    const cardHeight = 20;
    const cardSpacing = 3;
    let xPos = 14;
    let yPos = currentY;
    
    summaryData.forEach((item, idx) => {
      if (idx > 0 && idx % 6 === 0) {
        xPos = 14;
        yPos += cardHeight + cardSpacing;
      }
      
      // Card background (full color)
      doc.setFillColor(...item.color);
      doc.roundedRect(xPos, yPos, cardWidth, cardHeight, 3, 3, 'F');
      
      // Card border
      doc.setDrawColor(item.color[0] - 30, item.color[1] - 30, item.color[2] - 30);
      doc.setLineWidth(1);
      doc.roundedRect(xPos, yPos, cardWidth, cardHeight, 3, 3, 'S');
      
      // White text on colored background
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(14);
      doc.setTextColor(255, 255, 255);
      doc.text(String(item.value), xPos + cardWidth / 2, yPos + 10, { align: 'center' });
      
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(255, 255, 255);
      doc.text(item.label, xPos + cardWidth / 2, yPos + 16, { align: 'center' });
      
      xPos += cardWidth + cardSpacing;
    });
    
    // Reset text color
    doc.setTextColor(0, 0, 0);
    
    // Footer
    const footerY = doc.internal.pageSize.height - 20;
    doc.setDrawColor(229, 231, 235);
    doc.setLineWidth(0.5);
    doc.line(14, footerY, 283, footerY);
    doc.setFontSize(8);
    doc.setTextColor(107, 114, 128);
    doc.text('End of Report', doc.internal.pageSize.width / 2, footerY + 6, { align: 'center' });

    const filename = `attendance_monthly_${monthName.replace(' ', '_')}.pdf`;
    doc.save(filename);
    setSuccess('Monthly PDF exported successfully!');
    setTimeout(() => setSuccess(''), 3000);
  } catch (err) {
    console.error('Failed to generate monthly PDF:', err);
    setError('Failed to generate monthly PDF: ' + (err.response?.data?.message || err.message));
    setTimeout(() => setError(''), 3000);
  } finally {
    setGeneratingPDF(false);
  }
}, [selectedMonth, selectedYear, getStaffName, getStaffPosition, staff]);


  const chartOptions = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: 'bottom', labels: { padding: 15, usePointStyle: true, font: { size: 11, weight: '600' } } },
      tooltip: { backgroundColor: 'rgba(0, 0, 0, 0.8)', titleColor: 'white', bodyColor: 'white', borderColor: 'rgba(255, 255, 255, 0.2)', borderWidth: 1, padding: 12, titleFont: { size: 13, weight: 'bold' }, bodyFont: { size: 12 } }
    },
    elements: { arc: { borderRadius: 8 } }
  }), []);

  const attendanceOverviewData = useMemo(() => {
    // Use 7-day chart data if available, otherwise fallback to empty
    if (!sevenDayChartData?.trends?.daily) return { labels: [], datasets: [] };
    
    const dailyData = sevenDayChartData.trends.daily.slice(-7); // Last 7 days
    return {
      labels: dailyData.map(d => new Date(d.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })),
      datasets: [
        { label: 'Present', data: dailyData.map(d => d.present), backgroundColor: 'rgba(34, 197, 94, 0.8)', borderColor: 'rgba(34, 197, 94, 1)', borderWidth: 2, borderRadius: 6, borderSkipped: false },
        { label: 'Absent', data: dailyData.map(d => d.absent), backgroundColor: 'rgba(239, 68, 68, 0.8)', borderColor: 'rgba(239, 68, 68, 1)', borderWidth: 2, borderRadius: 6, borderSkipped: false },
        { label: 'Late', data: dailyData.map(d => d.late), backgroundColor: 'rgba(245, 158, 11, 0.8)', borderColor: 'rgba(245, 158, 11, 1)', borderWidth: 2, borderRadius: 6, borderSkipped: false }
      ]
    };
  }, [sevenDayChartData]);

  const departmentData = useMemo(() => {
    if (!analytics?.departments) return { labels: [], datasets: [] };
    return {
      labels: analytics.departments.map(d => d.department),
      datasets: [{
        data: analytics.departments.map(d => d.present),
        backgroundColor: ['rgba(59, 130, 246, 0.8)', 'rgba(16, 185, 129, 0.8)', 'rgba(245, 158, 11, 0.8)', 'rgba(139, 92, 246, 0.8)', 'rgba(236, 72, 153, 0.8)'],
        borderColor: ['rgba(59, 130, 246, 1)', 'rgba(16, 185, 129, 1)', 'rgba(245, 158, 11, 1)', 'rgba(139, 92, 246, 1)', 'rgba(236, 72, 153, 1)'],
        borderWidth: 3
      }]
    };
  }, [analytics]);

  const punctualityData = useMemo(() => {
    if (!analytics?.today) return { labels: [], datasets: [] };
    const onTime = analytics.today.present - analytics.today.late;
    return {
      labels: ['On Time', 'Late'],
      datasets: [{
        data: [onTime, analytics.today.late],
        backgroundColor: ['rgba(34, 197, 94, 0.8)', 'rgba(245, 158, 11, 0.8)'],
        borderColor: ['rgba(34, 197, 94, 1)', 'rgba(245, 158, 11, 1)'],
        borderWidth: 3
      }]
    };
  }, [analytics]);

  return (
    <div className="w-full space-y-6">
      {/* PDF Generation Overlay */}
      {generatingPDF && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-8 flex flex-col items-center gap-4 shadow-2xl">
            <FaSpinner className="text-5xl text-blue-600 animate-spin" />
            <p className="text-lg font-semibold text-gray-900">Generating PDF Report...</p>
            <p className="text-sm text-gray-600">Please wait while we process your data</p>
          </div>
        </div>
      )}

      {/* Monthly Export Modal */}
      {showMonthlyModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-40">
          <div className="bg-white rounded-2xl p-8 max-w-md w-full mx-4 shadow-2xl">
            <h3 className="text-2xl font-bold text-gray-900 mb-6">Export Monthly Report</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Select Month</label>
                <select 
                  value={selectedMonth} 
                  onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
                  className="w-full px-4 py-2 border border-gray-300 rounded-xl bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value={0}>January</option>
                  <option value={1}>February</option>
                  <option value={2}>March</option>
                  <option value={3}>April</option>
                  <option value={4}>May</option>
                  <option value={5}>June</option>
                  <option value={6}>July</option>
                  <option value={7}>August</option>
                  <option value={8}>September</option>
                  <option value={9}>October</option>
                  <option value={10}>November</option>
                  <option value={11}>December</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Select Year</label>
                <select 
                  value={selectedYear} 
                  onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                  className="w-full px-4 py-2 border border-gray-300 rounded-xl bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i).map(year => (
                    <option key={year} value={year}>{year}</option>
                  ))}
                </select>
              </div>
            </div>
            
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowMonthlyModal(false)}
                className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-xl hover:bg-gray-300 transition-all duration-200 font-medium"
              >
                Cancel
              </button>
              <button
                onClick={generateMonthlyPDF}
                className="flex-1 px-4 py-2 bg-gradient-to-r from-green-600 to-green-700 text-white rounded-xl hover:from-green-700 hover:to-green-800 transition-all duration-300 font-medium flex items-center justify-center gap-2"
              >
                <FaFileExport />
                Generate Report
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-center mb-4 sm:mb-6 lg:mb-8">
        <div>
          <h2 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900">Advanced Reports</h2>
          <p className="text-gray-600 text-xs sm:text-sm lg:text-base">Comprehensive attendance analytics and insights</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <button onClick={fetchAttendanceData} className="px-3 sm:px-4 py-2 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg sm:rounded-xl hover:from-blue-700 hover:to-blue-800 transition-all duration-300 flex items-center gap-1 sm:gap-2 shadow-lg text-xs sm:text-sm" disabled={loading}>
            <FaSync className={loading ? 'animate-spin' : ''} />
            <span className="hidden xs:inline">Refresh</span>
          </button>

          {/* Export Dropdown */}
          <div className="relative group">
            <button className="px-3 sm:px-4 py-2 bg-gradient-to-r from-green-600 to-green-700 text-white rounded-lg sm:rounded-xl hover:from-green-700 hover:to-green-800 transition-all duration-300 flex items-center gap-1 sm:gap-2 shadow-lg text-xs sm:text-sm">
              <FaFileExport />
              <span className="hidden sm:inline">Export</span> PDF
              <span className="text-xs">▼</span>
            </button>
            <div className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-xl border border-gray-200 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-10">
              <button
                onClick={generateDailyPDF}
                disabled={loading || filteredRecords.length === 0}
                className="w-full text-left px-4 py-3 hover:bg-gray-50 rounded-t-xl flex items-center gap-2 text-sm font-medium text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <FaCalendarAlt className="text-blue-500" />
                Export Daily
              </button>
              <button
                onClick={() => setShowMonthlyModal(true)}
                className="w-full text-left px-4 py-3 hover:bg-gray-50 rounded-b-xl flex items-center gap-2 text-sm font-medium text-gray-700 border-t border-gray-100"
              >
                <FaChartBar className="text-green-500" />
                Export Monthly
              </button>
            </div>
          </div>
          
          <button onClick={() => window.print()} className="px-4 py-2 bg-gradient-to-r from-purple-600 to-purple-700 text-white rounded-xl hover:from-purple-700 hover:to-purple-800 transition-all duration-300 flex items-center gap-2 shadow-lg text-sm">
            <FaPrint />
            Print
          </button>
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

      {analytics && (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
          <div className="bg-gradient-to-br from-blue-500 to-blue-600 text-white p-6 rounded-2xl shadow-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-blue-100 font-medium text-sm">Total Present</p>
                <p className="text-3xl font-bold mt-1">{analytics.today?.present || 0}</p>
              </div>
              <MdPeople className="text-5xl text-blue-200 opacity-50" />
            </div>
          </div>
          <div className="bg-gradient-to-br from-green-500 to-green-600 text-white p-6 rounded-2xl shadow-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-green-100 font-medium text-sm">On Time</p>
                <p className="text-3xl font-bold mt-1">{(analytics.today?.present || 0) - (analytics.today?.late || 0)}</p>
              </div>
              <MdAccessTime className="text-5xl text-green-200 opacity-50" />
            </div>
          </div>
          <div className="bg-gradient-to-br from-yellow-500 to-yellow-600 text-white p-6 rounded-2xl shadow-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-yellow-100 font-medium text-sm">Late Today</p>
                <p className="text-3xl font-bold mt-1">{analytics.today?.late || 0}</p>
              </div>
              <MdSchedule className="text-5xl text-yellow-200 opacity-50" />
            </div>
          </div>
          <div className="bg-gradient-to-br from-purple-500 to-purple-600 text-white p-6 rounded-2xl shadow-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-purple-100 font-medium text-sm">Attendance Rate</p>
                <p className="text-3xl font-bold mt-1">{analytics.attendanceRate ? `${analytics.attendanceRate}%` : '0%'}</p>
              </div>
              <MdTrendingUp className="text-5xl text-purple-200 opacity-50" />
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6 mb-8">
        <div className="bg-white p-6 rounded-2xl shadow-lg border border-gray-200 xl:col-span-2">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <FaChartBar className="text-blue-500" />
            7-Day Attendance Overview
          </h3>
          <div className="h-64">
            {loadingSevenDayCharts ? (
              <div className="flex flex-col items-center justify-center h-full">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                <p className="text-sm text-gray-600 mt-4 font-medium">Loading 7-day data...</p>
              </div>
            ) : attendanceOverviewData.labels.length > 0 ? (
              <Bar data={attendanceOverviewData} options={chartOptions} />
            ) : (
              <div className="flex items-center justify-center h-full text-gray-500">
                <p className="text-sm">No 7-day data available</p>
              </div>
            )}
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-lg border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <FaClock className="text-green-500" />
            Today's Punctuality
          </h3>
          <div className="h-64">
            <Doughnut data={punctualityData} options={chartOptions} />
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-lg border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <MdPeople className="text-purple-500" />
            Department Attendance
          </h3>
          <div className="h-64">
            <Pie data={departmentData} options={chartOptions} />
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-lg border border-gray-200 xl:col-span-2">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <MdTrendingUp className="text-indigo-500" />
            Attendance Trends
          </h3>
          <div className="h-64">
            {loadingSevenDayCharts ? (
              <div className="flex flex-col items-center justify-center h-full">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
                <p className="text-sm text-gray-600 mt-4 font-medium">Loading trend data...</p>
              </div>
            ) : attendanceOverviewData.labels.length > 0 ? (
              <Line 
                data={{
                  labels: attendanceOverviewData.labels,
                  datasets: [{
                    label: 'Present',
                    data: attendanceOverviewData.datasets[0]?.data || [],
                    borderColor: 'rgba(34, 197, 94, 1)',
                    backgroundColor: 'rgba(34, 197, 94, 0.1)',
                    tension: 0.4,
                    fill: true,
                    pointBackgroundColor: 'rgba(34, 197, 94, 1)',
                    pointBorderColor: 'white',
                    pointBorderWidth: 2,
                    pointRadius: 6
                  }]
                }}
                options={{
                  ...chartOptions,
                  scales: {
                    y: { beginAtZero: true, grid: { color: 'rgba(0, 0, 0, 0.1)' } },
                    x: { grid: { color: 'rgba(0, 0, 0, 0.1)' } }
                  }
                }}
              />
            ) : (
              <div className="flex items-center justify-center h-full text-gray-500">
                <p className="text-sm">No trend data available</p>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="bg-gradient-to-br from-white to-gray-50 rounded-2xl shadow-lg overflow-hidden border border-gray-200">
        <div className="p-6 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-indigo-50">
          <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4">
            <h3 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
              <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-lg flex items-center justify-center">
                <FaFilter className="text-white text-sm" />
              </div>
              Daily Attendance Report
            </h3>
            
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 w-full xl:w-auto">
              <div className="relative">
                <FaSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 text-sm" />
                <input type="text" placeholder="Search staff..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10 pr-4 py-2 border border-gray-300 rounded-xl bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 text-sm w-full sm:w-48" />
              </div>
              
              <div className="flex items-center gap-2">
                <button onClick={handlePrevious} className="px-3 py-2 bg-gradient-to-r from-gray-100 to-gray-200 text-gray-700 rounded-xl hover:from-gray-200 hover:to-gray-300 transition-all duration-200 font-medium text-sm">← Prev</button>
                <input type="date" value={filterDate} onChange={handleDateChange} className="px-3 py-2 border border-gray-300 rounded-xl bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 font-medium text-sm" />
                <button onClick={handleNext} className="px-3 py-2 bg-gradient-to-r from-gray-100 to-gray-200 text-gray-700 rounded-xl hover:from-gray-200 hover:to-gray-300 transition-all duration-200 font-medium text-sm">Next →</button>
              </div>
            </div>
          </div>
          
          <div className="mt-4 flex flex-wrap items-center gap-4 text-sm">
            <div className="flex items-center gap-2 bg-gradient-to-r from-blue-50 to-indigo-50 px-3 py-2 rounded-lg border border-blue-200">
              <FaCalendarAlt className="text-blue-500" />
              <span className="font-medium text-blue-800">
                {new Date(filterDate).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
              </span>
            </div>
            
            <div className="flex items-center gap-2 bg-gradient-to-r from-green-50 to-green-100 px-3 py-2 rounded-lg border border-green-200">
              <span className="font-medium text-green-800">{filteredRecords.length} Records</span>
            </div>
            
            {searchTerm && (
              <div className="flex items-center gap-2 bg-gradient-to-r from-yellow-50 to-yellow-100 px-3 py-2 rounded-lg border border-yellow-200">
                <FaSearch className="text-yellow-600" />
                <span className="font-medium text-yellow-800">Filtered: "{searchTerm}"</span>
              </div>
            )}
          </div>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gradient-to-r from-indigo-50 via-purple-50 to-pink-50">
              <tr>
                <th className="px-2 sm:px-3 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider min-w-[80px]">Date</th>
                <th className="px-2 sm:px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider min-w-[140px]">Staff Name</th>
                <th className="hidden lg:table-cell px-3 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider min-w-[100px]">Position</th>
                <th className="px-2 sm:px-3 py-3 text-center text-xs font-bold text-gray-700 uppercase tracking-wider min-w-[80px]">Check In</th>
                <th className="px-2 sm:px-3 py-3 text-center text-xs font-bold text-gray-700 uppercase tracking-wider min-w-[80px]">Check Out</th>
                <th className="px-2 sm:px-3 py-3 text-center text-xs font-bold text-gray-700 uppercase tracking-wider min-w-[60px]">Late</th>
                <th className="px-2 sm:px-3 py-3 text-center text-xs font-bold text-gray-700 uppercase tracking-wider min-w-[80px]">Early Leave</th>
                <th className="px-2 sm:px-3 py-3 text-center text-xs font-bold text-gray-700 uppercase tracking-wider min-w-[80px]">Status</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan="8" className="px-6 py-12 text-center text-gray-500">
                    <div className="flex flex-col items-center gap-4">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                      <p className="text-sm font-medium">Loading report data...</p>
                    </div>
                  </td>
                </tr>
              ) : filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan="8" className="px-6 py-12 text-center text-gray-500">
                    <div className="flex flex-col items-center gap-4">
                      <div className="w-12 h-12 bg-gradient-to-br from-gray-100 to-gray-200 rounded-full flex items-center justify-center">
                        <FaCalendarAlt className="text-gray-400 text-xl" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-700">No records found</p>
                        <p className="text-xs text-gray-500 mt-1">{searchTerm ? `No results for "${searchTerm}"` : `No attendance data for this date`}</p>
                      </div>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredRecords.map((record) => (
                  <ReportRow key={`${record.employeeId}-${record.date}`} record={record} getStaffName={getStaffName} getStaffPosition={getStaffPosition} />
                ))
              )}
            </tbody>
          </table>
        </div>
        
        {reportTotalPages > 1 && (
          <div className="p-4 sm:p-6 border-t border-gray-200 bg-gradient-to-r from-gray-50 to-gray-100">
            <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
              <div className="text-xs sm:text-sm text-gray-600 font-medium">Page {reportPage} of {reportTotalPages} • {filteredRecords.length} records</div>
              <div className="flex items-center gap-2">
                <button disabled={reportPage === 1} onClick={() => setReportPage(reportPage - 1)} className="px-3 py-2 bg-gradient-to-r from-gray-200 to-gray-300 text-gray-700 rounded-lg hover:from-gray-300 hover:to-gray-400 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 font-medium text-sm">← Prev</button>
                <div className="flex items-center gap-1">
                  {Array.from({ length: Math.min(5, reportTotalPages) }, (_, i) => {
                    const pageNum = Math.max(1, Math.min(reportTotalPages - 4, reportPage - 2)) + i;
                    if (pageNum > reportTotalPages) return null;
                    return (
                      <button key={pageNum} onClick={() => setReportPage(pageNum)} className={`w-8 h-8 rounded-lg font-medium transition-all duration-200 text-sm ${pageNum === reportPage ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-lg' : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-300'}`}>{pageNum}</button>
                    );
                  })}
                </div>
                <button disabled={reportPage === reportTotalPages} onClick={() => setReportPage(reportPage + 1)} className="px-3 py-2 bg-gradient-to-r from-gray-200 to-gray-300 text-gray-700 rounded-lg hover:from-gray-300 hover:to-gray-400 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 font-medium text-sm">Next →</button>
              </div>
            </div>
          </div>
        )}
      </div>

      {filteredRecords.length > 0 && (
        <div className="bg-white rounded-2xl shadow-lg p-6 border border-gray-200">
          <h3 className="text-xl font-semibold text-gray-900 mb-6 flex items-center gap-2">
            <FaChartBar className="text-purple-500" />
            Report Summary
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-4 rounded-xl border border-blue-200">
              <div className="text-2xl font-bold text-blue-600">{filteredRecords.length}</div>
              <div className="text-sm text-blue-700 font-medium mt-1">Total Records</div>
            </div>
            <div className="bg-gradient-to-br from-green-50 to-green-100 p-4 rounded-xl border border-green-200">
              <div className="text-2xl font-bold text-green-600">{filteredRecords.filter(r => !r.absent).length}</div>
              <div className="text-sm text-green-700 font-medium mt-1">Present</div>
            </div>
            <div className="bg-gradient-to-br from-red-50 to-red-100 p-4 rounded-xl border border-red-200">
              <div className="text-2xl font-bold text-red-600">{filteredRecords.filter(r => r.absent).length}</div>
              <div className="text-sm text-red-700 font-medium mt-1">Absent</div>
            </div>
            <div className="bg-gradient-to-br from-yellow-50 to-yellow-100 p-4 rounded-xl border border-yellow-200">
              <div className="text-2xl font-bold text-yellow-600">{filteredRecords.filter(r => r.late).length}</div>
              <div className="text-sm text-yellow-700 font-medium mt-1">Late Arrivals</div>
            </div>
            <div className="bg-gradient-to-br from-orange-50 to-orange-100 p-4 rounded-xl border border-orange-200">
              <div className="text-2xl font-bold text-orange-600">{filteredRecords.filter(r => r.earlyLeave).length}</div>
              <div className="text-sm text-orange-700 font-medium mt-1">Early Leaves</div>
            </div>
            <div className="bg-gradient-to-br from-purple-50 to-purple-100 p-4 rounded-xl border border-purple-200">
              <div className="text-2xl font-bold text-purple-600">{filteredRecords.filter(r => r.checkIn && r.checkOut).length}</div>
              <div className="text-sm text-purple-700 font-medium mt-1">Complete Days</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EnhancedReports;