-- Migration 003: Update rule table for enhanced rule management
-- Adds: name, description, category (string), priority, enabled
-- Renames: matcher_type to match_type

-- Rename matcher_type to match_type (if it exists)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'rule' AND column_name = 'matcher_type'
  ) THEN
    ALTER TABLE rule RENAME COLUMN matcher_type TO match_type;
  END IF;
END $$;

-- Add new columns for enhanced rule management
ALTER TABLE rule ADD COLUMN IF NOT EXISTS name VARCHAR(255);
ALTER TABLE rule ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE rule ADD COLUMN IF NOT EXISTS category VARCHAR(255);
ALTER TABLE rule ADD COLUMN IF NOT EXISTS priority INT NOT NULL DEFAULT 0;
ALTER TABLE rule ADD COLUMN IF NOT EXISTS enabled BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE rule ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Drop existing unique constraint if it exists and recreate it
ALTER TABLE rule DROP CONSTRAINT IF EXISTS rule_name_unique;
ALTER TABLE rule ADD CONSTRAINT rule_name_unique UNIQUE (name);

-- Update indexes
DROP INDEX IF EXISTS idx_rule_active;
CREATE INDEX IF NOT EXISTS idx_rule_enabled ON rule(enabled);
CREATE INDEX IF NOT EXISTS idx_rule_name ON rule(name);
CREATE INDEX IF NOT EXISTS idx_rule_priority ON rule(priority DESC);
CREATE INDEX IF NOT EXISTS idx_rule_category ON rule(category);
CREATE INDEX IF NOT EXISTS idx_rule_updated_at ON rule(updated_at);
