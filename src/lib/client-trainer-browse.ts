/** Client Find Coaches browse: pass cooldown and “not interested” history window. */
export const CLIENT_TRAINER_PASS_COOLDOWN_DAYS = 90;
export const CLIENT_TRAINER_NOT_INTERESTED_UI_HISTORY_DAYS = 7;

const MS_PER_DAY = 86_400_000;

export function clientTrainerBrowsePassCooldownMs(): number {
  return CLIENT_TRAINER_PASS_COOLDOWN_DAYS * MS_PER_DAY;
}

export function clientTrainerNotInterestedHistoryMs(): number {
  return CLIENT_TRAINER_NOT_INTERESTED_UI_HISTORY_DAYS * MS_PER_DAY;
}

export function effectiveBrowsePassAt(lastPassedAt: Date | null | undefined, createdAt: Date): Date {
  return lastPassedAt ?? createdAt;
}

export function isBrowsePassCooldownActive(
  lastPassedAt: Date | null | undefined,
  createdAt: Date,
  nowMs: number = Date.now(),
): boolean {
  const at = effectiveBrowsePassAt(lastPassedAt, createdAt).getTime();
  return nowMs - at < clientTrainerBrowsePassCooldownMs();
}

export function isWithinNotInterestedHistoryWindow(
  lastPassedAt: Date | null | undefined,
  createdAt: Date,
  nowMs: number = Date.now(),
): boolean {
  const at = effectiveBrowsePassAt(lastPassedAt, createdAt).getTime();
  return nowMs - at < clientTrainerNotInterestedHistoryMs();
}
