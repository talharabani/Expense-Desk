'use client'

import { useCallback, useState } from 'react'
import { useAsyncEffect } from '@/lib/hooks/use-async-effect'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Plus, Loader2 } from 'lucide-react'

interface Advance {
  id: string
  amount: number
  purpose: string
  date_issued: string | null
  amount_used: number
  remaining_amount: number
  status: string
  settlement_type: string | null
  employee: { name: string; email: string } | null
}

const STATUS_COLORS: Record<string, 'default' | 'secondary' | 'success' | 'warning' | 'destructive' | 'outline'> = {
  pending: 'warning',
  approved: 'default',
  issued: 'success',
  partially_settled: 'warning',
  fully_settled: 'success',
  cancelled: 'outline',
}

export default function AdvancesPage() {
  const [advances, setAdvances] = useState<Advance[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const [form, setForm] = useState({
    employee_id: '', amount: '', purpose: '',
    date_issued: new Date().toISOString().slice(0, 10),
    settlement_type: 'salary_deduction',
  })

  const load = useCallback(async () => {
    const r = await fetch('/api/advances')
    if (r.ok) setAdvances(await r.json())
    else setError('Failed to load advances')
    setLoading(false)
  }, [])

  useAsyncEffect(load)

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    const r = await fetch('/api/advances', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, amount: Number(form.amount) }),
    })
    if (r.ok) { setShowCreate(false); load() }
    else setError((await r.json()).error)
    setSubmitting(false)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Advances</h2>
          <p className="text-sm text-muted-foreground">Track employee salary advances and settlements</p>
        </div>
        <Button onClick={() => setShowCreate(true)}><Plus className="mr-2 h-4 w-4" /> New Advance</Button>
      </div>

      {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b bg-muted/50">
                  <tr>{['Employee', 'Purpose', 'Amount', 'Used', 'Remaining', 'Settlement', 'Status'].map(h => (
                    <th key={h} className="px-4 py-3 text-left font-medium text-muted-foreground">{h}</th>
                  ))}</tr>
                </thead>
                <tbody>
                  {advances.map(a => (
                    <tr key={a.id} className="border-b last:border-0 hover:bg-muted/30">
                      <td className="px-4 py-3 font-medium">{a.employee?.name ?? '—'}</td>
                      <td className="px-4 py-3 text-muted-foreground max-w-xs truncate">{a.purpose}</td>
                      <td className="px-4 py-3">{a.amount.toLocaleString()}</td>
                      <td className="px-4 py-3 text-red-600">{a.amount_used.toLocaleString()}</td>
                      <td className="px-4 py-3 text-green-600">{a.remaining_amount.toLocaleString()}</td>
                      <td className="px-4 py-3 text-muted-foreground">{a.settlement_type?.replace(/_/g, ' ') ?? '—'}</td>
                      <td className="px-4 py-3">
                        <Badge variant={STATUS_COLORS[a.status] ?? 'secondary'}>{a.status.replace(/_/g, ' ')}</Badge>
                      </td>
                    </tr>
                  ))}
                  {advances.length === 0 && (
                    <tr><td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">No advances recorded.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <Card className="w-full max-w-md">
            <CardContent className="pt-6">
              <h3 className="text-lg font-semibold mb-4">Issue Advance</h3>
              <form onSubmit={handleCreate} className="space-y-4">
                <div className="space-y-1">
                  <Label>Employee ID *</Label>
                  <Input placeholder="User UUID" value={form.employee_id} onChange={e => setForm(f => ({ ...f, employee_id: e.target.value }))} required />
                </div>
                <div className="space-y-1">
                  <Label>Amount *</Label>
                  <Input type="number" step="0.01" min="0.01" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} required />
                </div>
                <div className="space-y-1">
                  <Label>Purpose *</Label>
                  <Input value={form.purpose} onChange={e => setForm(f => ({ ...f, purpose: e.target.value }))} required />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label>Date Issued *</Label>
                    <Input type="date" value={form.date_issued} onChange={e => setForm(f => ({ ...f, date_issued: e.target.value }))} required />
                  </div>
                  <div className="space-y-1">
                    <Label>Settlement Type</Label>
                    <Select value={form.settlement_type} onChange={e => setForm(f => ({ ...f, settlement_type: e.target.value }))}>
                      <option value="salary_deduction">Salary Deduction</option>
                      <option value="refund">Refund</option>
                    </Select>
                  </div>
                </div>
                <div className="flex gap-2 justify-end pt-2">
                  <Button type="button" variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
                  <Button type="submit" disabled={submitting}>{submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Save</Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
