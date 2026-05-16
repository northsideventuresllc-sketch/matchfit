import { verifyPassword } from "@/lib/password";

function parseTruthishEnv(v: string | undefined): boolean {
  const t = v?.trim().toLowerCase();
  return t === "1" || t === "true" || t === "yes";
}

/** When true, Match Fit owner internal QA behaviors are enabled (see `.env.example`). */
export function isMatchFitInternalQaEnabled(): boolean {
  return parseTruthishEnv(process.env.MATCH_FIT_INTERNAL_QA_ENABLED);
}

function parseEmailList(raw: string | undefined): string[] {
  if (!raw?.trim()) return [];
  return raw
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

export function getMatchFitInternalQaClientEmails(): string[] {
  return parseEmailList(process.env.MATCH_FIT_INTERNAL_QA_CLIENT_EMAILS);
}

export function getMatchFitInternalQaTrainerEmails(): string[] {
  return parseEmailList(process.env.MATCH_FIT_INTERNAL_QA_TRAINER_EMAILS);
}

export function isMatchFitInternalQaClientEmail(email: string | null | undefined): boolean {
  if (!email || !isMatchFitInternalQaEnabled()) return false;
  const e = email.trim().toLowerCase();
  return getMatchFitInternalQaClientEmails().includes(e);
}

export function isMatchFitInternalQaTrainerEmail(email: string | null | undefined): boolean {
  if (!email || !isMatchFitInternalQaEnabled()) return false;
  const e = email.trim().toLowerCase();
  return getMatchFitInternalQaTrainerEmails().includes(e);
}

/** America/New_York calendar day key (YYYY-MM-DD) for daily QA simulation resets. */
export function matchFitInternalQaEstDayKey(d = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

export async function verifyMatchFitInternalQaAccountPassword(
  plain: string | undefined | null,
  passwordHash: string | null | undefined,
): Promise<boolean> {
  if (!plain || !passwordHash) return false;
  return verifyPassword(plain, passwordHash);
}

export async function verifyMatchFitInternalQaTrainerOnboardingBypass(args: {
  trainerEmail: string;
  trainerPasswordHash: string;
  inputPassword: string;
}): Promise<boolean> {
  if (!isMatchFitInternalQaEnabled()) return false;
  if (!isMatchFitInternalQaTrainerEmail(args.trainerEmail)) return false;
  return verifyMatchFitInternalQaAccountPassword(args.inputPassword, args.trainerPasswordHash);
}

export async function verifyMatchFitInternalQaClientOnboardingBypass(args: {
  clientEmail: string;
  clientPasswordHash: string;
  inputPassword: string;
}): Promise<boolean> {
  if (!isMatchFitInternalQaEnabled()) return false;
  if (!isMatchFitInternalQaClientEmail(args.clientEmail)) return false;
  return verifyMatchFitInternalQaAccountPassword(args.inputPassword, args.clientPasswordHash);
}
