-- =============================================================================
-- Migration: 003 Supporting Entity Tables
-- Tables: payroll, advances, subscriptions, budgets
-- Requirements: 9.1, 10.1, 11.1, 12.2
-- =============================================================================

-- ---------------------------------------------------------------------------
-- payroll
-- ---------------------------------------------------------------------------
CREATE TABLE payroll (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  employee
)