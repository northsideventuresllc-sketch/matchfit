import { sendTransactionalEmailIfAllowed } from "@/lib/transactional-email-send";

export async function sendTrainerBackgroundCheckStatusEmail(opts: {
  trainerEmail: string;
  trainerName: string;
  statusLabel: string;
  origin: string;
}): Promise<void> {
  const dashboardUrl = `${opts.origin}/trainer/onboarding`;
  await sendTransactionalEmailIfAllowed({
    kind: "BACKGROUND_CHECK_UPDATE",
    to: opts.trainerEmail,
    audience: "TRAINER",
    variables: {
      trainerName: opts.trainerName,
      bgStatus: opts.statusLabel,
      dashboardUrl,
    },
  });
}
