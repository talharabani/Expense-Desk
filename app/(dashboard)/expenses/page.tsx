'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Plus, Loader2, Search, Receipt, ArrowUpRight, XCircle, Tag, Calendar } from 'lucide-react'

interface Expense {
  id: string
  title: string
  category: string
  amount: number
  currency: string
  converted_amount: number
  expense_date: string
  payment_method: string | null
  status: string
  description: string | null
  business_purpose: string | null
}

type BV = 'default' | 'secondary' | 'destructive' | 'outline' | 'success' | 'warning'

const STATUS_META: Record<string, { color: BV; dot: string }> = {
  draft:                 { color: 'secondary',   dot: 'bg-gray-400' },
  submitted:             { color: 'default',     dot: 'bg-blue-500' },
  under_review:          { color: 'warning',     dot: 'bg-yellow-400' },
  approved:              { color: 'success',     dot: 'bg-green-500' },
  rejected:              { color: 'destructive', dot: 'bg-red-500' },
  paid:                  { color: 'success',     dot: 'bg-emerald-500' },
  partially_paid:        { color: 'warning',     dot: 'bg-orange-400' },
  reimbursement_pending: { color: 'warning',     dot: 'bg-yellow-500' },
  reimbursed:            { color: 'success',     dot: 'bg-teal-500' },
  cancelled:             { color: 'outline',     dot: 'bg-gray-300' },
}

const ALL_STATUSES = Object.keys(STATUS_META)

const CATEGORIES = [
  'salaries','rent','utilities','software','hardware','marketing',
  'travel','meals','office_supplies','insurance','professional_services',
  'maintenance','training','subscriptions','miscellaneous',
]

const EMPTY = {
  title: '', category: 'miscellaneous', amount: '', currency: 'PKR',
  exchange_rate: '', expense_date: new Date().toISOString().slice(0, 10),
  payment_method: 'bank', description: '', business_purpose: '',
}

function fmt(n: number) {
  return new Intl.NumberFormat('en-PK').format(n)
}

const CATEGORY_COLORS: Record<string, string> = {
  salaries: 'bg-blue-100 text-blue-700', rent: 'bg-purple-100 text-purple-700',
  utilities: 'bg-cyan-100 text-cyan-700', software: 'bg-indigo-100 text-indigo-700',
  hardware: 'bg-violet-100 text-violet-700', marketing: 'bg-pink-100 text-pink-700',
  travel: 'bg-sky-100 text-sky-700', meals: 'bg-orange-100 text-orange-700',
  miscellaneous: 'bg-gray-100 text-gray-600',
}

export default function ExpensesPage() {
  const router = useRouter()
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState(EMPTY)
  const [submitting, setSubmitting] = useState(false)
  const [receiptFile, setReceiptFile] = useState<File | null>(null)

  async function load() {
    setLoading(true)
    const p = new URLSearchParams()
    if (statusFilter) p.set('status', statusFilter)
    const r = await fetch('/api/expenses?' + p)
    if (!r.ok) { setError('Failed to load'); setLoading(false); return }
    setExpenses((await r.json()).data ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [statusFilter])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    // 1. Validate description is present for all expenses
    if (!form.description.trim()) {
      setError('Description is required for all expenses.')
      return
    }

    // 2. Validate receipt file is present if payment method is bank transfer
    if (form.payment_method === 'bank' && !receiptFile) {
      setError('Receipt upload is required for Bank Transfer payments.')
      return
    }

    setSubmitting(true)
    try {
      // 3. Create expense record
      const r = await fetch('/api/expenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          amount: Number(form.amount),
          exchange_rate: form.exchange_rate ? Number(form.exchange_rate) : undefined,
          status: 'submitted'
        }),
      })

      if (!r.ok) {
        const errData = await r.json()
        setError(errData.error || 'Failed to submit expense')
        setSubmitting(false)
        return
      }

      const createdExpense = await r.json()

      // 4. Upload receipt file if present
      if (receiptFile) {
        const formData = new FormData()
        formData.append('file', receiptFile)
        formData.append('entityType', 'expense')
        formData.append('entityId', createdExpense.id)
        formData.append('documentType', 'receipt')

        const docRes = await fetch('/api/documents', {
          method: 'POST',
          body: formData,
        })

        if (!docRes.ok) {
          const docErr = await docRes.json()
          setError(`Expense created but document upload failed: ${docErr.error}`)
          setSubmitting(false)
          // Still reload list
          load()
          return
        }
      }

      // Success
      setShowCreate(false)
      setForm(EMPTY)
      setReceiptFile(null)
      load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred')
    } finally {
      setSubmitting(false)
    }
  }

  const filtered = expenses.filter(e =>
    e.title.toLowerCase().includes(search.toLowerCase()) ||
    e.category.toLowerCase().includes(search.toLowerCase())
  )

  const totalPending = expenses.filter(e => ['submitted','under_review'].includes(e.status)).length
  const totalExpensesSum = expenses.filter(e => e.status !== 'cancelled').reduce((s, e) => s + Number(e.converted_amount), 0)

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">Expenses</h1>
          <p className="text-sm text-gray-400 mt-0.5">{expenses.length} record{expenses.length !== 1 ? 's' : ''} total</p>
        </div>
        <Button onClick={() => setShowCreate(true)} className="gap-2 shadow-sm">
          <Plus className="h-4 w-4" /> Add Expense
        </Button>
      </div>

      {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Pending Approval</span>
            <span className="h-8 w-8 rounded-xl bg-yellow-100 flex items-center justify-center">
              <Receipt className="h-4 w-4 text-yellow-600" />
            </span>
          </div>
          <p className="text-3xl font-bold text-gray-900">{totalPending}</p>
          <p className="text-xs text-gray-400 mt-1">awaiting review</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Total Expenses</span>
            <span className="h-8 w-8 rounded-xl bg-green-100 flex items-center justify-center">
              <Receipt className="h-4 w-4 text-green-600" />
            </span>
          </div>
          <p className="text-3xl font-bold text-[#2c443e]">PKR {fmt(totalExpensesSum)}</p>
          <p className="text-xs text-gray-400 mt-1">all active statements</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
          <Input placeholder="Search by title or category…" className="pl-9 bg-white border-gray-200" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="w-44 bg-white border-gray-200">
          <option value="">All statuses</option>
          {ALL_STATUSES.map(s => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
        </Select>
      </div>

      {/* Cards */}
      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-7 w-7 animate-spin text-gray-400" /></div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-gray-200 py-20 text-center">
          <Receipt className="h-12 w-12 mx-auto text-gray-200 mb-3" />
          <p className="font-medium text-gray-500">No expenses found</p>
          <p className="text-sm text-gray-400 mt-1">{search || statusFilter ? 'Try adjusting your filters' : 'Submit your first expense to get started'}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map(exp => {
            const meta = STATUS_META[exp.status] ?? STATUS_META.draft
            const catColor = CATEGORY_COLORS[exp.category] ?? 'bg-gray-100 text-gray-600'
            return (
              <button
                key={exp.id}
                onClick={() => router.push(`/expenses/${exp.id}`)}
                className="group text-left bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md hover:border-gray-300 transition-all duration-200 p-5 w-full"
              >
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900 truncate group-hover:text-blue-600 transition-colors text-[15px]">{exp.title}</p>
                    <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full mt-1 ${catColor}`}>
                      <Tag className="h-2.5 w-2.5" />{exp.category.replace(/_/g, ' ')}
                    </span>
                  </div>
                  <ArrowUpRight className="h-4 w-4 text-gray-300 group-hover:text-blue-500 transition-colors flex-shrink-0" />
                </div>

                <p className="text-2xl font-bold text-gray-900 tabular-nums mb-1">
                  <span className="text-base font-semibold text-gray-400 mr-1">{exp.currency}</span>
                  {fmt(Number(exp.amount))}
                </p>

                {exp.description && (
                  <p className="text-xs text-gray-400 line-clamp-1 mb-3">{exp.description}</p>
                )}

                <div className="flex items-center justify-between pt-3 border-t border-gray-50">
                  <div className="flex items-center gap-1.5">
                    <span className={`h-2 w-2 rounded-full ${meta.dot}`} />
                    <Badge variant={meta.color} className="text-xs">{exp.status.replace(/_/g, ' ')}</Badge>
                  </div>
                  <div className="flex items-center gap-1 text-xs text-gray-400">
                    <Calendar className="h-3 w-3" />{exp.expense_date}
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      )}

      {/* Create modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto border border-gray-100">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="text-lg font-semibold text-gray-900">New Expense</h2>
              <button onClick={() => { setShowCreate(false); setError(null) }} className="text-gray-400 hover:text-gray-600 transition-colors">
                <XCircle className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleCreate} className="px-6 py-5 space-y-4">
              <div className="space-y-1.5">
                <Label>Title *</Label>
                <Input placeholder="e.g. Office rent – August" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} required />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Amount *</Label>
                  <Input type="number" step="0.01" min="0.01" placeholder="0.00" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} required />
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
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Category *</Label>
                  <Select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
                    {CATEGORIES.map(c => <option key={c} value={c}>{c.replace(/_/g, ' ')}</option>)}
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Date *</Label>
                  <Input type="date" value={form.expense_date} onChange={e => setForm(f => ({ ...f, expense_date: e.target.value }))} required />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Payment Method</Label>
                <Select value={form.payment_method} onChange={e => setForm(f => ({ ...f, payment_method: e.target.value }))}>
                  {['bank','cash','credit_card','digital_wallet'].map(m => <option key={m} value={m}>{m.replace(/_/g, ' ')}</option>)}
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Business Purpose</Label>
                <Input placeholder="Why was this expense incurred?" value={form.business_purpose} onChange={e => setForm(f => ({ ...f, business_purpose: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Description *</Label>
                <textarea 
                  rows={2} 
                  required
                  placeholder="Enter detailed description of the expense..."
                  className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary resize-none" 
                  value={form.description} 
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))} 
                />
              </div>
              <div className="space-y-1.5">
                <Label>Receipt Document {form.payment_method === 'bank' ? '*' : '(Optional)'}</Label>
                <Input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,application/pdf"
                  onChange={e => setReceiptFile(e.target.files?.[0] || null)}
                  className="bg-white border-gray-200 file:mr-2 file:bg-gray-100 file:border-none file:px-2 file:py-1 file:rounded file:text-xs"
                />
                <p className="text-[10px] text-gray-400 leading-tight">
                  Supported formats: JPEG, PNG, WebP, PDF (Max 10MB).
                  {form.payment_method === 'bank' && <span className="text-red-500 font-bold block mt-0.5">Required for Bank Transfer payments.</span>}
                </p>
              </div>
              {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
              <div className="flex gap-3 pt-1">
                <Button type="button" variant="outline" className="flex-1" onClick={() => { setShowCreate(false); setError(null) }}>Cancel</Button>
                <Button type="submit" className="flex-1" disabled={submitting}>
                  {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Submit Expense
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
