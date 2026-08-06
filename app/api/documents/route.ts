import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth/server'
import { uploadDocument, checkDuplicateDocument } from '@/lib/documents/service'

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser()
    const formData = await request.formData()

    const file = formData.get('file') as File | null
    const entityType = formData.get('entityType') as string | null
    const entityId = formData.get('entityId') as string | null
    const documentType = formData.get('documentType') as string | null

    if (!file || !entityType || !entityId || !documentType) {
      return NextResponse.json(
        { error: 'Missing required fields: file, entityType, entityId, documentType' },
        { status: 422 }
      )
    }

    const document = await uploadDocument(
      file,
      entityType,
      entityId,
      documentType,
      user.id,
      user.companyId
    )

    return NextResponse.json(document, { status: 201 })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    if (message === 'Unauthorized') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (message.startsWith('Unsupported file')) return NextResponse.json({ error: message }, { status: 415 })
    if (message.startsWith('File exceeds')) return NextResponse.json({ error: message }, { status: 413 })
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
