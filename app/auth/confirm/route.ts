import { type NextRequest, NextResponse } from 'next/server'
import type { EmailOtpType } from '@supabase/supabase-js'
import { createSupabaseServerClient } from '@/lib/auth/server'
import { describeAuthError } from '@/lib/auth/errors'
import { safeNextPath } from '@/lib/auth/redirect'

/**
 * Lands the confirmation link from a signup email and turns it into a session.
 *
 * Supabase can hand the link back in two shapes, and which one arrives depends
 * on the email template, so both are accepted:
 *
 *  - `token_hash` + `type` — produced by a template using `{{ .TokenHash }}`.
 *    This is the shape to prefer: it is verified server-side, so the session
 *    cookie is set before the browser renders anything.
 *  - `code` — the PKCE code from the default `{{ .ConfirmationURL }}` template.
 *
 * A link that carries neither (the implicit flow, which puts the token in the
 * URL fragment) cannot be read on the server at all — the fragment never leaves
 * the browser. That case is reported rather than silently doing nothing.
 *
 * Every failure path ends on /login carrying a message, so a dead link never
 * leaves someone on a blank page wondering whether it worked.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl

  const next = safeNextPath(searchParams.get('next'))
  const tokenHash = searchParams.get('token_hash')
  const type = searchParams.get('type') as EmailOtpType | null
  const code = searchParams.get('code')

  const failed = (message: string) =>
    NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(message)}`, origin))

  // Supabase reports its own refusals (expired link, already used) on the URL.
  const supabaseError = searchParams.get('error_description') ?? searchParams.get('error')
  if (supabaseError) return failed(supabaseError)

  const supabase = await createSupabaseServerClient()
  if (!supabase) return failed('Supabase is not configured on this deployment.')

  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash })
    if (error) return failed(describeAuthError(error).message)
    return NextResponse.redirect(new URL(next, origin))
  }

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (error) return failed(describeAuthError(error).message)
    return NextResponse.redirect(new URL(next, origin))
  }

  return failed(
    'That confirmation link carried no token. Request a new one from the sign-in page.'
  )
}
