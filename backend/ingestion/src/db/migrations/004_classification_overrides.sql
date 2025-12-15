-- Migration: 004_classification_overrides.sql
-- Create table to store manual classification overrides and audit trail

CREATE TABLE IF NOT EXISTS classification_override (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id UUID NOT NULL REFERENCES transaction(id) ON DELETE CASCADE,
  created_by TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  category TEXT NOT NULL,
  rule_id UUID NULL,
  note TEXT NULL
);

-- Add audit columns to transaction table for override metadata
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='transaction' AND column_name='override_id'
  ) THEN
    ALTER TABLE "transaction" ADD COLUMN override_id UUID NULL;
  END IF;
END$$;
