// LeaveBalancesTab.jsx — View and manually adjust employee leave balances
import React, { useState, useEffect, useCallback } from 'react';
import { FaSync, FaEdit, FaCheck, FaTimes, FaChartBar, FaUsers } from 'react-icons/fa';
import { useTenant } from '../../../context/TenantProvider';

const LEAVE_TYPE_LABELS = {
  annual:    'Annual', sick:      'Sick', maternity: 'Maternity',
  paternity: 'Paternity', casual: 'Casual', emergency: 'Emergency',
  unpaid:    'Unpaid', other:     'Other',
};

const BAR_COLORS = {
  annual: 'bg-blue-500', sick: 'bg-orange-500', maternity: 'bg-pink-500',
  paternity: 'bg-indigo-500', casual: 'bg-teal-500', emergency: 'bg-red-500',
  unpaid: 'bg-gray-400', other: 'bg-purple-500',
};

function BalanceBar({ used, total }) {
  const pct = total > 0 ? Math.min(100, Math.round((used / total) * 100)) : 0;
  const color = pct >= 90 ? 'bg-red-500' : pct >= 70 ? 'bg-yellow-500' : 'bg-green-500';
  return (
    <div className="flex items-center gap-2 mt-1">
      <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-gray-500 whitespace-nowrap">{pct}% used</span>
    </div>
  );
}

function AdjustModal({ balance, onSave, onClose }) {
  const [adjustment, setAdjustment] = useState(balance.adjustmentDays ?? 0);
  const [carryover, setCarryover]   = useState(balance.carriedOverDays ?? 0);
  const [saving, setSaving]         = useState(false);

  const handleSave = async () => {
    setSaving(true);
    await onSave(balance._id, { adjustmentDays: Number(adjustment), carriedOverDays: Number(carryover) });
    setSaving(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm">
        <div className="p-5 border-b border-gray-100">
          <h3 className="font-semibold text-gray-900">Adjust Balance</h3>
          <p className="text-sm text-gray-500 mt-0.5">
            {balance.staffName} — {LEAVE_TYPE_LABELS[balance.leaveType] || balance.leaveType} {balance.year}
          </p>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Carried-over days</label>
            <input type="number" min="0" step="0.5" value={carryover} onChange={e => setCarryover(e.target.value)}
              className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Manual adjustment <span className="font-normal text-gray-400">(+ or −)</span>
            </label>
            <input type="number" step="0.5" value={adjustment} onChange={e => setAdjustment(e.target.value)}
              className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm" />
          </div>
          <div className="bg-gray-50 rounded-lg p-3 text-sm space-y-1">
            {[
              ['Entitled',   `${balance.entitledDays ?? 0} d`],
              ['Carryover',  `${Number(carryover)} d`],
              ['Adjustment', `${Number(adjustment) >= 0 ? '+' : ''}${Number(adjustment)} d`],
              ['Used',       `−${balance.usedDays ?? 0} d`],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between text-gray-600"><span>{k}</span><span>{v}</span></div>
            ))}
            <div className="flex justify-between font-semibold text-gray-900 border-t border-gray-200 pt-1 mt-1">
              <span>Available</span>
              <span>
                {(balance.entitledDays || 0) + Number(carryover) - (balance.usedDays || 0) - (balance.pendingDays || 0) + Number(adjustment)} d
              </span>
            </div>
          </div>
        </div>
        <div className="p-5 pt-0 flex gap-3">
          <button onClick={handleSave} disabled={saving}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold disabled:opacity-50 transition-colors">
            <FaCheck /> {saving ? 'Saving…' : 'Save'}
          </button>
          <button onClick={onClose}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm font-medium transition-colors">
            <FaTimes /> Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

export default function LeaveBalancesTab() {
  const { makeRequest }     = useTenant();
  const [balances, setBalances]   = useState([]);
  const [loading, setLoading]     = useState(true);
  const [recalcing, setRecalcing] = useState(false);
  const [error, setError]         = useState('');
  const [success, setSuccess]     = useState('');
  const [adjusting, setAdjusting] = useState(null);

  // Group by employee
  const [groupBy, setGroupBy]     = useState('employee'); // 'employee' | 'type'
  const [yearFilter, setYearFilter] = useState(new Date().getFullYear());
  const [typeFilter, setTypeFilter] = useState('');
  const [search, setSearch]         = useState('');

  const fetchBalances = useCallback(async () => {
    try {
      setLoading(true);
      const res = await makeRequest(`/api/attendance/leave-balances?year=${yearFilter}`);
      setBalances(res.balances || res || []);
    } catch (err) {
      setError(err.message || 'Failed to load balances');
    } finally {
      setLoading(false);
    }
  }, [makeRequest, yearFilter]);

  useEffect(() => { fetchBalances(); }, [fetchBalances]);

  const flash = (msg, isError = false) => {
    if (isError) { setError(msg); setTimeout(() => setError(''), 4000); }
    else { setSuccess(msg); setTimeout(() => setSuccess(''), 4000); }
  };

  const handleRecalculate = async () => {
    if (!window.confirm('Recalculate all leave balances from approved leave records?')) return;
    try {
      setRecalcing(true);
      const res = await makeRequest('/api/attendance/leave-balances/recalculate', { method: 'POST', body: JSON.stringify({ year: yearFilter }) });
      flash(`Recalculated: ${res.updated || 0} balance(s) updated`);
      fetchBalances();
    } catch (err) {
      flash(err.message || 'Recalculation failed', true);
    } finally {
      setRecalcing(false);
    }
  };

  const handleAdjustSave = async (id, data) => {
    try {
      await makeRequest(`/api/attendance/leave-balances/${id}`, { method: 'PUT', body: JSON.stringify(data) });
      flash('Balance adjusted');
      fetchBalances();
    } catch (err) {
      flash(err.message || 'Adjustment failed', true);
      throw err;
    }
  };

  // Filter & group
  const filtered = balances.filter(b => {
    const matchType = !typeFilter || b.leaveType === typeFilter;
    const matchSearch = !search || (b.staffName || '').toLowerCase().includes(search.toLowerCase());
    return matchType && matchSearch;
  });

  // Group by employee
  const byEmployee = filtered.reduce((acc, b) => {
    const key = b.staffId || b.employeeId;
    if (!acc[key]) acc[key] = { staffId: key, staffName: b.staffName, balances: [] };
    acc[key].balances.push(b);
    return acc;
  }, {});

  const leaveTypes = [...new Set(balances.map(b => b.leaveType))];

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <FaChartBar className="text-gray-500" /> Leave Balances
          </h3>
          <p className="text-sm text-gray-500 mt-0.5">View and manually adjust employee leave day balances</p>
        </div>
        <div className="flex gap-2 flex-shrink-0">
          <button onClick={fetchBalances} title="Refresh"
            className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">
            <FaSync className={loading ? 'animate-spin' : ''} />
          </button>
          <button onClick={handleRecalculate} disabled={recalcing}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-lg text-sm font-medium disabled:opacity-50 transition-colors">
            <FaSync className={recalcing ? 'animate-spin' : ''} />
            {recalcing ? 'Recalculating…' : 'Recalculate All'}
          </button>
        </div>
      </div>

      {/* Alerts */}
      {error   && <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>}
      {success && <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700">{success}</div>}

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <input type="number" value={yearFilter} onChange={e => setYearFilter(+e.target.value)} min="2020" max="2035"
          className="w-24 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500" />
        <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500">
          <option value="">All types</option>
          {leaveTypes.map(t => <option key={t} value={t}>{LEAVE_TYPE_LABELS[t] || t}</option>)}
        </select>
        <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search employee…"
          className="flex-1 min-w-[160px] px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500" />
      </div>

      {/* Balances */}
      {loading ? (
        <div className="space-y-3">
          {[1,2,3,4].map(i => <div key={i} className="h-24 bg-gray-100 rounded-xl animate-pulse" />)}
        </div>
      ) : Object.keys(byEmployee).length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border border-dashed border-gray-300">
          <FaUsers className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <h4 className="text-base font-semibold text-gray-600 mb-1">No balances found</h4>
          <p className="text-sm text-gray-400 mb-4">Click "Recalculate All" to generate balances from approved leave records.</p>
          <button onClick={handleRecalculate} disabled={recalcing}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-semibold disabled:opacity-50 transition-colors">
            <FaSync className={recalcing ? 'animate-spin' : ''} />
            Recalculate All
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {Object.values(byEmployee).map(emp => (
            <div key={emp.staffId} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="px-4 py-3 bg-gray-50 border-b border-gray-100 flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                  <span className="text-blue-700 font-bold text-xs">{(emp.staffName || '?').charAt(0).toUpperCase()}</span>
                </div>
                <div>
                  <p className="font-semibold text-gray-900 text-sm">{emp.staffName || emp.staffId}</p>
                  <p className="text-xs text-gray-500">{emp.balances.length} leave type{emp.balances.length !== 1 ? 's' : ''}</p>
                </div>
              </div>
              <div className="divide-y divide-gray-100">
                {emp.balances.map(b => {
                  const available = (b.entitledDays || 0) + (b.carriedOverDays || 0) - (b.usedDays || 0) - (b.pendingDays || 0) + (b.adjustmentDays || 0);
                  const total = (b.entitledDays || 0) + (b.carriedOverDays || 0) + (b.adjustmentDays || 0);
                  const barColor = BAR_COLORS[b.leaveType] || 'bg-gray-400';
                  return (
                    <div key={b._id} className="px-4 py-3 flex items-center gap-4">
                      <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${barColor}`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm font-medium text-gray-800">
                            {LEAVE_TYPE_LABELS[b.leaveType] || b.leaveType}
                          </span>
                          <span className={`text-sm font-bold ${available <= 0 ? 'text-red-600' : available <= 3 ? 'text-yellow-600' : 'text-green-700'}`}>
                            {available} / {total} d avail.
                          </span>
                        </div>
                        <BalanceBar used={b.usedDays || 0} total={total} />
                        <div className="flex gap-3 mt-1 text-xs text-gray-400">
                          <span>Entitled: {b.entitledDays ?? 0}</span>
                          {(b.carriedOverDays || 0) > 0 && <span>Carried: +{b.carriedOverDays}</span>}
                          {(b.adjustmentDays || 0) !== 0 && <span>Adj: {b.adjustmentDays > 0 ? '+' : ''}{b.adjustmentDays}</span>}
                          <span>Used: {b.usedDays ?? 0}</span>
                          {(b.pendingDays || 0) > 0 && <span>Pending: {b.pendingDays}</span>}
                        </div>
                      </div>
                      <button onClick={() => setAdjusting(b)}
                        className="p-1.5 text-blue-500 hover:bg-blue-50 rounded-lg transition-colors flex-shrink-0" title="Adjust">
                        <FaEdit className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {adjusting && (
        <AdjustModal balance={adjusting} onSave={handleAdjustSave} onClose={() => setAdjusting(null)} />
      )}
    </div>
  );
}
