/**
 * Tests for lib/auth/email.ts.
 *
 * The normalisation half matters as much as the validation half: an account
 * created as `Talha@Gmail.com ` cannot be signed into by typing
 * `talha@gmail.com`, which reads to the user as their data having vanished.
 */

import { describe, it, expect } from 'vitest'
import fc from 'fast-check'
import { validateEmail, normalizeEmail } from '@/lib/auth/email'

describe('normalizeEmail', () => {
  it('lower-cases so one address is one account', () => {
    expect(normalizeEmail('Talha@Gmail.com')).toBe('talha@gmail.com')
    expect(normalizeEmail('TALHA@GMAIL.COM')).toBe('talha@gmail.com')
  })

  it('strips surrounding whitespace picked up by copy-paste', () => {
    expect(normalizeEmail('  talha@gmail.com  ')).toBe('talha@gmail.com')
    expect(normalizeEmail('\ttalha@gmail.com\n')).toBe('talha@gmail.com')
  })

  it('is idempotent, so registering and signing in agree', () => {
    fc.assert(
      fc.property(fc.string(), (raw) => {
        expect(normalizeEmail(normalizeEmail(raw))).toBe(normalizeEmail(raw))
      }),
      { numRuns: 200 }
    )
  })
})

describe('validateEmail', () => {
  it('accepts ordinary addresses', () => {
    for (const email of [
      'talha@gmail.com',
      'talha.ishaq@gmail.com',
      'talha+work@gmail.com',
      'bitf22m030@pucit.edu.pk',
      'name@sub.domain.co.uk',
      'a@b.io',
    ]) {
      expect(validateEmail(email).valid).toBe(true)
    }
  })

  it('accepts an address that only needs trimming or lower-casing', () => {
    expect(validateEmail('  Talha@Gmail.COM ').valid).toBe(true)
  })

  it('rejects an empty address', () => {
    expect(validateEmail('').valid).toBe(false)
    expect(validateEmail('   ').error).toMatch(/enter your email/i)
  })

  it('rejects an address with no @', () => {
    const result = validateEmail('talhagmail.com')
    expect(result.valid).toBe(false)
    expect(result.error).toMatch(/missing an @/i)
  })

  it('rejects more than one @', () => {
    const result = validateEmail('talha@gmail@com')
    expect(result.valid).toBe(false)
    expect(result.error).toMatch(/more than one @/i)
  })

  it('rejects a domain with no dot — the case type=email lets through', () => {
    const result = validateEmail('talha@gmail')
    expect(result.valid).toBe(false)
    expect(result.error).toMatch(/after the dot/i)
  })

  it('rejects a trailing dot', () => {
    expect(validateEmail('talha@gmail.').valid).toBe(false)
  })

  it('rejects a one-letter TLD and a numeric one', () => {
    expect(validateEmail('talha@gmail.c').valid).toBe(false)
    expect(validateEmail('talha@gmail.123').valid).toBe(false)
  })

  it('rejects internal whitespace', () => {
    expect(validateEmail('tal ha@gmail.com').valid).toBe(false)
    expect(validateEmail('talha@gm ail.com').valid).toBe(false)
  })

  it('rejects a missing local part or missing domain', () => {
    expect(validateEmail('@gmail.com').valid).toBe(false)
    expect(validateEmail('talha@').valid).toBe(false)
  })

  it('always explains itself when it rejects', () => {
    fc.assert(
      fc.property(fc.string(), (raw) => {
        const result = validateEmail(raw)
        if (!result.valid) {
          expect(typeof result.error).toBe('string')
          expect(result.error!.length).toBeGreaterThan(0)
        }
      }),
      { numRuns: 300 }
    )
  })

  it('accepts nothing that normalisation would alter into a different address', () => {
    fc.assert(
      fc.property(fc.string(), (raw) => {
        if (validateEmail(raw).valid) {
          const normalized = normalizeEmail(raw)
          expect(validateEmail(normalized).valid).toBe(true)
        }
      }),
      { numRuns: 300 }
    )
  })
})
