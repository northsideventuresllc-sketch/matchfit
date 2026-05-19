import { getAppOriginFromRequest } from "@/lib/app-origin";
import { sendTrainerBackgroundCheckStatusEmail } from "@/lib/trainer-background-check-status-email";
import {
  approveTrainerBackgroundCheckHumanReview,
  denyTrainerBackgroundCheck,
} from "@/lib/trainer-background-check-deny";
import { verifyTrainerBackgroundReviewToken } from "@/lib/trainer-background-check-review-token";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

function redirectOutcome(req: Request, query: Record<string, string>) {
  const origin = getAppOriginFromRequest(req);
  const u = new URL("/trainer/background-check-review", origin);
  for (const [k, v] of Object.entries(query)) {
    u.searchParams.set(k, v);
  }
  return NextResponse.redirect(u);
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const token = url.searchParams.get("token")?.trim();
    if (!token) {
      return redirectOutcome(req, { decision: "invalid" });
    }

    const decision = await verifyTrainerBackgroundReviewToken(token);
    if (!decision) {
      return redirectOutcome(req, { decision: "invalid" });
    }

    const trainer = await prisma.trainer.findUnique({
      where: { id: decision.trainerId },
      select: {
        email: true,
        firstName: true,
        lastName: true,
        deidentifiedAt: true,
        profile: { select: { backgroundCheckStatus: true } },
      },
    });

    if (!trainer?.profile || trainer.deidentifiedAt) {
      return redirectOutcome(req, { decision: "missing" });
    }

    const bg = trainer.profile.backgroundCheckStatus.trim().toUpperCase();
    if (bg === "APPROVED" && decision.action === "approve") {
      return redirectOutcome(req, { decision: "already_approved" });
    }
    if (bg === "DENIED" && decision.action === "deny") {
      return redirectOutcome(req, { decision: "already_denied" });
    }

    const origin = getAppOriginFromRequest(req);
    const trainerName = `${trainer.firstName} ${trainer.lastName}`.trim();

    if (decision.action === "deny") {
      await denyTrainerBackgroundCheck(decision.trainerId, "Denied via Match Fit background check review email.");
      await sendTrainerBackgroundCheckStatusEmail({
        trainerEmail: trainer.email,
        trainerName,
        statusLabel: "DENIED",
        origin,
      });
      return redirectOutcome(req, { decision: "denied" });
    }

    if (bg !== "NEEDS_FURTHER_REVIEW" && bg !== "PENDING") {
      return redirectOutcome(req, { decision: "not_reviewable" });
    }

    await approveTrainerBackgroundCheckHumanReview(decision.trainerId);
    await sendTrainerBackgroundCheckStatusEmail({
      trainerEmail: trainer.email,
      trainerName,
      statusLabel: "APPROVED",
      origin,
    });

    return redirectOutcome(req, { decision: "approved" });
  } catch (e) {
    console.error("[trainer background-check-review decision]", e);
    return redirectOutcome(req, { decision: "error" });
  }
}
