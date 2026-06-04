import { findClientByIdentifier } from "@/lib/client-queries";
import { isClientAccountLoginBlocked } from "@/lib/client-billing-access";
import { verifyPassword } from "@/lib/password";
import { applyClientSessionToNextResponse } from "@/lib/session";
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

    const client = await findClientByIdentifier(parsed.data.identifier);
    if (!client) {
      return NextResponse.json({ error: "Invalid credentials." }, { status: 401 });
    }
    const ok = await verifyPassword(parsed.data.password, client.passwordHash);
    if (!ok) {
      return NextResponse.json({ error: "Invalid credentials." }, { status: 401 });
    }
    if (
      !isClientAccountLoginBlocked({
        stripeSubscriptionId: client.stripeSubscriptionId,
        stripeSubscriptionActive: client.stripeSubscriptionActive,
        subscriptionGraceUntil: client.subscriptionGraceUntil,
        platformTrialEndsAt: client.platformTrialEndsAt,
        paymentGraceUntil: client.paymentGraceUntil,
        accountDeactivatedAt: client.accountDeactivatedAt,
        platformTrialConsumed: client.platformTrialConsumed,
      })
    ) {
      return NextResponse.json(
        { error: "This account is not deactivated. Sign in normally instead.", code: "NOT_DEACTIVATED" },
        { status: 400 },
      );
    }

    const res = NextResponse.json({ ok: true, next: "/client/reactivate/checkout" });
    await applyClientSessionToNextResponse(res, client.id, client.stayLoggedIn);
    return res;
  } catch (e) {
    const { message, status } = publicApiErrorFromUnknown(e, "Could not verify your account.", {
      logLabel: "[Match Fit reactivate-auth]",
    });
    return NextResponse.json({ error: message }, { status });
  }
}
