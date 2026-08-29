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
import { Plus, Loader2, TrendingUp, TrendingDown, Edit2, Trash2, Calendar, Building, XCircle, BarChart3 } from 'lucide-react'

interface Project {
  id: string
  name: string
  client_id?: string | null
  project_type: string
  status: string
  start_date: string | null
  end_date: string | null
  total_revenue: number
  total_expenses: number
  profit: number
  profit_margin: number
  client: { name: string } | null
}

const EMPTY_FORM = {
  name: '',
  client_id: '',
  project_type: 'general',
  start_date: '',
  end_date: '',
  status: 'active'
}

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([])
  const [clients, setClients] = useState<{ id: string; name: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  const [showCreate, setShowCreate] = useState(false)
  const [editingProject, setEditingProject] = useState<Project | null>(null)
  const [deletingProject, setDeletingProject] = useState<Project | null>(null)
  
  const [form, setForm] = useState(EMPTY_FORM)
  const [submitting, setSubmitting] = useState(false)

  const load = useCallback(async () => {
    try {
      const pRes = await fetch('/api/projects')
      if (pRes.ok) {
        setProjects(await pRes.json())
      } else {
        setError('Failed to load projects')
      }

      const cRes = await fetch('/api/clients')
      if (cRes.ok) {
        setClients(await cRes.json())
      }
    } catch {
      setError('An error occurred during load.')
    } finally {
      setLoading(false)
    }
  }, [])

  useAsyncEffect(load)

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      const r = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          client_id: form.client_id || null
        }),
      })
      if (r.ok) {
        setShowCreate(false)
        setForm(EMPTY_FORM)
        load()
      } else {
        const err = await r.json()
        setError(err.error || 'Failed to create project')
      }
    } catch {
      setError('An error occurred.')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleSaveEdit(e: React.FormEvent) {
    e.preventDefault()
    if (!editingProject) return
    setSubmitting(true)
    setError(null)
    try {
      const r = await fetch(`/api/projects/${editingProject.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          client_id: form.client_id || null
        }),
      })
      if (r.ok) {
        setEditingProject(null)
        setForm(EMPTY_FORM)
        load()
      } else {
        const err = await r.json()
        setError(err.error || 'Failed to save changes')
      }
    } catch {
      setError('An error occurred.')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDeleteConfirm() {
    if (!deletingProject) return
    setSubmitting(true)
    setError(null)
    try {
      const r = await fetch(`/api/projects/${deletingProject.id}`, {
        method: 'DELETE'
      })
      if (r.ok) {
        setDeletingProject(null)
        load()
      } else {
        const err = await r.json()
        setError(err.error || 'Failed to delete project')
      }
    } catch {
      setError('An error occurred.')
    } finally {
      setSubmitting(false)
    }
  }

  function startEdit(project: Project) {
    setEditingProject(project)
    setForm({
      name: project.name,
      client_id: project.client_id ?? '',
      project_type: project.project_type,
      start_date: project.start_date ?? '',
      end_date: project.end_date ?? '',
      status: project.status
    })
  }

  // Stats calculation
  const totalRevenue = projects.reduce((sum, p) => sum + p.total_revenue, 0)
  const totalExpenses = projects.reduce((sum, p) => sum + p.total_expenses, 0)
  const totalProfit = totalRevenue - totalExpenses
  const averageMargin = projects.length > 0 ? (projects.reduce((sum, p) => sum + p.profit_margin, 0) / projects.length) : 0

  return (
    <div className="space-y-6">
      {/* Header section */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">Projects</h1>
          <p className="text-sm text-gray-400 mt-0.5">{projects.length} project{projects.length !== 1 ? 's' : ''} total</p>
        </div>
        <Button onClick={() => { setForm(EMPTY_FORM); setShowCreate(true) }} className="gap-2 shadow-sm">
          <Plus className="h-4 w-4" /> New Project
        </Button>
      </div>

      {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}

      {/* Modern KPI Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Total Projects</span>
          <p className="text-3xl font-extrabold text-gray-900 mt-2">{projects.length}</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Active Projects</span>
          <p className="text-3xl font-extrabold text-[#c19a3b] mt-2">{projects.filter(p => p.status === 'active').length}</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Total Revenue</span>
          <p className="text-2xl font-extrabold text-emerald-600 mt-2">PKR {totalRevenue.toLocaleString()}</p>
          <p className={`text-[11px] font-semibold mt-1 ${totalProfit >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
            Net PKR {totalProfit.toLocaleString()}
          </p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Avg. Profit Margin</span>
          <p className="text-3xl font-extrabold text-[#2c443e] mt-2">{averageMargin.toFixed(1)}%</p>
        </div>
      </div>

      {/* Projects Grid */}
      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-7 w-7 animate-spin text-gray-400" /></div>
      ) : projects.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-gray-200 py-20 text-center">
          <BarChart3 className="h-12 w-12 mx-auto text-gray-200 mb-3" />
          <p className="font-medium text-gray-500">No projects found</p>
          <p className="text-sm text-gray-400 mt-1">Create your first client project to track revenue and expenses.</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {projects.map(p => {
            const profitVal = p.profit
            const isPositive = profitVal > 0
            const isNegative = profitVal < 0
            const profitColor = isNegative ? 'text-rose-600' : isPositive ? 'text-emerald-600' : 'text-gray-500'
            const statusColor = p.status === 'active' ? 'bg-emerald-50 text-emerald-700' : p.status === 'completed' ? 'bg-blue-50 text-blue-700' : 'bg-gray-100 text-gray-600'
            
            return (
              <Card key={p.id} className="relative hover:shadow-md hover:border-gray-300 transition-all duration-200 bg-white border-gray-100 rounded-2xl overflow-hidden group">
                <CardContent className="p-6 space-y-4">
                  {/* Status & Menu Buttons */}
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-bold text-gray-900 text-base group-hover:text-[#c19a3b] transition-colors">{p.name}</h3>
                      <div className="flex items-center gap-1.5 text-xs text-gray-400 mt-1">
                        <Building className="h-3.5 w-3.5" />
                        <span>{p.client?.name ?? 'No client'}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge className={`capitalize shadow-none border-none text-[10px] font-bold ${statusColor}`}>
                        {p.status}
                      </Badge>
                    </div>
                  </div>

                  {/* Profitability progress/indicator */}
                  <div className="border-t border-gray-50 pt-4 grid grid-cols-2 gap-4">
                    <div>
                      <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Revenue</span>
                      <p className="text-sm font-extrabold text-gray-900 mt-0.5">PKR {p.total_revenue.toLocaleString()}</p>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Expenses</span>
                      <p className="text-sm font-extrabold text-gray-900 mt-0.5">PKR {p.total_expenses.toLocaleString()}</p>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Profit</span>
                      <p className={`text-sm font-black flex items-center gap-1 mt-0.5 ${profitColor}`}>
                        {isNegative && <TrendingDown className="h-3 w-3" />}
                        {isPositive && <TrendingUp className="h-3 w-3" />}
                        PKR {p.profit.toLocaleString()}
                      </p>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Margin</span>
                      <p className="text-sm font-extrabold text-gray-900 mt-0.5">{p.profit_margin.toFixed(1)}%</p>
                    </div>
                  </div>

                  {/* Project Dates & Actions */}
                  <div className="border-t border-gray-50 pt-4 flex items-center justify-between text-xs text-gray-400">
                    <div className="flex items-center gap-1">
                      <Calendar className="h-3.5 w-3.5 text-gray-300" />
                      <span>{p.start_date || '?'} → {p.end_date || 'ongoing'}</span>
                    </div>

                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-7 w-7 text-gray-500 hover:text-[#c19a3b] hover:bg-gray-50"
                        onClick={() => startEdit(p)}
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-7 w-7 text-gray-500 hover:text-rose-600 hover:bg-rose-50"
                        onClick={() => setDeletingProject(p)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* Create Modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md border border-gray-100 overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="text-lg font-semibold text-gray-900">New Project</h2>
              <button onClick={() => setShowCreate(false)} className="text-gray-400 hover:text-gray-600">
                <XCircle className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleCreate} className="px-6 py-5 space-y-4">
              <div className="space-y-1.5">
                <Label>Project Name *</Label>
                <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required />
              </div>
              <div className="space-y-1.5">
                <Label>Client (Optional)</Label>
                <Select value={form.client_id} onChange={e => setForm(f => ({ ...f, client_id: e.target.value }))}>
                  <option value="">No Client Assigned</option>
                  {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Project Type</Label>
                <Select value={form.project_type} onChange={e => setForm(f => ({ ...f, project_type: e.target.value }))}>
                  {['general', 'software', 'campaign', 'load'].map(t => <option key={t} value={t}>{t}</option>)}
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Start Date</Label>
                  <Input type="date" value={form.start_date} onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label>End Date</Label>
                  <Input type="date" value={form.end_date} onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))} />
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <Button type="button" variant="outline" className="flex-1" onClick={() => setShowCreate(false)}>Cancel</Button>
                <Button type="submit" className="flex-1" disabled={submitting}>
                  {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Create Project
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editingProject && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md border border-gray-100 overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="text-lg font-semibold text-gray-900">Edit Project Details</h2>
              <button onClick={() => setEditingProject(null)} className="text-gray-400 hover:text-gray-600">
                <XCircle className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleSaveEdit} className="px-6 py-5 space-y-4">
              <div className="space-y-1.5">
                <Label>Project Name *</Label>
                <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required />
              </div>
              <div className="space-y-1.5">
                <Label>Client (Optional)</Label>
                <Select value={form.client_id} onChange={e => setForm(f => ({ ...f, client_id: e.target.value }))}>
                  <option value="">No Client Assigned</option>
                  {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Project Type</Label>
                <Select value={form.project_type} onChange={e => setForm(f => ({ ...f, project_type: e.target.value }))}>
                  {['general', 'software', 'campaign', 'load'].map(t => <option key={t} value={t}>{t}</option>)}
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Start Date</Label>
                  <Input type="date" value={form.start_date} onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label>End Date</Label>
                  <Input type="date" value={form.end_date} onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Status</Label>
                <Select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
                  {['active', 'completed', 'cancelled'].map(s => <option key={s} value={s}>{s}</option>)}
                </Select>
              </div>
              <div className="flex gap-3 pt-2">
                <Button type="button" variant="outline" className="flex-1" onClick={() => setEditingProject(null)}>Cancel</Button>
                <Button type="submit" className="flex-1" disabled={submitting}>
                  {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Save Changes
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Warning */}
      {deletingProject && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm border border-gray-100 overflow-hidden p-6 space-y-4">
            <h3 className="text-lg font-bold text-gray-900">Delete Project?</h3>
            <p className="text-sm text-gray-400">
              Are you sure you want to delete <span className="font-semibold text-gray-900">&ldquo;{deletingProject.name}&rdquo;</span>? This action is permanent and will delete all project records.
            </p>
            <div className="flex gap-3 pt-2">
              <Button variant="outline" className="flex-1" onClick={() => setDeletingProject(null)}>Cancel</Button>
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
