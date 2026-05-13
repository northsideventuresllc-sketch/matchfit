import { appBaseUrlForEmail } from "@/lib/match-fit-email-shell";
import { sendTransactionalEmailIfAllowed } from "@/lib/transactional-email-send";

export async function sendTrainerWelcomeEmail(input: { to: string; firstName: string; trainerId: string }): Promise<void> {
  await sendTransactionalEmailIfAllowed({
    kind: "TRAINER_WELCOME",
    to: input.to.trim(),
    audience: "TRAINER",
    trainerId: input.trainerId,
    variables: {
      firstName: input.firstName.trim() || "Coach",
      trainerDashboardUrl: `${appBaseUrlForEmail()}/trainer/dashboard`,
    },
  });
}
