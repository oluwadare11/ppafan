// EmptyState.jsx
import { Users, Settings, Package, FileText, Calendar, CreditCard, Clock, AlertCircle, Search } from 'lucide-react';

function EmptyState({ icon: Icon = FileText, title, description, action, actionLabel, className = '' }) {
  return (
    <div className={`flex flex-col items-center justify-center py-16 text-center ${className}`}>
      <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
        <Icon className="w-8 h-8 text-gray-400" />
      </div>
      <h3 className="text-base font-semibold text-gray-700 mb-2">{title}</h3>
      {description && <p className="text-sm text-gray-500 max-w-sm mb-4">{description}</p>}
      {action && actionLabel && (
        <button onClick={action} className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg">{actionLabel}</button>
      )}
    </div>
  );
}

export function NoStaffSetupEmptyState({ onGoToStaff }) {
  return <EmptyState icon={Users} title="No Staff Found" description="No staff members available. Ensure staff have been added to the system." action={onGoToStaff} actionLabel="Go to Staff Management" />;
}
export function NoPayrollSettingsEmptyState({ onGoToSettings }) {
  return <EmptyState icon={Settings} title="Payroll Not Configured" description="Set up payroll settings to get started." action={onGoToSettings} actionLabel="Configure Settings" />;
}
export function NoSalaryComponentsEmptyState() {
  return <EmptyState icon={Package} title="No Salary Components" description="Add salary components like housing or transport allowances." />;
}
export function NoPayrollRecordsEmptyState() {
  return <EmptyState icon={FileText} title="No Payroll Records" description="No payroll has been generated for this period yet." />;
}
export function NoDeductionDataEmptyState() {
  return <EmptyState icon={Calendar} title="No Deduction Data" description="No attendance deductions recorded for this period." />;
}
export function NoPaymentsEmptyState() {
  return <EmptyState icon={CreditCard} title="No Payments" description="No payments have been processed yet." />;
}
export function NoOvertimeRecordsEmptyState() {
  return <EmptyState icon={Clock} title="No Overtime Records" description="No overtime recorded for this period." />;
}
export function NoScheduledPayrollEmptyState() {
  return <EmptyState icon={Calendar} title="No Scheduled Payroll" description="No payroll scheduled. Generate payroll to get started." />;
}
export function SearchEmptyState({ query, onClear }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <Search className="w-10 h-10 text-gray-300 mb-3" />
      <h3 className="text-sm font-medium text-gray-700 mb-1">No results found</h3>
      <p className="text-xs text-gray-500 mb-3">{query ? `No results for "${query}"` : 'No items match your filters.'}</p>
      {onClear && <button onClick={onClear} className="text-sm text-blue-600 hover:text-blue-700">Clear filters</button>}
    </div>
  );
}
export function FilterEmptyState({ onClear }) {
  return <EmptyState icon={AlertCircle} title="No Results" description="No items match your current filters." action={onClear} actionLabel="Clear Filters" />;
}
export function ErrorEmptyState({ message, onRetry }) {
  return <EmptyState icon={AlertCircle} title="Something went wrong" description={message || 'An error occurred. Please try again.'} action={onRetry} actionLabel="Try Again" />;
}

export default EmptyState;
