import { Prisma } from "@/generated/prisma/client";
import { assertClientBetaSlotForFinalize } from "@/lib/beta-cap-enforcement";
import { BetaCapExceededError } from "@/lib/beta-cap-enforcement";
import { notifyClientMembershipTrialStarted } from "@/lib/client-membership-email-notify";
import type { ClientRegistrationHoldBody } from "@/lib/client-registration-hold";
import { addPlatformTrialDays } from "@/lib/client-platform-trial-constants";
import {
  ensureClientPlatformTrialSchema,
  isMissingClientPlatformTrialColumnError,
} from "@/lib/ensure-client-platform-trial-schema";
import { hashPassword } from "@/lib/password";
import { prisma } from "@/lib/prisma";

export type FinalizeClientSignupResult =
  | { ok: true; clientId: string; alreadyCompleted?: boolean }
  | { ok: false; error: string; code?: string };

function isSchemaDriftError(e: unknown): boolean {
  if (isMissingClientPlatformTrialColumnError(e)) return true;
  if (!(e instanceof Prisma.PrismaClientKnownRequestError)) return false;
  return e.code === "P2021" || e.code === "P2022";
}

async function createRegisteredClient(args: {
  body: ClientRegistrationHoldBody;
  passwordHash: string;
  now: Date;
  trialEndsAt: Date;
  twoFactorEnabled: boolean;
  twoFactorMethod: "EMAIL" | "NONE";
}) {
  const { body, passwordHash, now, trialEndsAt, twoFactorEnabled, twoFactorMethod } = args;
  const username = body.username.trim();
  const email = body.email.trim().toLowerCase();

  await ensureClientPlatformTrialSchema();

  try {
    return await prisma.client.create({
      data: {
        firstName: body.firstName,
        lastName: body.lastName,
        preferredName: body.preferredName?.trim() || "",
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
        stripeBillingLiveMode: false,
        subscriptionGraceUntil: null,
        stripeLastSubscriptionInvoicePaidAt: null,
        platformTrialEndsAt: trialEndsAt,
        paymentGraceUntil: null,
        accountDeactivatedAt: null,
        platformTrialConsumed: false,
      },
    });
  } catch (e) {
    if (!isSchemaDriftError(e)) throw e;
    console.error("[finalizeClientRegistrationFromSignup] retrying after schema repair", e);
    await ensureClientPlatformTrialSchema();
    return prisma.client.create({
      data: {
        firstName: body.firstName,
        lastName: body.lastName,
        preferredName: body.preferredName?.trim() || "",
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
        stripeBillingLiveMode: false,
        subscriptionGraceUntil: null,
        stripeLastSubscriptionInvoicePaidAt: null,
        platformTrialEndsAt: trialEndsAt,
        paymentGraceUntil: null,
        accountDeactivatedAt: null,
        platformTrialConsumed: false,
      },
    });
  }
}

export async function finalizeClientRegistrationFromSignup(
  body: ClientRegistrationHoldBody,
  options: {
    betaClientWaitlistEntryId: string | null;
    twoFactorEnabled: boolean;
    twoFactorMethod: "EMAIL" | "NONE";
    passwordHash?: string;
  },
): Promise<FinalizeClientSignupResult> {
  const email = body.email.trim().toLowerCase();
  const passwordHash = options.passwordHash ?? (await hashPassword(body.password));
  const now = new Date();
  const trialEndsAt = addPlatformTrialDays(now);
  const twoFactorEnabled = options.twoFactorEnabled;
  const twoFactorMethod = twoFactorEnabled ? options.twoFactorMethod : "NONE";
  const betaWl = options.betaClientWaitlistEntryId;

  try {
    await assertClientBetaSlotForFinalize(prisma, betaWl);
    const client = await createRegisteredClient({
      body,
      passwordHash,
      now,
      trialEndsAt,
      twoFactorEnabled,
      twoFactorMethod,
    });

    if (betaWl) {
      try {
        await prisma.betaClientWaitlistEntry.updateMany({
          where: { id: betaWl, status: "INVITED" },
          data: {
            status: "REGISTERED",
            registeredClientId: client.id,
            updatedAt: now,
          },
        });
      } catch (waitlistErr) {
        console.error("[finalizeClientRegistrationFromSignup] waitlist update failed (account created)", waitlistErr);
      }
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
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      const target = (e.meta as { target?: string[] })?.target ?? [];
      if (target.includes("email")) {
        const existing = await prisma.client.findUnique({ where: { email } });
        if (existing) {
          return { ok: true, clientId: existing.id, alreadyCompleted: true };
        }
        return { ok: false, error: "That email is already registered.", code: "EMAIL_TAKEN" };
      }
      if (target.includes("username")) {
        return { ok: false, error: "That username is already taken.", code: "USERNAME_TAKEN" };
      }
    }
    if (isSchemaDriftError(e)) {
      console.error("[finalizeClientRegistrationFromSignup] schema drift", e);
      return {
        ok: false,
        error:
          "Sign-up is temporarily unavailable while we finish a database update. Please try again in a few minutes or contact support@match-fit.net if this persists.",
        code: "SCHEMA_OUT_OF_DATE",
      };
    }
    console.error("[finalizeClientRegistrationFromSignup]", e);
    return {
      ok: false,
      error:
        "Could not create your account. Please try again or contact support@match-fit.net if this continues.",
      code: "REGISTER_CREATE_FAILED",
    };
  }
}
