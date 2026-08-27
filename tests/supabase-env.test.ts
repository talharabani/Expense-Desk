import { describe, expect, it } from 'vitest'
import { cleanEnvValue, isHeaderSafe } from '@/lib/supabase/env'

describe('cleanEnvValue', () => {
  it('strips the trailing CR left by CRLF .env files', () => {
    expect(cleanEnvValue('https://abc.supabase.co\r')).toBe('https://abc.supabase.co')
  })

  it('strips wrapping quotes', () => {
    expect(cleanEnvValue('"eyJhbGciOi"')).toBe('eyJhbGciOi')
    expect(cleanEnvValue("'eyJhbGciOi'")).toBe('eyJhbGciOi')
  })

  it('leaves a clean value untouched', () => {
    expect(cleanEnvValue('eyJhbGciOi')).toBe('eyJhbGciOi')
  })

  it('returns empty string for undefined', () => {
    expect(cleanEnvValue(undefined)).toBe('')
  })
})

describe('isHeaderSafe', () => {
  it('accepts ordinary JWT characters', () => {
    expect(isHeaderSafe('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.abc-_123')).toBe(true)
  })

  it('rejects the characters copy-paste commonly injects', () => {
    expect(isHeaderSafe('eyJ\u2026')).toBe(false) // ellipsis
    expect(isHeaderSafe('\u201CeyJ\u201D')).toBe(false) // smart quotes
    expect(isHeaderSafe('eyJ\u200Babc')).toBe(false) // zero-width space
    expect(isHeaderSafe('eyJ\u2014abc')).toBe(false) // em dash
  })

  it('accepts Latin-1 characters, which are legal in headers', () => {
    expect(isHeaderSafe('caf\u00e9')).toBe(true)
  })
})
