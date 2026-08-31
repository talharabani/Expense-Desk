-- ============================================================
-- A table for the keep-alive ping to read.
--
-- Free Supabase projects pause after 7 days without database activity, and
-- unpausing is manual. A scheduled job reads one row from here every few days
-- so the project never reaches that point.
--
-- Why a dedicated table rather than pinging an existing one:
--
--   * Every business table is behind RLS keyed to the caller's company. The
--     anon key legitimately reads nothing from them, so a ping would return an
--     empty array and could not distinguish "database answered" from "policy
--     blocked me" — a broken ping would look healthy.
--   * This table holds no business data, so exposing one row to the anon role
--     costs nothing.
--
-- Safe to run more than once.
-- ============================================================

CREATE TABLE IF NOT EXISTS health_check (
  id INTEGER PRIMARY KEY DEFAULT 1,
  checked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT health_check_single_row CHECK (id = 1)
);

INSERT INTO health_check (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

ALTER TABLE health_check ENABLE ROW LEVEL SECURITY;

-- Readable by anyone holding the anon key, which already ships in the browser
-- bundle. Read-only: no insert, update or delete policy exists, so the row
-- cannot be changed through the API.
DROP POLICY IF EXISTS "health_check_read" ON health_check;
CREATE POLICY "health_check_read" ON health_check FOR SELECT USING (true);

-- Verify:  SELECT * FROM health_check;   -- one row, id = 1
