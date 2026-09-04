-- NOT YET APPLIED. Target: NI-Brain Supabase (kxijunwgbrlfzvgkhklo) -- NOT this app's own
-- Postgres. Run directly against kxijunwgbrlfzvgkhklo (Supabase MCP / dashboard SQL editor),
-- NOT through Prisma and NOT as a supabase/migrations file (same reasoning as
-- 20260903_pg_cron_matchfit_http_jobs.sql in this folder -- see its header).
--
-- Context (WF2 item 2, JB 2026-09-03/04): the Outreach HQ reply scan (email jb@match-fit.net via
-- Microsoft Graph + Instagram @theofficialmatchfit via a queued Cowork scan job) must run on a
-- schedule so replies land in Pending Responses without JB clicking "Scan for replies". GitHub
-- Actions `schedule:` crons are forbidden (Decision #1699), so this uses pg_net NI-Brain-side, the
-- same mechanism as the other Match Fit HTTP jobs.
--
-- Endpoint: GET https://match-fit.net/api/cron/outreach-response-scan, Authorization: Bearer
-- CRON_SECRET (route has NO hour guard -- the schedule below owns the timing).
--
-- SCHEDULE (JB-locked): 9am, 12pm, 3pm, 6pm ET Mon-Fri; 12pm ET Sat + Sun. pg_cron runs in UTC.
-- These rows use the EDT offset (UTC-4, in effect now). Like every other ET job in this repo they
-- drift +1h during EST (Nov-Mar) -- an accepted, documented trade-off (see the Harness Cron Map
-- note in nv-vault); reply-scan timing is not minute-critical. To pin exact ET across DST later,
-- add a second row at the EST offset plus an isEstHour() guard in the route (the lead-finder
-- pattern) -- deliberately not done here to keep one scan per slot.
--   9am ET -> 13:00 UTC, 12pm -> 16:00, 3pm -> 19:00, 6pm -> 22:00.
--
-- pg_cron + pg_net are already enabled on kxijunwgbrlfzvgkhklo; CRON_SECRET already exists in
-- ni_platform_secrets (both confirmed 2026-09-03). Idempotent: each schedule is preceded by a
-- guarded unschedule, so this file can be re-run safely.

-- ---------------------------------------------------------------------------------------------
-- mf-outreach-response-scan-weekday -- 9am/12pm/3pm/6pm ET, Mon-Fri
-- ---------------------------------------------------------------------------------------------
select cron.unschedule('mf-outreach-response-scan-weekday') where exists (select 1 from cron.job where jobname = 'mf-outreach-response-scan-weekday');
select cron.schedule(
  'mf-outreach-response-scan-weekday',
  '0 13,16,19,22 * * 1-5',
  $$
  select net.http_get(
    url := 'https://match-fit.net/api/cron/outreach-response-scan',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || (select value from ni_platform_secrets where key = 'CRON_SECRET')
    )
  );
  $$
);

-- ---------------------------------------------------------------------------------------------
-- mf-outreach-response-scan-weekend -- 12pm ET, Sat + Sun
-- ---------------------------------------------------------------------------------------------
select cron.unschedule('mf-outreach-response-scan-weekend') where exists (select 1 from cron.job where jobname = 'mf-outreach-response-scan-weekend');
select cron.schedule(
  'mf-outreach-response-scan-weekend',
  '0 16 * * 0,6',
  $$
  select net.http_get(
    url := 'https://match-fit.net/api/cron/outreach-response-scan',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || (select value from ni_platform_secrets where key = 'CRON_SECRET')
    )
  );
  $$
);

-- Verify after applying:
--   select jobname, schedule, active from cron.job where jobname like 'mf-outreach-response-scan%';
