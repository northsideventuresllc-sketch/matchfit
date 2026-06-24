import { ensureBetaWaitlistSchema } from "@/lib/ensure-beta-waitlist-schema";
import { ensureClientPlanSchema } from "@/lib/ensure-client-plan-schema";

let ensurePromise: Promise<void> | null = null;

/** Self-heal launch promo / beta cap columns before public promo counters load. */
export async function ensureLaunchPromoSchema(): Promise<void> {
  if (ensurePromise) return ensurePromise;

  ensurePromise = (async () => {
    await Promise.all([ensureBetaWaitlistSchema(), ensureClientPlanSchema()]);
  })().finally(() => {
    ensurePromise = null;
  });

  return ensurePromise;
}
