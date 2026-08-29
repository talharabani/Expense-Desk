import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth/server'
import { hasPermission } from '@/lib/auth/permissions'
import { requireSupabaseClient } from '@/lib/auth/server'
import { writeAuditLog } from '@/lib/audit/service'
import { calculateVendorTotals } from '@/lib/vendors/utils'

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser()
    if (!hasPermission(user.role, 'vendors:view')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const supabase = await requireSupabaseClient()
    const { searchParams } = request.nextUrl
    const search = searchParams.get('search')

    let query = supabase
      .from('vendors')
      .select('*')
      .eq('company_id', user.companyId)
      .order('name')

    if (search) query = query.ilike('name', `%${search}%`)

    const { data, error } = await query
    if (error) throw new Error(error.message)

    // vendors.total_paid is written as 0 on creation and never incremented, so
    // derive it from the paid expenses instead of returning the stale column.
    const { data: paidExpenses } = await supabase
      .from('expenses')
      .select('vendor_id, status, converted_amount, deleted_at')
      .eq('company_id', user.companyId)
      .eq('status', 'paid')

    const totals = calculateVendorTotals(paidExpenses ?? [])
    const enriched = (data ?? []).map((vendor: { id: string; [key: string]: unknown }) => ({
      ...vendor,
      total_paid: totals[vendor.id] ?? 0,
    }))

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
    if (!hasPermission(user.role, 'vendors:create')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    if (!body.name || !body.contact_person || !body.phone || !body.email) {
      return NextResponse.json(
        { error: 'Missing required fields: name, contact_person, phone, email' },
        { status: 422 }
      )
    }

    const supabase = await requireSupabaseClient()
    const { data, error } = await supabase
      .from('vendors')
      .insert({
        company_id: user.companyId,
        name: body.name,
        company_name: body.company_name,
        contact_person: body.contact_person,
        phone: body.phone,
        email: body.email,
        address: body.address,
        tax_number: body.tax_number,
        bank_details: body.bank_details,
        services: body.services,
        payment_terms: body.payment_terms,
        status: 'active',
        total_paid: 0,
        outstanding: 0,
      })
      .select()
      .single()

    if (error) throw new Error(error.message)

    await writeAuditLog({
      userId: user.id,
      companyId: user.companyId,
      entityType: 'vendor',
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
