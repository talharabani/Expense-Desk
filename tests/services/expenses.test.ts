/**
 * Service-layer tests for lib/expenses/service.ts.
 *
 * These cover the rules that live above the database — validation, the
 * approval permission gate, self-approval, status transitions and the audit
 * trail — against the in-memory Supabase stand-in. RLS is not exercised here;
 * that is enforced in Postgres.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createMockSupabase, type MockSupabase } from '../helpers/supabase-mock'

let supabase: MockSupabase

vi.mock('@/lib/auth/server', () => ({
  requireSupabaseClient: async () => supabase,
}))

const { createExpense, submitExpense, processApproval } = await import('@/lib/expenses/service')

const COMPANY = 'company-1'
const SUBMITTER = 'user-submitter'
const APPROVER = 'user-approver'

const validInput = {
  title: 'Team lunch',
  category: 'meals',
  amount: 1000,
  currency: 'PKR',
  expenseDate: '2026-06-01',
  paymentMethod: 'cash',
  description: 'Client meeting',
}

function seed(rows: Parameters<typeof createMockSupabase>[0] = {}) {
  supabase = createMockSupabase({
    users: [
      { id: SUBMITTER, company_id: COMPANY, is_active: true },
      { id: APPROVER, company_id: COMPANY, is_active: true },
    ],
    ...rows,
  })
}

beforeEach(() => seed())

describe('createExpense', () => {
  it('rejects a missing required field and names the fields', async () => {
    for (const field of ['title', 'category', 'amount', 'currency', 'expenseDate', 'paymentMethod', 'description'] as const) {
      const input = { ...validInput, [field]: undefined }
      await expect(
        createExpense(input as never, SUBMITTER, COMPANY, 'PKR')
      ).rejects.toThrow(/Missing required fields/)
    }
  })

  it('rejects a non-positive amount', async () => {
    for (const amount of [0, -1, -0.01]) {
      await expect(
        createExpense({ ...validInput, amount } as never, SUBMITTER, COMPANY, 'PKR')
      ).rejects.toThrow(/Missing required fields|Amount must be positive/)
    }
  })

  it('rejects a foreign currency with no exchange rate', async () => {
    await expect(
      createExpense({ ...validInput, currency: 'USD' } as never, SUBMITTER, COMPANY, 'PKR')
    ).rejects.toThrow()
  })

  it('forces an exchange rate of 1 when the currency is the base currency', async () => {
    const expense = await createExpense(validInput as never, SUBMITTER, COMPANY, 'PKR')
    expect(expense.exchangeRate ?? (expense as unknown as { exchange_rate: number }).exchange_rate).toBe(1)
  })

  it('stores the converted amount, not the raw amount, for a foreign currency', async () => {
    const expense = (await createExpense(
      { ...validInput, currency: 'USD', exchangeRate: 280 } as never,
      SUBMITTER,
      COMPANY,
      'PKR'
    )) as unknown as { amount: number; converted_amount: number }
    expect(expense.amount).toBe(1000)
    expect(expense.converted_amount).toBeCloseTo(280_000, 4)
  })

  it('defaults to draft status', async () => {
    const expense = (await createExpense(validInput as never, SUBMITTER, COMPANY, 'PKR')) as unknown as {
      status: string
    }
    expect(expense.status).toBe('draft')
  })

  it('writes exactly one audit entry for the creation', async () => {
    await createExpense(validInput as never, SUBMITTER, COMPANY, 'PKR')
    const audits = supabase.rowsIn('audit_logs')
    expect(audits).toHaveLength(1)
    expect(audits[0]).toMatchObject({ entity_type: 'expense', action: 'created', user_id: SUBMITTER })
  })

  it('does not write an audit entry when the insert fails', async () => {
    supabase.failOn('expenses', 'insert failed')
    await expect(createExpense(validInput as never, SUBMITTER, COMPANY, 'PKR')).rejects.toThrow('insert failed')
    expect(supabase.rowsIn('audit_logs')).toHaveLength(0)
  })
})

describe('submitExpense', () => {
  it('moves a draft to submitted', async () => {
    const expense = (await createExpense(validInput as never, SUBMITTER, COMPANY, 'PKR')) as unknown as { id: string }
    await submitExpense(expense.id, SUBMITTER, COMPANY)
    expect(supabase.rowsIn('expenses')[0].status).toBe('submitted')
  })

  it('refuses to submit an expense that is not a draft', async () => {
    const expense = (await createExpense(validInput as never, SUBMITTER, COMPANY, 'PKR')) as unknown as { id: string }
    await submitExpense(expense.id, SUBMITTER, COMPANY)
    await expect(submitExpense(expense.id, SUBMITTER, COMPANY)).rejects.toThrow(/Only draft expenses/)
  })

  it('refuses to submit an expense owned by someone else', async () => {
    const expense = (await createExpense(validInput as never, SUBMITTER, COMPANY, 'PKR')) as unknown as { id: string }
    await expect(submitExpense(expense.id, APPROVER, COMPANY)).rejects.toThrow(/not found or not owned/)
  })

  it('refuses to submit an expense belonging to another company', async () => {
    const expense = (await createExpense(validInput as never, SUBMITTER, COMPANY, 'PKR')) as unknown as { id: string }
    await expect(submitExpense(expense.id, SUBMITTER, 'other-company')).rejects.toThrow(/not found/)
  })
})

describe('processApproval', () => {
  async function submittedExpense(amount = 1000) {
    const expense = (await createExpense({ ...validInput, amount } as never, SUBMITTER, COMPANY, 'PKR')) as unknown as {
      id: string
    }
    await submitExpense(expense.id, SUBMITTER, COMPANY)
    return expense.id
  }

  it('rejects an approver whose role is below the amount threshold', async () => {
    const id = await submittedExpense(10_000_000)
    await expect(
      processApproval(id, APPROVER, 'employee', COMPANY, 'approved')
    ).rejects.toThrow(/Insufficient role/)
  })

  it('blocks self-approval when the company has more than one user', async () => {
    const id = await submittedExpense()
    await expect(
      processApproval(id, SUBMITTER, 'owner', COMPANY, 'approved')
    ).rejects.toThrow(/Cannot approve your own expense/)
  })

  it('allows self-approval in a single-user company', async () => {
    seed({ users: [{ id: SUBMITTER, company_id: COMPANY, is_active: true }] })
    const id = await submittedExpense()
    await expect(processApproval(id, SUBMITTER, 'owner', COMPANY, 'approved')).resolves.toBeUndefined()
    expect(supabase.rowsIn('expenses')[0].status).toBe('approved')
  })

  it('maps each action onto the right status', async () => {
    const cases = [
      ['approved', 'approved'],
      ['rejected', 'rejected'],
      ['request_changes', 'under_review'],
      ['request_proof', 'under_review'],
    ] as const

    for (const [action, expected] of cases) {
      seed()
      const id = await submittedExpense()
      await processApproval(id, APPROVER, 'owner', COMPANY, action)
      expect(supabase.rowsIn('expenses')[0].status).toBe(expected)
    }
  })

  it('records approved_by only on approval', async () => {
    const id = await submittedExpense()
    await processApproval(id, APPROVER, 'owner', COMPANY, 'approved')
    const expense = supabase.rowsIn('expenses')[0]
    expect(expense.approved_by).toBe(APPROVER)
    expect(expense.approval_date).toBeTruthy()
  })

  it('leaves approved_by unset on rejection', async () => {
    const id = await submittedExpense()
    await processApproval(id, APPROVER, 'owner', COMPANY, 'rejected')
    const expense = supabase.rowsIn('expenses')[0]
    expect(expense.approved_by).toBeNull()
    expect(expense.approval_date).toBeNull()
  })

  it('keeps the status put when the expense is forwarded', async () => {
    const id = await submittedExpense()
    await processApproval(id, APPROVER, 'owner', COMPANY, 'forwarded', undefined, SUBMITTER)
    expect(supabase.rowsIn('expenses')[0].status).toBe('submitted')
  })

  it('refuses to forward to an unknown user', async () => {
    const id = await submittedExpense()
    await expect(
      processApproval(id, APPROVER, 'owner', COMPANY, 'forwarded', undefined, 'ghost-user')
    ).rejects.toThrow(/unknown user/)
  })

  it('notifies the submitter of the decision', async () => {
    const id = await submittedExpense()
    await processApproval(id, APPROVER, 'owner', COMPANY, 'approved')
    const notifications = supabase.rowsIn('notifications')
    expect(notifications.some((n) => n.user_id === SUBMITTER && n.type === 'expense_approved')).toBe(true)
  })

  it('writes an approval record carrying both the old and new status', async () => {
    const id = await submittedExpense()
    await processApproval(id, APPROVER, 'owner', COMPANY, 'approved', 'looks fine')
    const approvals = supabase.rowsIn('approvals')
    expect(approvals).toHaveLength(1)
    expect(approvals[0]).toMatchObject({
      previous_status: 'submitted',
      new_status: 'approved',
      comment: 'looks fine',
      approver_id: APPROVER,
    })
  })

  it('refuses to act on an expense from another company', async () => {
    const id = await submittedExpense()
    await expect(
      processApproval(id, APPROVER, 'owner', 'other-company', 'approved')
    ).rejects.toThrow(/not found/)
  })
})
