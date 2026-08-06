import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser, requireSupabaseClient } from '@/lib/auth/server'
import { hasPermission } from '@/lib/auth/permissions'
import { writeAuditLog } from '@/lib/audit/service'
import { convertAmount, validateCurrencyFields } from '@/lib/currency/utils'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const user = await getAuthUser()
    const supabase = await requireSupabaseClient()
    const { data, error } = await supabase
      .from('expenses').select('*').eq('id', id).eq('company_id', user.companyId).single()
    if (error || !data) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const { data: documents } = await supabase
      .from('documents')
      .select('*')
      .eq('entity_type', 'expense')
      .eq('entity_id', id)
      .eq('company_id', user.companyId)

    return NextResponse.json({
      ...data,
      receipt: documents?.[0] || null
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    if (msg === 'Unauthorized') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const user = await getAuthUser()
    if (!hasPermission(user.role, 'expenses:update_any') &&
        !hasPermission(user.role, 'expenses:update_own')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const supabase = await requireSupabaseClient()

    const { data: existing } = await supabase
      .from('expenses').select('*').eq('id', id).eq('company_id', user.companyId).single()
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const { data: company } = await supabase
      .from('companies').select('base_currency').eq('id', user.companyId).single()
    const baseCurrency = company?.base_currency ?? 'PKR'

    const currency = body.currency ?? existing.currency
    const exchangeRate = body.exchange_rate ?? (currency === baseCurrency ? 1 : existing.exchange_rate)
    const amount = body.amount != null ? Number(body.amount) : Number(existing.amount)

    if (currency !== baseCurrency) {
      const check = validateCurrencyFields(currency, baseCurrency, exchangeRate)
      if (!check.valid) return NextResponse.json({ error: check.error }, { status: 422 })
    }

    const updates = {
      title: body.title ?? existing.title,
      category: body.category ?? existing.category,
      amount,
      currency,
      exchange_rate: exchangeRate,
      converted_amount: convertAmount(amount, exchangeRate),
      expense_date: body.expense_date ?? existing.expense_date,
      payment_method: body.payment_method ?? existing.payment_method,
      description: body.description !== undefined ? body.description : existing.description,
      business_purpose: body.business_purpose !== undefined ? body.business_purpose : existing.business_purpose,
      status: body.status ?? existing.status,
      updated_at: new Date().toISOString(),
    }

    const { data, error } = await supabase
      .from('expenses').update(updates).eq('id', id).eq('company_id', user.companyId).select().single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    await writeAuditLog({
      userId: user.id, companyId: user.companyId,
      entityType: 'expense', entityId: id,
      action: 'updated', previousValue: existing, newValue: data,
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
    if (!hasPermission(user.role, 'expenses:delete')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const supabase = await requireSupabaseClient()
    const { data: existing } = await supabase
      .from('expenses').select('*').eq('id', id).eq('company_id', user.companyId).single()
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    await supabase.from('expenses')
      .update({ deleted_at: new Date().toISOString(), deleted_by: user.id })
      .eq('id', id).eq('company_id', user.companyId)

    await writeAuditLog({
      userId: user.id, companyId: user.companyId,
      entityType: 'expense', entityId: id, action: 'deleted', previousValue: existing,
    })

    return NextResponse.json({ success: true })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    if (msg === 'Unauthorized') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
