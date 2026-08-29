/**
 * Where to send someone after a confirmation link is verified.
 *
 * The target arrives as a `next` query parameter on a URL the user clicked from
 * their inbox, so it is attacker-controllable: a confirmation link forged with
 * `next=https://evil.example` would bounce a freshly authenticated user
 * straight off-site. Only same-site absolute paths are allowed through.
 */

const DEFAULT_NEXT = '/setup'

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
