import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth/server'
import { hasPermission } from '@/lib/auth/permissions'
import { requireSupabaseClient } from '@/lib/auth/server'

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser()
    if (!hasPermission(user.role, 'audit_logs:view')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const supabase = await requireSupabaseClient()
    const { searchParams } = request.nextUrl
    const entityType = searchParams.get('entityType')
    const entityId = searchParams.get('entityId')
    const from = searchParams.get('from')
    const to = searchParams.get('to')
    const limit = Number(searchParams.get('limit') ?? 100)
    const offset = Number(searchParams.get('offset') ?? 0)

    let query = supabase
      .from('audit_logs')
      .select('*', { count: 'exact' })
      .eq('company_id', user.companyId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (entityType) query = query.eq('entity_type', entityType)
    if (entityId) query = query.eq('entity_id', entityId)
    if (from) query = query.gte('created_at', from)
    if (to) query = query.lte('created_at', to)

    const { data, error, count } = await query
    if (error) throw new Error(error.message)

    return NextResponse.json({ data, total: count, limit, offset })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    if (message === 'Unauthorized') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
