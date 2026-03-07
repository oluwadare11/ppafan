// DeductionCalendar.jsx - Calendar view of daily deductions
// Ella's Place style: per-day expandable rows, color-coded badges

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useTenant } from '../../../context/TenantProvider.jsx';
import {
  Calendar,
  ChevronDown,
  ChevronRight,
  Clock,
  LogOut,
  UserX,
  AlertCircle,
  Filter,
  RefreshCw,
  Users,
  TrendingDown
} from 'lucide-react';

import { SkeletonLine } from '../shared';

const TYPE_CONFIG = {
  lateness: { label: 'Late', color: 'orange', bgClass: 'bg-orange-50 border-orange-200', badgeClass: 'bg-orange-100 text-orange-800', icon: Clock },
  earlyLeave: { label: 'Early Leave', color: 'yellow', bgClass: 'bg-yellow-50 border-yellow-200', badgeClass: 'bg-yellow-100 text-yellow-800', icon: LogOut },
  absence: { label: 'Absent', color: 'red', bgClass: 'bg-red-50 border-red-200', badgeClass: 'bg-red-100 text-red-800', icon: UserX },
  other: { label: 'Other', color: 'gray', bgClass: 'bg-gray-50 border-gray-200', badgeClass: 'bg-gray-100 text-gray-800', icon: AlertCircle }
};

function DeductionCalendar({ refreshTick = 0 }) {
  const { makeRequest } = useTenant();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  // Filters
  const [period, setPeriod] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [employeeFilter, setEmployeeFilter] = useState('');
  const [expandedDays, setExpandedDays] = useState(new Set());

  const fetchCalendar = useCallback(async (showRefresh = false) => {
    

    try {
      if (showRefresh) setRefreshing(true);
      else setLoading(true);

      let url = `/api/payroll/deductions/calendar/${period}`;
      if (employeeFilter) url += `?employeeNumber=${employeeFilter}`;

      const result = await makeRequest(url);
      setData(result);
      setError('');
    } catch (err) {
      setError(err.message || 'Failed to load deduction calendar');
      setData(null);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [makeRequest, period, employeeFilter]);

  useEffect(() => {
    fetchCalendar();
  }, [fetchCalendar]);

  // External refresh trigger (from PayrollContainer polling during recalculation)
  const isFirstTick = React.useRef(true);
  useEffect(() => {
    if (isFirstTick.current) { isFirstTick.current = false; return; }
    fetchCalendar(true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshTick]);

  const toggleDay = (date) => {
    setExpandedDays(prev => {
      const next = new Set(prev);
      if (next.has(date)) next.delete(date);
      else next.add(date);
      return next;
    });
  };

  const expandAll = () => {
    if (data?.calendar) {
      setExpandedDays(new Set(data.calendar.map(d => d.date)));
    }
  };

  const collapseAll = () => setExpandedDays(new Set());

  // Get unique staff for filter dropdown
  const staffOptions = useMemo(() => {
    if (!data?.staffSummary) return [];
    return data.staffSummary.map(s => ({
      value: s.employeeNumber,
      label: `${s.name} (${s.employeeNumber})`
    }));
  }, [data?.staffSummary]);

  const formatDate = (dateStr) => {
    try {
      const d = new Date(dateStr + 'T00:00:00');
      return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    } catch {
      return dateStr;
    }
  };

  const getDayOfWeek = (dateStr) => {
    try {
      return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long' });
    } catch {
      return '';
    }
  };

  const getPeriodLabel = () => {
    const [year, month] = period.split('-');
    const d = new Date(year, parseInt(month) - 1, 1);
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
  };

  if (loading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="flex gap-4 mb-6">
          <SkeletonLine width="w-48" />
          <SkeletonLine width="w-48" />
        </div>
        {[1, 2, 3, 4, 5].map(i => (
          <div key={i} className="bg-white rounded-lg p-4 border border-gray-200">
            <SkeletonLine width={i % 2 === 0 ? "w-full" : "w-3/4"} />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with filters */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-blue-600" />
            <h3 className="text-lg font-semibold text-gray-900">Deduction Calendar</h3>
          </div>

          <div className="flex flex-wrap items-center gap-3 sm:ml-auto">
            {/* Period selector */}
            <input
              type="month"
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm bg-white text-gray-900"
            />

            {/* Staff filter */}
            <div className="relative">
              <select
                value={employeeFilter}
                onChange={(e) => setEmployeeFilter(e.target.value)}
                className="pl-8 pr-3 py-1.5 border border-gray-300 rounded-lg text-sm bg-white text-gray-900 appearance-none"
              >
                <option value="">All Staff</option>
                {staffOptions.map(s => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
              <Filter className="w-4 h-4 text-gray-400 absolute left-2 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>

            <button
              onClick={() => fetchCalendar(true)}
              disabled={refreshing}
              className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg"
              title="Refresh"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
          {error}
        </div>
      )}

      {/* Summary cards */}
      {data?.totals && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <SummaryCard
            label="Lateness"
            amount={data.totals.totalLateness}
            count={data.calendar?.reduce((s, d) => s + d.lateness.length, 0) || 0}
            color="orange"
          />
          <SummaryCard
            label="Early Leave"
            amount={data.totals.totalEarlyLeave}
            count={data.calendar?.reduce((s, d) => s + d.earlyLeave.length, 0) || 0}
            color="yellow"
          />
          <SummaryCard
            label="Absence"
            amount={data.totals.totalAbsence}
            count={data.calendar?.reduce((s, d) => s + d.absence.length, 0) || 0}
            color="red"
          />
          <SummaryCard
            label="Other"
            amount={data.totals.totalOther}
            count={data.calendar?.reduce((s, d) => s + d.other.length, 0) || 0}
            color="gray"
          />
        </div>
      )}

      {/* Expand/Collapse controls */}
      {data?.calendar?.length > 0 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-500">
            {data.calendar.length} days with deductions in {getPeriodLabel()}
          </p>
          <div className="flex gap-2">
            <button
              onClick={expandAll}
              className="text-xs text-blue-600 hover:text-blue-800 font-medium"
            >
              Expand All
            </button>
            <span className="text-gray-300">|</span>
            <button
              onClick={collapseAll}
              className="text-xs text-blue-600 hover:text-blue-800 font-medium"
            >
              Collapse All
            </button>
          </div>
        </div>
      )}

      {/* Calendar rows */}
      {!data?.calendar?.length ? (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 text-center">
          <TrendingDown className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <h4 className="text-lg font-medium text-gray-700 mb-1">No Deductions Found</h4>
          <p className="text-sm text-gray-500">
            No attendance deductions recorded for {getPeriodLabel()}.
            {!data?.staffCount ? ' Payroll may not have been generated yet.' : ''}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {data.calendar.map(day => (
            <DayRow
              key={day.date}
              day={day}
              expanded={expandedDays.has(day.date)}
              onToggle={() => toggleDay(day.date)}
              formatDate={formatDate}
              getDayOfWeek={getDayOfWeek}
            />
          ))}
        </div>
      )}

      {/* Staff Summary Table */}
      {data?.staffSummary?.length > 0 && !employeeFilter && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-gray-500" />
              <h4 className="text-sm font-semibold text-gray-700">Staff Deduction Summary</h4>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-gray-600 text-left">
                  <th className="px-4 py-2 font-medium">Staff</th>
                  <th className="px-4 py-2 font-medium text-center">Late Days</th>
                  <th className="px-4 py-2 font-medium text-center">Absent Days</th>
                  <th className="px-4 py-2 font-medium text-right">Lateness</th>
                  <th className="px-4 py-2 font-medium text-right">Early Leave</th>
                  <th className="px-4 py-2 font-medium text-right">Absence</th>
                  <th className="px-4 py-2 font-medium text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {data.staffSummary.map(s => (
                  <tr key={s.employeeNumber} className="hover:bg-gray-50">
                    <td className="px-4 py-2">
                      <div className="font-medium text-gray-900">{s.name}</div>
                      <div className="text-xs text-gray-500">{s.department}</div>
                    </td>
                    <td className="px-4 py-2 text-center">
                      {s.lateDays > 0 ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
                          {s.lateDays}
                        </span>
                      ) : <span className="text-gray-400">0</span>}
                    </td>
                    <td className="px-4 py-2 text-center">
                      {s.absentDays > 0 ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                          {s.absentDays}
                        </span>
                      ) : <span className="text-gray-400">0</span>}
                    </td>
                    <td className="px-4 py-2 text-right text-orange-700 font-medium">
                      {s.latenessAmount > 0 ? `₦${s.latenessAmount.toLocaleString()}` : '-'}
                    </td>
                    <td className="px-4 py-2 text-right text-yellow-700 font-medium">
                      {s.earlyLeaveAmount > 0 ? `₦${s.earlyLeaveAmount.toLocaleString()}` : '-'}
                    </td>
                    <td className="px-4 py-2 text-right text-red-700 font-medium">
                      {s.absenceAmount > 0 ? `₦${s.absenceAmount.toLocaleString()}` : '-'}
                    </td>
                    <td className="px-4 py-2 text-right font-bold text-gray-900">
                      ₦{s.totalDeductions.toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// Summary card component
function SummaryCard({ label, amount, count, color }) {
  const colorMap = {
    orange: 'bg-orange-50 border-orange-200 text-orange-700',
    yellow: 'bg-yellow-50 border-yellow-200 text-yellow-700',
    red: 'bg-red-50 border-red-200 text-red-700',
    gray: 'bg-gray-50 border-gray-200 text-gray-700'
  };

  return (
    <div className={`rounded-lg border p-3 ${colorMap[color] || colorMap.gray}`}>
      <div className="text-xs font-medium opacity-75 mb-1">{label}</div>
      <div className="text-xl font-bold">₦{(amount || 0).toLocaleString()}</div>
      <div className="text-xs opacity-60 mt-0.5">{count} occurrence{count !== 1 ? 's' : ''}</div>
    </div>
  );
}

// Day row component (expandable)
function DayRow({ day, expanded, onToggle, formatDate, getDayOfWeek }) {
  const totalEvents = day.lateness.length + day.earlyLeave.length + day.absence.length + day.other.length;
  const dayOfWeek = getDayOfWeek(day.date);
  const isWeekend = dayOfWeek === 'Saturday' || dayOfWeek === 'Sunday';

  return (
    <div className={`bg-white rounded-lg shadow-sm border ${isWeekend ? 'border-gray-300 bg-gray-50' : 'border-gray-200'}`}>
      {/* Day header */}
      <button
        onClick={onToggle}
        className="w-full px-4 py-3 flex items-center gap-3 hover:bg-gray-50 transition-colors"
      >
        {expanded ? (
          <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" />
        ) : (
          <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0" />
        )}

        <div className="flex-1 flex items-center gap-3 min-w-0">
          <span className="font-medium text-gray-900 text-sm whitespace-nowrap">
            {formatDate(day.date)}
          </span>

          {/* Badges */}
          <div className="flex flex-wrap gap-1.5">
            {day.lateness.length > 0 && (
              <TypeBadge type="lateness" count={day.lateness.length} />
            )}
            {day.earlyLeave.length > 0 && (
              <TypeBadge type="earlyLeave" count={day.earlyLeave.length} />
            )}
            {day.absence.length > 0 && (
              <TypeBadge type="absence" count={day.absence.length} />
            )}
            {day.other.length > 0 && (
              <TypeBadge type="other" count={day.other.length} />
            )}
          </div>
        </div>

        <div className="text-right flex-shrink-0">
          <span className="text-sm font-semibold text-gray-900">
            ₦{day.totalAmount.toLocaleString()}
          </span>
          <span className="text-xs text-gray-500 ml-2">
            {totalEvents} event{totalEvents !== 1 ? 's' : ''}
          </span>
        </div>
      </button>

      {/* Expanded details */}
      {expanded && (
        <div className="border-t border-gray-100 px-4 py-3 space-y-3">
          {day.lateness.length > 0 && (
            <EventSection type="lateness" events={day.lateness} />
          )}
          {day.earlyLeave.length > 0 && (
            <EventSection type="earlyLeave" events={day.earlyLeave} />
          )}
          {day.absence.length > 0 && (
            <EventSection type="absence" events={day.absence} />
          )}
          {day.other.length > 0 && (
            <EventSection type="other" events={day.other} />
          )}
        </div>
      )}
    </div>
  );
}

// Type badge
function TypeBadge({ type, count }) {
  const config = TYPE_CONFIG[type];
  if (!config) return null;
  const Icon = config.icon;

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${config.badgeClass}`}>
      <Icon className="w-3 h-3" />
      {count} {config.label}
    </span>
  );
}

// Event section within expanded day
function EventSection({ type, events }) {
  const config = TYPE_CONFIG[type];
  if (!config) return null;

  return (
    <div className={`rounded-lg border p-3 ${config.bgClass}`}>
      <div className="flex items-center gap-2 mb-2">
        <config.icon className="w-4 h-4" />
        <span className="text-sm font-medium">{config.label} ({events.length})</span>
      </div>
      <div className="space-y-1">
        {events.map((event, i) => (
          <div key={i} className="flex items-center justify-between text-sm">
            <div>
              <span className="font-medium text-gray-900">{event.name}</span>
              {event.department && (
                <span className="text-gray-500 ml-1">({event.department})</span>
              )}
              {event.minutes > 0 && (
                <span className="text-gray-500 ml-2">{event.minutes} min</span>
              )}
              {event.description && (
                <span className="text-gray-400 ml-2 text-xs">{event.description}</span>
              )}
            </div>
            <span className="font-semibold text-gray-900 whitespace-nowrap ml-4">
              ₦{event.amount.toLocaleString()}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default DeductionCalendar;
