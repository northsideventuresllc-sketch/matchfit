-- NI Brain Supabase: Content Hub columns for match_fit_content_calendar_posts
-- Run against project kxijunwgbrlfzvgkhklo when deploying Content Hub features.

ALTER TABLE match_fit_content_calendar_posts
  ADD COLUMN IF NOT EXISTS saved_to_hub_at timestamptz,
  ADD COLUMN IF NOT EXISTS is_scheduled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS purge_after_at timestamptz,
  ADD COLUMN IF NOT EXISTS bulk_session_id text,
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

-- Unscheduled hub drafts may omit a post date until the operator sets one.
ALTER TABLE match_fit_content_calendar_posts
  ALTER COLUMN post_date DROP NOT NULL;

CREATE INDEX IF NOT EXISTS idx_content_calendar_saved_hub
  ON match_fit_content_calendar_posts (saved_to_hub_at)
  WHERE saved_to_hub_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_content_calendar_purge
  ON match_fit_content_calendar_posts (purge_after_at)
  WHERE purge_after_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_content_calendar_deleted
  ON match_fit_content_calendar_posts (deleted_at)
  WHERE deleted_at IS NOT NULL;
