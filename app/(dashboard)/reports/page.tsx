'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, FileText, Download, TrendingUp, TrendingDown, DollarSign, Percent } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

const REPORT_TYPES = [
  { value: 'profit_and_loss', label: 'Profit & Loss' },
  { value: 'income_statement', label: 'Income Statement' },
  { value: 'expense_report', label: 'Expense Report' },
  { value: 'cash_flow', label: 'Cash Flow' },
  { value: 'account_balance', label: 'Account Balances' },
  { value: 'payroll', label: 'Payroll Report' },
  { value: 'subscription', label: 'Subscription Report' },
  { value: 'vendor_payment', label: 'Vendor Payments' },
]

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function renderReportData(type: string, data: any) {
  if (!data) return null
  if (type === 'profit_and_loss') {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {[
            { label: 'Total Income', value: data.totalIncome, color: 'text-emerald-600', icon: TrendingUp, iconColor: 'text-emerald-500' },
            { label: 'Total Expenses', value: data.totalExpenses, color: 'text-rose-600', icon: TrendingDown, iconColor: 'text-rose-500' },
            { label: 'Net Profit', value: data.netProfit, color: data.netProfit >= 0 ? 'text-emerald-600' : 'text-rose-600', icon: DollarSign, iconColor: data.netProfit >= 0 ? 'text-emerald-500' : 'text-rose-500' },
            { label: 'Profit Margin', value: `${data.profitMargin?.toFixed(1)}%`, color: 'text-[#2c443e]', icon: Percent, iconColor: 'text-[#c19a3b]' },
          ].map(item => (
            <Card key={item.label} className="border-none bg-[#e4ebe8]/40 shadow-none rounded-2xl">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] font-bold tracking-widest text-[#6c857f] uppercase">{item.label}</p>
                  <item.icon className={`h-4 w-4 ${item.iconColor}`} />
                </div>
                <p className={`text-xl font-extrabold mt-2 ${item.color}`}>
                  {typeof item.value === 'number' ? 'PKR ' + item.value.toLocaleString() : item.value}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>

        {data.rows && data.rows.length > 0 && (
          <div className="space-y-3">
            <h4 className="text-xs font-bold tracking-wider text-[#2c443e] uppercase">Detailed Ledger Rows</h4>
            <div className="overflow-x-auto rounded-2xl border border-[#e4ebe8] bg-white">
              <table className="w-full text-xs">
                <thead className="bg-[#e4ebe8]/50 border-b border-[#e4ebe8]">
                  <tr>
                    {['Date', 'Title', 'Type', 'Category', 'Original Amount', 'Converted (PKR)'].map(h => (
                      <th key={h} className="px-4 py-3 text-left font-bold text-[#2c443e] uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.rows.map((row: any, i: number) => (
                    <tr key={i} className="border-b border-[#e4ebe8]/40 last:border-0 hover:bg-[#e4ebe8]/10 transition-colors">
                      <td className="px-4 py-3 font-semibold text-[#2c443e]">{row.date}</td>
                      <td className="px-4 py-3 font-medium text-[#2c443e]">{row.title}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full font-bold text-[9px] uppercase ${
                          row.type === 'Income' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
                        }`}>
                          {row.type}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-[#6c857f] capitalize">{row.category.replace(/_/g, ' ')}</td>
                      <td className="px-4 py-3 text-[#2c443e]">{row.currency} {row.amount?.toLocaleString()}</td>
                      <td className="px-4 py-3 font-bold text-[#2c443e]">PKR {row.converted_amount?.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    )
  }
  if (data.rows) {
    const rows = data.rows as Record<string, unknown>[]
    if (rows.length === 0) return <p className="text-[#6c857f] text-xs font-semibold py-4 text-center">No data records found for this period.</p>
    const keys = Object.keys(rows[0]).slice(0, 7)
    return (
      <div className="space-y-4">
        <div className="overflow-x-auto rounded-2xl border border-[#e4ebe8] bg-white">
          <table className="w-full text-xs">
            <thead className="bg-[#e4ebe8]/50 border-b border-[#e4ebe8]">
              <tr>
                {keys.map(k => (
                  <th key={k} className="px-4 py-3 text-left font-bold text-[#2c443e] uppercase tracking-wider">
                    {k.replace(/_/g, ' ')}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, 100).map((row, i) => (
                <tr key={i} className="border-b border-[#e4ebe8]/40 last:border-0 hover:bg-[#e4ebe8]/10 transition-colors">
                  {keys.map(k => (
                    <td key={k} className="px-4 py-3 text-[#2c443e] font-medium">
                      {k.toLowerCase().includes('amount') || k.toLowerCase().includes('balance') || k.toLowerCase().includes('salary') ? (
                        <span className="font-bold">
                          {typeof row[k] === 'number' ? (row[k] as number).toLocaleString() : String(row[k] ?? '—')}
                        </span>
                      ) : (
                        <span>{String(row[k] ?? '—').replace(/_/g, ' ')}</span>
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {data.total !== undefined && (
          <div className="flex justify-end p-2">
            <div className="bg-[#e4ebe8]/40 px-4 py-2 rounded-xl text-right">
              <span className="text-[10px] font-bold text-[#6c857f] tracking-wider uppercase mr-3">Cumulative Total</span>
              <span className="text-base font-extrabold text-[#2c443e]">PKR {data.total.toLocaleString()}</span>
            </div>
          </div>
        )}
      </div>
    )
  }
  return <pre className="text-xs bg-muted p-3 rounded overflow-x-auto">{JSON.stringify(data, null, 2)}</pre>
}

function renderPrintReportTable(type: string, data: any) {
  if (!data) return null
  if (type === 'profit_and_loss') {
    return (
      <div className="space-y-6">
        {/* P&L Metrics summary grid */}
        <div className="grid grid-cols-4 gap-3 mb-6">
          <div className="bg-[#e4ebe8]/60 p-3 rounded-xl border border-[#e4ebe8]">
            <span className="text-[8px] font-bold text-[#6c857f] uppercase">Total Income</span>
            <p className="font-extrabold text-[#2c443e] text-xs mt-1">PKR {data.totalIncome?.toLocaleString()}</p>
          </div>
          <div className="bg-[#e4ebe8]/60 p-3 rounded-xl border border-[#e4ebe8]">
            <span className="text-[8px] font-bold text-[#6c857f] uppercase">Total Expenses</span>
            <p className="font-extrabold text-[#2c443e] text-xs mt-1">PKR {data.totalExpenses?.toLocaleString()}</p>
          </div>
          <div className="bg-[#e4ebe8]/60 p-3 rounded-xl border border-[#e4ebe8]">
            <span className="text-[8px] font-bold text-[#6c857f] uppercase">Net Profit</span>
            <p className={`font-extrabold text-xs mt-1 ${data.netProfit >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
              PKR {data.netProfit?.toLocaleString()}
            </p>
          </div>
          <div className="bg-[#e4ebe8]/60 p-3 rounded-xl border border-[#e4ebe8]">
            <span className="text-[8px] font-bold text-[#6c857f] uppercase">Profit Margin</span>
            <p className="font-extrabold text-[#2c443e] text-xs mt-1">{data.profitMargin?.toFixed(1)}%</p>
          </div>
        </div>

        {/* Rows */}
        {data.rows && data.rows.length > 0 && (
          <table className="w-full text-[9px] border-collapse">
            <thead>
              <tr className="bg-[#2c443e] text-white">
                <th className="px-3 py-2.5 text-left font-bold uppercase tracking-wider">Date</th>
                <th className="px-3 py-2.5 text-left font-bold uppercase tracking-wider">Description</th>
                <th className="px-3 py-2.5 text-left font-bold uppercase tracking-wider">Type</th>
                <th className="px-3 py-2.5 text-left font-bold uppercase tracking-wider">Category</th>
                <th className="px-3 py-2.5 text-right font-bold uppercase tracking-wider">Converted (PKR)</th>
              </tr>
            </thead>
            <tbody>
              {data.rows.slice(0, 15).map((row: any, i: number) => (
                <tr key={i} className={i % 2 === 0 ? 'bg-[#e4ebe8]/20' : 'bg-white'}>
                  <td className="px-3 py-2 text-[#2c443e] font-semibold">{row.date}</td>
                  <td className="px-3 py-2 text-[#2c443e]">{row.title}</td>
                  <td className="px-3 py-2">
                    <span className={`px-1.5 py-0.5 rounded font-bold text-[8px] uppercase ${
                      row.type === 'Income' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
                    }`}>
                      {row.type}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-[#6c857f] capitalize">{row.category.replace(/_/g, ' ')}</td>
                  <td className="px-3 py-2 text-right font-bold text-[#2c443e]">PKR {row.converted_amount?.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    )
  }

  if (data.rows) {
    const rows = data.rows as Record<string, unknown>[]
    if (rows.length === 0) return <p className="text-[#6c857f] text-[10px] text-center py-4">No transaction history found.</p>
    const keys = Object.keys(rows[0]).slice(0, 6)
    return (
      <table className="w-full text-[9px] border-collapse">
        <thead>
          <tr className="bg-[#2c443e] text-white">
            {keys.map(k => (
              <th key={k} className="px-3 py-2.5 text-left font-bold uppercase tracking-wider">{k.replace(/_/g, ' ')}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.slice(0, 20).map((row, i) => (
            <tr key={i} className={i % 2 === 0 ? 'bg-[#e4ebe8]/20' : 'bg-white'}>
              {keys.map(k => (
                <td key={k} className="px-3 py-2 text-[#2c443e] font-medium">
                  {k.toLowerCase().includes('amount') || k.toLowerCase().includes('balance') || k.toLowerCase().includes('salary') ? (
                    <span className="font-bold">
                      {typeof row[k] === 'number' ? (row[k] as number).toLocaleString() : String(row[k] ?? '—')}
                    </span>
                  ) : (
                    <span>{String(row[k] ?? '—').replace(/_/g, ' ')}</span>
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    )
  }
  return null
}

function downloadCSV(type: string, data: Record<string, unknown>[]) {
  if (!data?.length) return
  const keys = Object.keys(data[0])
  const csv = [keys.join(','), ...data.map(r => keys.map(k => JSON.stringify(r[k] ?? '')).join(','))].join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${type}-report.csv`
  a.click()
  URL.revokeObjectURL(url)
}

export default function ReportsPage() {
  const [reportType, setReportType] = useState('profit_and_loss')
  const [from, setFrom] = useState('2026-08-01')
  const [to, setTo] = useState('2026-08-31')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [result, setResult] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [userName, setUserName] = useState('Finance Manager')
  const [userEmail, setUserEmail] = useState('finance@company.com')
  const [companyName, setCompanyName] = useState('ExpenseTrack')

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data }) => {
      const u = data.user
      if (u) {
        if (u.email) setUserEmail(u.email)
        const metaName = u.user_metadata?.name || u.user_metadata?.full_name
        if (metaName) {
          setUserName(metaName)
        }
        
        supabase.from('users').select('name, company_id').eq('id', u.id).single().then(({ data: profile }) => {
          if (profile?.name) setUserName(profile.name)
          if (profile?.company_id) {
            supabase.from('companies').select('name').eq('id', profile.company_id).single().then(({ data: comp }) => {
              if (comp?.name) setCompanyName(comp.name)
            })
          }
        })
      }
    })
  }, [])

  async function runReport() {
    setLoading(true)
    setError(null)
    setResult(null)
    const params = new URLSearchParams({ from, to })
    const r = await fetch(`/api/reports/${reportType}?${params}`)
    if (r.ok) {
      setResult(await r.json())
    } else {
      const errRes = await r.json()
      setError(errRes.error ?? 'Failed to generate report')
    }
    setLoading(false)
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Custom Printable PDF Layout */}
      {result && (
        <div className="hidden print:flex flex-row w-full min-h-screen bg-white text-[#2c443e] font-sans text-xs p-0 absolute top-0 left-0">
          
          {/* Left Column (Teal Panel) */}
          <div className="w-[32%] bg-[#2c443e] text-white p-8 flex flex-col justify-between">
            <div>
              {/* Logo (Paper Airplane matching reference style) */}
              <div className="flex flex-col items-center mb-16 text-center">
                <svg className="h-10 w-10 text-white mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
                <span className="font-black text-xs uppercase tracking-widest text-white mt-1 text-center max-w-full truncate">{companyName}</span>
                <p className="text-[7px] text-[#a3b8b3] tracking-widest uppercase mt-0.5">Finance Suite</p>
              </div>

              {/* Terms & Conditions (Checkmark styling) */}
              <div className="mt-16 space-y-4">
                <h4 className="text-[9px] font-bold tracking-widest text-white uppercase border-b border-white/10 pb-1.5">Terms & Conditions</h4>
                <ul className="space-y-3 text-[8px] text-[#a3b8b3] leading-relaxed">
                  <li className="flex items-start gap-1.5">
                    <span className="text-[#c19a3b] font-bold mt-0.5">✓</span>
                    <span>All values are generated dynamically from audited company cashflow records.</span>
                  </li>
                  <li className="flex items-start gap-1.5">
                    <span className="text-[#c19a3b] font-bold mt-0.5">✓</span>
                    <span>Amounts are converted to base currency (PKR) at exchange rates locked at transaction date.</span>
                  </li>
                  <li className="flex items-start gap-1.5">
                    <span className="text-[#c19a3b] font-bold mt-0.5">✓</span>
                    <span>Confidential report. For internal corporate reference and auditor authorization only.</span>
                  </li>
                </ul>
              </div>
            </div>

            {/* Contact details */}
            <div className="space-y-2 pt-6 border-t border-white/10 text-[8px] text-[#a3b8b3]/80">
              <p className="flex items-center gap-2"><span>📞</span> <span>+92 123 4567890</span></p>
              <p className="flex items-center gap-2"><span>✉️</span> <span className="truncate">{userEmail}</span></p>
              <p className="flex items-center gap-2"><span>🌐</span> <span>www.expensetrack.com</span></p>
              <p className="flex items-center gap-2"><span>📍</span> <span>123 Auditing St, PK</span></p>
            </div>
          </div>

          {/* Right Column (Report Content Panel) */}
          <div className="w-[68%] p-10 flex flex-col justify-between bg-white text-[#2c443e]">
            
            {/* Header info */}
            <div>
              <div className="flex justify-between items-start border-b border-[#e4ebe8] pb-6">
                <div>
                  <h1 className="text-3xl font-black tracking-tight text-[#2c443e] uppercase leading-none">
                    {REPORT_TYPES.find(t => t.value === reportType)?.label}
                  </h1>
                  <p className="text-[#6c857f] font-semibold text-xs mt-2">Financial Report Statement</p>
                </div>
                <div className="text-right text-[9px] text-[#6c857f] space-y-1">
                  <p><strong>Report No:</strong> #ET-{Math.floor(100000 + Math.random() * 900000)}</p>
                  <p><strong>Date:</strong> {new Date().toLocaleDateString()}</p>
                  <p><strong>Period:</strong> {from} to {to}</p>
                </div>
              </div>

              <div className="mt-6">
                <p className="text-[9px] text-[#6c857f] uppercase font-bold tracking-wider">Report Recipient</p>
                <h3 className="text-sm font-extrabold text-[#2c443e] mt-1">Finance Auditing Team</h3>
                <p className="text-[10px] text-[#6c857f]">Internal Business Suite</p>
              </div>

              {/* Data Table / Content */}
              <div className="mt-8">
                {renderPrintReportTable(reportType, result)}
              </div>
            </div>

            {/* Bottom Totals and Signature Approval Block */}
            <div className="mt-auto border-t border-[#e4ebe8] pt-6 flex justify-between items-end">
              <div>
                {result.total !== undefined ? (
                  <div>
                    <span className="text-[9px] font-bold text-[#6c857f] tracking-wider uppercase">Grand Total</span>
                    <h2 className="text-xl font-black text-[#c19a3b] mt-1">PKR {result.total.toLocaleString()}</h2>
                  </div>
                ) : (
                  result.netProfit !== undefined && (
                    <div>
                      <span className="text-[9px] font-bold text-[#6c857f] tracking-wider uppercase">Net Profit</span>
                      <h2 className="text-xl font-black text-[#c19a3b] mt-1">PKR {result.netProfit.toLocaleString()}</h2>
                    </div>
                  )
                )}
              </div>

              {/* Signature block formatted as pill shape like reference */}
              <div className="flex flex-col items-center">
                <div className="border border-[#2c443e] rounded-full px-6 py-2 bg-[#e4ebe8]/20 text-center min-w-[150px]">
                  <span className="text-[8px] font-bold text-[#6c857f] uppercase tracking-widest block">Authorized Signatory</span>
                  <span className="font-serif italic text-xs text-[#2c443e] mt-1 block">{userName}</span>
                </div>
                <p className="text-[8px] font-bold text-[#6c857f] uppercase tracking-wider mt-2">Finance Manager</p>
              </div>
            </div>

          </div>

        </div>
      )}

      {/* Search Options Card */}
      <Card className="border-none shadow-md rounded-[24px] bg-white overflow-hidden no-print">
        <CardHeader className="pb-3 pt-6 px-6">
          <CardTitle className="text-sm font-bold tracking-widest text-[#6c857f] uppercase">
            Report Options
          </CardTitle>
        </CardHeader>
        <CardContent className="px-6 pb-6">
          <div className="flex flex-wrap gap-4 items-end">
            
            {/* Report Type Selector */}
            <div className="space-y-1.5 flex-1 min-w-[200px]">
              <Label className="text-[10px] font-bold tracking-widest text-[#6c857f] uppercase">Report Type</Label>
              <Select 
                value={reportType} 
                onChange={e => setReportType(e.target.value)}
                className="bg-[#e4ebe8]/40 border-none rounded-xl h-11 text-xs text-[#2c443e] font-semibold focus-visible:ring-1 focus-visible:ring-[#c19a3b]"
              >
                {REPORT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </Select>
            </div>

            {/* From Date */}
            <div className="space-y-1.5 w-full sm:w-auto sm:min-w-[150px]">
              <Label className="text-[10px] font-bold tracking-widest text-[#6c857f] uppercase">From</Label>
              <Input 
                type="date" 
                value={from} 
                onChange={e => setFrom(e.target.value)} 
                className="bg-[#e4ebe8]/40 border-none rounded-xl h-11 text-xs text-[#2c443e] font-semibold focus-visible:ring-1 focus-visible:ring-[#c19a3b]"
              />
            </div>

            {/* To Date */}
            <div className="space-y-1.5 w-full sm:w-auto sm:min-w-[150px]">
              <Label className="text-[10px] font-bold tracking-widest text-[#6c857f] uppercase">To</Label>
              <Input 
                type="date" 
                value={to} 
                onChange={e => setTo(e.target.value)} 
                className="bg-[#e4ebe8]/40 border-none rounded-xl h-11 text-xs text-[#2c443e] font-semibold focus-visible:ring-1 focus-visible:ring-[#c19a3b]"
              />
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2 w-full sm:w-auto">
              <Button 
                onClick={runReport} 
                disabled={loading}
                className="flex-1 sm:flex-none bg-[#c19a3b] hover:bg-[#b08b30] text-white font-bold rounded-xl h-11 px-6 shadow-sm transition-all duration-150 flex items-center justify-center gap-2"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
                Generate
              </Button>

              {result?.rows?.length > 0 && (
                <Button 
                  variant="outline" 
                  onClick={() => downloadCSV(reportType, result.rows)}
                  className="flex-1 sm:flex-none border border-[#e4ebe8] hover:border-[#c19a3b] hover:bg-[#c19a3b]/5 text-[#c19a3b] font-bold rounded-xl h-11 px-5 text-xs transition-all duration-150 flex items-center justify-center gap-2"
                >
                  <Download className="h-4 w-4" /> Export CSV
                </Button>
              )}

              {result && (
                <Button 
                  variant="outline" 
                  onClick={() => window.print()}
                  className="flex-1 sm:flex-none border border-[#e4ebe8] hover:border-[#c19a3b] hover:bg-[#c19a3b]/5 text-[#c19a3b] font-bold rounded-xl h-11 px-5 text-xs transition-all duration-150 flex items-center justify-center gap-2"
                >
                  <FileText className="h-4 w-4" /> Export PDF
                </Button>
              )}
            </div>

          </div>
        </CardContent>
      </Card>

      {error && (
        <Alert variant="destructive" className="rounded-2xl border-none shadow-sm bg-rose-50 text-rose-800">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Report Result Render */}
      {result && (
        <Card className="border-none shadow-md rounded-[28px] bg-white overflow-hidden no-print">
          <CardHeader className="pb-3 pt-6 px-6 border-b border-[#e4ebe8]/40">
            <CardTitle className="text-sm font-extrabold text-[#2c443e] tracking-wider uppercase">
              {REPORT_TYPES.find(t => t.value === reportType)?.label} Details
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            {renderReportData(reportType, result)}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
