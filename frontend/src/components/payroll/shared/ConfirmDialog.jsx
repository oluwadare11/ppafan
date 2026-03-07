// ConfirmDialog.jsx - Reusable confirmation dialog
import { X, AlertTriangle, Trash2, CheckCircle, AlertCircle } from 'lucide-react';

function ConfirmDialog({ isOpen, onClose, onConfirm, title, message, confirmText = 'Confirm', cancelText = 'Cancel', confirmVariant = 'primary' }) {
  if (!isOpen) return null;

  const variantClasses = {
    primary: 'bg-blue-600 hover:bg-blue-700 text-white',
    danger:  'bg-red-600 hover:bg-red-700 text-white',
    warning: 'bg-yellow-600 hover:bg-yellow-700 text-white',
    success: 'bg-green-600 hover:bg-green-700 text-white',
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
        <div className="p-6">
          <div className="flex items-start gap-4 mb-4">
            <div className={`p-2 rounded-full flex-shrink-0 ${confirmVariant === 'danger' ? 'bg-red-100' : confirmVariant === 'warning' ? 'bg-yellow-100' : 'bg-blue-100'}`}>
              {confirmVariant === 'danger'  ? <Trash2 className="w-5 h-5 text-red-600" /> :
               confirmVariant === 'warning' ? <AlertTriangle className="w-5 h-5 text-yellow-600" /> :
               <AlertCircle className="w-5 h-5 text-blue-600" />}
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
              <p className="text-sm text-gray-600 mt-1">{message}</p>
            </div>
            <button onClick={onClose} className="ml-auto text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
          </div>
          <div className="flex gap-3 justify-end">
            <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg">{cancelText}</button>
            <button onClick={onConfirm} className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${variantClasses[confirmVariant] || variantClasses.primary}`}>{confirmText}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function DeleteConfirmDialog(props) { return <ConfirmDialog {...props} confirmVariant="danger" confirmText={props.confirmText || 'Delete'} />; }
export function SaveChangesDialog(props)   { return <ConfirmDialog {...props} confirmVariant="primary" confirmText={props.confirmText || 'Save'} />; }
export function ProcessPayrollDialog(props){ return <ConfirmDialog {...props} confirmVariant="primary" confirmText={props.confirmText || 'Process'} />; }
export function ApprovePayrollDialog(props){ return <ConfirmDialog {...props} confirmVariant="success" confirmText={props.confirmText || 'Approve'} />; }

export default ConfirmDialog;
