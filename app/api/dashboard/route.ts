import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser, requireSupabaseClient } from '@/lib/auth/server'

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser()
    const supabase = await requireSupabaseClient()

    const { searchParams } = request.nextUrl
    const from = searchParams.get('from')
    const to = searchParams.get('to')
    const departmentId = searchParams.get('departmentId')
    const projectId = searchParams.get('projectId')
    const companyId = user.companyId

    const now = new Date()
    const periodFrom = from ?? new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
    const periodTo = to ?? new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString()

    // Income totals
    let incomeQ = supabase
      .from('income')
      .select('converted_amount, status')
      .eq('company_id', companyId)
      .is('deleted_at', null)
      .gte('payment_date', periodFrom)
      .lte('payment_date', periodTo)
    if (projectId) incomeQ = incomeQ.eq('project_id', projectId)
    const { data: incomeRows } = await incomeQ

    const totalIncome = (incomeRows ?? [])
      .filter((r: { status: string }) => ['fully_paid', 'partially_paid', 'advance_payment'].includes(r.status))
      .reduce((sum: number, r: { converted_amount: number }) => sum + Number(r.converted_amount), 0)

    const pendingClientPayments = (incomeRows ?? [])
      .filter((r: { status: string }) => ['payment_pending', 'partially_paid', 'overdue'].includes(r.status))
      .reduce((sum: number, r: { converted_amount: number }) => sum + Number(r.converted_amount), 0)

    // Expense totals
    let expQ = supabase
      .from('expenses')
      .select('converted_amount, status, department_id, project_id')
      .eq('company_id', companyId)
      .gte('expense_date', periodFrom)
      .lte('expense_date', periodTo)
    if (departmentId) expQ = expQ.eq('department_id', departmentId)
    if (projectId) expQ = expQ.eq('project_id', projectId)
    const { data: expenseRows } = await expQ

    const totalExpenses = (expenseRows ?? [])
      .filter((r: { status: string }) => ['paid', 'approved'].includes(r.status))
      .reduce((sum: number, r: { converted_amount: number }) => sum + Number(r.converted_amount), 0)

    const pendingExpenseApprovals = (expenseRows ?? [])
      .filter((r: { status: string }) => ['submitted', 'under_review'].includes(r.status)).length

    // Account balances
    const { data: accounts } = await supabase
      .from('accounts')
      .select('id, name, account_type, current_balance')
      .eq('company_id', companyId)
      .eq('is_active', true)

    const cashBalance = (accounts ?? [])
      .filter((a: { account_type: string }) => a.account_type === 'petty_cash')
      .reduce((sum: number, a: { current_balance: number }) => sum + Number(a.current_balance), 0)

    const bankBalance = (accounts ?? [])
      .filter((a: { account_type: string }) => a.account_type === 'bank')
      .reduce((sum: number, a: { current_balance: number }) => sum + Number(a.current_balance), 0)

    const digitalWalletBalance = (accounts ?? [])
      .filter((a: { account_type: string }) => a.account_type === 'digital_wallet')
      .reduce((sum: number, a: { current_balance: number }) => sum + Number(a.current_balance), 0)

    // Payroll
    const { data: payrollRows } = await supabase
      .from('payroll')
      .select('net_salary')
      .eq('company_id', companyId)
      .gte('payment_date', periodFrom)
      .lte('payment_date', periodTo)

    const monthlyPayroll = (payrollRows ?? [])
      .reduce((sum: number, r: { net_salary: number }) => sum + Number(r.net_salary), 0)

    // Subscription costs
    const { data: subRows } = await supabase
      .from('subscriptions')
      .select('total_cost, billing_cycle')
      .eq('company_id', companyId)
      .eq('status', 'active')

    const monthlySubscriptionCost = (subRows ?? []).reduce((sum: number, s: { total_cost: number; billing_cycle: string }) => {
      if (s.billing_cycle === 'monthly') return sum + Number(s.total_cost)
      if (s.billing_cycle === 'quarterly') return sum + Number(s.total_cost) / 3
      if (s.billing_cycle === 'annually') return sum + Number(s.total_cost) / 12
      return sum
    }, 0)

    // Vendor pending
    const { data: vendorExpenses } = await supabase
      .from('expenses')
      .select('converted_amount')
      .eq('company_id', companyId)
      .in('status', ['approved'])
      .not('vendor_id', 'is', null)

    const pendingVendorPayments = (vendorExpenses ?? [])
      .reduce((sum: number, r: { converted_amount: number }) => sum + Number(r.converted_amount), 0)

    // 6-month trend
    const monthlyTrend: Array<{ month: string; income: number; expenses: number }> = []
    for (let i = 5; i >= 0; i--) {
      const d = new Date()
      d.setMonth(d.getMonth() - i)
      const mFrom = new Date(d.getFullYear(), d.getMonth(), 1).toISOString()
      const mTo = new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString()
      const label = d.toLocaleString('default', { month: 'short', year: '2-digit' })

      const { data: mIncome } = await supabase
        .from('income').select('converted_amount')
        .eq('company_id', companyId)
        .is('deleted_at', null)
        .in('status', ['fully_paid', 'partially_paid', 'advance_payment'])
        .gte('payment_date', mFrom).lte('payment_date', mTo)

      const { data: mExpense } = await supabase
        .from('expenses').select('converted_amount')
        .eq('company_id', companyId)
        .in('status', ['paid', 'approved'])
        .gte('expense_date', mFrom).lte('expense_date', mTo)

      monthlyTrend.push({
        month: label,
        income: (mIncome ?? []).reduce((s: number, r: { converted_amount: number }) => s + Number(r.converted_amount), 0),
        expenses: (mExpense ?? []).reduce((s: number, r: { converted_amount: number }) => s + Number(r.converted_amount), 0),
      })
    }

    return NextResponse.json({
      totalIncome, totalExpenses,
      profit: totalIncome - totalExpenses,
      cashBalance, bankBalance, digitalWalletBalance,
      pendingClientPayments, pendingVendorPayments, pendingExpenseApprovals,
      monthlyPayroll, monthlySubscriptionCost,
      accounts: accounts ?? [],
      monthlyTrend,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    if (message === 'Unauthorized') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
