/**
 * Tests for lib/auth/redirect.ts.
 *
 * `next` arrives on a URL the user clicks from their inbox, so it is
 * attacker-controllable. A forged confirmation link must not be able to bounce
 * a freshly authenticated user off-site.
 */

import { describe, it, expect } from 'vitest'
import fc from 'fast-check'
import { safeNextPath, needsConfirmRedirect } from '@/lib/auth/redirect'

describe('safeNextPath', () => {
  it('keeps a normal in-app path', () => {
    expect(safeNextPath('/setup')).toBe('/setup')
    expect(safeNextPath('/dashboard')).toBe('/dashboard')
    expect(safeNextPath('/expenses/123?tab=documents')).toBe('/expenses/123?tab=documents')
  })

  it('falls back when nothing was supplied', () => {
    expect(safeNextPath(null)).toBe('/setup')
    expect(safeNextPath(undefined)).toBe('/setup')
    expect(safeNextPath('')).toBe('/setup')
  })

  it('honours a caller-supplied fallback', () => {
    expect(safeNextPath(null, '/dashboard')).toBe('/dashboard')
  })

  it('refuses an absolute URL', () => {
    for (const value of [
      'https://evil.example',
      'http://evil.example/path',
      'HTTPS://EVIL.EXAMPLE',
      'javascript:alert(1)',
      'data:text/html,<script>',
    ]) {
      expect(safeNextPath(value)).toBe('/setup')
    }
  })

  it('refuses a protocol-relative URL', () => {
    for (const value of ['//evil.example', '//evil.example/path', '///evil.example']) {
      expect(safeNextPath(value)).toBe('/setup')
    }
  })

  it('refuses backslash variants, which browsers treat as slashes', () => {
    for (const value of ['\\\\evil.example', '/\\evil.example', '\\/evil.example']) {
      expect(safeNextPath(value)).toBe('/setup')
    }
  })

  it('refuses a scheme smuggled behind leading slashes', () => {
    expect(safeNextPath('/https://evil.example')).toBe('/setup')
    expect(safeNextPath('//https://evil.example')).toBe('/setup')
  })

  it('never returns something a browser would treat as off-site', () => {
    fc.assert(
      fc.property(fc.string(), (raw) => {
        const result = safeNextPath(raw)
        // Resolved against any origin, the result must stay on that origin.
        const resolved = new URL(result, 'https://app.example')
        expect(resolved.origin).toBe('https://app.example')
      }),
      { numRuns: 500 }
    )
  })
})

describe('needsConfirmRedirect', () => {
  const params = (query: string) => new URLSearchParams(query)

  it('claims a token landing on the site root, which would otherwise be discarded', () => {
    expect(needsConfirmRedirect('/', params('code=abc'))).toBe(true)
    expect(needsConfirmRedirect('/', params('token_hash=abc&type=email'))).toBe(true)
  })

  it('claims an error landing on the site root, so the reason is shown', () => {
    expect(needsConfirmRedirect('/', params('error=access_denied'))).toBe(true)
    expect(needsConfirmRedirect('/', params('error_description=expired'))).toBe(true)
  })

  it('leaves a plain visit to the root alone', () => {
    expect(needsConfirmRedirect('/', params(''))).toBe(false)
    expect(needsConfirmRedirect('/', params('utm_source=email'))).toBe(false)
  })

  it('leaves other routes alone, in case they use a code parameter of their own', () => {
    expect(needsConfirmRedirect('/dashboard', params('code=abc'))).toBe(false)
    expect(needsConfirmRedirect('/expenses', params('code=abc'))).toBe(false)
    expect(needsConfirmRedirect('/auth/confirm', params('code=abc'))).toBe(false)
  })
})
