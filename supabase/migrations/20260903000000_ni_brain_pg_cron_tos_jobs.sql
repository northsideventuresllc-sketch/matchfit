-- NOT YET APPLIED. Target project: NI-Brain Supabase (kxijunwgbrlfzvgkhklo) -- NOT this app's
-- own Postgres (Match Fit's DATABASE_URL/Prisma DB is a different project). This file lives here
-- for review only; the coordinator applies it directly against kxijunwgbrlfzvgkhklo (via the
-- Supabase MCP/dashboard SQL editor), not through `npm run db:migrate` / Prisma.
--
-- Context (Decision #1699 / lane D2, 2026-09-03): GitHub Actions `schedule:` crons are
-- forbidden. .github/workflows/match-fit-tos-cron.yml used to fire
-- GET /api/cron/match-fit-tos-jobs every 15 minutes via `schedule: "*/15 * * * *"`. That
-- schedule block has been removed (workflow_dispatch stays for manual runs). This migration is
-- the pg_cron replacement, using pg_net (already enabled on kxijunwgbrlfzvgkhklo) to make the
-- same HTTP call NI-Brain-side instead.
--
-- Before applying: confirm pg_cron + pg_net are enabled (both are, confirmed 2026-09-03) and
-- that a secret named CRON_SECRET already exists in ni_platform_secrets (confirmed 2026-09-03) --
-- the value below is read from that table, never hardcoded here.

select cron.schedule(
  'match-fit-tos-jobs',
  '*/15 * * * *',
  $$
  select net.http_get(
    url := 'https://match-fit.net/api/cron/match-fit-tos-jobs',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || (select value from ni_platform_secrets where key = 'CRON_SECRET')
    )
  );
  $$
);

-- To verify after applying:
--   select jobid, jobname, schedule, active from cron.job where jobname = 'match-fit-tos-jobs';
--   select * from cron.job_run_details where jobid = (select jobid from cron.job where jobname = 'match-fit-tos-jobs') order by start_time desc limit 5;
--
-- To roll back:
--   select cron.unschedule('match-fit-tos-jobs');
