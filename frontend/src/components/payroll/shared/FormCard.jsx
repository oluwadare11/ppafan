// FormCard.jsx - Form layout components
import { useState } from 'react';

function FormCard({ title, description, icon: Icon, children, className = '' }) {
  return (
    <div className={`bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden ${className}`}>
      {(title || Icon) && (
        <div className="px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            {Icon && <div className="p-2 bg-blue-50 rounded-lg"><Icon className="w-5 h-5 text-blue-600" /></div>}
            <div>
              {title && <h3 className="text-base font-semibold text-gray-900">{title}</h3>}
              {description && <p className="text-sm text-gray-500 mt-0.5">{description}</p>}
            </div>
          </div>
        </div>
      )}
      <div className="p-6">{children}</div>
    </div>
  );
}

export function InfoCard({ title, value, subtitle, icon: Icon, color = 'blue', className = '' }) {
  const colors = {
    blue:   { bg: 'bg-blue-50',   icon: 'text-blue-600',   value: 'text-blue-700'   },
    green:  { bg: 'bg-green-50',  icon: 'text-green-600',  value: 'text-green-700'  },
    yellow: { bg: 'bg-yellow-50', icon: 'text-yellow-600', value: 'text-yellow-700' },
    red:    { bg: 'bg-red-50',    icon: 'text-red-600',    value: 'text-red-700'    },
    purple: { bg: 'bg-purple-50', icon: 'text-purple-600', value: 'text-purple-700' },
  };
  const c = colors[color] || colors.blue;
  return (
    <div className={`bg-white rounded-lg border border-gray-200 p-4 ${className}`}>
      <div className="flex items-center gap-3 mb-2">
        {Icon && <div className={`p-2 rounded-lg ${c.bg}`}><Icon className={`w-5 h-5 ${c.icon}`} /></div>}
        <p className="text-sm text-gray-500">{title}</p>
      </div>
      <p className={`text-2xl font-bold ${c.value}`}>{value}</p>
      {subtitle && <p className="text-xs text-gray-500 mt-1">{subtitle}</p>}
    </div>
  );
}

export function FormField({ label, required = false, hint, error, children, className = '' }) {
  return (
    <div className={className}>
      {label && (
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {label}{required && <span className="text-red-500 ml-1">*</span>}
          {hint && <span className="text-gray-400 font-normal text-xs ml-1">({hint})</span>}
        </label>
      )}
      {children}
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}

export function FormSection({ title, description, children, className = '' }) {
  return (
    <div className={className}>
      {title && <h4 className="text-sm font-semibold text-gray-900 mb-1">{title}</h4>}
      {description && <p className="text-xs text-gray-500 mb-3">{description}</p>}
      <div className="space-y-4">{children}</div>
    </div>
  );
}

export function SettingsRow({ label, description, children }) {
  return (
    <div className="flex items-center justify-between gap-4 py-3 border-b border-gray-100 last:border-0">
      <div className="flex-1">
        <p className="text-sm font-medium text-gray-900">{label}</p>
        {description && <p className="text-xs text-gray-500 mt-0.5">{description}</p>}
      </div>
      <div className="flex-shrink-0">{children}</div>
    </div>
  );
}

export function FormDivider({ label }) {
  if (label) {
    return (
      <div className="relative my-4">
        <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-200" /></div>
        <div className="relative flex justify-center"><span className="px-3 bg-white text-xs text-gray-500">{label}</span></div>
      </div>
    );
  }
  return <div className="border-t border-gray-200 my-4" />;
}

export function FormActions({ children, className = '' }) {
  return <div className={`flex items-center justify-end gap-3 pt-4 border-t border-gray-200 ${className}`}>{children}</div>;
}

export function InlineEditField({ value, onSave, type = 'text', className = '' }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  return editing ? (
    <div className="flex items-center gap-2">
      <input type={type} value={draft} onChange={e => setDraft(e.target.value)} className="px-2 py-1 border border-gray-300 rounded text-sm" autoFocus />
      <button onClick={() => { onSave(draft); setEditing(false); }} className="text-xs text-blue-600 font-medium">Save</button>
      <button onClick={() => { setDraft(value); setEditing(false); }} className="text-xs text-gray-400">Cancel</button>
    </div>
  ) : (
    <div className={`flex items-center gap-2 group ${className}`}>
      <span className="text-sm text-gray-900">{value}</span>
      <button onClick={() => setEditing(true)} className="opacity-0 group-hover:opacity-100 text-xs text-blue-600">Edit</button>
    </div>
  );
}

export default FormCard;
