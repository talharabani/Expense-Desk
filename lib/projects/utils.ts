import type { ProjectProfitability } from '@/types'

/**
 * Calculates project profitability from revenue and expense totals.
 * profitMargin is null when totalRevenue is 0 (undefined margin).
 */
export function calculateProjectProfitability(
  projectId: string,
  totalRevenue: number,
  totalExpenses: number
): ProjectProfitability {
  const profit = totalRevenue - totalExpenses
  const profitMargin = totalRevenue > 0 ? (profit / totalRevenue) * 100 : null
  return { projectId, totalRevenue, totalExpenses, profit, profitMargin }
}
