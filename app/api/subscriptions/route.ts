import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth/server'
import { hasPermission } from '@/lib/auth/permissions'
import { requireSupabaseClient } from '@/lib/auth/server'
import { writeAuditLog } from '@/lib/audit/service'
import { flagRenewalWindow } from '@/lib/subscriptions/utils'

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser()
    if (!hasPermission(user.role, 'subscriptions:view')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const supabase = await requireSupabaseClient()
    const { searchParams } = request.nextUrl
    const status = searchParams.get('status')
    const departmentId = searchParams.get('departmentId')

    let query = supabase
      .from('subscriptions')
      .select('*, vendor:vendors(name), department:departments(name)')
      .eq('company_id', user.companyId)
      .order('renewal_date')

    if (status) query = query.eq('status', status)
    if (departmentId) query = query.eq('department_id', departmentId)

    const { data, error } = await query
    if (error) throw new Error(error.message)

    // Flag subscriptions renewing within the alert lead time. The window is
    // [today, today + 7d]: an upper bound alone flags every past renewal too.
    const today = new Date()
    const enriched = (data ?? []).map(
      (s: { renewal_date?: string | null; trial_expiry_date?: string | null; status?: string | null; [key: string]: unknown }) =>
        flagRenewalWindow(s, today)
    )

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
    if (!hasPermission(user.role, 'subscriptions:create')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const { tool_name, total_cost, currency, billing_cycle, renewal_date } = body

    if (!tool_name || !total_cost || !currency || !billing_cycle || !renewal_date) {
      return NextResponse.json(
        { error: 'Missing required fields: tool_name, total_cost, currency, billing_cycle, renewal_date' },
        { status: 422 }
      )
    }

    const supabase = await requireSupabaseClient()
    const { data, error } = await supabase
      .from('subscriptions')
      .insert({
        company_id: user.companyId,
        tool_name,
        vendor_id: body.vendor_id,
        plan_name: body.plan_name,
        seats: body.seats ?? 1,
        cost_per_seat: body.cost_per_seat,
        total_cost,
        currency,
        billing_cycle,
        start_date: body.start_date,
        renewal_date,
        trial_expiry_date: body.trial_expiry_date,
        department_id: body.department_id,
        account_id: body.account_id,
        owner_id: body.owner_id ?? user.id,
        login_email: body.login_email,
        auto_renew: body.auto_renew ?? true,
        status: 'active',
        notes: body.notes,
      })
      .select()
      .single()

    if (error) throw new Error(error.message)

    // Automatically create a corresponding expense record
    const { data: company } = await supabase
      .from('companies')
      .select('base_currency')
      .eq('id', user.companyId)
      .single()
    const baseCurrency = company?.base_currency ?? 'PKR'
    const EXCHANGE_RATES: Record<string, number> = {
      USD: 278,
      EUR: 300,
      GBP: 350,
      AED: 75,
      PKR: 1
    }
    const rate = currency === baseCurrency ? 1 : (EXCHANGE_RATES[currency] || 1)
    const converted_amount = Number(total_cost) * rate

    await supabase
      .from('expenses')
      .insert({
        company_id: user.companyId,
        title: `Subscription: ${tool_name}${body.plan_name ? ` (${body.plan_name})` : ''}`,
        category: 'subscriptions',
        amount: Number(total_cost),
        currency: currency,
        exchange_rate: rate,
        converted_amount: converted_amount,
        expense_date: new Date().toISOString().slice(0, 10),
        payment_method: 'credit_card',
        status: 'paid',
        submitted_by: user.id,
        description: `Recurring tool subscription for ${tool_name}. Billing cycle: ${billing_cycle}. Renewal: ${renewal_date}.`,
      })

    await writeAuditLog({
      userId: user.id,
      companyId: user.companyId,
      entityType: 'subscription',
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
