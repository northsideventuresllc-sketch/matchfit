-- Supabase security audit (2026-06-20): enable RLS on admin, outreach, analytics, and secrets tables.
-- Match Fit server routes use Prisma over DATABASE_URL (postgres / pooler role bypasses RLS).
-- Supabase Auth admin client is auth-only — not used for PostgREST reads on these tables.
-- PostgREST roles (anon, authenticated): deny-by-default once RLS is on and no permissive policies exist.
--
-- Intentional anon INSERT policies added outside Prisma (e.g. direct PostgREST) are removed below;
-- production ingests via Next.js API routes + Prisma instead.

-- ---------------------------------------------------------------------------
-- ENABLE ROW LEVEL SECURITY (idempotent)
-- ---------------------------------------------------------------------------

ALTER TABLE public.platform_secrets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.administrators ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pending_administrator_registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.administrator_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.outreach_instagram_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.outreach_facebook_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.outreach_email_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.outreach_other_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_revenue_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_inbox_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_ai_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_ai_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.site_analytics_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.signup_form_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.outreach_learning_signals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactional_email_deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactional_email_template_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pending_transactional_email_template_changes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ad_platform_daily_snapshots ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- Remove legacy PostgREST anon INSERT policies (server uses Prisma instead)
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS allow_anon_insert_analytics ON public.site_analytics_events;
DROP POLICY IF EXISTS allow_anon_insert_signup_progress ON public.signup_form_progress;
DROP POLICY IF EXISTS allow_anon_insert_support_messages ON public.support_inbox_messages;
DROP POLICY IF EXISTS allow_anon_insert_email_deliveries ON public.transactional_email_deliveries;
