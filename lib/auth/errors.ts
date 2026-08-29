/**
 * Supabase auth errors, translated into something a user can act on.
 *
 * Two of these are actively misleading as raw text:
 *
 *  - "Invalid login credentials" is returned both for a wrong password and for
 *    an account that exists with a *different* password than the one just typed
 *    during a repeat registration. The raw message sends people to the reset
 *    flow when they may simply be typing a new password for an old account.
 *  - A repeat sign-up does not error at all. Supabase deliberately returns a
 *    success with a user carrying an empty `identities` array, so that an
 *    attacker cannot enumerate which emails are registered. Treating that as
 *    success is what produces "check your email" for an email that will never
 *    receive one.
 */

export type AuthErrorAction = 'resend_confirmation' | 'sign_in' | 'reset_password' | null

export interface FriendlyAuthError {
  message: string
  action: AuthErrorAction
}

interface RawAuthError {
  code?: string
  message?: string
  status?: number
}

export function describeAuthError(error: RawAuthError): FriendlyAuthError {
  const code = error.code ?? ''
  const raw = error.message ?? 'Authentication failed'

  if (code === 'email_not_confirmed') {
    return {
      message: 'This email has not been confirmed yet. Check your inbox, or send the link again.',
      action: 'resend_confirmation',
    }
  }

  if (code === 'invalid_credentials') {
    return {
      message:
        'Email or password is incorrect. If you signed up with this email before, the original password still applies — registering again does not change it.',
      action: 'reset_password',
    }
  }

  // A PKCE exchange needs the code_verifier cookie that the browser stored when
  // the sign-up started. Opening the link in a different browser or device — the
  // normal case when someone registers on a laptop and reads mail on a phone —
  // means the cookie is absent. Supabase has already confirmed the address by
  // this point; only the automatic sign-in is lost, so say that rather than
  // showing the SDK's note to developers about @supabase/ssr.
  if (
    code === 'flow_state_not_found' ||
    code === 'flow_state_expired' ||
    code === 'bad_code_verifier' ||
    /code verifier/i.test(raw)
  ) {
    return {
      message:
        'Your email is confirmed. Sign in below — we could not sign you in automatically because the link was opened in a different browser from the one you registered in.',
      action: 'sign_in',
    }
  }

  if (code === 'otp_expired' || code === 'validation_failed') {
    return {
      message:
        'That confirmation link has expired or has already been used. Send yourself a new one.',
      action: 'resend_confirmation',
    }
  }

  if (code === 'over_email_send_rate_limit' || code === 'over_request_rate_limit') {
    return {
      message: 'Too many attempts. Wait a minute and try again.',
      action: null,
    }
  }

  if (code === 'user_already_exists' || code === 'email_exists') {
    return {
      message: 'An account with this email already exists. Sign in instead.',
      action: 'sign_in',
    }
  }

  if (code === 'weak_password') {
    return { message: 'That password is too weak. Use at least 8 characters.', action: null }
  }

  if (code === 'signup_disabled') {
    return { message: 'Registration is currently disabled for this project.', action: null }
  }

  return { message: raw, action: null }
}

/**
 * True when a sign-up response is Supabase's obfuscated "this email is already
 * registered" reply: a user object with no identities and no session.
 *
 * Without this check the caller shows a "check your email" screen for an
 * address that will never receive a message, and the person then cannot sign in
 * because the account kept its original password.
 */
export function isExistingAccountSignUp(
  data: { user?: { identities?: unknown[] | null } | null; session?: unknown } | null
): boolean {
  if (!data?.user || data.session) return false
  const identities = data.user.identities
  return Array.isArray(identities) && identities.length === 0
}
