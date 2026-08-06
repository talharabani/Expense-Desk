/**
 * Fetches the current exchange rate between two currencies.
 * Falls back gracefully so users can enter the rate manually.
 */
export async function fetchExchangeRate(
  fromCurrency: string,
  toCurrency: string
): Promise<{ rate: number | null; error: string | null }> {
  if (fromCurrency === toCurrency) {
    return { rate: 1, error: null }
  }

  const apiKey = process.env.EXCHANGE_RATE_API_KEY
  if (!apiKey) {
    return { rate: null, error: 'Exchange rate API not configured' }
  }

  try {
    const response = await fetch(
      `https://v6.exchangerate-api.com/v6/${apiKey}/pair/${fromCurrency}/${toCurrency}`,
      { next: { revalidate: 3600 } } // Cache for 1 hour
    )

    if (!response.ok) {
      return { rate: null, error: 'Failed to fetch exchange rate' }
    }

    const data = await response.json()

    if (data.result === 'success') {
      return { rate: data.conversion_rate, error: null }
    }

    return { rate: null, error: data['error-type'] ?? 'Unknown error' }
  } catch {
    return { rate: null, error: 'Network error fetching exchange rate' }
  }
}
