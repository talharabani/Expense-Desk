'use client'

import { useCallback, useState } from 'react'
import { useAsyncEffect } from '@/lib/hooks/use-async-effect'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, Bell, CheckCheck } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Notification {
  id: string
  type: string
  title: string
  message: string
  is_read: boolean
  entity_type: string | null
  created_at: string
}

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [markingAll, setMarkingAll] = useState(false)
  const [now, setNow] = useState(0)

  const load = useCallback(async () => {
    const r = await fetch('/api/notifications')
    if (r.ok) {
      setNotifications(await r.json())
      // Snapshot the clock alongside the data so relative timestamps stay a
      // pure function of state instead of reading Date.now() during render.
      setNow(Date.now())
    } else setError('Failed to load notifications')
    setLoading(false)
  }, [])

  useAsyncEffect(load)

  async function markAllRead() {
    setMarkingAll(true)
    const unread = notifications.filter(n => !n.is_read).map(n => n.id)
    if (unread.length > 0) {
      await fetch('/api/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: unread }),
      })
      load()
    }
    setMarkingAll(false)
  }

  const unreadCount = notifications.filter(n => !n.is_read).length

  function timeAgo(dateStr: string) {
    if (!now) return ''
    const diff = now - new Date(dateStr).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 1) return 'just now'
    if (mins < 60) return `${mins}m ago`
    const hrs = Math.floor(mins / 60)
    if (hrs < 24) return `${hrs}h ago`
    return `${Math.floor(hrs / 24)}d ago`
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Notifications</h2>
          <p className="text-sm text-muted-foreground">{unreadCount} unread notification{unreadCount !== 1 ? 's' : ''}</p>
        </div>
        {unreadCount > 0 && (
          <Button variant="outline" onClick={markAllRead} disabled={markingAll}>
            {markingAll ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCheck className="mr-2 h-4 w-4" />}
            Mark all read
          </Button>
        )}
      </div>

      {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>
      ) : notifications.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <Bell className="h-10 w-10 mb-3 opacity-30" />
            <p>No notifications yet.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {notifications.map(n => (
            <Card key={n.id} className={cn('transition-colors', !n.is_read && 'border-blue-200 bg-blue-50/30 dark:border-blue-900 dark:bg-blue-950/20')}>
              <CardContent className="flex items-start gap-3 py-4">
                <div className={cn('mt-0.5 h-2 w-2 rounded-full flex-shrink-0', n.is_read ? 'bg-transparent' : 'bg-blue-500')} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-medium text-sm">{n.title}</p>
                    <span className="text-xs text-muted-foreground whitespace-nowrap">{timeAgo(n.created_at)}</span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-0.5">{n.message}</p>
                  {n.entity_type && (
                    <Badge variant="outline" className="mt-1 text-xs">{n.entity_type}</Badge>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
