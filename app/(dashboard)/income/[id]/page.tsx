'use client'

import { useCallback, useState } from 'react'
import { useAsyncEffect } from '@/lib/hooks/use-async-effect'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  ArrowLeft, Pencil, Trash2, Loader2,
  Check, X,
  Calendar, CreditCard, Hash, FileText,
} from 'lucide-react'

interface Income {
  id: string
  title: string
  amount: number
  currency: string
  converted_amount: number
  exchange_rate: number
  payment_date: string | null
  payment_method: string | null
  status: string
  invoice_number: string | null
  description: string | null
  tax_amount: number
  created_at: string
  updated_at: string
}

type BV = 'default' | 'secondary' | 'destructive' | 'outline' | 'success' | 'warning'

const STATUS_META: Record<string, { color: BV; dot: string; label: string }> = {
  draft:           { color: 'secondary',  dot: 'bg-gray-400',   label: 'Draft' },
  invoice_created: { color: 'secondary',  dot: 'bg-blue-400',   label: 'Invoice Created' },
  payment_pending: { color: 'warning',    dot: 'bg-yellow-400', label: 'Payment Pending' },
  advance_payment: { color: 'default',    dot: 'bg-blue-500',   label: 'Advance Payment' },
  partially_paid:  { color: 'warning',    dot: 'bg-orange-400', label: 'Partially Paid' },
  fully_paid:      { color: 'success',    dot: 'bg-green-500',  label: 'Fully Paid' },
  overdue:         { color: 'destructive',dot: 'bg-red-500',    label: 'Overdue' },
  cancelled:       { color: 'outline',    dot: 'bg-gray-300',   label: 'Cancelled' },
  refunded:        { color: 'outline',    dot: 'bg-purple-400', label: 'Refunded' },
}

const ALL_STATUSES = Object.keys(STATUS_META)

function fmt(n: number) {
  return new Intl.NumberFormat('en-PK', { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(n)
}

export default function IncomeDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()

  const [income, setIncome] = useState<Income | null>(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [form, setForm] = useState({
    title: '', amount: '', currency: 'PKR', exchange_rate: '',
    payment_date: '', payment_method: 'bank',
    invoice_number: '', description: '', status: 'payment_pending',
  })

  const load = useCallback(async () => {
    const r = await fetch(`/api/income/${id}`)
    if (r.ok) {
      const d = await r.json()
      setIncome(d)
      setForm({
        title: d.title, amount: String(d.amount),
        currency: d.currency, exchange_rate: String(d.exchange_rate),
        payment_date: d.payment_date ?? '', payment_method: d.payment_method ?? 'bank',
        invoice_number: d.invoice_number ?? '', description: d.description ?? '',
        status: d.status,
      })
    } else { setError('Income record not found') }
    setLoading(false)
  }, [id])

  useAsyncEffect(load)

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    const r = await fetch(`/api/income/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, amount: Number(form.amount), exchange_rate: form.exchange_rate ? Number(form.exchange_rate) : undefined }),
    })
    if (r.ok) { setIncome(await r.json()); setEditing(false) }
    else setError((await r.json()).error)
    setSubmitting(false)
  }

  async function handleDelete() {
    setSubmitting(true)
    const r = await fetch(`/api/income/${id}`, { method: 'DELETE' })
    if (r.ok) router.push('/income')
    else setError((await r.json()).error)
    setSubmitting(false)
  }

  if (loading) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
    </div>
  )

  if (!income) return (
    <div className="max-w-2xl mx-auto py-16 text-center space-y-4">
      <p className="text-gray-500">Income record not found.</p>
      <Link href="/income"><Button variant="outline"><ArrowLeft className="mr-2 h-4 w-4" />Back to Income</Button></Link>
    </div>
  )

  const meta = STATUS_META[income.status] ?? STATUS_META.draft

  return (
    <div className="max-w-2xl mx-auto space-y-5">

      {/* Back + actions */}
      <div className="flex items-center justify-between">
        <Link href="/income">
          <Button variant="ghost" size="sm" className="gap-2 text-gray-500 hover:text-gray-900 dark:hover:text-white -ml-1">
            <ArrowLeft className="h-4 w-4" /> Income
          </Button>
        </Link>
        {!editing && !deleting && (
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="gap-1.5 h-8" onClick={() => { setEditing(true); setError(null) }}>
              <Pencil className="h-3.5 w-3.5" /> Edit
            </Button>
            <Button
              variant="outline" size="sm"
              className="gap-1.5 h-8 text-red-600 border-red-200 hover:bg-red-50 hover:border-red-300 dark:border-red-800 dark:hover:bg-red-950"
              onClick={() => setDeleting(true)}
            >
              <Trash2 className="h-3.5 w-3.5" /> Delete
            </Button>
          </div>
        )}
      </div>

      {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}

      {/* Delete confirm */}
      {deleting && (
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-red-200 dark:border-red-800 shadow-sm p-6 space-y-4">
          <div className="flex items-start gap-3">
            <div className="h-10 w-10 rounded-full bg-red-100 dark:bg-red-900/40 flex items-center justify-center flex-shrink-0">
              <Trash2 className="h-5 w-5 text-red-600" />
            </div>
            <div>
              <p className="font-semibold text-gray-900 dark:text-white">Delete this income?</p>
              <p className="text-sm text-gray-500 mt-0.5">{income.title} · {income.currency} {fmt(Number(income.amount))}</p>
              <p className="text-xs text-red-500 mt-2">This record will be archived and hidden from your income list.</p>
            </div>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" className="flex-1" onClick={() => setDeleting(false)}>Keep it</Button>
            <Button className="flex-1 bg-red-600 hover:bg-red-700 text-white" onClick={handleDelete} disabled={submitting}>
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Yes, delete'}
            </Button>
          </div>
        </div>
      )}

      {/* View */}
      {!editing && !deleting && (
        <div className="space-y-4">
          {/* Hero */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden">
            {/* Coloured top strip based on status */}
            <div className={`h-1.5 w-full ${meta.dot.replace('bg-', 'bg-')}`} />
            <div className="p-6">
              <div className="flex items-start justify-between gap-4 mb-5">
                <div>
                  <h1 className="text-xl font-bold text-gray-900 dark:text-white leading-snug">{income.title}</h1>
                  <p className="text-sm text-gray-400 mt-1">
                    Added {new Date(income.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
                  </p>
                </div>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className={`h-2 w-2 rounded-full ${meta.dot}`} />
                  <Badge variant={meta.color} className="whitespace-nowrap">{meta.label}</Badge>
                </div>
              </div>

              <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4">
                <p className="text-xs text-gray-400 uppercase tracking-wider font-medium mb-1">Amount</p>
                <p className="text-4xl font-bold text-gray-900 dark:text-white tabular-nums">
                  <span className="text-2xl font-semibold text-gray-400 mr-2">{income.currency}</span>
                  {fmt(Number(income.amount))}
                </p>
                {income.currency !== 'PKR' && (
                  <p className="text-sm text-gray-400 mt-1.5">≈ PKR {fmt(Number(income.converted_amount))} · rate {income.exchange_rate}</p>
                )}
                {income.tax_amount > 0 && (
                  <p className="text-sm text-gray-400 mt-0.5">Tax: {income.currency} {fmt(Number(income.tax_amount))}</p>
                )}
              </div>
            </div>
          </div>

          {/* Details grid */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm p-4">
              <div className="flex items-center gap-2 mb-2">
                <Calendar className="h-4 w-4 text-gray-400" />
                <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Payment Date</span>
              </div>
              <p className="font-semibold text-gray-900 dark:text-white">{income.payment_date ?? '—'}</p>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm p-4">
              <div className="flex items-center gap-2 mb-2">
                <CreditCard className="h-4 w-4 text-gray-400" />
                <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Method</span>
              </div>
              <p className="font-semibold text-gray-900 dark:text-white capitalize">{income.payment_method?.replace(/_/g, ' ') ?? '—'}</p>
            </div>

            {income.invoice_number && (
              <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm p-4 col-span-2">
                <div className="flex items-center gap-2 mb-2">
                  <Hash className="h-4 w-4 text-gray-400" />
                  <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Invoice Number</span>
                </div>
                <p className="font-mono font-semibold text-gray-900 dark:text-white">{income.invoice_number}</p>
              </div>
            )}
          </div>

          {/* Description */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm p-5">
            <div className="flex items-center gap-2 mb-3">
              <FileText className="h-4 w-4 text-gray-400" />
              <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Description</span>
            </div>
            {income.description
              ? <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">{income.description}</p>
              : <p className="text-sm text-gray-400 italic">No description provided</p>
            }
          </div>
        </div>
      )}

      {/* Edit form */}
      {editing && (
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm">
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-700">
            <h2 className="font-semibold text-gray-900 dark:text-white">Edit Income</h2>
            <button onClick={() => setEditing(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
              <X className="h-4 w-4" />
            </button>
          </div>
          <form onSubmit={handleSave} className="px-6 py-5 space-y-4">
            <div className="space-y-1.5">
              <Label>Title *</Label>
              <Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} required />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Amount *</Label>
                <Input type="number" step="0.01" min="0.01" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} required />
              </div>
              <div className="space-y-1.5">
                <Label>Currency</Label>
                <Select value={form.currency} onChange={e => setForm(f => ({ ...f, currency: e.target.value }))}>
                  {['PKR','USD','EUR','GBP','AED'].map(c => <option key={c} value={c}>{c}</option>)}
                </Select>
              </div>
            </div>

            {form.currency !== 'PKR' && (
              <div className="space-y-1.5">
                <Label>Exchange Rate (to PKR) *</Label>
                <Input type="number" step="0.0001" value={form.exchange_rate} onChange={e => setForm(f => ({ ...f, exchange_rate: e.target.value }))} required />
              </div>
            )}

            <div className="space-y-1.5">
              <Label>Invoice Number</Label>
              <Input value={form.invoice_number} onChange={e => setForm(f => ({ ...f, invoice_number: e.target.value }))} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Payment Date</Label>
                <Input type="date" value={form.payment_date} onChange={e => setForm(f => ({ ...f, payment_date: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Method</Label>
                <Select value={form.payment_method} onChange={e => setForm(f => ({ ...f, payment_method: e.target.value }))}>
                  {['bank','cash','credit_card','digital_wallet','cheque'].map(m => <option key={m} value={m}>{m.replace(/_/g, ' ')}</option>)}
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
                {ALL_STATUSES.map(s => <option key={s} value={s}>{STATUS_META[s]?.label ?? s}</option>)}
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Description</Label>
              <textarea rows={3}
                className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              />
            </div>

            {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}

            <div className="flex gap-3 pt-1">
              <Button type="button" variant="outline" className="flex-1 gap-2" onClick={() => setEditing(false)}>
                <X className="h-4 w-4" /> Cancel
              </Button>
              <Button type="submit" className="flex-1 gap-2" disabled={submitting}>
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                Save Changes
              </Button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
