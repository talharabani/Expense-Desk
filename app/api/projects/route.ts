import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth/server'
import { hasPermission } from '@/lib/auth/permissions'
import { requireSupabaseClient } from '@/lib/auth/server'
import { writeAuditLog } from '@/lib/audit/service'

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser()
    if (!hasPermission(user.role, 'projects:view')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const supabase = await requireSupabaseClient()
    const { searchParams } = request.nextUrl
    const clientId = searchParams.get('clientId')

    let query = supabase
      .from('projects')
      .select('*, client:clients(name, company_name)')
      .eq('company_id', user.companyId)
      .order('name')

    if (clientId) query = query.eq('client_id', clientId)

    const { data: projectsData, error } = await query
    if (error) throw new Error(error.message)

    // Calculate dynamic project totals by querying related incomes and expenses
    const { data: incomes } = await supabase
      .from('income')
      .select('project_id, converted_amount')
      .eq('company_id', user.companyId)
      .is('deleted_at', null)

    const { data: expenses } = await supabase
      .from('expenses')
      .select('project_id, converted_amount')
      .eq('company_id', user.companyId)
      .is('deleted_at', null)

    const revenueMap: Record<string, number> = {}
    const expensesMap: Record<string, number> = {}

    incomes?.forEach(inc => {
      if (inc.project_id) {
        revenueMap[inc.project_id] = (revenueMap[inc.project_id] || 0) + Number(inc.converted_amount)
      }
    })

    expenses?.forEach(exp => {
      if (exp.project_id) {
        expensesMap[exp.project_id] = (expensesMap[exp.project_id] || 0) + Number(exp.converted_amount)
      }
    })

    const enriched = projectsData.map(p => {
      const total_revenue = revenueMap[p.id] || 0
      const total_expenses = expensesMap[p.id] || 0
      const profit = total_revenue - total_expenses
      const profit_margin = total_revenue > 0 ? (profit / total_revenue) * 100 : 0
      return {
        ...p,
        total_revenue,
        total_expenses,
        profit,
        profit_margin,
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
    if (!hasPermission(user.role, 'projects:create')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    if (!body.name) {
      return NextResponse.json({ error: 'Missing required field: name' }, { status: 422 })
    }

    const supabase = await requireSupabaseClient()
    const { data, error } = await supabase
      .from('projects')
      .insert({
        company_id: user.companyId,
        name: body.name,
        client_id: body.client_id,
        project_type: body.project_type ?? 'general',
        start_date: body.start_date,
        end_date: body.end_date,
        status: 'active',
        total_revenue: 0,
        total_expenses: 0,
        profit: 0,
        profit_margin: 0,
      })
      .select()
      .single()

    if (error) throw new Error(error.message)

    await writeAuditLog({
      userId: user.id,
      companyId: user.companyId,
      entityType: 'project',
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
