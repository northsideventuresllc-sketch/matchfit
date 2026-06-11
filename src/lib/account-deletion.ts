import { promoteBetaWaitlistIfCapacity } from "@/lib/beta-waitlist-service";
import {
  deidentifyClientAccountWithDb,
  deidentifyTrainerAccountWithDb,
} from "@/lib/account-deidentify-core";
import { prisma } from "@/lib/prisma";

/**
 * Irreversibly scrub PII on a client account, cancel Stripe, and keep the row for FK / safety tooling.
 * Does not delete `SuspensionRecord` / `SafetyReport` rows (they reference this `id`).
 */
export async function deidentifyClientAccount(clientId: string): Promise<void> {
  const deidentified = await deidentifyClientAccountWithDb(prisma, clientId);
  if (!deidentified) return;
  void promoteBetaWaitlistIfCapacity().catch((e) => console.error("[account deletion] beta waitlist promote", e));
}

/**
 * Irreversibly scrub PII on a trainer account. Stripe is only touched for client-style billing if you later add IDs
 * on `Trainer`; today coach payouts use separate flows.
 */
export async function deidentifyTrainerAccount(trainerId: string): Promise<void> {
  const deidentified = await deidentifyTrainerAccountWithDb(prisma, trainerId);
  if (!deidentified) return;
  void promoteBetaWaitlistIfCapacity().catch((e) => console.error("[account deletion] beta waitlist promote", e));
}
