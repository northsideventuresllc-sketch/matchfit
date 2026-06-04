import { assertClientBetaSlotForFinalize } from "@/lib/beta-cap-enforcement";
import { BetaCapExceededError } from "@/lib/beta-cap-enforcement";
import { notifyClientMembershipTrialStarted } from "@/lib/client-membership-email-notify";
import type { ClientRegistrationHoldBody } from "@/lib/client-registration-hold";
import { addPlatformTrialDays } from "@/lib/client-platform-trial-constants";
import { hashPassword } from "@/lib/password";
import { prisma } from "@/lib/prisma";

export type FinalizeClientSignupResult =
  | { ok: true; clientId: string; alreadyCompleted?: boolean }
  | { ok: false; error: string; code?: string };

export async function finalizeClientRegistrationFromSignup(
  body: ClientRegistrationHoldBody,
  options: {
    betaClientWaitlistEntryId: string | null;
    twoFactorEnabled: boolean;
    twoFactorMethod: "EMAIL" | "NONE";
    passwordHash?: string;
  },
): Promise<FinalizeClientSignupResult> {
  const username = body.username.trim();
  const email = body.email.trim().toLowerCase();
  const passwordHash = options.passwordHash ?? (await hashPassword(body.password));
  const now = new Date();
  const trialEndsAt = addPlatformTrialDays(now);
  const twoFactorEnabled = options.twoFactorEnabled;
  const twoFactorMethod = twoFactorEnabled ? options.twoFactorMethod : "NONE";
  const betaWl = options.betaClientWaitlistEntryId;

  try {
    await assertClientBetaSlotForFinalize(prisma, betaWl);
    const client = await prisma.client.create({
      data: {
        firstName: body.firstName,
        lastName: body.lastName,
        preferredName: body.preferredName,
        username,
        phone: body.phone.trim(),
        email,
        passwordHash,
        zipCode: body.zipCode,
        dateOfBirth: body.dateOfBirth,
        termsAcceptedAt: now,
        privacyPolicyAcceptedAt: now,
        twoFactorEnabled,
        twoFactorMethod,
        stayLoggedIn: body.stayLoggedIn,
        stripeCustomerId: null,
        stripeSubscriptionId: null,
        stripeSubscriptionActive: false,
        stripeBillingLiveMode: null,
        subscriptionGraceUntil: null,
        stripeLastSubscriptionInvoicePaidAt: null,
        platformTrialEndsAt: trialEndsAt,
        paymentGraceUntil: null,
        accountDeactivatedAt: null,
        platformTrialConsumed: false,
      },
    });
    if (betaWl) {
      await prisma.betaClientWaitlistEntry.updateMany({
        where: { id: betaWl, status: "INVITED" },
        data: {
          status: "REGISTERED",
          registeredClientId: client.id,
          updatedAt: now,
        },
      });
    }

    void notifyClientMembershipTrialStarted({
      clientId: client.id,
      email,
      trialDays: Math.max(1, Math.round((trialEndsAt.getTime() - now.getTime()) / (24 * 60 * 60 * 1000))),
      trialEndLabel: trialEndsAt.toLocaleDateString("en-US", { dateStyle: "long" }),
      foundingSlot: false,
      cardOnFile: false,
    });

    return { ok: true, clientId: client.id };
  } catch (e) {
    if (e instanceof BetaCapExceededError) {
      return { ok: false, error: e.message, code: e.code };
    }
    if (e && typeof e === "object" && "code" in e && (e as { code?: string }).code === "P2002") {
      const existing = await prisma.client.findUnique({ where: { email } });
      if (existing) {
        return { ok: true, clientId: existing.id, alreadyCompleted: true };
      }
    }
    if (
      e &&
      typeof e === "object" &&
      "code" in e &&
      ((e as { code?: string }).code === "P2022" || (e as { code?: string }).code === "P2021")
    ) {
      console.error("[finalizeClientRegistrationFromSignup] schema drift", e);
      return {
        ok: false,
        error:
          "Sign-up is temporarily unavailable while we finish a database update. Please try again in a few minutes.",
        code: "SCHEMA_OUT_OF_DATE",
      };
    }
    console.error(e);
    return { ok: false, error: "Could not create your account." };
  }
}
