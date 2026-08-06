import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth/server'
import { hasPermission } from '@/lib/auth/permissions'
import { requireSupabaseClient } from '@/lib/auth/server'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ type: string }> }
) {
  try {
    const user = await getAuthUser()
    if (!hasPermission(user.role, 'reports:view') && !hasPermission(user.role, 'expenses:view_all')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { type } = await params
    const { searchParams } = request.nextUrl
    const from = searchParams.get('from') || new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10)
    const to = searchParams.get('to') || new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).toISOString().slice(0, 10)

    const supabase = await requireSupabaseClient()
    const companyId = user.companyId

    if (type === 'profit_and_loss') {
      // 1. Get Income
      const { data: incomeData, error: incError } = await supabase
        .from('income')
        .select('converted_amount, payment_date, title, amount, currency')
        .eq('company_id', companyId)
        .is('deleted_at', null)
        .gte('payment_date', from)
        .lte('payment_date', to)

      if (incError) throw new Error(`Income query error: ${incError.message}`)

      // 2. Get Expenses
      const { data: expenseData, error: expError } = await supabase
        .from('expenses')
        .select('converted_amount, expense_date, title, category, amount, currency, status')
        .eq('company_id', companyId)
        .is('deleted_at', null)
        .gte('expense_date', from)
        .lte('expense_date', to)
        .in('status', ['approved', 'paid']) // Only count approved/paid expenses

      if (expError) throw new Error(`Expense query error: ${expError.message}`)

      const totalIncome = incomeData?.reduce((sum, item) => sum + Number(item.converted_amount || 0), 0) || 0
      const totalExpenses = expenseData?.reduce((sum, item) => sum + Number(item.converted_amount || 0), 0) || 0
      const netProfit = totalIncome - totalExpenses
      const profitMargin = totalIncome > 0 ? (netProfit / totalIncome) * 100 : 0

      // Formulate rows for detailed breakdown
      const rows: any[] = []
      
      // Add Income records to rows
      incomeData?.forEach(i => {
        rows.push({
          date: i.payment_date,
          title: i.title,
          type: 'Income',
          category: 'Client Payment',
          amount: i.amount,
          currency: i.currency,
          converted_amount: i.converted_amount
        })
      })

      // Add Expense records to rows
      expenseData?.forEach(e => {
        rows.push({
          date: e.expense_date,
          title: e.title,
          type: 'Expense',
          category: e.category || 'General Expense',
          amount: e.amount,
          currency: e.currency,
          converted_amount: e.converted_amount
        })
      })

      // Sort rows by date desc
      rows.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

      return NextResponse.json({
        totalIncome,
        totalExpenses,
        netProfit,
        profitMargin,
        rows
      })
    }

    if (type === 'income_statement') {
      const { data: rows, error } = await supabase
        .from('income')
        .select('payment_date, title, amount, currency, converted_amount, status, payment_method')
        .eq('company_id', companyId)
        .is('deleted_at', null)
        .gte('payment_date', from)
        .lte('payment_date', to)
        .order('payment_date', { ascending: false })

      if (error) throw new Error(error.message)

      const total = rows?.reduce((sum, item) => sum + Number(item.converted_amount || 0), 0) || 0
      return NextResponse.json({ rows, total })
    }

    if (type === 'expense_report') {
      const { data: rows, error } = await supabase
        .from('expenses')
        .select('expense_date, title, category, amount, currency, converted_amount, status, payment_method')
        .eq('company_id', companyId)
        .is('deleted_at', null)
        .gte('expense_date', from)
        .lte('expense_date', to)
        .order('expense_date', { ascending: false })

      if (error) throw new Error(error.message)

      const total = rows?.reduce((sum, item) => sum + Number(item.converted_amount || 0), 0) || 0
      return NextResponse.json({ rows, total })
    }

    if (type === 'cash_flow') {
      const { data: incomeData } = await supabase
        .from('income')
        .select('payment_date, title, amount, currency, converted_amount, payment_method')
        .eq('company_id', companyId)
        .is('deleted_at', null)
        .gte('payment_date', from)
        .lte('payment_date', to)

      const { data: expenseData } = await supabase
        .from('expenses')
        .select('expense_date, title, category, amount, currency, converted_amount, payment_method, status')
        .eq('company_id', companyId)
        .is('deleted_at', null)
        .gte('expense_date', from)
        .lte('expense_date', to)
        .in('status', ['approved', 'paid'])

      const rows: any[] = []
      let totalInflow = 0
      let totalOutflow = 0

      incomeData?.forEach(i => {
        totalInflow += Number(i.converted_amount || 0)
        rows.push({
          date: i.payment_date,
          title: i.title,
          flow_direction: 'Inflow (+)',
          category: 'Client Payment',
          amount: i.amount,
          currency: i.currency,
          converted_amount: i.converted_amount,
          payment_method: i.payment_method || '—'
        })
      })

      expenseData?.forEach(e => {
        totalOutflow += Number(e.converted_amount || 0)
        rows.push({
          date: e.expense_date,
          title: e.title,
          flow_direction: 'Outflow (-)',
          category: e.category,
          amount: e.amount,
          currency: e.currency,
          converted_amount: e.converted_amount,
          payment_method: e.payment_method || '—'
        })
      })

      rows.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

      return NextResponse.json({
        rows,
        total: totalInflow - totalOutflow
      })
    }

    if (type === 'account_balance') {
      const { data: rows, error } = await supabase
        .from('accounts')
        .select('name, type, current_balance, currency')
        .eq('company_id', companyId)
        .order('name', { ascending: true })

      if (error) throw new Error(error.message)

      const total = rows?.reduce((sum, item) => sum + Number(item.current_balance || 0), 0) || 0
      return NextResponse.json({ rows, total })
    }

    if (type === 'payroll') {
      const { data: rows, error } = await supabase
        .from('payroll')
        .select('payment_date, basic_salary, bonus, deduction, net_salary, status')
        .eq('company_id', companyId)
        .gte('payment_date', from)
        .lte('payment_date', to)
        .order('payment_date', { ascending: false })

      if (error) {
        // Return empty row structure if payroll table doesn't exist or has issues
        return NextResponse.json({ rows: [], total: 0 })
      }

      const total = rows?.reduce((sum, item) => sum + Number(item.net_salary || 0), 0) || 0
      return NextResponse.json({ rows, total })
    }

    if (type === 'subscription') {
      const { data: rows, error } = await supabase
        .from('subscriptions')
        .select('name, amount, currency, billing_cycle, status, next_billing_date')
        .eq('company_id', companyId)
        .order('name', { ascending: true })

      if (error) {
        return NextResponse.json({ rows: [], total: 0 })
      }

      const total = rows?.reduce((sum, item) => sum + Number(item.amount || 0), 0) || 0
      return NextResponse.json({ rows, total })
    }

    if (type === 'vendor_payment') {
      const { data: rows, error } = await supabase
        .from('expenses')
        .select('expense_date, title, category, amount, currency, converted_amount, payment_method, status')
        .eq('company_id', companyId)
        .is('deleted_at', null)
        .not('vendor_id', 'is', null)
        .gte('expense_date', from)
        .lte('expense_date', to)
        .order('expense_date', { ascending: false })

      if (error) throw new Error(error.message)

      const total = rows?.reduce((sum, item) => sum + Number(item.converted_amount || 0), 0) || 0
      return NextResponse.json({ rows, total })
    }

    // Default fallback - query the table of the same name dynamically if matching
    try {
      const { data: rows, error } = await supabase
        .from(type)
        .select('*')
        .eq('company_id', companyId)
        .limit(100)

      if (error) throw new Error(error.message)
      return NextResponse.json({ rows })
    } catch {
      return NextResponse.json({ error: `Unsupported report type: ${type}` }, { status: 400 })
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    if (message === 'Unauthorized') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
