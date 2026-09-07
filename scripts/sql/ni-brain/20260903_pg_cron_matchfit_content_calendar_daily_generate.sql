-- Target: NI-Brain Supabase (kxijunwgbrlfzvgkhklo) -- NOT this app's own Postgres. Run directly
-- against kxijunwgbrlfzvgkhklo (Supabase MCP / dashboard SQL editor), NOT through
-- `npm run db:migrate` / Prisma, and NOT as a supabase/migrations file (that path applies to the
-- MATCH FIT APP's own Supabase project on merge -- see scripts/sql/ni-brain/
-- 20260903_pg_cron_matchfit_http_jobs.sql's header for why this whole directory exists outside
-- supabase/migrations).
--
-- Context (Decision #1699 / lane D2): GitHub Actions `schedule:` crons are forbidden. This repo's
-- other eight cron workflows already had their `schedule:` blocks removed and replaced with
-- NI-Brain pg_cron jobs calling the shared fn_mf_cron_ping(endpoint, label, timeout_ms) helper
-- (confirmed live on kxijunwgbrlfzvgkhklo 2026-09-03 -- see e.g. mf-cron-weekly-generate). This
-- file adds the ninth: the daily Content Hub top-up introduced alongside this file
-- (content-calendar-daily-generate.yml / /api/cron/content-calendar-daily-generate), matching
-- that same pattern instead of a new GitHub Actions schedule:.
--
-- DO NOT APPLY until this PR is merged and deployed to production -- the endpoint below
-- (/api/cron/content-calendar-daily-generate) does not exist until then, so running this early
-- would just add a cron job that 404s every run.
--
-- Idempotent: the unschedule is guarded to silently no-op if the job doesn't exist yet, so this
-- can be re-run safely once applied.
--
-- UPDATE 2026-09-07 (MF-CONTENT-GEN-VERCEL-504-0907 follow-up): the route's own maxDuration went
-- 120s -> 300s (it kept 504ing on the shared hydrate/schema-ensure prep even with the per-post-type
-- hop fix already live -- see route.ts). Bumping this job's timeout to 290000ms to keep the same
-- margin mf-cron-weekly-generate uses under its 300s maxDuration. Re-run this file against
-- NI-Brain (kxijunwgbrlfzvgkhklo) to pick up the new timeout -- the schedule/unschedule below is
-- idempotent so it's safe to re-apply.

-- ---------------------------------------------------------------------------------------------
-- mf-cron-daily-generate -- was .github/workflows/match-fit-content-calendar-daily-generate.yml,
--    "5 12 * * 1-5" (weekdays, 5 min after mf-cron-weekly-generate's Monday top-of-hour slot so
--    the two never race)
--    GET /api/cron/content-calendar-daily-generate, Authorization: Bearer CRON_SECRET
--    Timeout 290000ms, under the route's own maxDuration (300s), mirroring the margin
--    mf-cron-weekly-generate already uses (290000ms under its 300s maxDuration).
-- ---------------------------------------------------------------------------------------------
select cron.unschedule('mf-cron-daily-generate') where exists (select 1 from cron.job where jobname = 'mf-cron-daily-generate');
select cron.schedule(
  'mf-cron-daily-generate',
  '5 12 * * 1-5',
  $$
  select fn_mf_cron_ping('/api/cron/content-calendar-daily-generate', 'daily-generate', 290000);
  $$
);

-- To verify after applying:
--   select jobid, jobname, schedule, active from cron.job where jobname = 'mf-cron-daily-generate';
--   select * from cron.job_run_details where jobid in (select jobid from cron.job where jobname = 'mf-cron-daily-generate') order by start_time desc limit 20;
--
-- To roll back:
--   select cron.unschedule('mf-cron-daily-generate');
