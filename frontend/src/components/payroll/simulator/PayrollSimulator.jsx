// PayrollSimulator.jsx
// WYSIWYG payroll calculator — calls the real backend engine, no DB writes.
// Results are ALWAYS 100% consistent with what Generate Payroll produces.

import React, { useState, useCallback } from 'react';
import { useTenant } from '../../../context/TenantProvider.jsx';
import {
  Calculator,
  Plus,
  Trash2,
  RefreshCw,
  ChevronDown,
  ChevronRight,
  Info,
  AlertCircle
} from 'lucide-react';

// ─── helpers ────────────────────────────────────────────────────────────────

const fmt = (n) =>
  '₦' + Math.round(n || 0).toLocaleString('en-NG');

function Field({ label, hint, children }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label}
        {hint && (
          <span className="ml-1 text-gray-400 text-xs font-normal">({hint})</span>
        )}
      </label>
      {children}
    </div>
  );
}

function NumberInput({ value, onChange, min = 0, placeholder = '0' }) {
  return (
    <input
      type="number"
      min={min}
      value={value}
      onChange={(e) => onChange(Number(e.target.value) || 0)}
      placeholder={placeholder}
      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
    />
  );
}

function SectionCard({ title, children, defaultOpen = true, collapsible = true }) {
  const [open, setOpen] = useState(defaultOpen);
  const HeaderTag = collapsible ? 'button' : 'div';
  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <HeaderTag
        {...(collapsible ? { onClick: () => setOpen(!open) } : {})}
        className={`w-full flex items-center justify-between px-4 py-3 bg-gray-50 transition-colors text-left${collapsible ? ' hover:bg-gray-100' : ''}`}
      >
        <span className="text-sm font-semibold text-gray-700">{title}</span>
        {collapsible && (open ? <ChevronDown className="w-4 h-4 text-gray-500" /> : <ChevronRight className="w-4 h-4 text-gray-500" />)}
      </HeaderTag>
      {(!collapsible || open) && <div className="p-4 space-y-3">{children}</div>}
    </div>
  );
}

// ─── result helpers ──────────────────────────────────────────────────────────

function ResultRow({ label, amount, highlight = false, negative = false, indent = false }) {
  return (
    <div className={`flex justify-between items-center py-1.5 ${indent ? 'pl-4' : ''} ${highlight ? 'font-semibold' : ''}`}>
      <span className={`text-sm ${highlight ? 'text-gray-900' : 'text-gray-600'}`}>{label}</span>
      <span className={`text-sm font-medium ${negative ? 'text-red-600' : highlight ? 'text-gray-900' : 'text-gray-800'}`}>
        {negative && amount > 0 ? '−' : ''}{fmt(amount)}
      </span>
    </div>
  );
}

function Divider() {
  return <div className="border-t border-gray-200 my-1" />;
}

// ─── ALLOWANCE_DEFAULTS ──────────────────────────────────────────────────────

const ALLOWANCE_PRESETS = [
  { code: 'HOUSING',   name: 'Housing Allowance'   },
  { code: 'TRANSPORT', name: 'Transport Allowance'  },
  { code: 'MEAL',      name: 'Meal Allowance'       },
  { code: 'UTILITY',   name: 'Utility Allowance'    },
  { code: 'MEDICAL',   name: 'Medical Allowance'    },
  { code: 'OTHER',     name: 'Other Allowance'      },
];

// ─── Main component ──────────────────────────────────────────────────────────

export default function PayrollSimulator() {
  const { makeRequest } = useTenant();

  // ── inputs ──
  const [baseSalary, setBaseSalary] = useState(300000);
  const [allowances, setAllowances] = useState([
    { code: 'HOUSING', name: 'Housing Allowance', amount: 90000 },
    { code: 'TRANSPORT', name: 'Transport Allowance', amount: 45000 },
  ]);
  const [lateDays, setLateDays] = useState([]);       // [{ minutes }]
  const [earlyLeaveDays, setEarlyLeaveDays] = useState([]);
  const [absentDays, setAbsentDays] = useState(0);
  const [workingDays, setWorkingDays] = useState(26);
  const [exemptions, setExemptions] = useState({ paye: false, pension: false, nhf: false, nhis: false });

  // ── state ──
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [payeExpanded, setPayeExpanded] = useState(false);

  // ── compute ──
  const handleSimulate = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await makeRequest('/api/payroll/simulate', {
        method: 'POST',
        body: JSON.stringify({
          baseSalary,
          allowances: allowances.filter(a => a.amount > 0),
          lateDays,
          earlyLeaveDays,
          absentDays,
          workingDays,
          exemptions
        })
      });
      setResult(res);
    } catch (e) {
      setError(e.message || 'Simulation failed');
    } finally {
      setLoading(false);
    }
  }, [makeRequest, baseSalary, allowances, lateDays, earlyLeaveDays, absentDays, workingDays, exemptions]);

  // ── allowance CRUD ──
  const addAllowance = () => {
    const used = new Set(allowances.map(a => a.code));
    const next = ALLOWANCE_PRESETS.find(p => !used.has(p.code)) || { code: `CUSTOM_${Date.now()}`, name: 'Custom Allowance' };
    setAllowances(prev => [...prev, { ...next, amount: 0 }]);
  };

  const updateAllowance = (idx, field, value) => {
    setAllowances(prev => prev.map((a, i) => i === idx ? { ...a, [field]: value } : a));
  };

  const removeAllowance = (idx) => {
    setAllowances(prev => prev.filter((_, i) => i !== idx));
  };

  // ── late days CRUD ──
  const addLateDay = () => setLateDays(prev => [...prev, { minutes: 35 }]);
  const updateLateDay = (idx, minutes) => setLateDays(prev => prev.map((d, i) => i === idx ? { minutes } : d));
  const removeLateDay = (idx) => setLateDays(prev => prev.filter((_, i) => i !== idx));

  const addEarlyLeaveDay = () => setEarlyLeaveDays(prev => [...prev, { minutes: 30 }]);
  const updateEarlyLeaveDay = (idx, minutes) => setEarlyLeaveDays(prev => prev.map((d, i) => i === idx ? { minutes } : d));
  const removeEarlyLeaveDay = (idx) => setEarlyLeaveDays(prev => prev.filter((_, i) => i !== idx));

  const grossPreview = baseSalary + allowances.reduce((s, a) => s + (a.amount || 0), 0);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

      {/* ── LEFT PANEL: Inputs ── */}
      <div className="space-y-4">

        {/* Info banner */}
        <div className="flex items-start gap-3 bg-blue-50 border border-blue-200 rounded-xl px-4 py-3">
          <Info className="w-4 h-4 text-blue-500 mt-0.5 shrink-0" />
          <p className="text-xs text-blue-700">
            This is a <strong>calculation preview</strong> — nothing is saved. Results are based on your saved payroll settings (NTA 2025 tax bands, pension rates, etc.) and will match exactly what Generate Payroll produces.
          </p>
        </div>

        {/* Earnings */}
        <SectionCard title="Earnings">
          <Field label="Base Salary" hint="monthly">
            <NumberInput value={baseSalary} onChange={setBaseSalary} />
          </Field>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-700">Allowances</span>
              <button
                onClick={addAllowance}
                className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700"
              >
                <Plus className="w-3 h-3" /> Add
              </button>
            </div>

            {allowances.map((a, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <input
                  type="text"
                  value={a.name}
                  onChange={(e) => updateAllowance(idx, 'name', e.target.value)}
                  className="flex-1 px-2 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Allowance name"
                />
                <input
                  type="number"
                  min={0}
                  value={a.amount}
                  onChange={(e) => updateAllowance(idx, 'amount', Number(e.target.value) || 0)}
                  className="w-32 px-2 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="0"
                />
                <button onClick={() => removeAllowance(idx)} className="text-red-400 hover:text-red-600">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>

          <div className="flex justify-between pt-1 border-t border-gray-100 text-sm font-semibold text-gray-800">
            <span>Gross Monthly</span>
            <span>{fmt(grossPreview)}</span>
          </div>
        </SectionCard>

        {/* Attendance / Deductions */}
        <SectionCard title="Deductions: Attendance & Absences" defaultOpen={false}>
          <Field label="Working Days This Month">
            <NumberInput value={workingDays} onChange={setWorkingDays} min={1} />
          </Field>

          <Field label="Absent Days (full day)">
            <NumberInput value={absentDays} onChange={setAbsentDays} />
          </Field>

          {/* Late days */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-700">Late Arrivals</span>
              <button onClick={addLateDay} className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700">
                <Plus className="w-3 h-3" /> Add day
              </button>
            </div>
            {lateDays.map((d, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <span className="text-xs text-gray-500 w-16">Day {idx + 1}</span>
                <input
                  type="number"
                  min={1}
                  value={d.minutes}
                  onChange={(e) => updateLateDay(idx, Number(e.target.value) || 0)}
                  className="flex-1 px-2 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <span className="text-xs text-gray-500">min late</span>
                <button onClick={() => removeLateDay(idx)} className="text-red-400 hover:text-red-600">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>

          {/* Early leave days */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-700">Early Departures</span>
              <button onClick={addEarlyLeaveDay} className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700">
                <Plus className="w-3 h-3" /> Add day
              </button>
            </div>
            {earlyLeaveDays.map((d, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <span className="text-xs text-gray-500 w-16">Day {idx + 1}</span>
                <input
                  type="number"
                  min={1}
                  value={d.minutes}
                  onChange={(e) => updateEarlyLeaveDay(idx, Number(e.target.value) || 0)}
                  className="flex-1 px-2 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <span className="text-xs text-gray-500">min early</span>
                <button onClick={() => removeEarlyLeaveDay(idx)} className="text-red-400 hover:text-red-600">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </SectionCard>

        {/* Exemptions */}
        <SectionCard title="Statutory Exemptions" defaultOpen={false}>
          {[
            { key: 'paye',    label: 'PAYE exempt'    },
            { key: 'pension', label: 'Pension exempt'  },
            { key: 'nhf',     label: 'NHF exempt'      },
            { key: 'nhis',    label: 'NHIS exempt'     },
          ].map(({ key, label }) => (
            <label key={key} className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={exemptions[key] || false}
                onChange={(e) => setExemptions(prev => ({ ...prev, [key]: e.target.checked }))}
                className="w-4 h-4 rounded border-gray-300 text-blue-600"
              />
              <span className="text-sm text-gray-700">{label}</span>
            </label>
          ))}
        </SectionCard>

        {/* Calculate button */}
        <button
          onClick={handleSimulate}
          disabled={loading || baseSalary <= 0}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? (
            <><RefreshCw className="w-4 h-4 animate-spin" /> Calculating…</>
          ) : (
            <><Calculator className="w-4 h-4" /> Calculate Payslip</>
          )}
        </button>

        {error && (
          <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-red-700 text-sm">
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
            {error}
          </div>
        )}
      </div>

      {/* ── RIGHT PANEL: Results ── */}
      <div>
        {!result ? (
          <div className="bg-white rounded-xl border border-gray-200 border-dashed flex flex-col items-center justify-center py-20 text-center">
            <Calculator className="w-12 h-12 text-gray-300 mb-3" />
            <p className="text-gray-500 text-sm">Enter salary details and click</p>
            <p className="text-gray-400 text-sm font-medium mt-1">Calculate Payslip</p>
          </div>
        ) : (
          <div className="space-y-4">

            {/* Payslip card */}
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">

              {/* Header */}
              <div className="bg-blue-600 px-5 py-4">
                <p className="text-white font-bold text-base">Estimated Net Pay Breakdown</p>
                <p className="text-blue-200 text-xs mt-0.5">Preview only — uses your saved payroll settings · Nothing is saved</p>
              </div>

              <div className="px-5 py-4 space-y-1">

                {/* Earnings */}
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-1">Earnings</p>
                <ResultRow label="Base Salary" amount={result.earnings.baseSalary} />
                {(result.earnings.allowances || []).length > 0 && (
                  <>
                    <div className="pl-4 space-y-0.5">
                      {(result.earnings.allowances || []).map((a, i) => (
                        <ResultRow key={i} label={a.name || a.code} amount={a.amount} indent />
                      ))}
                    </div>
                    <ResultRow
                      label="Total Allowances"
                      amount={(result.earnings.allowances || []).reduce((s, a) => s + (a.amount || 0), 0)}
                    />
                  </>
                )}
                <Divider />
                <ResultRow label="Gross Monthly" amount={result.earnings.grossMonthly} highlight />
                <ResultRow label="Annual Gross" amount={result.earnings.annualGross} />

                {/* Statutory deductions */}
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-1 mt-3">Statutory Deductions</p>

                {/* PAYE with expandable breakdown */}
                <div>
                  <div
                    className="flex justify-between items-center py-1.5 cursor-pointer"
                    onClick={() => setPayeExpanded(!payeExpanded)}
                  >
                    <span className="flex items-center gap-1 text-sm text-gray-600">
                      PAYE Tax
                      <span className="text-xs text-blue-500">{payeExpanded ? '▲' : '▼'}</span>
                    </span>
                    <span className="text-sm font-medium text-red-600">
                      −{fmt(result.statutoryDeductions.paye.monthlyAmount)}
                    </span>
                  </div>
                  {payeExpanded && result.statutoryDeductions.paye.details && (
                    <div className="ml-4 mb-1 bg-gray-50 rounded-lg px-3 py-2 text-xs text-gray-600 space-y-1">
                      <div className="flex justify-between">
                        <span>Annual Gross</span>
                        <span>{fmt(result.statutoryDeductions.paye.details.annualGross)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Pre-Tax Deductions</span>
                        <span>−{fmt(result.statutoryDeductions.paye.details.preTaxDeductions?.total)}</span>
                      </div>
                      <div className="flex justify-between font-medium text-gray-700">
                        <span>Taxable Income</span>
                        <span>{fmt(result.statutoryDeductions.paye.details.taxableIncome)}</span>
                      </div>
                      {(result.statutoryDeductions.paye.details.brackets || []).map((b, i) => (
                        <div key={i} className="flex justify-between text-gray-500">
                          <span>{b.rate}% on {fmt(b.taxableAmount)}</span>
                          <span>{fmt(b.tax)}</span>
                        </div>
                      ))}
                      <div className="border-t pt-1 flex justify-between font-medium">
                        <span>Annual PAYE</span>
                        <span>{fmt(result.statutoryDeductions.paye.annualAmount)}</span>
                      </div>
                      <div className="flex justify-between font-medium text-red-600">
                        <span>Monthly PAYE</span>
                        <span>{fmt(result.statutoryDeductions.paye.monthlyAmount)}</span>
                      </div>
                    </div>
                  )}
                </div>

                <ResultRow label="Pension (Employee 8%)" amount={result.statutoryDeductions.pension.employeeAmount} negative />
                <ResultRow label="NHF (2.5% basic)" amount={result.statutoryDeductions.nhf.amount} negative />
                {result.statutoryDeductions.nhis.employeeAmount > 0 && (
                  <ResultRow label="NHIS (Employee 5%)" amount={result.statutoryDeductions.nhis.employeeAmount} negative />
                )}
                <Divider />
                <ResultRow label="Total Statutory" amount={result.statutoryDeductions.totalStatutory} negative highlight />

                {/* Attendance deductions */}
                {result.attendanceDeductions.totalAttendance > 0 && (
                  <>
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-1 mt-3">Attendance &amp; Absence Deductions</p>
                    {result.attendanceDeductions.lateness.totalAmount > 0 && (
                      <ResultRow
                        label={`Late Arrival Deductions (${result.attendanceDeductions.lateness.days} day${result.attendanceDeductions.lateness.days !== 1 ? 's' : ''})`}
                        amount={result.attendanceDeductions.lateness.totalAmount}
                        negative
                      />
                    )}
                    {result.attendanceDeductions.earlyLeave.totalAmount > 0 && (
                      <ResultRow
                        label={`Early Departure Deductions (${result.attendanceDeductions.earlyLeave.days} day${result.attendanceDeductions.earlyLeave.days !== 1 ? 's' : ''})`}
                        amount={result.attendanceDeductions.earlyLeave.totalAmount}
                        negative
                      />
                    )}
                    {result.attendanceDeductions.absence.totalAmount > 0 && (
                      <ResultRow
                        label={`Absence Deductions (${result.attendanceDeductions.absence.days} day${result.attendanceDeductions.absence.days !== 1 ? 's' : ''})`}
                        amount={result.attendanceDeductions.absence.totalAmount}
                        negative
                      />
                    )}
                    <Divider />
                    <ResultRow label="Total Attendance &amp; Absence Deductions" amount={result.attendanceDeductions.totalAttendance} negative highlight />
                  </>
                )}

                {/* Grand totals */}
                <div className="mt-3 pt-3 border-t-2 border-gray-200 space-y-1">
                  <ResultRow label="Total Deductions" amount={result.summary.totalDeductions} negative highlight />
                </div>

                {/* Net Pay */}
                <div className="mt-3 bg-green-50 border border-green-200 rounded-xl px-4 py-3 flex justify-between items-center">
                  <span className="font-bold text-green-800 text-base">NET PAY</span>
                  <span className="font-bold text-green-700 text-xl">{fmt(result.summary.netPay)}</span>
                </div>
              </div>
            </div>

            {/* Employer cost card */}
            <div className="bg-white rounded-xl border border-gray-200 px-5 py-4">
              <p className="text-sm font-semibold text-gray-700 mb-3">Employer Total Cost</p>
              <ResultRow label="Gross Paid to Staff" amount={result.summary.grossMonthly} />
              <ResultRow label="Employer Pension (10%)" amount={result.summary.employerContributions.pension} />
              {result.summary.employerContributions.nhis > 0 && (
                <ResultRow label="NHIS (Employer 10%)" amount={result.summary.employerContributions.nhis} />
              )}
              <ResultRow label="ITF (1% of gross)" amount={result.summary.employerContributions.itf} />
              <Divider />
              <ResultRow label="Total Employer Cost" amount={result.summary.totalEmployerCost} highlight />
            </div>

          </div>
        )}
      </div>
    </div>
  );
}
