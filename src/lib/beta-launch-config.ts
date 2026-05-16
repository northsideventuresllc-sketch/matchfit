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

export function isBetaLaunchGatesEnabled(): boolean {
  return truthyEnv(process.env.MATCH_FIT_BETA_GATES_ENABLED);
}

export function betaMaxTrainers(): number {
  return parsePositiveInt(process.env.MATCH_FIT_BETA_MAX_TRAINERS, 10);
}

export function betaMaxClients(): number {
  return parsePositiveInt(process.env.MATCH_FIT_BETA_MAX_CLIENTS, 50);
}

/** Days an invited user has to complete signup before the slot is released. */
export function betaInviteSlotDays(): number {
  return parsePositiveInt(process.env.MATCH_FIT_BETA_INVITE_SLOT_DAYS, 30);
}
