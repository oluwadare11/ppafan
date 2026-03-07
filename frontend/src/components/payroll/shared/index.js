// Shared Payroll Components - Export Index
export {
  default as LoadingSkeleton,
  SkeletonBox, SkeletonLine, SkeletonCircle,
  SettingsCardSkeleton, SettingsGridSkeleton,
  StaffRowSkeleton, StaffTableSkeleton,
  SalaryComponentSkeleton, SalaryComponentsListSkeleton,
  StatsCardSkeleton, StatsGridSkeleton,
  FormSkeleton, PayrollSummarySkeleton,
  TabsSkeleton, PayrollPageSkeleton,
  MobileCardSkeleton, MobileListSkeleton
} from './LoadingSkeleton';

export {
  default as ToggleSwitch,
  SettingsToggle, ToggleGroup
} from './ToggleSwitch';

export {
  default as StatusBadge,
  EnabledBadge, ActiveBadge, PayrollStatusBadge,
  ComponentTypeBadges, ApprovalBadge
} from './StatusBadge';

export {
  default as TabNavigation,
  SubTabs, VerticalTabs, TabPanel
} from './TabNavigation';

export {
  default as FormCard,
  InfoCard, FormField, FormSection,
  SettingsRow, FormDivider, FormActions, InlineEditField
} from './FormCard';

export {
  default as EmptyState,
  NoStaffSetupEmptyState, NoPayrollSettingsEmptyState,
  NoSalaryComponentsEmptyState, NoPayrollRecordsEmptyState,
  NoDeductionDataEmptyState, NoPaymentsEmptyState,
  NoOvertimeRecordsEmptyState, NoScheduledPayrollEmptyState,
  SearchEmptyState, FilterEmptyState, ErrorEmptyState
} from './EmptyState';

export {
  default as Alert,
  InlineAlert, Tip,
  SuccessAlert, ErrorAlert, WarningAlert, InfoAlert
} from './Alert';

export {
  default as ConfirmDialog,
  DeleteConfirmDialog, SaveChangesDialog,
  ProcessPayrollDialog, ApprovePayrollDialog
} from './ConfirmDialog';
