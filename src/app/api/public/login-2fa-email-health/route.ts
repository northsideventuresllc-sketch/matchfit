import { directPostgresUrlSource } from "@/lib/direct-postgres-ddl";
import { resendEmailHealth } from "@/lib/resend-email-health";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/** Public readiness check for login/signup OTP email delivery via Resend. */
export async function GET() {
  const probe = await resendEmailHealth();
  const healthy =
    probe.configured && probe.apiReachable && probe.domainVerified !== false;

  let message: string;
  if (healthy && probe.domainVerified === true) {
    message = "Login and signup OTP emails are ready (Resend + verified match-fit.net domain).";
  } else if (!probe.configured) {
    message = "RESEND_API_KEY is missing in production environment variables.";
  } else if (!probe.apiReachable) {
    message = `RESEND_API_KEY is set but Resend rejected API calls: ${probe.error ?? "unknown error"}`;
  } else if (probe.domainVerified === false) {
    message = "match-fit.net is not verified in Resend — OTP emails may be rejected.";
  } else {
    message = "Resend is partially configured.";
  }

  return NextResponse.json({
    healthy,
    resendConfigured: probe.configured,
    resendApiReachable: probe.apiReachable,
    fromAddress: probe.fromAddress,
    domainVerified: probe.domainVerified,
    loadedFromPlatformSecrets: probe.loadedFromPlatformSecrets,
    directPostgresUrlSource: directPostgresUrlSource(),
    resendError: probe.error,
    deployCommit: process.env.VERCEL_GIT_COMMIT_SHA ?? null,
    message,
  });
}
