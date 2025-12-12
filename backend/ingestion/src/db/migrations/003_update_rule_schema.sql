-- Migration 003: Update rule table for enhanced rule management
-- Adds: name, description, category (string), priority, enabled
-- Marks as: version, updated_at, created_by nullable

ALTER TABLE rule ADD COLUMN IF NOT EXISTS name VARCHAR(255) NOT NULL DEFAULT '';
ALTER TABLE rule ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE rule ADD COLUMN IF NOT EXISTS category VARCHAR(255);
ALTER TABLE rule ADD COLUMN IF NOT EXISTS priority INT NOT NULL DEFAULT 0 CHECK (priority >= 0);
ALTER TABLE rule ADD COLUMN IF NOT EXISTS enabled BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE rule ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Make created_by nullable (optional for retroactive rules)
ALTER TABLE rule ALTER COLUMN created_by DROP NOT NULL;

-- Make category_id nullable (allow rules without category reference)
ALTER TABLE rule ALTER COLUMN category_id DROP NOT NULL;

-- Rename matcher_type column to match_type for consistency
ALTER TABLE rule RENAME COLUMN matcher_type TO match_type;

-- Add unique constraint on rule name
ALTER TABLE rule ADD CONSTRAINT IF NOT EXISTS rule_name_unique UNIQUE (name);
ALTER TABLE rule ADD CONSTRAINT IF NOT EXISTS rule_name_not_empty CHECK (length(trim(name)) > 0);
ALTER TABLE rule ADD CONSTRAINT IF NOT EXISTS rule_pattern_not_empty CHECK (length(trim(pattern)) > 0);

-- Update indexes
DROP INDEX IF EXISTS idx_rule_active;
CREATE INDEX IF NOT EXISTS idx_rule_enabled ON rule(enabled);
CREATE INDEX IF NOT EXISTS idx_rule_name ON rule(name);
CREATE INDEX IF NOT EXISTS idx_rule_priority ON rule(priority DESC);
CREATE INDEX IF NOT EXISTS idx_rule_category ON rule(category);
CREATE INDEX IF NOT EXISTS idx_rule_updated_at ON rule(updated_at);

-- Add comments
COMMENT ON COLUMN rule.name IS 'Unique rule name';
COMMENT ON COLUMN rule.description IS 'Human-readable description of what the rule matches';
COMMENT ON COLUMN rule.category IS 'Category name for classification';
COMMENT ON COLUMN rule.priority IS 'Rule execution priority (higher = earlier)';
COMMENT ON COLUMN rule.enabled IS 'Whether this rule is currently active';
COMMENT ON COLUMN rule.updated_at IS 'Last update timestamp';
COMMENT ON COLUMN rule.match_type IS 'Matching strategy: CONTAINS (case-insensitive) or REGEX';
