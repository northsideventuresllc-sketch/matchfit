import { tryAutomatedCheckrInvitation } from "@/lib/checkr-api-client";
import { defaultBackgroundCheckVendorPaidCents } from "@/lib/checkr-config";
import { isBackgroundCheckPlanBActive } from "@/lib/checkr-integration";
import { signBackgroundCheckStaffToken } from "@/lib/background-check-action-token";
import { appBaseUrlForEmail } from "@/lib/match-fit-email-shell";
import { prisma } from "@/lib/prisma";
import { sendTransactionalEmailIfAllowed } from "@/lib/transactional-email-send";
import { syncTrainerComplianceWindow } from "@/lib/trainer-compliance-window-sync";
import { captureTrainerSignupFeeHoldPartial } from "@/lib/trainer-signup-fee-hold";
import type { TrainerRegistrationPricingMode } from "@/lib/match-fit-launch-promotions";

export const MATCH_FIT_SUPPORT_EMAIL =
  process.env.MATCH_FIT_SUPPORT_EMAIL?.trim() || "support@match-fit.net";

const trainerSelect = {
  id: true,
  email: true,
  firstName: true,
  lastName: true,
  username: true,
  phone: true,
  profile: {
    select: {
      backgroundCheckStatus: true,
      backgroundCheckInviteRequestedAt: true,
      backgroundCheckInviteSentAt: true,
      checkrCandidateId: true,
      registrationFeeHoldPaymentIntentId: true,
      registrationFeeHoldStatus: true,
      registrationFeePricingMode: true,
      hasPaidBackgroundFee: true,
      backgroundCheckVendorPaidCents: true,
      serviceZipCode: true,
    },
  },
} as const;

async function notifyTrainerInApp(args: {
  trainerId: string;
  title: string;
  body: string;
  linkHref: string;
}): Promise<void> {
  await prisma.trainerNotification.create({
    data: {
      trainerId: args.trainerId,
      kind: "COMPLIANCE",
      title: args.title,
      body: args.body,
      linkHref: args.linkHref,
    },
  });
}

async function sendTrainerBackgroundEmail(args: {
  trainerId: string;
  email: string;
  statusLabel: string;
  dashboardUrl: string;
}): Promise<void> {
  await sendTransactionalEmailIfAllowed({
    kind: "BACKGROUND_CHECK_UPDATE",
    to: args.email,
    audience: "TRAINER",
    trainerId: args.trainerId,
    variables: {
      bgStatus: args.statusLabel,
      dashboardUrl: args.dashboardUrl,
    },
  });
}

function trainerDashboardComplianceUrl(origin: string): string {
  return `${origin.replace(/\/$/, "")}/trainer/dashboard/compliance`;
}

function requestInvitePageUrl(origin: string): string {
  return `${origin.replace(/\/$/, "")}/trainer/onboarding/background-check/request-invite`;
}

export async function requestTrainerBackgroundCheckInvite(trainerId: string): Promise<{
  ok: boolean;
  mode: "automated" | "manual";
  message: string;
  invitationUrl?: string | null;
}> {
  if (!isBackgroundCheckPlanBActive()) {
    return { ok: false, mode: "manual", message: "Direct Checkr integration is active; use the automated flow." };
  }

  const trainer = await prisma.trainer.findUnique({
    where: { id: trainerId },
    select: trainerSelect,
  });
  if (!trainer?.profile) {
    return { ok: false, mode: "manual", message: "Trainer profile not found." };
  }

  const hold = (trainer.profile.registrationFeeHoldStatus ?? "").trim().toUpperCase();
  if (hold !== "HELD" && hold !== "CAPTURED" && !trainer.profile.hasPaidBackgroundFee) {
    return {
      ok: false,
      mode: "manual",
      message: "Authorize your signup fee before requesting background screening.",
    };
  }

  const bgStatus = (trainer.profile.backgroundCheckStatus ?? "").trim().toUpperCase();
  if (bgStatus === "APPROVED") {
    return { ok: true, mode: "automated", message: "Background screening is already approved." };
  }

  const now = new Date();
  const origin = appBaseUrlForEmail();
  const automated = await tryAutomatedCheckrInvitation({
    trainerId,
    email: trainer.email,
    firstName: trainer.firstName,
    lastName: trainer.lastName,
    existingCandidateId: trainer.profile.checkrCandidateId,
  });

  if (automated.ok) {
    await prisma.trainerProfile.update({
      where: { trainerId },
      data: {
        backgroundCheckInviteRequestedAt: now,
        backgroundCheckInviteSentAt: now,
        backgroundCheckStatus: "PENDING",
        backgroundCheckReviewStatus: "PENDING",
        hasPaidBackgroundFee: true,
        backgroundCheckVendorPaidCents:
          trainer.profile.backgroundCheckVendorPaidCents ?? defaultBackgroundCheckVendorPaidCents(),
        checkrCandidateId: automated.candidateId,
        updatedAt: now,
      },
    });
    await syncTrainerComplianceWindow(trainerId);
    const dash = trainerDashboardComplianceUrl(origin);
    await notifyTrainerInApp({
      trainerId,
      title: "Checkr invitation sent",
      body: automated.invitationUrl
        ? "Open the Checkr link in your email to complete background screening."
        : "Check your email for a Checkr invitation and complete screening within 7 days.",
      linkHref: dash,
    });
    await sendTrainerBackgroundEmail({
      trainerId,
      email: trainer.email,
      statusLabel: "Invitation sent — complete Checkr screening",
      dashboardUrl: dash,
    });
    return {
      ok: true,
      mode: "automated",
      message: "Checkr invitation sent automatically. Check your email to complete screening.",
      invitationUrl: automated.invitationUrl,
    };
  }

  await prisma.trainerProfile.update({
    where: { trainerId },
    data: {
      backgroundCheckInviteRequestedAt: now,
      backgroundCheckStatus: "PENDING",
      backgroundCheckReviewStatus: "PENDING",
      hasPaidBackgroundFee: true,
      backgroundCheckVendorPaidCents:
        trainer.profile.backgroundCheckVendorPaidCents ?? defaultBackgroundCheckVendorPaidCents(),
      updatedAt: now,
    },
  });
  await syncTrainerComplianceWindow(trainerId);

  const confirmToken = await signBackgroundCheckStaffToken(trainerId, "confirm_invite_sent");
  const confirmUrl = `${origin.replace(/\/$/, "")}/api/background-check/plan-b/staff-action?token=${encodeURIComponent(confirmToken)}`;

  await sendTransactionalEmailIfAllowed({
    kind: "BACKGROUND_CHECK_PLAN_B_INVITE_REQUEST",
    to: MATCH_FIT_SUPPORT_EMAIL,
    audience: "STAFF",
    variables: {
      trainerName: `${trainer.firstName} ${trainer.lastName}`.trim(),
      trainerEmail: trainer.email,
      trainerUsername: trainer.username,
      trainerPhone: trainer.phone,
      serviceZip: trainer.profile.serviceZipCode ?? "—",
      trainerId,
      confirmInviteSentUrl: confirmUrl,
      checkrAutomateNote: automated.reason,
    },
  });

  return {
    ok: true,
    mode: "manual",
    message:
      "Your request was sent to Match Fit support. You will receive an email when your Checkr invitation has been sent (usually within one business day).",
  };
}

export async function confirmPlanBBackgroundCheckInviteSent(trainerId: string): Promise<{ ok: boolean; message: string }> {
  const trainer = await prisma.trainer.findUnique({
    where: { id: trainerId },
    select: { email: true, firstName: true, profile: { select: { backgroundCheckInviteSentAt: true } } },
  });
  if (!trainer?.profile) return { ok: false, message: "Trainer not found." };

  const now = new Date();
  await prisma.trainerProfile.update({
    where: { trainerId },
    data: {
      backgroundCheckInviteSentAt: now,
      backgroundCheckStatus: "PENDING",
      backgroundCheckReviewStatus: "PENDING",
      updatedAt: now,
    },
  });

  const origin = appBaseUrlForEmail();
  const dash = trainerDashboardComplianceUrl(origin);
  const invitePage = requestInvitePageUrl(origin);

  await notifyTrainerInApp({
    trainerId,
    title: "Checkr invitation sent",
    body: "Check your email from Checkr (and spam folder). Complete every step within 7 days so your screening can clear.",
    linkHref: dash,
  });

  await sendTransactionalEmailIfAllowed({
    kind: "BACKGROUND_CHECK_PLAN_B_INVITE_SENT_TRAINER",
    to: trainer.email,
    audience: "TRAINER",
    trainerId,
    variables: {
      firstName: trainer.firstName,
      dashboardUrl: dash,
      inviteHelpUrl: invitePage,
    },
  });

  await syncTrainerComplianceWindow(trainerId);
  return { ok: true, message: "Trainer notified that the Checkr invitation was sent." };
}

export async function notifySupportPlanBReviewNeeded(trainerId: string): Promise<void> {
  const trainer = await prisma.trainer.findUnique({
    where: { id: trainerId },
    select: {
      email: true,
      firstName: true,
      lastName: true,
      username: true,
      profile: { select: { backgroundCheckStatus: true, checkrReportId: true } },
    },
  });
  if (!trainer?.profile) return;

  const approveToken = await signBackgroundCheckStaffToken(trainerId, "approve");
  const denyToken = await signBackgroundCheckStaffToken(trainerId, "deny");
  const origin = appBaseUrlForEmail();
  const base = origin.replace(/\/$/, "");

  await sendTransactionalEmailIfAllowed({
    kind: "BACKGROUND_CHECK_PLAN_B_REVIEW",
    to: MATCH_FIT_SUPPORT_EMAIL,
    audience: "STAFF",
    variables: {
      trainerName: `${trainer.firstName} ${trainer.lastName}`.trim(),
      trainerEmail: trainer.email,
      trainerUsername: trainer.username,
      trainerId,
      reportId: trainer.profile.checkrReportId ?? "—",
      status: trainer.profile.backgroundCheckStatus ?? "PENDING",
      approveUrl: `${base}/api/background-check/plan-b/staff-action?token=${encodeURIComponent(approveToken)}`,
      denyUrl: `${base}/api/background-check/plan-b/staff-action?token=${encodeURIComponent(denyToken)}`,
    },
  });
}

export async function applyPlanBBackgroundCheckStaffDecision(
  trainerId: string,
  action: "approve" | "deny",
): Promise<{ ok: boolean; message: string }> {
  const trainer = await prisma.trainer.findUnique({
    where: { id: trainerId },
    select: {
      email: true,
      profile: {
        select: {
          registrationFeeHoldPaymentIntentId: true,
          registrationFeeHoldStatus: true,
          registrationFeePricingMode: true,
          backgroundCheckVendorPaidCents: true,
        },
      },
    },
  });
  if (!trainer?.profile) return { ok: false, message: "Trainer not found." };

  const now = new Date();
  const origin = appBaseUrlForEmail();
  const dash = trainerDashboardComplianceUrl(origin);

  if (action === "approve") {
    const vendorCents =
      trainer.profile.backgroundCheckVendorPaidCents ?? defaultBackgroundCheckVendorPaidCents();
    await prisma.trainerProfile.update({
      where: { trainerId },
      data: {
        backgroundCheckStatus: "APPROVED",
        backgroundCheckReviewStatus: "APPROVED",
        backgroundCheckClearedAt: now,
        hasPaidBackgroundFee: true,
        backgroundCheckVendorPaidCents: vendorCents,
        updatedAt: now,
      },
    });
    await syncTrainerComplianceWindow(trainerId);
    await notifyTrainerInApp({
      trainerId,
      title: "Background screening approved",
      body: "Your Checkr screening cleared. Continue certification and compliance steps in your dashboard.",
      linkHref: dash,
    });
    await sendTrainerBackgroundEmail({
      trainerId,
      email: trainer.email,
      statusLabel: "Approved",
      dashboardUrl: dash,
    });
    return { ok: true, message: "Background check approved." };
  }

  const piId = trainer.profile.registrationFeeHoldPaymentIntentId?.trim();
  const holdStatus = (trainer.profile.registrationFeeHoldStatus ?? "").trim().toUpperCase();
  const pricingMode = (trainer.profile.registrationFeePricingMode ??
    "FOUNDING_BG_SURCHARGE_20PCT") as TrainerRegistrationPricingMode;

  if (piId && holdStatus === "HELD") {
    await captureTrainerSignupFeeHoldPartial(piId, pricingMode, "bg_failure");
  }

  await prisma.trainerProfile.update({
    where: { trainerId },
    data: {
      backgroundCheckStatus: "DENIED",
      backgroundCheckReviewStatus: "DENIED",
      hasPaidBackgroundFee: false,
      backgroundCheckVendorPaidCents: null,
      updatedAt: now,
    },
  });

  await notifyTrainerInApp({
    trainerId,
    title: "Background screening not cleared",
    body:
      "Your screening did not clear. The background-check portion of your signup authorization was not applied; see Terms for fee handling.",
    linkHref: dash,
  });
  await sendTrainerBackgroundEmail({
    trainerId,
    email: trainer.email,
    statusLabel: "Not cleared",
    dashboardUrl: dash,
  });

  return { ok: true, message: "Background check denied; escrow adjusted per policy." };
}

export async function trainerReportsPlanBScreeningComplete(trainerId: string): Promise<{ ok: boolean; message: string }> {
  const prof = await prisma.trainerProfile.findUnique({
    where: { trainerId },
    select: { backgroundCheckInviteSentAt: true, backgroundCheckStatus: true },
  });
  if (!prof) return { ok: false, message: "Profile not found." };
  if (!prof.backgroundCheckInviteSentAt) {
    return { ok: false, message: "Request your Checkr invitation before marking screening complete." };
  }
  const status = (prof.backgroundCheckStatus ?? "").trim().toUpperCase();
  if (status === "APPROVED") {
    return { ok: true, message: "Already approved." };
  }

  await prisma.trainerProfile.update({
    where: { trainerId },
    data: {
      backgroundCheckReviewStatus: "PENDING",
      backgroundCheckStatus: "PENDING",
      updatedAt: new Date(),
    },
  });

  if (isBackgroundCheckPlanBActive()) {
    await notifySupportPlanBReviewNeeded(trainerId);
  }

  return {
    ok: true,
    message: "Thanks — Match Fit will verify your results and email you when your status updates.",
  };
}
