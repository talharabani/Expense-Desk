'use client'

import { Suspense, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { describeAuthError } from '@/lib/auth/errors'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, AlertTriangle } from 'lucide-react'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
const isConfigured =
  SUPABASE_URL.length > 0 &&
  SUPABASE_URL !== 'your-supabase-url' &&
  !SUPABASE_URL.includes('placeholder')

function LoginForm() {
  const router = useRouter()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [totpCode, setTotpCode] = useState('')
  const [requiresTOTP, setRequiresTOTP] = useState(false)
  const [factorId, setFactorId] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [canResend, setCanResend] = useState(false)
  const [resent, setResent] = useState(false)

  // The confirmation route reports a dead or already-used link by redirecting
  // here with ?error=. Derive it during render rather than pushing it into
  // state from an effect, which would cascade an extra render.
  const linkError = useSearchParams().get('error')
  const shownError = error ?? linkError
  const showResend = canResend || (!!linkError && /confirm|expired/i.test(linkError))

  async function handleLogin(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!isConfigured) return
    setLoading(true)
    setError(null)

    const supabase = createClient()
    const { data, error: signInError } = await supabase.auth.signInWithPassword({ email, password })

    if (signInError) {
      const friendly = describeAuthError(signInError)
      setError(friendly.message)
      setCanResend(friendly.action === 'resend_confirmation')
      setLoading(false)
      return
    }

    // Check if MFA is required
    if (data.session === null && data.user === null) {
      const { data: factorsData } = await supabase.auth.mfa.listFactors()
      const totpFactor = factorsData?.totp?.[0]
      if (totpFactor) {
        setFactorId(totpFactor.id)
        setRequiresTOTP(true)
        setLoading(false)
        return
      }
    }

    router.push('/dashboard')
    router.refresh()
  }

  async function handleResend() {
    const supabase = createClient()
    const { error: resendError } = await supabase.auth.resend({
      type: 'signup',
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth/confirm?next=/setup` },
    })
    if (resendError) {
      setError(describeAuthError(resendError).message)
      return
    }
    setResent(true)
  }

  async function handleTOTPVerify(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const supabase = createClient()
    const { data: challengeData, error: challengeError } =
      await supabase.auth.mfa.challenge({ factorId })

    if (challengeError) {
      setError(challengeError.message)
      setLoading(false)
      return
    }

    const { error: verifyError } = await supabase.auth.mfa.verify({
      factorId,
      challengeId: challengeData.id,
      code: totpCode,
    })

    if (verifyError) {
      setError(verifyError.message)
      setLoading(false)
      return
    }

    router.push('/dashboard')
    router.refresh()
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md space-y-4">

        {/* Setup banner when Supabase is not configured */}
        {!isConfigured && (
          <Alert className="border-yellow-400 bg-yellow-50 text-yellow-900">
            <AlertTriangle className="h-4 w-4 text-yellow-600" />
            <AlertDescription className="text-sm">
              <strong>Supabase not configured.</strong> Add your credentials to{' '}
              <code className="rounded bg-yellow-100 px-1 text-xs">.env.local</code>:
              <pre className="mt-2 rounded bg-yellow-100 p-2 text-xs overflow-x-auto">{`NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key`}</pre>
              Get these from your{' '}
              <a
                href="https://supabase.com/dashboard"
                target="_blank"
                rel="noopener noreferrer"
                className="underline font-medium"
              >
                Supabase project settings
              </a>
              , then restart the dev server.
            </AlertDescription>
          </Alert>
        )}

        <Card>
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl font-bold">
              {requiresTOTP ? 'Two-factor auth' : 'Sign in'}
            </CardTitle>
            <CardDescription>
              {requiresTOTP
                ? 'Enter the code from your authenticator app'
                : 'Sign in to your account'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {shownError && (
              <Alert variant="destructive" className="mb-4">
                <AlertDescription>
                  {shownError}
                  {showResend && (
                    <button
                      type="button"
                      onClick={handleResend}
                      disabled={resent}
                      className="mt-2 block font-semibold underline disabled:no-underline disabled:opacity-70"
                    >
                      {resent ? 'Confirmation link sent' : 'Resend confirmation link'}
                    </button>
                  )}
                </AlertDescription>
              </Alert>
            )}

            {!requiresTOTP ? (
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="you@company.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoComplete="email"
                    disabled={!isConfigured}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    autoComplete="current-password"
                    disabled={!isConfigured}
                  />
                </div>
                <Button type="submit" className="w-full" disabled={loading || !isConfigured}>
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Sign in
                </Button>
                <p className="text-center text-sm text-muted-foreground">
                  Don&apos;t have an account?{' '}
                  <Link href="/register" className="font-medium text-foreground underline underline-offset-4">
                    Create one
                  </Link>
                </p>
              </form>
            ) : (
              <form onSubmit={handleTOTPVerify} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="totp">Authentication Code</Label>
                  <Input
                    id="totp"
                    type="text"
                    inputMode="numeric"
                    placeholder="000000"
                    value={totpCode}
                    onChange={(e) => setTotpCode(e.target.value)}
                    required
                    maxLength={6}
                    pattern="\d{6}"
                    autoComplete="one-time-code"
                    autoFocus
                  />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Verify
                </Button>
                <Button type="button" variant="ghost" className="w-full" onClick={() => setRequiresTOTP(false)}>
                  Back to login
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export default function LoginPage() {
  // useSearchParams needs a Suspense boundary so the shell can still prerender.
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  )
}
