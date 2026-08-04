import { getSessionTrainerId } from "@/lib/session";
import { sendTrainerDashboardVerificationEmail } from "@/lib/trainer-email-verification";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Sends the signed-in Fitness Pro a fresh email confirmation link. The address comes from
 * their own trainer row, so this can never be pointed at someone else's inbox.
 */
export async function POST() {
  const trainerId = await getSessionTrainerId();
  if (!trainerId) {
    return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  }

  const result = await sendTrainerDashboardVerificationEmail(trainerId);
  if (!result.ok) {
    const status =
      result.code === "RESEND_COOLDOWN" || result.code === "EMAIL_RATE_LIMIT"
        ? 429
        : result.code === "DELIVERY_NOT_CONFIGURED"
          ? 503
          : result.code === "TRAINER_NOT_FOUND"
            ? 404
            : 400;
    return NextResponse.json(
      { error: result.error, code: result.code, retryAfterSeconds: result.retryAfterSeconds ?? null },
      { status },
    );
  }

  return NextResponse.json({ ok: true, alreadyVerified: result.alreadyVerified });
}
