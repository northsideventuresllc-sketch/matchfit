import { prisma } from "@/lib/prisma";

export type ClientRegisterInsertProbeResult =
  | { ok: true }
  | { ok: false; code: string; message: string };

/**
 * Attempts a minimal clients INSERT inside a transaction and rolls back.
 * Surfaces NOT NULL / schema drift issues that column counts alone miss.
 */
export async function probeClientRegisterInsert(): Promise<ClientRegisterInsertProbeResult> {
  const suffix = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const username = `mf_probe_${suffix}`.slice(0, 28);
  const email = `mf.probe.${suffix}@internal.match-fit.invalid`;

  try {
    await prisma.$transaction(async (tx) => {
      await tx.client.create({
        data: {
          firstName: "Probe",
          lastName: "User",
          preferredName: "Probe",
          username,
          phone: "5555550199",
          email,
          passwordHash: "probe",
          zipCode: "10001",
          dateOfBirth: "1990-01-01",
          termsAcceptedAt: new Date(),
          privacyPolicyAcceptedAt: new Date(),
          twoFactorEnabled: false,
          twoFactorMethod: "NONE",
          stayLoggedIn: true,
          stripeSubscriptionActive: false,
          stripeBillingLiveMode: false,
          platformTrialEndsAt: new Date(),
          platformTrialConsumed: false,
        },
      });
      throw new Error("PROBE_ROLLBACK");
    });
    return { ok: true };
  } catch (e) {
    if (e instanceof Error && e.message === "PROBE_ROLLBACK") {
      return { ok: true };
    }
    const message = e instanceof Error ? e.message : String(e);
    if (message.includes("stripeBillingLiveMode") && message.includes("null value")) {
      return {
        ok: false,
        code: "STRIPE_BILLING_LIVE_MODE_NOT_NULL",
        message,
      };
    }
    return {
      ok: false,
      code: "CLIENT_INSERT_PROBE_FAILED",
      message,
    };
  }
}
