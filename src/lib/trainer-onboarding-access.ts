import { prisma } from "@/lib/prisma";

export type TrainerOnboardingAccess =
  | { allowed: true }
  | { allowed: false; code: "DENIED" | "BLOCKED"; message: string };

export async function getTrainerOnboardingAccess(trainerId: string): Promise<TrainerOnboardingAccess> {
  const trainer = await prisma.trainer.findUnique({
    where: { id: trainerId },
    select: {
      deidentifiedAt: true,
      profile: { select: { backgroundCheckStatus: true } },
    },
  });

  if (!trainer) {
    return { allowed: false, code: "BLOCKED", message: "Unauthorized." };
  }

  if (trainer.deidentifiedAt) {
    return {
      allowed: false,
      code: "DENIED",
      message:
        "Your Match Fit trainer application was not approved. You cannot continue onboarding or use the platform with this account.",
    };
  }

  const bg = trainer.profile?.backgroundCheckStatus?.trim().toUpperCase();
  if (bg === "DENIED") {
    return {
      allowed: false,
      code: "DENIED",
      message:
        "Your background screening was not approved. Match Fit support can answer questions about re-applying after the waiting period in our trainer terms.",
    };
  }

  return { allowed: true };
}

/** Blocks onboarding API mutations when screening was denied or the account was deidentified. */
export async function assertTrainerOnboardingAccess(trainerId: string): Promise<void> {
  const access = await getTrainerOnboardingAccess(trainerId);
  if (!access.allowed) {
    throw new Error(access.message);
  }
}

/** Trainers may not advance past background screening until vendor + human review clears them. */
export function trainerMayProceedPastBackgroundScreening(backgroundCheckStatus: string | null | undefined): boolean {
  return backgroundCheckStatus?.trim().toUpperCase() === "APPROVED";
}

/** Dashboard and client-facing features require an approved, non-expired background check. */
export function trainerMayUsePlatformFeatures(args: {
  backgroundCheckStatus: string | null | undefined;
  deidentifiedAt: Date | null;
}): boolean {
  if (args.deidentifiedAt) return false;
  return trainerMayProceedPastBackgroundScreening(args.backgroundCheckStatus);
}
