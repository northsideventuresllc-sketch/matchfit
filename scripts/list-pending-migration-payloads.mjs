#!/usr/bin/env node
/**
 * Computes pending migration SQL + Prisma checksums for production apply.
 */
import { createHash, randomUUID } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const root = new URL("..", import.meta.url).pathname;
const migrationsDir = join(root, "prisma/migrations");

const applied = new Set([
  "20260420232010_init",
  "20260420233845_billing_hold_and_client_stripe",
  "20260421223307_stay_logged_in_password_change",
  "20260421225455_two_factor_login_attempts",
  "20260421233106_client_profile_and_contact_change",
  "20260422180000_trainer_onboarding",
  "20260422190000_trainer_dashboard_profile_fields",
  "20260422200000_trainer_match_questionnaire_answers",
  "20260422210000_trainer_ai_match_profile_text",
  "20260423120000_client_two_factor_channels",
  "20260423140000_trainer_onboarding_expansion",
  "20260423160000_trainer_w9_self_serve_otp",
  "20260424120000_trainer_onboarding_tracks",
  "20260424180000_client_dashboard_prefs_nudges",
  "20260424200000_client_notifications_and_billing_flags",
  "20260424213000_client_fithub",
  "20260425120000_client_daily_questionnaire",
  "20260427120000_fithub_demo_seed_and_content_reports",
  "20260428000000_client_fithub_share_dedup_and_billing_fixes",
  "20260428170000_client_bug_reports",
  "20260428210000_trainer_fithub_scheduling_visibility_carousel",
  "20260428233000_trainer_promo_tokens",
  "20260429100000_client_saved_trainers",
  "20260429120000_coach_purchase_side_effects",
  "20260429140000_trainer_fithub_studio_activity_seen",
  "20260429160000_trainer_fithub_studio_activity_read_keys",
  "20260429180000_trainer_service_offerings_json",
  "20260429203000_trainer_specialist_track_other_cert_review",
  "20260429220000_tos_compliance_chat_sessions",
  "20260430120000_privacy_compliance_audit",
  "20260430153000_chat_message_attachments",
  "20260430180000_client_trainer_reviews",
  "20260430180000_trainer_client_conversation_archive_unmatch",
  "20260430190000_client_daily_questionnaire_archived_at",
  "20260430200000_booking_availability_calls",
  "20260430200000_client_notification_archived_at",
  "20260430200000_client_trainer_browse_pass",
  "20260430213000_trainer_public_self_booking",
  "20260501120000_client_trainer_browse_pass_last_passed_at",
  "20260501180000_user_block_scopes",
  "20260502100000_phone_bridge_video_meetings",
  "20260502140000_session_delivery_virtual_prefs",
  "20260503120000_client_bug_reports_nullable_client_id",
  "20260504210000_trainer_profile_service_checkout_toggle",
  "20260505120000_session_check_in_system",
  "20260506180000_financial_ledgers_gates_disputes",
  "20260506183000_trainer_business_mileage_expense",
  "20260506200000_trainer_client_coaching",
  "20260507120000_marketplace_governance_extensions",
  "20260507183000_trainer_dashboard_quick_links",
  "20260508100000_client_dashboard_quick_links",
  "20260508130000_admin_portal",
  "20260508140000_product_idea_submissions",
  "20260509140000_match_fit_row_level_security",
  "20260509150000_drop_supabase_template_public_profiles",
  "20260509160000_two_factor_channel_last_code_expires",
  "20260511190000_two_factor_channel_last_email_resend_at",
  "20260513140000_web_push_and_remove_twilio_sms",
  "20260514120000_beta_waitlist_entries",
  "20260514120000_trainer_microsoft_oauth_grant_source",
  "20260514120100_pending_client_beta_waitlist",
  "20260515120000_trainer_billing_checkr_zip",
  "20260515153000_client_stripe_last_invoice_paid_at",
  "20260515182000_internal_qa_sandbox",
  "20260518120000_launch_cohort_and_trials",
  "20260521120000_stripe_connect_demo_sellers",
  "20260527160000_admin_audit_platform_revenue",
  "20260527230000_account_deletion_grace",
  "20260528120000_site_analytics_events",
  "20260528140000_client_stripe_billing_live_mode",
  "20260529120000_admin_analytics_dashboard",
  "20260601120000_admin_dashboard_layout",
  "20260601180000_scrub_sandbox_revenue_events",
  "20260603120000_background_check_plan_b",
  "20260603120000_trainer_compliance_window_signup_hold",
  "20260604120000_client_platform_trial_flow",
  "20260604180000_fix_client_platform_trial_columns",
  "20260606120000_outreach_hq",
  "20260606180000_ad_tracking_performance",
  "20260622120000_add_trainer_draft",
]);

const all = readdirSync(migrationsDir)
  .filter((name) => /^\d/.test(name))
  .sort();

const pending = all.filter((name) => !applied.has(name));

const rows = pending.map((name) => {
  const sqlPath = join(migrationsDir, name, "migration.sql");
  const sql = readFileSync(sqlPath, "utf8");
  const checksum = createHash("sha256").update(sql).digest("hex");
  return { name, checksum, sql, id: randomUUID() };
});

console.log(JSON.stringify(rows, null, 2));
