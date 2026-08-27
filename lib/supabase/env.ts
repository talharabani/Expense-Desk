/**
 * Supabase credentials arrive from env vars that are frequently pasted by hand
 * (Vercel dashboard, .env files with CRLF endings). Two failure modes are common
 * and both produce errors far from their cause:
 *
 *  - Stray whitespace/CR or wrapping quotes -> malformed URL or auth header.
 *  - A character above U+00FF (smart quote, ellipsis, zero-width space) picked up
 *    by copy-paste -> `fetch` throws "String contains non ISO-8859-1 code point"
 *    when it converts the header value to a ByteString, with no hint as to which
 *    header or why.
 *
 * Sanitize on read so the common paste damage is simply repaired, and report the
 * value as unusable when it still contains something that cannot go in a header.
 */

/** Trim whitespace (including CR from CRLF files) and strip wrapping quotes. */
export function cleanEnvValue(raw: string | undefined): string {
  if (!raw) return ''
  let value = raw.trim()
  if (value.length >= 2) {
    const first = value[0]
    const last = value[value.length - 1]
    if ((first === '"' && last === '"') || (first === "'" && last === "'")) {
      value = value.slice(1, -1).trim()
    }
  }
  return value
}

/** True when every code point fits in a Latin-1 byte, i.e. it is legal in an HTTP header. */
export function isHeaderSafe(value: string): boolean {
  for (const char of value) {
    if (char.codePointAt(0)! > 0xff) return false
  }
  return true
}

export function readSupabaseEnv() {
  const url = cleanEnvValue(process.env.NEXT_PUBLIC_SUPABASE_URL)
  const key = cleanEnvValue(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)

  const urlLooksValid = url.startsWith('https://') && url.includes('.supabase.co')
  const keyLooksValid = key.length > 100

  const isConfigured =
    urlLooksValid && keyLooksValid && isHeaderSafe(url) && isHeaderSafe(key)

  if (!isConfigured) {
    // Falling back to the placeholder client produces a confusing
    // ERR_NAME_NOT_RESOLVED against placeholder.supabase.co, so say exactly
    // which check failed. Never logs the values themselves.
    const problems: string[] = []

    if (!url) {
      problems.push('NEXT_PUBLIC_SUPABASE_URL is empty or missing at build time')
    } else if (!urlLooksValid) {
      problems.push(
        `NEXT_PUBLIC_SUPABASE_URL is set (${url.length} chars) but is not an https://<project>.supabase.co URL`
      )
    } else if (!isHeaderSafe(url)) {
      problems.push('NEXT_PUBLIC_SUPABASE_URL contains a character that is not valid in an HTTP header')
    }

    if (!key) {
      problems.push('NEXT_PUBLIC_SUPABASE_ANON_KEY is empty or missing at build time')
    } else if (!keyLooksValid) {
      problems.push(
        `NEXT_PUBLIC_SUPABASE_ANON_KEY is only ${key.length} chars; a legacy anon JWT is ~200. It looks truncated`
      )
    } else if (!isHeaderSafe(key)) {
      problems.push(
        'NEXT_PUBLIC_SUPABASE_ANON_KEY contains a non-Latin-1 character (a smart quote, ellipsis, or zero-width space from copy-paste)'
      )
    }

    console.error('Supabase is NOT configured, so requests go to placeholder.supabase.co and fail:')
    problems.forEach((problem) => console.error('  - ' + problem))
    console.error(
      'NEXT_PUBLIC_* values are baked in at build time: set them in Vercel for the Production ' +
        'environment, then redeploy with "Use existing Build Cache" unticked.'
    )
  }

  return { url, key, isConfigured }
}

/** Header name -> plain-English cause, for the diagnostic below. */
const HEADER_HINTS: Record<string, string> = {
  authorization:
    "This is your stored login session. Clear this site's data in DevTools (Application -> Storage -> Clear site data) and sign in again.",
  apikey:
    'This is NEXT_PUBLIC_SUPABASE_ANON_KEY. Re-copy it from the Supabase dashboard and redeploy without the build cache.',
}

/** Normalize the three shapes `HeadersInit` can take into name/value pairs. */
function toHeaderPairs(headers: HeadersInit): Array<[string, string]> {
  if (Array.isArray(headers)) return headers.map(([name, value]) => [name, String(value)])
  if (headers instanceof Headers) return Array.from(headers.entries())
  return Object.entries(headers).map(([name, value]) => [name, String(value)])
}

/** Index and code point of the first character that cannot be encoded as Latin-1. */
function firstNonLatin1(text: string): { index: number; code: number } | null {
  for (let i = 0; i < text.length; i++) {
    const code = text.codePointAt(i)!
    if (code > 0xff) return { index: i, code }
  }
  return null
}

/**
 * Wraps `fetch` so a header value that cannot be encoded as Latin-1 is reported
 * by name instead of surfacing as the opaque browser error:
 *
 *   Failed to read the 'headers' property from 'RequestInit':
 *   String contains non ISO-8859-1 code point.
 *
 * The offending header is dropped rather than sent, so the request fails as a
 * clean 401 the app already handles instead of throwing inside a click handler.
 * Header values are never logged - only the header name, the character's
 * position, and its code point, which is enough to identify the cause.
 */
export function createSafeFetch(): typeof fetch {
  return (input, init) => {
    if (!init?.headers) return fetch(input, init)

    const safe: Array<[string, string]> = []
    for (const [name, value] of toHeaderPairs(init.headers)) {
      const bad = firstNonLatin1(value)
      if (!bad) {
        safe.push([name, value])
        continue
      }

      const codePoint = bad.code.toString(16).toUpperCase().padStart(4, '0')
      const hint = HEADER_HINTS[name.toLowerCase()] ?? 'Check whatever value feeds this header.'
      console.error(
        `Supabase request dropped the "${name}" header: it contains U+${codePoint} at ` +
          `position ${bad.index} of ${value.length}, which is not valid in an HTTP header. ${hint}`
      )
    }

    return fetch(input, { ...init, headers: safe })
  }
}
