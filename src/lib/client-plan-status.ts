import { isClientFreemiumGated, type ClientPlanAccessFields } from "@/lib/client-plan-access";

export type ClientPlanDisplayTier = "vip_trial" | "vip" | "free";

export type ClientPlanStatus = {
  displayTier: ClientPlanDisplayTier;
  clientPlanTier: string;
  vipSubscriptionActive: boolean;
  platformTrialEndsAt: string | null;
  platformTrialConsumed: boolean;
  isFreemiumGated: boolean;
  trialDaysRemaining: number | null;
};

export function resolveClientPlanDisplayTier(
  client: {
    clientPlanTier: string;
    vipSubscriptionActive: boolean;
    platformTrialEndsAt: Date | null;
  },
  nowMs: number = Date.now(),
): ClientPlanDisplayTier {
  if (client.vipSubscriptionActive) return "vip";
  const trialEnds = client.platformTrialEndsAt?.getTime() ?? 0;
  if (trialEnds > nowMs) return "vip_trial";
  return "free";
}

export function buildClientPlanStatus(
  client: ClientPlanAccessFields & { platformTrialConsumed?: boolean; platformTrialEndsAt?: Date | null },
): ClientPlanStatus {
  const nowMs = Date.now();
  const displayTier = resolveClientPlanDisplayTier(
    {
      clientPlanTier: client.clientPlanTier,
      vipSubscriptionActive: client.vipSubscriptionActive,
      platformTrialEndsAt: client.platformTrialEndsAt ?? null,
    },
    nowMs,
  );
  const trialEnds = client.platformTrialEndsAt?.getTime() ?? 0;
  const trialDaysRemaining =
    trialEnds > nowMs ? Math.max(0, Math.ceil((trialEnds - nowMs) / (24 * 60 * 60 * 1000))) : null;

  return {
    displayTier,
    clientPlanTier: (client.clientPlanTier ?? "FREEMIUM").trim().toUpperCase(),
    vipSubscriptionActive: Boolean(client.vipSubscriptionActive),
    platformTrialEndsAt: client.platformTrialEndsAt?.toISOString() ?? null,
    platformTrialConsumed: Boolean(client.platformTrialConsumed),
    isFreemiumGated: isClientFreemiumGated(client, nowMs),
    trialDaysRemaining,
  };
}
