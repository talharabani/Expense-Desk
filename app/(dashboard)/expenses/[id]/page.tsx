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
  ArrowLeft, Pencil, Trash2, Loader2, Calendar,
  CreditCard, Tag, FileText, DollarSign, Check, X, Briefcase,
} from 'lucide-react'

interface Expense {
  id: string
  title: string
  category: string
  amount: number
  currency: string
  converted_amount: number
  exchange_rate: number
  expense_date: string
  payment_method: string | null
  status: string
  description: string | null
  business_purpose: string | null
  tax_amount: number
  is_recurring: boolean
  recurrence: string | null
  created_at: string
  receipt?: {
    id: string
    original_filename: string
  } | null
}

type BV = 'default' | 'secondary' | 'destructive' | 'outline' | 'success' | 'warning'

const STATUS_COLORS: Record<string, BV> = {
  draft: 'secondary',
  submitted: 'default',
  under_review: 'warning',
  approved: 'success',
  rejected: 'destructive',
  paid: 'success',
  cancelled: 'outline',
  reimbursed: 'success',
}

const EXPENSE_STATUSES = [
  'draft','submitted','under_review','approved','rejected',
  'paid','partially_paid','reimbursement_pending','reimbursed','cancelled',
]

const CATEGORIES = [
  'salaries','rent','utilities','software','hardware','marketing',
  'travel','meals','office_supplies','insurance','professional_services',
  'maintenance','training','subscriptions','miscellaneous',
]

export default function ExpenseDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()

  const [expense, setExpense] = useState<Expense | null>(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [form, setForm] = useState({
    title: '', category: 'miscellaneous', amount: '', currency: 'PKR',
    exchange_rate: '', expense_date: '', payment_method: 'bank',
    description: '', business_purpose: '', status: 'draft',
  })
  const [receiptFile, setReceiptFile] = useState<File | null>(null)
  const [viewingReceipt, setViewingReceipt] = useState(false)

  async function handleViewReceipt(documentId: string) {
    try {
      setViewingReceipt(true)
      const r = await fetch(`/api/documents/${documentId}`)
      if (!r.ok) throw new Error('Failed to fetch signed URL')
      const { url } = await r.json()
      window.open(url, '_blank')
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to view receipt')
    } finally {
      setViewingReceipt(false)
    }
  }

  const load = useCallback(async () => {
    const r = await fetch(`/api/expenses/${id}`)
    if (r.ok) {
      const d = await r.json()
      setExpense(d)
      setForm({
        title: d.title,
        category: d.category,
        amount: String(d.amount),
        currency: d.currency,
        exchange_rate: String(d.exchange_rate),
        expense_date: d.expense_date,
        payment_method: d.payment_method ?? 'bank',
        description: d.description ?? '',
        business_purpose: d.business_purpose ?? '',
        status: d.status,
      })
    } else {
      setError('Expense not found')
    }
    setLoading(false)
  }, [id])

  useAsyncEffect(load)

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    // 1. Validate description is present for all expenses
    if (!form.description.trim()) {
      setError('Description is required for all expenses.')
      return
    }

    // 2. Validate receipt file is present if bank transfer and no previous receipt exists
    if (form.payment_method === 'bank' && !receiptFile && !expense?.receipt) {
      setError('Receipt upload is required for Bank Transfer payments.')
      return
    }

    setSubmitting(true)
    try {
      const r = await fetch(`/api/expenses/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          amount: Number(form.amount),
          exchange_rate: form.exchange_rate ? Number(form.exchange_rate) : undefined,
        }),
      })

      if (!r.ok) {
        const errData = await r.json()
        setError(errData.error || 'Failed to save expense details')
        setSubmitting(false)
        return
      }

      // 3. Upload new receipt if selected
      if (receiptFile) {
        const formData = new FormData()
        formData.append('file', receiptFile)
        formData.append('entityType', 'expense')
        formData.append('entityId', id)
        formData.append('documentType', 'receipt')

        const docRes = await fetch('/api/documents', {
          method: 'POST',
          body: formData,
        })

        if (!docRes.ok) {
          const docErr = await docRes.json()
          setError(`Details saved but receipt upload failed: ${docErr.error}`)
          setSubmitting(false)
          load()
          return
        }
      }

      // Success
      setEditing(false)
      setReceiptFile(null)
      load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete() {
    setSubmitting(true)
    const r = await fetch(`/api/expenses/${id}`, { method: 'DELETE' })
    if (r.ok) router.push('/expenses')
    else setError((await r.json()).error)
    setSubmitting(false)
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
    </div>
  )

  if (!expense) return (
    <div className="max-w-2xl mx-auto py-12 text-center space-y-4">
      <p className="text-muted-foreground">Expense not found.</p>
      <Link href="/expenses"><Button variant="outline"><ArrowLeft className="mr-2 h-4 w-4" />Back</Button></Link>
    </div>
  )

  return (
    <div className="max-w-2xl mx-auto space-y-6">

      <div className="flex items-center justify-between">
        <Link href="/expenses">
          <Button variant="ghost" size="sm" className="gap-2 text-muted-foreground hover:text-foreground -ml-2">
            <ArrowLeft className="h-4 w-4" /> Back to Expenses
          </Button>
        </Link>
        {!editing && (
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="gap-2" onClick={() => setEditing(true)}>
              <Pencil className="h-3.5 w-3.5" /> Edit
            </Button>
            <Button variant="outline" size="sm"
              className="gap-2 text-red-600 border-red-200 hover:bg-red-50 hover:border-red-300"
              onClick={() => setDeleting(true)}>
              <Trash2 className="h-3.5 w-3.5" /> Delete
            </Button>
          </div>
        )}
      </div>

      {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}

      {deleting && (
        <div className="rounded-xl border border-red-200 bg-red-50 dark:bg-red-950/30 p-5 space-y-4">
          <div>
            <p className="font-semibold text-red-800 dark:text-red-200">Delete &ldquo;{expense.title}&rdquo;?</p>
            <p className="text-sm text-red-600 dark:text-red-400 mt-1">
              {expense.currency} {Number(expense.amount).toLocaleString()} · {expense.status}
            </p>
            <p className="text-xs text-red-500 mt-2">This record will be archived.</p>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" className="flex-1" onClick={() => setDeleting(false)}>Cancel</Button>
            <Button className="flex-1 bg-red-600 hover:bg-red-700 text-white" onClick={handleDelete} disabled={submitting}>
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Yes, delete'}
            </Button>
          </div>
        </div>
      )}

      {!editing && !deleting && (
        <div className="space-y-5">
          <div className="rounded-2xl border bg-card p-6 space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h1 className="text-2xl font-bold tracking-tight">{expense.title}</h1>
                <p className="text-sm text-muted-foreground mt-1">
                  {new Date(expense.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
                </p>
              </div>
              <Badge variant={STATUS_COLORS[expense.status] ?? 'secondary'} className="text-sm px-3 py-1 mt-1 whitespace-nowrap">
                {expense.status.replace(/_/g, ' ')}
              </Badge>
            </div>
            <div className="border-t pt-4">
              <p className="text-xs text-muted-foreground uppercase tracking-widest font-medium mb-1 flex items-center gap-1.5">
                <DollarSign className="h-3 w-3" /> Amount
              </p>
              <p className="text-4xl font-bold tabular-nums">
                <span className="text-xl font-medium text-muted-foreground mr-2">{expense.currency}</span>
                {Number(expense.amount).toLocaleString()}
              </p>
              {expense.currency !== 'PKR' && (
                <p className="text-sm text-muted-foreground mt-1">≈ PKR {Number(expense.converted_amount).toLocaleString()} · rate {expense.exchange_rate}</p>
              )}
              {expense.tax_amount > 0 && (
                <p className="text-sm text-muted-foreground mt-0.5">Tax: {expense.currency} {Number(expense.tax_amount).toLocaleString()}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-xl border bg-card p-4 space-y-1">
              <p className="text-xs text-muted-foreground flex items-center gap-1.5"><Calendar className="h-3.5 w-3.5" /> Expense Date</p>
              <p className="font-medium">{expense.expense_date}</p>
            </div>
            <div className="rounded-xl border bg-card p-4 space-y-1">
              <p className="text-xs text-muted-foreground flex items-center gap-1.5"><CreditCard className="h-3.5 w-3.5" /> Payment Method</p>
              <p className="font-medium capitalize">{expense.payment_method?.replace(/_/g, ' ') ?? '—'}</p>
            </div>
            <div className="rounded-xl border bg-card p-4 space-y-1">
              <p className="text-xs text-muted-foreground flex items-center gap-1.5"><Tag className="h-3.5 w-3.5" /> Category</p>
              <p className="font-medium capitalize">{expense.category.replace(/_/g, ' ')}</p>
            </div>
            {expense.is_recurring && (
              <div className="rounded-xl border bg-card p-4 space-y-1">
                <p className="text-xs text-muted-foreground flex items-center gap-1.5"><Calendar className="h-3.5 w-3.5" /> Recurrence</p>
                <p className="font-medium capitalize">{expense.recurrence ?? 'Recurring'}</p>
              </div>
            )}
          </div>

          {expense.business_purpose && (
            <div className="rounded-xl border bg-card p-5 space-y-2">
              <p className="text-xs text-muted-foreground flex items-center gap-1.5 uppercase tracking-widest font-medium">
                <Briefcase className="h-3.5 w-3.5" /> Business Purpose
              </p>
              <p className="text-sm leading-relaxed">{expense.business_purpose}</p>
            </div>
          )}

          <div className="rounded-xl border bg-card p-5 space-y-2">
            <p className="text-xs text-muted-foreground flex items-center gap-1.5 uppercase tracking-widest font-medium">
              <FileText className="h-3.5 w-3.5" /> Description
            </p>
            {expense.description
              ? <p className="text-sm leading-relaxed">{expense.description}</p>
              : <p className="text-sm text-muted-foreground italic">No description provided</p>
            }
          </div>

          {/* Receipt display block */}
          <div className="rounded-xl border bg-card p-5 space-y-2">
            <p className="text-xs text-muted-foreground flex items-center gap-1.5 uppercase tracking-widest font-medium">
              <FileText className="h-3.5 w-3.5" /> Receipt Document
            </p>
            {expense.receipt ? (
              <div className="flex items-center justify-between bg-[#e4ebe8]/20 border border-[#e4ebe8]/40 rounded-xl p-3">
                <div className="flex items-center gap-2 truncate">
                  <FileText className="h-4 w-4 text-[#c19a3b] flex-shrink-0" />
                  <span className="text-xs font-semibold text-[#2c443e] truncate">{expense.receipt.original_filename}</span>
                </div>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => handleViewReceipt(expense.receipt!.id)}
                  disabled={viewingReceipt}
                  className="border-[#e4ebe8] hover:border-[#c19a3b] hover:bg-[#c19a3b]/5 text-[#c19a3b] text-xs h-8"
                >
                  {viewingReceipt ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1 text-[#c19a3b]" /> : null}
                  View Receipt
                </Button>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground italic">No receipt document uploaded.</p>
            )}
          </div>
        </div>
      )}

      {editing && (
        <form onSubmit={handleSave} className="rounded-2xl border bg-card p-6 space-y-5">
          <h2 className="font-semibold text-lg">Edit Expense</h2>

          <div className="space-y-1.5">
            <Label>Title *</Label>
            <Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} required />
          </div>

          <div className="grid grid-cols-2 gap-4">
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

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Category *</Label>
              <Select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
                {CATEGORIES.map(c => <option key={c} value={c}>{c.replace(/_/g, ' ')}</option>)}
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Expense Date *</Label>
              <Input type="date" value={form.expense_date} onChange={e => setForm(f => ({ ...f, expense_date: e.target.value }))} required />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Payment Method</Label>
              <Select value={form.payment_method} onChange={e => setForm(f => ({ ...f, payment_method: e.target.value }))}>
                {['bank','cash','credit_card','digital_wallet'].map(m => <option key={m} value={m}>{m.replace(/_/g, ' ')}</option>)}
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
                {EXPENSE_STATUSES.map(s => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Business Purpose</Label>
            <Input placeholder="Why was this expense incurred?" value={form.business_purpose} onChange={e => setForm(f => ({ ...f, business_purpose: e.target.value }))} />
          </div>

          <div className="space-y-1.5">
            <Label>Description *</Label>
            <textarea
              rows={3}
              required
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Receipt Document {form.payment_method === 'bank' && !expense?.receipt ? '*' : '(Optional)'}</Label>
            <Input
              type="file"
              accept="image/jpeg,image/png,image/webp,application/pdf"
              onChange={e => setReceiptFile(e.target.files?.[0] || null)}
              className="bg-white border-gray-200 file:mr-2 file:bg-gray-100 file:border-none file:px-2 file:py-1 file:rounded file:text-xs"
            />
            <p className="text-[10px] text-muted-foreground leading-tight">
              Supported formats: JPEG, PNG, WebP, PDF (Max 10MB).
              {form.payment_method === 'bank' && !expense?.receipt && (
                <span className="text-red-500 font-bold block mt-0.5">Required for Bank Transfer payments.</span>
              )}
            </p>
          </div>

          <div className="flex gap-3">
            <Button type="button" variant="outline" className="flex-1 gap-2" onClick={() => setEditing(false)}>
              <X className="h-4 w-4" /> Cancel
            </Button>
            <Button type="submit" className="flex-1 gap-2" disabled={submitting}>
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              Save Changes
            </Button>
          </div>
        </form>
      )}
    </div>
  )
}
