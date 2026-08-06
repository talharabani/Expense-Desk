import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth/server'
import { hasPermission } from '@/lib/auth/permissions'
import { transferBetweenAccounts } from '@/lib/accounts/service'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const user = await getAuthUser()
    if (!hasPermission(user.role, 'accounts:transfer')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const { toAccountId, amount, notes } = body

    if (!toAccountId || !amount) {
      return NextResponse.json(
        { error: 'Missing required fields: toAccountId, amount' },
        { status: 422 }
      )
    }

    if (amount <= 0) {
      return NextResponse.json({ error: 'Transfer amount must be positive' }, { status: 422 })
    }

    await transferBetweenAccounts(
      id,
      toAccountId,
      amount,
      user.id,
      user.companyId,
      notes
    )

    return NextResponse.json({ success: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    if (message === 'Unauthorized') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (message.startsWith('Cannot transfer') || message.startsWith('Transfer amount')) {
      return NextResponse.json({ error: message }, { status: 422 })
    }
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
