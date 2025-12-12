-- Migration 002: Add account_number column to account table
-- Purpose: Store the bank account number (e.g., "70011-8") extracted from CSV files
-- Created: 2025-12-11

ALTER TABLE account
ADD COLUMN IF NOT EXISTS account_number VARCHAR(50);

-- Add unique constraint if not exists (idempotent approach)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.constraint_column_usage 
    WHERE table_name = 'account' AND column_name = 'account_number' AND constraint_name LIKE 'account_account_number%'
  ) THEN
    ALTER TABLE account ADD UNIQUE (account_number);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_account_number ON account(account_number);
