import {
  CheckrNotConfiguredError,
  createCheckrCandidate,
  createCheckrInvitation,
} from "@/lib/checkr/client";
import { getCheckrPackageSlug, isCheckrConfigured } from "@/lib/checkr/config";
import { upsertTrainerCheckrVault } from "@/lib/supabase/checkr-vault";
import { prisma } from "@/lib/prisma";

/**
 * After Stripe background-check payment, create a Checkr candidate + invitation.
 * When Checkr is not configured, the profile stays PENDING until webhooks or operator review.
 */
export async function initiateTrainerCheckrScreening(trainerId: string): Promise<{
  configured: boolean;
  invitationId?: string;
  reportId?: string;
}> {
  if (!isCheckrConfigured()) {
    return { configured: false };
  }

  const trainer = await prisma.trainer.findUnique({
    where: { id: trainerId },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      phone: true,
      profile: {
        select: {
          backgroundCheckStatus: true,
          checkrInvitationId: true,
          checkrReportId: true,
        },
      },
    },
  });
  if (!trainer?.profile) {
    throw new Error("Trainer profile not found.");
  }

  if (trainer.profile.backgroundCheckStatus === "APPROVED") {
    return { configured: true };
  }

  if (trainer.profile.checkrInvitationId && trainer.profile.backgroundCheckStatus === "PENDING") {
    return {
      configured: true,
      invitationId: trainer.profile.checkrInvitationId,
      reportId: trainer.profile.checkrReportId ?? undefined,
    };
  }

  try {
    const candidate = await createCheckrCandidate({
      email: trainer.email,
      firstName: trainer.firstName,
      lastName: trainer.lastName,
      phone: trainer.phone,
    });

    const invitation = await createCheckrInvitation({
      candidateId: candidate.id,
      packageSlug: getCheckrPackageSlug(),
    });

    await upsertTrainerCheckrVault(trainerId, {
      checkr_candidate_id: candidate.id,
      checkr_invitation_id: invitation.id,
      checkr_report_id: invitation.report_id ?? null,
      report_portal_url: invitation.uri ?? null,
    });

    await prisma.trainerProfile.update({
      where: { trainerId },
      data: {
        backgroundCheckStatus: "PENDING",
        backgroundCheckReviewStatus: "PENDING",
        checkrInvitationId: invitation.id,
        ...(invitation.report_id ? { checkrReportId: invitation.report_id } : {}),
      },
    });

    return {
      configured: true,
      invitationId: invitation.id,
      reportId: invitation.report_id ?? undefined,
    };
  } catch (e) {
    if (e instanceof CheckrNotConfiguredError) {
      return { configured: false };
    }
    console.error("[Checkr initiate]", e);
    throw e;
  }
}
