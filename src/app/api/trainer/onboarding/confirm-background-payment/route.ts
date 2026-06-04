import { confirmTrainerBackgroundCheckPaymentIntent } from "@/lib/trainer-background-check-stripe";
import { syncTrainerComplianceWindow } from "@/lib/trainer-compliance-window-sync";
import { getSessionTrainerId } from "@/lib/session";
import { publicApiErrorFromUnknown } from "@/lib/public-api-error";
import { NextResponse } from "next/server";
import { z } from "zod";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  paymentIntentId: z.string().min(1),
});

/**
 * After Stripe.js confirms payment on the client, persist `hasPaidBackgroundFee` immediately
 * so `loadMe()` unlocks onboarding without waiting for the webhook.
 */
export async function POST(req: Request) {
  try {
    const trainerId = await getSessionTrainerId();
    if (!trainerId) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json({ error: "paymentIntentId is required." }, { status: 400 });
    }

    await confirmTrainerBackgroundCheckPaymentIntent({
      trainerId,
      paymentIntentId: parsed.data.paymentIntentId.trim(),
    });
    await syncTrainerComplianceWindow(trainerId);

    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Could not confirm payment.";
    if (msg.includes("STRIPE_SECRET_KEY")) {
      return NextResponse.json({ error: msg }, { status: 503 });
    }
    const { message, status } = publicApiErrorFromUnknown(e, "Could not confirm payment.", {
      logLabel: "[trainer confirm background payment]",
    });
    return NextResponse.json({ error: message }, { status });
  }
}
