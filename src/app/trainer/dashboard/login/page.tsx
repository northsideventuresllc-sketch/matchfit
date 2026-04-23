import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { staleTrainerSessionInvalidateRedirect } from "@/lib/stale-session-invalidate-url";
import { getSessionTrainerId } from "@/lib/session";
import { normalizeTrainerPostAuthPath } from "@/lib/trainer-post-auth-redirect";
import TrainerLoginPortal from "../../login/trainer-login-portal";

export default async function TrainerDashboardLoginPage({
  searchParams,
}: {
  searchParams?: Promise<{ next?: string }>;
}) {
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
  const sp = searchParams ? await searchParams : {};
  const redirectAfterLogin = normalizeTrainerPostAuthPath(sp.next) ?? "/trainer/dashboard";
  return <TrainerLoginPortal redirectAfterLogin={redirectAfterLogin} variant="dashboard" />;
}
