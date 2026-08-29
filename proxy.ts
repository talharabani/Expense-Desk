import { type NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { readSupabaseEnv } from '@/lib/supabase/env'

// Hard ceiling for the Supabase auth round-trip. Vercel kills the proxy at 25s;
// staying well under that means a slow/unreachable Supabase degrades to
// "session not refreshed" instead of a 504 on every route.
const AUTH_TIMEOUT_MS = 5000

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request })

  // Skip middleware if env vars aren't configured yet, or if they carry paste
  // damage that would make the auth header invalid.
  const { url: supabaseUrl, key: supabaseKey, isConfigured } = readSupabaseEnv()
  if (!isConfigured) {
    return response
  }

  // No auth cookie means there's no session to refresh — don't pay for a
  // network call on public pages, static-ish routes, or bot traffic.
  const hasAuthCookie = request.cookies
    .getAll()
    .some(({ name }) => name.startsWith('sb-') && name.includes('auth-token'))
  if (!hasAuthCookie) {
    return response
  }

  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    global: {
      fetch: (input, init) =>
        fetch(input, { ...init, signal: AbortSignal.timeout(AUTH_TIMEOUT_MS) }),
    },
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
        response = NextResponse.next({ request })
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options)
        )
      },
    },
  })

  // Refresh session — must be called before any Server Component reads the session.
  // Never let this fail the request: the layouts and route handlers do their own
  // auth checks, so a missed refresh redirects to /login rather than 504ing.
  try {
    await supabase.auth.getUser()
  } catch {
    // timed out or network error — fall through with the unmodified response
  }

  return response
}

export const config = {
  matcher: [
    /*
     * Match all request paths except static files and Next.js internals
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\.(?:svg|png|jpg|jpeg|gif|webp|ico|txt|xml|woff2?)$).*)',
  ],
}
