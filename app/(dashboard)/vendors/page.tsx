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
import { Plus, Loader2, Search, Edit2, Trash2, XCircle, Briefcase } from 'lucide-react'

interface Vendor {
  id: string
  name: string
  company_name: string | null
  contact_person: string | null
  phone: string | null
  email: string | null
  services: string | null
  payment_terms: string | null
  address: string | null
  tax_number: string | null
  bank_details: string | null
  total_paid: number
  outstanding: number
  status: string
}

const EMPTY_FORM = {
  name: '', company_name: '', contact_person: '', phone: '', email: '', 
  services: '', payment_terms: '', address: '', tax_number: '', bank_details: '', status: 'active'
}

export default function VendorsPage() {
  const [vendors, setVendors] = useState<Vendor[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  const [showCreate, setShowCreate] = useState(false)
  const [editingVendor, setEditingVendor] = useState<Vendor | null>(null)
  const [deletingVendor, setDeletingVendor] = useState<Vendor | null>(null)

  const [form, setForm] = useState(EMPTY_FORM)
  const [submitting, setSubmitting] = useState(false)
  const [search, setSearch] = useState('')

  const load = useCallback(async () => {
    const r = await fetch('/api/vendors' + (search ? `?search=${encodeURIComponent(search)}` : ''))
    if (r.ok) setVendors(await r.json())
    else setError('Failed to load vendors')
    setLoading(false)
  }, [search])

  useAsyncEffect(load)

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      const r = await fetch('/api/vendors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (r.ok) { 
        setShowCreate(false)
        setForm(EMPTY_FORM)
        load() 
      } else {
        const err = await r.json()
        setError(err.error || 'Failed to register vendor')
      }
    } catch {
      setError('An error occurred during vendor registration.')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleSaveEdit(e: React.FormEvent) {
    e.preventDefault()
    if (!editingVendor) return
    setSubmitting(true)
    setError(null)
    try {
      const r = await fetch(`/api/vendors/${editingVendor.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (r.ok) {
        setEditingVendor(null)
        setForm(EMPTY_FORM)
        load()
      } else {
        const err = await r.json()
        setError(err.error || 'Failed to update vendor details')
      }
    } catch {
      setError('An error occurred during save.')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDeleteConfirm() {
    if (!deletingVendor) return
    setSubmitting(true)
    setError(null)
    try {
      const r = await fetch(`/api/vendors/${deletingVendor.id}`, {
        method: 'DELETE'
      })
      if (r.ok) {
        setDeletingVendor(null)
        load()
      } else {
        const err = await r.json()
        setError(err.error || 'Failed to delete vendor')
      }
    } catch {
      setError('An error occurred during deletion.')
    } finally {
      setSubmitting(false)
    }
  }

  function startEdit(v: Vendor) {
    setEditingVendor(v)
    setForm({
      name: v.name,
      company_name: v.company_name ?? '',
      contact_person: v.contact_person ?? '',
      phone: v.phone ?? '',
      email: v.email ?? '',
      services: v.services ?? '',
      payment_terms: v.payment_terms ?? '',
      address: v.address ?? '',
      tax_number: v.tax_number ?? '',
      bank_details: v.bank_details ?? '',
      status: v.status
    })
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">Vendors</h1>
          <p className="text-sm text-gray-400 mt-0.5">{vendors.length} supplier account{vendors.length !== 1 ? 's' : ''} registered</p>
        </div>
        <Button onClick={() => { setForm(EMPTY_FORM); setShowCreate(true) }} className="gap-2 shadow-sm">
          <Plus className="h-4 w-4" /> Add Vendor
        </Button>
      </div>

      {error && <Alert variant="destructive" className="rounded-2xl border-none shadow-sm"><AlertDescription>{error}</AlertDescription></Alert>}

      {/* Search Filter */}
      <div className="relative">
        <Search className="absolute left-3.5 top-3.5 h-4 w-4 text-gray-400" />
        <Input 
          placeholder="Search suppliers by name, email, or services..." 
          className="pl-10 h-11 bg-white border-none rounded-xl shadow-sm text-xs font-semibold text-gray-900 focus-visible:ring-1 focus-visible:ring-[#c19a3b]" 
          value={search} 
          onChange={e => setSearch(e.target.value)} 
        />
      </div>

      {/* Vendors Table */}
      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-7 w-7 animate-spin text-gray-400" /></div>
      ) : (
        <Card className="border-none shadow-sm rounded-[24px] bg-white overflow-hidden">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-[#e4ebe8]/20 text-[#2c443e] border-b border-gray-100">
                    {['Supplier Name', 'Company Name', 'Contact Person', 'Email Address', 'Services Provided', 'Total Paid', 'Status', 'Actions'].map(h => (
                      <th key={h} className="px-5 py-4 text-left font-bold uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {vendors.map(v => {
                    const statusColor = v.status === 'active' ? 'bg-emerald-50 text-emerald-700' : v.status === 'blocked' ? 'bg-rose-50 text-rose-700' : 'bg-gray-100 text-gray-600'
                    return (
                      <tr key={v.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/50 transition-colors">
                        <td className="px-5 py-4 font-bold text-gray-900 flex items-center gap-1.5">
                          <Briefcase className="h-3.5 w-3.5 text-gray-300" />
                          {v.name}
                        </td>
                        <td className="px-5 py-4 text-gray-500 font-medium">{v.company_name ?? '—'}</td>
                        <td className="px-5 py-4 text-gray-500 font-semibold">{v.contact_person ?? '—'}</td>
                        <td className="px-5 py-4 text-gray-500 font-medium">{v.email ?? '—'}</td>
                        <td className="px-5 py-4 text-gray-400 font-semibold">{v.services ?? '—'}</td>
                        <td className="px-5 py-4 font-extrabold text-gray-900">PKR {v.total_paid.toLocaleString()}</td>
                        <td className="px-5 py-4">
                          <Badge className={`capitalize shadow-none border-none text-[10px] font-bold ${statusColor}`}>
                            {v.status}
                          </Badge>
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-1">
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-7 w-7 text-gray-500 hover:text-[#c19a3b] hover:bg-gray-50"
                              onClick={() => startEdit(v)}
                            >
                              <Edit2 className="h-3.5 w-3.5" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-7 w-7 text-gray-500 hover:text-rose-600 hover:bg-rose-50"
                              onClick={() => setDeletingVendor(v)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                  {vendors.length === 0 && (
                    <tr>
                      <td colSpan={8} className="px-5 py-12 text-center text-gray-400 font-medium italic">
                        No vendor relationships registered yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Add Vendor Modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto border border-gray-100 overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="text-lg font-semibold text-gray-900">Add Supplier Relationship</h2>
              <button onClick={() => setShowCreate(false)} className="text-gray-400 hover:text-gray-600">
                <XCircle className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleCreate} className="px-6 py-5 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5 col-span-2">
                  <Label>Supplier Name *</Label>
                  <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required />
                </div>
                <div className="space-y-1.5">
                  <Label>Company Name</Label>
                  <Input value={form.company_name} onChange={e => setForm(f => ({ ...f, company_name: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label>Contact Person *</Label>
                  <Input value={form.contact_person} onChange={e => setForm(f => ({ ...f, contact_person: e.target.value }))} required />
                </div>
                <div className="space-y-1.5">
                  <Label>Phone Number *</Label>
                  <Input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} required />
                </div>
                <div className="space-y-1.5">
                  <Label>Email Address *</Label>
                  <Input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} required />
                </div>
                <div className="space-y-1.5 col-span-2">
                  <Label>Services Provided</Label>
                  <Input value={form.services} onChange={e => setForm(f => ({ ...f, services: e.target.value }))} placeholder="e.g. Hosting, Logistical Dispatch" />
                </div>
                <div className="space-y-1.5">
                  <Label>Tax/NTN Number</Label>
                  <Input value={form.tax_number} onChange={e => setForm(f => ({ ...f, tax_number: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label>Payment Terms</Label>
                  <Input value={form.payment_terms} onChange={e => setForm(f => ({ ...f, payment_terms: e.target.value }))} placeholder="e.g. Net 30" />
                </div>
                <div className="space-y-1.5 col-span-2">
                  <Label>Bank Account Details</Label>
                  <Input value={form.bank_details} onChange={e => setForm(f => ({ ...f, bank_details: e.target.value }))} />
                </div>
                <div className="space-y-1.5 col-span-2">
                  <Label>Postal Address</Label>
                  <Input value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} />
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <Button type="button" variant="outline" className="flex-1" onClick={() => setShowCreate(false)}>Cancel</Button>
                <Button type="submit" className="flex-1 bg-[#c19a3b] hover:bg-[#b08b30] text-white" disabled={submitting}>
                  {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Save Vendor
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Vendor Modal */}
      {editingVendor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto border border-gray-100 overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="text-lg font-semibold text-gray-900">Edit Vendor details</h2>
              <button onClick={() => setEditingVendor(null)} className="text-gray-400 hover:text-gray-600">
                <XCircle className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleSaveEdit} className="px-6 py-5 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5 col-span-2">
                  <Label>Supplier Name *</Label>
                  <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required />
                </div>
                <div className="space-y-1.5">
                  <Label>Company Name</Label>
                  <Input value={form.company_name} onChange={e => setForm(f => ({ ...f, company_name: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label>Contact Person *</Label>
                  <Input value={form.contact_person} onChange={e => setForm(f => ({ ...f, contact_person: e.target.value }))} required />
                </div>
                <div className="space-y-1.5">
                  <Label>Phone Number *</Label>
                  <Input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} required />
                </div>
                <div className="space-y-1.5">
                  <Label>Email Address *</Label>
                  <Input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} required />
                </div>
                <div className="space-y-1.5 col-span-2">
                  <Label>Services Provided</Label>
                  <Input value={form.services} onChange={e => setForm(f => ({ ...f, services: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label>Tax/NTN Number</Label>
                  <Input value={form.tax_number} onChange={e => setForm(f => ({ ...f, tax_number: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label>Payment Terms</Label>
                  <Input value={form.payment_terms} onChange={e => setForm(f => ({ ...f, payment_terms: e.target.value }))} />
                </div>
                <div className="space-y-1.5 col-span-2">
                  <Label>Bank Account Details</Label>
                  <Input value={form.bank_details} onChange={e => setForm(f => ({ ...f, bank_details: e.target.value }))} />
                </div>
                <div className="space-y-1.5 col-span-2">
                  <Label>Postal Address</Label>
                  <Input value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} />
                </div>
                <div className="space-y-1.5 col-span-2">
                  <Label>Vendor Status</Label>
                  <Select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
                    {['active', 'inactive', 'blocked'].map(s => <option key={s} value={s}>{s}</option>)}
                  </Select>
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <Button type="button" variant="outline" className="flex-1" onClick={() => setEditingVendor(null)}>Cancel</Button>
                <Button type="submit" className="flex-1 bg-[#c19a3b] hover:bg-[#b08b30] text-white" disabled={submitting}>
                  {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Save Changes
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Vendor Warning */}
      {deletingVendor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm border border-gray-100 overflow-hidden p-6 space-y-4">
            <h3 className="text-lg font-bold text-gray-900">Delete Supplier relationship?</h3>
            <p className="text-sm text-gray-400">
              Are you sure you want to delete <span className="font-semibold text-gray-900">&ldquo;{deletingVendor.name}&rdquo;</span>? This will remove all database connections and references linked to this supplier.
            </p>
            <div className="flex gap-3 pt-2">
              <Button variant="outline" className="flex-1" onClick={() => setDeletingVendor(null)}>Cancel</Button>
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
