-- ============================================================
-- Run this entire file in Supabase SQL Editor to set up the DB
-- Dashboard → SQL Editor → New Query → paste → Run
-- ============================================================

-- Extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- COMPANIES
CREATE TABLE IF NOT EXISTS companies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  base_currency TEXT NOT NULL DEFAULT 'PKR',
  industry_type TEXT CHECK (industry_type IN ('software_house','call_center','truck_dispatching','general')),
  timezone TEXT NOT NULL DEFAULT 'UTC',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- USERS
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('owner','finance_manager','manager','team_lead','employee','auditor')),
  department_id UUID,
  is_active BOOLEAN DEFAULT TRUE,
  two_fa_enabled BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_users_company ON users(company_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- DEPARTMENTS
CREATE TABLE IF NOT EXISTS departments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  manager_id UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_departments_company ON departments(company_id);

ALTER TABLE users DROP CONSTRAINT IF EXISTS users_department_fk;
ALTER TABLE users ADD CONSTRAINT users_department_fk
  FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE SET NULL;

-- ACCOUNTS
CREATE TABLE IF NOT EXISTS accounts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  account_type TEXT NOT NULL CHECK (account_type IN ('petty_cash','bank','personal','credit_card','debit_card','digital_wallet')),
  currency TEXT NOT NULL,
  opening_balance NUMERIC(18,4) DEFAULT 0,
  current_balance NUMERIC(18,4) DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  notes TEXT,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_accounts_company ON accounts(company_id);

-- AUDIT LOGS
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  action TEXT NOT NULL,
  previous_value JSONB,
  new_value JSONB,
  ip_address INET,
  device_info TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_audit_logs_company ON audit_logs(company_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);

-- NOTIFICATIONS
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  entity_type TEXT,
  entity_id UUID,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, is_read);

-- CLIENTS
CREATE TABLE IF NOT EXISTS clients (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  company_name TEXT,
  contact_person TEXT,
  phone TEXT,
  email TEXT,
  industry TEXT,
  status TEXT DEFAULT 'active' CHECK (status IN ('active','inactive')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_clients_company ON clients(company_id);

-- VENDORS
CREATE TABLE IF NOT EXISTS vendors (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  company_name TEXT,
  contact_person TEXT,
  phone TEXT,
  email TEXT,
  address TEXT,
  tax_number TEXT,
  bank_details TEXT,
  services TEXT,
  payment_terms TEXT,
  total_paid NUMERIC(18,4) DEFAULT 0,
  outstanding NUMERIC(18,4) DEFAULT 0,
  status TEXT DEFAULT 'active' CHECK (status IN ('active','inactive','blocked')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_vendors_company ON vendors(company_id);

-- PROJECTS
CREATE TABLE IF NOT EXISTS projects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
  project_type TEXT CHECK (project_type IN ('software','campaign','load','general')),
  start_date DATE,
  end_date DATE,
  status TEXT DEFAULT 'active' CHECK (status IN ('active','completed','on_hold','cancelled')),
  total_revenue NUMERIC(18,4) DEFAULT 0,
  total_expenses NUMERIC(18,4) DEFAULT 0,
  profit NUMERIC(18,4) DEFAULT 0,
  profit_margin NUMERIC(8,4) DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_projects_company ON projects(company_id);

-- INCOME
CREATE TABLE IF NOT EXISTS income (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  invoice_number TEXT,
  amount NUMERIC(18,4) NOT NULL CHECK (amount >= 0),
  currency TEXT NOT NULL,
  exchange_rate NUMERIC(18,6) DEFAULT 1,
  converted_amount NUMERIC(18,4) NOT NULL CHECK (converted_amount >= 0),
  payment_date DATE,
  payment_method TEXT,
  account_id UUID REFERENCES accounts(id) ON DELETE SET NULL,
  tax_amount NUMERIC(18,4) DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','invoice_created','payment_pending','advance_payment','partially_paid','fully_paid','overdue','cancelled','refunded')),
  description TEXT,
  added_by UUID REFERENCES users(id) ON DELETE SET NULL,
  approved_by UUID REFERENCES users(id) ON DELETE SET NULL,
  deleted_at TIMESTAMPTZ,
  deleted_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_income_company ON income(company_id);
CREATE INDEX IF NOT EXISTS idx_income_status ON income(status);

-- INCOME PAYMENTS
CREATE TABLE IF NOT EXISTS income_payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  income_id UUID NOT NULL REFERENCES income(id) ON DELETE CASCADE,
  amount NUMERIC(18,4) NOT NULL CHECK (amount > 0),
  currency TEXT NOT NULL,
  exchange_rate NUMERIC(18,6) DEFAULT 1,
  payment_date DATE NOT NULL,
  payment_method TEXT,
  account_id UUID REFERENCES accounts(id) ON DELETE SET NULL,
  notes TEXT,
  recorded_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- EXPENSES
CREATE TABLE IF NOT EXISTS expenses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  category TEXT NOT NULL,
  department_id UUID REFERENCES departments(id) ON DELETE SET NULL,
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
  vendor_id UUID REFERENCES vendors(id) ON DELETE SET NULL,
  amount NUMERIC(18,4) NOT NULL CHECK (amount >= 0),
  currency TEXT NOT NULL,
  exchange_rate NUMERIC(18,6) DEFAULT 1,
  converted_amount NUMERIC(18,4) NOT NULL CHECK (converted_amount >= 0),
  expense_date DATE NOT NULL,
  payment_method TEXT,
  account_id UUID REFERENCES accounts(id) ON DELETE SET NULL,
  is_recurring BOOLEAN DEFAULT FALSE,
  recurrence TEXT CHECK (recurrence IN ('daily','weekly','monthly','quarterly','annually')),
  tax_amount NUMERIC(18,4) DEFAULT 0,
  description TEXT,
  business_purpose TEXT,
  related_employee UUID REFERENCES users(id) ON DELETE SET NULL,
  submitted_by UUID REFERENCES users(id) ON DELETE SET NULL,
  approved_by UUID REFERENCES users(id) ON DELETE SET NULL,
  approval_date TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','submitted','under_review','approved','rejected','paid','partially_paid','reimbursement_pending','reimbursed','cancelled')),
  deleted_at TIMESTAMPTZ,
  deleted_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_expenses_company ON expenses(company_id);
CREATE INDEX IF NOT EXISTS idx_expenses_status ON expenses(status);

-- APPROVALS
CREATE TABLE IF NOT EXISTS approvals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  expense_id UUID NOT NULL REFERENCES expenses(id) ON DELETE CASCADE,
  approver_id UUID REFERENCES users(id) ON DELETE SET NULL,
  action TEXT NOT NULL CHECK (action IN ('approved','rejected','request_changes','request_proof','forwarded')),
  comment TEXT,
  previous_status TEXT,
  new_status TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- DOCUMENTS
CREATE TABLE IF NOT EXISTS documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,
  document_type TEXT NOT NULL CHECK (document_type IN ('receipt','invoice','screenshot','contract','po')),
  storage_path TEXT NOT NULL,
  original_filename TEXT NOT NULL,
  file_size INTEGER,
  mime_type TEXT,
  verification_status TEXT DEFAULT 'pending',
  expiry_date DATE,
  vendor_name_extracted TEXT,
  amount_extracted NUMERIC(18,4),
  date_extracted DATE,
  invoice_number_extracted TEXT,
  is_duplicate BOOLEAN DEFAULT FALSE,
  uploaded_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- PAYROLL
CREATE TABLE IF NOT EXISTS payroll (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  employee_id UUID REFERENCES users(id) ON DELETE SET NULL,
  department_id UUID REFERENCES departments(id) ON DELETE SET NULL,
  basic_salary NUMERIC(18,4) NOT NULL,
  bonus NUMERIC(18,4) DEFAULT 0,
  commission NUMERIC(18,4) DEFAULT 0,
  overtime NUMERIC(18,4) DEFAULT 0,
  allowance NUMERIC(18,4) DEFAULT 0,
  deduction NUMERIC(18,4) DEFAULT 0,
  loan_deduction NUMERIC(18,4) DEFAULT 0,
  advance_deduction NUMERIC(18,4) DEFAULT 0,
  tax NUMERIC(18,4) DEFAULT 0,
  net_salary NUMERIC(18,4) NOT NULL,
  payment_date DATE,
  account_id UUID REFERENCES accounts(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','approved','paid','cancelled')),
  processed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_payroll_company ON payroll(company_id);

-- ADVANCES
CREATE TABLE IF NOT EXISTS advances (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  employee_id UUID REFERENCES users(id) ON DELETE SET NULL,
  amount NUMERIC(18,4) NOT NULL,
  purpose TEXT NOT NULL,
  date_issued DATE,
  approved_by UUID REFERENCES users(id) ON DELETE SET NULL,
  approval_date TIMESTAMPTZ,
  amount_used NUMERIC(18,4) DEFAULT 0,
  remaining_amount NUMERIC(18,4) NOT NULL,
  settlement_type TEXT CHECK (settlement_type IN ('salary_deduction','refund')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','issued','partially_settled','fully_settled','cancelled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- SUBSCRIPTIONS
CREATE TABLE IF NOT EXISTS subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  tool_name TEXT NOT NULL,
  vendor_id UUID REFERENCES vendors(id) ON DELETE SET NULL,
  plan_name TEXT,
  seats INTEGER DEFAULT 1,
  cost_per_seat NUMERIC(18,4),
  total_cost NUMERIC(18,4) NOT NULL,
  currency TEXT NOT NULL,
  billing_cycle TEXT NOT NULL CHECK (billing_cycle IN ('monthly','quarterly','annually')),
  start_date DATE,
  renewal_date DATE NOT NULL,
  trial_expiry_date DATE,
  department_id UUID REFERENCES departments(id) ON DELETE SET NULL,
  account_id UUID REFERENCES accounts(id) ON DELETE SET NULL,
  owner_id UUID REFERENCES users(id) ON DELETE SET NULL,
  login_email TEXT,
  auto_renew BOOLEAN DEFAULT TRUE,
  status TEXT DEFAULT 'active' CHECK (status IN ('active','cancelled','paused')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_subscriptions_company ON subscriptions(company_id);

-- BUDGETS
CREATE TABLE IF NOT EXISTS budgets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  budget_type TEXT NOT NULL CHECK (budget_type IN ('company','department','project','campaign','subscription','marketing','hiring','equipment')),
  entity_id UUID,
  amount NUMERIC(18,4) NOT NULL,
  currency TEXT NOT NULL,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  spent_amount NUMERIC(18,4) DEFAULT 0,
  alert_threshold_1 INTEGER DEFAULT 70,
  alert_threshold_2 INTEGER DEFAULT 90,
  alert_threshold_3 INTEGER DEFAULT 100,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_budgets_company ON budgets(company_id);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendors ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE income ENABLE ROW LEVEL SECURITY;
ALTER TABLE income_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE payroll ENABLE ROW LEVEL SECURITY;
ALTER TABLE advances ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE budgets ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to avoid conflicts
DO $$ DECLARE r RECORD;
BEGIN
  FOR r IN SELECT schemaname, tablename, policyname FROM pg_policies WHERE schemaname = 'public'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', r.policyname, r.schemaname, r.tablename);
  END LOOP;
END $$;

-- Helper: get current user's company
CREATE OR REPLACE FUNCTION get_my_company_id()
RETURNS UUID LANGUAGE sql SECURITY DEFINER STABLE AS
$$ SELECT company_id FROM public.users WHERE id = auth.uid() $$;

-- Allow setup: unauthenticated inserts for first-time company+user creation
-- (Controlled by the API route which verifies the session token)
CREATE POLICY "allow_setup_company" ON companies FOR INSERT WITH CHECK (true);
CREATE POLICY "allow_setup_user" ON users FOR INSERT WITH CHECK (id = auth.uid());

-- Company: owners can read/update
CREATE POLICY "company_select" ON companies FOR SELECT USING (id = get_my_company_id());
CREATE POLICY "company_update" ON companies FOR UPDATE USING (id = get_my_company_id());

-- Users: company members can read
CREATE POLICY "users_select" ON users FOR SELECT USING (company_id = get_my_company_id());
CREATE POLICY "users_all" ON users FOR ALL USING (company_id = get_my_company_id());

-- All financial tables: company isolation
CREATE POLICY "departments_all" ON departments FOR ALL USING (company_id = get_my_company_id());
CREATE POLICY "accounts_all" ON accounts FOR ALL USING (company_id = get_my_company_id());
CREATE POLICY "audit_logs_all" ON audit_logs FOR ALL USING (company_id = get_my_company_id());
CREATE POLICY "notifications_all" ON notifications FOR ALL USING (company_id = get_my_company_id());
CREATE POLICY "clients_all" ON clients FOR ALL USING (company_id = get_my_company_id());
CREATE POLICY "vendors_all" ON vendors FOR ALL USING (company_id = get_my_company_id());
CREATE POLICY "projects_all" ON projects FOR ALL USING (company_id = get_my_company_id());
CREATE POLICY "income_all" ON income FOR ALL USING (company_id = get_my_company_id());
CREATE POLICY "income_payments_all" ON income_payments FOR ALL USING (
  income_id IN (SELECT id FROM income WHERE company_id = get_my_company_id())
);
CREATE POLICY "expenses_all" ON expenses FOR ALL USING (company_id = get_my_company_id());
CREATE POLICY "approvals_all" ON approvals FOR ALL USING (
  expense_id IN (SELECT id FROM expenses WHERE company_id = get_my_company_id())
);
CREATE POLICY "documents_all" ON documents FOR ALL USING (company_id = get_my_company_id());
CREATE POLICY "payroll_all" ON payroll FOR ALL USING (company_id = get_my_company_id());
CREATE POLICY "advances_all" ON advances FOR ALL USING (company_id = get_my_company_id());
CREATE POLICY "subscriptions_all" ON subscriptions FOR ALL USING (company_id = get_my_company_id());
CREATE POLICY "budgets_all" ON budgets FOR ALL USING (company_id = get_my_company_id());
