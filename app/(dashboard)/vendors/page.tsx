'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Plus, Loader2, Search } from 'lucide-react'

interface Vendor {
  id: string
  name: string
  company_name: string | null
  contact_person: string | null
  phone: string | null
  email: string | null
  services: string | null
  total_paid: number
  outstanding: number
  status: string
}

export default function VendorsPage() {
  const [vendors, setVendors] = useState<Vendor[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [search, setSearch] = useState('')

  const [form, setForm] = useState({ name: '', company_name: '', contact_person: '', phone: '', email: '', services: '', payment_terms: '' })

  async function load() {
    setLoading(true)
    const r = await fetch('/api/vendors' + (search ? `?search=${encodeURIComponent(search)}` : ''))
    if (r.ok) setVendors(await r.json())
    else setError('Failed to load vendors')
    setLoading(false)
  }

  useEffect(() => { load() }, [search])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    const r = await fetch('/api/vendors', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    if (r.ok) { setShowCreate(false); setForm({ name: '', company_name: '', contact_person: '', phone: '', email: '', services: '', payment_terms: '' }); load() }
    else setError((await r.json()).error)
    setSubmitting(false)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Vendors</h2>
          <p className="text-sm text-muted-foreground">Manage supplier relationships and payments</p>
        </div>
        <Button onClick={() => setShowCreate(true)}><Plus className="mr-2 h-4 w-4" /> Add Vendor</Button>
      </div>

      {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}

      <div className="relative">
        <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Search vendors..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b bg-muted/50">
                  <tr>{['Name', 'Company', 'Contact', 'Email', 'Services', 'Total Paid', 'Status'].map(h => (
                    <th key={h} className="px-4 py-3 text-left font-medium text-muted-foreground">{h}</th>
                  ))}</tr>
                </thead>
                <tbody>
                  {vendors.map(v => (
                    <tr key={v.id} className="border-b last:border-0 hover:bg-muted/30">
                      <td className="px-4 py-3 font-medium">{v.name}</td>
                      <td className="px-4 py-3 text-muted-foreground">{v.company_name ?? '—'}</td>
                      <td className="px-4 py-3 text-muted-foreground">{v.contact_person ?? '—'}</td>
                      <td className="px-4 py-3 text-muted-foreground">{v.email ?? '—'}</td>
                      <td className="px-4 py-3 text-muted-foreground">{v.services ?? '—'}</td>
                      <td className="px-4 py-3 font-medium">{v.total_paid.toLocaleString()}</td>
                      <td className="px-4 py-3">
                        <Badge variant={v.status === 'active' ? 'success' : v.status === 'blocked' ? 'destructive' : 'secondary'}>{v.status}</Badge>
                      </td>
                    </tr>
                  ))}
                  {vendors.length === 0 && (
                    <tr><td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">No vendors found.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <Card className="w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <CardContent className="pt-6">
              <h3 className="text-lg font-semibold mb-4">Add Vendor</h3>
              <form onSubmit={handleCreate} className="space-y-4">
                {[
                  ['name', 'Vendor Name *', true],
                  ['company_name', 'Company Name', false],
                  ['contact_person', 'Contact Person *', true],
                  ['phone', 'Phone *', true],
                  ['email', 'Email *', true],
                  ['services', 'Services Provided', false],
                  ['payment_terms', 'Payment Terms', false],
                ].map(([key, label, req]) => (
                  <div key={key as string} className="space-y-1">
                    <Label>{label as string}</Label>
                    <Input
                      value={form[key as keyof typeof form]}
                      onChange={e => setForm(f => ({ ...f, [key as string]: e.target.value }))}
                      required={req as boolean}
                    />
                  </div>
                ))}
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
