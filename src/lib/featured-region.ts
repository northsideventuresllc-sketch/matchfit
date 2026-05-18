import { trainerServiceZipToPrefix } from "@/lib/trainer-service-zip";

/**
 * Regional pool for featured placement: first three digits of the trainer’s
 * in-person US ZIP from signup `serviceZipCode` or the Onboarding Questionnaire.
 */
export function resolveTrainerRegionZipPrefix(args: {
  serviceZipCode?: string | null;
  matchQuestionnaireAnswers?: string | null;
}): string | null {
  const fromSignup = trainerServiceZipToPrefix(args.serviceZipCode);
  if (fromSignup) return fromSignup;
  return trainerMatchAnswersToRegionZipPrefix(args.matchQuestionnaireAnswers ?? null);
}

/**
 * Regional pool from questionnaire only (legacy).
 */
export function trainerMatchAnswersToRegionZipPrefix(answersJson: string | null): string | null {
  if (!answersJson?.trim()) return null;
  try {
    const o = JSON.parse(answersJson) as { offersInPerson?: boolean; inPersonZip?: string | null };
    if (!o.offersInPerson || !o.inPersonZip) return null;
    const z = String(o.inPersonZip).replace(/\D/g, "");
    if (z.length < 3) return null;
    return z.slice(0, 3);
  } catch {
    return null;
  }
}

export function clientZipToPrefix(zip: string | null | undefined): string | null {
  if (!zip?.trim()) return null;
  const z = zip.replace(/\D/g, "");
  if (z.length < 3) return null;
  return z.slice(0, 3);
}
