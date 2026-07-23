-- NI Brain Supabase: Content Calendar v2.1 schema (project kxijunwgbrlfzvgkhklo)
-- Idempotent, safe to re-run. Run when deploying the Content Calendar v2.1 rebuild.
--
-- Covers:
--   1. DPMO / social-scan / hashtag-research columns on match_fit_content_calendar_posts
--   2. match_fit_content_cowork_jobs  (durable Claude Cowork job queue)
--   3. match_fit_content_calendar_settings  (archive retention config)
--   4. product_scoreboard  (cross-product DPMO phase read; seeds match-fit only)

ALTER TABLE match_fit_content_calendar_posts
  ADD COLUMN IF NOT EXISTS dpmo_phase text,
  ADD COLUMN IF NOT EXISTS dpmo_rationale text,
  ADD COLUMN IF NOT EXISTS social_scan_snapshot_id text,
  ADD COLUMN IF NOT EXISTS hashtag_research_snapshot jsonb;

CREATE TABLE IF NOT EXISTS match_fit_content_cowork_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_type text NOT NULL CHECK (job_type IN ('generate_media', 'post_batch')),
  brief jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued', 'dispatched', 'running', 'complete', 'failed')),
  platform_targets text[],
  created_at timestamptz NOT NULL DEFAULT now(),
  dispatched_at timestamptz,
  completed_at timestamptz,
  result jsonb,
  error text
);

CREATE INDEX IF NOT EXISTS idx_content_cowork_jobs_status
  ON match_fit_content_cowork_jobs (status);

CREATE TABLE IF NOT EXISTS match_fit_content_calendar_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  posted_retention_hours integer NOT NULL DEFAULT 48,
  scrapped_retention_days integer NOT NULL DEFAULT 7,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT match_fit_content_calendar_settings_retention_bounds
    CHECK (posted_retention_hours <= 8760 AND scrapped_retention_days <= 365)
);

CREATE TABLE IF NOT EXISTS product_scoreboard (
  product_slug text PRIMARY KEY,
  signups integer NOT NULL DEFAULT 0,
  paid integer NOT NULL DEFAULT 0,
  mrr numeric NOT NULL DEFAULT 0,
  phase text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO product_scoreboard (product_slug, phase)
  VALUES ('match-fit', 'phase1')
  ON CONFLICT (product_slug) DO NOTHING;
