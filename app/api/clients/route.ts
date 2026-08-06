import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth/server'
import { hasPermission } from '@/lib/auth/permissions'
import { requireSupabaseClient } from '@/lib/auth/server'
import { writeAuditLog } from '@/lib/audit/service'

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser()
    if (!hasPermission(user.role, 'clients:view')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const supabase = await requireSupabaseClient()
    const { searchParams } = request.nextUrl
    const search = searchParams.get('search')

    let query = supabase
      .from('clients')
      .select('*')
      .eq('company_id', user.companyId)
      .order('name')

    if (search) query = query.ilike('name', `%${search}%`)

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
    if (!hasPermission(user.role, 'clients:create')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    if (!body.name) {
      return NextResponse.json({ error: 'Missing required field: name' }, { status: 422 })
    }

    const supabase = await requireSupabaseClient()
    const { data, error } = await supabase
      .from('clients')
      .insert({
        company_id: user.companyId,
        name: body.name,
        company_name: body.company_name,
        contact_person: body.contact_person,
        phone: body.phone,
        email: body.email,
        industry: body.industry,
        status: 'active',
      })
      .select()
      .single()

    if (error) throw new Error(error.message)

    await writeAuditLog({
      userId: user.id,
      companyId: user.companyId,
      entityType: 'client',
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
