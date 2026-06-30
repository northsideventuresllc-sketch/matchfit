import { ensureBetaWaitlistSchema } from "@/lib/ensure-beta-waitlist-schema";
import { ensureClientPlanSchema } from "@/lib/ensure-client-plan-schema";
import { ensureFpTierSchema } from "@/lib/ensure-fp-tier-schema";

let ensurePromise: Promise<void> | null = null;

/** Self-heal launch promo / beta cap / FP tier columns before public promo counters load. */
export async function ensureLaunchPromoSchema(): Promise<void> {
  if (ensurePromise) return ensurePromise;

  ensurePromise = (async () => {
    await Promise.all([ensureBetaWaitlistSchema(), ensureClientPlanSchema(), ensureFpTierSchema()]);
  })().finally(() => {
    ensurePromise = null;
  });

  return ensurePromise;
}
