'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Plus, Loader2, Search, Edit2, Trash2, XCircle, UserPlus } from 'lucide-react'

interface Client {
  id: string
  name: string
  company_name: string | null
  contact_person: string | null
  phone: string | null
  email: string | null
  industry: string | null
  status: string
}

const EMPTY_FORM = {
  name: '', company_name: '', contact_person: '', phone: '', email: '', industry: '', status: 'active'
}

export default function ClientsPage() {
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  const [showCreate, setShowCreate] = useState(false)
  const [editingClient, setEditingClient] = useState<Client | null>(null)
  const [deletingClient, setDeletingClient] = useState<Client | null>(null)

  const [form, setForm] = useState(EMPTY_FORM)
  const [submitting, setSubmitting] = useState(false)
  const [search, setSearch] = useState('')

  async function load() {
    setLoading(true)
    const r = await fetch('/api/clients' + (search ? `?search=${encodeURIComponent(search)}` : ''))
    if (r.ok) setClients(await r.json())
    else setError('Failed to load clients')
    setLoading(false)
  }

  useEffect(() => { load() }, [search])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      const r = await fetch('/api/clients', {
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
        setError(err.error || 'Failed to create client')
      }
    } catch (err) {
      setError('An error occurred during creation.')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleSaveEdit(e: React.FormEvent) {
    e.preventDefault()
    if (!editingClient) return
    setSubmitting(true)
    setError(null)
    try {
      const r = await fetch(`/api/clients/${editingClient.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (r.ok) {
        setEditingClient(null)
        setForm(EMPTY_FORM)
        load()
      } else {
        const err = await r.json()
        setError(err.error || 'Failed to update client details')
      }
    } catch (err) {
      setError('An error occurred during save.')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDeleteConfirm() {
    if (!deletingClient) return
    setSubmitting(true)
    setError(null)
    try {
      const r = await fetch(`/api/clients/${deletingClient.id}`, {
        method: 'DELETE'
      })
      if (r.ok) {
        setDeletingClient(null)
        load()
      } else {
        const err = await r.json()
        setError(err.error || 'Failed to delete client')
      }
    } catch (err) {
      setError('An error occurred during deletion.')
    } finally {
      setSubmitting(false)
    }
  }

  function startEdit(c: Client) {
    setEditingClient(c)
    setForm({
      name: c.name,
      company_name: c.company_name ?? '',
      contact_person: c.contact_person ?? '',
      phone: c.phone ?? '',
      email: c.email ?? '',
      industry: c.industry ?? '',
      status: c.status
    })
  }

  return (
    <div className="space-y-6">
      {/* Header section */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">Clients</h1>
          <p className="text-sm text-gray-400 mt-0.5">{clients.length} active corporate account{clients.length !== 1 ? 's' : ''}</p>
        </div>
        <Button onClick={() => { setForm(EMPTY_FORM); setShowCreate(true) }} className="gap-2 shadow-sm">
          <Plus className="h-4 w-4" /> Add Client
        </Button>
      </div>

      {error && <Alert variant="destructive" className="rounded-2xl border-none shadow-sm"><AlertDescription>{error}</AlertDescription></Alert>}

      {/* Modern Search bar */}
      <div className="relative">
        <Search className="absolute left-3.5 top-3.5 h-4 w-4 text-gray-400" />
        <Input 
          placeholder="Search clients by name, company, email..." 
          className="pl-10 h-11 bg-white border-none rounded-xl shadow-sm text-xs font-semibold text-gray-900 focus-visible:ring-1 focus-visible:ring-[#c19a3b]" 
          value={search} 
          onChange={e => setSearch(e.target.value)} 
        />
      </div>

      {/* Clients Table Card */}
      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-7 w-7 animate-spin text-gray-400" /></div>
      ) : (
        <Card className="border-none shadow-sm rounded-[24px] bg-white overflow-hidden">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-[#e4ebe8]/20 text-[#2c443e] border-b border-gray-100">
                    {['Name', 'Company', 'Contact Person', 'Email Address', 'Industry', 'Status', 'Actions'].map(h => (
                      <th key={h} className="px-5 py-4 text-left font-bold uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {clients.map(c => {
                    const statusColor = c.status === 'active' ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-600'
                    return (
                      <tr key={c.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/50 transition-colors">
                        <td className="px-5 py-4 font-bold text-gray-900">{c.name}</td>
                        <td className="px-5 py-4 text-gray-500 font-medium">{c.company_name ?? '—'}</td>
                        <td className="px-5 py-4 text-gray-500 font-semibold">{c.contact_person ?? '—'}</td>
                        <td className="px-5 py-4 text-gray-500 font-medium">{c.email ?? '—'}</td>
                        <td className="px-5 py-4 text-gray-400 font-semibold uppercase tracking-wider">{c.industry ?? '—'}</td>
                        <td className="px-5 py-4">
                          <Badge className={`capitalize shadow-none border-none text-[10px] font-bold ${statusColor}`}>
                            {c.status}
                          </Badge>
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-1">
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-7 w-7 text-gray-500 hover:text-[#c19a3b] hover:bg-gray-50"
                              onClick={() => startEdit(c)}
                            >
                              <Edit2 className="h-3.5 w-3.5" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-7 w-7 text-gray-500 hover:text-rose-600 hover:bg-rose-50"
                              onClick={() => setDeletingClient(c)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                  {clients.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-5 py-12 text-center text-gray-400 font-medium italic">
                        No clients registered under this account query.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Add Client Modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto border border-gray-100 overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="text-lg font-semibold text-gray-900">Add Client Relationship</h2>
              <button onClick={() => setShowCreate(false)} className="text-gray-400 hover:text-gray-600">
                <XCircle className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleCreate} className="px-6 py-5 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5 col-span-2">
                  <Label>Client Name *</Label>
                  <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Mudasar" required />
                </div>
                <div className="space-y-1.5">
                  <Label>Company Name</Label>
                  <Input value={form.company_name} onChange={e => setForm(f => ({ ...f, company_name: e.target.value }))} placeholder="e.g. Tudo Inc." />
                </div>
                <div className="space-y-1.5">
                  <Label>Contact Person</Label>
                  <Input value={form.contact_person} onChange={e => setForm(f => ({ ...f, contact_person: e.target.value }))} placeholder="e.g. Mudasar Bhai" />
                </div>
                <div className="space-y-1.5">
                  <Label>Phone Number</Label>
                  <Input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="e.g. +92 300 1234567" />
                </div>
                <div className="space-y-1.5">
                  <Label>Email Address</Label>
                  <Input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="e.g. client@company.com" />
                </div>
                <div className="space-y-1.5 col-span-2">
                  <Label>Industry Sector</Label>
                  <Input value={form.industry} onChange={e => setForm(f => ({ ...f, industry: e.target.value }))} placeholder="e.g. Web Development, Real Estate" />
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <Button type="button" variant="outline" className="flex-1" onClick={() => setShowCreate(false)}>Cancel</Button>
                <Button type="submit" className="flex-1 bg-[#c19a3b] hover:bg-[#b08b30] text-white" disabled={submitting}>
                  {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Save Client
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Client Modal */}
      {editingClient && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto border border-gray-100 overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="text-lg font-semibold text-gray-900">Edit Client Details</h2>
              <button onClick={() => setEditingClient(null)} className="text-gray-400 hover:text-gray-600">
                <XCircle className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleSaveEdit} className="px-6 py-5 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5 col-span-2">
                  <Label>Client Name *</Label>
                  <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required />
                </div>
                <div className="space-y-1.5">
                  <Label>Company Name</Label>
                  <Input value={form.company_name} onChange={e => setForm(f => ({ ...f, company_name: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label>Contact Person</Label>
                  <Input value={form.contact_person} onChange={e => setForm(f => ({ ...f, contact_person: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label>Phone Number</Label>
                  <Input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label>Email Address</Label>
                  <Input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
                </div>
                <div className="space-y-1.5 col-span-2">
                  <Label>Industry Sector</Label>
                  <Input value={form.industry} onChange={e => setForm(f => ({ ...f, industry: e.target.value }))} />
                </div>
                <div className="space-y-1.5 col-span-2">
                  <Label>Client Status</Label>
                  <Select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
                    {['active', 'inactive'].map(s => <option key={s} value={s}>{s}</option>)}
                  </Select>
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <Button type="button" variant="outline" className="flex-1" onClick={() => setEditingClient(null)}>Cancel</Button>
                <Button type="submit" className="flex-1 bg-[#c19a3b] hover:bg-[#b08b30] text-white" disabled={submitting}>
                  {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Save Changes
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Client Modal */}
      {deletingClient && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm border border-gray-100 overflow-hidden p-6 space-y-4">
            <h3 className="text-lg font-bold text-gray-900">Delete Client Account?</h3>
            <p className="text-sm text-gray-400">
              Are you sure you want to delete <span className="font-semibold text-gray-900">"{deletingClient.name}"</span>? This will remove all database connections and references linked to this client.
            </p>
            <div className="flex gap-3 pt-2">
              <Button variant="outline" className="flex-1" onClick={() => setDeletingClient(null)}>Cancel</Button>
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
