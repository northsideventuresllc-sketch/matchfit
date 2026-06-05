import {
  supabaseSignupVerificationDeliveryConfigured,
  supabaseSignupVerificationHealthMessage,
} from "@/lib/supabase-signup-verification-email";
import { isSupabaseAdminConfigured } from "@/lib/supabase/admin-client";
import { resendEmailHealth } from "@/lib/resend-email-health";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const resendProbe = await resendEmailHealth();
  const resendConfigured = resendProbe.configured && resendProbe.apiReachable;
  const supabaseAdminConfigured = isSupabaseAdminConfigured();
  const deliveryConfigured = supabaseAdminConfigured && resendConfigured;

  return NextResponse.json({
    healthy: deliveryConfigured,
    resendConfigured,
    resendApiReachable: resendProbe.apiReachable,
    resendLoadedFromPlatformSecrets: resendProbe.loadedFromPlatformSecrets,
    supabaseAdminConfigured,
    deliveryConfigured,
    message: deliveryConfigured
      ? "Trainer/client signup verification emails are delivered via Resend (Supabase SMTP is not used)."
      : supabaseSignupVerificationHealthMessage(),
    deployCommit: process.env.VERCEL_GIT_COMMIT_SHA ?? null,
  });
}
