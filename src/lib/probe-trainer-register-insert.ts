import { ensureTrainerRegisterSchema } from "@/lib/ensure-trainer-register-schema";
import { prisma } from "@/lib/prisma";

export type TrainerRegisterInsertProbeResult =
  | { ok: true }
  | { ok: false; code: string; message: string };

/**
 * Attempts a minimal trainers + trainer_profiles INSERT inside a transaction and rolls back.
 * Surfaces NOT NULL / schema drift issues that column counts alone miss.
 */
export async function probeTrainerRegisterInsert(): Promise<TrainerRegisterInsertProbeResult> {
  const suffix = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const username = `mf_tr_probe_${suffix}`.slice(0, 28);
  const email = `mf.trainer.probe.${suffix}@internal.match-fit.invalid`;

  try {
    await ensureTrainerRegisterSchema();
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return { ok: false, code: "TRAINER_SCHEMA_REPAIR_FAILED", message };
  }

  try {
    await prisma.$transaction(async (tx) => {
      await tx.trainer.create({
        data: {
          firstName: "Probe",
          lastName: "Trainer",
          username,
          phone: "5555550199",
          email,
          passwordHash: "probe",
          profile: {
            create: {
              registrationFeeWaived: true,
              registrationFeePricingMode: "FOUNDING_BG_SURCHARGE_20PCT",
              hasSignedTOS: false,
              registrationFeeHoldStatus: "NOT_STARTED",
              complianceCertFailedAttempts: 0,
              serviceZipCode: "30301",
              backgroundCheckStatus: "NOT_STARTED",
              certificationReviewStatus: "NOT_STARTED",
              nutritionistCertificationReviewStatus: "NOT_STARTED",
              specialistCertificationReviewStatus: "NOT_STARTED",
              backgroundCheckReviewStatus: "NOT_STARTED",
              onboardingTrackCpt: false,
              onboardingTrackNutrition: false,
              onboardingTrackSpecialist: false,
              otherCertificationReviewStatus: "NOT_STARTED",
            },
          },
        },
      });
      throw new Error("PROBE_ROLLBACK");
    });
    return { ok: true };
  } catch (e) {
    if (e instanceof Error && e.message === "PROBE_ROLLBACK") {
      return { ok: true };
    }
    const message = e instanceof Error ? e.message : String(e);
    if (message.includes("termsAcceptedAt") && message.includes("null")) {
      return { ok: false, code: "TERMS_ACCEPTED_AT_NOT_NULL", message };
    }
    return { ok: false, code: "TRAINER_INSERT_PROBE_FAILED", message };
  }
}
