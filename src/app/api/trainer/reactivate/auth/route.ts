import { findTrainerByIdentifier } from "@/lib/trainer-queries";
import { isTrainerAccountLoginBlocked } from "@/lib/trainer-platform-access";
import { verifyPassword } from "@/lib/password";
import { applyTrainerSessionToNextResponse } from "@/lib/session";
import { publicApiErrorFromUnknown } from "@/lib/public-api-error";
import { verifyTurnstileToken } from "@/lib/turnstile-verify";
import { NextResponse } from "next/server";
import { z } from "zod";

const bodySchema = z.object({
  identifier: z.string().min(1),
  password: z.string().min(1),
  turnstileToken: z.string().optional(),
});

export async function POST(req: Request) {
  try {
    const parsed = bodySchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid reactivation request." }, { status: 400 });
    }
    const turn = await verifyTurnstileToken(parsed.data.turnstileToken, req);
    if (!turn.ok) {
      return NextResponse.json({ error: turn.error }, { status: turn.status });
    }

    const trainer = await findTrainerByIdentifier(parsed.data.identifier);
    if (!trainer) {
      return NextResponse.json({ error: "Invalid credentials." }, { status: 401 });
    }
    const ok = await verifyPassword(parsed.data.password, trainer.passwordHash);
    if (!ok) {
      return NextResponse.json({ error: "Invalid credentials." }, { status: 401 });
    }
    if (
      !isTrainerAccountLoginBlocked({
        stripeSubscriptionId: trainer.stripeSubscriptionId,
        stripeSubscriptionActive: trainer.stripeSubscriptionActive,
        subscriptionGraceUntil: trainer.subscriptionGraceUntil,
        platformTrialEndsAt: trainer.platformTrialEndsAt,
        paymentGraceUntil: trainer.paymentGraceUntil,
        accountDeactivatedAt: trainer.accountDeactivatedAt,
        platformTrialConsumed: trainer.platformTrialConsumed,
      })
    ) {
      return NextResponse.json(
        { error: "This account is not deactivated. Sign in normally instead.", code: "NOT_DEACTIVATED" },
        { status: 400 },
      );
    }

    const res = NextResponse.json({ ok: true, next: "/trainer/reactivate/checkout" });
    await applyTrainerSessionToNextResponse(res, trainer.id, trainer.stayLoggedIn);
    return res;
  } catch (e) {
    const { message, status } = publicApiErrorFromUnknown(e, "Could not verify your account.", {
      logLabel: "[Match Fit trainer reactivate-auth]",
    });
    return NextResponse.json({ error: message }, { status });
  }
}
