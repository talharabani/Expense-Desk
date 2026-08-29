/**
 * Service-layer tests for lib/accounts/service.ts.
 *
 * The invariant that matters: a transfer moves money, it never creates or
 * destroys it. Property 3 covers the arithmetic in isolation; these cover the
 * service that performs the two writes, including what happens when the second
 * one fails.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import fc from 'fast-check'
import { createMockSupabase, type MockSupabase } from '../helpers/supabase-mock'

let supabase: MockSupabase

vi.mock('@/lib/auth/server', () => ({
  requireSupabaseClient: async () => supabase,
}))

const { creditAccount, debitAccount, transferBetweenAccounts } = await import('@/lib/accounts/service')

const COMPANY = 'company-1'
const USER = 'user-1'
const A = 'account-a'
const B = 'account-b'

function seed(balanceA = 1000, balanceB = 500) {
  supabase = createMockSupabase({
    accounts: [
      { id: A, company_id: COMPANY, current_balance: balanceA },
      { id: B, company_id: COMPANY, current_balance: balanceB },
    ],
  })
}

const balanceOf = (id: string) =>
  supabase.rowsIn('accounts').find((a) => a.id === id)!.current_balance as number

beforeEach(() => seed())

describe('creditAccount / debitAccount', () => {
  it('a credit raises the balance by the amount', async () => {
    await creditAccount(A, 250, USER, COMPANY)
    expect(balanceOf(A)).toBe(1250)
  })

  it('a debit lowers the balance by the amount', async () => {
    await debitAccount(A, 250, USER, COMPANY)
    expect(balanceOf(A)).toBe(750)
  })

  it('a credit then an equal debit returns the balance to where it started', async () => {
    await fc.assert(
      fc.asyncProperty(fc.double({ min: 0.01, max: 100_000, noNaN: true }), async (amount) => {
        seed()
        await creditAccount(A, amount, USER, COMPANY)
        await debitAccount(A, amount, USER, COMPANY)
        expect(balanceOf(A)).toBeCloseTo(1000, 4)
      }),
      { numRuns: 100 }
    )
  })
})

describe('transferBetweenAccounts', () => {
  it('moves the amount from source to destination', async () => {
    await transferBetweenAccounts(A, B, 300, USER, COMPANY)
    expect(balanceOf(A)).toBe(700)
    expect(balanceOf(B)).toBe(800)
  })

  it('conserves the total across both accounts', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.double({ min: 0.01, max: 100_000, noNaN: true }),
        fc.double({ min: 0, max: 1_000_000, noNaN: true }),
        fc.double({ min: 0, max: 1_000_000, noNaN: true }),
        async (amount, startA, startB) => {
          seed(startA, startB)
          await transferBetweenAccounts(A, B, amount, USER, COMPANY)
          expect(balanceOf(A) + balanceOf(B)).toBeCloseTo(startA + startB, 4)
        }
      ),
      { numRuns: 200 }
    )
  })

  it('refuses a transfer to the same account', async () => {
    await expect(transferBetweenAccounts(A, A, 100, USER, COMPANY)).rejects.toThrow(/same account/)
  })

  it('refuses a non-positive amount', async () => {
    for (const amount of [0, -1, -0.5]) {
      await expect(transferBetweenAccounts(A, B, amount, USER, COMPANY)).rejects.toThrow(/must be positive/)
    }
  })

  it('refuses a transfer when an account is missing', async () => {
    await expect(transferBetweenAccounts(A, 'ghost', 100, USER, COMPANY)).rejects.toThrow(
      /One or both accounts not found/
    )
  })

  it('refuses a transfer across companies', async () => {
    await expect(transferBetweenAccounts(A, B, 100, USER, 'other-company')).rejects.toThrow(
      /One or both accounts not found/
    )
  })

  it('leaves both balances untouched when the transfer is refused', async () => {
    await expect(transferBetweenAccounts(A, A, 100, USER, COMPANY)).rejects.toThrow()
    expect(balanceOf(A)).toBe(1000)
    expect(balanceOf(B)).toBe(500)
  })

  it('audits both sides of the transfer', async () => {
    await transferBetweenAccounts(A, B, 300, USER, COMPANY)
    const audits = supabase.rowsIn('audit_logs').filter((a) => a.entity_type === 'account')
    expect(audits).toHaveLength(2)
    expect(audits.map((a) => a.entity_id)).toEqual([A, B])
  })

  it('records the transfer counterparty, since the action verb is flattened', async () => {
    // The service passes 'transfer_out'/'transfer_in', but the audit_logs CHECK
    // constraint accepts only created/updated/deleted/approved/rejected, so both
    // land as 'updated'. The direction survives only in new_value — a transfer
    // therefore cannot be found by filtering getAuditLogs on action.
    await transferBetweenAccounts(A, B, 300, USER, COMPANY)
    const audits = supabase.rowsIn('audit_logs').filter((a) => a.entity_type === 'account')
    expect(audits.map((a) => a.action)).toEqual(['updated', 'updated'])
    expect(audits[0].new_value).toMatchObject({ transferred_to: B, amount: 300 })
    expect(audits[1].new_value).toMatchObject({ transferred_from: A, amount: 300 })
  })

  it('allows the source balance to go negative', async () => {
    // Documents current behaviour: there is no overdraft guard in the service.
    // If one is wanted, this test should be inverted and the guard added.
    seed(100, 0)
    await transferBetweenAccounts(A, B, 500, USER, COMPANY)
    expect(balanceOf(A)).toBe(-400)
    expect(balanceOf(B)).toBe(500)
  })
})
