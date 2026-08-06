-- Row-Level Security Policies
-- Enable RLS on all tables

ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE income ENABLE ROW LEVEL SECURITY;
ALTER TABLE income_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE payroll ENABLE ROW LEVEL SECURITY;
ALTER TABLE advances ENABLE ROW LEVEL SECURITY;
ALTER TABLE budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendors ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Helper function to get current user's company_id
CREATE OR REPLACE FUNCTION auth.user_company_id()
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT company_id FROM public.users WHERE id = auth.uid();
$$;

-- Helper function to get current user's role
CREATE OR REPLACE FUNCTION auth.user_role()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT role FROM public.users WHERE id = auth.uid();
$$;

-- Companies: Users can only see their own company
CREATE POLICY "Users can view their own company"
  ON companies FOR SELECT
  USING (id = auth.user_company_id());

CREATE POLICY "Owners can update their company"
  ON companies FOR UPDATE
  USING (id = auth.user_company_id() AND auth.user_role() = 'owner');

-- Users: Can see users in their company
CREATE POLICY "Users can view company users"
  ON users FOR SELECT
  USING (company_id = auth.user_company_id());

CREATE POLICY "Owners and finance managers can manage users"
  ON users FOR ALL
  USING (
    company_id = auth.user_company_id() 
    AND auth.user_role() IN ('owner', 'finance_manager')
  );

-- Departments: Company-level access
CREATE POLICY "Users can view company departments"
  ON departments FOR SELECT
  USING (company_id = auth.user_company_id());

CREATE POLICY "Managers can manage departments"
  ON departments FOR ALL
  USING (
    company_id = auth.user_company_id() 
    AND auth.user_role() IN ('owner', 'finance_manager', 'manager')
  );

-- Accounts: Finance staff full access, others read-only
CREATE POLICY "Users can view company accounts"
  ON accounts FOR SELECT
  USING (company_id = auth.user_company_id());

CREATE POLICY "Finance staff can manage accounts"
  ON accounts FOR ALL
  USING (
    company_id = auth.user_company_id() 
    AND auth.user_role() IN ('owner', 'finance_manager')
  );

-- Income: Finance staff full access, others can view
CREATE POLICY "Users can view company income"
  ON income FOR SELECT
  USING (company_id = auth.user_company_id());

CREATE POLICY "Finance staff can manage income"
  ON income FOR ALL
  USING (
    company_id = auth.user_company_id() 
    AND auth.user_role() IN ('owner', 'finance_manager', 'manager')
  );

-- Income Payments: Same as income
CREATE POLICY "Users can view income payments"
  ON income_payments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM income 
      WHERE income.id = income_payments.income_id 
      AND income.company_id = auth.user_company_id()
    )
  );

CREATE POLICY "Finance staff can manage income payments"
  ON income_payments FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM income 
      WHERE income.id = income_payments.income_id 
      AND income.company_id = auth.user_company_id()
    )
    AND auth.user_role() IN ('owner', 'finance_manager')
  );

-- Expenses: Employees can view and create, managers can approve
CREATE POLICY "Users can view company expenses"
  ON expenses FOR SELECT
  USING (
    company_id = auth.user_company_id()
    AND (
      auth.user_role() IN ('owner', 'finance_manager', 'manager', 'auditor')
      OR submitted_by = auth.uid()
      OR related_employee = auth.uid()
    )
  );

CREATE POLICY "Users can create expenses"
  ON expenses FOR INSERT
  WITH CHECK (
    company_id = auth.user_company_id()
    AND submitted_by = auth.uid()
  );

CREATE POLICY "Users can update their own draft expenses"
  ON expenses FOR UPDATE
  USING (
    company_id = auth.user_company_id()
    AND submitted_by = auth.uid()
    AND status = 'draft'
  );

CREATE POLICY "Managers can update expenses for approval"
  ON expenses FOR UPDATE
  USING (
    company_id = auth.user_company_id()
    AND auth.user_role() IN ('owner', 'finance_manager', 'manager', 'team_lead')
  );

-- Approvals: Approvers can view and create
CREATE POLICY "Users can view expense approvals"
  ON approvals FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM expenses 
      WHERE expenses.id = approvals.expense_id 
      AND expenses.company_id = auth.user_company_id()
    )
  );

CREATE POLICY "Approvers can create approvals"
  ON approvals FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM expenses 
      WHERE expenses.id = approvals.expense_id 
      AND expenses.company_id = auth.user_company_id()
    )
    AND approver_id = auth.uid()
    AND auth.user_role() IN ('owner', 'finance_manager', 'manager', 'team_lead')
  );

-- Documents: Users can manage documents for their transactions
CREATE POLICY "Users can view company documents"
  ON documents FOR SELECT
  USING (company_id = auth.user_company_id());

CREATE POLICY "Users can upload documents"
  ON documents FOR INSERT
  WITH CHECK (
    company_id = auth.user_company_id()
    AND uploaded_by = auth.uid()
  );

CREATE POLICY "Users can update their uploaded documents"
  ON documents FOR UPDATE
  USING (
    company_id = auth.user_company_id()
    AND uploaded_by = auth.uid()
  );

-- Subscriptions: Finance staff manage, others view
CREATE POLICY "Users can view company subscriptions"
  ON subscriptions FOR SELECT
  USING (company_id = auth.user_company_id());

CREATE POLICY "Finance staff can manage subscriptions"
  ON subscriptions FOR ALL
  USING (
    company_id = auth.user_company_id() 
    AND auth.user_role() IN ('owner', 'finance_manager', 'manager')
  );

-- Payroll: Finance staff manage, employees view their own
CREATE POLICY "Finance staff can view all payroll"
  ON payroll FOR SELECT
  USING (
    company_id = auth.user_company_id()
    AND (
      auth.user_role() IN ('owner', 'finance_manager')
      OR employee_id = auth.uid()
    )
  );

CREATE POLICY "Finance staff can manage payroll"
  ON payroll FOR ALL
  USING (
    company_id = auth.user_company_id() 
    AND auth.user_role() IN ('owner', 'finance_manager')
  );

-- Advances: Finance staff manage, employees view their own
CREATE POLICY "Users can view their own advances"
  ON advances FOR SELECT
  USING (
    company_id = auth.user_company_id()
    AND (
      auth.user_role() IN ('owner', 'finance_manager', 'manager')
      OR employee_id = auth.uid()
    )
  );

CREATE POLICY "Employees can request advances"
  ON advances FOR INSERT
  WITH CHECK (
    company_id = auth.user_company_id()
    AND employee_id = auth.uid()
  );

CREATE POLICY "Finance staff can manage advances"
  ON advances FOR UPDATE
  USING (
    company_id = auth.user_company_id() 
    AND auth.user_role() IN ('owner', 'finance_manager', 'manager')
  );

-- Budgets: Managers can view and manage department budgets
CREATE POLICY "Users can view company budgets"
  ON budgets FOR SELECT
  USING (
    company_id = auth.user_company_id()
    AND (
      auth.user_role() IN ('owner', 'finance_manager', 'manager', 'auditor')
    )
  );

CREATE POLICY "Managers can manage budgets"
  ON budgets FOR ALL
  USING (
    company_id = auth.user_company_id() 
    AND auth.user_role() IN ('owner', 'finance_manager', 'manager')
  );

-- Vendors: All can view, finance staff can manage
CREATE POLICY "Users can view company vendors"
  ON vendors FOR SELECT
  USING (company_id = auth.user_company_id());

CREATE POLICY "Finance staff can manage vendors"
  ON vendors FOR ALL
  USING (
    company_id = auth.user_company_id() 
    AND auth.user_role() IN ('owner', 'finance_manager', 'manager')
  );

-- Clients: All can view, managers can manage
CREATE POLICY "Users can view company clients"
  ON clients FOR SELECT
  USING (company_id = auth.user_company_id());

CREATE POLICY "Managers can manage clients"
  ON clients FOR ALL
  USING (
    company_id = auth.user_company_id() 
    AND auth.user_role() IN ('owner', 'finance_manager', 'manager')
  );

-- Projects: All can view, managers can manage
CREATE POLICY "Users can view company projects"
  ON projects FOR SELECT
  USING (company_id = auth.user_company_id());

CREATE POLICY "Managers can manage projects"
  ON projects FOR ALL
  USING (
    company_id = auth.user_company_id() 
    AND auth.user_role() IN ('owner', 'finance_manager', 'manager')
  );

-- Audit Logs: Auditors and owners can view, system creates
CREATE POLICY "Authorized users can view audit logs"
  ON audit_logs FOR SELECT
  USING (
    company_id = auth.user_company_id()
    AND auth.user_role() IN ('owner', 'finance_manager', 'auditor')
  );

CREATE POLICY "System can create audit logs"
  ON audit_logs FOR INSERT
  WITH CHECK (company_id = auth.user_company_id());

-- Notifications: Users can view their own notifications
CREATE POLICY "Users can view their notifications"
  ON notifications FOR SELECT
  USING (
    company_id = auth.user_company_id()
    AND user_id = auth.uid()
  );

CREATE POLICY "System can create notifications"
  ON notifications FOR INSERT
  WITH CHECK (company_id = auth.user_company_id());

CREATE POLICY "Users can mark their notifications as read"
  ON notifications FOR UPDATE
  USING (
    company_id = auth.user_company_id()
    AND user_id = auth.uid()
  );
