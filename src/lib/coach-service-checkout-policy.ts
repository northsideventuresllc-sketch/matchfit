/** Where the client initiated coach-service checkout (profile link vs chat/shared prep link). */
export type CoachServiceCheckoutContext = "profile" | "chat";

export function parseCoachServiceCheckoutContext(raw: string | null | undefined): CoachServiceCheckoutContext {
  return raw?.trim().toLowerCase() === "chat" ? "chat" : "profile";
}

export type CoachServiceCheckoutDenyReason = "CONVERSATION_REQUIRED" | "PROFILE_CHECKOUT_DISABLED";

export type CoachServiceCheckoutPolicyResult =
  | { allowed: true }
  | { allowed: false; reason: CoachServiceCheckoutDenyReason; message: string };

/**
 * Server-side rules:
 * - Purchasing always requires an open chat (`officialChatStartedAt`) with the coach.
 * - Profile prep-page / profile links require `clientsCanPurchaseServicesFromProfile`.
 * - Chat context (`ctx=chat`) allows checkout when the trainer only sells via shared links from chat.
 */
export function evaluateCoachServiceCheckoutPolicy(args: {
  checkoutContext: CoachServiceCheckoutContext;
  clientsCanPurchaseServicesFromProfile: boolean;
  officialChatStartedAt: Date | null | undefined;
}): CoachServiceCheckoutPolicyResult {
  if (!args.officialChatStartedAt) {
    return {
      allowed: false,
      reason: "CONVERSATION_REQUIRED",
      message: "Start a conversation with this coach in Messages before purchasing a package.",
    };
  }
  if (args.checkoutContext === "profile" && !args.clientsCanPurchaseServicesFromProfile) {
    return {
      allowed: false,
      reason: "PROFILE_CHECKOUT_DISABLED",
      message: "This coach shares purchase links in chat. Open your thread to check out.",
    };
  }
  return { allowed: true };
}
