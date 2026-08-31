-- ============================================================
-- Close the cross-company hole in the first-run setup policies.
--
-- The original policies were written so the browser could bootstrap a company
-- and profile directly:
--
--   CREATE POLICY "allow_setup_company" ON companies
--     FOR INSERT WITH CHECK (true);
--   CREATE POLICY "allow_setup_user"    ON users
--     FOR INSERT WITH CHECK (id = auth.uid());
--
-- Both are unsafe, and neither is used any more — /api/setup performs those two
-- inserts with the service role key, which bypasses RLS altogether.
--
-- "allow_setup_user" constrains the row's id but never its company_id. Any
-- authenticated user without a profile row could therefore insert one naming
-- somebody else's company. get_my_company_id() reads exactly that column, so
-- every other policy would then hand them that company's expenses, payroll,
-- clients and audit log. Dropping it removes the only way to choose your own
-- company_id.
--
-- "allow_setup_company" allows an unrestricted insert into companies, so anyone
-- holding the anon key — which ships in the browser bundle — could create rows
-- at will.
--
-- Safe to run more than once.
-- ============================================================

DROP POLICY IF EXISTS "allow_setup_company" ON companies;
DROP POLICY IF EXISTS "allow_setup_user" ON users;

-- Leaves in place, from the base migration:
--   companies : company_select / company_update, both scoped to get_my_company_id()
--   users     : users_select / users_all,        both scoped to get_my_company_id()
--
-- A user with no profile row now matches no policy on `users`, so they can read
-- nothing and insert nothing. That is correct: only /api/setup, holding the
-- service role key, may create that first row.

-- Verify afterwards — this should return no rows:
--
--   SELECT tablename, policyname, cmd, qual, with_check
--   FROM pg_policies
--   WHERE schemaname = 'public'
--     AND policyname IN ('allow_setup_company', 'allow_setup_user');
