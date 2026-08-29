/**
 * Where to send someone after a confirmation link is verified.
 *
 * The target arrives as a `next` query parameter on a URL the user clicked from
 * their inbox, so it is attacker-controllable: a confirmation link forged with
 * `next=https://evil.example` would bounce a freshly authenticated user
 * straight off-site. Only same-site absolute paths are allowed through.
 */

const DEFAULT_NEXT = '/setup'

/** Query parameters that mean "this request is an auth callback". */
const AUTH_CALLBACK_PARAMS = ['code', 'token_hash', 'error', 'error_description'] as const

export const CONFIRM_PATH = '/auth/confirm'

/**
 * True when a request landing on `pathname` is carrying an auth token that the
 * page there would discard.
 *
 * Supabase's default email template sends people to the project's Site URL —
 * the site root — with the token on the query string. The root route redirects
 * straight to /dashboard, so the token is lost and the link appears to do
 * nothing. Only the root is treated this way: other routes are left alone, in
 * case they use a `code` parameter of their own.
 */
export function needsConfirmRedirect(pathname: string, params: URLSearchParams): boolean {
  if (pathname !== '/') return false
  return AUTH_CALLBACK_PARAMS.some((name) => params.has(name))
}

export function safeNextPath(raw: string | null | undefined, fallback = DEFAULT_NEXT): string {
  if (!raw) return fallback

  // Normalize backslashes: browsers treat \\evil.example like //evil.example.
  const value = raw.trim().replace(/\\/g, '/')

  // Must be a rooted path, and must not be protocol-relative ("//host").
  if (!value.startsWith('/') || value.startsWith('//')) return fallback

  // Reject anything carrying a scheme, which "/\/evil" style tricks can smuggle.
  if (/^\/+[a-z][a-z0-9+.-]*:/i.test(value)) return fallback

  return value
}
