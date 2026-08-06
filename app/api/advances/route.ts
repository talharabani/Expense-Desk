import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth/server'
import { hasPermission } from '@/lib/auth/permissions'
import { requireSupabaseClient } from '@/lib/auth/server'
import { writeAuditLog } from '@/lib/audit/service'

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser()
    const supabase = await requireSupabaseClient()
    const { searchParams } = request.nextUrl

    let query = supabase
      .from('advances')
      .select('*')
      .eq('company_id', user.companyId)
      .order('date_issued', { ascending: false })

    if (!hasPermission(user.role, 'advances:view_all')) {
      query = query.eq('employee_id', user.id)
    } else {
      const employeeId = searchParams.get('employeeId')
      if (employeeId) query = query.eq('employee_id', employeeId)
    }

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
    if (!hasPermission(user.role, 'advances:create')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const { employee_id, amount, purpose, date_issued } = body

    if (!employee_id || !amount || !purpose || !date_issued) {
      return NextResponse.json(
        { error: 'Missing required fields: employee_id, amount, purpose, date_issued' },
        { status: 422 }
      )
    }

    const supabase = await requireSupabaseClient()
    const { data, error } = await supabase
      .from('advances')
      .insert({
        company_id: user.companyId,
        employee_id,
        amount,
        purpose,
        date_issued,
        remaining_amount: amount,
        amount_used: 0,
        status: 'pending',
        settlement_type: body.settlement_type ?? 'salary_deduction',
      })
      .select()
      .single()

    if (error) throw new Error(error.message)

    await writeAuditLog({
      userId: user.id,
      companyId: user.companyId,
      entityType: 'advance',
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
