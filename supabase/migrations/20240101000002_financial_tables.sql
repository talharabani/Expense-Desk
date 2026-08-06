-- =============================================================================
-- Migration: 002 Financial Entity Tables
-- Tables: clients, vendors, projects, income, income_payments, expenses, approvals, documents
-- Requirements: 3.1, 4.1, 5.8, 6.5, 13.1, 14.1
-- =============================================================================

-- ---------------------------------------------------------------------------
-- clients
-- ---------------------------------------------------------------------------
CREATE TABLE clients (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  company_name TEXT,
  contact_person TEXT,
  phone TEXT,
  email TEXT,
  industry TEXT,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_clients_company ON clients(company_id);

-- ---------------------------------------------------------------------------
-- vendors
-- ---------------------------------------------------------------------------
CREATE TABLE vendors (
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
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'blocked')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_vendors_company ON vendors(company_id);

-- ---------------------------------------------------------------------------
-- projects
-- ---------------------------------------------------------------------------
CREATE TABLE projects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
  project_type TEXT CHECK (project_type IN ('software', 'campaign', 'load', 'general')),
  start_date DATE,
  end_date DATE,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed', 'on_hold', 'cancelled')),
  total_revenue NUMERIC(18,4) DEFAULT 0,
  total_expenses NUMERIC(18,4) DEFAULT 0,
  profit NUMERIC(18,4) DEFAULT 0,
  profit_margin NUMERIC(8,4) DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_projects_company ON projects(company_id);
CREATE INDEX idx_projects_client ON projects(client_id);

-- ---------------------------------------------------------------------------
-- income
-- ---------------------------------------------------------------------------
CREATE TABLE income (
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
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN (
    'draft', 'invoice_created', 'payment_pending', 'partially_paid',
    'fully_paid', 'overdue', 'cancelled', 'refunded'
  )),
  description TEXT,
  added_by UUID NOT NULL REFERENCES users(id) ON DELETE SET NULL,
  approved_by UUID REFERENCES users(id) ON DELETE SET NULL,
  deleted_at TIMESTAMPTZ,
  deleted_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_income_company ON income(company_id);
CREATE INDEX idx_income_client ON income(client_id);
CREATE INDEX idx_income_project ON income(project_id);
CREATE INDEX idx_income_status ON income(status);
CREATE INDEX idx_income_payment_date ON income(payment_date DESC);

-- ---------------------------------------------------------------------------
-- income_payments
-- Tracks partial payments against an income record
-- ---------------------------------------------------------------------------
CREATE TABLE income_payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  income_id UUID NOT NULL REFERENCES income(id) ON DELETE CASCADE,
  amount NUMERIC(18,4) NOT NULL CHECK (amount > 0),
  currency TEXT NOT NULL,
  exchange_rate NUMERIC(18,6) DEFAULT 1,
  payment_date DATE NOT NULL,
  payment_method TEXT,
  account_id UUID REFERENCES accounts(id) ON DELETE SET NULL,
  notes TEXT,
  recorded_by UUID NOT NULL REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_income_payments_income ON income_payments(income_id);

-- ---------------------------------------------------------------------------
-- expenses
-- ---------------------------------------------------------------------------
CREATE TABLE expenses (
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
  recurrence TEXT CHECK (recurrence IN ('daily', 'weekly', 'monthly', 'quarterly', 'annually')),
  tax_amount NUMERIC(18,4) DEFAULT 0,
  description TEXT,
  business_purpose TEXT,
  related_employee UUID REFERENCES users(id) ON DELETE SET NULL,
  submitted_by UUID NOT NULL REFERENCES users(id) ON DELETE SET NULL,
  approved_by UUID REFERENCES users(id) ON DELETE SET NULL,
  approval_date TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN (
    'draft', 'submitted', 'under_review', 'approved', 'rejected',
    'paid', 'partially_paid', 'reimbursement_pending', 'reimbursed', 'cancelled'
  )),
  deleted_at TIMESTAMPTZ,
  deleted_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_expenses_company ON expenses(company_id);
CREATE INDEX idx_expenses_department ON expenses(department_id);
CREATE INDEX idx_expenses_project ON expenses(project_id);
CREATE INDEX idx_expenses_vendor ON expenses(vendor_id);
CREATE INDEX idx_expenses_status ON expenses(status);
CREATE INDEX idx_expenses_submitted_by ON expenses(submitted_by);
CREATE INDEX idx_expenses_expense_date ON expenses(expense_date DESC);

-- ---------------------------------------------------------------------------
-- approvals
-- Tracks each approval step for an expense
-- ---------------------------------------------------------------------------
CREATE TABLE approvals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  expense_id UUID NOT NULL REFERENCES expenses(id) ON DELETE CASCADE,
  approver_id UUID NOT NULL REFERENCES users(id) ON DELETE SET NULL,
  action TEXT NOT NULL CHECK (action IN ('approved', 'rejected', 'request_changes', 'request_proof', 'forwarded')),
  comment TEXT,
  previous_status TEXT,
  new_status TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_approvals_expense ON approvals(expense_id);
CREATE INDEX idx_approvals_approver ON approvals(approver_id);

-- ---------------------------------------------------------------------------
-- documents
-- Receipts, invoices, screenshots attached to transactions
-- ---------------------------------------------------------------------------
CREATE TABLE documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,
  document_type TEXT NOT NULL CHECK (document_type IN ('receipt', 'invoice', 'screenshot', 'contract', 'po')),
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
  uploaded_by UUID NOT NULL REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_documents_entity ON documents(entity_type, entity_id);
CREATE INDEX idx_documents_company ON documents(company_id);
CREATE INDEX idx_documents_duplicate ON documents(company_id, vendor_name_extracted, amount_extracted, date_extracted);

-- ---------------------------------------------------------------------------
-- RLS Policies
-- ---------------------------------------------------------------------------
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendors ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE income ENABLE ROW LEVEL SECURITY;
ALTER TABLE income_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY company_isolation_policy ON clients FOR ALL USING (
  company_id IN (SELECT company_id FROM users WHERE id = auth.uid())
);
CREATE POLICY company_isolation_policy ON vendors FOR ALL USING (
  company_id IN (SELECT company_id FROM users WHERE id = auth.uid())
);
CREATE POLICY company_isolation_policy ON projects FOR ALL USING (
  company_id IN (SELECT company_id FROM users WHERE id = auth.uid())
);
CREATE POLICY company_isolation_policy ON income FOR ALL USING (
  company_id IN (SELECT company_id FROM users WHERE id = auth.uid())
  AND deleted_at IS NULL
);
CREATE POLICY company_isolation_policy ON income_payments FOR ALL USING (
  income_id IN (SELECT id FROM income WHERE company_id IN (SELECT company_id FROM users WHERE id = auth.uid()))
);
CREATE POLICY company_isolation_policy ON expenses FOR ALL USING (
  company_id IN (SELECT company_id FROM users WHERE id = auth.uid())
  AND deleted_at IS NULL
);

-- Employees can only see their own submissions
CREATE POLICY employee_own_expenses ON expenses FOR SELECT USING (
  submitted_by = auth.uid()
  OR company_id IN (
    SELECT company_id FROM users
    WHERE id = auth.uid() AND role IN ('owner', 'finance_manager', 'manager', 'team_lead', 'auditor')
  )
);

CREATE POLICY company_isolation_policy ON approvals FOR ALL USING (
  expense_id IN (SELECT id FROM expenses WHERE company_id IN (SELECT company_id FROM users WHERE id = auth.uid()))
);
CREATE POLICY company_isolation_policy ON documents FOR ALL USING (
  company_id IN (SELECT company_id FROM users WHERE id = auth.uid())
);
