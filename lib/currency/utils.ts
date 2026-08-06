/**
 * Converts an amount from one currency to another using the provided exchange rate.
 * exchangeRate is defined as: 1 unit of fromCurrency = exchangeRate units of toCurrency
 */
export function convertAmount(
  amount: number,
  exchangeRate: number
): number {
  if (exchangeRate <= 0) {
    throw new Error('Exchange rate must be positive')
  }
  // Round to 4 decimal places to avoid floating-point drift
  return Math.round(amount * exchangeRate * 10000) / 10000
}

/**
 * Validates that a transaction includes an exchange rate when using a non-base currency.
 */
export function validateCurrencyFields(
  currency: string,
  baseCurrency: string,
  exchangeRate: number | null | undefined
): { valid: boolean; error?: string } {
  if (currency !== baseCurrency) {
    if (!exchangeRate || exchangeRate <= 0) {
      return {
        valid: false,
        error: `Exchange rate is required when currency (${currency}) differs from base currency (${baseCurrency})`,
      }
    }
  }
  return { valid: true }
}

/**
 * Formats a monetary amount with currency symbol for display.
 */
export function formatCurrency(
  amount: number,
  currency: string,
  locale = 'en-PK'
): string {
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount)
  } catch {
    // Fallback for unsupported locales
    return `${currency} ${amount.toFixed(2)}`
  }
}

export const SUPPORTED_CURRENCIES = [
  { code: 'PKR', name: 'Pakistani Rupee', symbol: '₨' },
  { code: 'USD', name: 'US Dollar', symbol: '$' },
  { code: 'EUR', name: 'Euro', symbol: '€' },
  { code: 'GBP', name: 'British Pound', symbol: '£' },
  { code: 'AED', name: 'UAE Dirham', symbol: 'د.إ' },
  { code: 'CAD', name: 'Canadian Dollar', symbol: 'C$' },
  { code: 'AUD', name: 'Australian Dollar', symbol: 'A$' },
  { code: 'SAR', name: 'Saudi Riyal', symbol: '﷼' },
]
