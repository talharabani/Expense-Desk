import { requireSupabaseClient } from '@/lib/auth/server'
import { writeAuditLog } from '@/lib/audit/service'
import type { Account } from '@/types'

/**
 * Credits an account by the given converted amount (in base currency).
 * Must be called within a larger operation that handles income recording.
 */
export async function creditAccount(
  accountId: string,
  amount: number,
  userId: string,
  companyId: string
): Promise<void> {
  const supabase = await requireSupabaseClient()

  const { data: account, error: fetchError } = await supabase
    .from('accounts')
    .select('current_balance')
    .eq('id', accountId)
    .eq('company_id', companyId)
    .single()

  if (fetchError || !account) {
    throw new Error('Account not found')
  }

  const newBalance = Number(account.current_balance) + amount

  const { error: updateError } = await supabase
    .from('accounts')
    .update({ current_balance: newBalance, updated_at: new Date().toISOString() })
    .eq('id', accountId)
    .eq('company_id', companyId)

  if (updateError) {
    throw new Error(`Failed to credit account: ${updateError.message}`)
  }

  await writeAuditLog({
    userId,
    companyId,
    entityType: 'account',
    entityId: accountId,
    action: 'updated',
    previousValue: { current_balance: account.current_balance },
    newValue: { current_balance: newBalance },
  })
}

/**
 * Debits an account by the given converted amount (in base currency).
 */
export async function debitAccount(
  accountId: string,
  amount: number,
  userId: string,
  companyId: string
): Promise<void> {
  const supabase = await requireSupabaseClient()

  const { data: account, error: fetchError } = await supabase
    .from('accounts')
    .select('current_balance')
    .eq('id', accountId)
    .eq('company_id', companyId)
    .single()

  if (fetchError || !account) {
    throw new Error('Account not found')
  }

  const newBalance = Number(account.current_balance) - amount

  const { error: updateError } = await supabase
    .from('accounts')
    .update({ current_balance: newBalance, updated_at: new Date().toISOString() })
    .eq('id', accountId)
    .eq('company_id', companyId)

  if (updateError) {
    throw new Error(`Failed to debit account: ${updateError.message}`)
  }

  await writeAuditLog({
    userId,
    companyId,
    entityType: 'account',
    entityId: accountId,
    action: 'updated',
    previousValue: { current_balance: account.current_balance },
    newValue: { current_balance: newBalance },
  })
}

/**
 * Transfers money between two accounts atomically.
 * Does NOT create income or expense records.
 */
export async function transferBetweenAccounts(
  fromAccountId: string,
  toAccountId: string,
  amount: number,
  userId: string,
  companyId: string,
  notes?: string
): Promise<void> {
  if (fromAccountId === toAccountId) {
    throw new Error('Cannot transfer to the same account')
  }
  if (amount <= 0) {
    throw new Error('Transfer amount must be positive')
  }

  const supabase = await requireSupabaseClient()

  // Fetch both accounts
  const { data: accounts, error: fetchError } = await supabase
    .from('accounts')
    .select('id, current_balance')
    .in('id', [fromAccountId, toAccountId])
    .eq('company_id', companyId)

  if (fetchError || !accounts || accounts.length !== 2) {
    throw new Error('One or both accounts not found')
  }

  const fromAccount = accounts.find((a: { id: string; current_balance: number }) => a.id === fromAccountId)!
  const toAccount = accounts.find((a: { id: string; current_balance: number }) => a.id === toAccountId)!

  const newFromBalance = Number(fromAccount.current_balance) - amount
  const newToBalance = Number(toAccount.current_balance) + amount

  // Update both accounts
  const { error: fromError } = await supabase
    .from('accounts')
    .update({ current_balance: newFromBalance })
    .eq('id', fromAccountId)
    .eq('company_id', companyId)

  if (fromError) {
    throw new Error(`Failed to debit source account: ${fromError.message}`)
  }

  const { error: toError } = await supabase
    .from('accounts')
    .update({ current_balance: newToBalance })
    .eq('id', toAccountId)
    .eq('company_id', companyId)

  if (toError) {
    // Attempt rollback
    await supabase
      .from('accounts')
      .update({ current_balance: fromAccount.current_balance })
      .eq('id', fromAccountId)
    throw new Error(`Failed to credit destination account: ${toError.message}`)
  }

  // Audit both sides
  await writeAuditLog({
    userId,
    companyId,
    entityType: 'account',
    entityId: fromAccountId,
    action: 'transfer_out',
    previousValue: { current_balance: fromAccount.current_balance },
    newValue: { current_balance: newFromBalance, transferred_to: toAccountId, amount, notes },
  })
  await writeAuditLog({
    userId,
    companyId,
    entityType: 'account',
    entityId: toAccountId,
    action: 'transfer_in',
    previousValue: { current_balance: toAccount.current_balance },
    newValue: { current_balance: newToBalance, transferred_from: fromAccountId, amount, notes },
  })
}

export async function getAccounts(companyId: string): Promise<Account[]> {
  const supabase = await requireSupabaseClient()
  const { data, error } = await supabase
    .from('accounts')
    .select('*')
    .eq('company_id', companyId)
    .eq('is_active', true)
    .order('name')

  if (error) throw new Error(error.message)
  return data as Account[]
}
