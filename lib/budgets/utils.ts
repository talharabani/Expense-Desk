import type { BudgetUtilization } from '@/types'

/**
 * Calculates budget utilization from budget totals.
 */
export function calculateBudgetUtilization(
  budgetId: string,
  totalAmount: number,
  spentAmount: number
): BudgetUtilization {
  const remainingAmount = totalAmount - spentAmount
  const utilizationPercent = totalAmount > 0 ? (spentAmount / totalAmount) * 100 : 0
  const isOverBudget = spentAmount > totalAmount
  return { budgetId, totalAmount, spentAmount, remainingAmount, utilizationPercent, isOverBudget }
}

/**
 * Returns which alert thresholds have been crossed.
 * thresholds: sorted list of percentages (e.g., [70, 90, 100])
 */
export function getCrossedThresholds(
  utilizationPercent: number,
  thresholds: number[]
): number[] {
  return thresholds.filter((t) => utilizationPercent >= t)
}
