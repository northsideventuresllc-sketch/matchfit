import { prisma } from "@/lib/prisma";
import { betaExcludeCapCountEmails } from "@/lib/beta-launch-config";

function excludeEmailNotClause(): { email: { in: string[] } } | undefined {
  const ex = [...betaExcludeCapCountEmails()].map((e) => e.toLowerCase());
  if (ex.length === 0) return undefined;
  return { email: { in: ex } };
}

/** Active clients counted for beta cap and founding membership offers (excludes test/staff emails and internal QA synthetic personas). */
export async function countLaunchClients(): Promise<number> {
  const excluded = excludeEmailNotClause();
  return prisma.client.count({
    where: {
      deidentifiedAt: null,
      internalQaSyntheticPersona: false,
      ...(excluded ? { NOT: excluded } : {}),
    },
  });
}

/** Active trainers counted for beta cap and founding registration pricing (excludes test/staff emails and internal QA synthetic personas). */
export async function countLaunchTrainers(): Promise<number> {
  const excluded = excludeEmailNotClause();
  return prisma.trainer.count({
    where: {
      deidentifiedAt: null,
      internalQaSyntheticPersona: false,
      ...(excluded ? { NOT: excluded } : {}),
    },
  });
}

/** Pending registrations awaiting payment (not yet active clients). */
export async function countPendingClientRegistrations(): Promise<number> {
  return prisma.pendingClientRegistration.count({
    where: {
      status: { in: ["PENDING_2FA", "AWAITING_PAYMENT"] },
      expiresAt: { gt: new Date() },
    },
  });
}
