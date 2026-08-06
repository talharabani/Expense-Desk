import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth/server'
import { getNotifications, markNotificationsRead } from '@/lib/notifications/service'

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser()
    const { searchParams } = request.nextUrl
    const unreadOnly = searchParams.get('unreadOnly') === 'true'
    const limit = searchParams.get('limit') ? Number(searchParams.get('limit')) : 50
    const data = await getNotifications(user.id, user.companyId, unreadOnly, limit)
    return NextResponse.json(data)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    if (message === 'Unauthorized') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const user = await getAuthUser()
    const body = await request.json()
    const { ids } = body
    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: 'ids array required' }, { status: 422 })
    }
    await markNotificationsRead(ids, user.id, user.companyId)
    return NextResponse.json({ success: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    if (message === 'Unauthorized') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
