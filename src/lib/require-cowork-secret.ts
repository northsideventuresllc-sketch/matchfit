import { readPlatformSecret } from "@/lib/platform-secrets";

/**
 * Auth for the external Cowork session's polling/reporting calls. `CRON_SECRET` (Vercel env)
 * is checked first for backward compatibility with the existing cron routes. If that's unset
 * or doesn't match, falls back to `COWORK_POLL_SECRET` in the `platform_secrets` table — the
 * same DB-backed secret store the AI Vault keys use — so the Cowork operator never needs
 * Vercel dashboard access to get this value.
 */
export async function hasValidCoworkSecret(req: Request): Promise<boolean> {
  const auth = req.headers.get("authorization");
  const bearer = auth?.startsWith("Bearer ") ? auth.slice("Bearer ".length).trim() : null;
  const q = new URL(req.url).searchParams.get("secret")?.trim();
  const provided = bearer || q;
  if (!provided) return false;

  const cronSecret = process.env.CRON_SECRET?.trim();
  if (cronSecret && provided === cronSecret) return true;

  const dbSecret = await readPlatformSecret("COWORK_POLL_SECRET");
  return Boolean(dbSecret && provided === dbSecret);
}
