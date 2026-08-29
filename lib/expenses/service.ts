import { requireSupabaseClient } from '@/lib/auth/server'
import { debitAccount } from '@/lib/accounts/service'
import { writeAuditLog } from '@/lib/audit/service'
import { convertAmount, validateCurrencyFields } from '@/lib/currency/utils'
import { createNotification } from '@/lib/notifications/service'
import { getApprovalThreshold, getApprovalPermission, hasPermission } from '@/lib/auth/permissions'
import type { Expense, CreateExpenseInput, Role } from '@/types'

export async function createExpense(
  input: CreateExpenseInput,
  userId: string,
  companyId: string,
  baseCurrency: string
): Promise<Expense> {
  if (!input.title || !input.category || !input.amount || !input.currency || !input.expenseDate || !input.paymentMethod || !input.description) {
    throw new Error('Missing required fields: title, category, amount, currency, expenseDate, paymentMethod, description')
  }
  if (input.amount <= 0) {
    throw new Error('Amount must be positive')
  }

  const currencyCheck = validateCurrencyFields(input.currency, baseCurrency, input.exchangeRate)
  if (!currencyCheck.valid) throw new Error(currencyCheck.error)

  const exchangeRate = input.currency === baseCurrency ? 1 : input.exchangeRate!
  const convertedAmount = convertAmount(input.amount, exchangeRate)

  const supabase = await requireSupabaseClient()

  const { data, error } = await supabase
    .from('expenses')
    .insert({
      company_id: companyId,
      title: input.title,
      category: input.category,
      department_id: input.departmentId ?? null,
      project_id: input.projectId ?? null,
      client_id: input.clientId ?? null,
      vendor_id: input.vendorId ?? null,
      amount: input.amount,
      currency: input.currency,
      exchange_rate: exchangeRate,
      converted_amount: convertedAmount,
      expense_date: input.expenseDate,
      payment_method: input.paymentMethod,
      account_id: input.accountId ?? null,
      is_recurring: input.isRecurring ?? false,
      recurrence: input.recurrence ?? null,
      tax_amount: input.taxAmount ?? 0,
      description: input.description ?? null,
      business_purpose: input.businessPurpose ?? null,
      related_employee: input.relatedEmployee ?? null,
      submitted_by: userId,
      status: (input as { status?: string }).status ?? 'draft',
    })
    .select()
    .single()

  if (error) throw new Error(error.message)

  await writeAuditLog({
    userId,
    companyId,
    entityType: 'expense',
    entityId: data.id,
    action: 'created',
    newValue: data,
  })

  return data as Expense
}

export async function submitExpense(
  expenseId: string,
  userId: string,
  companyId: string
): Promise<void> {
  const supabase = await requireSupabaseClient()

  const { data: expense, error } = await supabase
    .from('expenses')
    .select('*')
    .eq('id', expenseId)
    .eq('company_id', companyId)
    .eq('submitted_by', userId)
    .single()

  if (error || !expense) throw new Error('Expense not found or not owned by user')
  if (expense.status !== 'draft') throw new Error('Only draft expenses can be submitted')

  const { error: updateError } = await supabase
    .from('expenses')
    .update({ status: 'submitted', updated_at: new Date().toISOString() })
    .eq('id', expenseId)

  if (updateError) throw new Error(updateError.message)

  await writeAuditLog({
    userId,
    companyId,
    entityType: 'expense',
    entityId: expenseId,
    action: 'submitted',
    previousValue: { status: 'draft' },
    newValue: { status: 'submitted' },
  })

  // Notify approver
  const requiredRole = getApprovalThreshold(Number(expense.amount))
  await notifyApprovers(expenseId, expense.title, requiredRole, companyId)
}

export async function processApproval(
  expenseId: string,
  approverId: string,
  approverRole: Role,
  companyId: string,
  action: 'approved' | 'rejected' | 'request_changes' | 'request_proof' | 'forwarded',
  comment?: string,
  forwardToUserId?: string
): Promise<void> {
  const supabase = await requireSupabaseClient()

  const { data: expense, error } = await supabase
    .from('expenses')
    .select('*')
    .eq('id', expenseId)
    .eq('company_id', companyId)
    .single()

  if (error || !expense) throw new Error('Expense not found')

  // Verify approver has permission for this amount
  const permissionAction = getApprovalPermission(Number(expense.amount))
  if (!hasPermission(approverRole, permissionAction)) {
    throw new Error(`Insufficient role to approve expense of this amount. Required: ${getApprovalThreshold(Number(expense.amount))}`)
  }

  // Block self-approval only when there are other users available to approve
  // (skip this check for single-user company setups where owner must approve own expenses)
  const supabaseCheck = await requireSupabaseClient()
  const { count: userCount } = await supabaseCheck
    .from('users')
    .select('id', { count: 'exact', head: true })
    .eq('company_id', companyId)

  if ((userCount ?? 1) > 1 && expense.submitted_by === approverId) {
    throw new Error('Cannot approve your own expense')
  }

  const previousStatus = expense.status

  // Determine new status
  let newStatus: string = expense.status
  if (action === 'approved') newStatus = 'approved'
  else if (action === 'rejected') newStatus = 'rejected'
  else if (action === 'request_changes' || action === 'request_proof') newStatus = 'under_review'

  // Insert approval record
  await supabase.from('approvals').insert({
    expense_id: expenseId,
    approver_id: approverId,
    action,
    comment: comment ?? null,
    previous_status: previousStatus,
    new_status: newStatus,
  })

  // Update expense
  await supabase
    .from('expenses')
    .update({
      status: newStatus,
      approved_by: action === 'approved' ? approverId : null,
      approval_date: action === 'approved' ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', expenseId)

  await writeAuditLog({
    userId: approverId,
    companyId,
    entityType: 'expense',
    entityId: expenseId,
    action,
    previousValue: { status: previousStatus },
    newValue: { status: newStatus, comment },
  })

  // Notify submitter
  await createNotification({
    userId: expense.submitted_by,
    companyId,
    type: `expense_${action}`,
    title: `Expense ${action}`,
    message: `Your expense "${expense.title}" has been ${action}.${comment ? ` Comment: ${comment}` : ''}`,
    entityType: 'expense',
    entityId: expenseId,
  })

  // A forward hands the expense to a named colleague. The status stays put so
  // the expense remains in the approval queue; the new approver is told about it.
  if (action === 'forwarded' && forwardToUserId) {
    const { data: target } = await supabase
      .from('users')
      .select('id')
      .eq('id', forwardToUserId)
      .eq('company_id', companyId)
      .eq('is_active', true)
      .single()

    if (!target) throw new Error('Cannot forward to an unknown user')

    await createNotification({
      userId: target.id,
      companyId,
      type: 'expense_forwarded',
      title: 'Expense forwarded to you',
      message: `An expense "${expense.title}" was forwarded to you for approval.${comment ? ` Comment: ${comment}` : ''}`,
      entityType: 'expense',
      entityId: expenseId,
    })
  }
}

export async function markExpensePaid(
  expenseId: string,
  userId: string,
  companyId: string
): Promise<void> {
  const supabase = await requireSupabaseClient()

  const { data: expense, error } = await supabase
    .from('expenses')
    .select('*')
    .eq('id', expenseId)
    .eq('company_id', companyId)
    .single()

  if (error || !expense) throw new Error('Expense not found')
  if (expense.status !== 'approved') throw new Error('Expense must be approved before marking as paid')
  if (!expense.account_id) throw new Error('Payment account is required')

  await debitAccount(expense.account_id, Number(expense.converted_amount), userId, companyId)

  await supabase
    .from('expenses')
    .update({ status: 'paid', updated_at: new Date().toISOString() })
    .eq('id', expenseId)

  await writeAuditLog({
    userId,
    companyId,
    entityType: 'expense',
    entityId: expenseId,
    action: 'paid',
    previousValue: { status: 'approved' },
    newValue: { status: 'paid' },
  })
}

export async function getExpenses(
  companyId: string,
  filters?: {
    departmentId?: string
    projectId?: string
    clientId?: string
    category?: string
    status?: string
    from?: string
    to?: string
    submittedBy?: string
    limit?: number
    offset?: number
  }
) {
  const supabase = await requireSupabaseClient()
  let query = supabase
    .from('expenses')
    .select('*', { count: 'exact' })
    .eq('company_id', companyId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(filters?.limit ?? 50)

  if (filters?.departmentId) query = query.eq('department_id', filters.departmentId)
  if (filters?.projectId) query = query.eq('project_id', filters.projectId)
  if (filters?.clientId) query = query.eq('client_id', filters.clientId)
  if (filters?.category) query = query.eq('category', filters.category)
  if (filters?.status) query = query.eq('status', filters.status)
  if (filters?.from) query = query.gte('expense_date', filters.from)
  if (filters?.to) query = query.lte('expense_date', filters.to)
  if (filters?.submittedBy) query = query.eq('submitted_by', filters.submittedBy)

  const { data, error, count } = await query
  if (error) throw new Error(error.message)
  return { data, count }
}

// Internal helper — notifies users with the required approval role
async function notifyApprovers(
  expenseId: string,
  expenseTitle: string,
  requiredRole: Role,
  companyId: string
): Promise<void> {
  const supabase = await requireSupabaseClient()
  const { data: approvers } = await supabase
    .from('users')
    .select('id')
    .eq('company_id', companyId)
    .eq('role', requiredRole)
    .eq('is_active', true)

  if (!approvers) return

  for (const approver of approvers) {
    await createNotification({
      userId: approver.id,
      companyId,
      type: 'expense_submitted',
      title: 'New expense awaiting approval',
      message: `An expense "${expenseTitle}" has been submitted for your approval.`,
      entityType: 'expense',
      entityId: expenseId,
    })
  }
}
