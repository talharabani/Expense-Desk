/**
 * Audit entry construction (Property 12: audit log completeness).
 *
 * Every create, update or delete on a financial record must produce exactly one
 * audit entry capturing the change. The mapping from operation to entry is kept
 * pure here so that "one operation in, one entry out" is testable without a
 * database, and so the DB's action CHECK constraint is enforced in one place.
 */

/** Actions permitted by the audit_logs CHECK constraint. */
export const VALID_AUDIT_ACTIONS = [
  'created',
  'updated',
  'deleted',
  'approved',
  'rejected',
] as const

export type AuditAction = (typeof VALID_AUDIT_ACTIONS)[number]

/** Entity types whose mutations must always be audited. */
export const AUDITED_ENTITY_TYPES = [
  'expense',
  'income',
  'payroll',
  'subscription',
  'budget',
  'account',
  'advance',
  'vendor',
  'client',
  'project',
  'document',
] as const

export interface AuditableOperation {
  userId: string
  companyId: string
  entityType: string
  entityId: string
  action: string
  previousValue?: Record<string, unknown>
  newValue?: Record<string, unknown>
  ipAddress?: string
  deviceInfo?: string
}

export interface AuditLogRow {
  company_id: string
  user_id: string
  entity_type: string
  entity_id: string
  action: AuditAction
  previous_value: Record<string, unknown> | null
  new_value: Record<string, unknown> | null
  ip_address: string | null
  device_info: string | null
}

/**
 * Maps any action onto the constrained set. An unrecognized action becomes
 * 'updated' rather than failing the insert — losing the precise verb is better
 * than losing the entry.
 */
export function normalizeAuditAction(action: string): AuditAction {
  return (VALID_AUDIT_ACTIONS as readonly string[]).includes(action)
    ? (action as AuditAction)
    : 'updated'
}

/** Builds the single row that an operation must produce. */
export function buildAuditRow(operation: AuditableOperation): AuditLogRow {
  return {
    company_id: operation.companyId,
    user_id: operation.userId,
    entity_type: operation.entityType,
    // Fall back to the actor when the entity has no id of its own (e.g. login).
    entity_id: operation.entityId || operation.userId,
    action: normalizeAuditAction(operation.action),
    previous_value: operation.previousValue ?? null,
    new_value: operation.newValue ?? null,
    ip_address: operation.ipAddress ?? null,
    device_info: operation.deviceInfo ?? null,
  }
}

/** One row per operation, in order. Never collapses or drops operations. */
export function buildAuditRows(operations: AuditableOperation[]): AuditLogRow[] {
  return operations.map(buildAuditRow)
}
