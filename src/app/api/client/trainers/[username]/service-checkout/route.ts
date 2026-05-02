import { getAppOriginFromRequest } from "@/lib/app-origin";
import { prisma } from "@/lib/prisma";
import { getSessionClientId } from "@/lib/session";
import { createTrainerServiceSaleStripeCheckoutSession } from "@/lib/stripe-trainer-service-sale-checkout";
import { isTrainerComplianceComplete } from "@/lib/trainer-compliance-complete";
import { parseTrainerServiceOfferingsJson, resolveServiceCheckoutSku } from "@/lib/trainer-service-offerings";
import { isTrainerClientInteractionRestricted } from "@/lib/user-block-queries";
import { NextResponse } from "next/server";
import { z } from "zod";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  serviceId: z.string().min(1).max(120),
  variationId: z.string().min(1).max(48).optional(),
  bundleTierId: z.string().min(1).max(48).optional(),
});

type RouteContext = { params: Promise<{ username: string }> };

export async function POST(req: Request, ctx: RouteContext) {
  try {
    const clientId = await getSessionClientId();
    if (!clientId) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const client = await prisma.client.findUnique({
      where: { id: clientId },
      select: { id: true, email: true, deidentifiedAt: true },
    });
    if (!client?.email?.trim() || client.deidentifiedAt) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const { username } = await ctx.params;
    const handle = decodeURIComponent(username).trim();

    const trainer = await prisma.trainer.findUnique({
      where: { username: handle },
      select: {
        id: true,
        username: true,
        deidentifiedAt: true,
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

    const profile = trainer?.profile ?? null;
    const published =
      profile &&
      profile.dashboardActivatedAt != null &&
      !trainer?.deidentifiedAt &&
      isTrainerComplianceComplete(profile);

    if (!trainer || !profile || !published) {
      return NextResponse.json({ error: "Coach not found." }, { status: 404 });
    }

    if (await isTrainerClientInteractionRestricted(trainer.id, clientId)) {
      return NextResponse.json({ error: "Checkout is not available for this coach." }, { status: 403 });
    }

    const json = await req.json().catch(() => null);
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid payload." }, { status: 400 });
    }

    const doc = parseTrainerServiceOfferingsJson(profile.serviceOfferingsJson);
    const line = doc.services.find((s) => s.serviceId === parsed.data.serviceId);
    if (!line) {
      return NextResponse.json({ error: "That service is not listed for this coach." }, { status: 404 });
    }

    const resolved = resolveServiceCheckoutSku(line, parsed.data.variationId ?? null, parsed.data.bundleTierId ?? null);
    if (!resolved.ok) {
      return NextResponse.json({ error: resolved.error }, { status: 400 });
    }
    const sku = resolved.sku;

    const conv = await prisma.trainerClientConversation.findUnique({
      where: { trainerId_clientId: { trainerId: trainer.id, clientId } },
      select: { id: true, officialChatStartedAt: true },
    });

    const origin = getAppOriginFromRequest(req);
    const u = encodeURIComponent(trainer.username);
    let checkoutReturn = `/client/checkout/coach-service?trainer=${u}&serviceId=${encodeURIComponent(parsed.data.serviceId)}`;
    if (parsed.data.variationId?.trim()) {
      checkoutReturn += `&variationId=${encodeURIComponent(parsed.data.variationId.trim())}`;
    }
    if (parsed.data.bundleTierId?.trim()) {
      checkoutReturn += `&bundleTierId=${encodeURIComponent(parsed.data.bundleTierId.trim())}`;
    }

    let url: string;
    try {
      url = await createTrainerServiceSaleStripeCheckoutSession({
        trainerId: trainer.id,
        trainerUsername: trainer.username,
        clientId,
        clientEmail: client.email.trim(),
        line,
        purchaseSku: sku,
        overridePriceUsd: sku.priceUsd,
        checkoutTitle: sku.label.slice(0, 120),
        extraMetadata: {
          variationId: sku.variationId ?? "",
          bundleTierId: sku.bundleTierId ?? "",
          bundleQuantity: String(sku.bundleQuantity),
          skuCheckoutKey: sku.checkoutKey,
        },
        conversationId: conv?.officialChatStartedAt ? conv.id : null,
        successUrl: `${origin}/trainers/${u}?serviceCheckout=success`,
        cancelUrl: `${origin}${checkoutReturn}&canceled=1`,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Could not start checkout.";
      const status = msg.includes("not configured") ? 503 : 500;
      return NextResponse.json({ error: msg }, { status });
    }

    return NextResponse.json({ url });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Could not create checkout." }, { status: 500 });
  }
}
