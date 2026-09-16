-- Security audit follow-up (2026-09-14): enable RLS on every table that was still
-- unprotected. Derived by diffing every @@map(...) table name in prisma/schema.prisma
-- against every `ENABLE ROW LEVEL SECURITY` statement across prisma/migrations/*,
-- same method used for 20260703120000_enable_rls_audit_sensitive_tables.
--
-- Match Fit server routes access these tables exclusively via Prisma over
-- DATABASE_URL (postgres / pooler role bypasses RLS). None of them have a
-- PostgREST (browser Supabase client) read or write path, so this is a no-op
-- for app behavior — PostgREST roles (anon, authenticated) are deny-by-default
-- once RLS is on with no permissive policies, same approach as every prior
-- RLS migration in this repo.

-- ---------------------------------------------------------------------------
-- ENABLE ROW LEVEL SECURITY (idempotent)
-- ---------------------------------------------------------------------------

ALTER TABLE public.trainer_earnings_balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trainer_earnings_ledger_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trainer_payout_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trainer_payout_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trainer_drafts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pending_trainer_resume_signup_nudges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.outreach_cowork_dispatch_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.outreach_cowork_scan_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.outreach_daily_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.outreach_lead_touch_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.beta_client_waitlist_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.beta_trainer_waitlist_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.internal_qa_client_daily_cursors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.internal_qa_trainer_daily_cursors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.internal_qa_deferred_official_chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.web_push_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ventures ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.venture_offerings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.venture_offering_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.venture_audiences ENABLE ROW LEVEL SECURITY;
