import { createServerClient } from '@supabase/ssr'
import { SupabaseClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import type { Role } from '@/types'

/**
 * Creates a Supabase client for use in Server Components and API routes.
 * Returns null if Supabase env vars are not configured.
 */
export async function createSupabaseServerClient(): Promise<SupabaseClient | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url || !url.startsWith('https://') || !url.includes('.supabase.co') || !key || key.length < 100) {
    return null
  }

  const cookieStore = await cookies()

  return createServerClient(url, key, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options)
          })
        } catch {
          // Ignore in Server Components
        }
      },
    },
  })
}

/**
 * Returns a configured Supabase client or throws if not configured.
 * Use in API routes — maps to a 503 if Supabase is not set up.
 */
export async function requireSupabaseClient(): Promise<SupabaseClient> {
  const client = await createSupabaseServerClient()
  if (!client) throw new Error('Supabase not configured')
  return client
}

/**
 * Returns the current authenticated user with their role and company_id.
 * Throws 'Unauthorized' if not authenticated or Supabase is not configured.
 * Throws 'SetupRequired' if the auth user exists but has no profile yet.
 */
export async function getAuthUser() {
  const supabase = await createSupabaseServerClient()
  if (!supabase) throw new Error('Unauthorized')

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user) {
    throw new Error('Unauthorized')
  }

  const { data: profile, error: profileError } = await supabase
    .from('users')
    .select('id, company_id, role, name, email, is_active')
    .eq('id', user.id)
    .single()

  if (profileError || !profile) {
    // Auth session exists but no app profile — first-time setup needed
    throw new Error('SetupRequired')
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const p = profile as any
  if (!p.is_active) {
    throw new Error('Account is disabled')
  }

  return {
    id: p.id as string,
    companyId: p.company_id as string,
    role: p.role as Role,
    name: p.name as string,
    email: p.email as string,
  }
}

/**
 * Writes a login history entry after successful authentication.
 */
export async function recordLoginHistory(
  userId: string,
  companyId: string,
  ipAddress: string,
  deviceInfo: string
) {
  const supabase = await createSupabaseServerClient()
  if (!supabase) return
  await supabase.from('audit_logs').insert({
    company_id: companyId,
    user_id: userId,
    entity_type: 'session',
    entity_id: userId,
    action: 'login',
    ip_address: ipAddress,
    device_info: deviceInfo,
  })
}
