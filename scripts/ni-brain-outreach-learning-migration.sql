-- NI Brain Supabase: Outreach HQ learning signals for Match Fit
-- Run against project kxijunwgbrlfzvgkhklo when deploying Outreach learning features.

CREATE TABLE IF NOT EXISTS match_fit_outreach_learning_signals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  signal_type text NOT NULL,
  platform text,
  lead_id text,
  admin_id text,
  original_text text,
  edited_text text,
  meta_json jsonb
);

CREATE INDEX IF NOT EXISTS idx_outreach_learning_admin
  ON match_fit_outreach_learning_signals (admin_id, signal_type, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_outreach_learning_platform
  ON match_fit_outreach_learning_signals (platform, signal_type, created_at DESC);
