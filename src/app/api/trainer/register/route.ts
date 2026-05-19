import { applyTrainerSessionToNextResponse } from "@/lib/session";
import { sendTrainerWelcomeEmail } from "@/lib/trainer-welcome-email";
import { BetaCapExceededError } from "@/lib/beta-cap-enforcement";
import { createTrainerRecord } from "@/lib/trainer-register-service";
import { evaluateBetaTrainerRegistrationGate } from "@/lib/beta-trainer-register-gate";
import { markTrainerWaitlistRegistered } from "@/lib/beta-waitlist-service";
import { isTrainerEmailTaken, isTrainerUsernameTaken } from "@/lib/trainer-queries";
import { trainerSignupSchema } from "@/lib/validations/trainer-register";
import { publicApiErrorFromUnknown } from "@/lib/public-api-error";
import { verifyTurnstileToken } from "@/lib/turnstile-verify";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const parsed = trainerSignupSchema.safeParse(await req.json());
    if (!parsed.success) {
      const msg = parsed.error.issues[0]?.message ?? "Invalid registration.";
      return NextResponse.json({ error: msg }, { status: 400 });
    }
    const turn = await verifyTurnstileToken(parsed.data.turnstileToken, req);
    if (!turn.ok) {
      return NextResponse.json({ error: turn.error }, { status: turn.status });
    }
    const body = parsed.data;
    const username = body.username.trim();
    const email = body.email.trim().toLowerCase();

    const gate = await evaluateBetaTrainerRegistrationGate({
      serviceZipCode: body.serviceZipCode ?? "",
      email,
      username,
      betaInviteToken: body.betaInviteToken,
    });
    if (!gate.ok) {
      return NextResponse.json({ error: gate.error, code: gate.code }, { status: gate.status });
    }

    if (await isTrainerUsernameTaken(username)) {
      return NextResponse.json({ error: "That username is already taken." }, { status: 409 });
    }
    if (await isTrainerEmailTaken(email)) {
      return NextResponse.json({ error: "That email is already registered." }, { status: 409 });
    }

    const trainer = await createTrainerRecord(body, {
      betaInviteEntryId: gate.ok ? gate.betaInviteEntryId : null,
    });

    if (gate.ok && gate.betaInviteEntryId) {
      await markTrainerWaitlistRegistered(gate.betaInviteEntryId, trainer.id);
    }

    const res = NextResponse.json({ ok: true, next: "/trainer/onboarding" });
    await applyTrainerSessionToNextResponse(res, trainer.id, body.stayLoggedIn);
    void sendTrainerWelcomeEmail({
      to: email,
      firstName: body.firstName,
      trainerId: trainer.id,
    }).catch((err) => console.error("[trainer register] welcome email failed:", err));
    return res;
  } catch (e) {
    if (e instanceof BetaCapExceededError) {
      return NextResponse.json({ error: e.message, code: e.code }, { status: 403 });
    }
    const { message, status } = publicApiErrorFromUnknown(e, "Registration failed. Please try again.", {
      logLabel: "[Match Fit trainer register]",
    });
    return NextResponse.json({ error: message }, { status });
  }
}
