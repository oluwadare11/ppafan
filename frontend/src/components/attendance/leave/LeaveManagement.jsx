// LeaveManagement.jsx — Full leave management: Requests | Policy Setup | Balances
import React, { useState, useEffect, useCallback } from 'react';
import { FaCalendarAlt, FaPlus, FaCheck, FaTimes, FaEdit, FaTrash, FaClipboardList, FaCog, FaChartBar, FaFileExcel, FaFilePdf } from 'react-icons/fa';
import { AlertTriangle, Info, ChevronDown, ChevronUp, RefreshCw } from 'lucide-react';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { useTenant } from '../../../context/TenantProvider';
import LeavePolicySetup from './LeavePolicySetup';
import LeaveBalancesTab from './LeaveBalancesTab';

const LEAVE_TYPE_LABELS = {
  annual: 'Annual', sick: 'Sick', maternity: 'Maternity', paternity: 'Paternity',
  casual: 'Casual', emergency: 'Emergency', unpaid: 'Unpaid', other: 'Other',
};

const LEAVE_TYPES = [
  { value: 'annual', label: 'Annual Leave' },
  { value: 'sick', label: 'Sick Leave' },
  { value: 'maternity', label: 'Maternity Leave' },
  { value: 'paternity', label: 'Paternity Leave' },
  { value: 'casual', label: 'Casual Leave' },
  { value: 'emergency', label: 'Emergency Leave' },
  { value: 'unpaid', label: 'Unpaid Leave' },
  { value: 'other', label: 'Other' },
];

const STATUS_COLORS = {
  approved: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
  pending:  'bg-yellow-100 text-yellow-800',
};

const EMPTY_FORM = { employeeId: '', leaveType: 'annual', startDate: '', endDate: '', reason: '' };

// ── Export helpers ────────────────────────────────────────────────────────────
function exportXLSX(requests) {
  if (!requests?.length) return;
  const headers = ['Employee ID', 'Name', 'Type', 'Start', 'End', 'Days', 'Status', 'Reason', 'Actioned By'];
  const rows = requests.map(r => {
    const s = new Date(r.startDate), e = new Date(r.endDate);
    const days = Math.ceil((e - s) / 86400000) + 1;
    return [
      r.employeeId || '', r.staffName || '',
      LEAVE_TYPE_LABELS[r.leaveType] || r.leaveType || '',
      s.toLocaleDateString('en-GB'), e.toLocaleDateString('en-GB'), days,
      r.status || 'pending', r.reason || '', r.approvedBy || '',
    ];
  });
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  ws['!cols'] = [12, 24, 14, 12, 12, 6, 10, 40, 20].map(w => ({ wch: w }));
  XLSX.utils.book_append_sheet(wb, ws, 'Leave Requests');
  XLSX.writeFile(wb, `Leave-Report-${new Date().toISOString().slice(0, 10)}.xlsx`);
}

function exportPDF(requests) {
  if (!requests?.length) return;
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const PW = doc.internal.pageSize.getWidth();
  const PH = doc.internal.pageSize.getHeight();
  const NAVY = [30, 58, 95], WHITE = [255, 255, 255];
  doc.setFillColor(...NAVY); doc.rect(0, 0, PW, 22, 'F');
  doc.setFontSize(16); doc.setTextColor(...WHITE); doc.setFont('helvetica', 'bold');
  doc.text('LEAVE REPORT', 14, 10);
  doc.setFontSize(8); doc.setFont('helvetica', 'normal');
  doc.text(`Generated: ${new Date().toLocaleDateString('en-GB')}`, PW - 14, 10, { align: 'right' });
  doc.text(`Total Requests: ${requests.length}`, PW - 14, 17, { align: 'right' });
  const counts = {
    total: requests.length,
    pending:  requests.filter(r => !r.status || r.status === 'pending').length,
    approved: requests.filter(r => r.status === 'approved').length,
    rejected: requests.filter(r => r.status === 'rejected').length,
  };
  const cards = [
    { label: 'Total', value: counts.total, color: [37, 99, 235] },
    { label: 'Pending', value: counts.pending, color: [217, 119, 6] },
    { label: 'Approved', value: counts.approved, color: [5, 150, 105] },
    { label: 'Rejected', value: counts.rejected, color: [220, 38, 38] },
  ];
  const cW = (PW - 28 - 9) / 4;
  cards.forEach((c, i) => {
    const x = 14 + i * (cW + 3);
    doc.setFillColor(...c.color); doc.roundedRect(x, 26, cW, 16, 2, 2, 'F');
    doc.setTextColor(...WHITE); doc.setFontSize(14); doc.setFont('helvetica', 'bold');
    doc.text(String(c.value), x + cW / 2, 35, { align: 'center' });
    doc.setFontSize(7); doc.setFont('helvetica', 'normal');
    doc.text(c.label.toUpperCase(), x + cW / 2, 40, { align: 'center' });
  });
  autoTable(doc, {
    startY: 47,
    head: [['Emp ID', 'Name', 'Type', 'Start', 'End', 'Days', 'Status', 'Reason']],
    body: requests.map(r => {
      const s = new Date(r.startDate), e = new Date(r.endDate);
      const days = Math.ceil((e - s) / 86400000) + 1;
      return [
        r.employeeId || '', r.staffName || '',
        LEAVE_TYPE_LABELS[r.leaveType] || r.leaveType || '',
        s.toLocaleDateString('en-GB'), e.toLocaleDateString('en-GB'),
        days, r.status || 'pending',
        (r.reason?.length > 50 ? r.reason.slice(0, 50) + '…' : r.reason) || '',
      ];
    }),
    headStyles: { fillColor: NAVY, textColor: WHITE, fontStyle: 'bold', fontSize: 8 },
    bodyStyles: { fontSize: 7.5, textColor: [31, 41, 55] },
    alternateRowStyles: { fillColor: [243, 244, 246] },
    columnStyles: {
      0: { cellWidth: 18 }, 1: { cellWidth: 42 }, 2: { cellWidth: 22 },
      3: { cellWidth: 22 }, 4: { cellWidth: 22 }, 5: { cellWidth: 12, halign: 'center' },
      6: { cellWidth: 20, halign: 'center' }, 7: { cellWidth: 'auto' },
    },
    margin: { left: 14, right: 14 },
    didDrawPage: (data) => {
      doc.setFillColor(...NAVY); doc.rect(0, PH - 10, PW, 10, 'F');
      doc.setFontSize(7); doc.setTextColor(...WHITE);
      doc.text('Pump House — Leave Report (Confidential)', 14, PH - 3.5);
      doc.text(`Page ${data.pageNumber}`, PW - 14, PH - 3.5, { align: 'right' });
    },
  });
  doc.save(`Leave-Report-${new Date().toISOString().slice(0, 10)}.pdf`);
}
// ─────────────────────────────────────────────────────────────────────────────

// Requests tab component
function RequestsTab({ staff }) {
  const { makeRequest } = useTenant();
  const [requests, setRequests]         = useState([]);
  const [loading, setLoading]           = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError]               = useState('');
  const [success, setSuccess]           = useState('');
  const [form, setForm]                 = useState(EMPTY_FORM);
  const [editingLeave, setEditingLeave] = useState(null);
  const [rejectDialog, setRejectDialog] = useState(null);
  const [rejectReason, setRejectReason] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [showHowItWorks, setShowHowItWorks] = useState(false);

  const activeStaff = staff?.filter(s => s.status === 'active') || [];

  const fetchRequests = useCallback(async () => {
    try {
      setLoading(true);
      const query = statusFilter ? `?status=${statusFilter}` : '';
      const res = await makeRequest(`/api/attendance/leaves${query}`);
      setRequests(res.leaves || res || []);
    } catch (err) {
      setError(err.message || 'Failed to load leave requests');
    } finally {
      setLoading(false);
    }
  }, [makeRequest, statusFilter]);

  useEffect(() => { fetchRequests(); }, [fetchRequests]);

  const flash = (msg, isError = false) => {
    if (isError) { setError(msg); setTimeout(() => setError(''), 4000); }
    else { setSuccess(msg); setTimeout(() => setSuccess(''), 4000); }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      setActionLoading(true);
      const res = await makeRequest('/api/attendance/leaves', {
        method: 'POST',
        body: JSON.stringify({ ...form }),
      });
      setRequests(prev => [res, ...prev]);
      setForm(EMPTY_FORM);
      flash('Leave request created');
    } catch (err) {
      flash(err.message || 'Failed to create request', true);
    } finally {
      setActionLoading(false);
    }
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    try {
      setActionLoading(true);
      const res = await makeRequest(`/api/attendance/leaves/${editingLeave._id}`, {
        method: 'PUT',
        body: JSON.stringify({
          startDate: editingLeave.startDate, endDate: editingLeave.endDate,
          reason: editingLeave.reason, leaveType: editingLeave.leaveType,
        }),
      });
      setRequests(prev => prev.map(r => r._id === editingLeave._id ? res : r));
      setEditingLeave(null);
      flash('Leave request updated');
    } catch (err) {
      flash(err.message || 'Failed to update', true);
    } finally {
      setActionLoading(false);
    }
  };

  const handleApprove = async (leaveId) => {
    if (!window.confirm('Approve this leave request?')) return;
    try {
      setActionLoading(true);
      await makeRequest(`/api/attendance/leaves/${leaveId}/approve`, {
        method: 'POST', body: JSON.stringify({ action: 'approve' }),
      });
      flash('Leave approved — attendance sync applied');
      fetchRequests();
    } catch (err) {
      flash(err.message || 'Failed to approve', true);
    } finally {
      setActionLoading(false);
    }
  };

  const handleRejectConfirm = async () => {
    if (!rejectReason.trim()) return;
    try {
      setActionLoading(true);
      await makeRequest(`/api/attendance/leaves/${rejectDialog.leaveId}/approve`, {
        method: 'POST', body: JSON.stringify({ action: 'reject', reason: rejectReason.trim() }),
      });
      setRejectDialog(null);
      flash('Leave rejected');
      fetchRequests();
    } catch (err) {
      flash(err.message || 'Failed to reject', true);
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this leave request?')) return;
    try {
      setActionLoading(true);
      await makeRequest(`/api/attendance/leaves/${id}`, { method: 'DELETE' });
      setRequests(prev => prev.filter(r => r._id !== id));
      flash('Leave request deleted');
    } catch (err) {
      flash(err.message || 'Failed to delete', true);
    } finally {
      setActionLoading(false);
    }
  };

  const pendingCount  = requests.filter(r => !r.status || r.status === 'pending').length;
  const approvedCount = requests.filter(r => r.status === 'approved').length;
  const rejectedCount = requests.filter(r => r.status === 'rejected').length;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div>
          <h3 className="text-lg sm:text-xl font-semibold text-gray-900 flex items-center gap-2">
            <FaCalendarAlt className="text-blue-600" /> Leave Requests
          </h3>
          <p className="text-gray-500 text-sm mt-0.5">Create and manage employee leave requests</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={fetchRequests} className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg" title="Refresh">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button onClick={() => exportXLSX(requests)} disabled={!requests.length}
            className="flex items-center gap-1.5 px-3 py-2 bg-green-50 hover:bg-green-100 text-green-700 border border-green-200 rounded-lg text-sm font-medium disabled:opacity-40 transition-colors">
            <FaFileExcel /> Excel
          </button>
          <button onClick={() => exportPDF(requests)} disabled={!requests.length}
            className="flex items-center gap-1.5 px-3 py-2 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 rounded-lg text-sm font-medium disabled:opacity-40 transition-colors">
            <FaFilePdf /> PDF
          </button>
        </div>
      </div>

      {/* Alerts */}
      {error   && <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700"><AlertTriangle className="w-4 h-4 flex-shrink-0" />{error}</div>}
      {success && <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700">{success}</div>}

      {/* Stats cards */}
      {requests.length > 0 && (
        <div className="grid grid-cols-3 gap-2 sm:gap-3">
          {[
            { label: 'Pending', count: pendingCount, bg: 'bg-amber-50 border-amber-200', num: 'text-amber-700', icon: '⏳' },
            { label: 'Approved', count: approvedCount, bg: 'bg-green-50 border-green-200', num: 'text-green-700', icon: '✓' },
            { label: 'Rejected', count: rejectedCount, bg: 'bg-red-50 border-red-200', num: 'text-red-700', icon: '✗' },
          ].map(({ label, count, bg, num, icon }) => (
            <div key={label} className={`border rounded-xl p-3 sm:p-4 flex items-center gap-3 ${bg}`}>
              <span className="text-2xl">{icon}</span>
              <div>
                <div className={`text-xl sm:text-2xl font-bold ${num}`}>{count}</div>
                <div className="text-xs font-medium text-gray-500">{label}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create / Edit Form */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="px-4 py-3 bg-blue-50 border-b border-blue-100">
          <h4 className="text-sm font-semibold text-gray-900">
            {editingLeave ? 'Edit Leave Request' : 'Create New Leave Request'}
          </h4>
        </div>
        <div className="p-4">
          <form onSubmit={editingLeave ? handleUpdate : handleCreate}>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
              {!editingLeave && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Employee <span className="text-red-500">*</span>
                  </label>
                  <select value={form.employeeId} onChange={e => setForm(f => ({ ...f, employeeId: e.target.value }))}
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500" required>
                    <option value="">Select employee…</option>
                    {activeStaff.map(s => (
                      <option key={s._id} value={s.employeeId}>
                        {s.firstName} {s.lastName || ''} ({s.employeeId})
                      </option>
                    ))}
                  </select>
                  {activeStaff.length === 0 && (
                    <p className="mt-1 text-xs text-orange-600">No active staff found</p>
                  )}
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Leave Type <span className="text-red-500">*</span>
                </label>
                <select
                  value={editingLeave ? editingLeave.leaveType : form.leaveType}
                  onChange={e => editingLeave
                    ? setEditingLeave(l => ({ ...l, leaveType: e.target.value }))
                    : setForm(f => ({ ...f, leaveType: e.target.value }))}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500" required>
                  {LEAVE_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Start Date <span className="text-red-500">*</span>
                </label>
                <input type="date"
                  value={editingLeave ? editingLeave.startDate : form.startDate}
                  onChange={e => editingLeave
                    ? setEditingLeave(l => ({ ...l, startDate: e.target.value }))
                    : setForm(f => ({ ...f, startDate: e.target.value }))}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  End Date <span className="text-red-500">*</span>
                </label>
                <input type="date"
                  value={editingLeave ? editingLeave.endDate : form.endDate}
                  onChange={e => editingLeave
                    ? setEditingLeave(l => ({ ...l, endDate: e.target.value }))
                    : setForm(f => ({ ...f, endDate: e.target.value }))}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500" required />
              </div>
              <div className={editingLeave ? 'sm:col-span-2' : 'lg:col-span-1 sm:col-span-2'}>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Reason <span className="text-red-500">*</span>
                </label>
                <textarea rows={2}
                  value={editingLeave ? editingLeave.reason : form.reason}
                  onChange={e => editingLeave
                    ? setEditingLeave(l => ({ ...l, reason: e.target.value }))
                    : setForm(f => ({ ...f, reason: e.target.value }))}
                  placeholder="Enter reason for leave…"
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 resize-none" required />
              </div>
            </div>
            <div className="flex gap-3">
              <button type="submit" disabled={actionLoading}
                className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold disabled:opacity-50 transition-colors">
                <FaPlus /> {actionLoading ? 'Saving…' : editingLeave ? 'Update Request' : 'Create Request'}
              </button>
              {editingLeave && (
                <button type="button" onClick={() => setEditingLeave(null)}
                  className="px-5 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm font-medium transition-colors">
                  Cancel
                </button>
              )}
            </div>
          </form>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <span className="text-sm font-medium text-gray-600">Filter:</span>
        {['', 'pending', 'approved', 'rejected'].map(s => (
          <button key={s} onClick={() => setStatusFilter(s)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors capitalize ${
              statusFilter === s ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
            }`}>
            {s || 'All'}
          </button>
        ))}
      </div>

      {/* Requests Table */}
      {loading ? (
        <div className="space-y-2">
          {[1,2,3].map(i => <div key={i} className="h-16 bg-gray-100 rounded-lg animate-pulse" />)}
        </div>
      ) : requests.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl border border-dashed border-gray-300">
          <FaCalendarAlt className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 text-sm">No leave requests found</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          {/* Mobile cards */}
          <div className="sm:hidden divide-y divide-gray-100">
            {requests.map(r => {
              const s = new Date(r.startDate), e = new Date(r.endDate);
              const days = Math.ceil((e - s) / 86400000) + 1;
              const status = (r.status || 'pending').toLowerCase();
              return (
                <div key={r._id} className="p-4 space-y-2">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-semibold text-gray-900 text-sm">{r.staffName || r.employeeId}</p>
                      <p className="text-xs text-gray-500">{LEAVE_TYPE_LABELS[r.leaveType] || r.leaveType} · {days} day{days !== 1 ? 's' : ''}</p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {s.toLocaleDateString('en-GB')} → {e.toLocaleDateString('en-GB')}
                      </p>
                    </div>
                    <span className={`px-2 py-1 rounded-full text-xs font-semibold ${STATUS_COLORS[status] || STATUS_COLORS.pending}`}>
                      {r.status || 'Pending'}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {status === 'pending' && (
                      <>
                        <button onClick={() => handleApprove(r._id)} disabled={actionLoading}
                          className="flex items-center gap-1 px-2.5 py-1 bg-green-50 hover:bg-green-100 text-green-700 border border-green-300 rounded text-xs font-medium disabled:opacity-50">
                          <FaCheck size={10} /> Approve
                        </button>
                        <button onClick={() => { setRejectReason(''); setRejectDialog({ leaveId: r._id }); }} disabled={actionLoading}
                          className="flex items-center gap-1 px-2.5 py-1 bg-red-50 hover:bg-red-100 text-red-700 border border-red-300 rounded text-xs font-medium disabled:opacity-50">
                          <FaTimes size={10} /> Reject
                        </button>
                      </>
                    )}
                    {status !== 'approved' && (
                      <button onClick={() => setEditingLeave({
                        _id: r._id, employeeId: r.employeeId,
                        startDate: r.startDate?.split('T')[0],
                        endDate: r.endDate?.split('T')[0],
                        reason: r.reason || '', leaveType: r.leaveType || 'annual',
                      })} className="flex items-center gap-1 px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-300 rounded text-xs font-medium">
                        <FaEdit size={10} /> Edit
                      </button>
                    )}
                    <button onClick={() => handleDelete(r._id)} disabled={actionLoading}
                      className="flex items-center gap-1 px-2.5 py-1 bg-gray-50 hover:bg-red-50 text-gray-500 hover:text-red-700 border border-gray-200 rounded text-xs font-medium disabled:opacity-50">
                      <FaTrash size={10} /> Delete
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Desktop table */}
          <div className="hidden sm:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  {['Employee', 'Type', 'Period', 'Days', 'Reason', 'Status', 'Actions'].map(h => (
                    <th key={h} className={`px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider ${h === 'Reason' ? 'hidden lg:table-cell' : ''}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {requests.map(r => {
                  const s = new Date(r.startDate), e = new Date(r.endDate);
                  const days = Math.ceil((e - s) / 86400000) + 1;
                  const status = (r.status || 'pending').toLowerCase();
                  return (
                    <tr key={r._id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-900">{r.staffName || r.employeeId}</div>
                        <div className="text-xs text-gray-400">{r.employeeId}</div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                          {LEAVE_TYPE_LABELS[r.leaveType] || r.leaveType}
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-xs text-gray-700">
                        {s.toLocaleDateString('en-GB')} → {e.toLocaleDateString('en-GB')}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">{days}d</td>
                      <td className="px-4 py-3 hidden lg:table-cell max-w-xs">
                        <div className="text-xs text-gray-600 truncate" title={r.reason}>{r.reason}</div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className={`px-2 py-1 rounded-full text-xs font-semibold capitalize ${STATUS_COLORS[status] || STATUS_COLORS.pending}`}>
                          {r.status || 'Pending'}
                        </span>
                        {r.approvedBy && <div className="text-xs text-gray-400 mt-0.5">by {r.approvedBy}</div>}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex items-center gap-1">
                          {status === 'pending' && (
                            <>
                              <button onClick={() => handleApprove(r._id)} disabled={actionLoading}
                                className="p-1.5 text-green-600 hover:bg-green-50 rounded-lg disabled:opacity-50 transition-colors" title="Approve">
                                <FaCheck className="w-3.5 h-3.5" />
                              </button>
                              <button onClick={() => { setRejectReason(''); setRejectDialog({ leaveId: r._id }); }} disabled={actionLoading}
                                className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg disabled:opacity-50 transition-colors" title="Reject">
                                <FaTimes className="w-3.5 h-3.5" />
                              </button>
                            </>
                          )}
                          {status !== 'approved' && (
                            <button onClick={() => setEditingLeave({
                              _id: r._id, employeeId: r.employeeId,
                              startDate: r.startDate?.split('T')[0],
                              endDate: r.endDate?.split('T')[0],
                              reason: r.reason || '', leaveType: r.leaveType || 'annual',
                            })} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Edit">
                              <FaEdit className="w-3.5 h-3.5" />
                            </button>
                          )}
                          <button onClick={() => handleDelete(r._id)} disabled={actionLoading}
                            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg disabled:opacity-50 transition-colors" title="Delete">
                            <FaTrash className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* How it works panel */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl overflow-hidden">
        <button onClick={() => setShowHowItWorks(p => !p)}
          className="w-full px-4 py-3 flex items-center gap-2 text-left text-sm font-medium text-blue-800 hover:bg-blue-100 transition-colors">
          <Info className="w-4 h-4 flex-shrink-0" />
          <span>How leave &amp; attendance sync works</span>
          {showHowItWorks ? <ChevronUp className="w-4 h-4 ml-auto" /> : <ChevronDown className="w-4 h-4 ml-auto" />}
        </button>
        {showHowItWorks && (
          <div className="px-4 pb-4 text-sm text-blue-700 space-y-1">
            <p><strong>Approved leave</strong> — attendance records for that period are updated; no absence deductions applied.</p>
            <p><strong>Pending leave</strong> — future absences during the period are prevented from being deducted.</p>
            <p><strong>Rejected leave</strong> — no changes to attendance; normal deduction rules apply.</p>
            <p><strong>Past approval</strong> — retroactively removes absence deductions for already-processed days.</p>
          </div>
        )}
      </div>

      {/* Reject modal */}
      {rejectDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm">
            <div className="p-5 border-b border-gray-100">
              <h3 className="font-semibold text-gray-900">Reject Leave Request</h3>
              <p className="text-sm text-gray-500 mt-0.5">Please provide a reason for rejection</p>
            </div>
            <div className="p-5">
              <textarea
                value={rejectReason} onChange={e => setRejectReason(e.target.value)}
                rows={3} placeholder="Enter rejection reason…"
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-red-500 resize-none"
              />
            </div>
            <div className="p-5 pt-0 flex gap-3">
              <button onClick={handleRejectConfirm} disabled={!rejectReason.trim() || actionLoading}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-semibold disabled:opacity-50 transition-colors">
                <FaTimes /> {actionLoading ? 'Rejecting…' : 'Reject'}
              </button>
              <button onClick={() => setRejectDialog(null)}
                className="flex-1 px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm font-medium transition-colors">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
// ─────────────────────────────────────────────────────────────────────────────

export default function LeaveManagement({ staff }) {
  const [activeTab, setActiveTab] = useState('requests');

  const tabs = [
    { id: 'requests', label: 'Requests',    icon: FaClipboardList },
    { id: 'policy',   label: 'Policy Setup', icon: FaCog },
    { id: 'balances', label: 'Balances',     icon: FaChartBar },
  ];

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Tab Bar */}
      <div className="bg-white rounded-xl shadow-lg overflow-hidden">
        <div className="flex border-b border-gray-200">
          {tabs.map(tab => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                className={`flex-1 px-4 py-3 sm:py-4 text-sm sm:text-base font-semibold transition-all ${
                  active
                    ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white'
                    : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
                }`}>
                <div className="flex items-center justify-center gap-2">
                  <Icon className="text-base sm:text-lg" />
                  <span className="hidden sm:inline">{tab.label}</span>
                  <span className="sm:hidden text-xs">{tab.label}</span>
                </div>
              </button>
            );
          })}
        </div>

        <div className="p-3 sm:p-4 lg:p-6">
          {activeTab === 'requests' && <RequestsTab staff={staff} />}
          {activeTab === 'policy'   && <LeavePolicySetup />}
          {activeTab === 'balances' && <LeaveBalancesTab />}
        </div>
      </div>
    </div>
  );
}
