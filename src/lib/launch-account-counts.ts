import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { betaExcludeCapCountEmails } from "@/lib/beta-launch-config";
import {
  getMatchFitInternalQaClientEmails,
  getMatchFitInternalQaTrainerEmails,
} from "@/lib/match-fit-internal-qa";

/** Auto-generated internal QA personas (see `internal-qa-simulation.ts`). */
export const INTERNAL_SYNTHETIC_EMAIL_SUFFIX = "@internal.match-fit.invalid";

export function isInternalSyntheticMatchFitEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return email.trim().toLowerCase().endsWith(INTERNAL_SYNTHETIC_EMAIL_SUFFIX);
}

/** Emails that must never count toward beta caps, founding promos, or public signup totals. */
export function getLaunchExcludeEmails(role: "client" | "trainer"): string[] {
  const ex = new Set<string>([...betaExcludeCapCountEmails()].map((e) => e.toLowerCase()));
  const qa = role === "client" ? getMatchFitInternalQaClientEmails() : getMatchFitInternalQaTrainerEmails();
  for (const e of qa) ex.add(e.toLowerCase());
  return [...ex];
}

function launchCountNotClause(role: "client" | "trainer") {
  const excluded = getLaunchExcludeEmails(role);
  const or = [
    { email: { endsWith: INTERNAL_SYNTHETIC_EMAIL_SUFFIX, mode: "insensitive" as const } },
    // Exclude all RFC 6761 .invalid TLD emails (test/demo/seed accounts)
    { email: { endsWith: ".invalid", mode: "insensitive" as const } },
    ...(excluded.length > 0 ? [{ email: { in: excluded } }] : []),
  ];
  return { OR: or };
}

/** Prisma filter for real launch signups (trainers). */
export function launchTrainerCountWhere(): Prisma.TrainerWhereInput {
  return {
    deidentifiedAt: null,
    internalQaSyntheticPersona: false,
    NOT: launchCountNotClause("trainer"),
  };
}

/** Prisma filter for real launch signups (clients). */
export function launchClientCountWhere(): Prisma.ClientWhereInput {
  return {
    deidentifiedAt: null,
    internalQaSyntheticPersona: false,
    NOT: launchCountNotClause("client"),
  };
}

/** Active clients counted for beta cap and founding membership offers. */
export async function countLaunchClients(): Promise<number> {
  return prisma.client.count({ where: launchClientCountWhere() });
}

/** Active trainers counted for beta cap and founding registration pricing. */
export async function countLaunchTrainers(): Promise<number> {
  return prisma.trainer.count({ where: launchTrainerCountWhere() });
}

export async function countLaunchTrainersInTx(tx: Prisma.TransactionClient): Promise<number> {
  return tx.trainer.count({ where: launchTrainerCountWhere() });
}

export async function countLaunchClientsInTx(tx: Prisma.TransactionClient): Promise<number> {
  return tx.client.count({ where: launchClientCountWhere() });
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
