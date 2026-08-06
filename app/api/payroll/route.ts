import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth/server'
import { hasPermission } from '@/lib/auth/permissions'
import { requireSupabaseClient } from '@/lib/auth/server'
import { writeAuditLog } from '@/lib/audit/service'
import { debitAccount } from '@/lib/accounts/service'

function calculateNetSalary(data: {
  basic_salary: number
  bonus?: number
  commission?: number
  overtime?: number
  allowance?: number
  deduction?: number
  loan_deduction?: number
  advance_deduction?: number
  tax?: number
}): number {
  return (
    data.basic_salary +
    (data.bonus ?? 0) +
    (data.commission ?? 0) +
    (data.overtime ?? 0) +
    (data.allowance ?? 0) -
    (data.deduction ?? 0) -
    (data.loan_deduction ?? 0) -
    (data.advance_deduction ?? 0) -
    (data.tax ?? 0)
  )
}

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser()
    const supabase = await requireSupabaseClient()
    const { searchParams } = request.nextUrl

    let query = supabase
      .from('payroll')
      .select('*')
      .eq('company_id', user.companyId)
      .order('payment_date', { ascending: false })

    if (!hasPermission(user.role, 'payroll:view_all')) {
      query = query.eq('employee_id', user.id)
    }

    const employeeId = searchParams.get('employeeId')
    const departmentId = searchParams.get('departmentId')
    const from = searchParams.get('from')
    const to = searchParams.get('to')

    if (employeeId) query = query.eq('employee_id', employeeId)
    if (departmentId) query = query.eq('department_id', departmentId)
    if (from) query = query.gte('payment_date', from)
    if (to) query = query.lte('payment_date', to)

    const { data, error } = await query
    if (error) throw new Error(error.message)
    return NextResponse.json(data)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    if (message === 'Unauthorized') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser()
    if (!hasPermission(user.role, 'payroll:create')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const { employee_id, department_id, basic_salary, payment_date, account_id } = body

    if (!employee_id || !basic_salary || !payment_date || !account_id) {
      return NextResponse.json(
        { error: 'Missing required fields: employee_id, basic_salary, payment_date, account_id' },
        { status: 422 }
      )
    }

    const net_salary = calculateNetSalary(body)

    const supabase = await requireSupabaseClient()
    const { data, error } = await supabase
      .from('payroll')
      .insert({
        company_id: user.companyId,
        employee_id,
        department_id,
        basic_salary,
        bonus: body.bonus ?? 0,
        commission: body.commission ?? 0,
        overtime: body.overtime ?? 0,
        allowance: body.allowance ?? 0,
        deduction: body.deduction ?? 0,
        loan_deduction: body.loan_deduction ?? 0,
        advance_deduction: body.advance_deduction ?? 0,
        tax: body.tax ?? 0,
        net_salary,
        payment_date,
        account_id,
        status: body.status ?? 'draft',
        processed_by: user.id,
      })
      .select()
      .single()

    if (error) throw new Error(error.message)

    // If status is paid, debit account
    if (body.status === 'paid') {
      await debitAccount(account_id, net_salary, user.id, user.companyId)
    }

    await writeAuditLog({
      userId: user.id,
      companyId: user.companyId,
      entityType: 'payroll',
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
