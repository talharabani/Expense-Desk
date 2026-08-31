/**
 * Email validation for the registration form.
 *
 * `<input type="email">` accepts things a mail server will not: `a@b` has no
 * dot, and a trailing space or a capitalised domain quietly creates an account
 * the person cannot sign back into, because they will type it differently next
 * time. Normalising and checking here means the address stored is the address
 * they can log in with.
 *
 * This is deliberately not RFC 5322. That grammar permits quoted local parts
 * and bracketed IP literals which no user of this app will ever type, and
 * matching it exactly would reject nothing extra that matters.
 */

/** Trim and lower-case, so Talha@Gmail.com and talha@gmail.com are one account. */
export function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase()
}

const SHAPE = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i

export interface EmailCheck {
  valid: boolean
  /** Why it was rejected, phrased for the person typing it. */
  error?: string
}

export function validateEmail(raw: string): EmailCheck {
  const email = normalizeEmail(raw)

  if (!email) return { valid: false, error: 'Enter your email address.' }

  if (!email.includes('@')) {
    return { valid: false, error: 'That email is missing an @ — for example, name@gmail.com' }
  }

  const [, domain = ''] = email.split('@')

  if (email.split('@').length > 2) {
    return { valid: false, error: 'That email has more than one @ in it.' }
  }

  if (!domain.includes('.')) {
    return {
      valid: false,
      error: 'That email is missing the part after the dot — for example, name@gmail.com',
    }
  }

  if (domain.endsWith('.')) {
    return { valid: false, error: 'That email ends with a dot.' }
  }

  if (!SHAPE.test(email)) {
    return { valid: false, error: 'That does not look like a valid email address.' }
  }

  return { valid: true }
}
