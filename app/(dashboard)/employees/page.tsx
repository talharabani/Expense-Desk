'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, Search, User, ShieldCheck } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

interface Employee {
  id: string
  name: string
  email: string
  role: string
  is_active: boolean
  department_id: string | null
}

const ROLE_COLORS: Record<string, string> = {
  owner: 'bg-emerald-50 text-emerald-700',
  finance_manager: 'bg-blue-50 text-blue-700',
  manager: 'bg-blue-50 text-blue-700',
  team_lead: 'bg-amber-50 text-amber-700',
  employee: 'bg-gray-100 text-gray-700',
  auditor: 'bg-indigo-50 text-indigo-700',
}

export default function EmployeesPage() {
  const [employees, setEmployees] = useState<Employee[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  useEffect(() => {
    async function load() {
      setLoading(true)
      const supabase = createClient()
      const { data, error: err } = await supabase
        .from('users')
        .select('id, name, email, role, is_active, department_id')
        .order('name')
      if (err) setError(err.message)
      else setEmployees(data ?? [])
      setLoading(false)
    }
    load()
  }, [])

  const filtered = employees.filter(e =>
    e.name.toLowerCase().includes(search.toLowerCase()) ||
    e.email.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="space-y-6">
      {/* Title */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">Employees</h1>
        <p className="text-sm text-gray-400 mt-0.5">{employees.length} team member{employees.length !== 1 ? 's' : ''} on this account</p>
      </div>

      {error && <Alert variant="destructive" className="rounded-2xl border-none shadow-sm"><AlertDescription>{error}</AlertDescription></Alert>}

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3.5 top-3.5 h-4 w-4 text-gray-400" />
        <Input 
          placeholder="Search team members by name or email address..." 
          className="pl-10 h-11 bg-white border-none rounded-xl shadow-sm text-xs font-semibold text-gray-900 focus-visible:ring-1 focus-visible:ring-[#c19a3b]" 
          value={search} 
          onChange={e => setSearch(e.target.value)} 
        />
      </div>

      {/* Employees Table Card */}
      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-7 w-7 animate-spin text-gray-400" /></div>
      ) : (
        <Card className="border-none shadow-sm rounded-[24px] bg-white overflow-hidden">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-[#e4ebe8]/20 text-[#2c443e] border-b border-gray-100">
                    {['Member Name', 'Email Address', 'Permission Role', 'Account Status'].map(h => (
                      <th key={h} className="px-5 py-4 text-left font-bold uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(emp => {
                    const roleClass = ROLE_COLORS[emp.role] || 'bg-gray-100 text-gray-600'
                    const statusColor = emp.is_active ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-600'
                    return (
                      <tr key={emp.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/50 transition-colors">
                        <td className="px-5 py-4 font-bold text-gray-900 flex items-center gap-1.5">
                          <User className="h-3.5 w-3.5 text-gray-300" />
                          {emp.name}
                        </td>
                        <td className="px-5 py-4 text-gray-500 font-medium">{emp.email}</td>
                        <td className="px-5 py-4">
                          <Badge className={`capitalize shadow-none border-none text-[10px] font-bold ${roleClass} flex items-center gap-1 w-fit`}>
                            <ShieldCheck className="h-3 w-3" />
                            {emp.role.replace(/_/g, ' ')}
                          </Badge>
                        </td>
                        <td className="px-5 py-4">
                          <Badge className={`capitalize shadow-none border-none text-[10px] font-bold ${statusColor}`}>
                            {emp.is_active ? 'Active' : 'Inactive'}
                          </Badge>
                        </td>
                      </tr>
                    )
                  })}
                  {filtered.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-5 py-12 text-center text-gray-400 font-medium italic">
                        No team members matching this search criteria.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
