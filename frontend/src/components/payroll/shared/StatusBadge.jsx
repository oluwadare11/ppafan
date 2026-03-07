// StatusBadge.jsx
const STATUS_CONFIG = {
  active:           { label: 'Active',          bg: 'bg-green-100',  text: 'text-green-700',  dot: 'bg-green-500'  },
  inactive:         { label: 'Inactive',         bg: 'bg-gray-100',   text: 'text-gray-600',   dot: 'bg-gray-400'   },
  pending:          { label: 'Pending',          bg: 'bg-yellow-100', text: 'text-yellow-700', dot: 'bg-yellow-500' },
  draft:            { label: 'Draft',            bg: 'bg-gray-100',   text: 'text-gray-600',   dot: 'bg-gray-400'   },
  generated:        { label: 'Generated',        bg: 'bg-blue-100',   text: 'text-blue-700',   dot: 'bg-blue-500'   },
  pending_approval: { label: 'Pending Approval', bg: 'bg-yellow-100', text: 'text-yellow-700', dot: 'bg-yellow-500' },
  approved:         { label: 'Approved',         bg: 'bg-green-100',  text: 'text-green-700',  dot: 'bg-green-500'  },
  paid:             { label: 'Paid',             bg: 'bg-purple-100', text: 'text-purple-700', dot: 'bg-purple-500' },
  cancelled:        { label: 'Cancelled',        bg: 'bg-red-100',    text: 'text-red-700',    dot: 'bg-red-500'    },
  not_generated:    { label: 'Not Generated',    bg: 'bg-gray-100',   text: 'text-gray-600',   dot: 'bg-gray-400'   },
};

const SIZE_CLASSES = {
  xs: 'px-1.5 py-0.5 text-xs',
  sm: 'px-2 py-0.5 text-xs',
  md: 'px-2.5 py-1 text-sm',
  lg: 'px-3 py-1.5 text-sm',
};

function StatusBadge({ status, label, size = 'sm', showDot = false, className = '' }) {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.inactive;
  const displayLabel = label || config.label;
  const sizeClass = SIZE_CLASSES[size] || SIZE_CLASSES.sm;
  return (
    <span className={`inline-flex items-center gap-1.5 font-medium rounded-full ${config.bg} ${config.text} ${sizeClass} ${className}`}>
      {showDot && <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${config.dot}`} />}
      {displayLabel}
    </span>
  );
}

export function EnabledBadge({ enabled }) {
  return enabled
    ? <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full bg-green-100 text-green-700"><span className="w-1.5 h-1.5 rounded-full bg-green-500" />Enabled</span>
    : <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full bg-gray-100 text-gray-500"><span className="w-1.5 h-1.5 rounded-full bg-gray-400" />Disabled</span>;
}

export function ActiveBadge({ active }) { return <EnabledBadge enabled={active} />; }
export function PayrollStatusBadge({ status }) { return <StatusBadge status={status} showDot />; }
export function ComponentTypeBadges({ type }) {
  const colors = { allowance: 'bg-blue-100 text-blue-700', deduction: 'bg-red-100 text-red-700', bonus: 'bg-green-100 text-green-700' };
  return <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${colors[type] || 'bg-gray-100 text-gray-600'}`}>{type}</span>;
}
export function ApprovalBadge({ status }) { return <StatusBadge status={status} showDot />; }

export default StatusBadge;
