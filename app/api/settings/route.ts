import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser, requireSupabaseClient } from '@/lib/auth/server'
import { writeAuditLog } from '@/lib/audit/service'

export async function GET() {
  try {
    const user = await getAuthUser()
    const supabase = await requireSupabaseClient()

    // Get user details
    const { data: userProfile, error: userError } = await supabase
      .from('users')
      .select('name, email, role, two_fa_enabled')
      .eq('id', user.id)
      .single()

    if (userError || !userProfile) {
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 })
    }

    // Get company details
    const { data: company, error: companyError } = await supabase
      .from('companies')
      .select('name, base_currency, industry_type, timezone')
      .eq('id', user.companyId)
      .single()

    if (companyError || !company) {
      return NextResponse.json({ error: 'Company details not found' }, { status: 404 })
    }

    return NextResponse.json({
      user: userProfile,
      company: company
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    if (msg === 'Unauthorized') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const user = await getAuthUser()
    const supabase = await requireSupabaseClient()
    const body = await request.json()

    // 1. Get existing records
    const { data: existingUser } = await supabase
      .from('users').select('*').eq('id', user.id).single()

    const { data: existingCompany } = await supabase
      .from('companies').select('*').eq('id', user.companyId).single()

    if (!existingUser || !existingCompany) {
      return NextResponse.json({ error: 'Profiles not found' }, { status: 404 })
    }

    // 2. Perform user profile update
    if (body.userName !== undefined || body.two_fa_enabled !== undefined) {
      const userUpdates = {
        name: body.userName ?? existingUser.name,
        two_fa_enabled: body.two_fa_enabled ?? existingUser.two_fa_enabled,
      }
      
      const { data: updatedUser, error: userError } = await supabase
        .from('users')
        .update(userUpdates)
        .eq('id', user.id)
        .select()
        .single()

      if (userError) throw new Error(userError.message)

      await writeAuditLog({
        userId: user.id,
        companyId: user.companyId,
        entityType: 'user',
        entityId: user.id,
        action: 'updated',
        previousValue: existingUser,
        newValue: updatedUser
      })
    }

    // 3. Perform company profile update
    if (body.companyName !== undefined || body.baseCurrency !== undefined || body.industryType !== undefined || body.timezone !== undefined) {
      if (user.role !== 'owner' && user.role !== 'finance_manager' && user.role !== 'manager') {
        return NextResponse.json({ error: 'Forbidden: Only owners/managers can edit company settings' }, { status: 403 })
      }

      const companyUpdates = {
        name: body.companyName ?? existingCompany.name,
        base_currency: body.baseCurrency ?? existingCompany.base_currency,
        industry_type: body.industryType ?? existingCompany.industry_type,
        timezone: body.timezone ?? existingCompany.timezone ?? 'UTC',
      }

      const { data: updatedCompany, error: companyError } = await supabase
        .from('companies')
        .update(companyUpdates)
        .eq('id', user.companyId)
        .select()
        .single()

      if (companyError) throw new Error(companyError.message)

      await writeAuditLog({
        userId: user.id,
        companyId: user.companyId,
        entityType: 'company',
        entityId: user.companyId,
        action: 'updated',
        previousValue: existingCompany,
        newValue: updatedCompany
      })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    if (msg === 'Unauthorized') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
