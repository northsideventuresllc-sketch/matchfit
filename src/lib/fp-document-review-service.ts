import type { FpDocType } from "@/lib/fp-account-tier-types";
import { fpTierRequiresBackgroundCheck } from "@/lib/fp-account-tier-types";
import { isFpAccountTier } from "@/lib/fp-account-tier-types";
import {
  sendFpDocumentDeniedEmail,
  sendFpDocumentsAllApprovedEmail,
} from "@/lib/fp-document-emails";
import { polishFpDocumentRejectionReason } from "@/lib/fp-document-rejection-polish";
import { fpDocsCompleteForTier, type FpDocSubmissionSummary } from "@/lib/fp-tier-docs";
import { prisma } from "@/lib/prisma";

function resolveListingStatusAfterDocsApproved(
  accountTier: string | null,
  backgroundCheckPassed: boolean,
): string {
  if (!accountTier || !isFpAccountTier(accountTier)) return "pending_docs";
  if (fpTierRequiresBackgroundCheck(accountTier) && !backgroundCheckPassed) {
    return "pending_background";
  }
  return "active";
}

export async function humanReviewFpDocument(args: {
  documentId: string;
  adminId: string;
  decision: "approve" | "deny";
  denialReasonRaw?: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const doc = await prisma.fpDocument.findUnique({
    where: { id: args.documentId },
    select: {
      id: true,
      trainerId: true,
      docType: true,
      status: true,
      trainer: {
        select: {
          email: true,
          firstName: true,
          profile: {
            select: {
              accountTier: true,
              backgroundCheckPassed: true,
              docsRejectionCount: true,
            },
          },
        },
      },
    },
  });

  if (!doc) return { ok: false, error: "Document not found." };
  if (doc.status !== "pending") {
    return { ok: false, error: "This document was already reviewed." };
  }

  const docType = doc.docType as FpDocType;
  const now = new Date();

  if (args.decision === "deny") {
    const raw = args.denialReasonRaw?.trim();
    if (!raw) {
      return { ok: false, error: "Enter a reason when denying a document." };
    }
    const polished = await polishFpDocumentRejectionReason({ docType, rawReason: raw });

    await prisma.$transaction(async (tx) => {
      await tx.fpDocument.update({
        where: { id: doc.id },
        data: {
          status: "rejected",
          reviewedBy: args.adminId,
          reviewedAt: now,
          rejectionReasonRaw: raw,
          rejectionReasonPolished: polished,
          rejectionReason: polished,
        },
      });
      await tx.trainerProfile.update({
        where: { trainerId: doc.trainerId },
        data: {
          docsApproved: false,
          docsSubmitted: false,
          docsRejectionCount: { increment: 1 },
          docsLastRejectedAt: now,
          listingStatus: "pending_docs",
        },
      });
    });

    await sendFpDocumentDeniedEmail({
      trainerId: doc.trainerId,
      email: doc.trainer.email,
      firstName: doc.trainer.firstName,
      docType,
      polishedReason: polished,
    });

    return { ok: true };
  }

  await prisma.fpDocument.update({
    where: { id: doc.id },
    data: {
      status: "approved",
      reviewedBy: args.adminId,
      reviewedAt: now,
      rejectionReasonRaw: null,
      rejectionReasonPolished: null,
      rejectionReason: null,
    },
  });

  const tier = doc.trainer.profile?.accountTier;
  if (!tier || !isFpAccountTier(tier)) return { ok: true };

  const allDocs = await prisma.fpDocument.findMany({
    where: { trainerId: doc.trainerId },
    select: { docType: true, status: true, fileUrl: true },
  });

  const complete = fpDocsCompleteForTier(tier, allDocs as FpDocSubmissionSummary[]);
  if (!complete) return { ok: true };

  const listingStatus = resolveListingStatusAfterDocsApproved(
    tier,
    doc.trainer.profile?.backgroundCheckPassed ?? false,
  );

  await prisma.trainerProfile.update({
    where: { trainerId: doc.trainerId },
    data: {
      docsApproved: true,
      listingStatus,
    },
  });

  await sendFpDocumentsAllApprovedEmail({
    trainerId: doc.trainerId,
    email: doc.trainer.email,
    firstName: doc.trainer.firstName,
  });

  return { ok: true };
}

export type FpDocumentAdminRow = {
  id: string;
  trainerId: string;
  trainerName: string;
  trainerEmail: string;
  trainerUsername: string;
  accountTier: string | null;
  docType: string;
  docLabel: string;
  fileUrl: string;
  status: string;
  submittedAt: string;
  autoSuggestedDecision: string | null;
  autoAnalysisSummary: string | null;
};

export async function listFpDocumentsForAdmin(filter: "pending" | "all" = "pending"): Promise<FpDocumentAdminRow[]> {
  const rows = await prisma.fpDocument.findMany({
    where: filter === "pending" ? { status: "pending" } : undefined,
    orderBy: { submittedAt: "asc" },
    take: 200,
    select: {
      id: true,
      trainerId: true,
      docType: true,
      fileUrl: true,
      status: true,
      submittedAt: true,
      autoSuggestedDecision: true,
      autoAnalysisSummary: true,
      trainer: {
        select: {
          firstName: true,
          lastName: true,
          email: true,
          username: true,
          profile: { select: { accountTier: true } },
        },
      },
    },
  });

  const { FP_DOC_TYPE_LABELS } = await import("@/lib/fp-tier-docs");

  return rows.map((row) => ({
    id: row.id,
    trainerId: row.trainerId,
    trainerName: [row.trainer.firstName, row.trainer.lastName].filter(Boolean).join(" ").trim() || row.trainer.username,
    trainerEmail: row.trainer.email,
    trainerUsername: row.trainer.username,
    accountTier: row.trainer.profile?.accountTier ?? null,
    docType: row.docType,
    docLabel: FP_DOC_TYPE_LABELS[row.docType as FpDocType] ?? row.docType,
    fileUrl: row.fileUrl,
    status: row.status,
    submittedAt: row.submittedAt.toISOString(),
    autoSuggestedDecision: row.autoSuggestedDecision,
    autoAnalysisSummary: row.autoAnalysisSummary,
  }));
}
