// AdjustmentsStep.jsx — Step 1: Review deductions, add bonuses/overtime before generating payroll

import React, { useState, useEffect, useCallback } from 'react';
import { useTenant } from '../../../context/TenantProvider.jsx';
import {
  Eye,
  Gift,
  Clock,
  ChevronDown,
  ChevronUp,
  Plus,
  Trash2,
  ArrowRight,
  Info,
  Landmark,
  Lock
} from 'lucide-react';

// ─── Collapsible Section ───
function Section({ title, icon: Icon, count, defaultOpen = true, children }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <Icon className="w-5 h-5 text-gray-500" />
          <span className="font-medium text-gray-900">{title}</span>
          {count !== undefined && (
            <span className="px-2 py-0.5 text-xs font-medium bg-gray-100 text-gray-600 rounded-full">{count}</span>
          )}
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
      </button>
      {open && <div className="border-t border-gray-100 p-4">{children}</div>}
    </div>
  );
}

// ─── Summary Card ───
function SummaryCard({ label, value, color, isAddition }) {
  const colorMap = { red: 'text-red-600', orange: 'text-orange-600', green: 'text-green-600' };
  return (
    <div className="bg-gray-50 rounded-lg p-3 text-center">
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p className={`text-sm font-bold ${colorMap[color] || 'text-gray-900'}`}>
        {isAddition && value > 0 ? '+' : value > 0 && !isAddition ? '-' : ''}₦{(value || 0).toLocaleString()}
      </p>
    </div>
  );
}

// ─── Deduction Preview Panel ───
function DeductionPreview({ period, makeRequest, onRecalculate, recalculating }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(null);

  const fetchPreview = useCallback(async () => {
    if (!period) return;
    setLoading(true);
    try {
      const res = await makeRequest(`/api/payroll/preview/${period}`);
      setData(res);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [period, makeRequest]);

  useEffect(() => { fetchPreview(); }, [fetchPreview]);

  if (loading) return <p className="text-sm text-gray-500 py-2">Loading preview...</p>;
  if (!data || data.staffCount === 0) {
    return (
      <div className="text-center py-6">
        <Info className="w-8 h-8 text-gray-300 mx-auto mb-2" />
        <p className="text-sm text-gray-500">No pre-calculated deduction data yet.</p>
        <p className="text-xs text-gray-400 mt-1">Attendance deductions will be applied when payroll is generated.</p>
      </div>
    );
  }

  const s = data.summary;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <SummaryCard label="Lateness" value={s.totalLateness} color="red" />
        <SummaryCard label="Early Leave" value={s.totalEarlyLeave} color="red" />
        <SummaryCard label="Absence" value={s.totalAbsence} color="red" />
        <SummaryCard label="Loan Ded." value={s.totalLoanDeductions} color="orange" />
        <SummaryCard label="Bonuses" value={s.totalBonuses} color="green" isAddition />
        <SummaryCard label="Overtime" value={s.totalOvertime} color="green" isAddition />
      </div>

      <p className="text-xs text-gray-500">
        {s.staffWithDeductions} of {data.staffCount} staff have attendance deductions
      </p>

      {data.staff.filter(st => st.deductions.total > 0 || st.additions.total > 0 || st.loans.length > 0).length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-left text-gray-500">
                <th className="py-2 pr-4 font-medium">Staff</th>
                <th className="py-2 pr-4 font-medium text-right">Deductions</th>
                <th className="py-2 pr-4 font-medium text-right">Additions</th>
                <th className="py-2 font-medium">Attendance</th>
              </tr>
            </thead>
            <tbody>
              {data.staff.filter(st => st.deductions.total > 0 || st.additions.total > 0 || st.loans.length > 0).map(st => (
                <React.Fragment key={st.employeeNumber}>
                  <tr
                    className="border-b border-gray-50 hover:bg-gray-50 cursor-pointer"
                    onClick={() => setExpanded(expanded === st.employeeNumber ? null : st.employeeNumber)}
                  >
                    <td className="py-2 pr-4">
                      <p className="font-medium text-gray-900">{st.name}</p>
                      <p className="text-xs text-gray-400">{st.employeeNumber}</p>
                    </td>
                    <td className="py-2 pr-4 text-right text-red-600 font-medium">
                      {st.deductions.total > 0 ? `-₦${st.deductions.total.toLocaleString()}` : '—'}
                    </td>
                    <td className="py-2 pr-4 text-right text-green-600 font-medium">
                      {st.additions.total > 0 ? `+₦${st.additions.total.toLocaleString()}` : '—'}
                    </td>
                    <td className="py-2 text-xs text-gray-500">
                      {st.attendance.presentDays}P / {st.attendance.absentDays}A / {st.attendance.lateDays}L
                    </td>
                  </tr>
                  {expanded === st.employeeNumber && (
                    <tr>
                      <td colSpan={4} className="bg-gray-50 px-4 py-3">
                        <div className="grid grid-cols-2 gap-4 text-xs">
                          <div>
                            <p className="font-medium text-gray-700 mb-1">Deduction Breakdown</p>
                            {st.deductions.lateness > 0 && <p className="text-red-600">Lateness: ₦{st.deductions.lateness.toLocaleString()}</p>}
                            {st.deductions.earlyLeave > 0 && <p className="text-red-600">Early Leave: ₦{st.deductions.earlyLeave.toLocaleString()}</p>}
                            {st.deductions.absence > 0 && <p className="text-red-600">Absence: ₦{st.deductions.absence.toLocaleString()}</p>}
                            {st.deductions.loans > 0 && <p className="text-orange-600">Loan: ₦{st.deductions.loans.toLocaleString()}</p>}
                            {st.deductions.total === 0 && <p className="text-gray-400">None</p>}
                          </div>
                          <div>
                            <p className="font-medium text-gray-700 mb-1">Additions</p>
                            {st.bonuses.map((b, i) => (
                              <p key={i} className="text-green-600">{b.name}: ₦{(b.amount || 0).toLocaleString()}</p>
                            ))}
                            {st.additions.overtime > 0 && <p className="text-green-600">Overtime: ₦{st.additions.overtime.toLocaleString()}</p>}
                            {st.additions.total === 0 && <p className="text-gray-400">None</p>}
                          </div>
                        </div>
                        {st.loans.length > 0 && (
                          <div className="mt-2 pt-2 border-t border-gray-200">
                            <p className="font-medium text-gray-700 mb-1 text-xs">Active Loans</p>
                            {st.loans.map((l, i) => (
                              <p key={i} className="text-xs text-gray-600">
                                {l.type === 'advance' ? 'Advance' : 'Loan'}: {l.description} — ₦{l.monthlyDeduction.toLocaleString()}/mo (Bal: ₦{l.remainingBalance.toLocaleString()})
                              </p>
                            ))}
                          </div>
                        )}
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {onRecalculate && (
        <div className="mt-2 pt-4 border-t border-gray-100">
          <p className="text-xs text-gray-500 mb-2">
            If attendance records were corrected recently, sync them to update deductions:
          </p>
          <button
            onClick={onRecalculate}
            disabled={recalculating}
            className="flex items-center gap-2 px-4 py-2 text-gray-700 bg-white border border-gray-300 font-medium rounded-lg text-sm transition-colors hover:bg-gray-50 disabled:opacity-50"
          >
            {recalculating
              ? <><RotateCcw className="w-4 h-4 animate-spin" /> Syncing...</>
              : <><RotateCcw className="w-4 h-4" /> Sync Attendance Changes</>
            }
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Bonus Manager ───
function BonusManager({ period, makeRequest, onError }) {
  const [bonuses, setBonuses] = useState([]);
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ employeeNumber: '', amount: '', name: '', description: '' });

  const fetchData = useCallback(async () => {
    if (!period) return;
    setLoading(true);
    try {
      const [bonusRes, staffRes] = await Promise.all([
        makeRequest(`/api/payroll/bonuses/${period}`),
        makeRequest('/api/payroll/staff-setup')
      ]);
      setBonuses(bonusRes.bonuses || []);
      setStaff(staffRes.staff || staffRes);
    } catch { /* ignore */ } finally { setLoading(false); }
  }, [period, makeRequest]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!form.employeeNumber || !form.amount) return;
    try {
      await makeRequest('/api/payroll/bonuses', {
        method: 'POST',
        data: { ...form, period, amount: Number(form.amount) }
      });
      setForm({ employeeNumber: '', amount: '', name: '', description: '' });
      fetchData();
    } catch (err) { onError(err.message || 'Failed to add bonus'); }
  };

  const handleDelete = async (b) => {
    try {
      await makeRequest(`/api/payroll/bonuses/${period}/${b.employeeNumber}/${b.code}`, { method: 'DELETE' });
      fetchData();
    } catch (err) { onError(err.message || 'Failed to remove bonus'); }
  };

  if (loading && bonuses.length === 0) return <p className="text-sm text-gray-500 py-2">Loading...</p>;

  return (
    <div className="space-y-4">
      <form onSubmit={handleAdd} className="grid grid-cols-1 sm:grid-cols-5 gap-3 items-end">
        <div className="sm:col-span-2">
          <label className="block text-xs font-medium text-gray-600 mb-1">Employee</label>
          <select
            value={form.employeeNumber}
            onChange={e => setForm(f => ({ ...f, employeeNumber: e.target.value }))}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white text-gray-900"
            required
          >
            <option value="">Select staff...</option>
            {staff.map(s => (
              <option key={s.employeeId || s.employeeNumber} value={s.employeeId || s.employeeNumber}>
                {s.firstName} {s.lastName} ({s.employeeId || s.employeeNumber})
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Amount (₦)</label>
          <input type="number" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white text-gray-900" required min="1" placeholder="0" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Name (optional)</label>
          <input type="text" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white text-gray-900" placeholder="e.g. Performance Bonus" />
        </div>
        <div>
          <button type="submit" className="w-full flex items-center justify-center gap-1.5 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium transition-colors">
            <Plus className="w-4 h-4" /> Add
          </button>
        </div>
      </form>

      {bonuses.length > 0 && (
        <div className="space-y-2">
          {bonuses.map((b, i) => (
            <div key={i} className="flex items-center justify-between bg-green-50 rounded-lg px-4 py-2.5">
              <div className="flex items-center gap-3">
                <Gift className="w-4 h-4 text-green-600" />
                <div>
                  <p className="text-sm font-medium text-gray-900">{b.employeeName || b.employeeNumber}</p>
                  <p className="text-xs text-gray-500">{b.name || 'Bonus'}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm font-bold text-green-700">+₦{(b.amount || 0).toLocaleString()}</span>
                <button onClick={() => handleDelete(b)} className="p-1 text-gray-400 hover:text-red-600 rounded">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
      {bonuses.length === 0 && !loading && (
        <p className="text-xs text-gray-400 text-center py-2">No bonuses added for this period</p>
      )}
    </div>
  );
}

// ─── Overtime Manager ───
function OvertimeManager({ period, makeRequest, onError }) {
  const [entries, setEntries] = useState([]);
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ employeeNumber: '', hours: '', type: 'weekday' });

  const fetchData = useCallback(async () => {
    if (!period) return;
    setLoading(true);
    try {
      const [otRes, staffRes] = await Promise.all([
        makeRequest(`/api/payroll/overtime/${period}`),
        makeRequest('/api/payroll/staff-setup')
      ]);
      setEntries(otRes.overtime || []);
      setStaff(staffRes.staff || staffRes);
    } catch { /* ignore */ } finally { setLoading(false); }
  }, [period, makeRequest]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!form.employeeNumber || !form.hours) return;
    try {
      await makeRequest('/api/payroll/overtime', {
        method: 'POST',
        data: { ...form, period, hours: Number(form.hours) }
      });
      setForm({ employeeNumber: '', hours: '', type: 'weekday' });
      fetchData();
    } catch (err) { onError(err.message || 'Failed to add overtime'); }
  };

  if (loading && entries.length === 0) return <p className="text-sm text-gray-500 py-2">Loading...</p>;

  return (
    <div className="space-y-4">
      <form onSubmit={handleAdd} className="grid grid-cols-1 sm:grid-cols-5 gap-3 items-end">
        <div className="sm:col-span-2">
          <label className="block text-xs font-medium text-gray-600 mb-1">Employee</label>
          <select
            value={form.employeeNumber}
            onChange={e => setForm(f => ({ ...f, employeeNumber: e.target.value }))}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white text-gray-900"
            required
          >
            <option value="">Select staff...</option>
            {staff.map(s => (
              <option key={s.employeeId || s.employeeNumber} value={s.employeeId || s.employeeNumber}>
                {s.firstName} {s.lastName} ({s.employeeId || s.employeeNumber})
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Hours</label>
          <input type="number" step="0.5" min="0.5" value={form.hours}
            onChange={e => setForm(f => ({ ...f, hours: e.target.value }))}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white text-gray-900" required placeholder="0" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Type</label>
          <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white text-gray-900">
            <option value="weekday">Weekday (1.5x)</option>
            <option value="weekend">Weekend (2x)</option>
            <option value="holiday">Holiday (2.5x)</option>
          </select>
        </div>
        <div>
          <button type="submit" className="w-full flex items-center justify-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors">
            <Plus className="w-4 h-4" /> Add
          </button>
        </div>
      </form>

      {entries.length > 0 && (
        <div className="space-y-2">
          {entries.map((e, i) => (
            <div key={i} className="flex items-center justify-between bg-blue-50 rounded-lg px-4 py-2.5">
              <div className="flex items-center gap-3">
                <Clock className="w-4 h-4 text-blue-600" />
                <div>
                  <p className="text-sm font-medium text-gray-900">{e.employeeName || e.employeeNumber}</p>
                  <p className="text-xs text-gray-500">{e.totalHours}hrs across {e.breakdown?.length || 0} entries</p>
                </div>
              </div>
              <span className="text-sm font-bold text-blue-700">+₦{(e.totalAmount || 0).toLocaleString()}</span>
            </div>
          ))}
        </div>
      )}
      {entries.length === 0 && !loading && (
        <p className="text-xs text-gray-400 text-center py-2">No overtime entries for this period</p>
      )}
    </div>
  );
}

// ─── Loan Summary (read-only snapshot for this period) ───
function LoanSummary({ makeRequest }) {
  const [loans, setLoans] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchLoans = useCallback(async () => {
    setLoading(true);
    try {
      const res = await makeRequest('/api/payroll/loans?status=active');
      setLoans(res.loans || []);
    } catch { setLoans([]); } finally { setLoading(false); }
  }, [makeRequest]);

  useEffect(() => { fetchLoans(); }, [fetchLoans]);

  if (loading) return <p className="text-sm text-gray-500 py-2">Loading loans...</p>;

  return (
    <div className="space-y-3">
      <p className="text-xs text-gray-500">
        Active loan deductions that will be applied this period. Manage full loan schedules in the <strong>Loans</strong> tab.
      </p>
      {loans.length > 0 ? (
        <div className="space-y-2">
          {loans.map(loan => (
            <div key={loan._id} className="flex items-center justify-between bg-orange-50 rounded-lg px-4 py-2.5">
              <div className="flex items-center gap-3">
                <Landmark className="w-4 h-4 text-orange-600" />
                <div>
                  <p className="text-sm font-medium text-gray-900">{loan.employeeName}</p>
                  <p className="text-xs text-gray-500">{loan.type === 'advance' ? 'Advance' : 'Loan'} — {loan.description || 'N/A'} · Bal: ₦{loan.remainingBalance?.toLocaleString()}</p>
                </div>
              </div>
              <span className="text-sm font-bold text-orange-700">-₦{loan.monthlyDeduction?.toLocaleString()}/mo</span>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs text-gray-400 text-center py-2">No active loans</p>
      )}
    </div>
  );
}

// ─── Main AdjustmentsStep ───
function AdjustmentsStep({ period, periodStatus, modules, onError, onNext, onGoToOvertimeSettings }) {
  const { makeRequest } = useTenant();

  const isPaid    = periodStatus?.status === 'paid';
  const overtimeOff = modules?.overtime === false;

  return (
    <div className="space-y-4">
      {/* Info banner */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-5">
        <div className="flex items-start gap-3">
          <div className="p-2 bg-indigo-50 rounded-lg flex-shrink-0">
            <Info className="w-5 h-5 text-indigo-600" />
          </div>
          <div>
            <h4 className="font-semibold text-gray-900 mb-1">Step 1: Review & Adjust</h4>
            <p className="text-sm text-gray-600">
              Review attendance deductions, add bonuses or overtime, and check active loan deductions before generating payroll.
              All adjustments here will be reflected in the payroll calculation.
            </p>
          </div>
        </div>
      </div>

      {isPaid ? (
        <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
          <p className="text-sm text-purple-700 font-medium">Payroll has been paid. Adjustments are locked for this period.</p>
        </div>
      ) : (
        <div className="space-y-3">
          <Section title="Deduction & Addition Preview" icon={Eye} defaultOpen={true}>
            <DeductionPreview period={period} makeRequest={makeRequest} />
          </Section>

          <Section title="One-time Bonuses" icon={Gift} defaultOpen={true}>
            <BonusManager period={period} makeRequest={makeRequest} onError={onError} />
          </Section>

          <Section title="Manual Overtime" icon={Clock} defaultOpen={!overtimeOff}>
            {overtimeOff ? (
              <div className="flex items-center gap-3 py-3 text-sm text-gray-500">
                <Lock className="w-4 h-4 text-gray-400 flex-shrink-0" />
                <span>Overtime module is disabled. Enable it in{' '}
                  {onGoToOvertimeSettings ? (
                    <button className="text-blue-600 underline hover:text-blue-700 font-medium" onClick={onGoToOvertimeSettings}>
                      Settings → Overtime
                    </button>
                  ) : <strong>Settings → Overtime</strong>}
                  {' '}to log overtime hours.</span>
              </div>
            ) : (
              <OvertimeManager period={period} makeRequest={makeRequest} onError={onError} />
            )}
          </Section>

          <Section title="Active Loan Deductions" icon={Landmark} defaultOpen={false}>
            <LoanSummary makeRequest={makeRequest} />
          </Section>
        </div>
      )}

      {/* Next step CTA */}
      <div className="flex justify-end pt-2">
        <button
          onClick={onNext}
          className="flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
        >
          Next: Generate Payroll
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

export default AdjustmentsStep;
