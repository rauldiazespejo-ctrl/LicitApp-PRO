-- ============================================================
-- licitapp CHILE - Esquema inicial de base de datos
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- ENUM TYPES
CREATE TYPE tender_status AS ENUM (
  'DRAFT', 'PUBLISHED', 'OPEN', 'CLOSED', 'AWARDED', 'CANCELLED', 'SUSPENDED'
);

CREATE TYPE tender_category AS ENUM (
  'GOODS', 'SERVICES', 'WORKS', 'CONSULTING', 'TECHNOLOGY', 'MINING', 'ENERGY', 'OTHER'
);

CREATE TYPE portal_source AS ENUM (
  'WHEREX', 'PORTAL_MINERO', 'SAP_ARIBA', 'SICEP', 'COUPA', 'CHILECOMPRA'
);

CREATE TYPE user_role AS ENUM (
  'SUPER_ADMIN', 'ADMIN', 'ANALYST', 'VIEWER'
);

CREATE TYPE tenant_plan AS ENUM (
  'FREE', 'STARTER', 'PROFESSIONAL', 'ENTERPRISE'
);

CREATE TYPE sync_job_status AS ENUM (
  'PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED'
);

CREATE TYPE sync_job_type AS ENUM (
  'FULL', 'INCREMENTAL', 'SINGLE'
);

-- TENANTS
CREATE TABLE tenants (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name           VARCHAR(255) NOT NULL,
  slug           VARCHAR(100) UNIQUE NOT NULL,
  plan           tenant_plan NOT NULL DEFAULT 'FREE',
  is_active      BOOLEAN NOT NULL DEFAULT true,
  settings       JSONB NOT NULL DEFAULT '{}',
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_tenants_slug ON tenants(slug);
CREATE INDEX idx_tenants_active ON tenants(is_active);

-- USERS
CREATE TABLE users (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id      UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  email          VARCHAR(255) NOT NULL UNIQUE,
  name           VARCHAR(255) NOT NULL,
  password_hash  VARCHAR(255) NOT NULL,
  role           user_role NOT NULL DEFAULT 'VIEWER',
  is_active      BOOLEAN NOT NULL DEFAULT true,
  preferences    JSONB NOT NULL DEFAULT '{}',
  last_login_at  TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_users_tenant ON users(tenant_id);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_active ON users(is_active, tenant_id);

-- TENDERS
CREATE TABLE tenders (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  external_id    VARCHAR(255) NOT NULL,
  source         portal_source NOT NULL,
  title          TEXT NOT NULL,
  description    TEXT,
  status         tender_status NOT NULL DEFAULT 'PUBLISHED',
  category       tender_category NOT NULL DEFAULT 'OTHER',
  subcategory    VARCHAR(255),
  buyer          JSONB NOT NULL DEFAULT '{}',
  budget         JSONB,
  published_at   TIMESTAMPTZ,
  opening_date   TIMESTAMPTZ,
  closing_date   TIMESTAMPTZ,
  award_date     TIMESTAMPTZ,
  documents      JSONB NOT NULL DEFAULT '[]',
  contacts       JSONB NOT NULL DEFAULT '[]',
  requirements   JSONB NOT NULL DEFAULT '[]',
  tags           JSONB NOT NULL DEFAULT '[]',
  regions        JSONB NOT NULL DEFAULT '[]',
  raw_data       JSONB,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  synced_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT tenders_external_id_source_unique UNIQUE (external_id, source)
);

CREATE INDEX idx_tenders_source ON tenders(source);
CREATE INDEX idx_tenders_status ON tenders(status);
CREATE INDEX idx_tenders_category ON tenders(category);
CREATE INDEX idx_tenders_published ON tenders(published_at DESC NULLS LAST);
CREATE INDEX idx_tenders_closing ON tenders(closing_date ASC NULLS LAST);
CREATE INDEX idx_tenders_synced ON tenders(synced_at DESC);
CREATE INDEX idx_tenders_buyer ON tenders USING GIN (buyer jsonb_path_ops);
CREATE INDEX idx_tenders_budget ON tenders USING GIN (budget jsonb_path_ops);
CREATE INDEX idx_tenders_regions ON tenders USING GIN (regions);
CREATE INDEX idx_tenders_tags ON tenders USING GIN (tags);
CREATE INDEX idx_tenders_title_trgm ON tenders USING GIN (title gin_trgm_ops);
CREATE INDEX idx_tenders_description_trgm ON tenders USING GIN (description gin_trgm_ops);

-- SAVED TENDERS (favoritos por usuario)
CREATE TABLE saved_tenders (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  tender_id   UUID NOT NULL REFERENCES tenders(id) ON DELETE CASCADE,
  notes       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT saved_tenders_user_tender_unique UNIQUE (user_id, tender_id)
);

CREATE INDEX idx_saved_tenders_user ON saved_tenders(user_id);
CREATE INDEX idx_saved_tenders_tenant ON saved_tenders(tenant_id);

-- TENDER ALERTS
CREATE TABLE tender_alerts (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id             UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tenant_id           UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name                VARCHAR(255) NOT NULL,
  keywords            JSONB NOT NULL DEFAULT '[]',
  sources             JSONB NOT NULL DEFAULT '[]',
  categories          JSONB NOT NULL DEFAULT '[]',
  regions             JSONB NOT NULL DEFAULT '[]',
  min_budget          NUMERIC(18,2),
  max_budget          NUMERIC(18,2),
  is_active           BOOLEAN NOT NULL DEFAULT true,
  notify_via_email    BOOLEAN NOT NULL DEFAULT true,
  notify_via_push     BOOLEAN NOT NULL DEFAULT false,
  last_triggered_at   TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_alerts_user ON tender_alerts(user_id);
CREATE INDEX idx_alerts_active ON tender_alerts(is_active, tenant_id);

-- SYNC JOBS
CREATE TABLE sync_jobs (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  source          portal_source NOT NULL,
  type            sync_job_type NOT NULL DEFAULT 'INCREMENTAL',
  status          sync_job_status NOT NULL DEFAULT 'PENDING',
  progress        INTEGER DEFAULT 0,
  started_at      TIMESTAMPTZ,
  completed_at    TIMESTAMPTZ,
  result          JSONB,
  error_message   TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_sync_jobs_source ON sync_jobs(source);
CREATE INDEX idx_sync_jobs_status ON sync_jobs(status);
CREATE INDEX idx_sync_jobs_created ON sync_jobs(created_at DESC);

-- NOTIFICATIONS
CREATE TABLE notifications (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  type        VARCHAR(50) NOT NULL,
  channel     VARCHAR(50) NOT NULL,
  title       VARCHAR(255) NOT NULL,
  body        TEXT NOT NULL,
  data        JSONB,
  read_at     TIMESTAMPTZ,
  sent_at     TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_notifications_user ON notifications(user_id, read_at);
CREATE INDEX idx_notifications_tenant ON notifications(tenant_id, created_at DESC);

-- UPDATED_AT TRIGGER FUNCTION
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_tenants_updated_at BEFORE UPDATE ON tenants FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_tenders_updated_at BEFORE UPDATE ON tenders FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_alerts_updated_at BEFORE UPDATE ON tender_alerts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- TABLAS ADICIONALES
-- ============================================================

-- TENDER DUPLICATES (deduplicación entre portales)
CREATE TABLE tender_duplicates (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  master_id      UUID NOT NULL REFERENCES tenders(id) ON DELETE CASCADE,
  duplicate_id   UUID NOT NULL REFERENCES tenders(id) ON DELETE CASCADE,
  similarity     NUMERIC(5,4) NOT NULL,
  fingerprint    VARCHAR(64),
  detected_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT tender_duplicates_pair_unique UNIQUE (master_id, duplicate_id),
  CONSTRAINT tender_duplicates_no_self CHECK (master_id <> duplicate_id)
);

CREATE INDEX idx_duplicates_master ON tender_duplicates(master_id);
CREATE INDEX idx_duplicates_duplicate ON tender_duplicates(duplicate_id);
CREATE INDEX idx_duplicates_similarity ON tender_duplicates(similarity DESC);

-- Columnas adicionales en tenders para soporte de deduplicación y UNSPSC
ALTER TABLE tenders ADD COLUMN IF NOT EXISTS fingerprint    VARCHAR(64);
ALTER TABLE tenders ADD COLUMN IF NOT EXISTS content_hash  VARCHAR(64);
ALTER TABLE tenders ADD COLUMN IF NOT EXISTS unspsc_code   VARCHAR(20);
ALTER TABLE tenders ADD COLUMN IF NOT EXISTS unspsc_label  VARCHAR(255);
ALTER TABLE tenders ADD COLUMN IF NOT EXISTS is_duplicate  BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE tenders ADD COLUMN IF NOT EXISTS master_id     UUID REFERENCES tenders(id);

CREATE INDEX IF NOT EXISTS idx_tenders_fingerprint  ON tenders(fingerprint);
CREATE INDEX IF NOT EXISTS idx_tenders_unspsc       ON tenders(unspsc_code);
CREATE INDEX IF NOT EXISTS idx_tenders_is_duplicate ON tenders(is_duplicate);

-- AUDIT LOGS
CREATE TYPE audit_action AS ENUM (
  'CREATE', 'READ', 'UPDATE', 'DELETE', 'LOGIN', 'LOGOUT',
  'EXPORT', 'SEARCH', 'SYNC', 'API_KEY_USE'
);

CREATE TABLE audit_logs (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id     UUID REFERENCES tenants(id) ON DELETE SET NULL,
  user_id       UUID REFERENCES users(id) ON DELETE SET NULL,
  action        audit_action NOT NULL,
  resource      VARCHAR(100) NOT NULL,
  resource_id   VARCHAR(255),
  ip_address    INET,
  user_agent    TEXT,
  request_id    VARCHAR(64),
  duration_ms   INTEGER,
  status_code   SMALLINT,
  metadata      JSONB,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_tenant    ON audit_logs(tenant_id, created_at DESC);
CREATE INDEX idx_audit_user      ON audit_logs(user_id, created_at DESC);
CREATE INDEX idx_audit_action    ON audit_logs(action);
CREATE INDEX idx_audit_resource  ON audit_logs(resource, resource_id);
CREATE INDEX idx_audit_created   ON audit_logs(created_at DESC);
CREATE INDEX idx_audit_ip        ON audit_logs(ip_address);

-- Retención: purgar registros > 90 días (ejecutar via cron/pg_cron)
-- DELETE FROM audit_logs WHERE created_at < NOW() - INTERVAL '90 days';

-- SEARCH HISTORY
CREATE TABLE search_history (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tenant_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  query         TEXT NOT NULL,
  filters       JSONB,
  result_count  INTEGER NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_search_history_user    ON search_history(user_id, created_at DESC);
CREATE INDEX idx_search_history_tenant  ON search_history(tenant_id, created_at DESC);
CREATE INDEX idx_search_history_query   ON search_history USING GIN (query gin_trgm_ops);

-- COMPANY PROFILES (perfil de empresa por tenant/usuario)
CREATE TABLE company_profiles (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id         UUID REFERENCES users(id) ON DELETE SET NULL,
  rut             VARCHAR(20),
  business_name   VARCHAR(255) NOT NULL,
  trade_name      VARCHAR(255),
  industry        VARCHAR(100),
  company_size    VARCHAR(50),
  address         TEXT,
  phone           VARCHAR(50),
  website         VARCHAR(255),
  description     TEXT,
  is_verified     BOOLEAN NOT NULL DEFAULT false,
  verified_at     TIMESTAMPTZ,
  metadata        JSONB NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT company_profiles_tenant_unique UNIQUE (tenant_id)
);

CREATE INDEX idx_company_profiles_tenant ON company_profiles(tenant_id);
CREATE INDEX idx_company_profiles_rut    ON company_profiles(rut);

CREATE TRIGGER update_company_profiles_updated_at
  BEFORE UPDATE ON company_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- API KEYS
CREATE TABLE api_keys (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name          VARCHAR(255) NOT NULL,
  key_hash      VARCHAR(64) NOT NULL UNIQUE,
  key_prefix    VARCHAR(10) NOT NULL,
  scopes        JSONB NOT NULL DEFAULT '["read"]',
  rate_limit    INTEGER NOT NULL DEFAULT 1000,
  is_active     BOOLEAN NOT NULL DEFAULT true,
  last_used_at  TIMESTAMPTZ,
  expires_at    TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_api_keys_tenant   ON api_keys(tenant_id);
CREATE INDEX idx_api_keys_user     ON api_keys(user_id);
CREATE INDEX idx_api_keys_hash     ON api_keys(key_hash);
CREATE INDEX idx_api_keys_active   ON api_keys(is_active, tenant_id);

CREATE TRIGGER update_api_keys_updated_at
  BEFORE UPDATE ON api_keys
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- EMAIL VERIFICATION TOKENS
CREATE TABLE email_verification_tokens (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash  VARCHAR(64) NOT NULL UNIQUE,
  expires_at  TIMESTAMPTZ NOT NULL,
  used_at     TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_email_tokens_user    ON email_verification_tokens(user_id);
CREATE INDEX idx_email_tokens_hash    ON email_verification_tokens(token_hash);
CREATE INDEX idx_email_tokens_expires ON email_verification_tokens(expires_at);

-- Columna email_verified en users
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified    BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMPTZ;
