import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser, requireSupabaseClient } from '@/lib/auth/server'
import { getDocumentUrl } from '@/lib/documents/service'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const user = await getAuthUser()
    const supabase = await requireSupabaseClient()

    const { data: document, error } = await supabase
      .from('documents')
      .select('*')
      .eq('id', id)
      .eq('company_id', user.companyId)
      .single()

    if (error || !document) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 })
    }

    const url = await getDocumentUrl(document.storage_path)
    return NextResponse.json({ url })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    if (msg === 'Unauthorized') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
