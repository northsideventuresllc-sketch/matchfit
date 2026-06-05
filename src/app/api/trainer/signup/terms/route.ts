import { prisma } from "@/lib/prisma";
import {
  ensureTrainerRegisterSchema,
  isMissingTrainerRegisterSchemaError,
} from "@/lib/ensure-trainer-register-schema";
import {
  ensureTrainerSignupTermsSchema,
  isMissingTrainerSignupTermsColumnError,
  isTrainerSignupTermsAccessError,
} from "@/lib/ensure-trainer-signup-terms-schema";
import { getSessionTrainerId } from "@/lib/session";
import { resolveTrainerSignupNextPath } from "@/lib/trainer-signup-next-path";
import { trainerAgreementsSchema } from "@/lib/validations/trainer-register";
import { publicApiErrorFromUnknown } from "@/lib/public-api-error";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

async function saveTrainerAgreement(trainerId: string): Promise<void> {
  const now = new Date();
  await prisma.$transaction(async (tx) => {
    await tx.trainer.update({
      where: { id: trainerId },
      data: {
        termsAcceptedAt: now,
        privacyPolicyAcceptedAt: now,
      },
    });
    await tx.trainerProfile.upsert({
      where: { trainerId },
      create: {
        trainerId,
        hasSignedTOS: true,
        registrationFeeHoldStatus: "NOT_STARTED",
        registrationFeePricingMode: "FOUNDING_BG_SURCHARGE_20PCT",
        complianceCertFailedAttempts: 0,
      },
      update: { hasSignedTOS: true, updatedAt: now },
    });
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
    const trainerId = await getSessionTrainerId();
    if (!trainerId) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const parsed = trainerAgreementsSchema.safeParse(await req.json());
    if (!parsed.success) {
      const msg = parsed.error.issues[0]?.message ?? "Invalid request.";
      return NextResponse.json({ error: msg }, { status: 400 });
    }

    await ensureTrainerRegisterSchema();
    await ensureTrainerSignupTermsSchema();
    try {
      await saveTrainerAgreement(trainerId);
    } catch (e) {
      if (!isRepairableTrainerAgreementError(e)) throw e;
      await ensureTrainerRegisterSchema();
      await ensureTrainerSignupTermsSchema();
      await saveTrainerAgreement(trainerId);
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
        },
      });
    }

    return NextResponse.json({ ok: true, next: resolveTrainerSignupNextPath(profile) });
  } catch (e) {
    const { message, status } = publicApiErrorFromUnknown(e, "Could not save your agreement.", {
      logLabel: "[Match Fit trainer signup terms]",
    });
    return NextResponse.json({ error: message }, { status });
  }
}
