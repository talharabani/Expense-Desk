/**
 * Pure utility functions for payroll calculations.
 * These are separate from the API layer so they can be unit/property tested.
 */

export interface PayrollComponents {
  basicSalary: number
  bonus?: number
  commission?: number
  overtime?: number
  allowance?: number
  deduction?: number
  loanDeduction?: number
  advanceDeduction?: number
  tax?: number
}

/**
 * Calculates net salary from payroll components.
 * net = basic + bonus + commission + overtime + allowance
 *       - deduction - loanDeduction - advanceDeduction - tax
 */
export function calculateNetSalary(p: PayrollComponents): number {
  const gross =
    p.basicSalary +
    (p.bonus ?? 0) +
    (p.commission ?? 0) +
    (p.overtime ?? 0) +
    (p.allowance ?? 0)

  const deductions =
    (p.deduction ?? 0) +
    (p.loanDeduction ?? 0) +
    (p.advanceDeduction ?? 0) +
    (p.tax ?? 0)

  return Math.round((gross - deductions) * 10000) / 10000
}
