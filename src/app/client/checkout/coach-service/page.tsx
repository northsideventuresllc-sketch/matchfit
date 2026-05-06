import Link from "next/link";
import { redirect } from "next/navigation";
import { CoachServiceCheckoutClient } from "./coach-service-checkout-client";
import { adminFeeCentsFromBaseSubtotalCents } from "@/lib/platform-fees";
import { prisma } from "@/lib/prisma";
import { isPrismaMissingColumnError } from "@/lib/prisma-missing-column";
import { getSessionClientId } from "@/lib/session";
import { isTrainerComplianceComplete } from "@/lib/trainer-compliance-complete";
import { formatTrainerServicePriceUsd } from "@/lib/trainer-service-price-display";
import {
  evaluateCoachServiceCheckoutPolicy,
  parseCoachServiceCheckoutContext,
} from "@/lib/coach-service-checkout-policy";
import {
  effectiveClientBookingAvailability,
  effectiveSiteVisibility,
  parseTrainerServiceOfferingsJson,
  resolveServiceCheckoutSku,
} from "@/lib/trainer-service-offerings";
import { isTrainerClientInteractionRestricted } from "@/lib/user-block-queries";

const PROFILE_CHECKOUT_COL = "clientsCanPurchaseServicesFromProfile";

const coachCheckoutProfileSelect = {
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
} as const;

type PageProps = {
  searchParams: Promise<{
    trainer?: string;
    serviceId?: string;
    variationId?: string;
    bundleTierId?: string;
    canceled?: string;
    ctx?: string;
  }>;
};

export const metadata = {
  title: "Checkout package | Match Fit",
};

export default async function CoachServiceCheckoutPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const trainerHandle = sp.trainer?.trim();
  const serviceId = sp.serviceId?.trim();
  const variationId = sp.variationId?.trim() || undefined;
  const bundleTierId = sp.bundleTierId?.trim() || undefined;
  const checkoutContext = parseCoachServiceCheckoutContext(sp.ctx);

  if (!trainerHandle || !serviceId) {
    return (
      <main className="min-h-dvh bg-[#0B0C0F] px-5 py-12 text-white antialiased">
        <p className="text-sm text-white/60">Choose a package from a coach profile first.</p>
        <Link href="/client/dashboard" className="mt-6 inline-block text-sm font-semibold text-[#FF7E00] hover:underline">
          Go to dashboard
        </Link>
      </main>
    );
  }

  let returnPath = `/client/checkout/coach-service?trainer=${encodeURIComponent(trainerHandle)}&serviceId=${encodeURIComponent(serviceId)}`;
  if (variationId) returnPath += `&variationId=${encodeURIComponent(variationId)}`;
  if (bundleTierId) returnPath += `&bundleTierId=${encodeURIComponent(bundleTierId)}`;
  if (checkoutContext === "chat") returnPath += "&ctx=chat";
  const clientId = await getSessionClientId();
  if (!clientId) {
    redirect(`/client?next=${encodeURIComponent(returnPath)}`);
  }

  let trainer;
  try {
    trainer = await prisma.trainer.findUnique({
      where: { username: trainerHandle },
      select: {
        id: true,
        username: true,
        deidentifiedAt: true,
        profile: {
          select: { ...coachCheckoutProfileSelect, clientsCanPurchaseServicesFromProfile: true },
        },
      },
    });
  } catch (e) {
    if (isPrismaMissingColumnError(e, PROFILE_CHECKOUT_COL)) {
      trainer = await prisma.trainer.findUnique({
        where: { username: trainerHandle },
        select: {
          id: true,
          username: true,
          deidentifiedAt: true,
          profile: { select: { ...coachCheckoutProfileSelect } },
        },
      });
    } else {
      throw e;
    }
  }

  const profile = trainer?.profile ?? null;
  const published =
    profile &&
    profile.dashboardActivatedAt != null &&
    !trainer?.deidentifiedAt &&
    isTrainerComplianceComplete(profile);

  if (!trainer || !profile || !published) {
    return (
      <main className="min-h-dvh bg-[#0B0C0F] px-5 py-12 text-white antialiased">
        <p className="text-sm text-white/60">This coach profile is not available for checkout.</p>
        <Link href="/client/dashboard" className="mt-6 inline-block text-sm font-semibold text-[#FF7E00] hover:underline">
          Go to dashboard
        </Link>
      </main>
    );
  }

  if (await isTrainerClientInteractionRestricted(trainer.id, clientId)) {
    return (
      <main className="min-h-dvh bg-[#0B0C0F] px-5 py-12 text-white antialiased">
        <p className="text-sm text-white/60">Checkout is not available for this coach on your account.</p>
        <Link
          href={`/trainers/${encodeURIComponent(trainer.username)}`}
          className="mt-6 inline-block text-sm font-semibold text-[#FF7E00] hover:underline"
        >
          Back to profile
        </Link>
      </main>
    );
  }

  const convRow = await prisma.trainerClientConversation.findUnique({
    where: { trainerId_clientId: { trainerId: trainer.id, clientId } },
    select: { officialChatStartedAt: true },
  });
  const profileAllows =
    PROFILE_CHECKOUT_COL in profile ? profile.clientsCanPurchaseServicesFromProfile !== false : true;
  const policy = evaluateCoachServiceCheckoutPolicy({
    checkoutContext,
    clientsCanPurchaseServicesFromProfile: profileAllows,
    officialChatStartedAt: convRow?.officialChatStartedAt,
  });
  if (!policy.allowed) {
    return (
      <main className="min-h-dvh bg-[#0B0C0F] px-5 py-12 text-white antialiased">
        <p className="text-sm text-white/70">{policy.message}</p>
        <Link href={`/trainers/${encodeURIComponent(trainer.username)}`} className="mt-6 inline-block text-sm font-semibold text-[#FF7E00] hover:underline">
          Back to profile
        </Link>
      </main>
    );
  }

  const doc = parseTrainerServiceOfferingsJson(profile.serviceOfferingsJson);
  const line = doc.services.find((s) => s.serviceId === serviceId);
  if (!line || effectiveSiteVisibility(line) === "hidden" || effectiveClientBookingAvailability(line) === "unavailable") {
    return (
      <main className="min-h-dvh bg-[#0B0C0F] px-5 py-12 text-white antialiased">
        <p className="text-sm text-white/60">That package is not listed for this coach anymore.</p>
        <Link
          href={`/trainers/${encodeURIComponent(trainer.username)}`}
          className="mt-6 inline-block text-sm font-semibold text-[#FF7E00] hover:underline"
        >
          View coach profile
        </Link>
      </main>
    );
  }

  const resolved = resolveServiceCheckoutSku(line, variationId ?? null, bundleTierId ?? null);
  if (!resolved.ok) {
    return (
      <main className="min-h-dvh bg-[#0B0C0F] px-5 py-12 text-white antialiased">
        <p className="text-sm text-white/60">{resolved.error}</p>
        <Link
          href={`/trainers/${encodeURIComponent(trainer.username)}`}
          className="mt-6 inline-block text-sm font-semibold text-[#FF7E00] hover:underline"
        >
          View coach profile
        </Link>
      </main>
    );
  }
  const sku = resolved.sku;
  const baseCents = Math.round(sku.priceUsd * 100);
  const adminCents = adminFeeCentsFromBaseSubtotalCents(baseCents);
  const serviceSubtotalLabel = formatTrainerServicePriceUsd(sku.priceUsd);
  const adminFeeLabel = formatTrainerServicePriceUsd(adminCents / 100);
  const totalLabel = formatTrainerServicePriceUsd((baseCents + adminCents) / 100);

  return (
    <CoachServiceCheckoutClient
      trainerUsername={trainer.username}
      serviceId={line.serviceId}
      variationId={variationId}
      bundleTierId={bundleTierId}
      checkoutContext={checkoutContext}
      summaryLine={sku.label}
      serviceSubtotalLabel={serviceSubtotalLabel}
      adminFeeLabel={adminFeeLabel}
      totalLabel={totalLabel}
      canceled={sp.canceled === "1"}
    />
  );
}
