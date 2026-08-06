// =============================================================================
// Core Type Definitions for Business Expense & Cash-Flow Tracker
// Mirrors the database schema defined in design.md
// =============================================================================

// ---------------------------------------------------------------------------
// Enums / Union Types
// ---------------------------------------------------------------------------

export type Role =
  | 'owner'
  | 'finance_manager'
  | 'manager'
  | 'team_lead'
  | 'employee'
  | 'auditor';

export type IndustryType =
  | 'software_house'
  | 'call_center'
  | 'truck_dispatching'
  | 'general';

export type IncomeStatus =
  | 'draft'
  | 'invoice_created'
  | 'payment_pending'
  | 'advance_payment'
  | 'partially_paid'
  | 'fully_paid'
  | 'overdue'
  | 'cancelled'
  | 'refunded';

export type ExpenseStatus =
  | 'draft'
  | 'submitted'
  | 'under_review'
  | 'approved'
  | 'rejected'
  | 'paid'
  | 'partially_paid'
  | 'reimbursement_pending'
  | 'reimbursed'
  | 'cancelled';

export type ApprovalAction =
  | 'approved'
  | 'rejected'
  | 'request_changes'
  | 'request_proof'
  | 'forwarded';

export type PayrollStatus = 'draft' | 'approved' | 'paid' | 'cancelled';

export type AdvanceStatus =
  | 'pending'
  | 'approved'
  | 'issued'
  | 'partially_settled'
  | 'fully_settled'
  | 'cancelled';

export type BillingCycle = 'monthly' | 'quarterly' | 'annually';

export type AccountType =
  | 'petty_cash'
  | 'bank'
  | 'personal'
  | 'credit_card'
  | 'debit_card'
  | 'digital_wallet';

export type RecurrenceFrequency =
  | 'daily'
  | 'weekly'
  | 'monthly'
  | 'quarterly'
  | 'annually';

export type SubscriptionStatus = 'active' | 'cancelled' | 'paused';

export type VendorStatus = 'active' | 'inactive' | 'blocked';

export type ProjectType = 'software' | 'campaign' | 'load' | 'general';

export type AuditAction =
  | 'created'
  | 'updated'
  | 'deleted'
  | 'approved'
  | 'rejected';

export type DocumentType =
  | 'receipt'
  | 'invoice'
  | 'screenshot'
  | 'contract'
  | 'po';

export type EntityType =
  | 'income'
  | 'expense'
  | 'payroll'
  | 'advance'
  | 'account'
  | 'subscription'
  | 'vendor'
  | 'client'
  | 'project'
  | 'budget';

export type BudgetType =
  | 'company'
  | 'department'
  | 'project'
  | 'campaign'
  | 'subscription'
  | 'marketing'
  | 'hiring'
  | 'equipment';

export type AdvanceSettlementType = 'salary_deduction' | 'refund';

export type NotificationType =
  | 'expense_submitted'
  | 'expense_status_changed'
  | 'invoice_overdue'
  | 'subscription_renewal'
  | 'budget_threshold'
  | 'unusual_expense'
  | 'payroll_due';

export type ReportType =
  | 'income_statement'
  | 'expense_report'
  | 'profit_and_loss'
  | 'cash_flow'
  | 'account_balance'
  | 'accounts_receivable'
  | 'accounts_payable'
  | 'payroll'
  | 'tax'
  | 'vendor_payment'
  | 'subscription'
  | 'reimbursement'
  | 'budget_vs_actual'
  | 'project_profitability'
  | 'department_expense';

// ---------------------------------------------------------------------------
// Database Entity Interfaces
// ---------------------------------------------------------------------------

export interface Company {
  id: string;
  name: string;
  baseCurrency: string;
  industryType: IndustryType;
  timezone: string;
  createdAt: string;
}

export interface User {
  id: string;
  companyId: string;
  name: string;
  email: string;
  role: Role;
  departmentId: string | null;
  isActive: boolean;
  twoFaEnabled: boolean;
  createdAt: string;
}

export interface Department {
  id: string;
  companyId: string;
  name: string;
  managerId: string | null;
  createdAt: string;
}

export interface Account {
  id: string;
  companyId: string;
  name: string;
  accountType: AccountType;
  currency: string;
  openingBalance: number;
  currentBalance: number;
  isActive: boolean;
  createdAt: string;
}

export interface Income {
  id: string;
  companyId: string;
  title: string;
  clientId: string | null;
  projectId: string | null;
  invoiceNumber: string | null;
  amount: number;
  currency: string;
  exchangeRate: number;
  convertedAmount: number;
  paymentDate: string | null;
  paymentMethod: string | null;
  accountId: string | null;
  taxAmount: number;
  status: IncomeStatus;
  description: string | null;
  addedBy: string;
  approvedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface IncomePayment {
  id: string;
  incomeId: string;
  amount: number;
  currency: string;
  exchangeRate: number;
  paymentDate: string;
  paymentMethod: string | null;
  accountId: string | null;
  notes: string | null;
  recordedBy: string;
  createdAt: string;
}

export interface Expense {
  id: string;
  companyId: string;
  title: string;
  category: string;
  departmentId: string | null;
  projectId: string | null;
  clientId: string | null;
  vendorId: string | null;
  amount: number;
  currency: string;
  exchangeRate: number;
  convertedAmount: number;
  expenseDate: string;
  paymentMethod: string | null;
  accountId: string | null;
  isRecurring: boolean;
  recurrence: RecurrenceFrequency | null;
  taxAmount: number;
  description: string | null;
  businessPurpose: string | null;
  relatedEmployee: string | null;
  submittedBy: string;
  approvedBy: string | null;
  approvalDate: string | null;
  status: ExpenseStatus;
  createdAt: string;
  updatedAt: string;
}

export interface Approval {
  id: string;
  expenseId: string;
  approverId: string;
  action: ApprovalAction;
  comment: string | null;
  previousStatus: ExpenseStatus | null;
  newStatus: ExpenseStatus | null;
  createdAt: string;
}

export interface Document {
  id: string;
  companyId: string;
  entityType: EntityType;
  entityId: string;
  documentType: DocumentType;
  storagePath: string;
  originalFilename: string;
  fileSize: number | null;
  mimeType: string | null;
  verificationStatus: string;
  expiryDate: string | null;
  vendorNameExtracted: string | null;
  amountExtracted: number | null;
  dateExtracted: string | null;
  invoiceNumberExtracted: string | null;
  isDuplicate: boolean;
  uploadedBy: string;
  createdAt: string;
}

export interface Subscription {
  id: string;
  companyId: string;
  toolName: string;
  vendorId: string | null;
  planName: string | null;
  seats: number | null;
  costPerSeat: number | null;
  totalCost: number;
  currency: string;
  billingCycle: BillingCycle;
  startDate: string | null;
  renewalDate: string;
  trialExpiryDate: string | null;
  departmentId: string | null;
  accountId: string | null;
  ownerId: string | null;
  loginEmail: string | null;
  autoRenew: boolean;
  status: SubscriptionStatus;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Payroll {
  id: string;
  companyId: string;
  employeeId: string;
  departmentId: string | null;
  basicSalary: number;
  bonus: number;
  commission: number;
  overtime: number;
  allowance: number;
  deduction: number;
  loanDeduction: number;
  advanceDeduction: number;
  tax: number;
  netSalary: number;
  paymentDate: string | null;
  accountId: string | null;
  status: PayrollStatus;
  processedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Advance {
  id: string;
  companyId: string;
  employeeId: string;
  amount: number;
  purpose: string;
  dateIssued: string | null;
  approvedBy: string | null;
  approvalDate: string | null;
  amountUsed: number;
  remainingAmount: number;
  settlementType: AdvanceSettlementType | null;
  status: AdvanceStatus;
  createdAt: string;
  updatedAt: string;
}

export interface Budget {
  id: string;
  companyId: string;
  name: string;
  budgetType: BudgetType;
  entityId: string | null;
  amount: number;
  currency: string;
  periodStart: string;
  periodEnd: string;
  spentAmount: number;
  alertThreshold1: number;
  alertThreshold2: number;
  alertThreshold3: number;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface Vendor {
  id: string;
  companyId: string;
  name: string;
  companyName: string | null;
  contactPerson: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  taxNumber: string | null;
  bankDetails: string | null;
  services: string | null;
  paymentTerms: string | null;
  totalPaid: number;
  outstanding: number;
  status: VendorStatus;
  createdAt: string;
  updatedAt: string;
}

export interface Client {
  id: string;
  companyId: string;
  name: string;
  companyName: string | null;
  contactPerson: string | null;
  phone: string | null;
  email: string | null;
  industry: string | null;
  status: 'active' | 'inactive';
  createdAt: string;
  updatedAt: string;
}

export interface Project {
  id: string;
  companyId: string;
  name: string;
  clientId: string | null;
  projectType: ProjectType;
  startDate: string | null;
  endDate: string | null;
  status: 'active' | 'completed' | 'on_hold' | 'cancelled';
  totalRevenue: number;
  totalExpenses: number;
  profit: number;
  profitMargin: number;
  createdAt: string;
  updatedAt: string;
}

export interface AuditLog {
  id: string;
  companyId: string;
  userId: string;
  entityType: EntityType;
  entityId: string;
  action: AuditAction;
  previousValue: Record<string, unknown> | null;
  newValue: Record<string, unknown> | null;
  ipAddress: string | null;
  deviceInfo: string | null;
  createdAt: string;
}

export interface Notification {
  id: string;
  companyId: string;
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  entityType: EntityType | null;
  entityId: string | null;
  isRead: boolean;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Value Objects / Computed Types
// ---------------------------------------------------------------------------

export interface MonetaryAmount {
  amount: number;
  currency: string;
  exchangeRate: number;
  convertedAmount: number;
}

export interface ApprovalThreshold {
  maxAmount: number;
  requiredRole: Role;
}

export interface BudgetUtilization {
  budgetId: string;
  totalAmount: number;
  spentAmount: number;
  remainingAmount: number;
  utilizationPercent: number;
  isOverBudget: boolean;
}

export interface ProjectProfitability {
  projectId: string;
  totalRevenue: number;
  totalExpenses: number;
  profit: number;
  profitMargin: number | null;
}

export interface OCRResult {
  vendorName: string | null;
  amount: number | null;
  currency: string | null;
  transactionDate: string | null;
  invoiceNumber: string | null;
  isDuplicate: boolean;
}

// ---------------------------------------------------------------------------
// API Request / Response Types
// ---------------------------------------------------------------------------

export interface PaginationParams {
  page?: number;
  pageSize?: number;
}

export interface DateRangeFilter {
  from?: string;
  to?: string;
}

export interface DashboardFilters extends DateRangeFilter {
  departmentId?: string;
  projectId?: string;
  clientId?: string;
  currency?: string;
  accountId?: string;
  period?: 'today' | 'week' | 'month' | 'custom';
}

export interface DashboardSummary {
  totalIncome: number;
  totalExpenses: number;
  profit: number;
  accountBalances: Array<{ accountId: string; name: string; balance: number }>;
  pendingClientPayments: number;
  pendingVendorPayments: number;
  pendingApprovals: number;
  currency: string;
}

export interface CreateIncomeInput {
  title: string;
  clientId?: string;
  projectId?: string;
  invoiceNumber?: string;
  amount: number;
  currency: string;
  exchangeRate?: number;
  paymentDate?: string;
  paymentMethod?: string;
  accountId?: string;
  taxAmount?: number;
  description?: string;
  status?: IncomeStatus;
}

export interface CreateExpenseInput {
  title: string;
  category: string;
  departmentId?: string;
  projectId?: string;
  clientId?: string;
  vendorId?: string;
  amount: number;
  currency: string;
  exchangeRate?: number;
  expenseDate: string;
  paymentMethod?: string;
  accountId?: string;
  isRecurring?: boolean;
  recurrence?: RecurrenceFrequency;
  taxAmount?: number;
  description?: string;
  businessPurpose?: string;
  relatedEmployee?: string;
}

export interface CreatePayrollInput {
  employeeId: string;
  departmentId?: string;
  basicSalary: number;
  bonus?: number;
  commission?: number;
  overtime?: number;
  allowance?: number;
  deduction?: number;
  loanDeduction?: number;
  advanceDeduction?: number;
  tax?: number;
  paymentDate?: string;
  accountId?: string;
}

export interface ValidationError {
  field: string;
  message: string;
}

export interface ApiError {
  code: string;
  message: string;
  validationErrors?: ValidationError[];
}

export interface ApiResponse<T> {
  data?: T;
  error?: ApiError;
}

// ---------------------------------------------------------------------------
// Role Permission Helpers
// ---------------------------------------------------------------------------

/** Ordered role hierarchy from lowest to highest privilege */
export const ROLE_HIERARCHY: Role[] = [
  'auditor',
  'employee',
  'team_lead',
  'manager',
  'finance_manager',
  'owner',
];

/** Returns numeric rank for a role (higher = more privileged) */
export function getRoleRank(role: Role): number {
  return ROLE_HIERARCHY.indexOf(role);
}

/** Returns true if `userRole` meets or exceeds `requiredRole` in the hierarchy */
export function roleAtLeast(userRole: Role, requiredRole: Role): boolean {
  return getRoleRank(userRole) >= getRoleRank(requiredRole);
}
