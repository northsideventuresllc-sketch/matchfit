import { runOutboundChatComplianceMonitoring } from "@/lib/chat-compliance-monitor";
import { getAppOriginFromRequest } from "@/lib/app-origin";
import { prisma } from "@/lib/prisma";
import { getSessionTrainerId } from "@/lib/session";
import { isTrainerComplianceComplete } from "@/lib/trainer-compliance-complete";
import { isTrainerPremiumStudioActive } from "@/lib/trainer-premium-studio";
import { isTrainerClientChatBlocked } from "@/lib/user-block-queries";
import { NextResponse } from "next/server";
import { z } from "zod";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  reviewId: z.string().min(1).max(120),
});

type RouteContext = { params: Promise<{ clientUsername: string }> };

export async function POST(req: Request, ctx: RouteContext) {
  try {
    const trainerId = await getSessionTrainerId();
    if (!trainerId) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    if (!(await isTrainerPremiumStudioActive(trainerId))) {
      return NextResponse.json({ error: "Premium Page is required to share reviews in chat." }, { status: 403 });
    }

    const trainer = await prisma.trainer.findUnique({
      where: { id: trainerId },
      select: {
        username: true,
        profile: {
          select: {
            dashboardActivatedAt: true,
            hasSignedTOS: true,
            hasUploadedW9: true,
            backgroundCheckStatus: true,
            backgroundCheckClearedAt: true,
            onboardingTrackCpt: true,
            onboardingTrackNutrition: true,
            onboardingTrackSpecialist: true,
            certificationReviewStatus: true,
            nutritionistCertificationReviewStatus: true,
            specialistCertificationReviewStatus: true,
          },
        },
      },
    });
    if (!trainer?.profile || trainer.profile.dashboardActivatedAt == null || !isTrainerComplianceComplete(trainer.profile)) {
      return NextResponse.json({ error: "Your trainer profile must be live." }, { status: 403 });
    }

    const { clientUsername } = await ctx.params;
    const handle = decodeURIComponent(clientUsername).trim();
    const client = await prisma.client.findUnique({
      where: { username: handle },
      select: { id: true },
    });
    if (!client) {
      return NextResponse.json({ error: "Client not found." }, { status: 404 });
    }

    if (await isTrainerClientChatBlocked(trainerId, client.id)) {
      return NextResponse.json({ error: "Messaging is blocked for this thread." }, { status: 403 });
    }

    const conv = await prisma.trainerClientConversation.findUnique({
      where: { trainerId_clientId: { trainerId, clientId: client.id } },
      select: { id: true, officialChatStartedAt: true, archivedAt: true },
    });
    if (conv?.archivedAt) {
      return NextResponse.json({ error: "This chat is archived." }, { status: 403 });
    }
    if (!conv?.officialChatStartedAt) {
      return NextResponse.json({ error: "This chat is not open yet." }, { status: 403 });
    }

    const json = await req.json().catch(() => null);
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid payload." }, { status: 400 });
    }

    const review = await prisma.clientTrainerReview.findFirst({
      where: { id: parsed.data.reviewId, trainerId, removedByClientAt: null },
      select: { id: true, stars: true, testimonialText: true, testimonialModeratedAt: true },
    });
    if (!review) {
      return NextResponse.json({ error: "Review not found or not shareable." }, { status: 404 });
    }

    const origin = getAppOriginFromRequest(req);
    const profileUrl = `${origin}/trainers/${encodeURIComponent(trainer.username)}#coach-review`;

    const testimonial = review.testimonialText?.trim() ?? "";
    const hasShareableText = testimonial.length > 0 && review.testimonialModeratedAt == null;
    const quoteBlock = hasShareableText
      ? `They wrote:\n\n“${testimonial.slice(0, 500)}”\n\n`
      : review.testimonialModeratedAt
        ? "The written note is not shown here for safety.\n\n"
        : "";

    const msgBody = `I wanted to share a Match Fit client review:\n\n${quoteBlock}Rating: ${review.stars} out of 5 stars.\n\nSee reviews on my public profile: ${profileUrl}`;

    await runOutboundChatComplianceMonitoring({
      conversationId: conv.id,
      authorRole: "TRAINER",
      body: msgBody,
    });

    const msg = await prisma.trainerClientChatMessage.create({
      data: {
        conversationId: conv.id,
        authorRole: "TRAINER",
        body: msgBody,
      },
    });
    await prisma.trainerClientConversation.update({
      where: { id: conv.id },
      data: { updatedAt: new Date() },
    });

    return NextResponse.json({
      message: {
        id: msg.id,
        authorRole: msg.authorRole,
        body: msg.body,
        createdAt: msg.createdAt.toISOString(),
        attachment: null,
      },
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Could not share review." }, { status: 500 });
  }
}
