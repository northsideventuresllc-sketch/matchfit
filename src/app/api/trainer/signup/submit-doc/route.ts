import { NextResponse } from "next/server";
import { z } from "zod";
import { FP_DOC_TYPES } from "@/lib/fp-account-tier-types";
import { fpDocsRejectionRateLimited } from "@/lib/fp-tier-switching";
import { fpDocsSubmittedForTier, fpRequiredDocsForTier, type FpDocSubmissionSummary } from "@/lib/fp-tier-docs";
import { isFpAccountTier } from "@/lib/fp-account-tier-types";
import { prisma } from "@/lib/prisma";
import { getSessionTrainerId } from "@/lib/session";
import { resolveTrainerSignupNextPath } from "@/lib/trainer-signup-next-path";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  docType: z.enum(FP_DOC_TYPES),
  fileUrl: z.string().min(1).max(2048),
});

export async function POST(req: Request) {
  const trainerId = await getSessionTrainerId();
  if (!trainerId) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const json = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid document submission." }, { status: 400 });
  }

  const profile = await prisma.trainerProfile.findUnique({
    where: { trainerId },
    select: {
      accountTier: true,
      docsRejectionCount: true,
      docsLastRejectedAt: true,
      hasSignedTOS: true,
      docsSubmitted: true,
      docsApproved: true,
      registrationFeeHoldStatus: true,
      hasPaidRegistrationFee: true,
      limitedDashboardUnlockedAt: true,
      onboardingFeePaymentDeadlineAt: true,
      onboardingFeePaymentExpiredAt: true,
    },
  });

  if (!profile?.accountTier || !isFpAccountTier(profile.accountTier)) {
    return NextResponse.json({ error: "Choose an account type first." }, { status: 400 });
  }

  if (fpDocsRejectionRateLimited(profile)) {
    return NextResponse.json(
      { error: "Too many document rejections in the last 24 hours. Try again tomorrow." },
      { status: 429 },
    );
  }

  const required = fpRequiredDocsForTier(profile.accountTier);
  if (!required.includes(parsed.data.docType)) {
    return NextResponse.json({ error: "This document is not required for your account type." }, { status: 400 });
  }

  const existing = await prisma.fpDocument.findFirst({
    where: { trainerId, docType: parsed.data.docType },
    select: { id: true },
  });

  if (existing) {
    await prisma.fpDocument.update({
      where: { id: existing.id },
      data: {
        fileUrl: parsed.data.fileUrl,
        status: "pending",
        submittedAt: new Date(),
        rejectionReason: null,
        reviewedAt: null,
        reviewedBy: null,
      },
    });
  } else {
    await prisma.fpDocument.create({
      data: {
        trainerId,
        docType: parsed.data.docType,
        fileUrl: parsed.data.fileUrl,
        status: "pending",
      },
    });
  }

  const docs = await prisma.fpDocument.findMany({
    where: { trainerId },
    select: { docType: true, status: true, fileUrl: true },
  });

  const docsSubmitted = fpDocsSubmittedForTier(
    profile.accountTier,
    docs as FpDocSubmissionSummary[],
  );
  if (docsSubmitted) {
    await prisma.trainerProfile.update({
      where: { trainerId },
      data: { docsSubmitted: true, listingStatus: "pending_docs" },
    });
  }

  const updated = await prisma.trainerProfile.findUnique({
    where: { trainerId },
    select: {
      hasSignedTOS: true,
      accountTier: true,
      docsSubmitted: true,
      docsApproved: true,
      registrationFeeHoldStatus: true,
      hasPaidRegistrationFee: true,
      limitedDashboardUnlockedAt: true,
      onboardingFeePaymentDeadlineAt: true,
      onboardingFeePaymentExpiredAt: true,
    },
  });

  return NextResponse.json({
    ok: true,
    docsSubmitted,
    next: resolveTrainerSignupNextPath(updated),
  });
}
