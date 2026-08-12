/**
 * Caps password changes at 2 per rolling 24 hours (JB, 2026-08-05) — applies no matter how the
 * change happens: self-service from settings, or a forgot-password reset link. Same counter for
 * both, because the thing being limited is "password changed," not any one path to it.
 *
 * Pure — no database, no clock of its own — so the window boundary is testable directly.
 */

const WINDOW_MS = 24 * 60 * 60 * 1000;
const MAX_CHANGES_PER_WINDOW = 2;

export type PasswordChangeRateLimitState = {
  passwordChangeCount24h: number;
  passwordChangeWindowStartsAt: Date | null;
};

export type PasswordChangeRateLimitResult =
  | { ok: true; nextState: { passwordChangeCount24h: number; passwordChangeWindowStartsAt: Date } }
  | { ok: false; error: string; retryAfterMs: number };

/** Call right before actually changing the password; only apply nextState if the change succeeds. */
export function checkAndAdvancePasswordChangeRateLimit(
  state: PasswordChangeRateLimitState,
  nowMs: number = Date.now(),
): PasswordChangeRateLimitResult {
  const windowStartMs = state.passwordChangeWindowStartsAt?.getTime() ?? 0;
  const windowExpired = nowMs - windowStartMs >= WINDOW_MS;

  if (windowExpired) {
    return { ok: true, nextState: { passwordChangeCount24h: 1, passwordChangeWindowStartsAt: new Date(nowMs) } };
  }

  if (state.passwordChangeCount24h >= MAX_CHANGES_PER_WINDOW) {
    const retryAfterMs = WINDOW_MS - (nowMs - windowStartMs);
    return {
      ok: false,
      error: `You've reached the limit of ${MAX_CHANGES_PER_WINDOW} password changes in 24 hours. Try again later, or contact support if you need it sooner.`,
      retryAfterMs,
    };
  }

  return {
    ok: true,
    nextState: {
      passwordChangeCount24h: state.passwordChangeCount24h + 1,
      passwordChangeWindowStartsAt: state.passwordChangeWindowStartsAt ?? new Date(nowMs),
    },
  };
}
