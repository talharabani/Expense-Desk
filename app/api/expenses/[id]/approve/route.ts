import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth/server'
import { processApproval } from '@/lib/expenses/service'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const user = await getAuthUser()
    const body = await request.json()

    const { action, comment, forwardToUserId } = body

    const validActions = ['approved', 'rejected', 'request_changes', 'request_proof', 'forwarded']
    if (!action || !validActions.includes(action)) {
      return NextResponse.json(
        { error: `Invalid action. Must be one of: ${validActions.join(', ')}` },
        { status: 422 }
      )
    }

    await processApproval(
      id,
      user.id,
      user.role,
      user.companyId,
      action,
      comment,
      forwardToUserId
    )

    return NextResponse.json({ success: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    if (message === 'Unauthorized') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (message.startsWith('Insufficient role') || message.startsWith('Cannot approve your own')) {
      return NextResponse.json({ error: message }, { status: 403 })
    }
    if (message.startsWith('Cannot approve expense without')) {
      return NextResponse.json({ error: message }, { status: 422 })
    }
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
