import { prisma } from "@/lib/prisma";

/** Permanently removes expired pre-payment registration rows (no active client). */
export async function purgeExpiredRegistrationHolds(): Promise<void> {
  await prisma.pendingClientRegistration.deleteMany({
    where: { expiresAt: { lt: new Date() } },
  });
}
