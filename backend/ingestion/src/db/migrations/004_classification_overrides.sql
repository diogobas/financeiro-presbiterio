-- Migration: 004_classification_overrides.sql
-- Create table to store manual classification overrides and audit trail

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
COMMENT ON COLUMN classification_override.transaction_id IS 'Transaction being overridden (one per transaction)';
COMMENT ON COLUMN classification_override.previous_category_id IS 'Previous category before override';
COMMENT ON COLUMN classification_override.new_category_id IS 'New category assigned';
COMMENT ON COLUMN classification_override.actor IS 'User ID or subject who made the override';
COMMENT ON COLUMN classification_override.reason IS 'Explanation for the override';
