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
    if (!hasPermission(user.role, 'projects:create')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const supabase = await requireSupabaseClient()

    const { data: existing } = await supabase
      .from('projects')
      .select('*')
      .eq('id', id)
      .eq('company_id', user.companyId)
      .single()

    if (!existing) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    const updates = {
      name: body.name ?? existing.name,
      client_id: body.client_id !== undefined ? body.client_id : existing.client_id,
      project_type: body.project_type ?? existing.project_type,
      start_date: body.start_date !== undefined ? body.start_date : existing.start_date,
      end_date: body.end_date !== undefined ? body.end_date : existing.end_date,
      status: body.status ?? existing.status,
    }

    const { data, error } = await supabase
      .from('projects')
      .update(updates)
      .eq('id', id)
      .eq('company_id', user.companyId)
      .select()
      .single()

    if (error) throw new Error(error.message)

    await writeAuditLog({
      userId: user.id,
      companyId: user.companyId,
      entityType: 'project',
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
    if (!hasPermission(user.role, 'projects:create')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const supabase = await requireSupabaseClient()

    const { data: existing } = await supabase
      .from('projects')
      .select('*')
      .eq('id', id)
      .eq('company_id', user.companyId)
      .single()

    if (!existing) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    const { error } = await supabase
      .from('projects')
      .delete()
      .eq('id', id)
      .eq('company_id', user.companyId)

    if (error) throw new Error(error.message)

    await writeAuditLog({
      userId: user.id,
      companyId: user.companyId,
      entityType: 'project',
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
