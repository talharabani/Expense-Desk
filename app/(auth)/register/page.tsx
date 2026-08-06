'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, AlertTriangle, CheckCircle2 } from 'lucide-react'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
const isConfigured =
  SUPABASE_URL.length > 0 &&
  SUPABASE_URL !== 'your-supabase-url' &&
  !SUPABASE_URL.includes('placeholder')

export default function RegisterPage() {
  const router = useRouter()

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  async function handleRegister(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!isConfigured) return

    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters')
      return
    }

    setLoading(true)
    setError(null)

    const supabase = createClient()

    // Sign up the user with Supabase Auth
    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { name },
      },
    })

    if (signUpError) {
      setError(signUpError.message)
      setLoading(false)
      return
    }

    // If email confirmation is disabled (common in dev), session is returned immediately
    if (data.session) {
      router.push('/dashboard')
      router.refresh()
      return
    }

    // Email confirmation required
    setSuccess(true)
    setLoading(false)
  }

  if (success) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
        <Card className="w-full max-w-md">
          <CardContent className="flex flex-col items-center gap-4 py-10 text-center">
            <CheckCircle2 className="h-12 w-12 text-green-500" />
            <h2 className="text-xl font-semibold">Check your email</h2>
            <p className="text-sm text-muted-foreground">
              We sent a confirmation link to <strong>{email}</strong>.
              Click it to activate your account, then sign in.
            </p>
            <Link href="/login">
              <Button className="mt-2">Go to login</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md space-y-4">

        {!isConfigured && (
          <Alert className="border-yellow-400 bg-yellow-50 text-yellow-900">
            <AlertTriangle className="h-4 w-4 text-yellow-600" />
            <AlertDescription className="text-sm">
              <strong>Supabase not configured.</strong> Add your credentials to{' '}
              <code className="rounded bg-yellow-100 px-1 text-xs">.env.local</code> and restart the dev server.
              <pre className="mt-2 rounded bg-yellow-100 p-2 text-xs overflow-x-auto">{`NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key`}</pre>
            </AlertDescription>
          </Alert>
        )}

        <Card>
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl font-bold">Create account</CardTitle>
            <CardDescription>Register to start tracking your business finances</CardDescription>
          </CardHeader>
          <CardContent>
            {error && (
              <Alert variant="destructive" className="mb-4">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <form onSubmit={handleRegister} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Full Name</Label>
                <Input
                  id="name"
                  type="text"
                  placeholder="John Smith"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  autoComplete="name"
                  disabled={!isConfigured}
                />
              </div>
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
                  placeholder="Min. 8 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="new-password"
                  minLength={8}
                  disabled={!isConfigured}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm-password">Confirm Password</Label>
                <Input
                  id="confirm-password"
                  type="password"
                  placeholder="Repeat your password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  autoComplete="new-password"
                  disabled={!isConfigured}
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading || !isConfigured}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Create account
              </Button>
              <p className="text-center text-sm text-muted-foreground">
                Already have an account?{' '}
                <Link href="/login" className="font-medium text-foreground underline underline-offset-4">
                  Sign in
                </Link>
              </p>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
