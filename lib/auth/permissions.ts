import type { Role, ApprovalThreshold } from '@/types'

// Permission matrix: action -> roles that can perform it
const PERMISSIONS: Record<string, Role[]> = {
  // Company management
  'company:update': ['owner'],
  'company:delete': ['owner'],

  // User management
  'users:create': ['owner', 'finance_manager'],
  'users:update': ['owner', 'finance_manager'],
  'users:delete': ['owner'],
  'users:view': ['owner', 'finance_manager', 'manager', 'team_lead', 'employee', 'auditor'],

  // Income
  'income:create': ['owner', 'finance_manager', 'manager'],
  'income:update': ['owner', 'finance_manager'],
  'income:delete': ['owner'],
  'income:view': ['owner', 'finance_manager', 'manager', 'auditor'],
  'income:approve': ['owner', 'finance_manager'],

  // Expenses
  'expenses:create': ['owner', 'finance_manager', 'manager', 'team_lead', 'employee'],
  'expenses:update_own': ['owner', 'finance_manager', 'manager', 'team_lead', 'employee'],
  'expenses:update_any': ['owner', 'finance_manager'],
  'expenses:delete': ['owner'],
  'expenses:view_all': ['owner', 'finance_manager', 'manager', 'auditor'],
  'expenses:view_own': ['owner', 'finance_manager', 'manager', 'team_lead', 'employee', 'auditor'],
  'expenses:approve_small': ['owner', 'finance_manager', 'manager', 'team_lead'],
  'expenses:approve_medium': ['owner', 'finance_manager', 'manager'],
  'expenses:approve_large': ['owner', 'finance_manager'],
  'expenses:approve_extra_large': ['owner'],

  // Accounts
  'accounts:create': ['owner', 'finance_manager'],
  'accounts:update': ['owner', 'finance_manager'],
  'accounts:delete': ['owner'],
  'accounts:view': ['owner', 'finance_manager', 'auditor'],
  'accounts:transfer': ['owner', 'finance_manager'],

  // Payroll (sensitive)
  'payroll:create': ['owner', 'finance_manager'],
  'payroll:update': ['owner', 'finance_manager'],
  'payroll:delete': ['owner'],
  'payroll:view_all': ['owner', 'finance_manager'],
  'payroll:view_own': ['owner', 'finance_manager', 'manager', 'team_lead', 'employee'],
  'payroll:approve': ['owner', 'finance_manager'],

  // Advances
  'advances:create': ['owner', 'finance_manager', 'manager', 'team_lead', 'employee'],
  'advances:approve': ['owner', 'finance_manager', 'manager'],
  'advances:view_all': ['owner', 'finance_manager', 'manager'],
  'advances:view_own': ['owner', 'finance_manager', 'manager', 'team_lead', 'employee'],

  // Subscriptions
  'subscriptions:create': ['owner', 'finance_manager', 'manager'],
  'subscriptions:update': ['owner', 'finance_manager', 'manager'],
  'subscriptions:delete': ['owner', 'finance_manager'],
  'subscriptions:view': ['owner', 'finance_manager', 'manager', 'auditor'],

  // Budgets
  'budgets:create': ['owner', 'finance_manager', 'manager'],
  'budgets:update': ['owner', 'finance_manager', 'manager'],
  'budgets:delete': ['owner', 'finance_manager'],
  'budgets:view': ['owner', 'finance_manager', 'manager', 'auditor'],

  // Vendors
  'vendors:create': ['owner', 'finance_manager', 'manager'],
  'vendors:update': ['owner', 'finance_manager', 'manager'],
  'vendors:delete': ['owner'],
  'vendors:view': ['owner', 'finance_manager', 'manager', 'team_lead', 'employee', 'auditor'],

  // Clients & Projects
  'clients:create': ['owner', 'finance_manager', 'manager'],
  'clients:update': ['owner', 'finance_manager', 'manager'],
  'clients:view': ['owner', 'finance_manager', 'manager', 'team_lead', 'auditor'],
  'projects:create': ['owner', 'finance_manager', 'manager'],
  'projects:update': ['owner', 'finance_manager', 'manager'],
  'projects:view': ['owner', 'finance_manager', 'manager', 'team_lead', 'auditor'],

  // Reports
  'reports:view': ['owner', 'finance_manager', 'manager', 'auditor'],
  'reports:export': ['owner', 'finance_manager', 'auditor'],

  // Audit Logs
  'audit_logs:view': ['owner', 'finance_manager', 'auditor'],

  // Settings
  'settings:manage': ['owner'],
  'settings:view': ['owner', 'finance_manager'],
}

/**
 * Check if a user role has permission to perform an action.
 * Returns true if the role is authorized, false otherwise.
 */
export function hasPermission(role: Role, action: string): boolean {
  const allowedRoles = PERMISSIONS[action]
  if (!allowedRoles) return false
  return allowedRoles.includes(role)
}

// Default approval thresholds in PKR — configurable per company
export const DEFAULT_APPROVAL_THRESHOLDS: ApprovalThreshold[] = [
  { maxAmount: 5000, requiredRole: 'team_lead' },
  { maxAmount: 25000, requiredRole: 'manager' },
  { maxAmount: 100000, requiredRole: 'finance_manager' },
  { maxAmount: Infinity, requiredRole: 'owner' },
]

/**
 * Returns the minimum role required to approve an expense of a given amount.
 * Uses customizable thresholds (falls back to defaults).
 */
export function getApprovalThreshold(
  amount: number,
  thresholds: ApprovalThreshold[] = DEFAULT_APPROVAL_THRESHOLDS
): Role {
  const sorted = [...thresholds].sort((a, b) => a.maxAmount - b.maxAmount)
  for (const threshold of sorted) {
    if (amount <= threshold.maxAmount) {
      return threshold.requiredRole
    }
  }
  return 'owner'
}

/**
 * Role hierarchy for comparison (higher index = higher authority).
 */
const ROLE_HIERARCHY: Role[] = [
  'employee',
  'auditor',
  'team_lead',
  'manager',
  'finance_manager',
  'owner',
]

/**
 * Returns true if role A meets or exceeds role B in the hierarchy.
 */
export function roleAtLeast(role: Role, minimumRole: Role): boolean {
  return ROLE_HIERARCHY.indexOf(role) >= ROLE_HIERARCHY.indexOf(minimumRole)
}

/**
 * Returns the permission action string for approving an expense at a given amount.
 */
export function getApprovalPermission(amount: number): string {
  if (amount <= 5000) return 'expenses:approve_small'
  if (amount <= 25000) return 'expenses:approve_medium'
  if (amount <= 100000) return 'expenses:approve_large'
  return 'expenses:approve_extra_large'
}
