-- ============================================================================
-- SUPABASE DATABASE MIGRATION: STRICT MULTI-TENANCY ISOLATION BY LINE_ID & LINE_CODE
-- Target Tables: clients, billing_months, billing_rows, billing, invoices, users_data, complaints
-- ============================================================================

-- STEP 1: ENSURE LINE COLUMNS EXIST (UUID & TEXT)
-- ----------------------------------------------------------------------------
DO $$ 
BEGIN
    -- 1.1 clients table
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'clients') THEN
        ALTER TABLE clients ADD COLUMN IF NOT EXISTS line_id UUID;
        ALTER TABLE clients ADD COLUMN IF NOT EXISTS line_code TEXT;
    END IF;

    -- 1.2 billing_months table
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'billing_months') THEN
        ALTER TABLE billing_months ADD COLUMN IF NOT EXISTS line_id UUID;
        ALTER TABLE billing_months ADD COLUMN IF NOT EXISTS line_code TEXT;
    END IF;

    -- 1.3 billing_rows table
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'billing_rows') THEN
        ALTER TABLE billing_rows ADD COLUMN IF NOT EXISTS line_id UUID;
        ALTER TABLE billing_rows ADD COLUMN IF NOT EXISTS line_code TEXT;
    END IF;

    -- 1.4 billing table (if present)
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'billing') THEN
        ALTER TABLE billing ADD COLUMN IF NOT EXISTS line_id UUID;
        ALTER TABLE billing ADD COLUMN IF NOT EXISTS line_code TEXT;
    END IF;

    -- 1.5 invoices table (if present)
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'invoices') THEN
        ALTER TABLE invoices ADD COLUMN IF NOT EXISTS line_id UUID;
        ALTER TABLE invoices ADD COLUMN IF NOT EXISTS line_code TEXT;
    END IF;

    -- 1.6 users_data table
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'users_data') THEN
        ALTER TABLE users_data ADD COLUMN IF NOT EXISTS line_id UUID;
        ALTER TABLE users_data ADD COLUMN IF NOT EXISTS line_code TEXT;
    END IF;

    -- 1.7 complaints table
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'complaints') THEN
        ALTER TABLE complaints ADD COLUMN IF NOT EXISTS line_id UUID;
        ALTER TABLE complaints ADD COLUMN IF NOT EXISTS line_code TEXT;
    END IF;
END $$;

-- ----------------------------------------------------------------------------
-- STEP 2: HIGH-PERFORMANCE B-TREE INDEXES
-- ----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_clients_line_id ON clients (line_id);
CREATE INDEX IF NOT EXISTS idx_clients_line_code ON clients (line_code);
CREATE INDEX IF NOT EXISTS idx_clients_line_composite ON clients (line_id, line_code);

CREATE INDEX IF NOT EXISTS idx_billing_months_line_id ON billing_months (line_id);
CREATE INDEX IF NOT EXISTS idx_billing_months_line_code ON billing_months (line_code);

CREATE INDEX IF NOT EXISTS idx_billing_rows_line_id ON billing_rows (line_id);
CREATE INDEX IF NOT EXISTS idx_billing_rows_line_code ON billing_rows (line_code);
CREATE INDEX IF NOT EXISTS idx_billing_rows_month_line ON billing_rows (month_id, line_code);

DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'billing') THEN
        CREATE INDEX IF NOT EXISTS idx_billing_line_id ON billing (line_id);
        CREATE INDEX IF NOT EXISTS idx_billing_line_code ON billing (line_code);
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'invoices') THEN
        CREATE INDEX IF NOT EXISTS idx_invoices_line_id ON invoices (line_id);
        CREATE INDEX IF NOT EXISTS idx_invoices_line_code ON invoices (line_code);
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_users_data_line_id ON users_data (line_id);
CREATE INDEX IF NOT EXISTS idx_users_data_line_code ON users_data (line_code);

CREATE INDEX IF NOT EXISTS idx_complaints_line_id ON complaints (line_id);
CREATE INDEX IF NOT EXISTS idx_complaints_line_code ON complaints (line_code);

-- ----------------------------------------------------------------------------
-- STEP 3: BACKFILL LINE_CODE / LINE_ID FROM ASSOCIATED USERS / CLIENTS
-- ----------------------------------------------------------------------------
-- 3.1 Backfill clients line_code if empty based on dealer users
UPDATE clients c
SET 
  line_code = u.line_code,
  line_id = u.line_id
FROM users_data u
WHERE (c.line_code IS NULL OR c.line_code = '')
  AND c.dealer_id IS NOT NULL 
  AND c.dealer_id != 'main'
  AND (c.dealer_id = u.id OR c.dealer_id = u.uid)
  AND u.line_code IS NOT NULL AND u.line_code != '';

-- 3.2 Backfill billing_rows from matching client
UPDATE billing_rows r
SET 
  line_code = c.line_code,
  line_id = c.line_id
FROM clients c
WHERE (r.line_code IS NULL OR r.line_code = '')
  AND (r.client_id = c.id OR (r.username = c.username AND r.username IS NOT NULL AND r.username != ''))
  AND c.line_code IS NOT NULL AND c.line_code != '';

-- 3.3 Backfill complaints from matching client
UPDATE complaints comp
SET 
  line_code = c.line_code,
  line_id = c.line_id
FROM clients c
WHERE (comp.line_code IS NULL OR comp.line_code = '')
  AND (comp.username = c.username AND comp.username IS NOT NULL AND comp.username != '')
  AND c.line_code IS NOT NULL AND c.line_code != '';

-- ----------------------------------------------------------------------------
-- STEP 4: TENANT CONTEXT HELPER FUNCTIONS FOR ROW-LEVEL SECURITY
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION get_current_user_role()
RETURNS TEXT LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT COALESCE(
    (current_setting('request.jwt.claims', true)::jsonb -> 'app_metadata' ->> 'role'),
    (current_setting('request.jwt.claims', true)::jsonb -> 'user_metadata' ->> 'role'),
    (SELECT role FROM users_data WHERE id = auth.uid()::text OR uid = auth.uid()::text LIMIT 1),
    'authenticated'
  );
$$;

CREATE OR REPLACE FUNCTION get_current_user_line_code()
RETURNS TEXT LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT COALESCE(
    (current_setting('request.jwt.claims', true)::jsonb -> 'user_metadata' ->> 'line_code'),
    (SELECT line_code FROM users_data WHERE id = auth.uid()::text OR uid = auth.uid()::text LIMIT 1),
    ''
  );
$$;

CREATE OR REPLACE FUNCTION get_current_user_line_id()
RETURNS UUID LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT COALESCE(
    NULLIF((current_setting('request.jwt.claims', true)::jsonb -> 'user_metadata' ->> 'line_id'), '')::uuid,
    (SELECT line_id FROM users_data WHERE (id = auth.uid()::text OR uid = auth.uid()::text) AND line_id IS NOT NULL LIMIT 1)
  );
$$;

CREATE OR REPLACE FUNCTION is_super_admin()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT get_current_user_role() IN ('super_admin', 'admin', 'service_role');
$$;

-- ----------------------------------------------------------------------------
-- STEP 5: ROW-LEVEL SECURITY (RLS) POLICIES
-- ----------------------------------------------------------------------------

-- Enable RLS
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE billing_months ENABLE ROW LEVEL SECURITY;
ALTER TABLE billing_rows ENABLE ROW LEVEL SECURITY;
ALTER TABLE users_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE complaints ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'billing') THEN
        ALTER TABLE billing ENABLE ROW LEVEL SECURITY;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'invoices') THEN
        ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
    END IF;
END $$;

-- 5.1 CLIENTS RLS
DROP POLICY IF EXISTS "strict_clients_isolation_policy" ON clients;
CREATE POLICY "strict_clients_isolation_policy" ON clients
FOR ALL USING (
    is_super_admin()
    OR (
        -- Sub-dealer / Line Admin can ONLY access their own line
        get_current_user_line_code() <> '' 
        AND (
            line_code = get_current_user_line_code()
            OR (get_current_user_line_id() IS NOT NULL AND line_id = get_current_user_line_id())
        )
    )
    OR (
        -- Unassigned / Without Line user ONLY accesses records without line
        get_current_user_line_code() = ''
        AND (line_code IS NULL OR line_code = '')
        AND line_id IS NULL
    )
) WITH CHECK (
    is_super_admin()
    OR (
        get_current_user_line_code() <> '' 
        AND (
            line_code = get_current_user_line_code()
            OR (get_current_user_line_id() IS NOT NULL AND line_id = get_current_user_line_id())
        )
    )
    OR (
        get_current_user_line_code() = ''
        AND (line_code IS NULL OR line_code = '')
        AND line_id IS NULL
    )
);

-- 5.2 BILLING_ROWS RLS
DROP POLICY IF EXISTS "strict_billing_rows_isolation_policy" ON billing_rows;
CREATE POLICY "strict_billing_rows_isolation_policy" ON billing_rows
FOR ALL USING (
    is_super_admin()
    OR (
        get_current_user_line_code() <> '' 
        AND (
            line_code = get_current_user_line_code()
            OR (get_current_user_line_id() IS NOT NULL AND line_id = get_current_user_line_id())
        )
    )
    OR (
        get_current_user_line_code() = ''
        AND (line_code IS NULL OR line_code = '')
        AND line_id IS NULL
    )
) WITH CHECK (
    is_super_admin()
    OR (
        get_current_user_line_code() <> '' 
        AND (
            line_code = get_current_user_line_code()
            OR (get_current_user_line_id() IS NOT NULL AND line_id = get_current_user_line_id())
        )
    )
    OR (
        get_current_user_line_code() = ''
        AND (line_code IS NULL OR line_code = '')
        AND line_id IS NULL
    )
);

-- 5.3 BILLING_MONTHS RLS
DROP POLICY IF EXISTS "strict_billing_months_isolation_policy" ON billing_months;
CREATE POLICY "strict_billing_months_isolation_policy" ON billing_months
FOR ALL USING (
    is_super_admin()
    OR (
        get_current_user_line_code() <> '' 
        AND (
            line_code = get_current_user_line_code()
            OR (get_current_user_line_id() IS NOT NULL AND line_id = get_current_user_line_id())
            OR EXISTS (
                SELECT 1 FROM billing_rows br 
                WHERE br.month_id = billing_months.id 
                  AND br.line_code = get_current_user_line_code()
            )
        )
    )
    OR (
        get_current_user_line_code() = ''
        AND (line_code IS NULL OR line_code = '')
        AND line_id IS NULL
    )
) WITH CHECK (
    is_super_admin()
    OR (
        get_current_user_line_code() <> '' 
        AND (
            line_code = get_current_user_line_code()
            OR (get_current_user_line_id() IS NOT NULL AND line_id = get_current_user_line_id())
        )
    )
    OR (
        get_current_user_line_code() = ''
        AND (line_code IS NULL OR line_code = '')
        AND line_id IS NULL
    )
);

-- 5.4 USERS_DATA RLS
DROP POLICY IF EXISTS "strict_users_data_isolation_policy" ON users_data;
CREATE POLICY "strict_users_data_isolation_policy" ON users_data
FOR ALL USING (
    is_super_admin()
    OR (
        get_current_user_line_code() <> '' 
        AND (
            line_code = get_current_user_line_code()
            OR (get_current_user_line_id() IS NOT NULL AND line_id = get_current_user_line_id())
        )
    )
    OR (
        get_current_user_line_code() = ''
        AND (line_code IS NULL OR line_code = '')
        AND line_id IS NULL
    )
) WITH CHECK (
    is_super_admin()
    OR (
        get_current_user_line_code() <> '' 
        AND (
            line_code = get_current_user_line_code()
            OR (get_current_user_line_id() IS NOT NULL AND line_id = get_current_user_line_id())
        )
    )
    OR (
        get_current_user_line_code() = ''
        AND (line_code IS NULL OR line_code = '')
        AND line_id IS NULL
    )
);

-- 5.5 COMPLAINTS RLS
DROP POLICY IF EXISTS "strict_complaints_isolation_policy" ON complaints;
CREATE POLICY "strict_complaints_isolation_policy" ON complaints
FOR ALL USING (
    is_super_admin()
    OR (
        get_current_user_line_code() <> '' 
        AND (
            line_code = get_current_user_line_code()
            OR (get_current_user_line_id() IS NOT NULL AND line_id = get_current_user_line_id())
        )
    )
    OR (
        get_current_user_line_code() = ''
        AND (line_code IS NULL OR line_code = '')
        AND line_id IS NULL
    )
) WITH CHECK (
    is_super_admin()
    OR (
        get_current_user_line_code() <> '' 
        AND (
            line_code = get_current_user_line_code()
            OR (get_current_user_line_id() IS NOT NULL AND line_id = get_current_user_line_id())
        )
    )
    OR (
        get_current_user_line_code() = ''
        AND (line_code IS NULL OR line_code = '')
        AND line_id IS NULL
    )
);
