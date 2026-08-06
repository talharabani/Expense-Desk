'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Plus, Loader2, Target } from 'lucide-react'

interface Budget {
  id: string
  name: string
  budget_type: string
  amount: number
  currency: string
  period_start: string
  period_end: string
  spent_amount: number
  utilization_percent: number
  remaining: number
  is_over_budget: boolean
}

export default function BudgetsPage() {
  const [budgets, setBudgets] = useState<Budget[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const [form, setForm] = useState({
    name: '', budget_type: 'department', amount: '', currency: 'PKR',
    period_start: new Date().toISOString().slice(0, 10),
    period_end: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).toISOString().slice(0, 10),
  })

  async function load() {
    setLoading(true)
    const r = await fetch('/api/budgets')
    if (r.ok) setBudgets(await r.json())
    else setError('Failed to load budgets')
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    const r = await fetch('/api/budgets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, amount: Number(form.amount) }),
    })
    if (r.ok) { setShowCreate(false); load() }
    else setError((await r.json()).error)
    setSubmitting(false)
  }

  function utilColor(pct: number) {
    if (pct >= 100) return 'bg-red-500'
    if (pct >= 90) return 'bg-orange-500'
    if (pct >= 70) return 'bg-yellow-500'
    return 'bg-green-500'
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Budgets</h2>
          <p className="text-sm text-muted-foreground">Monitor spending against allocated budgets</p>
        </div>
        <Button onClick={() => setShowCreate(true)}><Plus className="mr-2 h-4 w-4" /> New Budget</Button>
      </div>

      {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {budgets.map(b => (
            <Card key={b.id} className={b.is_over_budget ? 'border-red-400' : ''}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <CardTitle className="text-sm font-semibold">{b.name}</CardTitle>
                  <div className="flex gap-1">
                    {b.is_over_budget && <Badge variant="destructive">Over Budget</Badge>}
                    <Badge variant="outline">{b.budget_type.replace(/_/g, ' ')}</Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Spent</span>
                  <span className="font-medium">{b.currency} {b.spent_amount.toLocaleString()} / {b.amount.toLocaleString()}</span>
                </div>
                <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${utilColor(b.utilization_percent)}`}
                    style={{ width: `${Math.min(b.utilization_percent, 100)}%` }}
                  />
                </div>
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>{b.utilization_percent.toFixed(1)}% used</span>
                  <span>Remaining: {b.remaining.toLocaleString()}</span>
                </div>
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Target className="h-3 w-3" />
                  {b.period_start} → {b.period_end}
                </div>
              </CardContent>
            </Card>
          ))}
          {budgets.length === 0 && (
            <p className="text-sm text-muted-foreground col-span-3">No budgets set up yet.</p>
          )}
        </div>
      )}

      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <Card className="w-full max-w-md">
            <CardContent className="pt-6">
              <h3 className="text-lg font-semibold mb-4">Create Budget</h3>
              <form onSubmit={handleCreate} className="space-y-4">
                <div className="space-y-1">
                  <Label>Budget Name *</Label>
                  <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label>Type</Label>
                    <Select value={form.budget_type} onChange={e => setForm(f => ({ ...f, budget_type: e.target.value }))}>
                      {['company','department','project','campaign','subscription','marketing','hiring','equipment'].map(t => (
                        <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>
                      ))}
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label>Currency</Label>
                    <Select value={form.currency} onChange={e => setForm(f => ({ ...f, currency: e.target.value }))}>
                      {['PKR', 'USD', 'EUR'].map(c => <option key={c} value={c}>{c}</option>)}
                    </Select>
                  </div>
                </div>
                <div className="space-y-1">
                  <Label>Amount *</Label>
                  <Input type="number" step="0.01" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} required />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label>Start Date *</Label>
                    <Input type="date" value={form.period_start} onChange={e => setForm(f => ({ ...f, period_start: e.target.value }))} required />
                  </div>
                  <div className="space-y-1">
                    <Label>End Date *</Label>
                    <Input type="date" value={form.period_end} onChange={e => setForm(f => ({ ...f, period_end: e.target.value }))} required />
                  </div>
                </div>
                <div className="flex gap-2 justify-end pt-2">
                  <Button type="button" variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
                  <Button type="submit" disabled={submitting}>{submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Create</Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
