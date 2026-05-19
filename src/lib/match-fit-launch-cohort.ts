import { prisma } from "@/lib/prisma";
import {
  isMatchFitInternalQaClientEmail,
  isMatchFitInternalQaTrainerEmail,
} from "@/lib/match-fit-internal-qa";

export const LAUNCH_COHORT_MAX_CLIENTS = 50;
export const LAUNCH_COHORT_MAX_TRAINERS = 10;
export const LAUNCH_CLIENT_TRIAL_DAYS = 7;
export const STANDARD_CLIENT_TRIAL_HOURS = 72;
export const LAUNCH_TRAINER_PREMIUM_DAYS = 14;

export type ClientTrialPlan = "LAUNCH_7D" | "STANDARD_72H" | "PAY_NOW" | "NONE";

function parseExcludedEmails(): string[] {
  const raw = process.env.MATCH_FIT_LAUNCH_COHORT_EXCLUDED_EMAILS?.trim();
  if (!raw) return [];
  return raw
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

/** Test / internal QA accounts do not consume launch cohort slots. */
export function isExcludedFromLaunchCohort(args: {
  email: string;
  internalQaSynthetic?: boolean;
}): boolean {
  const email = args.email.trim().toLowerCase();
  if (args.internalQaSynthetic) return true;
  if (isMatchFitInternalQaClientEmail(email) || isMatchFitInternalQaTrainerEmail(email)) return true;
  return parseExcludedEmails().includes(email);
}

export async function countLaunchCohortClients(): Promise<number> {
  return prisma.client.count({
    where: { launchCohortMember: true, deidentifiedAt: null },
  });
}

export async function countLaunchCohortTrainers(): Promise<number> {
  return prisma.trainer.count({
    where: { launchCohortMember: true, internalQaSyntheticPersona: false },
  });
}

/** Trainers who finished onboarding far enough to use the main dashboard (consumes launch promo slots). */
export async function countSuccessfullyOnboardedTrainers(): Promise<number> {
  return prisma.trainer.count({
    where: {
      internalQaSyntheticPersona: false,
      deidentifiedAt: null,
      profile: { dashboardActivatedAt: { not: null } },
    },
  });
}

export async function canReserveLaunchClientSlot(email: string): Promise<boolean> {
  if (isExcludedFromLaunchCohort({ email })) return false;
  const count = await countLaunchCohortClients();
  return count < LAUNCH_COHORT_MAX_CLIENTS;
}

export async function canReserveLaunchTrainerSlot(email: string): Promise<boolean> {
  if (isExcludedFromLaunchCohort({ email })) return false;
  const count = await countSuccessfullyOnboardedTrainers();
  return count < LAUNCH_COHORT_MAX_TRAINERS;
}

export function clientTrialDaysForPlan(plan: ClientTrialPlan): number {
  if (plan === "LAUNCH_7D") return LAUNCH_CLIENT_TRIAL_DAYS;
  if (plan === "STANDARD_72H") return 3;
  return 0;
}

export function resolveClientTrialPlanForCheckout(args: {
  launchCohortEligible: boolean;
  requestedPlan?: string | null;
}): ClientTrialPlan {
  const req = (args.requestedPlan ?? "").trim().toUpperCase();
  if (req === "PAY_NOW") return "PAY_NOW";
  if (args.launchCohortEligible && req !== "STANDARD_72H") return "LAUNCH_7D";
  return "STANDARD_72H";
}
