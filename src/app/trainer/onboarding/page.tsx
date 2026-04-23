import { redirect } from "next/navigation";
import { getSessionTrainerId } from "@/lib/session";
import TrainerOnboardingClient from "./trainer-onboarding-client";

export const dynamic = "force-dynamic";

export default async function TrainerOnboardingPage() {
  const trainerId = await getSessionTrainerId();
  if (!trainerId) {
    redirect("/trainer/dashboard/login?next=%2Ftrainer%2Fonboarding");
  }
  return <TrainerOnboardingClient />;
}
