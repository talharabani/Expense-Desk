import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth/server'
import { hasPermission } from '@/lib/auth/permissions'
import { createExpense, getExpenses } from '@/lib/expenses/service'
import { requireSupabaseClient } from '@/lib/auth/server'

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser()

    const { searchParams } = request.nextUrl
    const submittedBy = hasPermission(user.role, 'expenses:view_all')
      ? (searchParams.get('submittedBy') ?? undefined)
      : user.id // Employees can only see their own

    const filters = {
      departmentId: searchParams.get('departmentId') ?? undefined,
      projectId: searchParams.get('projectId') ?? undefined,
      clientId: searchParams.get('clientId') ?? undefined,
      category: searchParams.get('category') ?? undefined,
      status: searchParams.get('status') ?? undefined,
      from: searchParams.get('from') ?? undefined,
      to: searchParams.get('to') ?? undefined,
      submittedBy,
      limit: searchParams.get('limit') ? Number(searchParams.get('limit')) : undefined,
      offset: searchParams.get('offset') ? Number(searchParams.get('offset')) : undefined,
    }

    const result = await getExpenses(user.companyId, filters)
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
    if (!hasPermission(user.role, 'expenses:create')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    // Normalize snake_case form fields to camelCase for the service layer
    const normalized = {
      title: body.title,
      category: body.category,
      departmentId: body.departmentId ?? body.department_id,
      projectId: body.projectId ?? body.project_id,
      clientId: body.clientId ?? body.client_id,
      vendorId: body.vendorId ?? body.vendor_id,
      amount: Number(body.amount),
      currency: body.currency,
      exchangeRate: body.exchangeRate ?? (body.exchange_rate ? Number(body.exchange_rate) : undefined),
      expenseDate: body.expenseDate ?? body.expense_date,
      paymentMethod: body.paymentMethod ?? body.payment_method,
      accountId: body.accountId ?? body.account_id,
      isRecurring: body.isRecurring ?? body.is_recurring,
      recurrence: body.recurrence,
      taxAmount: body.taxAmount ?? body.tax_amount,
      description: body.description,
      businessPurpose: body.businessPurpose ?? body.business_purpose,
      relatedEmployee: body.relatedEmployee ?? body.related_employee,
    }

    const supabase = await requireSupabaseClient()
    const { data: company } = await supabase
      .from('companies')
      .select('base_currency')
      .eq('id', user.companyId)
      .single()

    const baseCurrency = company?.base_currency ?? 'PKR'
    const expense = await createExpense(normalized, user.id, user.companyId, baseCurrency)
    return NextResponse.json(expense, { status: 201 })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    if (message === 'Unauthorized') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (message.startsWith('Missing required') || message.startsWith('Exchange rate')) {
      return NextResponse.json({ error: message }, { status: 422 })
    }
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
