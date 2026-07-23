import "server-only";

import { OUTREACH_COWORK_EMAIL_FROM } from "@/lib/outreach-cowork";

/**
 * Microsoft Graph (app-only) access for the jb@match-fit.net mailbox — used by outreach reply
 * scanning (`outreach-email-scan.ts`) and outreach email send (`outreach-email-send.ts`).
 *
 * This is a FRESH, isolated integration (no other Graph mail flow exists in the codebase). It is
 * intentionally env-gated and swappable: with no credentials configured every entry point no-ops
 * cleanly with a single log line and never throws into a request path.
 *
 * ── Required environment variables (all four, or the integration stays disabled) ──
 *   MATCH_FIT_JB_INBOX_GRAPH_TENANT_ID       Azure AD tenant (directory) id
 *   MATCH_FIT_JB_INBOX_GRAPH_CLIENT_ID       App registration (client) id
 *   MATCH_FIT_JB_INBOX_GRAPH_CLIENT_SECRET   App registration client secret value
 *   MATCH_FIT_JB_INBOX_GRAPH_MAILBOX         (optional) mailbox UPN; defaults to jb@match-fit.net
 *
 * ── Azure AD app registration (one-time, by JB / an admin) ──
 *   • Grant APPLICATION permissions (not delegated): Mail.Read and Mail.Send.
 *   • Admin-consent them for the tenant.
 *   • Recommended: scope the app to the single mailbox with an Exchange ApplicationAccessPolicy so
 *     the client-credentials token can only read/send as jb@match-fit.net.
 * The client-credentials flow uses scope `https://graph.microsoft.com/.default`.
 */

const GRAPH_BASE = "https://graph.microsoft.com/v1.0";

export type OutreachGraphConfig = {
  tenantId: string;
  clientId: string;
  clientSecret: string;
  mailbox: string;
};

export function getOutreachGraphConfig(): OutreachGraphConfig | null {
  const tenantId = process.env.MATCH_FIT_JB_INBOX_GRAPH_TENANT_ID?.trim();
  const clientId = process.env.MATCH_FIT_JB_INBOX_GRAPH_CLIENT_ID?.trim();
  const clientSecret = process.env.MATCH_FIT_JB_INBOX_GRAPH_CLIENT_SECRET?.trim();
  const mailbox = process.env.MATCH_FIT_JB_INBOX_GRAPH_MAILBOX?.trim() || OUTREACH_COWORK_EMAIL_FROM;
  if (!tenantId || !clientId || !clientSecret) return null;
  return { tenantId, clientId, clientSecret, mailbox };
}

export function isOutreachGraphConfigured(): boolean {
  return getOutreachGraphConfig() !== null;
}

async function acquireAppToken(config: OutreachGraphConfig): Promise<string | null> {
  const tokenUrl = `https://login.microsoftonline.com/${config.tenantId}/oauth2/v2.0/token`;
  const params = new URLSearchParams({
    client_id: config.clientId,
    client_secret: config.clientSecret,
    scope: "https://graph.microsoft.com/.default",
    grant_type: "client_credentials",
  });
  try {
    const res = await fetch(tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) {
      console.warn(`[outreach-graph] token request failed (${res.status}).`);
      return null;
    }
    const json = (await res.json()) as { access_token?: string };
    return json.access_token ?? null;
  } catch (e) {
    console.warn("[outreach-graph] token request error", e);
    return null;
  }
}

/**
 * Runs `fn` with an authenticated Graph client bound to the JB mailbox. Resolves to
 * `{ configured: false }` when credentials are unset (clean no-op) — callers must handle it.
 */
export async function withOutreachGraph<T>(
  fn: (ctx: { token: string; mailbox: string; graphBase: string }) => Promise<T>,
): Promise<{ configured: true; value: T } | { configured: false }> {
  const config = getOutreachGraphConfig();
  if (!config) {
    console.info("[outreach-graph] Not configured — set MATCH_FIT_JB_INBOX_GRAPH_* to enable.");
    return { configured: false };
  }
  const token = await acquireAppToken(config);
  if (!token) return { configured: false };
  const value = await fn({ token, mailbox: config.mailbox, graphBase: GRAPH_BASE });
  return { configured: true, value };
}
