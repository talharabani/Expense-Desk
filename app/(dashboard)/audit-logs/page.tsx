'use client'

import { useCallback, useState } from 'react'
import { useAsyncEffect } from '@/lib/hooks/use-async-effect'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Loader2, ChevronLeft, ChevronRight, History, ShieldAlert, Cpu, Calendar } from 'lucide-react'

interface AuditLog {
  id: string
  entity_type: string
  entity_id: string
  action: string
  ip_address: string | null
  device_info: string | null
  created_at: string
  user: { name: string; email: string } | null
}

const ACTION_COLORS: Record<string, string> = {
  created: 'bg-emerald-50 text-emerald-700',
  updated: 'bg-blue-50 text-blue-700',
  deleted: 'bg-rose-50 text-rose-700',
  approved: 'bg-emerald-50 text-emerald-700',
  rejected: 'bg-rose-50 text-rose-700',
  login: 'bg-purple-50 text-purple-700',
}

const ENTITY_COLORS: Record<string, string> = {
  expense: 'bg-[#e4ebe8] text-[#2c443e]',
  income: 'bg-[#e4ebe8] text-[#2c443e]',
  subscription: 'bg-purple-50 text-purple-700',
  payroll: 'bg-blue-50 text-blue-700',
  client: 'bg-teal-50 text-teal-700',
  project: 'bg-sky-50 text-sky-700',
  vendor: 'bg-amber-50 text-amber-700',
  account: 'bg-indigo-50 text-indigo-700',
}

export default function AuditLogsPage() {
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [entityType, setEntityType] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [page, setPage] = useState(0)
  const limit = 50

  const load = useCallback(async () => {
    const params = new URLSearchParams({ limit: String(limit), offset: String(page * limit) })
    if (entityType) params.set('entityType', entityType)
    if (from) params.set('from', from)
    if (to) params.set('to', to)
    const r = await fetch('/api/audit-logs?' + params)
    if (r.ok) {
      const data = await r.json()
      setLogs(data.data ?? [])
      setTotal(data.total ?? 0)
    } else setError('Failed to load audit logs')
    setLoading(false)
  }, [entityType, from, to, page])

  useAsyncEffect(load)

  // Count summaries
  const totalCreations = logs.filter(l => l.action === 'created').length
  const totalDeletions = logs.filter(l => l.action === 'deleted').length
  const totalUpdates = logs.filter(l => l.action === 'updated').length

  return (
    <div className="space-y-6">
      {/* Title */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">Audit Logs</h1>
        <p className="text-sm text-gray-400 mt-0.5">Read-only immutable activity trail of all workspace configurations</p>
      </div>

      {error && <Alert variant="destructive" className="rounded-2xl border-none shadow-sm"><AlertDescription>{error}</AlertDescription></Alert>}

      {/* KPI Activity Widgets */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Total Logs Checked</span>
            <p className="text-3xl font-extrabold text-gray-900 mt-2">{total}</p>
          </div>
          <span className="p-3 bg-[#e4ebe8]/40 text-[#2c443e] rounded-2xl">
            <History className="h-5 w-5 text-[#c19a3b]" />
          </span>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Creations Logged</span>
            <p className="text-3xl font-extrabold text-emerald-600 mt-2">{totalCreations}</p>
          </div>
          <span className="p-3 bg-emerald-50 text-emerald-700 rounded-2xl">
            <Cpu className="h-5 w-5" />
          </span>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Updates Logged</span>
            <p className="text-3xl font-extrabold text-blue-600 mt-2">{totalUpdates}</p>
          </div>
          <span className="p-3 bg-blue-50 text-blue-700 rounded-2xl">
            <History className="h-5 w-5" />
          </span>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Deletions Logged</span>
            <p className="text-3xl font-extrabold text-rose-600 mt-2">{totalDeletions}</p>
          </div>
          <span className="p-3 bg-rose-50 text-rose-700 rounded-2xl">
            <ShieldAlert className="h-5 w-5" />
          </span>
        </div>
      </div>

      {/* Filter Options */}
      <div className="flex flex-wrap gap-3">
        <Select 
          value={entityType} 
          onChange={e => { setEntityType(e.target.value); setPage(0) }} 
          className="w-44 bg-[#e4ebe8]/40 border-none rounded-xl h-11 text-xs font-semibold text-[#2c443e] focus-visible:ring-1 focus-visible:ring-[#c19a3b]"
        >
          <option value="">All Entities</option>
          {['income','expense','account','payroll','advance','subscription','budget','vendor','client','project'].map(t => (
            <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>
          ))}
        </Select>
        <div className="relative">
          <Input 
            type="date" 
            value={from} 
            onChange={e => { setFrom(e.target.value); setPage(0) }} 
            className="w-44 bg-[#e4ebe8]/40 border-none rounded-xl h-11 text-xs font-semibold text-[#2c443e] focus-visible:ring-1 focus-visible:ring-[#c19a3b]" 
            placeholder="From date" 
          />
        </div>
        <div className="relative">
          <Input 
            type="date" 
            value={to} 
            onChange={e => { setTo(e.target.value); setPage(0) }} 
            className="w-44 bg-[#e4ebe8]/40 border-none rounded-xl h-11 text-xs font-semibold text-[#2c443e] focus-visible:ring-1 focus-visible:ring-[#c19a3b]" 
            placeholder="To date" 
          />
        </div>
      </div>

      {/* Table Logs */}
      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-7 w-7 animate-spin text-gray-400" /></div>
      ) : (
        <Card className="border-none shadow-md rounded-[28px] bg-white overflow-hidden">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-[#e4ebe8]/20 text-[#2c443e] border-b border-gray-100">
                    {['User', 'Entity Type', 'Action', 'IP Address', 'Timestamp'].map(h => (
                      <th key={h} className="px-5 py-4 text-left font-bold uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {logs.map(log => {
                    const actionClass = ACTION_COLORS[log.action] || 'bg-gray-100 text-gray-600'
                    const entityClass = ENTITY_COLORS[log.entity_type] || 'bg-gray-100 text-gray-600'
                    return (
                      <tr key={log.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/50 transition-colors">
                        <td className="px-5 py-4">
                          <p className="font-bold text-gray-900">{log.user?.name ?? 'System'}</p>
                          <p className="text-[10px] text-gray-400 mt-0.5">{log.user?.email ?? 'automated process'}</p>
                        </td>
                        <td className="px-5 py-4 font-semibold">
                          <Badge className={`capitalize shadow-none border-none text-[9px] font-bold ${entityClass}`}>
                            {log.entity_type}
                          </Badge>
                          <p className="text-[10px] text-gray-400 mt-1 font-mono">{log.entity_id.slice(0, 8)}…</p>
                        </td>
                        <td className="px-5 py-4">
                          <Badge className={`capitalize shadow-none border-none text-[9px] font-bold ${actionClass}`}>
                            {log.action}
                          </Badge>
                        </td>
                        <td className="px-5 py-4 text-gray-500 font-semibold">{log.ip_address ?? '—'}</td>
                        <td className="px-5 py-4 text-gray-500 font-medium flex items-center gap-1.5 mt-1">
                          <Calendar className="h-3.5 w-3.5 text-gray-300" />
                          <span>{new Date(log.created_at).toLocaleString('en-GB')}</span>
                        </td>
                      </tr>
                    )
                  })}
                  {logs.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-5 py-12 text-center text-gray-400 font-medium italic">
                        No activity trails found for this selection.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Pagination controls */}
      {total > limit && (
        <div className="flex items-center justify-between text-xs font-semibold text-gray-500 pt-2">
          <span>Showing {page * limit + 1}–{Math.min((page + 1) * limit, total)} of {total} records</span>
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => setPage(p => p - 1)} 
              disabled={page === 0}
              className="border-gray-200 hover:border-[#c19a3b] hover:bg-[#c19a3b]/5 text-[#c19a3b] rounded-xl h-9 px-3"
            >
              <ChevronLeft className="h-4 w-4" /> Previous
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => setPage(p => p + 1)} 
              disabled={(page + 1) * limit >= total}
              className="border-gray-200 hover:border-[#c19a3b] hover:bg-[#c19a3b]/5 text-[#c19a3b] rounded-xl h-9 px-3"
            >
              Next <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
