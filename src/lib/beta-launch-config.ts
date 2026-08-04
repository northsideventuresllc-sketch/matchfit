function truthyEnv(v: string | undefined): boolean {
  const t = v?.trim().toLowerCase();
  return t === "1" || t === "true" || t === "yes";
}

function parsePositiveInt(v: string | undefined, fallback: number): number {
  const n = Number.parseInt(v?.trim() ?? "", 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

/** Emails excluded from beta cap counts (test / staff accounts), comma-separated, case-insensitive. */
export function betaExcludeCapCountEmails(): Set<string> {
  const raw = process.env.MATCH_FIT_BETA_EXCLUDE_CAP_COUNT_EMAILS?.trim();
  const s = new Set<string>();
  if (!raw) return s;
  for (const part of raw.split(",")) {
    const e = part.trim().toLowerCase();
    if (e) s.add(e);
  }
  return s;
}

/** Usernames excluded from beta cap counts (test / staff accounts), comma-separated, case-insensitive. */
export function betaExcludeCapCountUsernames(): Set<string> {
  const raw = process.env.MATCH_FIT_BETA_EXCLUDE_CAP_COUNT_USERNAMES?.trim();
  const s = new Set<string>();
  if (!raw) return s;
  for (const part of raw.split(",")) {
    const u = part.trim().toLowerCase().replace(/^@/, "");
    if (u) s.add(u);
  }
  return s;
}

export function isBetaLaunchGatesEnabled(): boolean {
  return truthyEnv(process.env.MATCH_FIT_BETA_GATES_ENABLED);
}

/**
 * One worldwide trainer cap for the beta.
 *
 * Removed 2026-08-04, ticket MF-ATLANTA-GATES-AFTER-WORLDWIDE (geo-guard:allow): the per-metro cap
 * split. Capacity is no longer allocated by geography. Deployments that still set
 * the two legacy env vars are honoured — their sum becomes the single cap — so no
 * environment needs to be edited for this to be correct. geo-guard:allow
 */
export function betaMaxTrainers(): number {
  const direct = process.env.MATCH_FIT_BETA_MAX_TRAINERS?.trim();
  if (direct) return parsePositiveInt(direct, 10);

  const legacyA = process.env.MATCH_FIT_BETA_MAX_TRAINERS_ATLANTA?.trim(); // geo-guard:allow legacy env name
  const legacyB = process.env.MATCH_FIT_BETA_MAX_TRAINERS_VIRTUAL?.trim();
  if (legacyA || legacyB) {
    return parsePositiveInt(legacyA, 0) + parsePositiveInt(legacyB, 0) || 10;
  }
  return 10;
}

export function betaMaxClients(): number {
  return parsePositiveInt(process.env.MATCH_FIT_BETA_MAX_CLIENTS, 50);
}

/** Days an invited user has to complete signup before the slot is released. */
export function betaInviteSlotDays(): number {
  return parsePositiveInt(process.env.MATCH_FIT_BETA_INVITE_SLOT_DAYS, 30);
}
