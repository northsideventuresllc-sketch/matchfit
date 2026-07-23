import { requireAdminSession } from "@/lib/require-admin";

/**
 * Server-to-server (service) auth for cross-service bots — specifically the AXON-side
 * Telegram bridge that taps Approve / Delete / Rewrite on outreach leads pushed via the
 * `outreach-event` webhook and calls back into Match Fit's admin outreach routes.
 *
 * Those routes are normally gated by {@link requireAdminSession} (browser admin-session
 * cookie), which a headless bot can't provide. This adds a SECOND, additive auth path:
 * a shared secret in the `X-Match-Fit-Service-Token` header checked against
 * `process.env.MATCH_FIT_SERVICE_TOKEN`.
 *
 * This is DISTINCT from `CRON_SECRET` (which authorizes cron / Cowork job callbacks) —
 * a separate secret with a separate meaning (cross-service bot actions). Generate a
 * high-entropy value once, store it in Vercel env + the AXON side, never commit it.
 *
 * Fail-closed: `hasValidServiceToken` returns false when the env var is unset OR the
 * header is missing/mismatched, so an unconfigured deployment can never be actioned by
 * an unauthenticated caller.
 */
export const MATCH_FIT_SERVICE_TOKEN_HEADER = "X-Match-Fit-Service-Token";

/** Sentinel actor id recorded on learning signals / dispatch batches created via the bot. */
export const SERVICE_ACTOR_ADMIN_ID = "axon-service";

export type OutreachActor = {
  adminId: string;
  via: "service_token" | "admin_session";
};

/** Fail-closed check of the `X-Match-Fit-Service-Token` header against the env secret. */
export function hasValidServiceToken(req: Request): boolean {
  const expected = process.env.MATCH_FIT_SERVICE_TOKEN?.trim();
  if (!expected) return false;
  const provided = req.headers.get(MATCH_FIT_SERVICE_TOKEN_HEADER)?.trim();
  if (!provided) return false;
  return provided === expected;
}

/**
 * Dual-auth resolver for outreach routes the AXON bridge must reach server-to-server.
 *
 * A valid service token short-circuits the admin-cookie check entirely and yields the
 * {@link SERVICE_ACTOR_ADMIN_ID} sentinel actor. Otherwise the existing
 * {@link requireAdminSession} browser session is required exactly as before. Returns
 * `null` when neither credential is valid — the caller should respond 401.
 */
export async function resolveOutreachActor(req: Request): Promise<OutreachActor | null> {
  if (hasValidServiceToken(req)) {
    return { adminId: SERVICE_ACTOR_ADMIN_ID, via: "service_token" };
  }
  const sess = await requireAdminSession();
  if (!sess) return null;
  return { adminId: sess.adminId, via: "admin_session" };
}
