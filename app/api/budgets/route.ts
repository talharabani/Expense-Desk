import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth/server'
import { hasPermission } from '@/lib/auth/permissions'
import { requireSupabaseClient } from '@/lib/auth/server'
import { writeAuditLog } from '@/lib/audit/service'

export async function GET() {
  try {
    const user = await getAuthUser()
    if (!hasPermission(user.role, 'budgets:view')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const supabase = await requireSupabaseClient()
    const { data, error } = await supabase
      .from('budgets')
      .select('*')
      .eq('company_id', user.companyId)
      .order('period_start', { ascending: false })

    if (error) throw new Error(error.message)

    const enriched = (data ?? []).map((b) => {
      const utilized = b.amount > 0 ? (b.spent_amount / b.amount) * 100 : 0
      return {
        ...b,
        utilization_percent: Math.round(utilized * 100) / 100,
        remaining: b.amount - b.spent_amount,
        is_over_budget: b.spent_amount > b.amount,
      }
    })

    return NextResponse.json(enriched)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    if (message === 'Unauthorized') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser()
    if (!hasPermission(user.role, 'budgets:create')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const { name, budget_type, amount, currency, period_start, period_end } = body

    if (!name || !budget_type || !amount || !currency || !period_start || !period_end) {
      return NextResponse.json(
        { error: 'Missing required fields: name, budget_type, amount, currency, period_start, period_end' },
        { status: 422 }
      )
    }

    const supabase = await requireSupabaseClient()
    const { data, error } = await supabase
      .from('budgets')
      .insert({
        company_id: user.companyId,
        name,
        budget_type,
        entity_id: body.entity_id,
        amount,
        currency,
        period_start,
        period_end,
        spent_amount: 0,
        alert_threshold_1: body.alert_threshold_1 ?? 70,
        alert_threshold_2: body.alert_threshold_2 ?? 90,
        alert_threshold_3: body.alert_threshold_3 ?? 100,
        created_by: user.id,
      })
      .select()
      .single()

    if (error) throw new Error(error.message)

    await writeAuditLog({
      userId: user.id,
      companyId: user.companyId,
      entityType: 'budget',
      entityId: data.id,
      action: 'created',
      newValue: data,
    })

    return NextResponse.json(data, { status: 201 })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    if (message === 'Unauthorized') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
