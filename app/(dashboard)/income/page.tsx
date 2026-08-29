'use client'

import { useCallback, useState } from 'react'
import { useAsyncEffect } from '@/lib/hooks/use-async-effect'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Plus, Loader2, Search, TrendingUp, TrendingDown,
  ArrowUpRight, Clock, CheckCircle2, XCircle, Circle,
} from 'lucide-react'

interface Income {
  id: string
  title: string
  amount: number
  currency: string
  converted_amount: number
  payment_date: string | null
  payment_method: string | null
  status: string
  invoice_number: string | null
  description: string | null
}

type BV = 'default' | 'secondary' | 'destructive' | 'outline' | 'success' | 'warning'

const STATUS_META: Record<string, { color: BV; icon: React.ReactNode; dot: string }> = {
  draft:           { color: 'secondary', icon: <Circle className="h-3 w-3" />,        dot: 'bg-gray-400' },
  invoice_created: { color: 'secondary', icon: <Circle className="h-3 w-3" />,        dot: 'bg-blue-400' },
  payment_pending: { color: 'warning',   icon: <Clock className="h-3 w-3" />,         dot: 'bg-yellow-400' },
  advance_payment: { color: 'default',   icon: <TrendingUp className="h-3 w-3" />,    dot: 'bg-blue-500' },
  partially_paid:  { color: 'warning',   icon: <Clock className="h-3 w-3" />,         dot: 'bg-orange-400' },
  fully_paid:      { color: 'success',   icon: <CheckCircle2 className="h-3 w-3" />,  dot: 'bg-green-500' },
  overdue:         { color: 'destructive',icon: <XCircle className="h-3 w-3" />,      dot: 'bg-red-500' },
  cancelled:       { color: 'outline',   icon: <XCircle className="h-3 w-3" />,       dot: 'bg-gray-300' },
  refunded:        { color: 'outline',   icon: <TrendingDown className="h-3 w-3" />,  dot: 'bg-purple-400' },
}

const ALL_STATUSES = Object.keys(STATUS_META)

const EMPTY = {
  title: '', amount: '', currency: 'PKR', exchange_rate: '',
  payment_date: new Date().toISOString().slice(0, 10),
  payment_method: 'bank', invoice_number: '', description: '', status: 'payment_pending',
}

function fmt(n: number) {
  return new Intl.NumberFormat('en-PK', { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(n)
}

export default function IncomePage() {
  const router = useRouter()
  const [income, setIncome] = useState<Income[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState(EMPTY)
  const [submitting, setSubmitting] = useState(false)

  const load = useCallback(async () => {
    const p = new URLSearchParams()
    if (statusFilter) p.set('status', statusFilter)
    const r = await fetch('/api/income?' + p)
    if (!r.ok) { setError('Failed to load'); setLoading(false); return }
    setIncome((await r.json()).data ?? [])
    setLoading(false)
  }, [statusFilter])

  useAsyncEffect(load)

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    const r = await fetch('/api/income', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...form,
        amount: Number(form.amount),
        exchange_rate: form.exchange_rate ? Number(form.exchange_rate) : undefined,
      }),
    })
    if (r.ok) { setShowCreate(false); setForm(EMPTY); load() }
    else setError((await r.json()).error)
    setSubmitting(false)
  }

  const filtered = income.filter(i =>
    i.title.toLowerCase().includes(search.toLowerCase()) ||
    (i.invoice_number ?? '').toLowerCase().includes(search.toLowerCase())
  )

  const totalPaid    = income.filter(i => ['fully_paid', 'advance_payment'].includes(i.status)).reduce((s, i) => s + Number(i.converted_amount), 0)
  const totalPending = income.filter(i => ['payment_pending','partially_paid','overdue','advance_payment'].includes(i.status)).reduce((s, i) => s + Number(i.converted_amount), 0)
  const totalCount   = income.length

  return (
    <div className="space-y-6 p-1">

      {/* ── Page header ── */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">Income</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{totalCount} record{totalCount !== 1 ? 's' : ''} total</p>
        </div>
        <Button onClick={() => setShowCreate(true)} className="gap-2 shadow-sm">
          <Plus className="h-4 w-4" /> Add Income
        </Button>
      </div>

      {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}

      {/* ── KPI cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Total Received</span>
            <span className="h-8 w-8 rounded-full bg-green-100 dark:bg-green-900/40 flex items-center justify-center">
              <TrendingUp className="h-4 w-4 text-green-600 dark:text-green-400" />
            </span>
          </div>
          <p className="text-2xl font-bold text-gray-900 dark:text-white tabular-nums">PKR {fmt(totalPaid)}</p>
          <p className="text-xs text-gray-400 mt-1">{income.filter(i => ['fully_paid', 'advance_payment'].includes(i.status)).length} received</p>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Outstanding</span>
            <span className="h-8 w-8 rounded-full bg-yellow-100 dark:bg-yellow-900/40 flex items-center justify-center">
              <Clock className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
            </span>
          </div>
          <p className="text-2xl font-bold text-gray-900 dark:text-white tabular-nums">PKR {fmt(totalPending)}</p>
          <p className="text-xs text-gray-400 mt-1">{income.filter(i => ['payment_pending','partially_paid','advance_payment'].includes(i.status)).length} awaiting payment</p>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Overdue</span>
            <span className="h-8 w-8 rounded-full bg-red-100 dark:bg-red-900/40 flex items-center justify-center">
              <XCircle className="h-4 w-4 text-red-500" />
            </span>
          </div>
          <p className="text-2xl font-bold text-red-600 dark:text-red-400 tabular-nums">
            {income.filter(i => i.status === 'overdue').length}
          </p>
          <p className="text-xs text-gray-400 mt-1">overdue invoices</p>
        </div>
      </div>

      {/* ── Filters ── */}
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
          <Input
            placeholder="Search by title or invoice number…"
            className="pl-9 bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <Select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          className="w-48 bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700"
        >
          <option value="">All statuses</option>
          {ALL_STATUSES.map(s => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
        </Select>
      </div>

      {/* ── Income cards ── */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-7 w-7 animate-spin text-gray-400" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-dashed border-gray-200 dark:border-gray-700 py-20 text-center">
          <TrendingUp className="h-12 w-12 mx-auto text-gray-200 dark:text-gray-600 mb-4" />
          <p className="font-semibold text-gray-500 dark:text-gray-400">No income records</p>
          <p className="text-sm text-gray-400 mt-1">
            {search || statusFilter ? 'Try adjusting your filters' : 'Add your first income record to get started'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map(inc => {
            const meta = STATUS_META[inc.status] ?? STATUS_META.draft
            return (
              <button
                key={inc.id}
                onClick={() => router.push(`/income/${inc.id}`)}
                className="group text-left bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm hover:shadow-md hover:border-gray-300 dark:hover:border-gray-500 transition-all duration-200 p-5 w-full"
              >
                {/* Card header */}
                <div className="flex items-start justify-between gap-3 mb-4">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900 dark:text-white truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors text-[15px]">
                      {inc.title}
                    </p>
                    {inc.invoice_number && (
                      <p className="text-xs text-gray-400 font-mono mt-0.5">#{inc.invoice_number}</p>
                    )}
                  </div>
                  <ArrowUpRight className="h-4 w-4 text-gray-300 group-hover:text-blue-500 transition-colors flex-shrink-0 mt-0.5" />
                </div>

                {/* Amount */}
                <div className="mb-4">
                  <p className="text-2xl font-bold text-gray-900 dark:text-white tabular-nums">
                    {inc.currency} {fmt(Number(inc.amount))}
                  </p>
                  {inc.description && (
                    <p className="text-xs text-gray-400 mt-1 line-clamp-2 leading-relaxed">{inc.description}</p>
                  )}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between pt-3 border-t border-gray-50 dark:border-gray-700">
                  <div className="flex items-center gap-1.5">
                    <span className={`h-2 w-2 rounded-full flex-shrink-0 ${meta.dot}`} />
                    <Badge variant={meta.color} className="text-xs font-medium">
                      {inc.status.replace(/_/g, ' ')}
                    </Badge>
                  </div>
                  <div className="text-right">
                    {inc.payment_date && (
                      <p className="text-xs text-gray-400">{inc.payment_date}</p>
                    )}
                    {inc.payment_method && (
                      <p className="text-xs text-gray-400 capitalize">{inc.payment_method.replace(/_/g, ' ')}</p>
                    )}
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      )}

      {/* ── Create modal ── */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto border border-gray-100 dark:border-gray-700">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Record Income</h2>
              <button onClick={() => { setShowCreate(false); setError(null) }} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors">
                <XCircle className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCreate} className="px-6 py-5 space-y-4">
              <div className="space-y-1.5">
                <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">Title *</Label>
                <Input placeholder="e.g. Client payment – April" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} required />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">Amount *</Label>
                  <Input type="number" step="0.01" min="0.01" placeholder="0.00" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} required />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">Currency</Label>
                  <Select value={form.currency} onChange={e => setForm(f => ({ ...f, currency: e.target.value }))}>
                    {['PKR','USD','EUR','GBP','AED'].map(c => <option key={c} value={c}>{c}</option>)}
                  </Select>
                </div>
              </div>

              {form.currency !== 'PKR' && (
                <div className="space-y-1.5">
                  <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">Exchange Rate (to PKR) *</Label>
                  <Input type="number" step="0.0001" placeholder="e.g. 278.5" value={form.exchange_rate} onChange={e => setForm(f => ({ ...f, exchange_rate: e.target.value }))} required />
                </div>
              )}

              <div className="space-y-1.5">
                <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">Invoice Number</Label>
                <Input placeholder="INV-001" value={form.invoice_number} onChange={e => setForm(f => ({ ...f, invoice_number: e.target.value }))} />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">Payment Date</Label>
                  <Input type="date" value={form.payment_date} onChange={e => setForm(f => ({ ...f, payment_date: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">Method</Label>
                  <Select value={form.payment_method} onChange={e => setForm(f => ({ ...f, payment_method: e.target.value }))}>
                    {['bank','cash','credit_card','digital_wallet','cheque'].map(m => <option key={m} value={m}>{m.replace(/_/g, ' ')}</option>)}
                  </Select>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">Status</Label>
                <Select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
                  {ALL_STATUSES.map(s => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">Description</Label>
                <textarea
                  rows={3}
                  className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none transition-colors"
                  placeholder="Add notes, context, or payment details…"
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                />
              </div>

              {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}

              <div className="flex gap-3 pt-1">
                <Button type="button" variant="outline" className="flex-1" onClick={() => { setShowCreate(false); setError(null) }}>
                  Cancel
                </Button>
                <Button type="submit" className="flex-1" disabled={submitting}>
                  {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Save Income
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
