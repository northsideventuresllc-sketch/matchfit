import { applyTrainerSessionToNextResponse } from "@/lib/session";
import { sendTrainerWelcomeEmail } from "@/lib/trainer-welcome-email";
import { createTrainerRecord } from "@/lib/trainer-register-service";
import { isTrainerEmailBlockedFromRegistration } from "@/lib/trainer-background-check-deny";
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

    if (await isTrainerUsernameTaken(username)) {
      return NextResponse.json({ error: "That username is already taken." }, { status: 409 });
    }
    if (await isTrainerEmailTaken(email)) {
      return NextResponse.json({ error: "That email is already registered." }, { status: 409 });
    }
    if (await isTrainerEmailBlockedFromRegistration(email)) {
      return NextResponse.json(
        {
          error:
            "This email cannot register a new trainer account. Contact support@match-fit.net if you believe this is an error.",
        },
        { status: 403 },
      );
    }

    const trainer = await createTrainerRecord(body);

    const res = NextResponse.json({ ok: true, next: "/trainer/onboarding" });
    await applyTrainerSessionToNextResponse(res, trainer.id, body.stayLoggedIn);
    void sendTrainerWelcomeEmail({
      to: email,
      firstName: body.firstName,
      trainerId: trainer.id,
    }).catch((err) => console.error("[trainer register] welcome email failed:", err));
    return res;
  } catch (e) {
    const { message, status } = publicApiErrorFromUnknown(e, "Registration failed. Please try again.", {
      logLabel: "[Match Fit trainer register]",
    });
    return NextResponse.json({ error: message }, { status });
  }
}
