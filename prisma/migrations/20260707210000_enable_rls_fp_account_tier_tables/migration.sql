-- F1 RLS-8: FP account-tier tables from 20260623120000_fp_account_tiers.
-- Match Fit server routes use Prisma over DATABASE_URL (postgres role bypasses RLS).
-- PostgREST roles (anon, authenticated): deny-by-default once RLS is on with no permissive policies.

ALTER TABLE public.fp_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tier_switch_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fp_listing_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.featured_listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.promote_token_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fp_ad_integrations ENABLE ROW LEVEL SECURITY;
