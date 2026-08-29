'use client'

import { useCallback, useState } from 'react'
import { useAsyncEffect } from '@/lib/hooks/use-async-effect'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, CheckCircle, XCircle, MessageSquare } from 'lucide-react'

interface Expense {
  id: string
  title: string
  category: string
  amount: number
  currency: string
  converted_amount: number
  expense_date: string
  status: string
  payment_method: string | null
  description: string | null
  business_purpose: string | null
}

export default function ApprovalsPage() {
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [commentMap, setCommentMap] = useState<Record<string, string>>({})

  const load = useCallback(async () => {
    const r = await fetch('/api/expenses?status=submitted')
    if (!r.ok) { setError('Failed to load pending approvals'); setLoading(false); return }
    const data = await r.json()
    setExpenses(data.data ?? [])
    setLoading(false)
  }, [])

  useAsyncEffect(load)

  async function act(expenseId: string, action: string) {
    setActionLoading(expenseId + action)
    setError(null)
    const r = await fetch(`/api/expenses/${expenseId}/approve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, comment: commentMap[expenseId] }),
    })
    if (!r.ok) setError((await r.json()).error)
    else load()
    setActionLoading(null)
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Pending Approvals</h2>
        <p className="text-sm text-muted-foreground">Review and action submitted expense requests</p>
      </div>

      {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>
      ) : expenses.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">No expenses pending approval.</CardContent></Card>
      ) : (
        <div className="space-y-4">
          {expenses.map(exp => (
            <Card key={exp.id}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-base">{exp.title}</CardTitle>
                    <p className="text-xs text-muted-foreground mt-1">{exp.category.replace(/_/g, ' ')} · {exp.expense_date}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold">{exp.currency} {exp.amount.toLocaleString()}</p>
                    <Badge variant="warning" className="mt-1">Submitted</Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {exp.business_purpose && (
                  <p className="text-sm text-muted-foreground"><span className="font-medium text-foreground">Purpose:</span> {exp.business_purpose}</p>
                )}
                {exp.description && (
                  <p className="text-sm text-muted-foreground">{exp.description}</p>
                )}
                <div className="space-y-1">
                  <Input
                    placeholder="Add comment (optional)"
                    value={commentMap[exp.id] ?? ''}
                    onChange={e => setCommentMap(m => ({ ...m, [exp.id]: e.target.value }))}
                  />
                </div>
                <div className="flex flex-wrap gap-2 pt-1">
                  <Button
                    size="sm"
                    onClick={() => act(exp.id, 'approved')}
                    disabled={!!actionLoading}
                  >
                    {actionLoading === exp.id + 'approved' ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <CheckCircle className="mr-1 h-3 w-3" />}
                    Approve
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => act(exp.id, 'rejected')}
                    disabled={!!actionLoading}
                  >
                    {actionLoading === exp.id + 'rejected' ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <XCircle className="mr-1 h-3 w-3" />}
                    Reject
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => act(exp.id, 'request_changes')}
                    disabled={!!actionLoading}
                  >
                    <MessageSquare className="mr-1 h-3 w-3" /> Request Changes
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => act(exp.id, 'request_proof')}
                    disabled={!!actionLoading}
                  >
                    Request Proof
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
