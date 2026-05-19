import { getBackgroundCheckReviewInbox } from "@/lib/checkr/config";
import { signTrainerBackgroundReviewToken } from "@/lib/trainer-background-check-review-token";
import { sendTransactionalEmailIfAllowed } from "@/lib/transactional-email-send";

export async function sendTrainerBackgroundCheckReviewEmail(opts: {
  trainerId: string;
  trainerName: string;
  trainerEmail: string;
  trainerUsername: string;
  reportId: string;
  reportPortalUrl: string | null;
  origin: string;
}): Promise<void> {
  const approveTok = await signTrainerBackgroundReviewToken(opts.trainerId, "approve");
  const denyTok = await signTrainerBackgroundReviewToken(opts.trainerId, "deny");
  const approveUrl = `${opts.origin}/api/trainer/background-check-review/decision?token=${encodeURIComponent(approveTok)}`;
  const denyUrl = `${opts.origin}/api/trainer/background-check-review/decision?token=${encodeURIComponent(denyTok)}`;

  const reportLink = opts.reportPortalUrl ?? `Checkr report id: ${opts.reportId}`;

  await sendTransactionalEmailIfAllowed({
    kind: "TRAINER_BACKGROUND_CHECK_REVIEW",
    to: getBackgroundCheckReviewInbox(),
    audience: "STAFF",
    variables: {
      trainerName: opts.trainerName,
      trainerEmail: opts.trainerEmail,
      trainerUsername: opts.trainerUsername,
      reportLink,
      approveUrl,
      denyUrl,
    },
  });
}
