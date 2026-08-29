'use client'

import { useCallback, useState } from 'react'
import { useAsyncEffect } from '@/lib/hooks/use-async-effect'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { 
  Shield, Globe, Bell, Database, Save, Loader2, CheckCircle2, 
  Download, Key, Info, Sparkles, Server
} from 'lucide-react'

type TabType = 'profile' | 'company' | 'notifications' | 'data'

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<TabType>('profile')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // Form states
  const [userName, setUserName] = useState('')
  const [userEmail, setUserEmail] = useState('')
  const [userRole, setUserRole] = useState('')
  const [twoFA, setTwoFA] = useState(false)

  const [companyName, setCompanyName] = useState('')
  const [baseCurrency, setBaseCurrency] = useState('PKR')
  const [industryType, setIndustryType] = useState('general')
  const [timezone, setTimezone] = useState('UTC')

  // Notification simulation
  const [emailAlerts, setEmailAlerts] = useState(true)
  const [weeklySummaries, setWeeklySummaries] = useState(false)
  const [budgetWarnings, setBudgetWarnings] = useState(true)

  const loadSettings = useCallback(async () => {
    setError(null)
    try {
      const res = await fetch('/api/settings')
      if (res.ok) {
        const data = await res.json()
        setUserName(data.user?.name || '')
        setUserEmail(data.user?.email || '')
        setUserRole(data.user?.role || '')
        setTwoFA(Boolean(data.user?.two_fa_enabled))

        setCompanyName(data.company?.name || '')
        setBaseCurrency(data.company?.base_currency || 'PKR')
        setIndustryType(data.company?.industry_type || 'general')
        setTimezone(data.company?.timezone || 'UTC')
      } else {
        const err = await res.json()
        setError(err.error || 'Failed to load settings')
      }
    } catch {
      setError('An unexpected error occurred while loading settings.')
    } finally {
      setLoading(false)
    }
  }, [])

  useAsyncEffect(loadSettings)

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    setSuccess(null)
    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userName,
          two_fa_enabled: twoFA,
          companyName,
          baseCurrency,
          industryType,
          timezone
        })
      })

      if (res.ok) {
        setSuccess('Configuration preferences updated!')
        setTimeout(() => setSuccess(null), 3000)
      } else {
        const err = await res.json()
        setError(err.error || 'Failed to save settings')
      }
    } catch {
      setError('An error occurred while saving.')
    } finally {
      setSaving(false)
    }
  }

  async function exportData(type: string) {
    try {
      const res = await fetch(`/api/${type}`)
      if (res.ok) {
        const result = await res.json()
        const dataList = result.data || result
        if (!dataList || dataList.length === 0) {
          alert(`No transactions found to export for ${type}`)
          return
        }
        const keys = Object.keys(dataList[0])
        const csv = [keys.join(','), ...dataList.map((r: Record<string, unknown>) => keys.map(k => JSON.stringify(r[k] ?? '')).join(','))].join('\n')
        const blob = new Blob([csv], { type: 'text/csv' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `${type}-export.csv`
        a.click()
        URL.revokeObjectURL(url)
      } else {
        alert('Failed to export data')
      }
    } catch {
      alert('An error occurred during export.')
    }
  }

  const tabs = [
    { id: 'profile', label: 'Profile & Security', desc: 'Secure credentials & settings', icon: Shield },
    { id: 'company', label: 'Company & Currency', desc: 'Manage currency & workspace settings', icon: Globe },
    { id: 'notifications', label: 'Notifications', desc: 'Enforce alerts & submission emails', icon: Bell },
    { id: 'data', label: 'Data & Backups', desc: 'Retrieve DB exports & logs', icon: Database }
  ]

  // Calculate simulated security score
  const securityScore = (twoFA ? 35 : 0) + (userRole === 'owner' ? 45 : 30) + 20

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Dynamic Header */}
      <div className="flex items-center justify-between border-b border-[#e4ebe8] pb-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">Settings</h1>
          <p className="text-sm text-gray-400 mt-0.5">Customize your financial environment and account settings</p>
        </div>
        <Badge className="bg-[#e4ebe8] text-[#2c443e] hover:bg-[#e4ebe8] shadow-none border-none py-1.5 px-3 rounded-full font-bold text-xs uppercase tracking-wider flex items-center gap-1.5">
          <Sparkles className="h-3.5 w-3.5 text-[#c19a3b]" /> LIVE DEV
        </Badge>
      </div>

      {error && <Alert variant="destructive" className="rounded-2xl border-none shadow-md"><AlertDescription>{error}</AlertDescription></Alert>}
      {success && (
        <Alert className="rounded-2xl border-none shadow-md bg-emerald-50 text-emerald-800 flex items-center gap-2">
          <CheckCircle2 className="h-5 w-5 text-emerald-600" />
          <AlertDescription className="font-semibold">{success}</AlertDescription>
        </Alert>
      )}

      {loading ? (
        <div className="flex justify-center py-24"><Loader2 className="h-8 w-8 animate-spin text-gray-400" /></div>
      ) : (
        <form onSubmit={handleSave} className="flex flex-col md:flex-row gap-6 items-start">
          
          {/* Left Column Settings Navigation */}
          <div className="w-full md:w-72 flex-shrink-0 space-y-2">
            {tabs.map(t => {
              const Icon = t.icon
              const isActive = activeTab === t.id
              return (
                <button
                  type="button"
                  key={t.id}
                  onClick={() => setActiveTab(t.id as TabType)}
                  className={`w-full text-left p-4 rounded-[20px] transition-all duration-150 flex items-start gap-3 border ${
                    isActive 
                      ? 'bg-[#2c443e] border-[#2c443e] text-white shadow-md shadow-[#2c443e]/10' 
                      : 'bg-white border-gray-100 text-gray-700 hover:border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  <span className={`p-2 rounded-xl mt-0.5 flex-shrink-0 ${isActive ? 'bg-[#c19a3b] text-white' : 'bg-[#e4ebe8]/40 text-[#2c443e]'}`}>
                    <Icon className="h-4 w-4" />
                  </span>
                  <div className="min-w-0">
                    <span className="block font-bold text-xs leading-none uppercase tracking-wider">{t.label}</span>
                    <span className={`block text-[10px] mt-1 truncate ${isActive ? 'text-[#a3b8b3]' : 'text-gray-400'}`}>
                      {t.desc}
                    </span>
                  </div>
                </button>
              )
            })}

            {/* Simulated Server/Storage status */}
            <div className="bg-white border border-gray-100 rounded-[24px] p-5 space-y-3">
              <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest block">Server Health</span>
              <div className="flex items-center justify-between text-xs font-semibold text-gray-700">
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" /> Supabase Connection
                </span>
                <span className="text-emerald-600">CONNECTED</span>
              </div>
              <div className="flex items-center justify-between text-xs font-semibold text-gray-700 pt-2 border-t border-gray-50">
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-emerald-500" /> Files Storage Bucket
                </span>
                <span className="text-emerald-600">ACTIVE</span>
              </div>
            </div>
          </div>

          {/* Right Column Content Box */}
          <div className="flex-1 w-full bg-white rounded-[32px] border border-gray-100 shadow-sm overflow-hidden p-8 min-h-[480px] flex flex-col justify-between">
            
            <div className="space-y-6">
              
              {/* TAB 1: PROFILE & SECURITY */}
              {activeTab === 'profile' && (
                <div className="space-y-6">
                  <div>
                    <h2 className="text-lg font-bold text-gray-900">Profile & Security</h2>
                    <p className="text-xs text-gray-400 mt-0.5">Manage your personal signature and account protection</p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Full Name *</Label>
                      <Input 
                        value={userName} 
                        onChange={e => setUserName(e.target.value)} 
                        className="h-11 rounded-xl bg-[#e4ebe8]/20 border-none font-semibold text-xs text-gray-900 focus-visible:ring-1 focus-visible:ring-[#c19a3b]"
                        required 
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-[10px] font-bold uppercase tracking-wider text-gray-500">System Role</Label>
                      <div className="pt-1.5">
                        <Badge className="bg-[#2c443e] hover:bg-[#2c443e] text-white border-none py-1.5 px-4 font-bold text-xs uppercase tracking-widest shadow-none rounded-xl">
                          {userRole.replace(/_/g, ' ')}
                        </Badge>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Email Address (Read-only)</Label>
                    <Input 
                      value={userEmail} 
                      disabled 
                      className="h-11 rounded-xl bg-gray-50 text-gray-400 border-gray-100 cursor-not-allowed text-xs font-semibold"
                    />
                    <div className="flex items-center gap-1.5 text-[10px] text-gray-400">
                      <Info className="h-3 w-3 text-[#c19a3b]" />
                      <span>Used for authentication logins. Cannot be edited inside profile parameters.</span>
                    </div>
                  </div>

                  {/* Visual Security Score Card */}
                  <div className="bg-[#e4ebe8]/20 border border-[#e4ebe8]/40 rounded-2xl p-5 flex items-center justify-between gap-4">
                    <div className="space-y-1">
                      <h4 className="text-xs font-bold text-[#2c443e] flex items-center gap-1.5">
                        <Shield className="h-4 w-4 text-[#c19a3b]" /> Security Score Tracker
                      </h4>
                      <p className="text-[10px] text-gray-400 max-w-md">Calculated dynamically based on active two-factor authorization configurations.</p>
                      
                      {/* Score bar */}
                      <div className="w-64 h-2 rounded-full bg-gray-200 overflow-hidden mt-3">
                        <div 
                          className="h-full bg-[#c19a3b] transition-all duration-300"
                          style={{ width: `${securityScore}%` }}
                        />
                      </div>
                    </div>
                    <div className="text-center bg-[#2c443e] text-white rounded-xl p-3 min-w-[70px]">
                      <span className="block text-[8px] font-bold uppercase tracking-wider text-[#a3b8b3]">Score</span>
                      <span className="text-lg font-black">{securityScore}%</span>
                    </div>
                  </div>

                  {/* 2FA Toggle */}
                  <div className="border-t border-gray-100 pt-5 flex items-center justify-between">
                    <div className="space-y-1">
                      <Label className="text-xs font-bold text-gray-900 flex items-center gap-1.5">
                        <Key className="h-4 w-4 text-[#c19a3b]" /> Two-Factor Authentication (2FA)
                      </Label>
                      <p className="text-[10px] text-gray-400">Enforce secondary authentication checkups during user logins.</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setTwoFA(!twoFA)}
                      className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                        twoFA ? 'bg-[#c19a3b]' : 'bg-gray-200'
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                          twoFA ? 'translate-x-5' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>
                </div>
              )}

              {/* TAB 2: COMPANY & CURRENCY */}
              {activeTab === 'company' && (
                <div className="space-y-6">
                  <div>
                    <h2 className="text-lg font-bold text-gray-900">Company & Currency</h2>
                    <p className="text-xs text-gray-400 mt-0.5">Configure currency variables and business settings</p>
                  </div>

                  {/* Premium Company Card Mockup */}
                  <div className="bg-gradient-to-r from-[#2c443e] to-[#1c2e2a] rounded-[24px] p-6 text-white relative overflow-hidden shadow-md">
                    <div className="absolute right-0 bottom-0 translate-x-12 translate-y-12 opacity-5 pointer-events-none">
                      <Globe className="h-64 w-64 text-white" />
                    </div>
                    <div className="flex items-start justify-between">
                      <div>
                        <span className="text-[8px] font-bold tracking-widest text-[#a3b8b3] uppercase">Active Workspace</span>
                        <h3 className="text-lg font-black mt-1 uppercase tracking-tight">{companyName || 'MY WORKSPACE'}</h3>
                        <p className="text-[10px] text-[#a3b8b3] mt-1 capitalize">{industryType.replace(/_/g, ' ')} industry</p>
                      </div>
                      <div className="h-10 w-10 bg-[#c19a3b] rounded-xl flex items-center justify-center font-bold text-white shadow-inner">
                        {baseCurrency}
                      </div>
                    </div>

                    <div className="mt-8 pt-4 border-t border-white/10 flex justify-between items-center text-[10px] text-[#a3b8b3]">
                      <span>Timezone: <strong>{timezone}</strong></span>
                      <span>Access Role: <strong>{userRole.toUpperCase()}</strong></span>
                    </div>
                  </div>

                  {/* Form inputs */}
                  <div className="space-y-4">
                    <div className="space-y-1.5">
                      <Label className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Company Name *</Label>
                      <Input 
                        value={companyName} 
                        onChange={e => setCompanyName(e.target.value)} 
                        className="h-11 rounded-xl bg-[#e4ebe8]/20 border-none font-semibold text-xs text-gray-900 focus-visible:ring-1 focus-visible:ring-[#c19a3b]"
                        disabled={userRole !== 'owner' && userRole !== 'finance_manager' && userRole !== 'manager'}
                        required 
                      />
                      {(userRole !== 'owner' && userRole !== 'finance_manager' && userRole !== 'manager') && (
                        <p className="text-[9px] text-red-500 font-semibold flex items-center gap-1">
                          <Info className="h-3.5 w-3.5" /> Company name modifications require Manager privileges.
                        </p>
                      )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <Label className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Base Currency *</Label>
                        <Select 
                          value={baseCurrency} 
                          onChange={e => setBaseCurrency(e.target.value)}
                          className="h-11 rounded-xl bg-[#e4ebe8]/20 border-none font-semibold text-xs text-gray-900 focus-visible:ring-1 focus-visible:ring-[#c19a3b]"
                          disabled={userRole !== 'owner' && userRole !== 'finance_manager' && userRole !== 'manager'}
                        >
                          {['PKR','USD','EUR','GBP','AED'].map(c => <option key={c} value={c}>{c}</option>)}
                        </Select>
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Industry Sector</Label>
                        <Select 
                          value={industryType} 
                          onChange={e => setIndustryType(e.target.value)}
                          className="h-11 rounded-xl bg-[#e4ebe8]/20 border-none font-semibold text-xs text-gray-900 focus-visible:ring-1 focus-visible:ring-[#c19a3b]"
                          disabled={userRole !== 'owner' && userRole !== 'finance_manager' && userRole !== 'manager'}
                        >
                          {[
                            { v: 'general', l: 'General Business' },
                            { v: 'software_house', l: 'Software House' },
                            { v: 'call_center', l: 'Call Center' },
                            { v: 'truck_dispatching', l: 'Truck Dispatching' }
                          ].map(i => <option key={i.v} value={i.v}>{i.l}</option>)}
                        </Select>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-[10px] font-bold uppercase tracking-wider text-gray-500">System Timezone</Label>
                      <Input 
                        value={timezone} 
                        onChange={e => setTimezone(e.target.value)} 
                        className="h-11 rounded-xl bg-[#e4ebe8]/20 border-none font-semibold text-xs text-gray-900 focus-visible:ring-1 focus-visible:ring-[#c19a3b]"
                        disabled={userRole !== 'owner' && userRole !== 'finance_manager' && userRole !== 'manager'}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 3: NOTIFICATIONS */}
              {activeTab === 'notifications' && (
                <div className="space-y-6">
                  <div>
                    <h2 className="text-lg font-bold text-gray-900">Notification Settings</h2>
                    <p className="text-xs text-gray-400 mt-0.5">Manage transaction alerts and weekly report summaries</p>
                  </div>

                  <div className="space-y-4">
                    {/* Toggle row 1 */}
                    <div className="bg-[#e4ebe8]/20 rounded-2xl p-5 flex items-center justify-between border border-[#e4ebe8]/40">
                      <div className="space-y-1">
                        <Label className="text-xs font-bold text-gray-900">Email Expense Alerts</Label>
                        <p className="text-[10px] text-gray-400">Receive alerts whenever team members upload new transaction receipts.</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setEmailAlerts(!emailAlerts)}
                        className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                          emailAlerts ? 'bg-[#c19a3b]' : 'bg-gray-200'
                        }`}
                      >
                        <span
                          className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                            emailAlerts ? 'translate-x-5' : 'translate-x-0'
                          }`}
                        />
                      </button>
                    </div>

                    {/* Toggle row 2 */}
                    <div className="bg-[#e4ebe8]/20 rounded-2xl p-5 flex items-center justify-between border border-[#e4ebe8]/40">
                      <div className="space-y-1">
                        <Label className="text-xs font-bold text-gray-900">Weekly Summary Reports</Label>
                        <p className="text-[10px] text-gray-400">Receive weekly consolidated summaries covering P&L statements.</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setWeeklySummaries(!weeklySummaries)}
                        className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                          weeklySummaries ? 'bg-[#c19a3b]' : 'bg-gray-200'
                        }`}
                      >
                        <span
                          className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                            weeklySummaries ? 'translate-x-5' : 'translate-x-0'
                          }`}
                        />
                      </button>
                    </div>

                    {/* Toggle row 3 */}
                    <div className="bg-[#e4ebe8]/20 rounded-2xl p-5 flex items-center justify-between border border-[#e4ebe8]/40">
                      <div className="space-y-1">
                        <Label className="text-xs font-bold text-gray-900">Budget Warning Limits</Label>
                        <p className="text-[10px] text-gray-400">Generate alerts whenever category spending exceeds 90% of budget.</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setBudgetWarnings(!budgetWarnings)}
                        className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                          budgetWarnings ? 'bg-[#c19a3b]' : 'bg-gray-200'
                        }`}
                      >
                        <span
                          className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                            budgetWarnings ? 'translate-x-5' : 'translate-x-0'
                          }`}
                        />
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 4: DATA & BACKUPS */}
              {activeTab === 'data' && (
                <div className="space-y-6">
                  <div>
                    <h2 className="text-lg font-bold text-gray-900">Data & Backups</h2>
                    <p className="text-xs text-gray-400 mt-0.5">Securely export databases and review restore logs</p>
                  </div>

                  {/* Backup status timeline mockup */}
                  <div className="bg-[#e4ebe8]/20 border border-[#e4ebe8]/40 rounded-2xl p-5 space-y-4">
                    <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest block flex items-center gap-1">
                      <Server className="h-3.5 w-3.5 text-[#c19a3b]" /> Daily Backups Registry
                    </span>

                    <div className="space-y-3">
                      {[
                        { date: 'Today, 04:00 AM', desc: 'Full db snapshot backup', status: 'SUCCESS' },
                        { date: 'Yesterday, 04:00 AM', desc: 'Full db snapshot backup', status: 'SUCCESS' },
                        { date: '2 days ago, 04:00 AM', desc: 'Full db snapshot backup', status: 'SUCCESS' },
                      ].map((log, i) => (
                        <div key={i} className="flex items-center justify-between text-xs pt-2.5 border-t border-gray-100 first:border-none first:pt-0">
                          <div>
                            <p className="font-bold text-gray-900">{log.desc}</p>
                            <p className="text-[10px] text-gray-400 mt-0.5">{log.date}</p>
                          </div>
                          <span className="bg-emerald-50 text-emerald-700 text-[8px] font-bold px-2 py-0.5 rounded">
                            {log.status}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Export Buttons */}
                  <div className="space-y-3">
                    <h4 className="text-xs font-bold text-gray-900 uppercase tracking-wider">Download Spreadsheets</h4>
                    <p className="text-[10px] text-gray-400 leading-normal">Retrieve dynamic csv exports containing all transaction metadata for audits.</p>
                    
                    <div className="flex flex-wrap gap-3 pt-2">
                      <Button 
                        type="button" 
                        variant="outline" 
                        onClick={() => exportData('expenses')}
                        className="border-[#e4ebe8] hover:border-[#c19a3b] text-gray-700 hover:bg-[#c19a3b]/5 font-bold rounded-xl text-xs gap-2 px-5 h-11"
                      >
                        <Download className="h-4 w-4 text-[#c19a3b]" /> Export Expenses
                      </Button>
                      <Button 
                        type="button" 
                        variant="outline" 
                        onClick={() => exportData('income')}
                        className="border-[#e4ebe8] hover:border-[#c19a3b] text-gray-700 hover:bg-[#c19a3b]/5 font-bold rounded-xl text-xs gap-2 px-5 h-11"
                      >
                        <Download className="h-4 w-4 text-[#c19a3b]" /> Export Incomes
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Save Buttons Footer */}
            {activeTab !== 'data' && (
              <div className="border-t border-gray-100 pt-6 mt-6 flex justify-end">
                <Button 
                  type="submit" 
                  disabled={saving}
                  className="bg-[#c19a3b] hover:bg-[#b08b30] text-white font-bold rounded-xl h-11 px-8 shadow-sm flex items-center gap-2 text-xs uppercase tracking-wider transition-all duration-150"
                >
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  Save Settings
                </Button>
              </div>
            )}
          </div>
        </form>
      )}
    </div>
  )
}
