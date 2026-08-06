'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import {
  Loader2, DollarSign, TrendingDown, TrendingUp, CreditCard,
  Search, ArrowUpRight, ArrowDownRight, RefreshCw, Calendar, Tag, ChevronRight, Plus
} from 'lucide-react'

interface Transaction {
  id: string
  title: string
  category: string
  amount: number
  currency: string
  date: string
  type: 'income' | 'expense'
  status: string
  paymentMethod: string
}

interface SummaryData {
  totalExpenses: number
  totalIncome: number
  netBalance: number
  pendingApprovals: number
}

const CATEGORIES = [
  'salaries', 'rent', 'utilities', 'software', 'hardware', 'marketing',
  'travel', 'meals', 'office_supplies', 'insurance', 'professional_services',
  'maintenance', 'training', 'subscriptions', 'miscellaneous',
]

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-700 hover:bg-gray-200 border-none',
  submitted: 'bg-amber-100 text-amber-800 hover:bg-amber-200 border-none',
  under_review: 'bg-amber-100 text-amber-800 hover:bg-amber-200 border-none',
  approved: 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200 border-none',
  rejected: 'bg-rose-100 text-rose-800 hover:bg-rose-200 border-none',
  paid: 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200 border-none',
  cancelled: 'bg-gray-100 text-gray-500 hover:bg-gray-200 border-none',
}

export default function DashboardPage() {
  const router = useRouter()
  const [summary, setSummary] = useState<SummaryData>({
    totalExpenses: 0,
    totalIncome: 0,
    netBalance: 0,
    pendingApprovals: 0,
  })
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Filters state
  const [searchQuery, setSearchQuery] = useState('')
  const [filterType, setFilterType] = useState<'all' | 'income' | 'expense'>('all')
  const [filterCategory, setFilterCategory] = useState('')
  const [filterDate, setFilterDate] = useState('')

  async function loadDashboardData() {
    try {
      setLoading(true)
      const [expRes, incRes] = await Promise.all([
        fetch('/api/expenses'),
        fetch('/api/income'),
      ])

      let totalExpenses = 0
      let totalIncome = 0
      let pendingApprovals = 0
      const combinedList: Transaction[] = []

      if (expRes.ok) {
        const expData = await expRes.json()
        const list = expData.data ?? []
        totalExpenses = list.reduce((sum: number, e: any) => sum + (e.amount || 0), 0)
        pendingApprovals = list.filter((e: any) => e.status === 'submitted' || e.status === 'under_review').length
        
        list.forEach((e: any) => {
          combinedList.push({
            id: e.id,
            title: e.title,
            category: e.category || 'miscellaneous',
            amount: e.amount,
            currency: e.currency,
            date: e.expense_date || e.expenseDate || new Date().toISOString().slice(0, 10),
            type: 'expense',
            status: e.status || 'draft',
            paymentMethod: e.payment_method || e.paymentMethod || '—'
          })
        })
      }

      if (incRes.ok) {
        const incData = await incRes.json()
        const list = incData.data ?? []
        totalIncome = list.reduce((sum: number, i: any) => sum + (i.amount || 0), 0)

        list.forEach((i: any) => {
          combinedList.push({
            id: i.id,
            title: i.title,
            category: i.category || 'client_payment',
            amount: i.amount,
            currency: i.currency,
            date: i.payment_date || i.paymentDate || new Date().toISOString().slice(0, 10),
            type: 'income',
            status: i.status || 'received',
            paymentMethod: i.payment_method || i.paymentMethod || '—'
          })
        })
      }

      // Sort combined by date desc
      combinedList.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

      setTransactions(combinedList)
      setSummary({
        totalExpenses,
        totalIncome,
        netBalance: totalIncome - totalExpenses,
        pendingApprovals,
      })
    } catch (err) {
      setError('Failed to load dashboard metrics')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadDashboardData()
  }, [])

  // Filter implementation
  const filteredTransactions = transactions.filter(t => {
    const matchesSearch = t.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          t.category.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesType = filterType === 'all' || t.type === filterType
    const matchesCategory = !filterCategory || t.category === filterCategory
    const matchesDate = !filterDate || t.date === filterDate
    return matchesSearch && matchesType && matchesCategory && matchesDate
  })

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-10 w-10 animate-spin text-[#c19a3b]" />
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Top Travel-style Search Filter Card */}
      <Card className="border-none shadow-md overflow-hidden rounded-[24px] bg-white">
        <CardContent className="p-6">
          <div className="grid gap-4 md:grid-cols-4 lg:grid-cols-5 items-end">
            
            {/* Search Query Input */}
            <div className="space-y-1.5 col-span-1 md:col-span-2 lg:col-span-1">
              <label className="text-[10px] font-bold tracking-widest text-[#6c857f] uppercase flex items-center gap-1.5">
                <Search className="h-3.5 w-3.5" /> Search Item
              </label>
              <div className="relative">
                <Input
                  placeholder="Rent, salary, software..."
                  className="bg-[#e4ebe8]/40 border-none focus-visible:ring-1 focus-visible:ring-[#c19a3b] rounded-xl pl-3 h-11"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                />
              </div>
            </div>

            {/* Type selector (ONE WAY, ROUND TRIP equivalent) */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold tracking-widest text-[#6c857f] uppercase flex items-center gap-1.5">
                <RefreshCw className="h-3.5 w-3.5" /> Flow Type
              </label>
              <div className="flex rounded-xl bg-[#e4ebe8]/40 p-1 h-11 items-center">
                {(['all', 'income', 'expense'] as const).map(type => (
                  <button
                    key={type}
                    onClick={() => setFilterType(type)}
                    className={`flex-1 text-[10px] font-bold tracking-wider uppercase py-2 px-1 rounded-lg transition-all duration-150 truncate ${
                      filterType === type
                        ? 'bg-[#2c443e] text-white shadow-sm'
                        : 'text-[#6c857f] hover:text-[#2c443e]'
                    }`}
                  >
                    {type === 'all' ? 'All' : type}
                  </button>
                ))}
              </div>
            </div>

            {/* Category selection */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold tracking-widest text-[#6c857f] uppercase flex items-center gap-1.5">
                <Tag className="h-3.5 w-3.5" /> Category
              </label>
              <select
                className="w-full bg-[#e4ebe8]/40 border-none rounded-xl h-11 px-3 text-xs text-[#2c443e] font-semibold focus-visible:ring-1 focus-visible:ring-[#c19a3b] outline-none"
                value={filterCategory}
                onChange={e => setFilterCategory(e.target.value)}
              >
                <option value="">All Categories</option>
                {CATEGORIES.map(cat => (
                  <option key={cat} value={cat}>{cat.replace(/_/g, ' ')}</option>
                ))}
              </select>
            </div>

            {/* Date filter */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold tracking-widest text-[#6c857f] uppercase flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5" /> Date Selection
              </label>
              <Input
                type="date"
                className="bg-[#e4ebe8]/40 border-none focus-visible:ring-1 focus-visible:ring-[#c19a3b] rounded-xl h-11 text-xs text-[#2c443e] font-semibold"
                value={filterDate}
                onChange={e => setFilterDate(e.target.value)}
              />
            </div>

            {/* Ochre Add/Search Button */}
            <div className="col-span-1">
              <Button
                onClick={() => router.push('/expenses')}
                className="w-full bg-[#c19a3b] hover:bg-[#b08b30] text-white font-bold rounded-xl h-11 shadow-sm transition-all duration-150 flex items-center justify-center gap-2"
              >
                <Plus className="h-4 w-4" /> Add Record
              </Button>
            </div>

          </div>
        </CardContent>
      </Card>

      {/* Main Dual Column Dashboard Area */}
      <div className="grid gap-6 lg:grid-cols-3">
        
        {/* Left Column (Transactions List) */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-sm font-bold tracking-wider text-[#2c443e] uppercase">
              Recent Transactions ({filteredTransactions.length})
            </h3>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="text-xs bg-white border-[#e4ebe8] text-[#2c443e] hover:bg-[#e4ebe8]/20 rounded-xl"
                onClick={() => {
                  setSearchQuery('')
                  setFilterType('all')
                  setFilterCategory('')
                  setFilterDate('')
                }}
              >
                Clear Filters
              </Button>
            </div>
          </div>

          {/* Ticket style cards list */}
          <div className="space-y-3.5">
            {filteredTransactions.slice(0, 8).map((t) => (
              <Card key={t.id} className="border-none shadow-sm rounded-2xl overflow-hidden bg-white hover:shadow-md transition-shadow duration-200">
                <CardContent className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    {/* Circle Icon Indicator */}
                    <div className={`h-11 w-11 rounded-full flex items-center justify-center flex-shrink-0 ${
                      t.type === 'income' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'
                    }`}>
                      {t.type === 'income' ? (
                        <ArrowUpRight className="h-5 w-5" />
                      ) : (
                        <ArrowDownRight className="h-5 w-5" />
                      )}
                    </div>

                    <div>
                      <h4 className="font-bold text-[#2c443e] text-sm md:text-base leading-tight">{t.title}</h4>
                      <div className="flex items-center gap-2 mt-1 text-xs text-[#6c857f] flex-wrap">
                        <span className="font-semibold uppercase tracking-wider text-[10px] px-1.5 py-0.5 rounded bg-[#e4ebe8] text-[#2c443e]">
                          {t.category.replace(/_/g, ' ')}
                        </span>
                        <span>•</span>
                        <span>{t.date}</span>
                        <span>•</span>
                        <span className="capitalize">{t.paymentMethod}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    {/* Status Badge */}
                    <Badge className={cn('text-[10px] font-bold uppercase py-1 px-2.5 rounded-full shadow-none hidden sm:inline-flex', STATUS_COLORS[t.status] || 'bg-gray-100 text-gray-800')}>
                      {t.status.replace(/_/g, ' ')}
                    </Badge>

                    {/* Cost / Amount details */}
                    <div className="text-right">
                      <div className={`font-extrabold text-sm md:text-lg leading-none ${
                        t.type === 'income' ? 'text-emerald-600' : 'text-[#2c443e]'
                      }`}>
                        {t.type === 'income' ? '+' : '-'} {t.currency} {t.amount.toLocaleString()}
                      </div>
                      <div className="text-[10px] text-[#6c857f] mt-1">Converted value</div>
                    </div>

                    {/* View Button */}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => router.push(t.type === 'income' ? '/income' : '/expenses')}
                      className="border-[#e4ebe8] hover:border-[#c19a3b] hover:bg-[#c19a3b]/5 text-[#c19a3b] font-bold rounded-xl px-4 py-2 text-xs"
                    >
                      VIEW
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}

            {filteredTransactions.length === 0 && (
              <Card className="border-none shadow-sm rounded-2xl bg-white/70 py-12 text-center text-[#6c857f]">
                <CardContent className="space-y-2">
                  <p className="font-bold">No records matched your search filters.</p>
                  <p className="text-xs">Try selecting a different date range or flow type.</p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>

        {/* Right Column (Dark Teal Summary details card) */}
        <div className="space-y-4">
          <h3 className="text-sm font-bold tracking-wider text-[#2c443e] uppercase px-1">
            Financial Health
          </h3>

          <Card className="border-none shadow-md bg-[#2c443e] text-white rounded-[28px] overflow-hidden p-6 relative">
            {/* Background design accents */}
            <div className="absolute top-0 right-0 h-32 w-32 rounded-bl-full bg-white/5 pointer-events-none" />
            <div className="absolute bottom-0 left-0 h-24 w-24 rounded-tr-full bg-[#c19a3b]/10 pointer-events-none" />

            <div className="space-y-6 relative">
              {/* Card Header stats */}
              <div>
                <p className="text-[10px] font-bold tracking-widest text-[#a3b8b3] uppercase">Net Cash Balance</p>
                <h2 className={`text-3xl font-black tracking-tight mt-1 ${summary.netBalance >= 0 ? 'text-[#c19a3b]' : 'text-rose-400'}`}>
                  PKR {summary.netBalance.toLocaleString()}
                </h2>
                <p className="text-xs text-[#a3b8b3] mt-1.5 leading-relaxed">
                  Your monthly summary of revenues and spending actions across all accounts.
                </p>
              </div>

              {/* Progress split indicators */}
              <div className="space-y-3.5 pt-2 border-t border-white/5">
                <div>
                  <div className="flex items-center justify-between text-xs font-bold mb-1.5">
                    <span className="flex items-center gap-1"><ArrowUpRight className="h-3.5 w-3.5 text-emerald-400" /> Revenue Flow</span>
                    <span className="text-[#a3b8b3]">{summary.totalIncome > 0 ? Math.round((summary.totalIncome / (summary.totalIncome + summary.totalExpenses || 1)) * 100) : 0}%</span>
                  </div>
                  <div className="h-2 w-full bg-[#1c2e2a] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-emerald-400 rounded-full"
                      style={{ width: `${summary.totalIncome > 0 ? (summary.totalIncome / (summary.totalIncome + summary.totalExpenses || 1)) * 100 : 0}%` }}
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between text-xs font-bold mb-1.5">
                    <span className="flex items-center gap-1"><ArrowDownRight className="h-3.5 w-3.5 text-rose-400" /> Expenses Flow</span>
                    <span className="text-[#a3b8b3]">{summary.totalExpenses > 0 ? Math.round((summary.totalExpenses / (summary.totalIncome + summary.totalExpenses || 1)) * 100) : 0}%</span>
                  </div>
                  <div className="h-2 w-full bg-[#1c2e2a] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-rose-400 rounded-full"
                      style={{ width: `${summary.totalExpenses > 0 ? (summary.totalExpenses / (summary.totalIncome + summary.totalExpenses || 1)) * 100 : 0}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Custom SVG Trend Map */}
              <div className="pt-2">
                <div className="flex items-center justify-between text-[10px] font-bold tracking-widest text-[#a3b8b3] uppercase mb-3">
                  <span>Cash Flow Trend</span>
                  <span className="text-[#c19a3b]">Live Analysis</span>
                </div>
                <div className="h-28 w-full bg-[#1c2e2a]/60 rounded-2xl p-3 flex items-center justify-center overflow-hidden">
                  <svg className="w-full h-full text-[#c19a3b]" viewBox="0 0 100 40" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <defs>
                      <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#c19a3b" stopOpacity="0.4" />
                        <stop offset="100%" stopColor="#c19a3b" stopOpacity="0" />
                      </linearGradient>
                    </defs>
                    <path
                      d="M0 35 Q 20 10, 40 25 T 80 15 T 100 5"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      fill="none"
                      strokeLinecap="round"
                    />
                    <path
                      d="M0 35 Q 20 10, 40 25 T 80 15 T 100 5 L 100 40 L 0 40 Z"
                      fill="url(#chartGradient)"
                    />
                    <circle cx="40" cy="25" r="2.5" fill="#ffffff" stroke="currentColor" strokeWidth="1.5" />
                    <circle cx="80" cy="15" r="2.5" fill="#ffffff" stroke="currentColor" strokeWidth="1.5" />
                  </svg>
                </div>
              </div>

              {/* Action Link Row */}
              <div className="flex items-center justify-between bg-[#1c2e2a]/40 rounded-xl p-3.5 border border-white/5">
                <div className="flex items-center gap-3">
                  <CreditCard className="h-5 w-5 text-[#c19a3b]" />
                  <div>
                    <p className="text-xs font-bold leading-none">Approvals Pending</p>
                    <p className="text-[10px] text-[#a3b8b3] mt-1">{summary.pendingApprovals} items require review</p>
                  </div>
                </div>
                <Button
                  size="sm"
                  onClick={() => router.push('/approvals')}
                  className="bg-[#c19a3b] hover:bg-[#b08b30] text-white rounded-lg h-7 px-3 text-[10px] font-bold flex items-center gap-1"
                >
                  REVIEW <ChevronRight className="h-3 w-3" />
                </Button>
              </div>

            </div>
          </Card>
        </div>

      </div>
    </div>
  )
}
