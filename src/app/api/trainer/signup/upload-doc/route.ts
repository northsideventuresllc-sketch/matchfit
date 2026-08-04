import { NextResponse } from "next/server";
import { z } from "zod";
import { FP_DOC_TYPES } from "@/lib/fp-account-tier-types";
import { analyzeFpDocumentUpload } from "@/lib/fp-document-auto-analyzer";
import { sendFpDocumentsSubmittedStaffNotice } from "@/lib/fp-document-emails";
import { fpDocsRejectionRateLimited } from "@/lib/fp-tier-switching";
import { fpDocsSubmittedForTier, fpRequiredDocsForTier, type FpDocSubmissionSummary } from "@/lib/fp-tier-docs";
import { isFpAccountTier } from "@/lib/fp-account-tier-types";
import { prisma } from "@/lib/prisma";
import { getSessionTrainerId } from "@/lib/session";
import { resolveTrainerSignupNextPath } from "@/lib/trainer-signup-next-path";
import { deleteTrainerDocument, putTrainerDocument } from "@/lib/trainer-document-storage";
import { resolveUploadFileKind, UPLOAD_UNSUPPORTED_TYPE_MESSAGE } from "@/lib/upload-file-type";
import { publicApiErrorFromUnknown } from "@/lib/public-api-error";

export const dynamic = "force-dynamic";

const MAX_BYTES = 5 * 1024 * 1024;

export async function GET() {
  const trainerId = await getSessionTrainerId();
  if (!trainerId) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const profile = await prisma.trainerProfile.findUnique({
    where: { trainerId },
    select: { accountTier: true },
  });

  if (!profile?.accountTier || !isFpAccountTier(profile.accountTier)) {
    return NextResponse.json({ error: "Choose an account type first." }, { status: 400 });
  }

  const docs = await prisma.fpDocument.findMany({
    where: { trainerId },
    select: {
      docType: true,
      status: true,
      fileUrl: true,
      autoSuggestedDecision: true,
      autoAnalysisSummary: true,
      rejectionReasonPolished: true,
      submittedAt: true,
    },
  });

  return NextResponse.json({
    accountTier: profile.accountTier,
    requiredDocs: fpRequiredDocsForTier(profile.accountTier),
    documents: docs.map((d) => ({
      ...d,
      submittedAt: d.submittedAt.toISOString(),
    })),
  });
}

export async function POST(req: Request) {
  try {
    const trainerId = await getSessionTrainerId();
    if (!trainerId) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const form = await req.formData();
    const file = form.get("file");
    const docTypeRaw = form.get("docType");

    const docTypeParsed = z.enum(FP_DOC_TYPES).safeParse(docTypeRaw);
    if (!docTypeParsed.success) {
      return NextResponse.json({ error: "Invalid document type." }, { status: 400 });
    }
    const docType = docTypeParsed.data;

    if (!file || !(file instanceof Blob)) {
      return NextResponse.json({ error: "Choose a file to upload." }, { status: 400 });
    }

    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: "File must be 5 MB or smaller." }, { status: 400 });
    }

    const buf = Buffer.from(await file.arrayBuffer());
    const kind = resolveUploadFileKind({
      declaredMime: file.type,
      filename: file instanceof File ? file.name : null,
      bytes: buf,
    });
    if (!kind) {
      return NextResponse.json({ error: UPLOAD_UNSUPPORTED_TYPE_MESSAGE }, { status: 400 });
    }
    const { ext, mime } = kind;

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
    if (!required.includes(docType)) {
      return NextResponse.json({ error: "This document is not required for your account type." }, { status: 400 });
    }

    const existing = await prisma.fpDocument.findFirst({
      where: { trainerId, docType },
      select: { id: true, fileUrl: true },
    });

    const relative = await putTrainerDocument({
      key: `fp-docs/${trainerId}-${docType}.${ext}`,
      bytes: buf,
      contentType: mime,
    });

    // Replacing a document with a different file type leaves the old object behind.
    if (existing?.fileUrl && existing.fileUrl.split("?")[0] !== relative) {
      await deleteTrainerDocument(existing.fileUrl);
    }

    const analysis = analyzeFpDocumentUpload({
      docType,
      fileUrl: relative,
      fileSizeBytes: file.size,
      mimeType: mime,
    });

    const now = new Date();
    if (existing) {
      await prisma.fpDocument.update({
        where: { id: existing.id },
        data: {
          fileUrl: relative,
          status: "pending",
          submittedAt: now,
          autoSuggestedDecision: analysis.decision,
          autoAnalysisSummary: analysis.summary,
          autoAnalyzedAt: now,
          reviewedAt: null,
          reviewedBy: null,
          rejectionReason: null,
          rejectionReasonRaw: null,
          rejectionReasonPolished: null,
        },
      });
    } else {
      await prisma.fpDocument.create({
        data: {
          trainerId,
          docType,
          fileUrl: relative,
          status: "pending",
          autoSuggestedDecision: analysis.decision,
          autoAnalysisSummary: analysis.summary,
          autoAnalyzedAt: now,
        },
      });
    }

    const docs = await prisma.fpDocument.findMany({
      where: { trainerId },
      select: { docType: true, status: true, fileUrl: true },
    });

    const docsSubmitted = fpDocsSubmittedForTier(profile.accountTier, docs as FpDocSubmissionSummary[]);
    if (docsSubmitted) {
      await prisma.trainerProfile.update({
        where: { trainerId },
        data: { docsSubmitted: true, listingStatus: "pending_docs" },
      });
      void sendFpDocumentsSubmittedStaffNotice(trainerId);
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
      fileUrl: relative,
      analysis,
      docsSubmitted,
      next: resolveTrainerSignupNextPath(updated),
    });
  } catch (e) {
    const { message, status } = publicApiErrorFromUnknown(e, "Could not upload document.", {
      logLabel: "[Match Fit FP doc upload]",
    });
    return NextResponse.json({ error: message }, { status });
  }
}
