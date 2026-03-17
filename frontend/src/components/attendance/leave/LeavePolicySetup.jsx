// LeavePolicySetup.jsx — Configure leave type rules per policy
import React, { useState, useEffect, useCallback } from 'react';
import { useTenant } from '../../../context/TenantProvider';
import { Settings, Plus, Edit3, X, CheckCircle, AlertTriangle, RefreshCw, Sparkles, ChevronDown, ChevronUp, Save } from 'lucide-react';

const LEAVE_TYPE_LABELS = {
  annual:        'Annual Leave',
  sick:          'Sick Leave',
  maternity:     'Maternity Leave',
  paternity:     'Paternity Leave',
  casual:        'Casual / Emergency Leave',
  emergency:     'Emergency Leave',
  compassionate: 'Compassionate / Bereavement Leave',
  study:         'Study / Exam Leave',
  unpaid:        'Unpaid Leave',
  other:         'Other Leave',
};
const LEAVE_TYPE_OPTIONS = Object.entries(LEAVE_TYPE_LABELS).map(([value, label]) => ({ value, label }));
const ACCRUAL_LABELS    = { upfront: 'Upfront (all on Jan 1)', monthly: 'Monthly (1/12 per month)' };
const CARRYOVER_LABELS  = { none: 'No carryover', limited: 'Limited carryover', unlimited: 'Unlimited carryover' };
const GENDER_LABELS     = { none: 'All employees', male: 'Male only', female: 'Female only' };

const POLICY_THEME = {
  annual:        { accent: 'bg-blue-500',    card: 'border-blue-200 bg-blue-50/30',     badge: 'bg-blue-100 text-blue-700' },
  sick:          { accent: 'bg-red-500',     card: 'border-red-200 bg-red-50/30',       badge: 'bg-red-100 text-red-700' },
  maternity:     { accent: 'bg-pink-500',    card: 'border-pink-200 bg-pink-50/30',     badge: 'bg-pink-100 text-pink-700' },
  paternity:     { accent: 'bg-indigo-500',  card: 'border-indigo-200 bg-indigo-50/30', badge: 'bg-indigo-100 text-indigo-700' },
  casual:        { accent: 'bg-yellow-500',  card: 'border-yellow-200 bg-yellow-50/30', badge: 'bg-yellow-100 text-yellow-700' },
  emergency:     { accent: 'bg-orange-500',  card: 'border-orange-200 bg-orange-50/30', badge: 'bg-orange-100 text-orange-700' },
  compassionate: { accent: 'bg-purple-500',  card: 'border-purple-200 bg-purple-50/30', badge: 'bg-purple-100 text-purple-700' },
  study:         { accent: 'bg-teal-500',    card: 'border-teal-200 bg-teal-50/30',     badge: 'bg-teal-100 text-teal-700' },
  unpaid:        { accent: 'bg-gray-400',    card: 'border-gray-200 bg-gray-50/30',     badge: 'bg-gray-100 text-gray-600' },
  other:         { accent: 'bg-gray-400',    card: 'border-gray-200 bg-gray-50/30',     badge: 'bg-gray-100 text-gray-600' },
};
const getTheme = (type) => POLICY_THEME[type] || POLICY_THEME.other;

const EMPTY_FORM = {
  leaveType: 'annual', name: '', entitlementDays: 20, accrualMethod: 'upfront',
  carryoverPolicy: 'none', carryoverMaxDays: 0, carryoverExpiry: '',
  minNoticeDays: 0, maxConsecutiveDays: 0, genderRestriction: 'none',
  isPaid: true, requiresCertificate: false, certificateRequiredAfterDays: 3,
  proRatedForNewHires: true, isActive: true,
};

function PolicyForm({ initial, onSave, onCancel, isEdit }) {
  const [form, setForm] = useState(initial || EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const set = (field, val) => setForm(f => ({ ...f, [field]: val }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try { await onSave(form); } finally { setSaving(false); }
  };

  const handleTypeChange = (type) => {
    set('leaveType', type);
    if (!isEdit && !form.name) set('name', LEAVE_TYPE_LABELS[type] || '');
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {!isEdit && (
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Leave Type <span className="text-red-500">*</span></label>
            <select value={form.leaveType} onChange={e => handleTypeChange(e.target.value)}
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500" required>
              {LEAVE_TYPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
        )}
        <div className={isEdit ? 'sm:col-span-2' : ''}>
          <label className="block text-sm font-semibold text-gray-700 mb-1.5">Display Name <span className="text-red-500">*</span></label>
          <input type="text" value={form.name} onChange={e => set('name', e.target.value)}
            className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
            placeholder="e.g. Annual Leave" required />
        </div>
      </div>

      {/* Entitlement */}
      <div className="bg-gray-50 rounded-xl p-4 space-y-4 border border-gray-100">
        <h5 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
          <span className="w-1.5 h-4 bg-blue-500 rounded-full inline-block" />Entitlement
        </h5>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1.5">
              Days per year <span className="text-xs text-gray-400">(0 = unlimited for unpaid)</span>
            </label>
            <input type="number" min="0" value={form.entitlementDays} onChange={e => set('entitlementDays', +e.target.value)}
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1.5">Accrual method</label>
            <select value={form.accrualMethod} onChange={e => set('accrualMethod', e.target.value)}
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500">
              {Object.entries(ACCRUAL_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* Carryover */}
      <div className="bg-gray-50 rounded-xl p-4 space-y-4 border border-gray-100">
        <h5 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
          <span className="w-1.5 h-4 bg-green-500 rounded-full inline-block" />Carryover
        </h5>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1.5">Carryover policy</label>
            <select value={form.carryoverPolicy} onChange={e => set('carryoverPolicy', e.target.value)}
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500">
              {Object.entries(CARRYOVER_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
          {form.carryoverPolicy === 'limited' && (
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1.5">Max carryover days</label>
              <input type="number" min="0" value={form.carryoverMaxDays} onChange={e => set('carryoverMaxDays', +e.target.value)}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500" />
            </div>
          )}
          {form.carryoverPolicy !== 'none' && (
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1.5">
                Expiry date <span className="text-xs text-gray-400">(MM-DD, e.g. 03-31)</span>
              </label>
              <input type="text" value={form.carryoverExpiry} onChange={e => set('carryoverExpiry', e.target.value)}
                placeholder="03-31" maxLength={5}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500" />
            </div>
          )}
        </div>
      </div>

      {/* Rules */}
      <div className="bg-gray-50 rounded-xl p-4 space-y-4 border border-gray-100">
        <h5 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
          <span className="w-1.5 h-4 bg-orange-500 rounded-full inline-block" />Application Rules
        </h5>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1.5">Minimum notice (days)</label>
            <input type="number" min="0" value={form.minNoticeDays} onChange={e => set('minNoticeDays', +e.target.value)}
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1.5">
              Max consecutive days <span className="text-xs text-gray-400">(0 = unlimited)</span>
            </label>
            <input type="number" min="0" value={form.maxConsecutiveDays} onChange={e => set('maxConsecutiveDays', +e.target.value)}
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1.5">Eligible employees</label>
            <select value={form.genderRestriction} onChange={e => set('genderRestriction', e.target.value)}
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500">
              {Object.entries(GENDER_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
        </div>

        {/* Toggles */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
          {[
            { field: 'isPaid', label: 'Paid leave', desc: 'Salary paid during leave period' },
            { field: 'requiresCertificate', label: 'Certificate required', desc: 'Medical/supporting doc needed' },
            { field: 'proRatedForNewHires', label: 'Pro-rate for new hires', desc: 'Proportion days in first year' },
            { field: 'isActive', label: 'Policy active', desc: 'Employees can apply for this type' },
          ].map(({ field, label, desc }) => (
            <label key={field} className="flex items-start gap-3 p-3 bg-white rounded-lg border border-gray-200 cursor-pointer hover:bg-gray-50">
              <input type="checkbox" checked={!!form[field]} onChange={e => set(field, e.target.checked)}
                className="mt-0.5 accent-blue-600 w-4 h-4 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-gray-900">{label}</p>
                <p className="text-xs text-gray-500">{desc}</p>
              </div>
            </label>
          ))}
        </div>

        {form.requiresCertificate && (
          <div className="sm:w-1/2">
            <label className="block text-sm font-medium text-gray-600 mb-1.5">
              Certificate required after (days)
            </label>
            <input type="number" min="1" value={form.certificateRequiredAfterDays}
              onChange={e => set('certificateRequiredAfterDays', +e.target.value)}
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500" />
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-3 pt-2">
        <button type="submit" disabled={saving}
          className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold disabled:opacity-50 transition-colors">
          <Save className="w-4 h-4" />
          {saving ? 'Saving…' : isEdit ? 'Update Policy' : 'Create Policy'}
        </button>
        <button type="button" onClick={onCancel}
          className="px-5 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm font-medium transition-colors">
          Cancel
        </button>
      </div>
    </form>
  );
}

function PolicyCard({ policy, onEdit, onDelete }) {
  const [expanded, setExpanded] = useState(false);
  const theme = getTheme(policy.leaveType);

  return (
    <div className={`rounded-xl border-2 overflow-hidden ${theme.card}`}>
      <button onClick={() => setExpanded(p => !p)}
        className="w-full px-4 py-3 flex items-center gap-3 text-left hover:brightness-95 transition-all">
        <span className={`w-3 h-3 rounded-full flex-shrink-0 ${theme.accent}`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-gray-900 text-sm">{policy.name}</span>
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${theme.badge}`}>
              {LEAVE_TYPE_LABELS[policy.leaveType] || policy.leaveType}
            </span>
            {!policy.isActive && (
              <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-500">Inactive</span>
            )}
          </div>
          <div className="flex flex-wrap gap-3 mt-1 text-xs text-gray-500">
            <span>{policy.entitlementDays === 0 ? 'Unlimited' : `${policy.entitlementDays} days/yr`}</span>
            <span>{ACCRUAL_LABELS[policy.accrualMethod] || policy.accrualMethod}</span>
            <span>{policy.isPaid ? 'Paid' : 'Unpaid'}</span>
            <span>{CARRYOVER_LABELS[policy.carryoverPolicy] || policy.carryoverPolicy}</span>
          </div>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <button onClick={e => { e.stopPropagation(); onEdit(policy); }}
            className="p-1.5 text-blue-600 hover:bg-blue-100 rounded-lg transition-colors" title="Edit">
            <Edit3 className="w-3.5 h-3.5" />
          </button>
          <button onClick={e => { e.stopPropagation(); if (window.confirm('Delete this policy?')) onDelete(policy._id); }}
            className="p-1.5 text-red-500 hover:bg-red-100 rounded-lg transition-colors" title="Delete">
            <X className="w-3.5 h-3.5" />
          </button>
          {expanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
        </div>
      </button>

      {expanded && (
        <div className="px-4 pb-4 pt-1 border-t border-gray-200/60 bg-white/50">
          <dl className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-2 text-sm">
            {[
              ['Notice', `${policy.minNoticeDays} day(s)`],
              ['Max consecutive', policy.maxConsecutiveDays === 0 ? 'Unlimited' : `${policy.maxConsecutiveDays} days`],
              ['Eligible', GENDER_LABELS[policy.genderRestriction] || 'All'],
              ['Carryover', CARRYOVER_LABELS[policy.carryoverPolicy] || policy.carryoverPolicy],
              ['Certificate', policy.requiresCertificate ? `After ${policy.certificateRequiredAfterDays} days` : 'Not required'],
              ['New-hire pro-rate', policy.proRatedForNewHires ? 'Yes' : 'No'],
            ].map(([k, v]) => (
              <div key={k}>
                <dt className="text-xs text-gray-500">{k}</dt>
                <dd className="font-medium text-gray-900">{v}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}
    </div>
  );
}

export default function LeavePolicySetup() {
  const { makeRequest } = useTenant();
  const [policies, setPolicies]   = useState([]);
  const [loading, setLoading]     = useState(true);
  const [saving, setSaving]       = useState(false);
  const [seeding, setSeeding]     = useState(false);
  const [error, setError]         = useState('');
  const [success, setSuccess]     = useState('');
  const [showForm, setShowForm]   = useState(false);
  const [editingPolicy, setEditingPolicy] = useState(null);

  const fetchPolicies = useCallback(async () => {
    try {
      setLoading(true);
      const res = await makeRequest('/api/attendance/leave-policies');
      setPolicies(res.policies || res || []);
    } catch (err) {
      setError(err.message || 'Failed to load policies');
    } finally {
      setLoading(false);
    }
  }, [makeRequest]);

  useEffect(() => { fetchPolicies(); }, [fetchPolicies]);

  const flash = (msg, isError = false) => {
    if (isError) { setError(msg); setTimeout(() => setError(''), 4000); }
    else { setSuccess(msg); setTimeout(() => setSuccess(''), 4000); }
  };

  const handleSave = async (form) => {
    try {
      if (editingPolicy) {
        await makeRequest(`/api/attendance/leave-policies/${editingPolicy._id}`, {
          method: 'PUT', body: JSON.stringify(form),
        });
        flash('Policy updated');
      } else {
        await makeRequest('/api/attendance/leave-policies', {
          method: 'POST', body: JSON.stringify(form),
        });
        flash('Policy created');
      }
      setShowForm(false);
      setEditingPolicy(null);
      fetchPolicies();
    } catch (err) {
      flash(err.message || 'Failed to save policy', true);
      throw err;
    }
  };

  const handleEdit = (policy) => {
    setEditingPolicy(policy);
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (id) => {
    try {
      await makeRequest(`/api/attendance/leave-policies/${id}`, { method: 'DELETE' });
      flash('Policy deleted');
      fetchPolicies();
    } catch (err) {
      flash(err.message || 'Failed to delete', true);
    }
  };

  const handleSeedDefaults = async () => {
    if (!window.confirm('Seed default leave policies? This will create standard policies that don\'t already exist.')) return;
    try {
      setSeeding(true);
      const res = await makeRequest('/api/attendance/leave-policies/seed-defaults', { method: 'POST', body: JSON.stringify({}) });
      flash(`Created ${res.created || 0} default policies`);
      fetchPolicies();
    } catch (err) {
      flash(err.message || 'Seed failed', true);
    } finally {
      setSeeding(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <Settings className="w-5 h-5 text-gray-500" /> Leave Policies
          </h3>
          <p className="text-sm text-gray-500 mt-0.5">Configure entitlement, accrual, and carryover rules per leave type</p>
        </div>
        <div className="flex gap-2 flex-shrink-0">
          {policies.length === 0 && !loading && (
            <button onClick={handleSeedDefaults} disabled={seeding}
              className="flex items-center gap-2 px-4 py-2 bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 rounded-lg text-sm font-medium disabled:opacity-50 transition-colors">
              <Sparkles className="w-4 h-4" />
              {seeding ? 'Seeding…' : 'Seed Defaults'}
            </button>
          )}
          <button onClick={() => { fetchPolicies(); }}
            className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors" title="Refresh">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button onClick={() => { setEditingPolicy(null); setShowForm(true); }}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold transition-colors">
            <Plus className="w-4 h-4" /> Add Policy
          </button>
        </div>
      </div>

      {/* Alerts */}
      {error   && <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700"><AlertTriangle className="w-4 h-4 flex-shrink-0" />{error}</div>}
      {success && <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700"><CheckCircle className="w-4 h-4 flex-shrink-0" />{success}</div>}

      {/* Form Panel */}
      {showForm && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <h4 className="font-semibold text-gray-900">{editingPolicy ? 'Edit Policy' : 'New Policy'}</h4>
            <button onClick={() => { setShowForm(false); setEditingPolicy(null); }}
              className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg">
              <X className="w-4 h-4" />
            </button>
          </div>
          <PolicyForm
            initial={editingPolicy || undefined}
            isEdit={!!editingPolicy}
            onSave={handleSave}
            onCancel={() => { setShowForm(false); setEditingPolicy(null); }}
          />
        </div>
      )}

      {/* Policy List */}
      {loading ? (
        <div className="space-y-3">
          {[1,2,3].map(i => (
            <div key={i} className="h-16 bg-gray-100 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : policies.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border border-dashed border-gray-300">
          <Settings className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <h4 className="text-base font-semibold text-gray-600 mb-1">No policies configured</h4>
          <p className="text-sm text-gray-400 mb-4">Click "Seed Defaults" to create standard leave types, or "Add Policy" to create a custom one.</p>
          <button onClick={handleSeedDefaults} disabled={seeding}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-semibold disabled:opacity-50 transition-colors">
            <Sparkles className="w-4 h-4" />
            {seeding ? 'Seeding…' : 'Seed Default Policies'}
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {policies.map(p => (
            <PolicyCard key={p._id} policy={p} onEdit={handleEdit} onDelete={handleDelete} />
          ))}
        </div>
      )}
    </div>
  );
}
