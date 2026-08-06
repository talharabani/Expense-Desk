import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createSupabaseServerClient } from '@/lib/auth/server'

/**
 * Creates a Supabase admin client using the service role key.
 * This bypasses RLS — use only for trusted server-side operations.
 */
function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !serviceKey || serviceKey === 'your-service-role-key') {
    return null
  }

  return createServerClient(url, serviceKey, {
    cookies: { getAll: () => [], setAll: () => {} },
    auth: { persistSession: false },
  })
}

export async function POST(request: NextRequest) {
  try {
    // 1. Verify the requesting user is authenticated (anon client reads session)
    const anonSupabase = await createSupabaseServerClient()
    if (!anonSupabase) {
      return NextResponse.json({ error: 'Supabase not configured' }, { status: 503 })
    }

    const { data: { user }, error: authError } = await anonSupabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // 2. Use admin client for DB writes (bypasses RLS for initial setup)
    const admin = createAdminClient()
    if (!admin) {
      return NextResponse.json(
        { error: 'Service role key not configured. Add SUPABASE_SERVICE_ROLE_KEY to .env.local (get it from Supabase Dashboard → Settings → API).' },
        { status: 503 }
      )
    }

    // 3. Check if profile already exists
    const { data: existing } = await admin
      .from('users').select('id').eq('id', user.id).single()
    if (existing) {
      return NextResponse.json({ error: 'Profile already exists' }, { status: 409 })
    }

    const body = await request.json()
    const { companyName, userName, baseCurrency = 'PKR', industryType = 'general' } = body

    if (!companyName?.trim() || !userName?.trim()) {
      return NextResponse.json({ error: 'Company name and your name are required' }, { status: 422 })
    }

    // 4. Create company
    const { data: company, error: companyError } = await admin
      .from('companies')
      .insert({
        name: companyName.trim(),
        base_currency: baseCurrency,
        industry_type: industryType,
      })
      .select()
      .single()

    if (companyError) {
      return NextResponse.json({ error: companyError.message }, { status: 500 })
    }

    // 5. Create user profile as owner
    const { error: profileError } = await admin
      .from('users')
      .insert({
        id: user.id,
        company_id: company.id,
        name: userName.trim(),
        email: user.email,
        role: 'owner',
        is_active: true,
      })

    if (profileError) {
      // Rollback company
      await admin.from('companies').delete().eq('id', company.id)
      return NextResponse.json({ error: profileError.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, companyId: company.id })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
