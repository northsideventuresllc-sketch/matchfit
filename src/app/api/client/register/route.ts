import { isEmailTaken, isUsernameTaken } from "@/lib/client-queries";
import { BetaCapExceededError } from "@/lib/beta-cap-enforcement";
import { createClientRegistrationHold } from "@/lib/client-registration-hold";
import { purgeExpiredRegistrationHolds } from "@/lib/purge-registration-holds";
import { setRegistrationHoldCookie } from "@/lib/session";
import {
  firstZodErrorMessage,
  normalizeRegisterJson,
  registerSkipSchema,
} from "@/lib/validations/client-register";
import { publicApiErrorFromUnknown } from "@/lib/public-api-error";
import { verifyTurnstileToken } from "@/lib/turnstile-verify";
import { evaluateBetaClientRegistrationGate } from "@/lib/beta-client-register-gate";
import { NextResponse } from "next/server";

function isAtLeast18(birthYmd: string): boolean {
  const [y, m, d] = birthYmd.split("-").map(Number);
  if (!y || !m || !d) return false;
  const birth = new Date(y, m - 1, d);
  const cutoff = new Date();
  cutoff.setFullYear(cutoff.getFullYear() - 18);
  return birth <= cutoff;
}

export async function POST(req: Request) {
  try {
    await purgeExpiredRegistrationHolds();

    const json = await req.json();
    const parsed = registerSkipSchema.safeParse(normalizeRegisterJson(json));
    if (!parsed.success) {
      return NextResponse.json({ error: firstZodErrorMessage(parsed.error) }, { status: 400 });
    }
    const turn = await verifyTurnstileToken(parsed.data.turnstileToken, req);
    if (!turn.ok) {
      return NextResponse.json({ error: turn.error }, { status: turn.status });
    }
    const body = parsed.data;
    if (!isAtLeast18(body.dateOfBirth)) {
      return NextResponse.json({ error: "You must be at least 18 years old." }, { status: 400 });
    }

    const username = body.username.trim();
    const email = body.email.trim().toLowerCase();

    const gate = await evaluateBetaClientRegistrationGate({
      zipCode: body.zipCode,
      email,
      username,
      betaInviteToken: body.betaInviteToken,
    });
    if (!gate.ok) {
      return NextResponse.json({ error: gate.error, code: gate.code }, { status: gate.status });
    }

    if (await isUsernameTaken(username)) {
      return NextResponse.json({ error: "That username is already taken." }, { status: 409 });
    }
    if (await isEmailTaken(email)) {
      return NextResponse.json({ error: "That email is already registered." }, { status: 409 });
    }

    const pending = await createClientRegistrationHold(body, {
      betaClientWaitlistEntryId: gate.betaClientWaitlistEntryId,
      status: "AWAITING_PAYMENT",
      twoFactorEnabled: false,
      twoFactorMethod: "NONE",
      otpHash: null,
      otpExpiresAt: null,
    });

    await setRegistrationHoldCookie(pending.id);
    return NextResponse.json({ ok: true, pendingId: pending.id, next: "/client/subscribe" });
  } catch (e) {
    if (e instanceof BetaCapExceededError) {
      return NextResponse.json({ error: e.message, code: e.code }, { status: 403 });
    }
    const { message, status } = publicApiErrorFromUnknown(e, "Registration failed. Please try again.", {
      logLabel: "[Match Fit register]",
    });
    return NextResponse.json({ error: message }, { status });
  }
}
