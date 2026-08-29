/**
 * Service-layer tests for lib/documents/service.ts — the upload gate (file type
 * and size), the shape of the storage path, and duplicate receipt detection.
 *
 * SUPABASE_SERVICE_ROLE_KEY is deliberately left unset, so getServiceRoleClient
 * returns null and the service falls back to the caller's client. That is the
 * path a developer without the key hits, and it is worth covering.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createMockSupabase, type MockSupabase } from '../helpers/supabase-mock'

let supabase: MockSupabase

vi.mock('@/lib/auth/server', () => ({
  requireSupabaseClient: async () => supabase,
}))

const { uploadDocument, checkDuplicateDocument, getDocumentUrl } = await import('@/lib/documents/service')

const COMPANY = 'company-1'
const USER = 'user-1'

/** A stand-in for the File the route hands the service. */
function fakeFile(name: string, type: string, size: number) {
  return { name, type, size } as unknown as File
}

const pdf = () => fakeFile('receipt.pdf', 'application/pdf', 1024)

beforeEach(() => {
  supabase = createMockSupabase()
})

describe('uploadDocument validation', () => {
  it('accepts the four supported types', async () => {
    for (const [name, type] of [
      ['a.jpg', 'image/jpeg'],
      ['a.png', 'image/png'],
      ['a.webp', 'image/webp'],
      ['a.pdf', 'application/pdf'],
    ]) {
      supabase = createMockSupabase()
      await expect(
        uploadDocument(fakeFile(name, type, 1024), 'expense', 'expense-1', 'receipt', USER, COMPANY)
      ).resolves.toBeTruthy()
    }
  })

  it('rejects an unsupported file type', async () => {
    for (const type of ['application/zip', 'text/html', 'image/gif', 'application/x-msdownload']) {
      await expect(
        uploadDocument(fakeFile('x', type, 1024), 'expense', 'expense-1', 'receipt', USER, COMPANY)
      ).rejects.toThrow(/Unsupported file type/)
    }
  })

  it('rejects a file over 10MB', async () => {
    const tooBig = fakeFile('big.pdf', 'application/pdf', 10 * 1024 * 1024 + 1)
    await expect(
      uploadDocument(tooBig, 'expense', 'expense-1', 'receipt', USER, COMPANY)
    ).rejects.toThrow(/exceeds maximum size/)
  })

  it('accepts a file exactly at the 10MB limit', async () => {
    const atLimit = fakeFile('big.pdf', 'application/pdf', 10 * 1024 * 1024)
    await expect(
      uploadDocument(atLimit, 'expense', 'expense-1', 'receipt', USER, COMPANY)
    ).resolves.toBeTruthy()
  })

  it('stores nothing when validation fails', async () => {
    await expect(
      uploadDocument(fakeFile('x.zip', 'application/zip', 10), 'expense', 'e1', 'receipt', USER, COMPANY)
    ).rejects.toThrow()
    expect(supabase.uploads).toHaveLength(0)
    expect(supabase.rowsIn('documents')).toHaveLength(0)
  })
})

describe('uploadDocument storage path', () => {
  it('scopes the path by company, entity type and entity id', async () => {
    await uploadDocument(pdf(), 'expense', 'expense-42', 'receipt', USER, COMPANY)
    expect(supabase.uploads[0].path).toMatch(new RegExp(`^${COMPANY}/expense/expense-42/\\d+-[a-z0-9]+\\.pdf$`))
  })

  it('puts the file in the documents bucket with its content type', async () => {
    await uploadDocument(pdf(), 'expense', 'expense-42', 'receipt', USER, COMPANY)
    expect(supabase.uploads[0].bucket).toBe('documents')
    expect(supabase.uploads[0].contentType).toBe('application/pdf')
  })

  it('gives two uploads of the same file distinct paths', async () => {
    await uploadDocument(pdf(), 'expense', 'e1', 'receipt', USER, COMPANY)
    await uploadDocument(pdf(), 'expense', 'e1', 'receipt', USER, COMPANY)
    expect(supabase.uploads[0].path).not.toBe(supabase.uploads[1].path)
  })

  it('records the metadata row alongside the stored file', async () => {
    await uploadDocument(pdf(), 'expense', 'expense-42', 'receipt', USER, COMPANY)
    const doc = supabase.rowsIn('documents')[0]
    expect(doc).toMatchObject({
      company_id: COMPANY,
      entity_type: 'expense',
      entity_id: 'expense-42',
      document_type: 'receipt',
      original_filename: 'receipt.pdf',
      mime_type: 'application/pdf',
      verification_status: 'pending',
      uploaded_by: USER,
    })
    expect(doc.storage_path).toBe(supabase.uploads[0].path)
  })

  it('does not write metadata when the upload itself fails', async () => {
    supabase.failUploads('storage is down')
    await expect(
      uploadDocument(pdf(), 'expense', 'e1', 'receipt', USER, COMPANY)
    ).rejects.toThrow(/Upload failed: storage is down/)
    expect(supabase.rowsIn('documents')).toHaveLength(0)
  })

  it('audits the upload', async () => {
    await uploadDocument(pdf(), 'expense', 'expense-42', 'receipt', USER, COMPANY)
    const audit = supabase.rowsIn('audit_logs').at(-1)!
    expect(audit).toMatchObject({ entity_type: 'document', action: 'created', user_id: USER })
  })
})

describe('checkDuplicateDocument', () => {
  function seedDocuments() {
    supabase = createMockSupabase({
      documents: [
        {
          id: 'doc-1',
          company_id: COMPANY,
          vendor_name_extracted: 'Acme Supplies',
          amount_extracted: 250,
          date_extracted: '2026-06-01',
        },
      ],
    })
  }

  beforeEach(seedDocuments)

  it('flags a document matching vendor, amount and date', async () => {
    expect(await checkDuplicateDocument(COMPANY, 'Acme Supplies', 250, '2026-06-01')).toBe(true)
  })

  it('matches the vendor name case-insensitively', async () => {
    expect(await checkDuplicateDocument(COMPANY, 'acme supplies', 250, '2026-06-01')).toBe(true)
  })

  it('does not flag a different amount', async () => {
    expect(await checkDuplicateDocument(COMPANY, 'Acme Supplies', 999, '2026-06-01')).toBe(false)
  })

  it('does not flag a different date', async () => {
    expect(await checkDuplicateDocument(COMPANY, 'Acme Supplies', 250, '2026-07-01')).toBe(false)
  })

  it('does not flag a different vendor', async () => {
    expect(await checkDuplicateDocument(COMPANY, 'Other Vendor', 250, '2026-06-01')).toBe(false)
  })

  it('does not leak across companies', async () => {
    expect(await checkDuplicateDocument('other-company', 'Acme Supplies', 250, '2026-06-01')).toBe(false)
  })

  it('returns false when nothing was extracted to compare', async () => {
    expect(await checkDuplicateDocument(COMPANY, null, null, null)).toBe(false)
  })
})

describe('getDocumentUrl', () => {
  it('returns a signed URL for the stored path', async () => {
    const url = await getDocumentUrl(`${COMPANY}/expense/e1/123-abc.pdf`)
    expect(url).toContain('/documents/')
    expect(url).toContain('exp=3600')
  })
})
