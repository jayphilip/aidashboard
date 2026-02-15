-- Migration: Add user features (item_reads, user_preferences)
-- Created: 2026-02-15

-- Item reads - track which items a user has read
CREATE TABLE IF NOT EXISTS item_reads (
  id SERIAL PRIMARY KEY,
  user_id TEXT NOT NULL,
  item_id UUID NOT NULL,
  read_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, item_id)
);

-- User preferences - filter preferences and other user settings
CREATE TABLE IF NOT EXISTS user_preferences (
  id SERIAL PRIMARY KEY,
  user_id TEXT NOT NULL UNIQUE,
  filter_preferences JSONB DEFAULT '{}'::JSONB,
  ui_preferences JSONB DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for item_reads
CREATE INDEX IF NOT EXISTS idx_item_reads_user_id ON item_reads(user_id);
CREATE INDEX IF NOT EXISTS idx_item_reads_item_id ON item_reads(item_id);
CREATE INDEX IF NOT EXISTS idx_item_reads_user_item ON item_reads(user_id, item_id);

-- Indexes for user_preferences
CREATE INDEX IF NOT EXISTS idx_user_preferences_user_id ON user_preferences(user_id);

-- Note: These tables are not included in Electric sync as they are client-side only
-- No ELECTRIC ENABLE needed for user-specific data
