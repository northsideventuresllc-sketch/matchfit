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

## Remaining unprotected tables (2026-09-14 audit)

Migration: `prisma/migrations/20260914120000_enable_rls_remaining_unprotected_tables/migration.sql`

Found by diffing every `@@map(...)` table in `prisma/schema.prisma` against every
`ENABLE ROW LEVEL SECURITY` statement across `prisma/migrations/*` — the same method
used for the two migrations above. All access is via Prisma; none have a PostgREST
(browser Supabase client) read/write path.

| Table | App access path |
|-------|-----------------|
| `trainer_earnings_balances` | Prisma trainer payouts / earnings ledger |
| `trainer_earnings_ledger_entries` | Prisma trainer earnings ledger |
| `trainer_payout_requests` | Prisma trainer payout requests |
| `trainer_payout_schedules` | Prisma trainer payout schedules |
| `trainer_drafts` | Prisma trainer draft autosave |
| `pending_trainer_resume_signup_nudges` | Prisma trainer resume signup nudge cron |
| `outreach_cowork_dispatch_batches` | Prisma Outreach HQ cowork dispatch |
| `outreach_cowork_scan_jobs` | Prisma Outreach HQ cowork scan jobs |
| `outreach_daily_templates` | Prisma Outreach HQ daily templates |
| `outreach_lead_touch_log` | Prisma Outreach HQ lead touch log |
| `beta_client_waitlist_entries` | Prisma client beta waitlist |
| `beta_trainer_waitlist_entries` | Prisma trainer beta waitlist |
| `internal_qa_client_daily_cursors` | Prisma internal QA account reset cron |
| `internal_qa_trainer_daily_cursors` | Prisma internal QA account reset cron |
| `internal_qa_deferred_official_chats` | Prisma internal QA account reset cron |
| `web_push_subscriptions` | Prisma web push notify |
| `ventures` | Prisma venture/offering DPMO |
| `venture_offerings` | Prisma venture/offering DPMO |
| `venture_offering_categories` | Prisma venture/offering DPMO |
| `venture_audiences` | Prisma venture/offering DPMO |

## What is **not** used for these tables

- Browser Supabase client (`createBrowserClient`) — auth/session only
- `createSupabaseAdminClient()` — Supabase Auth admin APIs only
- Anon/authenticated JWT against PostgREST for reads or writes

## RLS behavior

- **Prisma / `postgres` connection role:** bypasses RLS (normal for Match Fit server).
- **`anon` / `authenticated` via PostgREST:** no policies → all operations denied on these tables.

Earlier marketplace tables are covered in `20260509140000_match_fit_row_level_security/migration.sql`.
