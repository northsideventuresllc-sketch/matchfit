-- Repair DB after failed migration `20260511190000_two_factor_channel_last_email_resend_at` (Prisma P3009).
-- Idempotent: safe if one or both columns already exist.
--
-- After this succeeds:
--   npx prisma migrate resolve --applied 20260511190000_two_factor_channel_last_email_resend_at
--   npx prisma migrate deploy
--
-- If deploy then fails on `20260513140000_web_push_and_remove_twilio_sms` (relation already exists), run
-- `scripts/fix-prisma-p3018-20260513140000-web-push-migration.sql`, then if Prisma still shows that migration as failed:
-- `npx prisma migrate resolve --rolled-back 20260513140000_web_push_and_remove_twilio_sms`,
-- then `npx prisma migrate resolve --applied 20260513140000_web_push_and_remove_twilio_sms`, then `npx prisma migrate deploy` again.

ALTER TABLE "public"."client_two_factor_channels" ADD COLUMN IF NOT EXISTS "lastEmailResendAt" TIMESTAMP(3);
ALTER TABLE "public"."trainer_two_factor_channels" ADD COLUMN IF NOT EXISTS "lastEmailResendAt" TIMESTAMP(3);
