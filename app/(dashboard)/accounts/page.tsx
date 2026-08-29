'use client'

import { useCallback, useState } from 'react'
import { useAsyncEffect } from '@/lib/hooks/use-async-effect'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Plus, Wallet, ArrowLeftRight, Loader2 } from 'lucide-react'

interface Account {
  id: string
  name: string
  account_type: string
  currency: string
  opening_balance: number
  current_balance: number
}

function fmt(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(n)
}

export default function AccountsPage() {
  const [accounts, setAccounts] = useState<Account[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [showTransfer, setShowTransfer] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const [form, setForm] = useState({ name: '', account_type: 'bank', currency: 'PKR', opening_balance: '0' })
  const [transfer, setTransfer] = useState({ fromId: '', toId: '', amount: '' })

  const load = useCallback(async () => {
    const r = await fetch('/api/accounts')
    if (!r.ok) { setError('Failed to load accounts'); setLoading(false); return }
    setAccounts(await r.json())
    setLoading(false)
  }, [])

  useAsyncEffect(load)

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    const r = await fetch('/api/accounts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, opening_balance: Number(form.opening_balance) }),
    })
    if (r.ok) { setShowCreate(false); setForm({ name: '', account_type: 'bank', currency: 'PKR', opening_balance: '0' }); load() }
    else setError((await r.json()).error)
    setSubmitting(false)
  }

  async function handleTransfer(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    const r = await fetch(`/api/accounts/${transfer.fromId}/transfer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ toAccountId: transfer.toId, amount: Number(transfer.amount) }),
    })
    if (r.ok) { setShowTransfer(false); setTransfer({ fromId: '', toId: '', amount: '' }); load() }
    else setError((await r.json()).error)
    setSubmitting(false)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Accounts</h2>
          <p className="text-sm text-muted-foreground">Manage company financial accounts</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowTransfer(true)}>
            <ArrowLeftRight className="mr-2 h-4 w-4" /> Transfer
          </Button>
          <Button onClick={() => setShowCreate(true)}>
            <Plus className="mr-2 h-4 w-4" /> Add Account
          </Button>
        </div>
      </div>

      {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {accounts.map((a) => (
            <Card key={a.id}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">{a.name}</CardTitle>
                <Wallet className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{fmt(a.current_balance)}</div>
                <div className="mt-1 flex items-center justify-between text-xs text-muted-foreground">
                  <span>Opening: {fmt(a.opening_balance)}</span>
                  <Badge variant="secondary">{a.account_type.replace(/_/g, ' ')}</Badge>
                </div>
                <div className="mt-1 text-xs text-muted-foreground">{a.currency}</div>
              </CardContent>
            </Card>
          ))}
          {accounts.length === 0 && (
            <p className="text-sm text-muted-foreground col-span-3">No accounts yet. Add one to get started.</p>
          )}
        </div>
      )}

      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <Card className="w-full max-w-md mx-4">
            <CardHeader><CardTitle>Create Account</CardTitle></CardHeader>
            <CardContent>
              <form onSubmit={handleCreate} className="space-y-4">
                <div className="space-y-1">
                  <Label htmlFor="acc-name">Account Name</Label>
                  <Input id="acc-name" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="acc-type">Type</Label>
                  <Select id="acc-type" value={form.account_type} onChange={e => setForm(f => ({ ...f, account_type: e.target.value }))}>
                    {['bank', 'petty_cash', 'personal', 'credit_card', 'debit_card', 'digital_wallet'].map(t => (
                      <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>
                    ))}
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="acc-currency">Currency</Label>
                  <Select id="acc-currency" value={form.currency} onChange={e => setForm(f => ({ ...f, currency: e.target.value }))}>
                    {['PKR', 'USD', 'EUR', 'GBP', 'AED'].map(c => <option key={c} value={c}>{c}</option>)}
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="acc-balance">Opening Balance</Label>
                  <Input id="acc-balance" type="number" step="0.01" value={form.opening_balance} onChange={e => setForm(f => ({ ...f, opening_balance: e.target.value }))} />
                </div>
                <div className="flex gap-2 justify-end">
                  <Button type="button" variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
                  <Button type="submit" disabled={submitting}>{submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Create</Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}

      {showTransfer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <Card className="w-full max-w-md mx-4">
            <CardHeader><CardTitle>Transfer Funds</CardTitle></CardHeader>
            <CardContent>
              <form onSubmit={handleTransfer} className="space-y-4">
                <div className="space-y-1">
                  <Label>From Account</Label>
                  <Select value={transfer.fromId} onChange={e => setTransfer(t => ({ ...t, fromId: e.target.value }))} required>
                    <option value="">Select account</option>
                    {accounts.map(a => <option key={a.id} value={a.id}>{a.name} ({fmt(a.current_balance)})</option>)}
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>To Account</Label>
                  <Select value={transfer.toId} onChange={e => setTransfer(t => ({ ...t, toId: e.target.value }))} required>
                    <option value="">Select account</option>
                    {accounts.filter(a => a.id !== transfer.fromId).map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>Amount</Label>
                  <Input type="number" step="0.01" min="0.01" value={transfer.amount} onChange={e => setTransfer(t => ({ ...t, amount: e.target.value }))} required />
                </div>
                <div className="flex gap-2 justify-end">
                  <Button type="button" variant="outline" onClick={() => setShowTransfer(false)}>Cancel</Button>
                  <Button type="submit" disabled={submitting}>{submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Transfer</Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
