import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth/server'
import { hasPermission } from '@/lib/auth/permissions'
import { createIncome, getIncome } from '@/lib/income/service'
import { requireSupabaseClient } from '@/lib/auth/server'

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser()
    if (!hasPermission(user.role, 'income:view')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { searchParams } = request.nextUrl
    const filters = {
      clientId: searchParams.get('clientId') ?? undefined,
      projectId: searchParams.get('projectId') ?? undefined,
      status: searchParams.get('status') ?? undefined,
      from: searchParams.get('from') ?? undefined,
      to: searchParams.get('to') ?? undefined,
      paymentMethod: searchParams.get('paymentMethod') ?? undefined,
      accountId: searchParams.get('accountId') ?? undefined,
      currency: searchParams.get('currency') ?? undefined,
      limit: searchParams.get('limit') ? Number(searchParams.get('limit')) : undefined,
      offset: searchParams.get('offset') ? Number(searchParams.get('offset')) : undefined,
    }

    const result = await getIncome(user.companyId, filters)
    return NextResponse.json(result)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    if (message === 'Unauthorized') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser()
    if (!hasPermission(user.role, 'income:create')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    // Normalize snake_case form fields to camelCase for the service layer
    const normalized = {
      title: body.title,
      clientId: body.clientId ?? body.client_id,
      projectId: body.projectId ?? body.project_id,
      invoiceNumber: body.invoiceNumber ?? body.invoice_number,
      amount: Number(body.amount),
      currency: body.currency,
      exchangeRate: body.exchangeRate ?? (body.exchange_rate ? Number(body.exchange_rate) : undefined),
      paymentDate: body.paymentDate ?? body.payment_date,
      paymentMethod: body.paymentMethod ?? body.payment_method,
      accountId: body.accountId ?? body.account_id,
      taxAmount: body.taxAmount ?? body.tax_amount,
      description: body.description,
      status: body.status,
    }

    // Get company base currency
    const supabase = await requireSupabaseClient()
    const { data: company } = await supabase
      .from('companies')
      .select('base_currency')
      .eq('id', user.companyId)
      .single()

    const baseCurrency = company?.base_currency ?? 'PKR'
    const income = await createIncome(normalized, user.id, user.companyId, baseCurrency)
    return NextResponse.json(income, { status: 201 })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    if (message === 'Unauthorized') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (message.startsWith('Missing required') || message.startsWith('Exchange rate')) {
      return NextResponse.json({ error: message }, { status: 422 })
    }
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
