import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { staleTrainerSessionInvalidateRedirect } from "@/lib/stale-session-invalidate-url";
import { getSessionTrainerId } from "@/lib/session";
import TrainerLoginPortal from "../../login/trainer-login-portal";

export default async function TrainerDashboardLoginPage() {
  const trainerId = await getSessionTrainerId();
  if (trainerId) {
    const trainer = await prisma.trainer.findUnique({
      where: { id: trainerId },
      select: { id: true },
    });
    if (trainer) {
      redirect("/trainer/dashboard");
    }
    redirect(staleTrainerSessionInvalidateRedirect("/trainer/dashboard/login"));
  }
  return <TrainerLoginPortal redirectAfterLogin="/trainer/dashboard" variant="dashboard" />;
}
