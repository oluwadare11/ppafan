// Alert.jsx - Alert/notification components for payroll module
import { useState, useEffect, useCallback } from 'react';
import { CheckCircle, XCircle, AlertTriangle, AlertCircle, X, Info } from 'lucide-react';

const ALERT_TYPES = {
  success: { icon: CheckCircle, bgColor: 'bg-green-50', borderColor: 'border-green-200', textColor: 'text-green-800', iconColor: 'text-green-500' },
  error:   { icon: XCircle,    bgColor: 'bg-red-50',   borderColor: 'border-red-200',   textColor: 'text-red-800',   iconColor: 'text-red-500'   },
  warning: { icon: AlertTriangle, bgColor: 'bg-yellow-50', borderColor: 'border-yellow-200', textColor: 'text-yellow-800', iconColor: 'text-yellow-500' },
  info:    { icon: AlertCircle,   bgColor: 'bg-blue-50',   borderColor: 'border-blue-200',   textColor: 'text-blue-800',   iconColor: 'text-blue-500'   }
};

function Alert({ type = 'info', title, message, dismissible = true, autoDismiss = false, autoDismissTimeout = 5000, onDismiss, action, actionLabel, className = '' }) {
  const [isVisible, setIsVisible] = useState(true);
  const config = ALERT_TYPES[type] || ALERT_TYPES.info;
  const Icon = config.icon;

  const handleDismiss = useCallback(() => { setIsVisible(false); onDismiss?.(); }, [onDismiss]);

  useEffect(() => {
    if (autoDismiss && autoDismissTimeout > 0) {
      const timer = setTimeout(handleDismiss, autoDismissTimeout);
      return () => clearTimeout(timer);
    }
  }, [autoDismiss, autoDismissTimeout, handleDismiss]);

  if (!isVisible) return null;

  return (
    <div className={`flex items-start gap-3 p-4 rounded-lg border ${config.bgColor} ${config.borderColor} ${className}`} role="alert">
      <Icon className={`w-5 h-5 flex-shrink-0 mt-0.5 ${config.iconColor}`} />
      <div className="flex-1 min-w-0">
        {title && <h4 className={`font-medium ${config.textColor}`}>{title}</h4>}
        {message && <p className={`text-sm ${title ? 'mt-1' : ''} ${config.textColor} opacity-90`}>{message}</p>}
        {action && actionLabel && (
          <button onClick={action} className={`mt-2 text-sm font-medium underline hover:no-underline ${config.textColor}`}>{actionLabel}</button>
        )}
      </div>
      {dismissible && (
        <button onClick={handleDismiss} className={`flex-shrink-0 p-1 rounded ${config.textColor}`} aria-label="Dismiss">
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}

export function InlineAlert({ type = 'error', message, className = '' }) {
  const config = ALERT_TYPES[type] || ALERT_TYPES.error;
  const Icon = config.icon;
  return (
    <div className={`flex items-center gap-2 text-sm ${config.textColor} ${className}`}>
      <Icon className="w-4 h-4 flex-shrink-0" />
      <span>{message}</span>
    </div>
  );
}

export function Tip({ children, className = '' }) {
  return (
    <div className={`flex items-start gap-2 p-3 bg-blue-50 rounded-lg text-sm text-blue-700 ${className}`}>
      <Info className="w-4 h-4 flex-shrink-0 mt-0.5" />
      <div>{children}</div>
    </div>
  );
}

export const SuccessAlert = (props) => <Alert {...props} type="success" />;
export const ErrorAlert   = (props) => <Alert {...props} type="error" />;
export const WarningAlert = (props) => <Alert {...props} type="warning" />;
export const InfoAlert    = (props) => <Alert {...props} type="info" />;

export default Alert;
