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

/** Hard cap on founding beta trainers (virtual + in-person buckets combined). */
export function betaMaxTotalTrainers(): number {
  return parsePositiveInt(process.env.MATCH_FIT_BETA_MAX_TRAINERS, 30);
}

/** @deprecated Alias for {@link betaMaxTotalTrainers}. */
export function betaMaxTrainers(): number {
  return betaMaxTotalTrainers();
}

/** Base virtual / DIY / nutrition-remote coach cap before unused in-person slots reallocate. */
export function betaMaxVirtualTrainersBase(): number {
  return parsePositiveInt(process.env.MATCH_FIT_BETA_MAX_VIRTUAL_TRAINERS, 20);
}

/** In-person coach cap within the Atlanta metro geo-circle. */
export function betaMaxInPersonTrainers(): number {
  return parsePositiveInt(process.env.MATCH_FIT_BETA_MAX_IN_PERSON_TRAINERS, 10);
}

export function betaMaxClients(): number {
  return parsePositiveInt(process.env.MATCH_FIT_BETA_MAX_CLIENTS, 150);
}

/** Days an invited user has to complete signup before the slot is released. */
export function betaInviteSlotDays(): number {
  return parsePositiveInt(process.env.MATCH_FIT_BETA_INVITE_SLOT_DAYS, 30);
}
