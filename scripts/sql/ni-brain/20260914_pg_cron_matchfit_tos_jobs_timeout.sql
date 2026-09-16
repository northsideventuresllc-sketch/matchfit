-- Target: NI-Brain Supabase (kxijunwgbrlfzvgkhklo) -- NOT this app's own Postgres. Run directly
-- against kxijunwgbrlfzvgkhklo (Supabase MCP / dashboard SQL editor), NOT through
-- `npm run db:migrate` / Prisma, and NOT as a supabase/migrations file -- see
-- 20260903_pg_cron_matchfit_http_jobs.sql's header for why this directory exists outside
-- supabase/migrations.
--
-- Context (BUILD-MF-LEADFINDER-8S-TIMEOUT-0914 follow-up, found live 2026-09-14): the ticket's
-- own diagnosis (mf-cron-lead-finder-1/2 hitting the fn_mf_cron_ping 8000ms default) turned out
-- stale -- those two jobs already carry an explicit 290000ms override (cron.job confirms). The
-- actual live 8000ms timeout happening right now, roughly every 15 minutes, is mf-cron-tos-jobs
-- (jobid 25, schedule */15 * * * *, calls /api/cron/match-fit-tos-jobs with no override --
-- confirmed via net._http_response: repeated "Timeout of 8000 ms reached" entries every 15 min
-- throughout 2026-09-14). route.ts runs ~20 sequential Prisma-backed sub-jobs (background-check
-- renewals, session auto-complete, DIY alerts, beta waitlist, billing lifecycle jobs, etc.) and
-- had no maxDuration set, so it also inherited the platform default rather than the 300s every
-- sibling long-running cron route (content-calendar-generate-media, daily-generate,
-- weekly-generate) already declares. Paired with this file: route.ts now sets
-- `export const maxDuration = 300;`, matching that same sibling pattern.
--
-- Idempotent: the unschedule is guarded to silently no-op if the job doesn't exist yet, so this
-- can be re-run safely once applied.
--
-- ---------------------------------------------------------------------------------------------
-- mf-cron-tos-jobs -- GET /api/cron/match-fit-tos-jobs, Authorization: Bearer CRON_SECRET
--    Timeout 290000ms, under the route's new maxDuration (300s), mirroring the margin
--    mf-cron-weekly-generate / mf-cron-daily-generate already use.
-- ---------------------------------------------------------------------------------------------
select cron.unschedule('mf-cron-tos-jobs') where exists (select 1 from cron.job where jobname = 'mf-cron-tos-jobs');
select cron.schedule(
  'mf-cron-tos-jobs',
  '*/15 * * * *',
  $$
  select fn_mf_cron_ping('/api/cron/match-fit-tos-jobs', 'tos-jobs', 290000);
  $$
);

-- To verify after applying:
--   select jobid, jobname, schedule, command, active from cron.job where jobname = 'mf-cron-tos-jobs';
--   select * from cron.job_run_details where jobid in (select jobid from cron.job where jobname = 'mf-cron-tos-jobs') order by start_time desc limit 20;
--
-- To roll back:
--   select cron.unschedule('mf-cron-tos-jobs');
--   select cron.schedule('mf-cron-tos-jobs', '*/15 * * * *', $$ select fn_mf_cron_ping('/api/cron/match-fit-tos-jobs', 'tos-jobs'); $$);
