-- Simulate Supabase/PostgREST auth.uid() function for native PostgreSQL
CREATE SCHEMA IF NOT EXISTS auth;
CREATE OR REPLACE FUNCTION auth.uid() RETURNS UUID AS $$
  SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::UUID;
$$ LANGUAGE sql STABLE;

CREATE TABLE transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    date DATE NOT NULL,
    currency CHAR(3) DEFAULT 'USD',
    amount_cents BIGINT NOT NULL, -- Opaque integer storage
    withholding_cents BIGINT DEFAULT 0,
    actual_idr_received_cents BIGINT,
    kmk_rate NUMERIC(15, 2), -- Official DJP rate for that week
    is_1042s_verified BOOLEAN DEFAULT FALSE,
    verified_at TIMESTAMP WITH TIME ZONE,
    metadata JSONB, -- Stores raw CSV headers for audit
    unspent_usd_cents BIGINT NOT NULL DEFAULT 0 CHECK (unspent_usd_cents >= 0),
    historical_kmk_rate_cents BIGINT NOT NULL DEFAULT 0
);

-- RLS Guard
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY user_isolation_policy ON transactions
USING (user_id = auth.uid());

CREATE TABLE field_mappings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    source_field TEXT NOT NULL,
    target_field TEXT NOT NULL,
    confidence DOUBLE PRECISION NOT NULL,
    user_verified BOOLEAN DEFAULT FALSE,
    matcher_version TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, source_field, target_field)
);

ALTER TABLE field_mappings ENABLE ROW LEVEL SECURITY;
CREATE POLICY field_mappings_isolation_policy ON field_mappings
USING (user_id = auth.uid());
