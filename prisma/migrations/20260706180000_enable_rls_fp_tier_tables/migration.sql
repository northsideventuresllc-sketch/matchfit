-- Supabase security audit follow-up (2026-07-06): enable RLS on the 8 FP tier tables
-- created by 20260623120000_fp_account_tiers, which shipped without RLS and were
-- flagged ERROR-level (rls_disabled_in_public) by the Supabase security advisor.
--
-- Match Fit server routes access these tables exclusively via Prisma over
-- DATABASE_URL (postgres / pooler role bypasses RLS). No PostgREST reads or
-- writes exist for these tables, so PostgREST roles (anon, authenticated) are
-- deny-by-default once RLS is on with no permissive policies — same approach
-- as 20260703120000_enable_rls_audit_sensitive_tables.

-- ---------------------------------------------------------------------------
-- ENABLE ROW LEVEL SECURITY (idempotent)
-- ---------------------------------------------------------------------------

ALTER TABLE public.fp_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tier_switch_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fp_listing_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.featured_listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.promote_token_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fp_ad_integrations ENABLE ROW LEVEL SECURITY;
