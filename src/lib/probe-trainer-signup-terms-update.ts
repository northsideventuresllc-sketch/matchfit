import { prisma } from "@/lib/prisma";
import {
  ensureTrainerSignupTermsSchema,
  isMissingTrainerSignupTermsColumnError,
} from "@/lib/ensure-trainer-signup-terms-schema";

export type TrainerSignupTermsProbeResult =
  | { ok: true }
  | { ok: false; code: string; message: string };

/** Rolls back after updating terms fields — validates trainer agreement PATCH DB writes. */
export async function probeTrainerSignupTermsUpdate(): Promise<TrainerSignupTermsProbeResult> {
  const suffix = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const username = `mf_terms_probe_${suffix}`.slice(0, 28);
  const email = `mf.terms.probe.${suffix}@internal.match-fit.invalid`;

  try {
    await ensureTrainerSignupTermsSchema();
  } catch (e) {
    return {
      ok: false,
      code: "TRAINER_TERMS_SCHEMA_REPAIR_FAILED",
      message: e instanceof Error ? e.message : String(e),
    };
  }

  try {
    await prisma.$transaction(async (tx) => {
      const trainer = await tx.trainer.create({
        data: {
          firstName: "Probe",
          lastName: "Terms",
          username,
          phone: "5555550199",
          email,
          passwordHash: "probe",
          profile: {
            create: {
              hasSignedTOS: false,
              registrationFeeHoldStatus: "NOT_STARTED",
            },
          },
        },
        select: { id: true },
      });

      const now = new Date();
      await tx.trainer.update({
        where: { id: trainer.id },
        data: {
          termsAcceptedAt: now,
          privacyPolicyAcceptedAt: now,
        },
      });
      await tx.trainerProfile.update({
        where: { trainerId: trainer.id },
        data: { hasSignedTOS: true, updatedAt: now },
      });

      throw new Error("PROBE_ROLLBACK");
    });
    return { ok: true };
  } catch (e) {
    if (e instanceof Error && e.message === "PROBE_ROLLBACK") {
      return { ok: true };
    }
    if (isMissingTrainerSignupTermsColumnError(e)) {
      return {
        ok: false,
        code: "TRAINER_TERMS_COLUMNS_MISSING",
        message: e instanceof Error ? e.message : String(e),
      };
    }
    return {
      ok: false,
      code: "TRAINER_TERMS_PROBE_FAILED",
      message: e instanceof Error ? e.message : String(e),
    };
  }
}
