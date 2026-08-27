-- =============================================================================
-- Migration: 001 Core Tables
-- Tables: companies, users, departments, accounts, audit_logs, notifications
-- Requirements: 1.3, 7.1, 7.2, 18.1
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Enable UUID generation
-- ---------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ---------------------------------------------------------------------------
-- companies
-- The top-level tenant entity. Every other table references this via company_id.
-- ---------------------------------------------------------------------------
CREATE TABLE companies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  base_currency TEXT NOT NULL DEFAULT 'PKR',
  industry_type TEXT CHECK (industry_type IN ('software_house', 'call_center', 'truck_dispatching', 'general')),
  timezone TEXT NOT NULL DEFAULT 'UTC',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- users
-- Extends Supabase auth.users with business metadata
-- ---------------------------------------------------------------------------
CREATE TABLE users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('owner', 'finance_manager', 'manager', 'team_lead', 'employee', 'auditor')),
  department_id UUID,
  is_active BOOLEAN DEFAULT TRUE,
  two_fa_enabled BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_users_company ON users(company_id);
CREATE INDEX idx_users_email ON users(email);

-- ---------------------------------------------------------------------------
-- departments
-- ---------------------------------------------------------------------------
CREATE TABLE departments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  manager_id UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_departments_company ON departments(company_id);

-- Add FK from users to departments (deferred because departments references users)
ALTER TABLE users ADD CONSTRAINT users_department_fk FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE SET NULL;

-- ---------------------------------------------------------------------------
-- accounts
-- Financial accounts (bank, cash, digital wallets, etc.)
-- ---------------------------------------------------------------------------
CREATE TABLE accounts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  account_type TEXT NOT NULL CHECK (account_type IN ('petty_cash', 'bank', 'personal', 'credit_card', 'debit_card', 'digital_wallet')),
  currency TEXT NOT NULL,
  opening_balance NUMERIC(18,4) DEFAULT 0,
  current_balance NUMERIC(18,4) DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_accounts_company ON accounts(company_id);

-- ---------------------------------------------------------------------------
-- audit_logs
-- Complete audit trail for all financial changes
-- ---------------------------------------------------------------------------
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE SET NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('created', 'updated', 'deleted', 'approved', 'rejected')),
  previous_value JSONB,
  new_value JSONB,
  ip_address INET,
  device_info TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_logs_company ON audit_logs(company_id);
CREATE INDEX idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at DESC);

-- ---------------------------------------------------------------------------
-- notifications
-- ---------------------------------------------------------------------------
CREATE TABLE notifications (
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

CREATE INDEX idx_notifications_user ON notifications(user_id, is_read);
CREATE INDEX idx_notifications_created_at ON notifications(created_at DESC);

-- ---------------------------------------------------------------------------
-- Row-Level Security (RLS)
-- All tables enforce multi-tenant isolation via company_id
-- ---------------------------------------------------------------------------
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- RLS Policy: users can only see data from their own company
CREATE POLICY company_isolation_policy ON companies FOR ALL USING (
  id IN (SELECT company_id FROM users WHERE id = auth.uid())
);

CREATE POLICY company_isolation_policy ON users FOR ALL USING (
  company_id IN (SELECT company_id FROM users WHERE id = auth.uid())
);

CREATE POLICY company_isolation_policy ON departments FOR ALL USING (
  company_id IN (SELECT company_id FROM users WHERE id = auth.uid())
);

CREATE POLICY company_isolation_policy ON accounts FOR ALL USING (
  company_id IN (SELECT company_id FROM users WHERE id = auth.uid())
);

CREATE POLICY company_isolation_policy ON audit_logs FOR ALL USING (
  company_id IN (SELECT company_id FROM users WHERE id = auth.uid())
);

CREATE POLICY company_isolation_policy ON notifications FOR ALL USING (
  company_id IN (SELECT company_id FROM users WHERE id = auth.uid())
);