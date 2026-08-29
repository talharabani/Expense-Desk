/**
 * Service-layer tests for lib/income/service.ts, concentrating on the partial
 * payment path — the place where an arithmetic slip silently corrupts money.
 *
 * The mock cannot join, so the `income_payments(amount)` embed that the service
 * selects is seeded directly on the income row.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createMockSupabase, type MockSupabase } from '../helpers/supabase-mock'

let supabase: MockSupabase

vi.mock('@/lib/auth/server', () => ({
  requireSupabaseClient: async () => supabase,
}))

const { recordPartialPayment } = await import('@/lib/income/service')

const COMPANY = 'company-1'
const USER = 'user-1'
const INCOME = 'income-1'
const ACCOUNT = 'account-1'

const payment = {
  amount: 400,
  currency: 'PKR',
  paymentDate: '2026-06-01',
  paymentMethod: 'bank_transfer',
  accountId: ACCOUNT,
}

function seed(incomeAmount: number, paidAlready: number[] = [], accountBalance = 0) {
  supabase = createMockSupabase({
    income: [
      {
        id: INCOME,
        company_id: COMPANY,
        amount: incomeAmount,
        status: 'pending',
        income_payments: paidAlready.map((amount) => ({ amount })),
      },
    ],
    accounts: [{ id: ACCOUNT, company_id: COMPANY, current_balance: accountBalance }],
  })
}

beforeEach(() => seed(1000))

describe('recordPartialPayment', () => {
  it('records a payment below the income total', async () => {
    await recordPartialPayment(INCOME, payment, USER, COMPANY, 'PKR')
    expect(supabase.rowsIn('income_payments')).toHaveLength(1)
    expect(supabase.rowsIn('income_payments')[0]).toMatchObject({ amount: 400, income_id: INCOME })
  })

  it('leaves the income partially_paid while a balance remains', async () => {
    await recordPartialPayment(INCOME, payment, USER, COMPANY, 'PKR')
    expect(supabase.rowsIn('income')[0].status).toBe('partially_paid')
  })

  it('marks the income fully_paid once the payments reach the total', async () => {
    seed(1000, [600])
    await recordPartialPayment(INCOME, payment, USER, COMPANY, 'PKR')
    expect(supabase.rowsIn('income')[0].status).toBe('fully_paid')
  })

  it('rejects a payment that would exceed the income amount', async () => {
    seed(1000, [700])
    await expect(recordPartialPayment(INCOME, payment, USER, COMPANY, 'PKR')).rejects.toThrow(
      /cannot exceed income amount/
    )
  })

  it('records nothing at all when the payment is rejected', async () => {
    seed(1000, [700])
    await expect(recordPartialPayment(INCOME, payment, USER, COMPANY, 'PKR')).rejects.toThrow()
    expect(supabase.rowsIn('income_payments')).toHaveLength(0)
    expect(supabase.rowsIn('income')[0].status).toBe('pending')
    expect(supabase.rowsIn('accounts')[0].current_balance).toBe(0)
  })

  it('accepts a payment that exactly settles the remaining balance', async () => {
    seed(1000, [600])
    await expect(recordPartialPayment(INCOME, payment, USER, COMPANY, 'PKR')).resolves.toBeUndefined()
  })

  it('credits the destination account with the converted amount', async () => {
    await recordPartialPayment(INCOME, payment, USER, COMPANY, 'PKR')
    expect(supabase.rowsIn('accounts')[0].current_balance).toBe(400)
  })

  it('credits the converted amount, not the raw amount, in a foreign currency', async () => {
    seed(1_000_000)
    await recordPartialPayment(
      INCOME,
      { ...payment, currency: 'USD', exchangeRate: 280 },
      USER,
      COMPANY,
      'PKR'
    )
    expect(supabase.rowsIn('accounts')[0].current_balance).toBeCloseTo(112_000, 4)
  })

  it('forces an exchange rate of 1 when paying in the base currency', async () => {
    await recordPartialPayment(INCOME, { ...payment, exchangeRate: 280 }, USER, COMPANY, 'PKR')
    expect(supabase.rowsIn('income_payments')[0].exchange_rate).toBe(1)
  })

  it('refuses a payment against income from another company', async () => {
    await expect(
      recordPartialPayment(INCOME, payment, USER, 'other-company', 'PKR')
    ).rejects.toThrow(/not found/)
  })

  it('audits the payment with both the old and new totals', async () => {
    seed(1000, [100])
    await recordPartialPayment(INCOME, payment, USER, COMPANY, 'PKR')
    const audit = supabase.rowsIn('audit_logs').at(-1)!
    expect(audit.entity_type).toBe('income')
    expect(audit.previous_value).toMatchObject({ total_paid: 100 })
    expect(audit.new_value).toMatchObject({ total_paid: 500, payment_amount: 400 })
  })

  it('never lets the recorded payments exceed the income amount', async () => {
    // Pay in four instalments of 300 against 1000: the fourth must be refused.
    seed(1000)
    const instalment = { ...payment, amount: 300 }
    await recordPartialPayment(INCOME, instalment, USER, COMPANY, 'PKR')
    supabase.rowsIn('income')[0].income_payments = [{ amount: 300 }]
    await recordPartialPayment(INCOME, instalment, USER, COMPANY, 'PKR')
    supabase.rowsIn('income')[0].income_payments = [{ amount: 300 }, { amount: 300 }]
    await recordPartialPayment(INCOME, instalment, USER, COMPANY, 'PKR')
    supabase.rowsIn('income')[0].income_payments = [{ amount: 300 }, { amount: 300 }, { amount: 300 }]

    await expect(recordPartialPayment(INCOME, instalment, USER, COMPANY, 'PKR')).rejects.toThrow()

    const total = supabase.rowsIn('income_payments').reduce((sum, p) => sum + (p.amount as number), 0)
    expect(total).toBeLessThanOrEqual(1000)
  })
})
