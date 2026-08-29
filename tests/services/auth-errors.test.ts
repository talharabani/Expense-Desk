/**
 * Tests for lib/auth/errors.ts.
 *
 * The case that matters most is `isExistingAccountSignUp`: Supabase answers a
 * repeat sign-up with a *success* — no error at all — carrying a user with an
 * empty identities array. Reading that as a new account is what produced a
 * "check your email" screen for an address that never received a message.
 */

import { describe, it, expect } from 'vitest'
import { describeAuthError, isExistingAccountSignUp } from '@/lib/auth/errors'

describe('describeAuthError', () => {
  it('offers a resend when the email is unconfirmed', () => {
    const result = describeAuthError({ code: 'email_not_confirmed', message: 'Email not confirmed' })
    expect(result.action).toBe('resend_confirmation')
    expect(result.message).toMatch(/not been confirmed/i)
  })

  it('explains that a repeat registration does not change the password', () => {
    const result = describeAuthError({ code: 'invalid_credentials', message: 'Invalid login credentials' })
    expect(result.message).toMatch(/original password still applies/i)
    expect(result.action).toBe('reset_password')
  })

  it('never leaves the raw "Invalid login credentials" text in place', () => {
    const result = describeAuthError({ code: 'invalid_credentials', message: 'Invalid login credentials' })
    expect(result.message).not.toBe('Invalid login credentials')
  })

  it('points an existing account at sign-in', () => {
    for (const code of ['user_already_exists', 'email_exists']) {
      expect(describeAuthError({ code }).action).toBe('sign_in')
    }
  })

  it('asks the user to wait when rate limited', () => {
    for (const code of ['over_email_send_rate_limit', 'over_request_rate_limit']) {
      expect(describeAuthError({ code }).message).toMatch(/too many attempts/i)
    }
  })

  it('passes an unrecognized error through rather than inventing one', () => {
    const result = describeAuthError({ code: 'something_new', message: 'Database is on fire' })
    expect(result.message).toBe('Database is on fire')
    expect(result.action).toBeNull()
  })

  it('still produces a message when the error carries neither code nor text', () => {
    expect(describeAuthError({}).message).toBe('Authentication failed')
  })
})

describe('isExistingAccountSignUp', () => {
  it('detects the obfuscated repeat sign-up', () => {
    expect(isExistingAccountSignUp({ user: { identities: [] }, session: null })).toBe(true)
  })

  it('treats a genuinely new unconfirmed user as new', () => {
    expect(
      isExistingAccountSignUp({ user: { identities: [{ provider: 'email' }] }, session: null })
    ).toBe(false)
  })

  it('is false when a session came back, since that account is usable now', () => {
    expect(isExistingAccountSignUp({ user: { identities: [] }, session: { access_token: 'x' } })).toBe(false)
  })

  it('is false for a missing user or missing identities', () => {
    expect(isExistingAccountSignUp({ user: null, session: null })).toBe(false)
    expect(isExistingAccountSignUp({ user: {}, session: null })).toBe(false)
    expect(isExistingAccountSignUp({ user: { identities: null }, session: null })).toBe(false)
    expect(isExistingAccountSignUp(null)).toBe(false)
  })
})
