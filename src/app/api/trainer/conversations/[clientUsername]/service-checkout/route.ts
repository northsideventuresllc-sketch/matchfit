import { runOutboundChatComplianceMonitoring } from "@/lib/chat-compliance-monitor";
import { getAppOriginFromRequest } from "@/lib/app-origin";
import { prisma } from "@/lib/prisma";
import { getSessionTrainerId } from "@/lib/session";
import { createTrainerServiceSaleStripeCheckoutSession } from "@/lib/stripe-trainer-service-sale-checkout";
import { isTrainerComplianceComplete } from "@/lib/trainer-compliance-complete";
import { parseTrainerServiceOfferingsJson, resolvedTrainerServicePublicTitle } from "@/lib/trainer-service-offerings";
import { isTrainerClientInteractionRestricted } from "@/lib/user-block-queries";
import { NextResponse } from "next/server";
import { z } from "zod";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  serviceId: z.string().min(1).max(120),
});

type RouteContext = { params: Promise<{ clientUsername: string }> };

export async function POST(req: Request, ctx: RouteContext) {
  try {
    const trainerId = await getSessionTrainerId();
    if (!trainerId) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const trainer = await prisma.trainer.findUnique({
      where: { id: trainerId },
      select: {
        username: true,
        profile: {
          select: {
            dashboardActivatedAt: true,
            serviceOfferingsJson: true,
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
      select: { id: true, email: true },
    });
    if (!client) {
      return NextResponse.json({ error: "Client not found." }, { status: 404 });
    }

    if (await isTrainerClientInteractionRestricted(trainerId, client.id)) {
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

    const doc = parseTrainerServiceOfferingsJson(trainer.profile.serviceOfferingsJson);
    const line = doc.services.find((s) => s.serviceId === parsed.data.serviceId);
    if (!line) {
      return NextResponse.json({ error: "That service is not on your published offerings list." }, { status: 404 });
    }

    const baseCents = Math.round(line.priceUsd * 100);
    if (!Number.isFinite(baseCents) || baseCents < 1500 || baseCents > 500_000) {
      return NextResponse.json({ error: "Service price is not valid for checkout." }, { status: 400 });
    }

    const origin = getAppOriginFromRequest(req);

    let checkoutUrl: string;
    try {
      checkoutUrl = await createTrainerServiceSaleStripeCheckoutSession({
        trainerId,
        trainerUsername: trainer.username,
        clientId: client.id,
        clientEmail: client.email,
        line,
        conversationId: conv.id,
        successUrl: `${origin}/client/messages/${encodeURIComponent(trainer.username)}?serviceCheckout=success`,
        cancelUrl: `${origin}/client/messages/${encodeURIComponent(trainer.username)}?serviceCheckout=cancel`,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Could not start checkout.";
      const status = msg.includes("not configured") ? 503 : 500;
      return NextResponse.json({ error: msg }, { status });
    }

    const serviceTitle = resolvedTrainerServicePublicTitle(line);
    const msgBody = [
      `Here is your secure Match Fit checkout for: ${serviceTitle}.`,
      `Total charged at checkout includes the listed service amount plus Match Fit’s administrative fee (shown as its own line).`,
      checkoutUrl,
    ].join("\n\n");

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
      },
      checkoutUrl,
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Could not create checkout." }, { status: 500 });
  }
}
