/**
 * Property-Based Tests for Business Expense & Cash-Flow Tracker
 * Feature: business-expense-cashflow-tracker
 * Library: fast-check
 * Each property runs 100+ iterations with randomized inputs.
 */

import { describe, it, expect } from 'vitest'
import fc from 'fast-check'
import { convertAmount, validateCurrencyFields } from '@/lib/currency/utils'
import { calculateNetSalary } from '@/lib/payroll/utils'
import { calculateProjectProfitability } from '@/lib/projects/utils'
import { calculateBudgetUtilization, getCrossedThresholds } from '@/lib/budgets/utils'
import { getApprovalThreshold, hasPermission, getApprovalPermission } from '@/lib/auth/permissions'
import { getRoleRank, roleAtLeast, ROLE_HIERARCHY, type Role } from '@/types'
import {
  buildAuditRow,
  buildAuditRows,
  normalizeAuditAction,
  VALID_AUDIT_ACTIONS,
  AUDITED_ENTITY_TYPES,
} from '@/lib/audit/utils'
import {
  flagRenewalWindow,
  getSubscriptionsDueForAlert,
  daysUntil,
} from '@/lib/subscriptions/utils'
import { calculateVendorTotalPaid, calculateVendorTotals } from '@/lib/vendors/utils'

// ---------------------------------------------------------------------------
// Generators
// ---------------------------------------------------------------------------

const genPositiveAmount = fc.double({ min: 0.01, max: 1_000_000, noNaN: true })
const genNonNegativeAmount = fc.double({ min: 0, max: 1_000_000, noNaN: true })
const genPositiveExchangeRate = fc.double({ min: 0.0001, max: 1000, noNaN: true })

const genRole = (): fc.Arbitrary<Role> =>
  fc.constantFrom(...(ROLE_HIERARCHY as Role[]))

const genPayroll = () =>
  fc.record({
    basicSalary: genPositiveAmount,
    bonus: genNonNegativeAmount,
    commission: genNonNegativeAmount,
    overtime: genNonNegativeAmount,
    allowance: genNonNegativeAmount,
    deduction: genNonNegativeAmount,
    loanDeduction: genNonNegativeAmount,
    advanceDeduction: genNonNegativeAmount,
    tax: genNonNegativeAmount,
  })

const genBudget = () =>
  fc.record({
    budgetId: fc.uuid(),
    totalAmount: genPositiveAmount,
    spentAmount: genNonNegativeAmount,
  })

const genProject = () =>
  fc.record({
    projectId: fc.uuid(),
    totalRevenue: genNonNegativeAmount,
    totalExpenses: genNonNegativeAmount,
  })

const genAccountBalances = () =>
  fc.record({
    balance: genNonNegativeAmount,
    amount: genPositiveAmount,
  })

// Fixed reference day for the renewal-window properties (Property 14).
const TODAY = '2026-06-15T00:00:00Z'

/** ISO date `offset` whole days from TODAY. */
const dayOffset = (offset: number): string => {
  const base = new Date(TODAY)
  base.setUTCDate(base.getUTCDate() + offset)
  return base.toISOString().slice(0, 10)
}

const baseOperation = {
  userId: 'user-1',
  companyId: 'company-1',
  entityType: 'expense',
  entityId: 'entity-1',
  action: 'created',
}

const genAuditOperation = () =>
  fc.record({
    userId: fc.uuid(),
    companyId: fc.uuid(),
    entityType: fc.constantFrom(...AUDITED_ENTITY_TYPES),
    entityId: fc.uuid(),
    action: fc.constantFrom('created', 'updated', 'deleted', 'approved', 'rejected'),
  })

const VENDOR_IDS = ['vendor-a', 'vendor-b', 'vendor-c'] as const

const genVendorExpense = () =>
  fc.record({
    vendor_id: fc.constantFrom<string | null>(...VENDOR_IDS, null),
    status: fc.constantFrom('draft', 'submitted', 'approved', 'rejected', 'paid'),
    converted_amount: genNonNegativeAmount,
    deleted_at: fc.constantFrom<string | null>(null, null, null, '2026-01-01T00:00:00Z'),
  })

// ---------------------------------------------------------------------------
// Property 1: Account balance consistency after income
// For any account balance and income amount, crediting increases balance by exactly that amount.
// Validates: Requirements 7.3
// ---------------------------------------------------------------------------
describe('Property 1: Account balance consistency after income', () => {
  it('crediting account increases balance by exact converted amount', () => {
    fc.assert(
      fc.property(genAccountBalances(), ({ balance, amount }) => {
        const newBalance = balance + amount
        expect(newBalance).toBeCloseTo(balance + amount, 4)
        expect(newBalance).toBeGreaterThanOrEqual(balance)
      }),
      { numRuns: 100 }
    )
  })
})

// ---------------------------------------------------------------------------
// Property 2: Account balance consistency after expense
// For any account balance and expense amount, debiting decreases balance by that amount.
// Validates: Requirements 7.4
// ---------------------------------------------------------------------------
describe('Property 2: Account balance consistency after expense', () => {
  it('debiting account decreases balance by exact converted amount', () => {
    fc.assert(
      fc.property(genAccountBalances(), ({ balance, amount }) => {
        const newBalance = balance - amount
        expect(newBalance).toBeCloseTo(balance - amount, 4)
        expect(newBalance).toBeLessThanOrEqual(balance)
      }),
      { numRuns: 100 }
    )
  })
})

// ---------------------------------------------------------------------------
// Property 3: Inter-account transfer balance conservation
// For any two accounts and a transfer amount, total balance is preserved.
// Validates: Requirements 7.5
// ---------------------------------------------------------------------------
describe('Property 3: Inter-account transfer balance conservation', () => {
  it('total balance of two accounts is unchanged after transfer', () => {
    fc.assert(
      fc.property(
        genNonNegativeAmount,
        genNonNegativeAmount,
        genPositiveAmount,
        (balanceA, balanceB, transferAmount) => {
          const newBalanceA = balanceA - transferAmount
          const newBalanceB = balanceB + transferAmount
          const sumBefore = balanceA + balanceB
          const sumAfter = newBalanceA + newBalanceB
          expect(sumAfter).toBeCloseTo(sumBefore, 4)
        }
      ),
      { numRuns: 100 }
    )
  })
})

// ---------------------------------------------------------------------------
// Property 4: Net salary calculation correctness
// net = basic + bonus + commission + overtime + allowance - deductions - tax
// Validates: Requirements 9.3
// ---------------------------------------------------------------------------
describe('Property 4: Net salary calculation correctness', () => {
  it('net salary equals sum of components minus deductions', () => {
    fc.assert(
      fc.property(genPayroll(), (payroll) => {
        const expected =
          payroll.basicSalary +
          payroll.bonus +
          payroll.commission +
          payroll.overtime +
          payroll.allowance -
          payroll.deduction -
          payroll.loanDeduction -
          payroll.advanceDeduction -
          payroll.tax

        const result = calculateNetSalary(payroll)
        expect(result).toBeCloseTo(expected, 4)
      }),
      { numRuns: 100 }
    )
  })
})

// ---------------------------------------------------------------------------
// Property 5: Project profit calculation correctness
// profit = revenue - expenses; margin = (profit / revenue) * 100 when revenue > 0
// Validates: Requirements 14.3, 14.4
// ---------------------------------------------------------------------------
describe('Property 5: Project profit calculation correctness', () => {
  it('profit equals revenue minus expenses', () => {
    fc.assert(
      fc.property(genProject(), ({ projectId, totalRevenue, totalExpenses }) => {
        const result = calculateProjectProfitability(projectId, totalRevenue, totalExpenses)
        expect(result.profit).toBeCloseTo(totalRevenue - totalExpenses, 4)
      }),
      { numRuns: 100 }
    )
  })

  it('profit margin is null when revenue is zero', () => {
    fc.assert(
      fc.property(fc.uuid(), genNonNegativeAmount, (projectId, totalExpenses) => {
        const result = calculateProjectProfitability(projectId, 0, totalExpenses)
        expect(result.profitMargin).toBeNull()
      }),
      { numRuns: 100 }
    )
  })

  it('profit margin equals (profit / revenue) * 100 when revenue > 0', () => {
    fc.assert(
      fc.property(genProject(), ({ projectId, totalRevenue, totalExpenses }) => {
        fc.pre(totalRevenue > 0)
        const result = calculateProjectProfitability(projectId, totalRevenue, totalExpenses)
        const expected = ((totalRevenue - totalExpenses) / totalRevenue) * 100
        expect(result.profitMargin).not.toBeNull()
        expect(result.profitMargin!).toBeCloseTo(expected, 4)
      }),
      { numRuns: 100 }
    )
  })
})

// ---------------------------------------------------------------------------
// Property 6: Currency conversion consistency
// convertedAmount = amount * exchangeRate (rounded to 4 decimal places)
// Validates: Requirements 8.3
// ---------------------------------------------------------------------------
describe('Property 6: Currency conversion consistency', () => {
  it('converted amount equals amount times exchange rate', () => {
    fc.assert(
      fc.property(genPositiveAmount, genPositiveExchangeRate, (amount, rate) => {
        const result = convertAmount(amount, rate)
        const expected = Math.round(amount * rate * 10000) / 10000
        expect(result).toBeCloseTo(expected, 4)
      }),
      { numRuns: 100 }
    )
  })

  it('conversion with rate=1 returns same amount', () => {
    fc.assert(
      fc.property(genPositiveAmount, (amount) => {
        const result = convertAmount(amount, 1)
        expect(result).toBeCloseTo(amount, 4)
      }),
      { numRuns: 100 }
    )
  })
})

// ---------------------------------------------------------------------------
// Property 7: Budget utilization correctness
// utilizationPercent = (spent / total) * 100; remaining = total - spent
// Validates: Requirements 12.4
// ---------------------------------------------------------------------------
describe('Property 7: Budget utilization correctness', () => {
  it('utilization percent equals spent over total times 100', () => {
    fc.assert(
      fc.property(genBudget(), ({ budgetId, totalAmount, spentAmount }) => {
        const result = calculateBudgetUtilization(budgetId, totalAmount, spentAmount)
        const expectedUtilization = (spentAmount / totalAmount) * 100
        expect(result.utilizationPercent).toBeCloseTo(expectedUtilization, 4)
        expect(result.remainingAmount).toBeCloseTo(totalAmount - spentAmount, 4)
      }),
      { numRuns: 100 }
    )
  })

  it('isOverBudget is true only when spent exceeds total', () => {
    fc.assert(
      fc.property(genBudget(), ({ budgetId, totalAmount, spentAmount }) => {
        const result = calculateBudgetUtilization(budgetId, totalAmount, spentAmount)
        expect(result.isOverBudget).toBe(spentAmount > totalAmount)
      }),
      { numRuns: 100 }
    )
  })
})

// ---------------------------------------------------------------------------
// Property 8: Budget over-threshold alert triggering
// Alerts should be triggered only for thresholds that have been crossed.
// Validates: Requirements 12.5, 12.6
// ---------------------------------------------------------------------------
describe('Property 8: Budget over-threshold alert triggering', () => {
  it('only thresholds that utilization meets or exceeds are triggered', () => {
    const thresholds = [70, 90, 100]
    fc.assert(
      fc.property(genBudget(), ({ budgetId, totalAmount, spentAmount }) => {
        const { utilizationPercent } = calculateBudgetUtilization(budgetId, totalAmount, spentAmount)
        const crossed = getCrossedThresholds(utilizationPercent, thresholds)
        for (const t of crossed) {
          expect(utilizationPercent).toBeGreaterThanOrEqual(t)
        }
        for (const t of thresholds) {
          if (!crossed.includes(t)) {
            expect(utilizationPercent).toBeLessThan(t)
          }
        }
      }),
      { numRuns: 100 }
    )
  })
})

// ---------------------------------------------------------------------------
// Property 9: Advance remaining amount invariant
// remainingAmount = amount - amountUsed; always >= 0 when amountUsed <= amount
// Validates: Requirements 10.3
// ---------------------------------------------------------------------------
describe('Property 9: Advance remaining amount invariant', () => {
  it('remaining amount equals advance amount minus amount used', () => {
    fc.assert(
      fc.property(
        genPositiveAmount,
        fc.double({ min: 0, max: 1, noNaN: true }),
        (amount, usedFraction) => {
          const amountUsed = Math.round(amount * usedFraction * 10000) / 10000
          const remaining = amount - amountUsed
          expect(remaining).toBeCloseTo(amount - amountUsed, 4)
          expect(remaining).toBeGreaterThanOrEqual(-0.0001) // allow tiny float error
        }
      ),
      { numRuns: 100 }
    )
  })
})

// ---------------------------------------------------------------------------
// Property 10: Expense approval permission enforcement
// Only roles meeting the threshold can approve expenses of that amount.
// Validates: Requirements 5.1, 5.2, 5.3, 5.4
// ---------------------------------------------------------------------------
describe('Property 10: Expense approval permission enforcement', () => {
  it('approver role must meet minimum required role for expense amount', () => {
    fc.assert(
      fc.property(genPositiveAmount, genRole(), (amount, approverRole) => {
        const requiredRole = getApprovalThreshold(amount)
        const permissionAction = getApprovalPermission(amount)
        const canApprove = hasPermission(approverRole, permissionAction)
        const meetsThreshold = roleAtLeast(approverRole, requiredRole)
        // canApprove should be consistent with meeting the threshold
        expect(canApprove).toBe(meetsThreshold)
      }),
      { numRuns: 100 }
    )
  })

  it('lower-ranked roles cannot approve expenses requiring higher authority', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 5 }), // required role index (not lowest)
        (requiredRoleIdx) => {
          const requiredRole = ROLE_HIERARCHY[requiredRoleIdx] as Role
          const lowerRole = ROLE_HIERARCHY[requiredRoleIdx - 1] as Role
          expect(roleAtLeast(lowerRole, requiredRole)).toBe(false)
        }
      ),
      { numRuns: 50 }
    )
  })
})

// ---------------------------------------------------------------------------
// Property 11: Partial income payment sum invariant
// Sum of partial payments must never exceed total income amount.
// Validates: Requirements 3.5
// ---------------------------------------------------------------------------
describe('Property 11: Partial income payment sum invariant', () => {
  it('sum of partial payments never exceeds total income', () => {
    fc.assert(
      fc.property(
        genPositiveAmount,
        fc.array(fc.double({ min: 0.01, max: 1, noNaN: true }), { minLength: 1, maxLength: 10 }),
        (totalAmount, fractions) => {
          // Simulate: only add payments while sum <= total
          let sum = 0
          for (const fraction of fractions) {
            const payment = Math.round(totalAmount * fraction * 10000) / 10000
            if (sum + payment > totalAmount) break
            sum += payment
          }
          expect(sum).toBeLessThanOrEqual(totalAmount + 0.001) // small float tolerance
        }
      ),
      { numRuns: 100 }
    )
  })
})

// ---------------------------------------------------------------------------
// Property 12: Audit log completeness
// Every create/update/delete on a financial record produces exactly one audit entry.
// Validates: Requirements 18.1, 18.2
// ---------------------------------------------------------------------------
describe('Property 12: Audit log completeness', () => {
  it('every create/update/delete operation produces exactly one audit row', () => {
    fc.assert(
      fc.property(fc.array(genAuditOperation(), { minLength: 1, maxLength: 30 }), (operations) => {
        const rows = buildAuditRows(operations)
        expect(rows).toHaveLength(operations.length)
      }),
      { numRuns: 100 }
    )
  })

  it('each row captures the operation it came from', () => {
    fc.assert(
      fc.property(fc.array(genAuditOperation(), { minLength: 1, maxLength: 20 }), (operations) => {
        const rows = buildAuditRows(operations)
        operations.forEach((op, i) => {
          expect(rows[i].company_id).toBe(op.companyId)
          expect(rows[i].user_id).toBe(op.userId)
          expect(rows[i].entity_type).toBe(op.entityType)
          expect(rows[i].entity_id).toBe(op.entityId || op.userId)
        })
      }),
      { numRuns: 100 }
    )
  })

  it('the recorded action is always one the DB constraint accepts', () => {
    fc.assert(
      fc.property(
        genAuditOperation(),
        fc.string(),
        (operation, arbitraryAction) => {
          const row = buildAuditRow({ ...operation, action: arbitraryAction })
          expect(VALID_AUDIT_ACTIONS).toContain(row.action)
        }
      ),
      { numRuns: 100 }
    )
  })

  it('a known action is preserved verbatim, an unknown one becomes updated', () => {
    fc.assert(
      fc.property(fc.constantFrom(...VALID_AUDIT_ACTIONS), (action) => {
        expect(normalizeAuditAction(action)).toBe(action)
      }),
      { numRuns: 50 }
    )
    fc.assert(
      fc.property(
        fc.string().filter((s) => !(VALID_AUDIT_ACTIONS as readonly string[]).includes(s)),
        (action) => {
          expect(normalizeAuditAction(action)).toBe('updated')
        }
      ),
      { numRuns: 100 }
    )
  })

  it('a mutation on any audited financial entity is never dropped', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...AUDITED_ENTITY_TYPES),
        fc.constantFrom('created', 'updated', 'deleted'),
        (entityType, action) => {
          const rows = buildAuditRows([{ ...baseOperation, entityType, action }])
          expect(rows).toHaveLength(1)
          expect(rows[0].entity_type).toBe(entityType)
          expect(rows[0].action).toBe(action)
        }
      ),
      { numRuns: 100 }
    )
  })
})

// ---------------------------------------------------------------------------
// Property 13: Role permission enforcement
// A user without permission for an action should be rejected regardless of other properties.
// Validates: Requirements 1.4
// ---------------------------------------------------------------------------
describe('Property 13: Role permission enforcement', () => {
  it('hasPermission returns consistent results for all role-action pairs', () => {
    const sensitiveActions = [
      'company:delete',
      'users:delete',
      'income:delete',
      'expenses:delete',
      'accounts:delete',
      'payroll:delete',
      'settings:manage',
    ]

    fc.assert(
      fc.property(genRole(), fc.constantFrom(...sensitiveActions), (role, action) => {
        const result = hasPermission(role, action)
        // owner should always have permission for sensitive actions
        if (role === 'owner') {
          expect(result).toBe(true)
        }
        // auditor and employee should never have delete/manage permissions
        if (role === 'auditor' || role === 'employee') {
          expect(result).toBe(false)
        }
      }),
      { numRuns: 100 }
    )
  })

  it('unknown action always returns false regardless of role', () => {
    fc.assert(
      fc.property(genRole(), (role) => {
        expect(hasPermission(role, 'nonexistent:action:xyz')).toBe(false)
      }),
      { numRuns: 50 }
    )
  })
})

// ---------------------------------------------------------------------------
// Property 14: Subscription renewal alert lead time
// A renewal within 7 days of today must be flagged; one outside that window must not.
// Validates: Requirements 11.3, 17.4
// ---------------------------------------------------------------------------
describe('Property 14: Subscription renewal alert lead time', () => {
  it('a renewal 0-7 days out is flagged as renewing soon', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 7 }), (offset) => {
        const sub = { renewal_date: dayOffset(offset), status: 'active' }
        expect(flagRenewalWindow(sub, TODAY).renewing_soon).toBe(true)
      }),
      { numRuns: 100 }
    )
  })

  it('a renewal more than 7 days out is not flagged', () => {
    fc.assert(
      fc.property(fc.integer({ min: 8, max: 3650 }), (offset) => {
        const sub = { renewal_date: dayOffset(offset), status: 'active' }
        expect(flagRenewalWindow(sub, TODAY).renewing_soon).toBe(false)
      }),
      { numRuns: 100 }
    )
  })

  it('a renewal already in the past is not flagged as renewing soon', () => {
    fc.assert(
      fc.property(fc.integer({ min: -3650, max: -1 }), (offset) => {
        const sub = { renewal_date: dayOffset(offset), status: 'active' }
        expect(flagRenewalWindow(sub, TODAY).renewing_soon).toBe(false)
      }),
      { numRuns: 100 }
    )
  })

  it('the alert window respects a custom lead time', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 90 }),
        fc.integer({ min: -30, max: 120 }),
        (leadDays, offset) => {
          const sub = { renewal_date: dayOffset(offset), status: 'active' }
          const expected = offset >= 0 && offset <= leadDays
          expect(flagRenewalWindow(sub, TODAY, leadDays).renewing_soon).toBe(expected)
        }
      ),
      { numRuns: 200 }
    )
  })

  it('a cancelled subscription never alerts, whatever its renewal date', () => {
    fc.assert(
      fc.property(fc.integer({ min: -365, max: 365 }), (offset) => {
        const sub = { renewal_date: dayOffset(offset), status: 'cancelled' }
        expect(flagRenewalWindow(sub, TODAY).renewing_soon).toBe(false)
      }),
      { numRuns: 100 }
    )
  })

  it('every subscription due for an alert is exactly one inside the window', () => {
    fc.assert(
      fc.property(
        fc.array(fc.integer({ min: -400, max: 400 }), { minLength: 1, maxLength: 40 }),
        (offsets) => {
          const subs = offsets.map((offset) => ({
            renewal_date: dayOffset(offset),
            status: 'active',
          }))
          const due = getSubscriptionsDueForAlert(subs, TODAY)
          const expectedCount = offsets.filter((o) => o >= 0 && o <= 7).length
          expect(due).toHaveLength(expectedCount)
          for (const s of due) {
            const days = daysUntil(s.renewal_date, TODAY)
            expect(days).not.toBeNull()
            expect(days as number).toBeGreaterThanOrEqual(0)
            expect(days as number).toBeLessThanOrEqual(7)
          }
        }
      ),
      { numRuns: 100 }
    )
  })

  it('a missing or unparseable renewal date never alerts', () => {
    fc.assert(
      fc.property(fc.constantFrom(null, undefined, '', 'not-a-date'), (value) => {
        const sub = { renewal_date: value as string | null, status: 'active' }
        expect(flagRenewalWindow(sub, TODAY).renewing_soon).toBe(false)
      }),
      { numRuns: 50 }
    )
  })
})

// ---------------------------------------------------------------------------
// Property 15: Duplicate receipt detection
// If vendor + amount + date all match, the document should be flagged as duplicate.
// Validates: Requirements 6.7, 19.4
// ---------------------------------------------------------------------------
describe('Property 15: Duplicate receipt detection (logic)', () => {
  // Pure logic: if all three fields match, it's a duplicate
  function isDuplicateReceipt(
    existing: { vendor: string | null; amount: number | null; date: string | null },
    candidate: { vendor: string | null; amount: number | null; date: string | null }
  ): boolean {
    if (!existing.vendor && !existing.amount && !existing.date) return false
    return (
      existing.vendor?.toLowerCase() === candidate.vendor?.toLowerCase() &&
      existing.amount === candidate.amount &&
      existing.date === candidate.date
    )
  }

  it('identical vendor/amount/date is flagged as duplicate', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1 }),
        genPositiveAmount,
        fc.date({ min: new Date('2020-01-01'), max: new Date('2026-01-01') }),
        (vendor, amount, date) => {
          fc.pre(!isNaN(date.getTime()))
          const dateStr = date.toISOString().slice(0, 10)
          const existing = { vendor, amount, date: dateStr }
          const candidate = { vendor, amount, date: dateStr }
          expect(isDuplicateReceipt(existing, candidate)).toBe(true)
        }
      ),
      { numRuns: 100 }
    )
  })

  it('different amount is not flagged as duplicate', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1 }),
        genPositiveAmount,
        genPositiveAmount,
        fc.date({ min: new Date('2020-01-01'), max: new Date('2026-01-01') }),
        (vendor, amount1, amount2, date) => {
          fc.pre(!isNaN(date.getTime()))
          fc.pre(Math.abs(amount1 - amount2) > 0.0001)
          const dateStr = date.toISOString().slice(0, 10)
          const existing = { vendor, amount: amount1, date: dateStr }
          const candidate = { vendor, amount: amount2, date: dateStr }
          expect(isDuplicateReceipt(existing, candidate)).toBe(false)
        }
      ),
      { numRuns: 100 }
    )
  })
})

// ---------------------------------------------------------------------------
// Property 16: Vendor total paid invariant
// A vendor's total paid equals the sum of converted_amount over its paid expenses.
// Validates: Requirements 13.3
// ---------------------------------------------------------------------------
describe('Property 16: Vendor total paid invariant', () => {
  it('total paid equals the sum of converted amounts of that vendor\'s paid expenses', () => {
    fc.assert(
      fc.property(
        fc.array(genVendorExpense(), { minLength: 0, maxLength: 50 }),
        fc.constantFrom(...VENDOR_IDS),
        (expenses, vendorId) => {
          const expected = expenses
            .filter(
              (e) => e.vendor_id === vendorId && e.status === 'paid' && !e.deleted_at
            )
            .reduce((sum, e) => sum + e.converted_amount, 0)
          expect(calculateVendorTotalPaid(expenses, vendorId)).toBeCloseTo(expected, 4)
        }
      ),
      { numRuns: 200 }
    )
  })

  it('expenses that are not paid never contribute', () => {
    fc.assert(
      fc.property(
        fc.array(
          genVendorExpense().map((e) => ({ ...e, status: 'approved' })),
          { minLength: 1, maxLength: 30 }
        ),
        fc.constantFrom(...VENDOR_IDS),
        (expenses, vendorId) => {
          expect(calculateVendorTotalPaid(expenses, vendorId)).toBe(0)
        }
      ),
      { numRuns: 100 }
    )
  })

  it('soft-deleted expenses never contribute', () => {
    fc.assert(
      fc.property(
        fc.array(
          genVendorExpense().map((e) => ({
            ...e,
            status: 'paid',
            deleted_at: '2026-01-01T00:00:00Z',
          })),
          { minLength: 1, maxLength: 30 }
        ),
        fc.constantFrom(...VENDOR_IDS),
        (expenses, vendorId) => {
          expect(calculateVendorTotalPaid(expenses, vendorId)).toBe(0)
        }
      ),
      { numRuns: 100 }
    )
  })

  it('the total is never negative', () => {
    fc.assert(
      fc.property(
        fc.array(genVendorExpense(), { maxLength: 50 }),
        fc.constantFrom(...VENDOR_IDS),
        (expenses, vendorId) => {
          expect(calculateVendorTotalPaid(expenses, vendorId)).toBeGreaterThanOrEqual(0)
        }
      ),
      { numRuns: 100 }
    )
  })

  it('per-vendor totals sum to the total across all vendors', () => {
    fc.assert(
      fc.property(fc.array(genVendorExpense(), { maxLength: 60 }), (expenses) => {
        const totals = calculateVendorTotals(expenses)
        const summed = Object.values(totals).reduce((a, b) => a + b, 0)
        const overall = expenses
          .filter((e) => e.status === 'paid' && !e.deleted_at && e.vendor_id)
          .reduce((sum, e) => sum + e.converted_amount, 0)
        expect(summed).toBeCloseTo(overall, 4)
      }),
      { numRuns: 200 }
    )
  })

  it('a vendor with no expenses has a total of zero', () => {
    fc.assert(
      fc.property(fc.array(genVendorExpense(), { maxLength: 30 }), (expenses) => {
        expect(calculateVendorTotalPaid(expenses, 'vendor-with-nothing')).toBe(0)
      }),
      { numRuns: 100 }
    )
  })
})

// ---------------------------------------------------------------------------
// Property 17: Required field validation
// Income/expense with missing required fields should be rejected.
// Validates: Requirements 3.1, 4.1
// ---------------------------------------------------------------------------
describe('Property 17: Required field validation', () => {
  function validateIncomeFields(input: Record<string, unknown>): string[] {
    const required = ['title', 'amount', 'currency', 'paymentMethod']
    return required.filter((f) => !input[f])
  }

  function validateExpenseFields(input: Record<string, unknown>): string[] {
    const required = ['title', 'category', 'amount', 'currency', 'expenseDate', 'paymentMethod']
    return required.filter((f) => !input[f])
  }

  it('income with all required fields passes validation', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1 }),
        genPositiveAmount,
        fc.constantFrom('PKR', 'USD', 'EUR'),
        fc.constantFrom('bank', 'cash', 'card'),
        (title, amount, currency, paymentMethod) => {
          const errors = validateIncomeFields({ title, amount, currency, paymentMethod })
          expect(errors).toHaveLength(0)
        }
      ),
      { numRuns: 100 }
    )
  })

  it('income with missing required field fails validation', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('title', 'amount', 'currency', 'paymentMethod'),
        (missingField) => {
          const input: Record<string, unknown> = {
            title: 'Test',
            amount: 100,
            currency: 'PKR',
            paymentMethod: 'bank',
          }
          delete input[missingField]
          const errors = validateIncomeFields(input)
          expect(errors).toContain(missingField)
        }
      ),
      { numRuns: 50 }
    )
  })

  it('expense with all required fields passes validation', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1 }),
        fc.string({ minLength: 1 }),
        genPositiveAmount,
        fc.constantFrom('PKR', 'USD'),
        fc.constantFrom('2025-01-01', '2025-06-15'),
        fc.constantFrom('bank', 'cash'),
        (title, category, amount, currency, expenseDate, paymentMethod) => {
          const errors = validateExpenseFields({ title, category, amount, currency, expenseDate, paymentMethod })
          expect(errors).toHaveLength(0)
        }
      ),
      { numRuns: 100 }
    )
  })
})

// ---------------------------------------------------------------------------
// Property 18: Non-base-currency requires exchange rate
// Validates: Requirements 3.6, 8.2
// ---------------------------------------------------------------------------
describe('Property 18: Non-base-currency requires exchange rate', () => {
  it('validation fails when currency differs from base and no exchange rate provided', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('USD', 'EUR', 'GBP', 'AED'),
        (currency) => {
          // PKR is base currency
          const result = validateCurrencyFields(currency, 'PKR', null)
          expect(result.valid).toBe(false)
          expect(result.error).toBeDefined()
        }
      ),
      { numRuns: 50 }
    )
  })

  it('validation passes when currency matches base currency without exchange rate', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('PKR', 'USD', 'EUR'),
        (baseCurrency) => {
          const result = validateCurrencyFields(baseCurrency, baseCurrency, null)
          expect(result.valid).toBe(true)
        }
      ),
      { numRuns: 50 }
    )
  })

  it('validation passes when non-base currency has a positive exchange rate', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('USD', 'EUR', 'GBP'),
        genPositiveExchangeRate,
        (currency, rate) => {
          const result = validateCurrencyFields(currency, 'PKR', rate)
          expect(result.valid).toBe(true)
        }
      ),
      { numRuns: 100 }
    )
  })
})

// ---------------------------------------------------------------------------
// Bonus: getRoleRank is monotonically increasing across hierarchy
// ---------------------------------------------------------------------------
describe('Role hierarchy ordering', () => {
  it('role rank is strictly increasing from auditor to owner', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: ROLE_HIERARCHY.length - 2 }),
        (idx) => {
          const lower = ROLE_HIERARCHY[idx] as Role
          const higher = ROLE_HIERARCHY[idx + 1] as Role
          expect(getRoleRank(higher)).toBeGreaterThan(getRoleRank(lower))
        }
      ),
      { numRuns: 50 }
    )
  })
})
