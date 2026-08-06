import { requireSupabaseClient } from '@/lib/auth/server'

interface NotificationInput {
  userId: string
  companyId: string
  type: string
  title: string
  message: string
  entityType?: string
  entityId?: string
}

/**
 * Creates an in-app notification for a user.
 * Fails silently to avoid disrupting primary operations.
 */
export async function createNotification(input: NotificationInput): Promise<void> {
  try {
    const supabase = await requireSupabaseClient()
    await supabase.from('notifications').insert({
      company_id: input.companyId,
      user_id: input.userId,
      type: input.type,
      title: input.title,
      message: input.message,
      entity_type: input.entityType ?? null,
      entity_id: input.entityId ?? null,
      is_read: false,
    })
  } catch (err) {
    console.error('[Notifications] Failed to create notification:', err)
  }
}

export async function getNotifications(
  userId: string,
  companyId: string,
  unreadOnly = false,
  limit = 50
) {
  const supabase = await requireSupabaseClient()
  let query = supabase
    .from('notifications')
    .select('*')
    .eq('user_id', userId)
    .eq('company_id', companyId)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (unreadOnly) query = query.eq('is_read', false)

  const { data, error } = await query
  if (error) throw new Error(error.message)
  return data
}

export async function markNotificationsRead(
  notificationIds: string[],
  userId: string,
  companyId: string
): Promise<void> {
  const supabase = await requireSupabaseClient()
  await supabase
    .from('notifications')
    .update({ is_read: true })
    .in('id', notificationIds)
    .eq('user_id', userId)
    .eq('company_id', companyId)
}
