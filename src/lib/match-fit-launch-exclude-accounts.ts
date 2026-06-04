import {
  getMatchFitInternalQaClientEmails,
  getMatchFitInternalQaTrainerEmails,
} from "@/lib/match-fit-internal-qa";
import { getMatchFitTestTrainerEmails } from "@/lib/match-fit-test-trainer-emails";
import { TRAINER_DEV_FAKE_CPT_CERTIFICATION_PATH } from "@/lib/trainer-dev-cert-placeholders";

/**
 * Owner / seed QA accounts — always excluded from founding & beta counters without relying on Vercel env.
 * Keep in sync with `scripts/seed-match-fit-dev-test-accounts.js`.
 */
/** Integration-test fixture domain (see `login-2fa.integration.test.ts`). */
export const MATCH_FIT_INTEGRATION_TEST_EMAIL_SUFFIX = "@example.test";

export const MATCH_FIT_BUILTIN_LAUNCH_EXCLUDE_EMAILS = [
  "jonnybooth22@gmail.com",
  "jb@northsideventuresgroup.com",
  "jb@match-fit.net",
  "twofa_tester@example.test",
] as const;

export const MATCH_FIT_BUILTIN_LAUNCH_EXCLUDE_CLIENT_USERNAMES = ["jbfitness6299", "twofa_tester"] as const;

export const MATCH_FIT_BUILTIN_LAUNCH_EXCLUDE_TRAINER_USERNAMES = ["coachjonny22"] as const;

function parseCsvLower(raw: string | undefined): string[] {
  if (!raw?.trim()) return [];
  return raw
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

function identEmail(raw: string | undefined): string | null {
  const v = raw?.trim().toLowerCase();
  if (!v || !v.includes("@")) return null;
  return v;
}

/** All emails excluded from launch counters for either role. */
export function getMatchFitLaunchExcludeEmails(): string[] {
  const ex = new Set<string>(MATCH_FIT_BUILTIN_LAUNCH_EXCLUDE_EMAILS.map((e) => e.toLowerCase()));

  for (const e of getMatchFitInternalQaClientEmails()) ex.add(e);
  for (const e of getMatchFitInternalQaTrainerEmails()) ex.add(e);
  for (const e of getMatchFitTestTrainerEmails()) ex.add(e);

  const devClient = identEmail(process.env.MATCH_FIT_DEV_CLIENT_IDENTIFIER);
  const devTrainer = identEmail(process.env.MATCH_FIT_DEV_TRAINER_IDENTIFIER);
  if (devClient) ex.add(devClient);
  if (devTrainer) ex.add(devTrainer);

  return [...ex];
}

export function getMatchFitLaunchExcludeClientUsernames(): string[] {
  const names = new Set<string>(MATCH_FIT_BUILTIN_LAUNCH_EXCLUDE_CLIENT_USERNAMES.map((u) => u.toLowerCase()));
  const devClient = process.env.MATCH_FIT_DEV_CLIENT_IDENTIFIER?.trim().toLowerCase();
  if (devClient && !devClient.includes("@")) names.add(devClient);
  return [...names];
}

export function getMatchFitLaunchExcludeTrainerUsernames(): string[] {
  const names = new Set<string>(MATCH_FIT_BUILTIN_LAUNCH_EXCLUDE_TRAINER_USERNAMES.map((u) => u.toLowerCase()));
  for (const u of parseCsvLower(process.env.MATCH_FIT_TEST_TRAINER_USERNAMES)) names.add(u);
  const devTrainer = process.env.MATCH_FIT_DEV_TRAINER_IDENTIFIER?.trim().toLowerCase();
  if (devTrainer && !devTrainer.includes("@")) names.add(devTrainer);
  return [...names];
}

/** Relative public paths used only for dev/seed trainer compliance (never real coaches). */
export function getMatchFitDevPlaceholderCertPathPrefixes(): readonly string[] {
  return [
    TRAINER_DEV_FAKE_CPT_CERTIFICATION_PATH,
    "/dev/fake-nutrition-certification.txt",
    "/dev/fake-specialist-certification.txt",
  ];
}
