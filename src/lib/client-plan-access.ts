import { prisma } from "@/lib/prisma";

export const CLIENT_FREEMIUM_SWIPE_LIMIT = 10;
export const CLIENT_FREEMIUM_SWIPE_WINDOW_HOURS = 12;
export const CLIENT_VIP_PRICE_USD = 10;

export type ClientPlanTier = "FREEMIUM" | "VIP";

const SWIPE_WINDOW_MS = CLIENT_FREEMIUM_SWIPE_WINDOW_HOURS * 60 * 60 * 1000;

export function isVip(client: { clientPlanTier: string }): boolean {
  return (client.clientPlanTier ?? "").trim().toUpperCase() === "VIP";
}

export function canSwipe(
  client: {
    freemiumSwipeCount: number;
    freemiumSwipeWindowStartAt: Date | null;
    clientPlanTier: string;
  },
  now: Date = new Date(),
): boolean {
  if (isVip(client)) return true;
  const windowStart = client.freemiumSwipeWindowStartAt;
  if (!windowStart) return true;
  const elapsed = now.getTime() - windowStart.getTime();
  if (elapsed >= SWIPE_WINDOW_MS) return true;
  return client.freemiumSwipeCount < CLIENT_FREEMIUM_SWIPE_LIMIT;
}

export async function recordSwipe(clientId: string): Promise<void> {
  const now = new Date();
  const client = await prisma.client.findUnique({
    where: { id: clientId },
    select: {
      clientPlanTier: true,
      freemiumSwipeCount: true,
      freemiumSwipeWindowStartAt: true,
    },
  });
  if (!client) throw new Error("CLIENT_NOT_FOUND");
  if (isVip(client)) return;

  let swipeCount = client.freemiumSwipeCount;
  let windowStart = client.freemiumSwipeWindowStartAt;

  if (!windowStart || now.getTime() - windowStart.getTime() >= SWIPE_WINDOW_MS) {
    windowStart = now;
    swipeCount = 0;
  }

  if (swipeCount >= CLIENT_FREEMIUM_SWIPE_LIMIT) {
    throw new Error("SWIPE_LIMIT_REACHED");
  }

  await prisma.client.update({
    where: { id: clientId },
    data: {
      freemiumSwipeCount: swipeCount + 1,
      freemiumSwipeWindowStartAt: windowStart,
    },
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

export type ClientPlanGateFields = {
  clientPlanTier: string;
  vipSubscriptionActive: boolean;
  stripeSubscriptionActive: boolean;
  platformTrialEndsAt: Date | null;
};

const clientPlanSelect = {
  clientPlanTier: true,
  vipSubscriptionActive: true,
  stripeSubscriptionActive: true,
  platformTrialEndsAt: true,
} as const;

/** VIP, active Stripe sub, or platform trial — otherwise FREEMIUM restrictions apply. */
export function clientHasFullPlanAccess(client: ClientPlanGateFields, nowMs: number = Date.now()): boolean {
  if (isVip(client) && client.vipSubscriptionActive) return true;
  if (client.stripeSubscriptionActive) return true;
  const trialEnds = client.platformTrialEndsAt?.getTime() ?? 0;
  if (trialEnds > nowMs) return true;
  return false;
}

export async function loadClientPlanGate(clientId: string) {
  return prisma.client.findUnique({
    where: { id: clientId },
    select: clientPlanSelect,
  });
}

export function freemiumGateError(
  code:
    | "FREEMIUM_NO_SCROLL"
    | "FREEMIUM_NO_CHAT"
    | "FREEMIUM_NO_BOOKING"
    | "FREEMIUM_NO_FITHUB_INTERACT"
    | "FREEMIUM_NO_QUESTIONNAIRE"
    | "FREEMIUM_SWIPE_LIMIT",
): { error: typeof code } {
  return { error: code };
}
