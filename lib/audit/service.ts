import { requireSupabaseClient } from '@/lib/auth/server'
import { buildAuditRow, type AuditableOperation } from '@/lib/audit/utils'

type AuditLogEntry = AuditableOperation

/**
 * Writes a single audit log entry. Fails silently to avoid disrupting
 * the primary operation — audit failures are logged to console.
 * Row shape and action normalization live in lib/audit/utils.
 */
export async function writeAuditLog(entry: AuditLogEntry): Promise<void> {
  try {
    const supabase = await requireSupabaseClient()
    await supabase.from('audit_logs').insert(buildAuditRow(entry))
  } catch (err) {
    console.error('[AuditLog] Failed to write audit entry:', err)
  }
}

/**
 * Returns audit log entries for a specific entity.
 */
export async function getAuditLogs(
  companyId: string,
  filters?: {
    entityType?: string
    entityId?: string
    userId?: string
    action?: string
    from?: string
    to?: string
    limit?: number
  }
) {
  const supabase = await requireSupabaseClient()
  let query = supabase
    .from('audit_logs')
    .select('*')
    .eq('company_id', companyId)
    .order('created_at', { ascending: false })
    .limit(filters?.limit ?? 100)

  if (filters?.entityType) query = query.eq('entity_type', filters.entityType)
  if (filters?.entityId) query = query.eq('entity_id', filters.entityId)
  if (filters?.userId) query = query.eq('user_id', filters.userId)
  if (filters?.action) query = query.eq('action', filters.action)
  if (filters?.from) query = query.gte('created_at', filters.from)
  if (filters?.to) query = query.lte('created_at', filters.to)

  const { data, error } = await query
  if (error) throw new Error(error.message)
  return data
}
