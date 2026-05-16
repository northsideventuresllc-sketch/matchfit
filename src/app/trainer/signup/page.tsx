import { redirect } from "next/navigation";
import { Suspense } from "react";
import { prisma } from "@/lib/prisma";
import { staleTrainerSessionInvalidateRedirect } from "@/lib/stale-session-invalidate-url";
import { getSessionTrainerId } from "@/lib/session";
import TrainerSignUpClient from "./trainer-sign-up-client";

export default async function TrainerSignUpPage() {
  const trainerId = await getSessionTrainerId();
  if (trainerId) {
    const trainer = await prisma.trainer.findUnique({
      where: { id: trainerId },
      select: { id: true },
    });
    if (trainer) {
      redirect("/trainer/dashboard");
    }
    redirect(staleTrainerSessionInvalidateRedirect("/trainer/signup"));
  }
  return (
    <Suspense fallback={<main className="min-h-dvh bg-[#0B0C0F]" aria-hidden />}>
      <TrainerSignUpClient />
    </Suspense>
  );
}
