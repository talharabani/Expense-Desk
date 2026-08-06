import { requireSupabaseClient } from '@/lib/auth/server'
import { creditAccount } from '@/lib/accounts/service'
import { writeAuditLog } from '@/lib/audit/service'
import { convertAmount, validateCurrencyFields } from '@/lib/currency/utils'
import type { Income, CreateIncomeInput, IncomeStatus } from '@/types'

export async function createIncome(
  input: CreateIncomeInput,
  userId: string,
  companyId: string,
  baseCurrency: string
): Promise<Income> {
  // Validate required fields
  if (!input.title || !input.amount || !input.currency || !input.paymentMethod) {
    throw new Error('Missing required fields: title, amount, currency, paymentMethod')
  }
  if (input.amount <= 0) {
    throw new Error('Amount must be positive')
  }

  // Validate currency
  const currencyCheck = validateCurrencyFields(input.currency, baseCurrency, input.exchangeRate)
  if (!currencyCheck.valid) {
    throw new Error(currencyCheck.error)
  }

  const exchangeRate = input.currency === baseCurrency ? 1 : input.exchangeRate!
  const convertedAmount = convertAmount(input.amount, exchangeRate)

  const supabase = await requireSupabaseClient()

  const { data, error } = await supabase
    .from('income')
    .insert({
      company_id: companyId,
      title: input.title,
      client_id: input.clientId ?? null,
      project_id: input.projectId ?? null,
      invoice_number: input.invoiceNumber ?? null,
      amount: input.amount,
      currency: input.currency,
      exchange_rate: exchangeRate,
      converted_amount: convertedAmount,
      payment_date: input.paymentDate ?? null,
      payment_method: input.paymentMethod,
      account_id: input.accountId ?? null,
      tax_amount: input.taxAmount ?? 0,
      status: input.status ?? 'draft',
      description: input.description ?? null,
      added_by: userId,
    })
    .select()
    .single()

  if (error) throw new Error(error.message)

  await writeAuditLog({
    userId,
    companyId,
    entityType: 'income',
    entityId: data.id,
    action: 'created',
    newValue: data,
  })

  return data as Income
}

export async function recordPartialPayment(
  incomeId: string,
  payment: {
    amount: number
    currency: string
    exchangeRate?: number
    paymentDate: string
    paymentMethod: string
    accountId: string
    notes?: string
  },
  userId: string,
  companyId: string,
  baseCurrency: string
): Promise<void> {
  const supabase = await requireSupabaseClient()

  // Fetch income to validate
  const { data: income, error: incomeError } = await supabase
    .from('income')
    .select('*, income_payments(amount)')
    .eq('id', incomeId)
    .eq('company_id', companyId)
    .single()

  if (incomeError || !income) throw new Error('Income record not found')

  // Sum existing payments
  const existingTotal = (income.income_payments as { amount: number }[]).reduce(
    (sum, p) => sum + Number(p.amount),
    0
  )
  if (existingTotal + payment.amount > Number(income.amount)) {
    throw new Error('Total payments cannot exceed income amount')
  }

  const exchangeRate = payment.currency === baseCurrency ? 1 : (payment.exchangeRate ?? 1)
  const convertedAmount = convertAmount(payment.amount, exchangeRate)

  // Insert payment record
  const { error: paymentError } = await supabase.from('income_payments').insert({
    income_id: incomeId,
    amount: payment.amount,
    currency: payment.currency,
    exchange_rate: exchangeRate,
    payment_date: payment.paymentDate,
    payment_method: payment.paymentMethod,
    account_id: payment.accountId,
    notes: payment.notes ?? null,
    recorded_by: userId,
  })

  if (paymentError) throw new Error(paymentError.message)

  // Credit the account
  await creditAccount(payment.accountId, convertedAmount, userId, companyId)

  // Update income status
  const newTotal = existingTotal + payment.amount
  let newStatus: IncomeStatus = 'partially_paid'
  if (newTotal >= Number(income.amount)) {
    newStatus = 'fully_paid'
  }

  await supabase
    .from('income')
    .update({ status: newStatus, updated_at: new Date().toISOString() })
    .eq('id', incomeId)

  await writeAuditLog({
    userId,
    companyId,
    entityType: 'income',
    entityId: incomeId,
    action: 'payment_recorded',
    previousValue: { status: income.status, total_paid: existingTotal },
    newValue: { status: newStatus, total_paid: newTotal, payment_amount: payment.amount },
  })
}

export async function getIncome(
  companyId: string,
  filters?: {
    clientId?: string
    projectId?: string
    status?: string
    from?: string
    to?: string
    paymentMethod?: string
    accountId?: string
    currency?: string
    limit?: number
    offset?: number
  }
) {
  const supabase = await requireSupabaseClient()
  let query = supabase
    .from('income')
    .select('*', { count: 'exact' })
    .eq('company_id', companyId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(filters?.limit ?? 50)
    .range(filters?.offset ?? 0, (filters?.offset ?? 0) + (filters?.limit ?? 50) - 1)

  if (filters?.clientId) query = query.eq('client_id', filters.clientId)
  if (filters?.projectId) query = query.eq('project_id', filters.projectId)
  if (filters?.status) query = query.eq('status', filters.status)
  if (filters?.from) query = query.gte('payment_date', filters.from)
  if (filters?.to) query = query.lte('payment_date', filters.to)
  if (filters?.paymentMethod) query = query.eq('payment_method', filters.paymentMethod)
  if (filters?.accountId) query = query.eq('account_id', filters.accountId)
  if (filters?.currency) query = query.eq('currency', filters.currency)

  const { data, error, count } = await query
  if (error) throw new Error(error.message)
  return { data, count }
}
