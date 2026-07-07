# Supabase RLS — sensitive Match Fit tables

Migration: `prisma/migrations/20260703120000_enable_rls_audit_sensitive_tables/migration.sql`

## Tables secured (deny-by-default for PostgREST)

| Table | App access path |
|-------|-----------------|
| `platform_secrets` | Prisma + direct `pg` in `readPlatformSecret()` |
| `administrators` | Prisma (`requireAdminSession`) |
| `pending_administrator_registrations` | Prisma admin bootstrap |
| `administrator_audit_logs` | Prisma admin impersonation audit |
| `outreach_*_leads` | Prisma Outreach HQ |
| `outreach_learning_signals` | Prisma + NI Brain sync |
| `platform_revenue_events` | Prisma admin metrics / Stripe webhooks |
| `support_inbox_messages` | Prisma Resend inbound webhook |
| `admin_ai_conversations` / `admin_ai_messages` | Prisma AI Assistant |
| `admin_goals` | Prisma admin assistant |
| `site_analytics_events` | Prisma via `/api/public/site-analytics` |
| `signup_form_progress` | Prisma signup progress API |
| `transactional_email_deliveries` | Prisma delivery log |
| `transactional_email_template_overrides` | Prisma admin email templates |
| `pending_transactional_email_template_changes` | Prisma admin email review |
| `ad_platform_daily_snapshots` | Prisma Ad Tracking HQ sync |
| `ad_campaign_registry` | Prisma Ad Tracking HQ campaign registry |

## FP account-tier tables (F1 RLS-8)

Migration: `prisma/migrations/20260707210000_enable_rls_fp_account_tier_tables/migration.sql`

| Table | App access path |
|-------|-----------------|
| `fp_documents` | Prisma trainer docs + admin FP document review |
| `tier_switch_history` | Prisma account-tier tier switches |
| `fp_listing_stats` | Prisma listing metrics / account-tier dashboard |
| `featured_listings` | Prisma featured placement bids |
| `promote_token_ledger` | Prisma promote token ledger |
| `support_groups` | Prisma Fitness Pro support groups |
| `support_group_members` | Prisma support group membership |
| `fp_ad_integrations` | Prisma FP ad platform connections |

## What is **not** used for these tables

- Browser Supabase client (`createBrowserClient`) — auth/session only
- `createSupabaseAdminClient()` — Supabase Auth admin APIs only
- Anon/authenticated JWT against PostgREST for reads or writes

## RLS behavior

- **Prisma / `postgres` connection role:** bypasses RLS (normal for Match Fit server).
- **`anon` / `authenticated` via PostgREST:** no policies → all operations denied on these tables.

Earlier marketplace tables are covered in `20260509140000_match_fit_row_level_security/migration.sql`.
