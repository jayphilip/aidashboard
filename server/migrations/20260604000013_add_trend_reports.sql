-- Migration: Add Hermes-generated trend reports
-- Created: 2026-06-04
--
-- A trend_report is an LLM (Hermes via OpenRouter) summary of recent items.
-- The Rust ingestor produces one row per analysis run; the browser subscribes
-- to it via an ElectricSQL shape and renders it on the Trends tab.
-- electric_publication is FOR ALL TABLES, so no publication change is needed.

CREATE TABLE IF NOT EXISTS trend_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- ISO date (YYYY-MM-DD) this report covers; one canonical report per day
  report_date TEXT NOT NULL,
  -- number of items fed to Hermes for this report
  items_analyzed INTEGER NOT NULL DEFAULT 0,
  -- overall "state of AI" narrative paragraph(s)
  narrative TEXT NOT NULL DEFAULT '',
  -- structured themes: [{ name, summary, item_count, tags, items: [{title,url}] }]
  themes JSONB NOT NULL DEFAULT '[]'::JSONB,
  -- model id used (e.g. nousresearch/hermes-3-llama-3.1-70b)
  model TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(report_date)
);

CREATE INDEX IF NOT EXISTS idx_trend_reports_report_date ON trend_reports(report_date DESC);
CREATE INDEX IF NOT EXISTS idx_trend_reports_created_at ON trend_reports(created_at DESC);
