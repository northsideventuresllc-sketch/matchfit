-- NOT YET APPLIED. Target: NI-Brain Supabase (kxijunwgbrlfzvgkhklo) -- NOT this app's own
-- Postgres. Run this directly against kxijunwgbrlfzvgkhklo (Supabase MCP / dashboard SQL editor),
-- NOT through Prisma and NOT as a supabase/migrations file (that path applies to the Match Fit app
-- project, the wrong database). Same rationale as 20260903_pg_cron_matchfit_http_jobs.sql.
--
-- Context (2026-09-04): GitHub Actions `schedule:` crons are forbidden (Decision #1699). The daily
-- Social Media Research run has a workflow_dispatch-only workflow
-- (.github/workflows/match-fit-content-research-cron.yml) for manual runs; this file wires the daily
-- cadence NI-Brain-side via pg_net, using the same CRON_SECRET already in ni_platform_secrets.
--
-- Idempotent: the unschedule is guarded to no-op if the job doesn't exist yet, so this is re-runnable.

-- ---------------------------------------------------------------------------------------------
-- mf-content-research -- daily Social Media Research run for Match Fit
--   GET /api/cron/content-calendar-research, Authorization: Bearer CRON_SECRET
--   07:30 UTC daily (~before the Monday 8am ET weekly generation and the daily social run).
-- ---------------------------------------------------------------------------------------------
select cron.unschedule('mf-content-research') where exists (select 1 from cron.job where jobname = 'mf-content-research');
select cron.schedule(
  'mf-content-research',
  '30 7 * * *',
  $$
  select net.http_get(
    url := 'https://match-fit.net/api/cron/content-calendar-research',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || (select value from ni_platform_secrets where key = 'CRON_SECRET')
    )
  );
  $$
);
