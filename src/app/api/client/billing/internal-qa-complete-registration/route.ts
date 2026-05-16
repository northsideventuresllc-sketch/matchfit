import { finalizeInternalQaClientRegistrationFromHold } from "@/lib/billing-finalize";
import { purgeExpiredRegistrationHolds } from "@/lib/purge-registration-holds";
import { prisma } from "@/lib/prisma";
import { verifyPassword } from "@/lib/password";
import { clearRegistrationHoldCookie, getRegistrationHoldPendingId } from "@/lib/session";
import { isMatchFitInternalQaClientEmail } from "@/lib/match-fit-internal-qa";
import { NextResponse } from "next/server";
import { z } from "zod";

const bodySchema = z.object({
  password: z.string().min(1),
});

export async function POST(req: Request) {
  try {
    await purgeExpiredRegistrationHolds();

    const holdId = await getRegistrationHoldPendingId();
    if (!holdId) {
      return NextResponse.json({ error: "No registration in progress." }, { status: 401 });
    }

    const hold = await prisma.pendingClientRegistration.findUnique({
      where: { id: holdId },
    });
    if (!hold || hold.expiresAt < new Date()) {
      await clearRegistrationHoldCookie();
      return NextResponse.json({ error: "Your registration session expired. Please start again." }, { status: 410 });
    }
    if (hold.status !== "AWAITING_PAYMENT") {
      return NextResponse.json({ error: "This account is not ready for billing." }, { status: 400 });
    }
    if (!isMatchFitInternalQaClientEmail(hold.email)) {
      return NextResponse.json({ error: "This bypass is not available for this account." }, { status: 403 });
    }

    const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json({ error: "Password is required." }, { status: 400 });
    }

    const ok = await verifyPassword(parsed.data.password, hold.passwordHash);
    if (!ok) {
      return NextResponse.json({ error: "Incorrect password." }, { status: 401 });
    }

    const fin = await finalizeInternalQaClientRegistrationFromHold(hold.id);
    if (!fin.ok) {
      return NextResponse.json({ error: fin.error }, { status: 400 });
    }

    await clearRegistrationHoldCookie();
    return NextResponse.json({ ok: true, next: "/client/login?registered=1" });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Could not complete registration." }, { status: 500 });
  }
}
