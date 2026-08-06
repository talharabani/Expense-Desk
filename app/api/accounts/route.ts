import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth/server'
import { hasPermission } from '@/lib/auth/permissions'
import { getAccounts } from '@/lib/accounts/service'
import { requireSupabaseClient } from '@/lib/auth/server'
import { writeAuditLog } from '@/lib/audit/service'

export async function GET() {
  try {
    const user = await getAuthUser()
    if (!hasPermission(user.role, 'accounts:view')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    const accounts = await getAccounts(user.companyId)
    return NextResponse.json(accounts)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    if (message === 'Unauthorized') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser()
    if (!hasPermission(user.role, 'accounts:create')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const { name, account_type, currency, opening_balance = 0, notes } = body

    if (!name || !account_type || !currency) {
      return NextResponse.json({ error: 'Missing required fields: name, account_type, currency' }, { status: 422 })
    }

    const supabase = await requireSupabaseClient()
    const { data, error } = await supabase
      .from('accounts')
      .insert({
        company_id: user.companyId,
        name,
        account_type,
        currency,
        opening_balance,
        current_balance: opening_balance,
        notes,
        created_by: user.id,
      })
      .select()
      .single()

    if (error) throw new Error(error.message)

    await writeAuditLog({
      userId: user.id,
      companyId: user.companyId,
      entityType: 'account',
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
