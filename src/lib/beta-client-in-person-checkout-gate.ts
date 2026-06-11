import { isZipInBetaAtlantaMetroArea } from "@/lib/beta-atlanta-metro-zips";
import { isBetaLaunchGatesEnabled } from "@/lib/beta-launch-config";
import type { ServiceDeliveryMode } from "@/lib/trainer-match-questionnaire";

export const BETA_CLIENT_IN_PERSON_CHECKOUT_MESSAGE =
  "In-person sessions are Atlanta-metro only during beta. This coach's virtual offerings are available nationwide.";

export function serviceDeliveryRequiresInPersonBetaGate(delivery: ServiceDeliveryMode): boolean {
  return delivery === "in_person" || delivery === "both";
}

export type ClientInPersonBetaCheckoutGateResult =
  | { allowed: true }
  | { allowed: false; message: string; code: "BETA_IN_PERSON_GEO" };

export function evaluateClientInPersonBetaCheckoutGate(args: {
  clientZipCode: string | null | undefined;
  delivery: ServiceDeliveryMode;
  gatesEnabled?: boolean;
}): ClientInPersonBetaCheckoutGateResult {
  const gatesOn = args.gatesEnabled ?? isBetaLaunchGatesEnabled();
  if (!gatesOn) return { allowed: true };
  if (!serviceDeliveryRequiresInPersonBetaGate(args.delivery)) return { allowed: true };
  if (isZipInBetaAtlantaMetroArea(args.clientZipCode ?? "")) return { allowed: true };
  return {
    allowed: false,
    message: BETA_CLIENT_IN_PERSON_CHECKOUT_MESSAGE,
    code: "BETA_IN_PERSON_GEO",
  };
}

/** Client match preference modes that imply in-person / mobile sessions during beta. */
export const BETA_GATED_CLIENT_DELIVERY_MODES = ["in_person", "mobile"] as const;

export function isClientDeliveryModeBetaGated(mode: string): boolean {
  return mode === "in_person" || mode === "mobile";
}
