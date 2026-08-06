import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser, requireSupabaseClient } from '@/lib/auth/server'
import { hasPermission } from '@/lib/auth/permissions'
import { writeAuditLog } from '@/lib/audit/service'

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const user = await getAuthUser()
    if (!hasPermission(user.role, 'subscriptions:create')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const supabase = await requireSupabaseClient()

    const { data: existing } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('id', id)
      .eq('company_id', user.companyId)
      .single()

    if (!existing) {
      return NextResponse.json({ error: 'Subscription not found' }, { status: 404 })
    }

    const updates = {
      tool_name: body.tool_name ?? existing.tool_name,
      plan_name: body.plan_name !== undefined ? body.plan_name : existing.plan_name,
      seats: body.seats != null ? Number(body.seats) : existing.seats,
      total_cost: body.total_cost != null ? Number(body.total_cost) : existing.total_cost,
      currency: body.currency ?? existing.currency,
      billing_cycle: body.billing_cycle ?? existing.billing_cycle,
      renewal_date: body.renewal_date ?? existing.renewal_date,
      login_email: body.login_email !== undefined ? body.login_email : existing.login_email,
      status: body.status ?? existing.status,
      notes: body.notes !== undefined ? body.notes : existing.notes,
    }

    const { data, error } = await supabase
      .from('subscriptions')
      .update(updates)
      .eq('id', id)
      .eq('company_id', user.companyId)
      .select()
      .single()

    if (error) throw new Error(error.message)

    await writeAuditLog({
      userId: user.id,
      companyId: user.companyId,
      entityType: 'subscription',
      entityId: id,
      action: 'updated',
      previousValue: existing,
      newValue: data,
    })

    return NextResponse.json(data)
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    if (msg === 'Unauthorized') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const user = await getAuthUser()
    if (!hasPermission(user.role, 'subscriptions:create')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const supabase = await requireSupabaseClient()

    const { data: existing } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('id', id)
      .eq('company_id', user.companyId)
      .single()

    if (!existing) {
      return NextResponse.json({ error: 'Subscription not found' }, { status: 404 })
    }

    const { error } = await supabase
      .from('subscriptions')
      .delete()
      .eq('id', id)
      .eq('company_id', user.companyId)

    if (error) throw new Error(error.message)

    await writeAuditLog({
      userId: user.id,
      companyId: user.companyId,
      entityType: 'subscription',
      entityId: id,
      action: 'deleted',
      previousValue: existing,
    })

    return NextResponse.json({ success: true })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    if (msg === 'Unauthorized') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
