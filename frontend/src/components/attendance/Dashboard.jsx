import React, { memo, useState, useCallback, useMemo } from 'react';
import { Bar, Pie } from 'react-chartjs-2';
import { FaUsers, FaClock, FaCalendarAlt, FaUser, FaChartBar } from 'react-icons/fa';
import { formatTime, formatDate } from '../../utils/dateUtils';

// Optimized Photo Component with better error handling
const AttendancePhoto = memo(({ photoUrl, staffName }) => {
  const [imageError, setImageError] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);

  const handleImageError = useCallback(() => {
    setImageError(true);
  }, []);

  const handleImageLoad = useCallback(() => {
    setImageLoaded(true);
  }, []);

  if (!photoUrl || imageError) {
    return (
      <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-gradient-to-br from-blue-100 to-blue-200 flex items-center justify-center shadow-sm">
        <FaUser className="text-blue-500 text-xs sm:text-sm" />
      </div>
    );
  }

  return (
    <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center overflow-hidden shadow-sm">
      {!imageLoaded && (
        <div className="animate-pulse bg-gradient-to-br from-gray-200 to-gray-300 w-full h-full rounded-full"></div>
      )}
      <img 
        src={photoUrl}
        alt={`Photo for ${staffName}`}
        className={`w-full h-full rounded-full object-cover transition-opacity duration-200 ${
          imageLoaded ? 'opacity-100' : 'opacity-0'
        }`}
        onError={handleImageError}
        onLoad={handleImageLoad}
        loading="lazy"
      />
    </div>
  );
});

AttendancePhoto.displayName = 'AttendancePhoto';

// Enhanced Live Log Row with Action column
const LiveLogRow = memo(({ log, getStaffName, getStaffPosition }) => (
  <tr className="hover:bg-gradient-to-r hover:from-blue-50 hover:to-indigo-50 transition-all duration-200 border-b border-gray-100">
    <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap">
      <div className="flex items-center space-x-2 sm:space-x-3">
        <AttendancePhoto 
          photoUrl={log.photoUrl} 
          staffName={getStaffName(log)}
        />
        <div className="min-w-0 flex-1">
          <div className="text-xs sm:text-sm font-medium text-gray-900 truncate">
            {getStaffName(log)}
          </div>
          <div className="text-xs text-gray-500 truncate sm:hidden">
            {getStaffPosition(log)}
          </div>
        </div>
      </div>
    </td>
    <td className="hidden sm:table-cell px-6 py-4 whitespace-nowrap text-sm text-gray-600">
      <span className="px-2 py-1 bg-gradient-to-r from-blue-100 to-blue-200 text-blue-800 rounded-full text-xs font-medium">
        {getStaffPosition(log)}
      </span>
    </td>
    <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap">
      <div className="text-xs sm:text-sm font-medium text-gray-900">
        {formatTime(log.timestamp)}
      </div>
      <div className="text-xs text-gray-500 sm:hidden">
        {formatDate(log.timestamp, 'short')}
      </div>
    </td>
    <td className="hidden sm:table-cell px-6 py-4 whitespace-nowrap text-sm text-gray-700">
      {formatDate(log.timestamp, 'short')}
    </td>
    <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap">
      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
        log.determinedType === 'clock-in' 
          ? 'bg-gradient-to-r from-green-100 to-green-200 text-green-800' 
          : log.determinedType === 'clock-out'
          ? 'bg-gradient-to-r from-blue-100 to-blue-200 text-blue-800'
          : 'bg-gradient-to-r from-gray-100 to-gray-200 text-gray-800'
      }`}>
        {log.determinedType === 'clock-in' ? 'In' : log.determinedType === 'clock-out' ? 'Out' : 'Unknown'}
      </span>
    </td>
  </tr>
));

LiveLogRow.displayName = 'LiveLogRow';

// Reports-style Attendance Row for Dashboard
const AttendanceReportRow = memo(({ record, getStaffName, getStaffPosition }) => {
  const fmtTime = (time) => time ? formatTime(time) : '-';
  const formatMinutes = (minutes) => {
    if (!minutes || minutes <= 0) return '-';
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins === 0 ? `${hours}h` : `${hours}h ${mins}m`;
  };

  const getStatusBadge = (record) => {
    if (record.absent) {
      return <span className="px-2 py-1 bg-gradient-to-r from-red-100 to-red-200 text-red-800 rounded-full text-xs font-semibold">Absent</span>;
    }
    if (record.checkIn && record.checkOut) {
      return <span className="px-2 py-1 bg-gradient-to-r from-green-100 to-green-200 text-green-800 rounded-full text-xs font-semibold">Complete</span>;
    }
    if (record.checkIn) {
      return <span className="px-2 py-1 bg-gradient-to-r from-yellow-100 to-yellow-200 text-yellow-800 rounded-full text-xs font-semibold">Partial</span>;
    }
    return <span className="px-2 py-1 bg-gradient-to-r from-gray-100 to-gray-200 text-gray-800 rounded-full text-xs font-semibold">No Data</span>;
  };

  return (
    <tr className="hover:bg-gradient-to-r hover:from-blue-50 hover:to-indigo-50 transition-all duration-200 border-b border-gray-100">
      <td className="px-2 sm:px-4 py-3 text-xs sm:text-sm">
        <div className="flex items-center space-x-2">
          <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
            {getStaffName(record).charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <div className="font-medium text-gray-900 truncate text-xs sm:text-sm">
              {getStaffName(record)}
            </div>
            <div className="text-xs text-gray-500 truncate lg:hidden">
              {getStaffPosition(record)}
            </div>
          </div>
        </div>
      </td>
      
      <td className="hidden lg:table-cell px-3 py-3 text-xs">
        <span className="px-2 py-1 bg-gradient-to-r from-blue-100 to-blue-200 text-blue-800 rounded-full text-xs font-medium">
          {getStaffPosition(record)}
        </span>
      </td>
      
      <td className="px-2 sm:px-3 py-3 text-xs sm:text-sm">
        <div className="flex items-center gap-1">
          <span className="text-green-600 text-xs">▶</span>
          <span className="font-mono text-gray-900">
            {fmtTime(record.checkIn)}
          </span>
        </div>
      </td>

      <td className="px-2 sm:px-3 py-3 text-xs sm:text-sm">
        <div className="flex items-center gap-1">
          <span className="text-red-600 text-xs">◀</span>
          <span className="font-mono text-gray-900">
            {fmtTime(record.checkOut)}
          </span>
        </div>
      </td>
      
      <td className="px-2 sm:px-3 py-3 text-xs sm:text-sm text-center">
        {record.late ? (
          <span className="text-amber-600 font-semibold">
            {formatMinutes(record.lateMinutes)}
          </span>
        ) : (
          <span className="text-gray-400">-</span>
        )}
      </td>
      
      <td className="px-2 sm:px-3 py-3 text-xs sm:text-sm text-center">
        {record.earlyLeave ? (
          <span className="text-orange-600 font-semibold">
            {formatMinutes(record.earlyLeaveMinutes)}
          </span>
        ) : (
          <span className="text-gray-400">-</span>
        )}
      </td>
      
      <td className="px-2 sm:px-3 py-3 text-xs sm:text-sm text-center">
        {getStatusBadge(record)}
      </td>
    </tr>
  );
});

AttendanceReportRow.displayName = 'AttendanceReportRow';

const Dashboard = memo(({
  dashboardStats,
  chartData,
  attendanceRecords,
  liveLogs,
  staff,
  getStaffName,
  getStaffPosition,
  loading,
  fetchAttendanceSummary
}) => {


  // FIXED: Get active staff IDs to filter records
  const activeStaffIds = useMemo(() => {
    if (!staff?.length) return new Set();
    return new Set(
      staff
        .filter(s => s.status === 'active')
        .map(s => s.employeeId)
    );
  }, [staff]);

  // OPTIMIZED: Filter today's records for dashboard display - ONLY ACTIVE STAFF
  const todayRecords = useMemo(() => {
    if (!attendanceRecords?.length) return [];
    
    const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'Africa/Lagos' });
    
    return attendanceRecords.filter(record => {
      if (!record?.date) return false;
      // FIXED: Only show records for active staff
      return record.date === todayStr && activeStaffIds.has(record.employeeId);
    });
  }, [attendanceRecords, activeStaffIds]);

  return (
    <div className="w-full space-y-6">

      
      {/* UPDATED: Dashboard Stats Cards with "Not Yet Clocked In" category */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
          <div className="bg-gradient-to-br from-green-500 via-green-600 to-green-700 text-white p-4 sm:p-6 rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-green-100 font-medium text-sm">Total Staff</p>
                <p className="text-2xl sm:text-3xl font-bold mt-1">{dashboardStats.totalStaff}</p>
              </div>
              <div className="w-12 h-12 sm:w-14 sm:h-14 bg-white bg-opacity-20 rounded-full flex items-center justify-center">
                <FaUsers className="text-xl sm:text-2xl text-green-100" />
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-blue-500 via-blue-600 to-blue-700 text-white p-4 sm:p-6 rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-blue-100 font-medium text-sm">Present Today</p>
                <p className="text-2xl sm:text-3xl font-bold mt-1">{dashboardStats.presentToday}</p>
                <p className="text-blue-200 text-xs mt-1">Actually clocked in</p>
              </div>
              <div className="w-12 h-12 sm:w-14 sm:h-14 bg-white bg-opacity-20 rounded-full flex items-center justify-center">
                <FaClock className="text-xl sm:text-2xl text-blue-100" />
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-red-500 via-red-600 to-red-700 text-white p-4 sm:p-6 rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-red-100 font-medium text-sm">Absent Today</p>
                <p className="text-2xl sm:text-3xl font-bold mt-1">{dashboardStats.absentToday}</p>
                <p className="text-red-200 text-xs mt-1">Confirmed absent</p>
              </div>
              <div className="w-12 h-12 sm:w-14 sm:h-14 bg-white bg-opacity-20 rounded-full flex items-center justify-center">
                <FaCalendarAlt className="text-xl sm:text-2xl text-red-100" />
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-purple-500 via-purple-600 to-purple-700 text-white p-4 sm:p-6 rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-purple-100 font-medium text-sm">Not Yet In</p>
                <p className="text-2xl sm:text-3xl font-bold mt-1">{dashboardStats.notYetClockedIn || 0}</p>
                <p className="text-purple-200 text-xs mt-1">Within shift window</p>
              </div>
              <div className="w-12 h-12 sm:w-14 sm:h-14 bg-white bg-opacity-20 rounded-full flex items-center justify-center">
                <FaClock className="text-xl sm:text-2xl text-purple-100" />
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-yellow-500 via-yellow-600 to-yellow-700 text-white p-4 sm:p-6 rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-yellow-100 font-medium text-sm">Late Today</p>
                <p className="text-2xl sm:text-3xl font-bold mt-1">{dashboardStats.lateToday}</p>
                <p className="text-yellow-200 text-xs mt-1">Late arrivals</p>
              </div>
              <div className="w-12 h-12 sm:w-14 sm:h-14 bg-white bg-opacity-20 rounded-full flex items-center justify-center">
                <FaClock className="text-xl sm:text-2xl text-yellow-100" />
              </div>
            </div>
          </div>
        </div>

      {/* Live Attendance Monitoring */}
      <div className="bg-gradient-to-br from-white to-gray-50 rounded-2xl shadow-lg overflow-hidden border border-gray-200">
        <div className="p-6 border-b border-gray-200 bg-gradient-to-r from-indigo-50 to-purple-50">
          <h3 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
            Live Attendance Monitoring
            <span className="text-sm font-normal text-gray-500 ml-2">(Latest 10)</span>
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gradient-to-r from-gray-50 to-gray-100">
              <tr>
                <th className="px-3 sm:px-6 py-4 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">
                  Staff
                </th>
                <th className="hidden sm:table-cell px-6 py-4 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">
                  Position
                </th>
                <th className="px-3 sm:px-6 py-4 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">
                  Time
                </th>
                <th className="hidden sm:table-cell px-6 py-4 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">
                  Date
                </th>
                <th className="px-3 sm:px-6 py-4 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">
                  Action
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-100">
              {liveLogs && liveLogs.length > 0 ? liveLogs.slice(0, 10).map((log) => (
                <LiveLogRow 
                  key={`${log._id}-${log.timestamp}`}
                  log={log}
                  getStaffName={getStaffName}
                  getStaffPosition={getStaffPosition}
                />
              )) : (
                <tr>
                  <td colSpan="5" className="px-6 py-12 text-center text-gray-500">
                    <div className="flex flex-col items-center gap-3">
                      <FaClock className="text-4xl text-gray-300" />
                      <p className="text-lg font-medium">No live logs available</p>
                      <p className="text-sm">Live attendance data will appear here</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* UPDATED: Pie Charts with accurate data including "Not Yet Clocked In" */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8">
            {/* Present vs Absent vs Not Yet In Chart */}
            <div className="flex flex-col items-center bg-white p-4 sm:p-6 rounded-xl shadow-sm border border-gray-100">
              <h4 className="text-base sm:text-lg font-semibold text-gray-700 mb-4 text-center">Staff Status Today</h4>
              <div className="w-48 h-48 sm:w-64 sm:h-64">
                <Pie 
                  data={{
                    labels: ['Present', 'Not Yet In', 'Absent'],
                    datasets: [{
                      data: [
                        dashboardStats.presentToday || 0,
                        dashboardStats.notYetClockedIn || 0,
                        dashboardStats.absentToday || 0
                      ],
                      backgroundColor: [
                        'rgba(59, 130, 246, 0.8)',  // Blue for Present
                        'rgba(147, 51, 234, 0.8)',  // Purple for Not Yet In
                        'rgba(239, 68, 68, 0.8)'    // Red for Absent
                      ],
                      borderColor: [
                        'rgba(37, 99, 235, 1)',
                        'rgba(126, 34, 206, 1)',
                        'rgba(220, 38, 38, 1)'
                      ],
                      borderWidth: 3,
                      hoverBackgroundColor: [
                        'rgba(96, 165, 250, 0.9)',
                        'rgba(168, 85, 247, 0.9)',
                        'rgba(248, 113, 113, 0.9)'
                      ],
                      hoverBorderColor: [
                        'rgba(29, 78, 216, 1)',
                        'rgba(107, 33, 168, 1)',
                        'rgba(185, 28, 28, 1)'
                      ],
                      hoverBorderWidth: 4,
                    }]
                  }}
                  options={{
                    responsive: true,
                    maintainAspectRatio: true,
                    plugins: {
                      legend: {
                        position: 'bottom',
                        labels: { 
                          padding: 15, 
                          usePointStyle: true,
                          font: { size: 12, weight: 'bold' },
                          boxWidth: 15
                        }
                      },
                      tooltip: {
                        backgroundColor: 'rgba(0, 0, 0, 0.8)',
                        titleColor: 'white',
                        bodyColor: 'white',
                        borderColor: 'rgba(255, 255, 255, 0.2)',
                        borderWidth: 1,
                        callbacks: {
                          label: function(context) {
                            const total = dashboardStats.totalStaff;
                            const percentage = total > 0 ? ((context.raw / total) * 100).toFixed(1) : 0;
                            return `${context.label}: ${context.raw} (${percentage}%)`;
                          }
                        }
                      }
                    },
                    elements: {
                      arc: {
                        borderRadius: 8,
                        hoverBorderRadius: 12
                      }
                    }
                  }}
                />
              </div>
              <div className="mt-4 text-center">
                <p className="text-sm text-gray-600 font-medium">
                  Total Staff: <span className="font-bold text-indigo-600">{dashboardStats.totalStaff}</span>
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  {dashboardStats.presentToday + dashboardStats.notYetClockedIn + dashboardStats.absentToday === dashboardStats.totalStaff 
                    ? 'All staff accounted for' 
                    : 'Calculating...'}
                </p>
              </div>
            </div>

            {/* Late vs On-Time Chart (only for those present) */}
            <div className="flex flex-col items-center bg-white p-4 sm:p-6 rounded-xl shadow-sm border border-gray-100">
              <h4 className="text-base sm:text-lg font-semibold text-gray-700 mb-4 text-center">On-Time vs Late</h4>
              <div className="w-48 h-48 sm:w-64 sm:h-64">
                <Pie 
                  data={{
                    labels: ['On-Time', 'Late'],
                    datasets: [{
                      data: [
                        Math.max(0, dashboardStats.presentToday - dashboardStats.lateToday),
                        dashboardStats.lateToday || 0
                      ],
                      backgroundColor: [
                        'rgba(16, 185, 129, 0.8)',
                        'rgba(245, 158, 11, 0.8)'
                      ],
                      borderColor: [
                        'rgba(5, 150, 104, 1)',
                        'rgba(217, 119, 6, 1)'
                      ],
                      borderWidth: 3,
                      hoverBackgroundColor: [
                        'rgba(52, 211, 153, 0.9)',
                        'rgba(251, 191, 36, 0.9)'
                      ],
                      hoverBorderColor: [
                        'rgba(4, 120, 87, 1)',
                        'rgba(180, 83, 9, 1)'
                      ],
                      hoverBorderWidth: 4,
                    }]
                  }}
                  options={{
                    responsive: true,
                    maintainAspectRatio: true,
                    plugins: {
                      legend: {
                        position: 'bottom',
                        labels: { 
                          padding: 15, 
                          usePointStyle: true,
                          font: { size: 12, weight: 'bold' },
                          boxWidth: 15
                        }
                      },
                      tooltip: {
                        backgroundColor: 'rgba(0, 0, 0, 0.8)',
                        titleColor: 'white',
                        bodyColor: 'white',
                        borderColor: 'rgba(255, 255, 255, 0.2)',
                        borderWidth: 1,
                        callbacks: {
                          label: function(context) {
                            const total = dashboardStats.presentToday;
                            const percentage = total > 0 ? ((context.raw / total) * 100).toFixed(1) : 0;
                            return `${context.label}: ${context.raw} (${percentage}%)`;
                          }
                        }
                      }
                    },
                    elements: {
                      arc: {
                        borderRadius: 8,
                        hoverBorderRadius: 12
                      }
                    }
                  }}
                />
              </div>
              <div className="mt-4 text-center">
                <p className="text-sm text-gray-600 font-medium">
                  Present Staff: <span className="font-bold text-green-600">{dashboardStats.presentToday}</span>
                </p>
              </div>
            </div>
          </div>

      {/* FIXED: Today's Attendance Report - No Date Filters */}
      <div className="bg-gradient-to-br from-white to-gray-50 rounded-2xl shadow-lg overflow-hidden border border-gray-200">
        <div className="p-6 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-indigo-50">
          <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4">
            <h3 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
              <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-lg flex items-center justify-center">
                <FaChartBar className="text-white text-sm" />
              </div>
              Today's Attendance Report
            </h3>
          </div>
          
          {/* Summary Info */}
          <div className="mt-4 flex flex-wrap items-center gap-4 text-sm">
            <div className="flex items-center gap-2 bg-gradient-to-r from-blue-50 to-indigo-50 px-3 py-2 rounded-lg border border-blue-200">
              <FaCalendarAlt className="text-blue-500" />
              <span className="font-medium text-blue-800">
                {new Date().toLocaleDateString('en-US', { 
                  weekday: 'long', 
                  month: 'long', 
                  day: 'numeric' 
                })}
              </span>
            </div>
            <div className="flex items-center gap-2 bg-gradient-to-r from-green-50 to-green-100 px-3 py-2 rounded-lg border border-green-200">
              <span className="font-medium text-green-800">
                {todayRecords.length} Records
              </span>
            </div>
            {loading && (
              <div className="flex items-center gap-2 text-blue-600">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                <span className="text-xs sm:text-sm font-medium">Loading...</span>
              </div>
            )}
          </div>
        </div>
        
        {/* Report Table */}
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gradient-to-r from-indigo-50 via-purple-50 to-pink-50">
              <tr>
                <th className="px-2 sm:px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider min-w-[140px]">
                  Staff Name
                </th>
                <th className="hidden lg:table-cell px-3 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider min-w-[100px]">
                  Position
                </th>
                <th className="px-2 sm:px-3 py-3 text-center text-xs font-bold text-gray-700 uppercase tracking-wider min-w-[80px]">
                  Check In
                </th>
                <th className="px-2 sm:px-3 py-3 text-center text-xs font-bold text-gray-700 uppercase tracking-wider min-w-[80px]">
                  Check Out
                </th>
                <th className="px-2 sm:px-3 py-3 text-center text-xs font-bold text-gray-700 uppercase tracking-wider min-w-[60px]">
                  Late
                </th>
                <th className="px-2 sm:px-3 py-3 text-center text-xs font-bold text-gray-700 uppercase tracking-wider min-w-[80px]">
                  Early Leave
                </th>
                <th className="px-2 sm:px-3 py-3 text-center text-xs font-bold text-gray-700 uppercase tracking-wider min-w-[80px]">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan="7" className="px-6 py-12 text-center text-gray-500">
                    <div className="flex flex-col items-center gap-4">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                      <p className="text-sm font-medium">Loading...</p>
                    </div>
                  </td>
                </tr>
              ) : todayRecords.length === 0 ? (
                <tr>
                  <td colSpan="7" className="px-6 py-12 text-center text-gray-500">
                    <div className="flex flex-col items-center gap-4">
                      <div className="w-12 h-12 bg-gradient-to-br from-gray-100 to-gray-200 rounded-full flex items-center justify-center">
                        <FaCalendarAlt className="text-gray-400 text-xl" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-700">No attendance records for today</p>
                        <p className="text-xs text-gray-500 mt-1">
                          Staff attendance will appear here as they check in
                        </p>
                      </div>
                    </div>
                  </td>
                </tr>
              ) : (
                todayRecords.map((record) => (
                  <AttendanceReportRow 
                    key={`${record.employeeId}-${record.date}`}
                    record={record}
                    getStaffName={getStaffName}
                    getStaffPosition={getStaffPosition}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
});

Dashboard.displayName = 'Dashboard';

export default Dashboard;