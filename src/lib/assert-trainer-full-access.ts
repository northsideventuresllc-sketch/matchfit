import { hasTrainerFullPlatformAccess, type TrainerAccessProfile } from "@/lib/trainer-full-access";

export function trainerFullAccessBlockedMessage(): string {
  return "Complete certification review and background screening to use this feature.";
}

export function assertTrainerFullPlatformAccess(
  prof: TrainerAccessProfile | null | undefined,
): { ok: true } | { ok: false; error: string; status: number } {
  if (!hasTrainerFullPlatformAccess(prof)) {
    return { ok: false, error: trainerFullAccessBlockedMessage(), status: 403 };
  }
  return { ok: true };
}
