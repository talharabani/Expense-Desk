/**
 * Vendor payment totals (Property 16: vendor total_paid invariant).
 *
 * `vendors.total_paid` is written as 0 on creation and never incremented, so it
 * is derived here from the expenses themselves rather than trusted from the
 * column. The invariant: a vendor's total paid equals the sum of
 * `converted_amount` over that vendor's expenses with status 'paid'.
 *
 * Amounts are summed in the company base currency (`converted_amount`), never
 * the raw `amount`, so mixed-currency expenses stay comparable.
 */

export interface VendorPayableExpense {
  vendor_id?: string | null
  status?: string | null
  converted_amount?: number | null
  deleted_at?: string | null
}

/** Only settled, live expenses count toward a vendor's paid total. */
function countsTowardTotal(expense: VendorPayableExpense, vendorId: string): boolean {
  return (
    expense.vendor_id === vendorId &&
    expense.status === 'paid' &&
    !expense.deleted_at &&
    typeof expense.converted_amount === 'number' &&
    Number.isFinite(expense.converted_amount)
  )
}

/** Sum of converted_amount over this vendor's paid expenses. Zero when none. */
export function calculateVendorTotalPaid(
  expenses: VendorPayableExpense[],
  vendorId: string
): number {
  return expenses.reduce(
    (total, expense) =>
      countsTowardTotal(expense, vendorId) ? total + (expense.converted_amount as number) : total,
    0
  )
}

/** Paid totals for every vendor id present in `expenses`, keyed by vendor id. */
export function calculateVendorTotals(
  expenses: VendorPayableExpense[]
): Record<string, number> {
  const totals: Record<string, number> = {}
  for (const expense of expenses) {
    const vendorId = expense.vendor_id
    if (!vendorId || !countsTowardTotal(expense, vendorId)) continue
    totals[vendorId] = (totals[vendorId] ?? 0) + (expense.converted_amount as number)
  }
  return totals
}
