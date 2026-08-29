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
import { Plus, Loader2, CreditCard, AlertTriangle, Edit2, Trash2, XCircle, ArrowUpRight } from 'lucide-react'

interface Subscription {
  id: string
  tool_name: string
  plan_name: string | null
  seats: number | null
  total_cost: number
  currency: string
  billing_cycle: string
  renewal_date: string
  login_email: string | null
  notes: string | null
  status: string
  renewing_soon: boolean
  trial_expiring_soon: boolean
  vendor: { name: string } | null
}

const EMPTY_FORM = {
  tool_name: '', plan_name: '', seats: '1', total_cost: '', currency: 'USD',
  billing_cycle: 'monthly', renewal_date: '', login_email: '', notes: '', status: 'active'
}

export default function SubscriptionsPage() {
  const [subs, setSubs] = useState<Subscription[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  const [showCreate, setShowCreate] = useState(false)
  const [editingSub, setEditingSub] = useState<Subscription | null>(null)
  const [deletingSub, setDeletingSub] = useState<Subscription | null>(null)

  const [form, setForm] = useState(EMPTY_FORM)
  const [submitting, setSubmitting] = useState(false)

  const load = useCallback(async () => {
    const r = await fetch('/api/subscriptions')
    if (r.ok) setSubs(await r.json())
    else setError('Failed to load subscriptions')
    setLoading(false)
  }, [])

  useAsyncEffect(load)

  const monthlyTotal = subs.filter(s => s.status === 'active').reduce((sum, s) => {
    if (s.billing_cycle === 'monthly') return sum + s.total_cost
    if (s.billing_cycle === 'quarterly') return sum + s.total_cost / 3
    if (s.billing_cycle === 'annually') return sum + s.total_cost / 12
    return sum
  }, 0)

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      const r = await fetch('/api/subscriptions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          ...form, 
          seats: Number(form.seats), 
          total_cost: Number(form.total_cost) 
        }),
      })
      if (r.ok) { 
        setShowCreate(false)
        setForm(EMPTY_FORM)
        load() 
      } else {
        const err = await r.json()
        setError(err.error || 'Failed to create subscription')
      }
    } catch {
      setError('An error occurred during creation.')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleSaveEdit(e: React.FormEvent) {
    e.preventDefault()
    if (!editingSub) return
    setSubmitting(true)
    setError(null)
    try {
      const r = await fetch(`/api/subscriptions/${editingSub.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          seats: Number(form.seats),
          total_cost: Number(form.total_cost)
        }),
      })
      if (r.ok) {
        setEditingSub(null)
        setForm(EMPTY_FORM)
        load()
      } else {
        const err = await r.json()
        setError(err.error || 'Failed to save changes')
      }
    } catch {
      setError('An error occurred during save.')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDeleteConfirm() {
    if (!deletingSub) return
    setSubmitting(true)
    setError(null)
    try {
      const r = await fetch(`/api/subscriptions/${deletingSub.id}`, {
        method: 'DELETE'
      })
      if (r.ok) {
        setDeletingSub(null)
        load()
      } else {
        const err = await r.json()
        setError(err.error || 'Failed to delete subscription')
      }
    } catch {
      setError('An error occurred during deletion.')
    } finally {
      setSubmitting(false)
    }
  }

  function startEdit(sub: Subscription) {
    setEditingSub(sub)
    setForm({
      tool_name: sub.tool_name,
      plan_name: sub.plan_name ?? '',
      seats: String(sub.seats ?? 1),
      total_cost: String(sub.total_cost),
      currency: sub.currency,
      billing_cycle: sub.billing_cycle,
      renewal_date: sub.renewal_date,
      login_email: sub.login_email ?? '',
      notes: sub.notes ?? '',
      status: sub.status
    })
  }

  return (
    <div className="space-y-6">
      {/* Header Panel */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">Subscriptions</h1>
          <p className="text-sm text-gray-400 mt-0.5">{subs.length} subscription{subs.length !== 1 ? 's' : ''} tracked</p>
        </div>
        <Button onClick={() => { setForm(EMPTY_FORM); setShowCreate(true) }} className="gap-2 shadow-sm">
          <Plus className="h-4 w-4" /> Add Subscription
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Monthly Cost Forecast</span>
            <p className="text-3xl font-extrabold text-[#2c443e] mt-2">USD {monthlyTotal.toFixed(2)}</p>
            <p className="text-xs text-gray-400 mt-1">Annual forecast: USD {(monthlyTotal * 12).toFixed(2)}</p>
          </div>
          <span className="p-3 bg-[#e4ebe8]/40 text-[#2c443e] rounded-2xl">
            <CreditCard className="h-6 w-6 text-[#c19a3b]" />
          </span>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Renewing Soon</span>
            <p className="text-3xl font-extrabold text-[#c19a3b] mt-2">
              {subs.filter(s => s.renewing_soon && s.status === 'active').length}
            </p>
            <p className="text-xs text-gray-400 mt-1">renewals within 7 days</p>
          </div>
          <span className="p-3 bg-amber-50 text-amber-700 rounded-2xl">
            <AlertTriangle className="h-6 w-6" />
          </span>
        </div>
      </div>

      {error && <Alert variant="destructive" className="rounded-2xl border-none shadow-sm"><AlertDescription>{error}</AlertDescription></Alert>}

      {/* Subscriptions Grid / Table */}
      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-7 w-7 animate-spin text-gray-400" /></div>
      ) : (
        <Card className="border-none shadow-sm rounded-[24px] bg-white overflow-hidden">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-[#e4ebe8]/20 text-[#2c443e] border-b border-gray-100">
                    {['Tool', 'Plan', 'Seats', 'Cost', 'Billing Cycle', 'Renewal Date', 'Status', 'Actions'].map(h => (
                      <th key={h} className="px-5 py-4 text-left font-bold uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {subs.map(s => {
                    const statusColor = s.status === 'active' ? 'bg-emerald-50 text-emerald-700' : s.status === 'paused' ? 'bg-amber-50 text-amber-700' : 'bg-gray-100 text-gray-600'
                    return (
                      <tr key={s.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/50 transition-colors">
                        <td className="px-5 py-4 font-bold text-gray-900 flex items-center gap-1.5">
                          {s.tool_name}
                          {s.renewing_soon && s.status === 'active' && <AlertTriangle className="h-3.5 w-3.5 text-amber-500 flex-shrink-0 animate-pulse" />}
                        </td>
                        <td className="px-5 py-4 text-gray-500 font-medium">{s.plan_name ?? '—'}</td>
                        <td className="px-5 py-4 font-semibold text-gray-900">{s.seats ?? '—'}</td>
                        <td className="px-5 py-4 font-extrabold text-gray-900">{s.currency} {s.total_cost.toLocaleString()}</td>
                        <td className="px-5 py-4 text-gray-500 font-semibold uppercase tracking-wider">{s.billing_cycle}</td>
                        <td className="px-5 py-4 text-gray-500 font-semibold">{s.renewal_date}</td>
                        <td className="px-5 py-4">
                          <Badge className={`capitalize shadow-none border-none text-[10px] font-bold ${statusColor}`}>
                            {s.status}
                          </Badge>
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-1">
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-7 w-7 text-gray-500 hover:text-[#c19a3b] hover:bg-gray-50"
                              onClick={() => startEdit(s)}
                            >
                              <Edit2 className="h-3.5 w-3.5" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-7 w-7 text-gray-500 hover:text-rose-600 hover:bg-rose-50"
                              onClick={() => setDeletingSub(s)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                  {subs.length === 0 && (
                    <tr>
                      <td colSpan={8} className="px-5 py-12 text-center text-gray-400 font-medium italic">
                        No recurring tool subscriptions tracked yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Create Modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto border border-gray-100 overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="text-lg font-semibold text-gray-900">Add Subscription</h2>
              <button onClick={() => setShowCreate(false)} className="text-gray-400 hover:text-gray-600">
                <XCircle className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleCreate} className="px-6 py-5 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5 col-span-2">
                  <Label>Tool Name *</Label>
                  <Input value={form.tool_name} onChange={e => setForm(f => ({ ...f, tool_name: e.target.value }))} required />
                </div>
                <div className="space-y-1.5">
                  <Label>Plan Name</Label>
                  <Input placeholder="e.g. Pro, Premium" value={form.plan_name} onChange={e => setForm(f => ({ ...f, plan_name: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label>Seats</Label>
                  <Input type="number" min="1" value={form.seats} onChange={e => setForm(f => ({ ...f, seats: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label>Cost *</Label>
                  <Input type="number" step="0.01" min="0.01" value={form.total_cost} onChange={e => setForm(f => ({ ...f, total_cost: e.target.value }))} required />
                </div>
                <div className="space-y-1.5">
                  <Label>Currency</Label>
                  <Select value={form.currency} onChange={e => setForm(f => ({ ...f, currency: e.target.value }))}>
                    {['USD', 'EUR', 'GBP', 'PKR'].map(c => <option key={c} value={c}>{c}</option>)}
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Billing Cycle *</Label>
                  <Select value={form.billing_cycle} onChange={e => setForm(f => ({ ...f, billing_cycle: e.target.value }))}>
                    {['monthly', 'quarterly', 'annually'].map(c => <option key={c} value={c}>{c}</option>)}
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Renewal Date *</Label>
                  <Input type="date" value={form.renewal_date} onChange={e => setForm(f => ({ ...f, renewal_date: e.target.value }))} required />
                </div>
                <div className="space-y-1.5 col-span-2">
                  <Label>Login Email</Label>
                  <Input type="email" placeholder="e.g. billing@company.com" value={form.login_email} onChange={e => setForm(f => ({ ...f, login_email: e.target.value }))} />
                </div>
              </div>

              <div className="bg-[#e4ebe8]/20 border border-[#e4ebe8]/40 rounded-xl p-3 flex items-start gap-2">
                <ArrowUpRight className="h-4 w-4 text-[#c19a3b] mt-0.5 flex-shrink-0" />
                <p className="text-[10px] text-gray-500 leading-normal">
                  <strong>Expense Sync Active</strong>: Adding this subscription will automatically record a corresponding paid expense log for software auditing.
                </p>
              </div>

              <div className="flex gap-3 pt-2">
                <Button type="button" variant="outline" className="flex-1" onClick={() => setShowCreate(false)}>Cancel</Button>
                <Button type="submit" className="flex-1 bg-[#c19a3b] hover:bg-[#b08b30] text-white" disabled={submitting}>
                  {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Create Subscription
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editingSub && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto border border-gray-100 overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="text-lg font-semibold text-gray-900">Edit Subscription</h2>
              <button onClick={() => setEditingSub(null)} className="text-gray-400 hover:text-gray-600">
                <XCircle className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleSaveEdit} className="px-6 py-5 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5 col-span-2">
                  <Label>Tool Name *</Label>
                  <Input value={form.tool_name} onChange={e => setForm(f => ({ ...f, tool_name: e.target.value }))} required />
                </div>
                <div className="space-y-1.5">
                  <Label>Plan Name</Label>
                  <Input value={form.plan_name} onChange={e => setForm(f => ({ ...f, plan_name: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label>Seats</Label>
                  <Input type="number" min="1" value={form.seats} onChange={e => setForm(f => ({ ...f, seats: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label>Cost *</Label>
                  <Input type="number" step="0.01" min="0.01" value={form.total_cost} onChange={e => setForm(f => ({ ...f, total_cost: e.target.value }))} required />
                </div>
                <div className="space-y-1.5">
                  <Label>Currency</Label>
                  <Select value={form.currency} onChange={e => setForm(f => ({ ...f, currency: e.target.value }))}>
                    {['USD', 'EUR', 'GBP', 'PKR'].map(c => <option key={c} value={c}>{c}</option>)}
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Billing Cycle *</Label>
                  <Select value={form.billing_cycle} onChange={e => setForm(f => ({ ...f, billing_cycle: e.target.value }))}>
                    {['monthly', 'quarterly', 'annually'].map(c => <option key={c} value={c}>{c}</option>)}
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Renewal Date *</Label>
                  <Input type="date" value={form.renewal_date} onChange={e => setForm(f => ({ ...f, renewal_date: e.target.value }))} required />
                </div>
                <div className="space-y-1.5 col-span-2">
                  <Label>Status</Label>
                  <Select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
                    {['active', 'paused', 'cancelled'].map(s => <option key={s} value={s}>{s}</option>)}
                  </Select>
                </div>
                <div className="space-y-1.5 col-span-2">
                  <Label>Login Email</Label>
                  <Input type="email" value={form.login_email} onChange={e => setForm(f => ({ ...f, login_email: e.target.value }))} />
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <Button type="button" variant="outline" className="flex-1" onClick={() => setEditingSub(null)}>Cancel</Button>
                <Button type="submit" className="flex-1 bg-[#c19a3b] hover:bg-[#b08b30] text-white" disabled={submitting}>
                  {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Save Changes
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Warning */}
      {deletingSub && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm border border-gray-100 overflow-hidden p-6 space-y-4">
            <h3 className="text-lg font-bold text-gray-900">Delete Subscription?</h3>
            <p className="text-sm text-gray-400">
              Are you sure you want to delete <span className="font-semibold text-gray-900">&ldquo;{deletingSub.tool_name}&rdquo;</span>? This action is permanent and will delete the subscription record.
            </p>
            <div className="flex gap-3 pt-2">
              <Button variant="outline" className="flex-1" onClick={() => setDeletingSub(null)}>Cancel</Button>
              <Button className="flex-1 bg-red-600 hover:bg-red-700 text-white" onClick={handleDeleteConfirm} disabled={submitting}>
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Yes, Delete'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
