import { appBaseUrlForEmail } from "@/lib/match-fit-email-shell";
import { FP_DOC_TYPE_LABELS } from "@/lib/fp-tier-docs";
import type { FpDocType } from "@/lib/fp-account-tier-types";
import { prisma } from "@/lib/prisma";
import { sendTransactionalEmailIfAllowed } from "@/lib/transactional-email-send";

export async function sendFpDocumentDeniedEmail(args: {
  trainerId: string;
  email: string;
  firstName: string;
  docType: FpDocType;
  polishedReason: string;
}): Promise<void> {
  const origin = appBaseUrlForEmail();
  await sendTransactionalEmailIfAllowed({
    kind: "FP_DOC_DENIED",
    to: args.email,
    audience: "TRAINER",
    trainerId: args.trainerId,
    variables: {
      firstName: args.firstName,
      docLabel: FP_DOC_TYPE_LABELS[args.docType],
      denialReason: args.polishedReason,
      docsUrl: `${origin}/trainer/signup/docs`,
      trainerDashboardUrl: `${origin}/trainer/dashboard`,
    },
  });
}

export async function sendFpDocumentsAllApprovedEmail(args: {
  trainerId: string;
  email: string;
  firstName: string;
}): Promise<void> {
  const origin = appBaseUrlForEmail();
  await sendTransactionalEmailIfAllowed({
    kind: "FP_DOCS_ALL_APPROVED",
    to: args.email,
    audience: "TRAINER",
    trainerId: args.trainerId,
    variables: {
      firstName: args.firstName,
      trainerDashboardUrl: `${origin}/trainer/dashboard`,
    },
  });
}

export async function sendFpDocumentsSubmittedStaffNotice(trainerId: string): Promise<void> {
  const staffEmail = process.env.MATCH_FIT_SUPPORT_EMAIL?.trim() || "support@match-fit.net";
  const origin = appBaseUrlForEmail();
  const trainer = await prisma.trainer.findUnique({
    where: { id: trainerId },
    select: {
      firstName: true,
      lastName: true,
      email: true,
      username: true,
      profile: { select: { accountTier: true } },
    },
  });
  if (!trainer) return;

  const name = [trainer.firstName, trainer.lastName].filter(Boolean).join(" ").trim() || trainer.username;
  await sendTransactionalEmailIfAllowed({
    kind: "FP_DOCS_SUBMITTED_STAFF",
    to: staffEmail,
    audience: "STAFF",
    trainerId,
    variables: {
      trainerName: name,
      trainerEmail: trainer.email,
      trainerUsername: trainer.username,
      accountTier: trainer.profile?.accountTier?.replace(/_/g, " ") ?? "unknown",
      reviewUrl: `${origin}/admin/fp-documents`,
    },
  });
}
