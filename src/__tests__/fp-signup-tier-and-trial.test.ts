import { describe, expect, it } from "vitest";
import { resolveFpSignupTier, resolveFpTierSignupOutcome } from "@/lib/fp-tier-beta-signup";
import { resolveTrainerTrialPrompt, TRAINER_TRIAL_PROMPT_LEAD_DAYS } from "@/lib/trainer-trial-decision";
import { resolveUploadFileKind } from "@/lib/upload-file-type";

const allPricesConfigured = () => true;
const noPricesConfigured = () => false;

describe("Match Fit Pro auto-upgrade during beta", () => {
  it("upgrades Match Fit Pro to Premium Pro inside the first 30", () => {
    expect(resolveFpSignupTier("match_fit_pro", 0, true)).toBe("match_fit_premium_pro");
    expect(resolveFpSignupTier("match_fit_pro", 29, true)).toBe("match_fit_premium_pro");
  });

  it("stops upgrading once 30 Fitness Pros have signed up", () => {
    expect(resolveFpSignupTier("match_fit_pro", 30, true)).toBe("match_fit_pro");
  });

  it("leaves other tiers and non-beta signups alone", () => {
    expect(resolveFpSignupTier("elite_fitness_pro", 0, true)).toBe("elite_fitness_pro");
    expect(resolveFpSignupTier("match_fit_pro", 0, false)).toBe("match_fit_pro");
  });
});

describe("tier selection outcome", () => {
  it("sends the founding cohort straight through on every tier, with no checkout", () => {
    for (const tier of ["match_fit_pro", "match_fit_premium_pro", "independent_fitness_pro", "elite_fitness_pro"] as const) {
      const outcome = resolveFpTierSignupOutcome({
        requested: tier,
        existingTrainerCount: 5,
        foundingCohortMax: 30,
        tierHasConfiguredPrice: allPricesConfigured,
        betaActive: true,
      });
      expect(outcome.foundingCohort).toBe(true);
      expect(outcome.requiresCheckoutNow).toBe(false);
    }
  });

  it("takes payment for fee-bearing tiers once the cohort is full", () => {
    const elite = resolveFpTierSignupOutcome({
      requested: "elite_fitness_pro",
      existingTrainerCount: 30,
      foundingCohortMax: 30,
      tierHasConfiguredPrice: allPricesConfigured,
      betaActive: true,
    });
    expect(elite).toMatchObject({ foundingCohort: false, requiresCheckoutNow: true });
  });

  it("still sends Match Fit Pro to the dashboard after the cohort is full", () => {
    const pro = resolveFpTierSignupOutcome({
      requested: "match_fit_pro",
      existingTrainerCount: 100,
      foundingCohortMax: 30,
      tierHasConfiguredPrice: allPricesConfigured,
      betaActive: true,
    });
    expect(pro).toMatchObject({ tier: "match_fit_pro", requiresCheckoutNow: false });
  });

  it("does not ask for checkout a tier has no price for", () => {
    const outcome = resolveFpTierSignupOutcome({
      requested: "independent_fitness_pro",
      existingTrainerCount: 50,
      foundingCohortMax: 30,
      tierHasConfiguredPrice: noPricesConfigured,
      betaActive: true,
    });
    // The route turns this into a plain "not available right now" rather than granting it free.
    expect(outcome.requiresCheckoutNow).toBe(false);
  });
});

describe("end-of-trial prompt", () => {
  const now = Date.UTC(2026, 7, 4);
  const inDays = (n: number) => new Date(now + n * 24 * 60 * 60 * 1000);

  it("stays quiet well before the trial ends", () => {
    expect(
      resolveTrainerTrialPrompt(
        {
          accountTier: "match_fit_premium_pro",
          platformTrialEndsAt: inDays(TRAINER_TRIAL_PROMPT_LEAD_DAYS + 5),
          stripeSubscriptionActive: false,
        },
        now,
      ),
    ).toEqual({ kind: "none" });
  });

  it("offers Premium Pro a choice as the trial runs out", () => {
    const prompt = resolveTrainerTrialPrompt(
      {
        accountTier: "match_fit_premium_pro",
        platformTrialEndsAt: inDays(2),
        stripeSubscriptionActive: false,
      },
      now,
    );
    expect(prompt).toMatchObject({ kind: "premium_choice", daysLeft: 2, expired: false });
  });

  it("tells paid tiers payment is needed", () => {
    expect(
      resolveTrainerTrialPrompt(
        { accountTier: "elite_fitness_pro", platformTrialEndsAt: inDays(-1), stripeSubscriptionActive: false },
        now,
      ),
    ).toMatchObject({ kind: "payment_required", tier: "elite_fitness_pro", expired: true });
  });

  it("says nothing to subscribers, exempt accounts, or free Match Fit Pro", () => {
    const base = { platformTrialEndsAt: inDays(1) };
    expect(
      resolveTrainerTrialPrompt({ ...base, accountTier: "elite_fitness_pro", stripeSubscriptionActive: true }, now),
    ).toEqual({ kind: "none" });
    expect(
      resolveTrainerTrialPrompt(
        { ...base, accountTier: "elite_fitness_pro", stripeSubscriptionActive: false, platformBillingExempt: true },
        now,
      ),
    ).toEqual({ kind: "none" });
    expect(
      resolveTrainerTrialPrompt({ ...base, accountTier: "match_fit_pro", stripeSubscriptionActive: false }, now),
    ).toEqual({ kind: "none" });
  });
});

describe("upload type detection", () => {
  const pdf = Buffer.concat([Buffer.from("%PDF-1.7\n"), Buffer.alloc(64)]);

  it("accepts a PDF the browser failed to label", () => {
    // This is the case that made a valid 1.9 MB certification fail to upload.
    expect(resolveUploadFileKind({ declaredMime: "", filename: "cert", bytes: pdf })).toEqual({
      ext: "pdf",
      mime: "application/pdf",
    });
    expect(
      resolveUploadFileKind({ declaredMime: "application/octet-stream", filename: "cert.pdf", bytes: pdf }),
    ).toMatchObject({ ext: "pdf" });
  });

  it("trusts the contents over a misleading name", () => {
    const png = Buffer.concat([
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      Buffer.alloc(16),
    ]);
    expect(resolveUploadFileKind({ declaredMime: "application/pdf", filename: "x.pdf", bytes: png })).toMatchObject({
      ext: "png",
    });
  });

  it("rejects something that is not a supported document at all", () => {
    expect(
      resolveUploadFileKind({ declaredMime: "application/zip", filename: "x.zip", bytes: Buffer.from("PK") }),
    ).toBeNull();
  });
});
