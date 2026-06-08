import { enrichClientRegisterProfile } from "@/lib/client-register-profile-enrich";
import { isEmailTaken, isUsernameTaken, findDeactivatedClientForReactivation } from "@/lib/client-queries";
import { ensureClientPlatformTrialSchema } from "@/lib/ensure-client-platform-trial-schema";
import { BetaCapExceededError } from "@/lib/beta-cap-enforcement";
import { finalizeClientRegistrationFromSignup } from "@/lib/client-register-finalize";
import { purgeExpiredRegistrationHolds } from "@/lib/purge-registration-holds";
import { applyClientSessionToNextResponse } from "@/lib/session";
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
    await ensureClientPlatformTrialSchema();
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
    const body = await enrichClientRegisterProfile(parsed.data);
    if (!isAtLeast18(body.dateOfBirth)) {
      return NextResponse.json({ error: "You must be at least 18 years old." }, { status: 400 });
    }

    const username = body.username.trim();
    const email = body.email.trim().toLowerCase();

    const deactivated = await findDeactivatedClientForReactivation(email);
    if (deactivated) {
      return NextResponse.json(
        {
          error:
            "This email belongs to a deactivated Match Fit account. Pay to reactivate instead of creating a new account.",
          code: "ACCOUNT_REACTIVATION_REQUIRED",
          next: `/client/reactivate?email=${encodeURIComponent(email)}`,
        },
        { status: 409 },
      );
    }

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

    const result = await finalizeClientRegistrationFromSignup(body, {
      betaClientWaitlistEntryId: gate.betaClientWaitlistEntryId,
      twoFactorEnabled: false,
      twoFactorMethod: "NONE",
    });
    if (!result.ok) {
      return NextResponse.json(
        { error: result.error, code: result.code },
        { status: result.code === "BETA_CLIENT_CAP" ? 403 : 400 },
      );
    }

    const res = NextResponse.json({
      ok: true,
      clientId: result.clientId,
      next: "/client/dashboard/preferences/onboarding",
    });
    await applyClientSessionToNextResponse(res, result.clientId, body.stayLoggedIn);
    return res;
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
