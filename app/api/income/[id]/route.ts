import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser, requireSupabaseClient } from '@/lib/auth/server'
import { hasPermission } from '@/lib/auth/permissions'
import { writeAuditLog } from '@/lib/audit/service'
import { convertAmount, validateCurrencyFields } from '@/lib/currency/utils'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const user = await getAuthUser()
    if (!hasPermission(user.role, 'income:view')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    const supabase = await requireSupabaseClient()
    const { data, error } = await supabase
      .from('income')
      .select('*')
      .eq('id', id)
      .eq('company_id', user.companyId)
      .is('deleted_at', null)
      .single()
    if (error || !data) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json(data)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    if (message === 'Unauthorized') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const user = await getAuthUser()
    if (!hasPermission(user.role, 'income:update')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const supabase = await requireSupabaseClient()

    // Fetch existing to compare + get company base currency
    const { data: existing, error: fetchError } = await supabase
      .from('income').select('*').eq('id', id).eq('company_id', user.companyId).is('deleted_at', null).single()
    if (fetchError || !existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

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

    const convertedAmount = convertAmount(amount, exchangeRate)

    const updates = {
      title: body.title ?? existing.title,
      invoice_number: body.invoice_number ?? existing.invoice_number,
      amount,
      currency,
      exchange_rate: exchangeRate,
      converted_amount: convertedAmount,
      payment_date: body.payment_date ?? existing.payment_date,
      payment_method: body.payment_method ?? existing.payment_method,
      account_id: body.account_id ?? existing.account_id,
      tax_amount: body.tax_amount != null ? Number(body.tax_amount) : Number(existing.tax_amount),
      status: body.status ?? existing.status,
      description: body.description !== undefined ? body.description : existing.description,
      updated_at: new Date().toISOString(),
    }

    const { data, error } = await supabase
      .from('income').update(updates).eq('id', id).eq('company_id', user.companyId).select().single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    await writeAuditLog({
      userId: user.id, companyId: user.companyId,
      entityType: 'income', entityId: id,
      action: 'updated', previousValue: existing, newValue: data,
    })

    return NextResponse.json(data)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    if (message === 'Unauthorized') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const user = await getAuthUser()
    if (!hasPermission(user.role, 'income:delete')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const supabase = await requireSupabaseClient()
    const { data: existing } = await supabase
      .from('income').select('*').eq('id', id).eq('company_id', user.companyId).single()
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    // Soft delete
    const { error } = await supabase
      .from('income')
      .update({ deleted_at: new Date().toISOString(), deleted_by: user.id })
      .eq('id', id).eq('company_id', user.companyId)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    await writeAuditLog({
      userId: user.id, companyId: user.companyId,
      entityType: 'income', entityId: id,
      action: 'deleted', previousValue: existing,
    })

    return NextResponse.json({ success: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    if (message === 'Unauthorized') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
