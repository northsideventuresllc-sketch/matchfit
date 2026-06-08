import { evaluateBetaTrainerRegistrationGate } from "@/lib/beta-trainer-register-gate";
import { BetaCapExceededError } from "@/lib/beta-cap-enforcement";
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
      return NextResponse.json({ error: "That username is already taken.", code: "USERNAME_TAKEN" }, { status: 409 });
    }
    if (await isTrainerEmailTaken(email)) {
      return NextResponse.json({ error: "That email is already registered.", code: "EMAIL_TAKEN" }, { status: 409 });
    }

    return NextResponse.json({ ok: true, next: "/trainer/signup/terms" });
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
