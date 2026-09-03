-- NOT YET APPLIED. Target: NI-Brain Supabase (kxijunwgbrlfzvgkhklo) -- NOT this app's own
-- Postgres (Match Fit's DATABASE_URL/Prisma DB is a different project). Run this directly
-- against kxijunwgbrlfzvgkhklo (Supabase MCP / dashboard SQL editor) -- NOT through
-- `npm run db:migrate` / Prisma, and NOT as a supabase/migrations file: this repo's Supabase
-- branching integration treats anything under supabase/migrations as a migration against the
-- MATCH FIT APP's own Supabase project, which would apply these pg_cron statements to the wrong
-- database on merge. That is why this file lives under scripts/sql/ni-brain/ instead (moved
-- 2026-09-03 per coordinator correction, was originally misfiled at
-- supabase/migrations/20260903000000_ni_brain_pg_cron_tos_jobs.sql).
--
-- Context (Decision #1699 / lane D2, 2026-09-03): GitHub Actions `schedule:` crons are
-- forbidden. Eight .github/workflows/*.yml files in this repo had a `schedule:` block removed
-- (workflow_dispatch kept everywhere for manual runs) with no replacement scheduler wired up yet
-- -- this file is that replacement for the seven that are a simple HTTP call, using pg_net
-- (already enabled on kxijunwgbrlfzvgkhklo) to make the same call NI-Brain-side that GitHub
-- Actions used to make. The eighth (tos-governance.yml) is NOT covered here -- see the note at
-- the bottom of this file for why.
--
-- Before applying: pg_cron + pg_net are already enabled on kxijunwgbrlfzvgkhklo (confirmed
-- 2026-09-03), and a secret literally named `CRON_SECRET` already exists in ni_platform_secrets
-- (confirmed 2026-09-03 via `select key from ni_platform_secrets where key ilike '%cron%'` --
-- CRON_SECRET was the only match, so every job below reads that same key; none of them used a
-- different secret name in its workflow file).
--
-- Idempotent: every cron.schedule call is preceded by a matching cron.unschedule guarded to
-- silently no-op if the job doesn't exist yet, so this file can be re-run safely.

-- ---------------------------------------------------------------------------------------------
-- 1. mf-tos-cron -- was .github/workflows/match-fit-tos-cron.yml, "*/15 * * * *"
--    GET /api/cron/match-fit-tos-jobs, Authorization: Bearer CRON_SECRET
-- ---------------------------------------------------------------------------------------------
select cron.unschedule('mf-tos-cron') where exists (select 1 from cron.job where jobname = 'mf-tos-cron');
select cron.schedule(
  'mf-tos-cron',
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

-- ---------------------------------------------------------------------------------------------
-- 2. mf-outreach-follow-up-reminders -- was outreach-follow-up-reminders.yml, "0 * * * *"
--    GET /api/cron/outreach-follow-up-reminders, Authorization: Bearer CRON_SECRET
-- ---------------------------------------------------------------------------------------------
select cron.unschedule('mf-outreach-follow-up-reminders') where exists (select 1 from cron.job where jobname = 'mf-outreach-follow-up-reminders');
select cron.schedule(
  'mf-outreach-follow-up-reminders',
  '0 * * * *',
  $$
  select net.http_get(
    url := 'https://match-fit.net/api/cron/outreach-follow-up-reminders',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || (select value from ni_platform_secrets where key = 'CRON_SECRET')
    )
  );
  $$
);

-- ---------------------------------------------------------------------------------------------
-- 3. mf-content-calendar-sync -- was match-fit-content-calendar-sync.yml, "0 8 * * *"
--    GET /api/cron/content-calendar-sync, Authorization: Bearer CRON_SECRET
-- ---------------------------------------------------------------------------------------------
select cron.unschedule('mf-content-calendar-sync') where exists (select 1 from cron.job where jobname = 'mf-content-calendar-sync');
select cron.schedule(
  'mf-content-calendar-sync',
  '0 8 * * *',
  $$
  select net.http_get(
    url := 'https://match-fit.net/api/cron/content-calendar-sync',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || (select value from ni_platform_secrets where key = 'CRON_SECRET')
    )
  );
  $$
);

-- ---------------------------------------------------------------------------------------------
-- 4. mf-outreach-past-due-flip -- was outreach-past-due-flip.yml, "59 3 * * *"
--    GET /api/cron/outreach-past-due-flip, Authorization: Bearer CRON_SECRET
-- ---------------------------------------------------------------------------------------------
select cron.unschedule('mf-outreach-past-due-flip') where exists (select 1 from cron.job where jobname = 'mf-outreach-past-due-flip');
select cron.schedule(
  'mf-outreach-past-due-flip',
  '59 3 * * *',
  $$
  select net.http_get(
    url := 'https://match-fit.net/api/cron/outreach-past-due-flip',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || (select value from ni_platform_secrets where key = 'CRON_SECRET')
    )
  );
  $$
);

-- ---------------------------------------------------------------------------------------------
-- 5. mf-content-calendar-weekly-generate -- was match-fit-content-calendar-weekly-generate.yml,
--    "0 12 * * 1"
--    GET /api/cron/content-calendar-weekly-generate, Authorization: Bearer CRON_SECRET
-- ---------------------------------------------------------------------------------------------
select cron.unschedule('mf-content-calendar-weekly-generate') where exists (select 1 from cron.job where jobname = 'mf-content-calendar-weekly-generate');
select cron.schedule(
  'mf-content-calendar-weekly-generate',
  '0 12 * * 1',
  $$
  select net.http_get(
    url := 'https://match-fit.net/api/cron/content-calendar-weekly-generate',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || (select value from ni_platform_secrets where key = 'CRON_SECRET')
    )
  );
  $$
);

-- ---------------------------------------------------------------------------------------------
-- 6. mf-content-calendar-post-batch -- was match-fit-content-calendar-post-batch.yml, FOUR cron
--    expressions ("0 21 * * 1-5", "0 0 * * 2-6", "0 21 * * 6,0", "0 0 * * 0,1") -- pg_cron only
--    takes one schedule per job, so this is scheduled as four separate cron.schedule jobs
--    sharing one name prefix, matching the workflow's four `- cron:` entries one-for-one.
--    GET /api/cron/content-calendar-post-batch, Authorization: Bearer CRON_SECRET
-- ---------------------------------------------------------------------------------------------
select cron.unschedule('mf-content-calendar-post-batch-weekday-5pm') where exists (select 1 from cron.job where jobname = 'mf-content-calendar-post-batch-weekday-5pm');
select cron.schedule(
  'mf-content-calendar-post-batch-weekday-5pm',
  '0 21 * * 1-5',
  $$
  select net.http_get(
    url := 'https://match-fit.net/api/cron/content-calendar-post-batch',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || (select value from ni_platform_secrets where key = 'CRON_SECRET')
    )
  );
  $$
);

select cron.unschedule('mf-content-calendar-post-batch-weekday-8pm') where exists (select 1 from cron.job where jobname = 'mf-content-calendar-post-batch-weekday-8pm');
select cron.schedule(
  'mf-content-calendar-post-batch-weekday-8pm',
  '0 0 * * 2-6',
  $$
  select net.http_get(
    url := 'https://match-fit.net/api/cron/content-calendar-post-batch',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || (select value from ni_platform_secrets where key = 'CRON_SECRET')
    )
  );
  $$
);

select cron.unschedule('mf-content-calendar-post-batch-weekend-5pm') where exists (select 1 from cron.job where jobname = 'mf-content-calendar-post-batch-weekend-5pm');
select cron.schedule(
  'mf-content-calendar-post-batch-weekend-5pm',
  '0 21 * * 6,0',
  $$
  select net.http_get(
    url := 'https://match-fit.net/api/cron/content-calendar-post-batch',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || (select value from ni_platform_secrets where key = 'CRON_SECRET')
    )
  );
  $$
);

select cron.unschedule('mf-content-calendar-post-batch-weekend-8pm') where exists (select 1 from cron.job where jobname = 'mf-content-calendar-post-batch-weekend-8pm');
select cron.schedule(
  'mf-content-calendar-post-batch-weekend-8pm',
  '0 0 * * 0,1',
  $$
  select net.http_get(
    url := 'https://match-fit.net/api/cron/content-calendar-post-batch',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || (select value from ni_platform_secrets where key = 'CRON_SECRET')
    )
  );
  $$
);

-- ---------------------------------------------------------------------------------------------
-- 7. mf-content-calendar-generate-media -- was match-fit-content-calendar-generate-media.yml,
--    SIX cron expressions (three windows x weekday/weekend): "30 12 * * 1-5", "15 20 * * 1-5",
--    "15 23 * * 1-5", "30 12 * * 6,0", "15 20 * * 6,0", "15 23 * * 6,0" -- same one-job-per-
--    expression treatment as job 6 above.
--    GET /api/cron/content-calendar-generate-media, Authorization: Bearer CRON_SECRET
--    Note: this endpoint no longer calls any image API itself (see PR #357) -- it only
--    re-queues posts to the Mac mini's Chrome/Gemini agent. Restoring its schedule is safe.
-- ---------------------------------------------------------------------------------------------
select cron.unschedule('mf-content-calendar-generate-media-weekday-morning') where exists (select 1 from cron.job where jobname = 'mf-content-calendar-generate-media-weekday-morning');
select cron.schedule(
  'mf-content-calendar-generate-media-weekday-morning',
  '30 12 * * 1-5',
  $$
  select net.http_get(
    url := 'https://match-fit.net/api/cron/content-calendar-generate-media',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || (select value from ni_platform_secrets where key = 'CRON_SECRET')
    )
  );
  $$
);

select cron.unschedule('mf-content-calendar-generate-media-weekday-5pm-lead') where exists (select 1 from cron.job where jobname = 'mf-content-calendar-generate-media-weekday-5pm-lead');
select cron.schedule(
  'mf-content-calendar-generate-media-weekday-5pm-lead',
  '15 20 * * 1-5',
  $$
  select net.http_get(
    url := 'https://match-fit.net/api/cron/content-calendar-generate-media',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || (select value from ni_platform_secrets where key = 'CRON_SECRET')
    )
  );
  $$
);

select cron.unschedule('mf-content-calendar-generate-media-weekday-8pm-lead') where exists (select 1 from cron.job where jobname = 'mf-content-calendar-generate-media-weekday-8pm-lead');
select cron.schedule(
  'mf-content-calendar-generate-media-weekday-8pm-lead',
  '15 23 * * 1-5',
  $$
  select net.http_get(
    url := 'https://match-fit.net/api/cron/content-calendar-generate-media',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || (select value from ni_platform_secrets where key = 'CRON_SECRET')
    )
  );
  $$
);

select cron.unschedule('mf-content-calendar-generate-media-weekend-morning') where exists (select 1 from cron.job where jobname = 'mf-content-calendar-generate-media-weekend-morning');
select cron.schedule(
  'mf-content-calendar-generate-media-weekend-morning',
  '30 12 * * 6,0',
  $$
  select net.http_get(
    url := 'https://match-fit.net/api/cron/content-calendar-generate-media',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || (select value from ni_platform_secrets where key = 'CRON_SECRET')
    )
  );
  $$
);

select cron.unschedule('mf-content-calendar-generate-media-weekend-5pm-lead') where exists (select 1 from cron.job where jobname = 'mf-content-calendar-generate-media-weekend-5pm-lead');
select cron.schedule(
  'mf-content-calendar-generate-media-weekend-5pm-lead',
  '15 20 * * 6,0',
  $$
  select net.http_get(
    url := 'https://match-fit.net/api/cron/content-calendar-generate-media',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || (select value from ni_platform_secrets where key = 'CRON_SECRET')
    )
  );
  $$
);

select cron.unschedule('mf-content-calendar-generate-media-weekend-8pm-lead') where exists (select 1 from cron.job where jobname = 'mf-content-calendar-generate-media-weekend-8pm-lead');
select cron.schedule(
  'mf-content-calendar-generate-media-weekend-8pm-lead',
  '15 23 * * 6,0',
  $$
  select net.http_get(
    url := 'https://match-fit.net/api/cron/content-calendar-generate-media',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || (select value from ni_platform_secrets where key = 'CRON_SECRET')
    )
  );
  $$
);

-- ---------------------------------------------------------------------------------------------
-- 8. tos-governance.yml -- NOT COVERED HERE. Its weekly "0 14 * * 1" schedule did not hit an
--    HTTP endpoint at all: the workflow checks out the repo, runs `npm ci`, runs
--    `npm run tos:alignment` (a local script), and on completion runs
--    `node scripts/tos-governance-notify.mjs` to email JB via Resend directly from the runner.
--    There is no `/api/cron/...` route behind it to point net.http_get/http_post at -- inventing
--    one here would be exactly the kind of made-up endpoint the coordinator said not to do.
--    Making this pg_cron-schedulable would need either (a) a new API route that runs the
--    alignment check + Resend notify server-side (real product work, not a config change), or
--    (b) accepting it stays workflow_dispatch-only (manual) until (a) exists. Left for the
--    coordinator to decide; not done in this pass.
-- ---------------------------------------------------------------------------------------------

-- To verify after applying:
--   select jobid, jobname, schedule, active from cron.job where jobname like 'mf-%' order by jobname;
--   select * from cron.job_run_details where jobid in (select jobid from cron.job where jobname like 'mf-%') order by start_time desc limit 20;
--
-- To roll back any one job:
--   select cron.unschedule('<jobname>');
