function parseEmailList(raw: string | undefined): string[] {
  if (!raw?.trim()) return [];
  return raw
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

/** Comma-separated trainer emails that receive full test compliance (any environment). */
export function getMatchFitTestTrainerEmails(): string[] {
  return parseEmailList(process.env.MATCH_FIT_TEST_TRAINER_EMAILS);
}

export function isMatchFitTestTrainerEmail(email: string | null | undefined): boolean {
  if (!email?.trim()) return false;
  return getMatchFitTestTrainerEmails().includes(email.trim().toLowerCase());
}
