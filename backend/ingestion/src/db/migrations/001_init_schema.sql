-- Migration 001: Initialize core schema for Bank CSV Reporting
-- Tables: Account, Category, ImportBatch, Transaction, Rule, ClassificationOverride
-- Created: 2025-12-11

-- ============================================================================
-- ENUMS (PostgreSQL Domain Types)
-- ============================================================================

DO $$ BEGIN
  CREATE TYPE account_status AS ENUM ('ACTIVE', 'INACTIVE', 'ARCHIVED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE transaction_type AS ENUM ('RECEITA', 'DESPESA');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE classification_source AS ENUM ('RULE', 'OVERRIDE', 'NONE');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE matcher_type AS ENUM ('CONTAINS', 'REGEX');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE encoding_type AS ENUM ('UTF8', 'LATIN1');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================================
-- TABLES
-- ============================================================================

-- Account: Bank accounts being tracked
CREATE TABLE IF NOT EXISTS account (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  bank_name VARCHAR(255),
  status account_status NOT NULL DEFAULT 'ACTIVE',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT account_name_not_empty CHECK (length(trim(name)) > 0)
);

CREATE INDEX IF NOT EXISTS idx_account_status ON account(status);
CREATE INDEX IF NOT EXISTS idx_account_created_at ON account(created_at);

COMMENT ON TABLE account IS 'Bank accounts that users upload CSV data for';
COMMENT ON COLUMN account.id IS 'Unique account identifier';
COMMENT ON COLUMN account.name IS 'User-friendly name for the account';
COMMENT ON COLUMN account.bank_name IS 'Optional bank name for reference';
COMMENT ON COLUMN account.status IS 'Account status: ACTIVE, INACTIVE, ARCHIVED';

-- Category: Transaction categories for classification
CREATE TABLE IF NOT EXISTS category (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL UNIQUE,
  tipo transaction_type NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT category_name_not_empty CHECK (length(trim(name)) > 0)
);

CREATE INDEX IF NOT EXISTS idx_category_tipo ON category(tipo);
CREATE INDEX IF NOT EXISTS idx_category_name ON category(name);

COMMENT ON TABLE category IS 'Transaction categories used for classification';
COMMENT ON COLUMN category.id IS 'Unique category identifier';
COMMENT ON COLUMN category.name IS 'Category name (e.g., "Salário", "Alimentação")';
COMMENT ON COLUMN category.tipo IS 'Transaction type: RECEITA or DESPESA';

-- ImportBatch: CSV import metadata
CREATE TABLE IF NOT EXISTS import_batch (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES account(id) ON DELETE CASCADE,
  uploaded_by VARCHAR(255) NOT NULL,
  uploaded_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  file_checksum VARCHAR(64) NOT NULL,
  period_month INT NOT NULL CHECK (period_month >= 1 AND period_month <= 12),
  period_year INT NOT NULL CHECK (period_year >= 2000 AND period_year <= 2100),
  encoding encoding_type NOT NULL DEFAULT 'UTF8',
  row_count INT NOT NULL DEFAULT 0 CHECK (row_count >= 0),
  UNIQUE(account_id, file_checksum, period_month, period_year)
);

CREATE INDEX IF NOT EXISTS idx_import_batch_account_id ON import_batch(account_id);
CREATE INDEX IF NOT EXISTS idx_import_batch_uploaded_at ON import_batch(uploaded_at);
CREATE INDEX IF NOT EXISTS idx_import_batch_period ON import_batch(period_year, period_month);
CREATE INDEX IF NOT EXISTS idx_import_batch_checksum ON import_batch(file_checksum);

COMMENT ON TABLE import_batch IS 'Metadata for each CSV file import';
COMMENT ON COLUMN import_batch.id IS 'Unique batch identifier';
COMMENT ON COLUMN import_batch.account_id IS 'Account that the batch was uploaded to';
COMMENT ON COLUMN import_batch.file_checksum IS 'SHA-256 hash of file content for deduplication';
COMMENT ON COLUMN import_batch.period_month IS 'Month (1-12) of transactions in batch';
COMMENT ON COLUMN import_batch.period_year IS 'Year of transactions in batch';

-- Rule: Classification rules for auto-categorization
CREATE TABLE IF NOT EXISTS rule (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version INT NOT NULL DEFAULT 1,
  matcher_type matcher_type NOT NULL,
  pattern VARCHAR(1024) NOT NULL,
  category_id UUID NOT NULL REFERENCES category(id) ON DELETE RESTRICT,
  tipo transaction_type NOT NULL,
  created_by VARCHAR(255) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  CONSTRAINT rule_pattern_not_empty CHECK (length(trim(pattern)) > 0)
);

CREATE INDEX IF NOT EXISTS idx_rule_active ON rule(active);
CREATE INDEX IF NOT EXISTS idx_rule_category_id ON rule(category_id);
CREATE INDEX IF NOT EXISTS idx_rule_tipo ON rule(tipo);
CREATE INDEX IF NOT EXISTS idx_rule_created_at ON rule(created_at);

COMMENT ON TABLE rule IS 'Rules for automatic transaction classification';
COMMENT ON COLUMN rule.id IS 'Unique rule identifier';
COMMENT ON COLUMN rule.version IS 'Version number for tracking rule evolution';
COMMENT ON COLUMN rule.matcher_type IS 'Matching strategy: CONTAINS (case-insensitive) or REGEX';
COMMENT ON COLUMN rule.pattern IS 'Pattern to match against transaction documento field';
COMMENT ON COLUMN rule.active IS 'Whether this rule is currently used for classification';

-- Transaction: Imported transactions
CREATE TABLE IF NOT EXISTS transaction (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES account(id) ON DELETE CASCADE,
  batch_id UUID NOT NULL REFERENCES import_batch(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  documento VARCHAR(255) NOT NULL,
  documento_normalized VARCHAR(255) GENERATED ALWAYS AS (
    LOWER(TRANSLATE(documento, 'àáâãäèéêëìíîïòóôõöùúûüçÀÁÂÃÄÈÉÊËÌÍÎÏÒÓÔÕÖÙÚÛÜÇ', 'aaaaaeeeeiiiiooooouuuucAAAAAAEEEEIIIIOOOOOUUUUC'))
  ) STORED,
  amount NUMERIC(14, 2) NOT NULL,
  currency VARCHAR(3) NOT NULL DEFAULT 'BRL',
  category_id UUID REFERENCES category(id) ON DELETE SET NULL,
  tipo transaction_type,
  classification_source classification_source NOT NULL DEFAULT 'NONE',
  rule_id UUID REFERENCES rule(id) ON DELETE SET NULL,
  rule_version INT,
  rationale VARCHAR(1024),
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT transaction_amount_precision CHECK (amount >= -999999999999.99 AND amount <= 999999999999.99),
  CONSTRAINT transaction_rationale_consistency CHECK (
    (classification_source = 'RULE' AND rule_id IS NOT NULL) OR
    (classification_source = 'OVERRIDE' AND rule_id IS NULL) OR
    (classification_source = 'NONE' AND rule_id IS NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_transaction_account_id ON transaction(account_id);
CREATE INDEX IF NOT EXISTS idx_transaction_batch_id ON transaction(batch_id);
CREATE INDEX IF NOT EXISTS idx_transaction_category_id ON transaction(category_id);
CREATE INDEX IF NOT EXISTS idx_transaction_date ON transaction(date);
CREATE INDEX IF NOT EXISTS idx_transaction_created_at ON transaction(created_at);
CREATE INDEX IF NOT EXISTS idx_transaction_documento ON transaction(documento_normalized);
CREATE INDEX IF NOT EXISTS idx_transaction_unclassified ON transaction(account_id, category_id) WHERE category_id IS NULL;

COMMENT ON TABLE transaction IS 'Imported bank transactions';
COMMENT ON COLUMN transaction.id IS 'Unique transaction identifier';
COMMENT ON COLUMN transaction.date IS 'Transaction date (parsed as DD/MM/YYYY from CSV)';
COMMENT ON COLUMN transaction.documento IS 'Transaction description/document number';
COMMENT ON COLUMN transaction.documento_normalized IS 'Lowercase, accent-removed version for matching';
COMMENT ON COLUMN transaction.amount IS 'Signed amount (negative for parentheses-enclosed values)';
COMMENT ON COLUMN transaction.classification_source IS 'How classification was determined: RULE, OVERRIDE, or NONE';
COMMENT ON COLUMN transaction.rule_version IS 'Version of rule that was applied (for audit trail)';

-- ClassificationOverride: Audit trail for manual classifications
CREATE TABLE IF NOT EXISTS classification_override (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id UUID NOT NULL UNIQUE REFERENCES transaction(id) ON DELETE CASCADE,
  previous_category_id UUID REFERENCES category(id) ON DELETE SET NULL,
  previous_tipo transaction_type,
  new_category_id UUID NOT NULL REFERENCES category(id) ON DELETE RESTRICT,
  new_tipo transaction_type NOT NULL,
  actor VARCHAR(255) NOT NULL,
  reason VARCHAR(1024),
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_classification_override_transaction_id ON classification_override(transaction_id);
CREATE INDEX IF NOT EXISTS idx_classification_override_created_at ON classification_override(created_at);
CREATE INDEX IF NOT EXISTS idx_classification_override_actor ON classification_override(actor);

COMMENT ON TABLE classification_override IS 'Audit trail for manual classification changes';
COMMENT ON COLUMN classification_override.id IS 'Unique override record identifier';
COMMENT ON COLUMN classification_override.transaction_id IS 'Transaction being overridden (one per transaction)';
COMMENT ON COLUMN classification_override.previous_category_id IS 'Previous category before override';
COMMENT ON COLUMN classification_override.new_category_id IS 'New category assigned';
COMMENT ON COLUMN classification_override.actor IS 'User ID or subject who made the override';
COMMENT ON COLUMN classification_override.reason IS 'Explanation for the override';

-- ============================================================================
-- MATERIALIZED VIEWS (for reporting)
-- ============================================================================

-- Aggregated transaction totals by category, month, account
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_category_totals AS
SELECT
  EXTRACT(YEAR FROM t.date)::INT AS year,
  EXTRACT(MONTH FROM t.date)::INT AS month,
  t.account_id,
  t.category_id,
  c.tipo,
  SUM(t.amount)::NUMERIC(14, 2) AS total_amount,
  COUNT(*)::INT AS row_count
FROM transaction t
LEFT JOIN category c ON t.category_id = c.id
WHERE t.category_id IS NOT NULL
GROUP BY
  EXTRACT(YEAR FROM t.date),
  EXTRACT(MONTH FROM t.date),
  t.account_id,
  t.category_id,
  c.tipo;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_category_totals_unique ON mv_category_totals(year, month, account_id, category_id);

COMMENT ON MATERIALIZED VIEW mv_category_totals IS 'Aggregated transaction totals by category, month, and account (for fast reporting queries)';

-- ============================================================================
-- GRANTS (for application user)
-- ============================================================================
-- Note: Adjust 'financeiro_app' to your actual application user name

-- These will be managed by the application or separate migration scripts
-- GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO financeiro_app;
-- GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO financeiro_app;
