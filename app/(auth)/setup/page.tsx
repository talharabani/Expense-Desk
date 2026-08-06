'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, Building2, CheckCircle2 } from 'lucide-react'

export default function SetupPage() {
  const router = useRouter()
  const [userName, setUserName] = useState('')
  const [companyName, setCompanyName] = useState('')
  const [baseCurrency, setBaseCurrency] = useState('PKR')
  const [industryType, setIndustryType] = useState('general')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  // Pre-fill name from auth metadata if available
  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data }) => {
      const meta = data.user?.user_metadata
      if (meta?.name) setUserName(meta.name as string)
      else if (meta?.full_name) setUserName(meta.full_name as string)
    })
  }, [])

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const r = await fetch('/api/setup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userName, companyName, baseCurrency, industryType }),
    })

    if (r.ok) {
      setDone(true)
      setTimeout(() => {
        router.push('/dashboard')
        router.refresh()
      }, 1500)
    } else {
      const data = await r.json()
      // Surface a friendlier message for the service key issue
      const msg = data.error ?? 'Setup failed'
      setError(msg.includes('Service role key') ? msg : msg)
      setLoading(false)
    }
  }

  if (done) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
        <Card className="w-full max-w-md">
          <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
            <CheckCircle2 className="h-14 w-14 text-green-500" />
            <h2 className="text-xl font-semibold">You&apos;re all set!</h2>
            <p className="text-sm text-muted-foreground">Taking you to the dashboard…</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md space-y-4">
        <div className="text-center">
          <Building2 className="mx-auto h-10 w-10 text-muted-foreground mb-3" />
          <h1 className="text-2xl font-bold">Set up your workspace</h1>
          <p className="text-sm text-muted-foreground mt-1">Just a few details to get started</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Company & Profile</CardTitle>
            <CardDescription>This creates your company and sets you as Owner</CardDescription>
          </CardHeader>
          <CardContent>
            {error && (
              <Alert variant="destructive" className="mb-4">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="user-name">Your Name</Label>
                <Input
                  id="user-name"
                  placeholder="John Smith"
                  value={userName}
                  onChange={e => setUserName(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="company-name">Company Name</Label>
                <Input
                  id="company-name"
                  placeholder="Acme Corp"
                  value={companyName}
                  onChange={e => setCompanyName(e.target.value)}
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="currency">Base Currency</Label>
                  <Select
                    id="currency"
                    value={baseCurrency}
                    onChange={e => setBaseCurrency(e.target.value)}
                  >
                    {['PKR', 'USD', 'EUR', 'GBP', 'AED'].map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="industry">Industry</Label>
                  <Select
                    id="industry"
                    value={industryType}
                    onChange={e => setIndustryType(e.target.value)}
                  >
                    <option value="general">General</option>
                    <option value="software_house">Software House</option>
                    <option value="call_center">Call Center</option>
                    <option value="truck_dispatching">Truck Dispatching</option>
                  </Select>
                </div>
              </div>

              <Button type="submit" className="w-full" disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Create workspace
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
