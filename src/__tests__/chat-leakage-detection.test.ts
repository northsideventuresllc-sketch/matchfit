import { describe, expect, it } from "vitest";
import {
  getChatContactLeakageBlockReason,
  scanChatTextForLeakageSignals,
} from "@/lib/chat-leakage-detection";
import {
  evaluateTrainerNudgeQuota,
  FP_NUDGE_PACK_SIZE,
  LEGACY_FREE_TRAINER_NUDGES_PER_DAY,
} from "@/lib/trainer-nudge-limits";
import {
  INDEPENDENT_FP_DAILY_NUDGES,
  trainerCanUseInAppChat,
  trainerCanUseNudgeFeature,
} from "@/lib/fp-tier-chat-policy";

describe("chat-leakage-detection", () => {
  it("flags US phone numbers", () => {
    expect(scanChatTextForLeakageSignals("Call me at (404) 555-1212").flagged).toBe(true);
    expect(getChatContactLeakageBlockReason("(404) 555-1212")).not.toBeNull();
  });

  it("flags common email TLDs beyond .com for standard tiers", () => {
    expect(scanChatTextForLeakageSignals("Reach me at coach@studio.edu").flagged).toBe(true);
    expect(scanChatTextForLeakageSignals("coach@match.fit").flagged).toBe(true);
  });

  it("allows business email for Elite Fitness Pro", () => {
    expect(scanChatTextForLeakageSignals("Email coach@studio.edu", "elite_fitness_pro").flagged).toBe(false);
    expect(getChatContactLeakageBlockReason("coach@studio.edu", "elite_fitness_pro")).toBeNull();
  });

  it("still blocks phone numbers for Elite Fitness Pro", () => {
    expect(scanChatTextForLeakageSignals("Call (404) 555-1212", "elite_fitness_pro").flagged).toBe(true);
  });

  it("allows external listing URLs for Elite Fitness Pro", () => {
    const result = scanChatTextForLeakageSignals("Book at https://my-studio.com/listing", "elite_fitness_pro");
    expect(result.flagged).toBe(false);
  });

  it("flags payment app keywords", () => {
    expect(scanChatTextForLeakageSignals("Pay me on venmo").flagged).toBe(true);
  });

  it("allows normal coaching copy", () => {
    expect(scanChatTextForLeakageSignals("See you Tuesday for legs day.").flagged).toBe(false);
    expect(getChatContactLeakageBlockReason("Great session today!")).toBeNull();
  });
});

describe("fp-tier-chat-policy", () => {
  it("Independent Fitness Pro cannot use in-app chat but can nudge", () => {
    expect(trainerCanUseInAppChat("independent_fitness_pro")).toBe(false);
    expect(trainerCanUseNudgeFeature("independent_fitness_pro")).toBe(true);
  });

  it("Match Fit Pro uses chat, not nudges", () => {
    expect(trainerCanUseInAppChat("match_fit_pro")).toBe(true);
    expect(trainerCanUseNudgeFeature("match_fit_pro")).toBe(false);
  });
});

describe("trainer-nudge-limits", () => {
  it("allows Independent FP daily nudges then purchased credits", () => {
    const atCap = evaluateTrainerNudgeQuota({
      accountTier: "independent_fitness_pro",
      nudgesUsedToday: INDEPENDENT_FP_DAILY_NUDGES,
      nudgeCreditsBalance: 2,
      legacyPremiumStudio: false,
    });
    expect(atCap.allowed).toBe(true);
    expect(atCap.usesPurchasedCredit).toBe(true);

    const blocked = evaluateTrainerNudgeQuota({
      accountTier: "independent_fitness_pro",
      nudgesUsedToday: INDEPENDENT_FP_DAILY_NUDGES,
      nudgeCreditsBalance: 0,
      legacyPremiumStudio: false,
    });
    expect(blocked.allowed).toBe(false);
    expect(blocked.reason).toBe("daily_cap");
  });

  it("blocks nudges for Match Fit Pro", () => {
    const result = evaluateTrainerNudgeQuota({
      accountTier: "match_fit_pro",
      nudgesUsedToday: 0,
      nudgeCreditsBalance: 0,
      legacyPremiumStudio: false,
    });
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe("not_allowed");
  });

  it("uses legacy free cap for trainers without tier", () => {
    const result = evaluateTrainerNudgeQuota({
      accountTier: null,
      nudgesUsedToday: LEGACY_FREE_TRAINER_NUDGES_PER_DAY,
      nudgeCreditsBalance: 0,
      legacyPremiumStudio: false,
    });
    expect(result.allowed).toBe(false);
    expect(result.dailyLimit).toBe(LEGACY_FREE_TRAINER_NUDGES_PER_DAY);
  });

  it("exports nudge pack size constant", () => {
    expect(FP_NUDGE_PACK_SIZE).toBe(10);
  });
});
