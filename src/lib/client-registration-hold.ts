import { assertClientBetaSlotInTransaction } from "@/lib/beta-cap-enforcement";
import { hashPassword } from "@/lib/password";
import { prisma } from "@/lib/prisma";

export type ClientRegistrationHoldBody = {
  firstName: string;
  lastName: string;
  preferredName: string;
  username: string;
  phone: string;
  email: string;
  password: string;
  zipCode: string;
  dateOfBirth: string;
  stayLoggedIn: boolean;
};

const HOLD_TTL_MS = 72 * 60 * 60 * 1000;

export async function createClientRegistrationHold(
  body: ClientRegistrationHoldBody,
  options: {
    betaClientWaitlistEntryId: string | null;
    status: "AWAITING_PAYMENT" | "PENDING_2FA";
    twoFactorEnabled: boolean;
    twoFactorMethod: "EMAIL" | "NONE";
    otpHash: string | null;
    otpExpiresAt: Date | null;
    expiresAt?: Date;
  },
) {
  const username = body.username.trim();
  const email = body.email.trim().toLowerCase();
  const passwordHash = await hashPassword(body.password);

  return prisma.$transaction(
    async (tx) => {
      await assertClientBetaSlotInTransaction(tx, options.betaClientWaitlistEntryId);
      return tx.pendingClientRegistration.create({
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
          termsAcceptedAt: new Date(),
          privacyPolicyAcceptedAt: new Date(),
          status: options.status,
          twoFactorEnabled: options.twoFactorEnabled,
          twoFactorMethod: options.twoFactorMethod,
          otpHash: options.otpHash,
          otpExpiresAt: options.otpExpiresAt,
          stayLoggedIn: body.stayLoggedIn,
          expiresAt: options.expiresAt ?? new Date(Date.now() + HOLD_TTL_MS),
          betaClientWaitlistEntryId: options.betaClientWaitlistEntryId ?? undefined,
        },
      });
    },
    { isolationLevel: "Serializable" },
  );
}
