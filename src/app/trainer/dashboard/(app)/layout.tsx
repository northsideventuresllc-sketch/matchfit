import { redirect } from "next/navigation";
import { TrainerDashboardShell } from "@/components/trainer/trainer-dashboard-shell";
import { prisma } from "@/lib/prisma";
import { staleTrainerSessionInvalidateRedirect } from "@/lib/stale-session-invalidate-url";
import { getSessionTrainerId } from "@/lib/session";

export default async function TrainerDashboardAppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const trainerId = await getSessionTrainerId();
  if (!trainerId) {
    redirect("/trainer/dashboard/login");
  }
  const trainer = await prisma.trainer.findUnique({
    where: { id: trainerId },
    select: { firstName: true, lastName: true, preferredName: true, profileImageUrl: true },
  });
  if (!trainer) {
    redirect(staleTrainerSessionInvalidateRedirect("/trainer/dashboard/login"));
  }
  const displayName =
    trainer.preferredName?.trim() ||
    [trainer.firstName, trainer.lastName].filter(Boolean).join(" ").trim() ||
    "Trainer";

  return (
    <TrainerDashboardShell displayName={displayName} profileImageUrl={trainer.profileImageUrl}>
      {children}
    </TrainerDashboardShell>
  );
}
