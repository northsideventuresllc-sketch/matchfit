import { BetaCapExceededError } from "@/lib/beta-cap-enforcement";
import { evaluateBetaTrainerRegistrationGate } from "@/lib/beta-trainer-register-gate";
import {
  ensureTrainerRegisterSchema,
  isMissingTrainerRegisterSchemaError,
} from "@/lib/ensure-trainer-register-schema";
import {
  ensureTrainerSignupTermsSchema,
  isMissingTrainerSignupTermsColumnError,
  isTrainerSignupTermsAccessError,
} from "@/lib/ensure-trainer-signup-terms-schema";
import { prisma } from "@/lib/prisma";
import { applyTrainerSessionToNextResponse, getSessionTrainerId } from "@/lib/session";
import { createTrainerAccountAfterTermsAcceptance } from "@/lib/trainer-signup-after-terms";
import { resolveTrainerSignupNextPath } from "@/lib/trainer-signup-next-path";
import { markTrainerPendingAfterTermsAcceptance } from "@/lib/trainer-pending-onboarding";
import { trainerAgreementsSchema, trainerSignupSchema } from "@/lib/validations/trainer-register";
import { verifyTurnstileToken } from "@/lib/turnstile-verify";
import { publicApiErrorFromUnknown } from "@/lib/public-api-error";
import { NextResponse } from "next/server";
import { z } from "zod";

export const dynamic = "force-dynamic";

const trainerTermsWithSignupSchema = trainerAgreementsSchema.extend({
  signup: trainerSignupSchema.optional(),
  turnstileToken: z.string().optional(),
});

async function saveTrainerAgreementForExisting(trainerId: string): Promise<void> {
  await ensureTrainerRegisterSchema();
  await prisma.$transaction(async (tx) => {
    await markTrainerPendingAfterTermsAcceptance(trainerId, new Date(), tx);
  });
}

function isRepairableTrainerAgreementError(e: unknown): boolean {
  return (
    isMissingTrainerSignupTermsColumnError(e) ||
    isMissingTrainerRegisterSchemaError(e) ||
    isTrainerSignupTermsAccessError(e)
  );
}

export async function PATCH(req: Request) {
  try {
    const json = await req.json();
    const parsed = trainerTermsWithSignupSchema.safeParse(json);
    if (!parsed.success) {
      const msg = parsed.error.issues[0]?.message ?? "Invalid request.";
      return NextResponse.json({ error: msg }, { status: 400 });
    }

    const trainerId = await getSessionTrainerId();

    await ensureTrainerRegisterSchema();
    await ensureTrainerSignupTermsSchema();

    if (!trainerId) {
      if (!parsed.data.signup) {
        return NextResponse.json(
          { error: "Sign-up details are required before accepting the Fitness Pro agreement." },
          { status: 400 },
        );
      }
      const turn = await verifyTurnstileToken(parsed.data.turnstileToken ?? parsed.data.signup.turnstileToken, req);
      if (!turn.ok) {
        return NextResponse.json({ error: turn.error }, { status: turn.status });
      }

      const gate = await evaluateBetaTrainerRegistrationGate({
        serviceZipCode: parsed.data.signup.serviceZipCode ?? "",
        email: parsed.data.signup.email.trim().toLowerCase(),
        username: parsed.data.signup.username.trim(),
        betaInviteToken: parsed.data.signup.betaInviteToken,
      });
      if (!gate.ok) {
        return NextResponse.json({ error: gate.error, code: gate.code }, { status: gate.status });
      }

      let result;
      try {
        result = await createTrainerAccountAfterTermsAcceptance(parsed.data.signup, {
          betaInviteEntryId: gate.betaInviteEntryId,
        });
      } catch (e) {
        if (!isRepairableTrainerAgreementError(e)) throw e;
        await ensureTrainerRegisterSchema();
        await ensureTrainerSignupTermsSchema();
        result = await createTrainerAccountAfterTermsAcceptance(parsed.data.signup, {
          betaInviteEntryId: gate.betaInviteEntryId,
        });
      }

      if (!result.ok) {
        return NextResponse.json({ error: result.error, code: result.code }, { status: result.status });
      }

      const res = NextResponse.json({ ok: true, next: result.next, trainerId: result.trainerId });
      await applyTrainerSessionToNextResponse(res, result.trainerId, parsed.data.signup.stayLoggedIn ?? true);
      return res;
    }

    try {
      await saveTrainerAgreementForExisting(trainerId);
    } catch (e) {
      if (!isRepairableTrainerAgreementError(e)) throw e;
      await ensureTrainerRegisterSchema();
      await ensureTrainerSignupTermsSchema();
      await saveTrainerAgreementForExisting(trainerId);
    }

    let profile;
    try {
      profile = await prisma.trainerProfile.findUnique({
        where: { trainerId },
        select: {
          hasSignedTOS: true,
          registrationFeeHoldStatus: true,
          hasPaidRegistrationFee: true,
          limitedDashboardUnlockedAt: true,
          onboardingFeePaymentDeadlineAt: true,
          onboardingFeePaymentExpiredAt: true,
        },
      });
    } catch (e) {
      if (!isMissingTrainerRegisterSchemaError(e)) throw e;
      await ensureTrainerRegisterSchema();
      profile = await prisma.trainerProfile.findUnique({
        where: { trainerId },
        select: {
          hasSignedTOS: true,
          registrationFeeHoldStatus: true,
          hasPaidRegistrationFee: true,
          limitedDashboardUnlockedAt: true,
          onboardingFeePaymentDeadlineAt: true,
          onboardingFeePaymentExpiredAt: true,
        },
      });
    }

    return NextResponse.json({ ok: true, next: resolveTrainerSignupNextPath(profile) });
  } catch (e) {
    if (e instanceof BetaCapExceededError) {
      return NextResponse.json({ error: e.message, code: e.code }, { status: 403 });
    }
    const { message, status } = publicApiErrorFromUnknown(e, "Could not save your agreement.", {
      logLabel: "[Match Fit trainer signup terms]",
    });
    return NextResponse.json({ error: message }, { status });
  }
}
