'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Plus, Loader2, Users } from 'lucide-react'

interface PayrollRecord {
  id: string
  basic_salary: number
  bonus: number
  commission: number
  deduction: number
  tax: number
  net_salary: number
  payment_date: string | null
  status: string
  employee: { name: string; email: string } | null
}

const STATUS_COLORS: Record<string, 'default' | 'secondary' | 'success' | 'outline'> = {
  draft: 'secondary',
  approved: 'default',
  paid: 'success',
  cancelled: 'outline',
}

export default function PayrollPage() {
  const [records, setRecords] = useState<PayrollRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [accounts, setAccounts] = useState<{ id: string; name: string }[]>([])

  const [form, setForm] = useState({
    employee_id: '', basic_salary: '', bonus: '0', commission: '0',
    overtime: '0', allowance: '0', deduction: '0', loan_deduction: '0',
    advance_deduction: '0', tax: '0',
    payment_date: new Date().toISOString().slice(0, 10),
    account_id: '', status: 'draft',
  })

  const netPreview = [
    Number(form.basic_salary), Number(form.bonus), Number(form.commission),
    Number(form.overtime), Number(form.allowance),
  ].reduce((s, v) => s + v, 0) - [
    Number(form.deduction), Number(form.loan_deduction),
    Number(form.advance_deduction), Number(form.tax),
  ].reduce((s, v) => s + v, 0)

  async function load() {
    setLoading(true)
    const [prRes, accRes] = await Promise.all([fetch('/api/payroll'), fetch('/api/accounts')])
    if (prRes.ok) setRecords(await prRes.json())
    if (accRes.ok) setAccounts(await accRes.json())
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    const r = await fetch('/api/payroll', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...form,
        basic_salary: Number(form.basic_salary),
        bonus: Number(form.bonus), commission: Number(form.commission),
        overtime: Number(form.overtime), allowance: Number(form.allowance),
        deduction: Number(form.deduction), loan_deduction: Number(form.loan_deduction),
        advance_deduction: Number(form.advance_deduction), tax: Number(form.tax),
      }),
    })
    if (r.ok) {
      setShowCreate(false)
      load()
    } else setError((await r.json()).error)
    setSubmitting(false)
  }

  const totalPayroll = records.filter(r => r.status === 'paid').reduce((s, r) => s + r.net_salary, 0)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Payroll</h2>
          <p className="text-sm text-muted-foreground">Process and track employee salaries</p>
        </div>
        <Button onClick={() => setShowCreate(true)}>
          <Plus className="mr-2 h-4 w-4" /> New Payroll
        </Button>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Total Paid This Period</CardTitle>
          <Users className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent><div className="text-2xl font-bold">{totalPayroll.toLocaleString()}</div></CardContent>
      </Card>

      {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b bg-muted/50">
                  <tr>
                    {['Employee', 'Basic', 'Bonus', 'Deductions', 'Tax', 'Net Salary', 'Date', 'Status'].map(h => (
                      <th key={h} className="px-4 py-3 text-left font-medium text-muted-foreground">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {records.map(r => (
                    <tr key={r.id} className="border-b last:border-0 hover:bg-muted/30">
                      <td className="px-4 py-3 font-medium">{r.employee?.name ?? '—'}</td>
                      <td className="px-4 py-3">{r.basic_salary.toLocaleString()}</td>
                      <td className="px-4 py-3 text-green-600">+{r.bonus.toLocaleString()}</td>
                      <td className="px-4 py-3 text-red-600">-{r.deduction.toLocaleString()}</td>
                      <td className="px-4 py-3 text-red-600">-{r.tax.toLocaleString()}</td>
                      <td className="px-4 py-3 font-bold">{r.net_salary.toLocaleString()}</td>
                      <td className="px-4 py-3 text-muted-foreground">{r.payment_date ?? '—'}</td>
                      <td className="px-4 py-3"><Badge variant={STATUS_COLORS[r.status] ?? 'secondary'}>{r.status}</Badge></td>
                    </tr>
                  ))}
                  {records.length === 0 && (
                    <tr><td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">No payroll records yet.</td></tr>
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
            <CardHeader><CardTitle>New Payroll Entry</CardTitle></CardHeader>
            <CardContent>
              <form onSubmit={handleCreate} className="space-y-4">
                <div className="space-y-1">
                  <Label>Employee ID *</Label>
                  <Input placeholder="User UUID" value={form.employee_id} onChange={e => setForm(f => ({ ...f, employee_id: e.target.value }))} required />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    ['basic_salary', 'Basic Salary *', true],
                    ['bonus', 'Bonus', false],
                    ['commission', 'Commission', false],
                    ['overtime', 'Overtime', false],
                    ['allowance', 'Allowance', false],
                    ['deduction', 'Deduction', false],
                    ['loan_deduction', 'Loan Deduction', false],
                    ['advance_deduction', 'Advance Deduction', false],
                    ['tax', 'Tax', false],
                  ].map(([key, label, req]) => (
                    <div key={key as string} className="space-y-1">
                      <Label>{label as string}</Label>
                      <Input
                        type="number" step="0.01" min="0"
                        value={form[key as keyof typeof form]}
                        onChange={e => setForm(f => ({ ...f, [key as string]: e.target.value }))}
                        required={req as boolean}
                      />
                    </div>
                  ))}
                </div>
                <div className="rounded-lg bg-muted p-3 text-sm">
                  <span className="font-medium">Net Salary Preview: </span>
                  <span className="font-bold">{netPreview.toLocaleString()}</span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label>Payment Date *</Label>
                    <Input type="date" value={form.payment_date} onChange={e => setForm(f => ({ ...f, payment_date: e.target.value }))} required />
                  </div>
                  <div className="space-y-1">
                    <Label>Account *</Label>
                    <Select value={form.account_id} onChange={e => setForm(f => ({ ...f, account_id: e.target.value }))} required>
                      <option value="">Select account</option>
                      {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                    </Select>
                  </div>
                </div>
                <div className="space-y-1">
                  <Label>Status</Label>
                  <Select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
                    {['draft', 'approved', 'paid'].map(s => <option key={s} value={s}>{s}</option>)}
                  </Select>
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
