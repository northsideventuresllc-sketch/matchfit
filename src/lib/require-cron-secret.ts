import { timingSafeEqualString } from "@/lib/timing-safe-equal";

/**
 * Standard CRON_SECRET check shared by the simple cron routes: accepts either a
 * `Bearer <secret>` Authorization header or a `?secret=` query param, both compared
 * timing-safely (never `===` on a caller-supplied secret). Routes that also need the
 * DB-backed COWORK_POLL_SECRET fallback use `hasValidCoworkSecret` instead.
 */
export function isCronSecretAuthorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  const auth = req.headers.get("authorization") ?? "";
  if (timingSafeEqualString(auth, `Bearer ${secret}`)) return true;
  const q = new URL(req.url).searchParams.get("secret") ?? "";
  return timingSafeEqualString(q, secret);
}
