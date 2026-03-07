// ToggleSwitch.jsx
function ToggleSwitch({ checked = false, onChange, disabled = false, size = 'md', className = '' }) {
  const sizes = {
    sm: { track: 'w-8 h-4',   thumb: 'w-3 h-3', translate: 'translate-x-4' },
    md: { track: 'w-11 h-6',  thumb: 'w-5 h-5', translate: 'translate-x-5' },
    lg: { track: 'w-14 h-7',  thumb: 'w-6 h-6', translate: 'translate-x-7' },
  };
  const s = sizes[size] || sizes.md;
  return (
    <button type="button" role="switch" aria-checked={checked} disabled={disabled}
      onClick={() => !disabled && onChange?.(!checked)}
      className={`relative inline-flex items-center flex-shrink-0 cursor-pointer rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${s.track} ${checked ? 'bg-blue-600' : 'bg-gray-200'} ${disabled ? 'opacity-50 cursor-not-allowed' : ''} ${className}`}>
      <span className={`pointer-events-none inline-block rounded-full bg-white shadow transform transition-transform duration-200 ${s.thumb} ${checked ? s.translate : 'translate-x-0.5'}`} />
    </button>
  );
}

export function SettingsToggle({ label, description, checked, onChange, disabled = false }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900">{label}</p>
        {description && <p className="text-xs text-gray-500 mt-0.5">{description}</p>}
      </div>
      <ToggleSwitch checked={checked} onChange={onChange} disabled={disabled} />
    </div>
  );
}

export function ToggleGroup({ options, value, onChange, className = '' }) {
  return (
    <div className={`flex gap-1 ${className}`}>
      {options.map(opt => (
        <button key={opt.value} onClick={() => onChange(opt.value)}
          className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${value === opt.value ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
          {opt.label}
        </button>
      ))}
    </div>
  );
}

export default ToggleSwitch;
