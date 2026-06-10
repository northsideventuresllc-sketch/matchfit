import {
  supabaseSignupVerificationDeliveryConfigured,
  supabaseSignupVerificationHealthMessage,
} from "@/lib/supabase-signup-verification-email";
import { isSupabaseAdminConfigured } from "@/lib/supabase/admin-client";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const resendConfigured = Boolean(process.env.RESEND_API_KEY?.trim());
  const supabaseAdminConfigured = isSupabaseAdminConfigured();
  const deliveryConfigured = supabaseSignupVerificationDeliveryConfigured();

  return NextResponse.json({
    healthy: deliveryConfigured,
    resendConfigured,
    supabaseAdminConfigured,
    deliveryConfigured,
    message: supabaseSignupVerificationHealthMessage(),
    deployCommit: process.env.VERCEL_GIT_COMMIT_SHA ?? null,
  });
}
