import { getSessionTrainerId } from "@/lib/session";
import { assertTrainerOnboardingAccess, getTrainerOnboardingAccess } from "@/lib/trainer-onboarding-access";

export async function requireTrainerOnboardingSession(): Promise<
  { trainerId: string } | { error: string; status: number }
> {
  const trainerId = await getSessionTrainerId();
  if (!trainerId) {
    return { error: "Unauthorized.", status: 401 };
  }
  const access = await getTrainerOnboardingAccess(trainerId);
  if (!access.allowed) {
    return { error: access.message, status: access.code === "DENIED" ? 403 : 401 };
  }
  return { trainerId };
}

export async function requireTrainerOnboardingMutation(): Promise<
  { trainerId: string } | { error: string; status: number }
> {
  const session = await requireTrainerOnboardingSession();
  if ("error" in session) return session;
  try {
    await assertTrainerOnboardingAccess(session.trainerId);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Forbidden.", status: 403 };
  }
  return session;
}
