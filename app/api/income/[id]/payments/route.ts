import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth/server'
import { hasPermission } from '@/lib/auth/permissions'
import { recordPartialPayment } from '@/lib/income/service'
import { requireSupabaseClient } from '@/lib/auth/server'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const user = await getAuthUser()
    if (!hasPermission(user.role, 'income:approve')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()

    if (!body.amount || !body.currency || !body.paymentDate || !body.paymentMethod || !body.accountId) {
      return NextResponse.json(
        { error: 'Missing required fields: amount, currency, paymentDate, paymentMethod, accountId' },
        { status: 422 }
      )
    }

    const supabase = await requireSupabaseClient()
    const { data: company } = await supabase
      .from('companies')
      .select('base_currency')
      .eq('id', user.companyId)
      .single()

    const baseCurrency = company?.base_currency ?? 'PKR'

    await recordPartialPayment(id, body, user.id, user.companyId, baseCurrency)
    return NextResponse.json({ success: true }, { status: 200 })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    if (message === 'Unauthorized') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (message.startsWith('Total payments')) {
      return NextResponse.json({ error: message }, { status: 422 })
    }
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
