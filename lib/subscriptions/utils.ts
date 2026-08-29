/**
 * Renewal-alert window logic (Property 14: subscription renewal alert lead time).
 *
 * A subscription is "renewing soon" only when its renewal date falls inside
 * [today, today + leadDays]. Both bounds matter: an upper bound alone flags
 * every subscription that renewed in the past as due, which is the whole
 * back catalogue.
 */

export const DEFAULT_RENEWAL_LEAD_DAYS = 7

/** Calendar day as UTC midnight, so comparisons ignore time-of-day and DST. */
function toUtcDay(value: string | Date): number | null {
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
}

const MS_PER_DAY = 86_400_000

/**
 * Whole days from `today` to `date`. Negative when the date is in the past.
 * Returns null for an unparseable or missing date.
 */
export function daysUntil(date: string | Date | null | undefined, today: string | Date): number | null {
  if (!date) return null
  const target = toUtcDay(date)
  const start = toUtcDay(today)
  if (target === null || start === null) return null
  return Math.round((target - start) / MS_PER_DAY)
}

/**
 * True when `date` is today or up to `leadDays` in the future.
 * A date already past is not due for an alert — it needs a renewal, not a warning.
 */
export function isWithinLeadTime(
  date: string | Date | null | undefined,
  today: string | Date,
  leadDays: number = DEFAULT_RENEWAL_LEAD_DAYS
): boolean {
  const days = daysUntil(date, today)
  if (days === null) return false
  return days >= 0 && days <= leadDays
}

export interface RenewableSubscription {
  renewal_date?: string | null
  trial_expiry_date?: string | null
  status?: string | null
}

/**
 * Flags a subscription for the renewal and trial-expiry alert windows.
 * Cancelled subscriptions never alert — they are not going to renew.
 */
export function flagRenewalWindow<T extends RenewableSubscription>(
  subscription: T,
  today: string | Date,
  leadDays: number = DEFAULT_RENEWAL_LEAD_DAYS
): T & { renewing_soon: boolean; trial_expiring_soon: boolean; days_until_renewal: number | null } {
  const alertable = subscription.status !== 'cancelled'
  return {
    ...subscription,
    renewing_soon: alertable && isWithinLeadTime(subscription.renewal_date, today, leadDays),
    trial_expiring_soon:
      alertable && isWithinLeadTime(subscription.trial_expiry_date, today, leadDays),
    days_until_renewal: daysUntil(subscription.renewal_date, today),
  }
}

/** The subscriptions that should have a renewal notification as of `today`. */
export function getSubscriptionsDueForAlert<T extends RenewableSubscription>(
  subscriptions: T[],
  today: string | Date,
  leadDays: number = DEFAULT_RENEWAL_LEAD_DAYS
): T[] {
  return subscriptions.filter(
    (s) => s.status !== 'cancelled' && isWithinLeadTime(s.renewal_date, today, leadDays)
  )
}
