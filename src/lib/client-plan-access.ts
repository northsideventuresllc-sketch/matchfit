import { prisma } from "@/lib/prisma";

export const CLIENT_FREEMIUM_SWIPE_LIMIT = 10;
export const CLIENT_FREEMIUM_SWIPE_WINDOW_HOURS = 12;
export const CLIENT_VIP_PRICE_USD = 10;

export type ClientPlanTier = "FREEMIUM" | "VIP";

export type ClientPlanAccessFields = {
  clientPlanTier: string;
  vipSubscriptionActive: boolean;
  freemiumSwipeCount: number;
  freemiumSwipeWindowStartAt: Date | null;
  platformTrialEndsAt?: Date | null;
  stripeSubscriptionActive?: boolean;
};

export function isVip(client: { clientPlanTier: string; vipSubscriptionActive?: boolean }): boolean {
  if (client.vipSubscriptionActive) return true;
  return (client.clientPlanTier ?? "").trim().toUpperCase() === "VIP";
}

const SWIPE_WINDOW_MS = CLIENT_FREEMIUM_SWIPE_WINDOW_HOURS * 60 * 60 * 1000;

/** True when FREEMIUM restrictions apply (not VIP, not active founding trial, not legacy paid sub). */
export function isClientFreemiumGated(client: ClientPlanAccessFields, nowMs: number = Date.now()): boolean {
  if (isVip(client)) return false;
  const trialEnds = client.platformTrialEndsAt?.getTime() ?? 0;
  if (trialEnds > nowMs) return false;
  if (client.stripeSubscriptionActive) return false;
  return (client.clientPlanTier ?? "FREEMIUM").trim().toUpperCase() === "FREEMIUM";
}

export function canSwipe(
  client: {
    freemiumSwipeCount: number;
    freemiumSwipeWindowStartAt: Date | null;
    clientPlanTier: string;
    vipSubscriptionActive?: boolean;
    platformTrialEndsAt?: Date | null;
    stripeSubscriptionActive?: boolean;
  },
  now: Date = new Date(),
): boolean {
  if (
    !isClientFreemiumGated(
      {
        ...client,
        vipSubscriptionActive: client.vipSubscriptionActive ?? false,
        stripeSubscriptionActive: client.stripeSubscriptionActive ?? false,
      },
      now.getTime(),
    )
  ) {
    return true;
  }

  const windowStart = client.freemiumSwipeWindowStartAt;
  if (!windowStart) return true;

  const elapsed = now.getTime() - windowStart.getTime();
  if (elapsed >= SWIPE_WINDOW_MS) return true;

  return client.freemiumSwipeCount < CLIENT_FREEMIUM_SWIPE_LIMIT;
}

export async function recordSwipe(clientId: string): Promise<void> {
  const client = await prisma.client.findUnique({
    where: { id: clientId },
    select: {
      clientPlanTier: true,
      vipSubscriptionActive: true,
      freemiumSwipeCount: true,
      freemiumSwipeWindowStartAt: true,
      platformTrialEndsAt: true,
      stripeSubscriptionActive: true,
    },
  });
  if (!client) return;
  if (!isClientFreemiumGated(client)) return;

  const now = new Date();
  const windowStart = client.freemiumSwipeWindowStartAt;
  const windowExpired =
    !windowStart || now.getTime() - windowStart.getTime() >= SWIPE_WINDOW_MS;

  if (windowExpired) {
    await prisma.client.update({
      where: { id: clientId },
      data: {
        freemiumSwipeCount: 1,
        freemiumSwipeWindowStartAt: now,
      },
    });
    return;
  }

  if (client.freemiumSwipeCount >= CLIENT_FREEMIUM_SWIPE_LIMIT) {
    throw new Error("SWIPE_LIMIT_REACHED");
  }

  await prisma.client.update({
    where: { id: clientId },
    data: { freemiumSwipeCount: { increment: 1 } },
  });
}

export function getFreemiumRestrictions() {
  return {
    canScroll: false,
    canChat: false,
    canBook: false,
    canInteractFitHub: false,
    canUseMatchQuestionnaire: false,
    swipesPerWindow: CLIENT_FREEMIUM_SWIPE_LIMIT,
    windowHours: CLIENT_FREEMIUM_SWIPE_WINDOW_HOURS,
  };
}

export const clientPlanAccessSelect = {
  clientPlanTier: true,
  vipSubscriptionActive: true,
  freemiumSwipeCount: true,
  freemiumSwipeWindowStartAt: true,
  platformTrialEndsAt: true,
  stripeSubscriptionActive: true,
} as const;
