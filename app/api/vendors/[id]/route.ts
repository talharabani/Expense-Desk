import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser, requireSupabaseClient } from '@/lib/auth/server'
import { hasPermission } from '@/lib/auth/permissions'
import { writeAuditLog } from '@/lib/audit/service'

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const user = await getAuthUser()
    if (!hasPermission(user.role, 'vendors:create')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const supabase = await requireSupabaseClient()

    const { data: existing } = await supabase
      .from('vendors')
      .select('*')
      .eq('id', id)
      .eq('company_id', user.companyId)
      .single()

    if (!existing) {
      return NextResponse.json({ error: 'Vendor not found' }, { status: 404 })
    }

    const updates = {
      name: body.name ?? existing.name,
      company_name: body.company_name !== undefined ? body.company_name : existing.company_name,
      contact_person: body.contact_person !== undefined ? body.contact_person : existing.contact_person,
      phone: body.phone !== undefined ? body.phone : existing.phone,
      email: body.email !== undefined ? body.email : existing.email,
      address: body.address !== undefined ? body.address : existing.address,
      tax_number: body.tax_number !== undefined ? body.tax_number : existing.tax_number,
      bank_details: body.bank_details !== undefined ? body.bank_details : existing.bank_details,
      services: body.services !== undefined ? body.services : existing.services,
      payment_terms: body.payment_terms !== undefined ? body.payment_terms : existing.payment_terms,
      status: body.status ?? existing.status,
    }

    const { data, error } = await supabase
      .from('vendors')
      .update(updates)
      .eq('id', id)
      .eq('company_id', user.companyId)
      .select()
      .single()

    if (error) throw new Error(error.message)

    await writeAuditLog({
      userId: user.id,
      companyId: user.companyId,
      entityType: 'vendor',
      entityId: id,
      action: 'updated',
      previousValue: existing,
      newValue: data,
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
    if (!hasPermission(user.role, 'vendors:create')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const supabase = await requireSupabaseClient()

    const { data: existing } = await supabase
      .from('vendors')
      .select('*')
      .eq('id', id)
      .eq('company_id', user.companyId)
      .single()

    if (!existing) {
      return NextResponse.json({ error: 'Vendor not found' }, { status: 404 })
    }

    const { error } = await supabase
      .from('vendors')
      .delete()
      .eq('id', id)
      .eq('company_id', user.companyId)

    if (error) throw new Error(error.message)

    await writeAuditLog({
      userId: user.id,
      companyId: user.companyId,
      entityType: 'vendor',
      entityId: id,
      action: 'deleted',
      previousValue: existing,
    })

    return NextResponse.json({ success: true })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    if (msg === 'Unauthorized') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
