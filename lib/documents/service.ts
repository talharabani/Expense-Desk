import { createClient } from '@supabase/supabase-js'
import { requireSupabaseClient } from '@/lib/auth/server'
import { writeAuditLog } from '@/lib/audit/service'

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB

export function getServiceRoleClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) return null
  return createClient(url, serviceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  })
}

export async function uploadDocument(
  file: File,
  entityType: string,
  entityId: string,
  documentType: string,
  userId: string,
  companyId: string
) {
  // Validate file
  if (!ALLOWED_TYPES.includes(file.type)) {
    throw new Error('Unsupported file type. Allowed: JPEG, PNG, WebP, PDF')
  }
  if (file.size > MAX_FILE_SIZE) {
    throw new Error('File exceeds maximum size of 10MB')
  }

  const supabase = await requireSupabaseClient()
  const adminClient = getServiceRoleClient()
  const uploadClient = adminClient || supabase

  // Auto-create bucket if it doesn't exist
  if (adminClient) {
    try {
      await adminClient.storage.createBucket('documents', {
        public: false,
        allowedMimeTypes: ALLOWED_TYPES,
        fileSizeLimit: MAX_FILE_SIZE,
      })
    } catch {
      // Bucket already exists, or the key lacks permission to create it.
    }
  }

  // Upload to Supabase Storage
  const ext = file.name.split('.').pop()
  const storagePath = `${companyId}/${entityType}/${entityId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`

  const { error: uploadError } = await uploadClient.storage
    .from('documents')
    .upload(storagePath, file, { contentType: file.type, upsert: false })

  if (uploadError) throw new Error(`Upload failed: ${uploadError.message}`)

  // Store metadata
  const { data, error: insertError } = await supabase
    .from('documents')
    .insert({
      company_id: companyId,
      entity_type: entityType,
      entity_id: entityId,
      document_type: documentType,
      storage_path: storagePath,
      original_filename: file.name,
      file_size: file.size,
      mime_type: file.type,
      verification_status: 'pending',
      uploaded_by: userId,
    })
    .select()
    .single()

  if (insertError) throw new Error(insertError.message)

  await writeAuditLog({
    userId,
    companyId,
    entityType: 'document',
    entityId: data.id,
    action: 'created',
    newValue: { entity_type: entityType, entity_id: entityId, document_type: documentType },
  })

  return data
}

/**
 * Checks if a document with the same vendor, amount, and date already exists.
 * Used for duplicate receipt detection.
 */
export async function checkDuplicateDocument(
  companyId: string,
  vendorName: string | null,
  amount: number | null,
  transactionDate: string | null
): Promise<boolean> {
  if (!vendorName && !amount && !transactionDate) return false

  const supabase = await requireSupabaseClient()
  let query = supabase
    .from('documents')
    .select('id')
    .eq('company_id', companyId)

  if (vendorName) query = query.ilike('vendor_name_extracted', vendorName)
  if (amount) query = query.eq('amount_extracted', amount)
  if (transactionDate) query = query.eq('date_extracted', transactionDate)

  const { data } = await query.limit(1)
  return Boolean(data && data.length > 0)
}

export async function getDocumentUrl(storagePath: string): Promise<string> {
  const supabase = await requireSupabaseClient()
  const adminClient = getServiceRoleClient()
  const client = adminClient || supabase

  const { data } = await client.storage
    .from('documents')
    .createSignedUrl(storagePath, 3600) // 1-hour signed URL

  if (!data?.signedUrl) throw new Error('Could not generate document URL')
  return data.signedUrl
}
