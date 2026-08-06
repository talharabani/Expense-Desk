'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, Search } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

interface Employee {
  id: string
  name: string
  email: string
  role: string
  is_active: boolean
  department_id: string | null
}

const ROLE_COLORS: Record<string, 'default' | 'secondary' | 'success' | 'warning' | 'outline'> = {
  owner: 'default',
  finance_manager: 'success',
  manager: 'success',
  team_lead: 'warning',
  employee: 'secondary',
  auditor: 'outline',
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
      <div>
        <h2 className="text-2xl font-bold">Employees</h2>
        <p className="text-sm text-muted-foreground">View team members and their roles</p>
      </div>

      {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}

      <div className="relative">
        <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Search employees..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b bg-muted/50">
                  <tr>{['Name', 'Email', 'Role', 'Status'].map(h => (
                    <th key={h} className="px-4 py-3 text-left font-medium text-muted-foreground">{h}</th>
                  ))}</tr>
                </thead>
                <tbody>
                  {filtered.map(emp => (
                    <tr key={emp.id} className="border-b last:border-0 hover:bg-muted/30">
                      <td className="px-4 py-3 font-medium">{emp.name}</td>
                      <td className="px-4 py-3 text-muted-foreground">{emp.email}</td>
                      <td className="px-4 py-3">
                        <Badge variant={ROLE_COLORS[emp.role] ?? 'secondary'}>{emp.role.replace(/_/g, ' ')}</Badge>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={emp.is_active ? 'success' : 'outline'}>{emp.is_active ? 'Active' : 'Inactive'}</Badge>
                      </td>
                    </tr>
                  ))}
                  {filtered.length === 0 && (
                    <tr><td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">No employees found.</td></tr>
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
