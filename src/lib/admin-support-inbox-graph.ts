import "server-only";
import { MATCH_FIT_SUPPORT_EMAIL } from "@/lib/background-check-plan-b";
import type {
  SupportInboxAuthMode,
  SupportInboxConnectionStatus,
  SupportInboxMessageDetail,
  SupportInboxMessageSummary,
} from "@/lib/admin-support-inbox-types";

const GRAPH_BASE = "https://graph.microsoft.com/v1.0";
const ACCESS_SKEW_MS = 90_000;

type TokenCache = { accessToken: string; expiresAtMs: number };
let tokenCache: TokenCache | null = null;

type GraphEmailAddress = { name?: string; address?: string };
type GraphRecipient = { emailAddress?: GraphEmailAddress };
type GraphMessage = {
  id?: string;
  subject?: string;
  from?: GraphRecipient;
  toRecipients?: GraphRecipient[];
  ccRecipients?: GraphRecipient[];
  receivedDateTime?: string;
  isRead?: boolean;
  bodyPreview?: string;
  body?: { contentType?: string; content?: string };
  hasAttachments?: boolean;
  conversationId?: string;
};

function supportInboxClientId(): string | null {
  return process.env.MICROSOFT_SUPPORT_INBOX_CLIENT_ID?.trim() || null;
}

function supportInboxClientSecret(): string | null {
  return process.env.MICROSOFT_SUPPORT_INBOX_CLIENT_SECRET?.trim() || null;
}

function supportInboxTenantId(): string | null {
  return process.env.MICROSOFT_SUPPORT_INBOX_TENANT_ID?.trim() || null;
}

function supportInboxRefreshToken(): string | null {
  return process.env.MICROSOFT_SUPPORT_INBOX_REFRESH_TOKEN?.trim() || null;
}

export function getSupportInboxMailbox(): string {
  return MATCH_FIT_SUPPORT_EMAIL;
}

export function resolveSupportInboxAuthMode(): SupportInboxAuthMode | null {
  const clientId = supportInboxClientId();
  const clientSecret = supportInboxClientSecret();
  if (!clientId || !clientSecret) return null;

  if (supportInboxRefreshToken()) return "delegated";

  const tenantId = supportInboxTenantId();
  if (tenantId && /^[0-9a-f-]{36}$/i.test(tenantId)) return "application";

  return null;
}

export function getSupportInboxConnectionStatus(): SupportInboxConnectionStatus {
  const mailbox = getSupportInboxMailbox();
  const mode = resolveSupportInboxAuthMode();
  return {
    configured: mode !== null,
    mailbox,
    provider: mode ? "outlook" : "unconfigured",
    mode,
  };
}

function microsoftTokenEndpoint(tenantId: string): string {
  return `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;
}

async function fetchApplicationAccessToken(): Promise<{ accessToken: string; expiresAtMs: number } | { error: string }> {
  const clientId = supportInboxClientId();
  const clientSecret = supportInboxClientSecret();
  const tenantId = supportInboxTenantId();
  if (!clientId || !clientSecret || !tenantId) {
    return { error: "Outlook application credentials are not configured." };
  }

  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    scope: "https://graph.microsoft.com/.default",
    grant_type: "client_credentials",
  });

  const res = await fetch(microsoftTokenEndpoint(tenantId), {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  const json = (await res.json().catch(() => null)) as Record<string, unknown> | null;
  if (!res.ok) {
    const msg =
      typeof json?.error_description === "string"
        ? json.error_description
        : typeof json?.error === "string"
          ? json.error
          : "outlook_token_failed";
    return { error: msg };
  }

  const accessToken = typeof json?.access_token === "string" ? json.access_token : "";
  const expSec = typeof json?.expires_in === "number" ? json.expires_in : 3600;
  if (!accessToken) return { error: "Outlook token response was incomplete." };

  return {
    accessToken,
    expiresAtMs: Date.now() + Math.max(60, expSec) * 1000,
  };
}

async function fetchDelegatedAccessToken(): Promise<{ accessToken: string; expiresAtMs: number } | { error: string }> {
  const clientId = supportInboxClientId();
  const clientSecret = supportInboxClientSecret();
  const refreshToken = supportInboxRefreshToken();
  const tenantId = supportInboxTenantId() || "common";
  if (!clientId || !clientSecret || !refreshToken) {
    return { error: "Outlook delegated credentials are not configured." };
  }

  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    scope: "https://graph.microsoft.com/Mail.ReadWrite https://graph.microsoft.com/Mail.Send offline_access",
  });

  const res = await fetch(microsoftTokenEndpoint(tenantId), {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  const json = (await res.json().catch(() => null)) as Record<string, unknown> | null;
  if (!res.ok) {
    const msg =
      typeof json?.error_description === "string"
        ? json.error_description
        : typeof json?.error === "string"
          ? json.error
          : "outlook_refresh_failed";
    return { error: msg };
  }

  const accessToken = typeof json?.access_token === "string" ? json.access_token : "";
  const expSec = typeof json?.expires_in === "number" ? json.expires_in : 3600;
  if (!accessToken) return { error: "Outlook refresh returned no access token." };

  return {
    accessToken,
    expiresAtMs: Date.now() + Math.max(60, expSec) * 1000,
  };
}

async function getGraphAccessToken(): Promise<{ accessToken: string } | { error: string }> {
  const mode = resolveSupportInboxAuthMode();
  if (!mode) {
    return { error: "Support inbox is not connected to Outlook. Set Microsoft Graph credentials in the server environment." };
  }

  const now = Date.now();
  if (tokenCache && tokenCache.expiresAtMs - ACCESS_SKEW_MS > now) {
    return { accessToken: tokenCache.accessToken };
  }

  const fresh = mode === "delegated" ? await fetchDelegatedAccessToken() : await fetchApplicationAccessToken();
  if ("error" in fresh) return fresh;

  tokenCache = { accessToken: fresh.accessToken, expiresAtMs: fresh.expiresAtMs };
  return { accessToken: fresh.accessToken };
}

function mailboxGraphPath(): string {
  const mode = resolveSupportInboxAuthMode();
  if (mode === "delegated") return "/me";
  return `/users/${encodeURIComponent(getSupportInboxMailbox())}`;
}

function formatRecipient(r: GraphRecipient | undefined): { name: string; email: string } {
  const email = r?.emailAddress?.address?.trim() || "";
  const name = r?.emailAddress?.name?.trim() || email || "Unknown sender";
  return { name, email };
}

function formatRecipientList(recipients: GraphRecipient[] | undefined): string[] {
  if (!recipients?.length) return [];
  return recipients
    .map((r) => {
      const { name, email } = formatRecipient(r);
      if (name && email && name !== email) return `${name} <${email}>`;
      return email || name;
    })
    .filter(Boolean);
}

function mapSummary(message: GraphMessage): SupportInboxMessageSummary | null {
  const id = message.id?.trim();
  if (!id) return null;
  const from = formatRecipient(message.from);
  return {
    id,
    subject: message.subject?.trim() || "(No subject)",
    fromName: from.name,
    fromEmail: from.email,
    receivedAt: message.receivedDateTime || new Date(0).toISOString(),
    isRead: Boolean(message.isRead),
    preview: message.bodyPreview?.trim() || "",
    hasAttachments: Boolean(message.hasAttachments),
  };
}

function mapDetail(message: GraphMessage): SupportInboxMessageDetail | null {
  const summary = mapSummary(message);
  if (!summary) return null;
  const contentType = message.body?.contentType?.toLowerCase();
  const content = message.body?.content?.trim() || "";
  return {
    ...summary,
    to: formatRecipientList(message.toRecipients),
    cc: formatRecipientList(message.ccRecipients),
    bodyHtml: contentType === "html" ? content : null,
    bodyText: contentType === "text" ? content : contentType === "html" ? stripHtml(content) : content || null,
    conversationId: message.conversationId?.trim() || null,
  };
}

function stripHtml(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function graphGet<T>(path: string, query?: Record<string, string>): Promise<T | { error: string }> {
  const token = await getGraphAccessToken();
  if ("error" in token) return token;

  const url = new URL(`${GRAPH_BASE}${path}`);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      url.searchParams.set(key, value);
    }
  }

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${token.accessToken}` },
    cache: "no-store",
  });
  const json = (await res.json().catch(() => null)) as Record<string, unknown> | null;
  if (!res.ok) {
    const msg =
      json && typeof json.error === "object" && json.error && typeof (json.error as { message?: string }).message === "string"
        ? (json.error as { message: string }).message
        : `graph_http_${res.status}`;
    return { error: msg };
  }
  return json as T;
}

async function graphPost(path: string, body: unknown): Promise<{ ok: true } | { error: string }> {
  const token = await getGraphAccessToken();
  if ("error" in token) return token;

  const res = await fetch(`${GRAPH_BASE}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token.accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (res.status === 202 || res.status === 204) return { ok: true };

  const json = (await res.json().catch(() => null)) as Record<string, unknown> | null;
  if (!res.ok) {
    const msg =
      json && typeof json.error === "object" && json.error && typeof (json.error as { message?: string }).message === "string"
        ? (json.error as { message: string }).message
        : `graph_http_${res.status}`;
    return { error: msg };
  }
  return { ok: true };
}

async function graphPatch(path: string, body: unknown): Promise<{ ok: true } | { error: string }> {
  const token = await getGraphAccessToken();
  if ("error" in token) return token;

  const res = await fetch(`${GRAPH_BASE}${path}`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${token.accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (res.status === 204) return { ok: true };

  const json = (await res.json().catch(() => null)) as Record<string, unknown> | null;
  if (!res.ok) {
    const msg =
      json && typeof json.error === "object" && json.error && typeof (json.error as { message?: string }).message === "string"
        ? (json.error as { message: string }).message
        : `graph_http_${res.status}`;
    return { error: msg };
  }
  return { ok: true };
}

export async function listSupportInboxMessages(args?: {
  top?: number;
  skip?: number;
}): Promise<{ messages: SupportInboxMessageSummary[] } | { error: string }> {
  const top = Math.min(Math.max(args?.top ?? 40, 1), 100);
  const skip = Math.max(args?.skip ?? 0, 0);
  const base = mailboxGraphPath();

  const result = await graphGet<{ value?: GraphMessage[] }>(`${base}/mailFolders/inbox/messages`, {
    $select: "id,subject,from,receivedDateTime,isRead,bodyPreview,hasAttachments",
    $orderby: "receivedDateTime desc",
    $top: String(top),
    $skip: String(skip),
  });
  if ("error" in result) return result;

  const messages = (result.value ?? [])
    .map((row) => mapSummary(row))
    .filter((row): row is SupportInboxMessageSummary => row !== null);

  return { messages };
}

export async function getSupportInboxMessage(
  messageId: string,
): Promise<{ message: SupportInboxMessageDetail } | { error: string }> {
  const id = messageId.trim();
  if (!id) return { error: "Message id is required." };

  const base = mailboxGraphPath();
  const result = await graphGet<GraphMessage>(`${base}/messages/${encodeURIComponent(id)}`, {
    $select:
      "id,subject,from,toRecipients,ccRecipients,receivedDateTime,isRead,bodyPreview,body,hasAttachments,conversationId",
  });
  if ("error" in result) return result;

  const message = mapDetail(result);
  if (!message) return { error: "Message could not be parsed." };
  return { message };
}

export async function markSupportInboxMessageRead(messageId: string): Promise<{ ok: true } | { error: string }> {
  const id = messageId.trim();
  if (!id) return { error: "Message id is required." };
  const base = mailboxGraphPath();
  return graphPatch(`${base}/messages/${encodeURIComponent(id)}`, { isRead: true });
}

export async function replyToSupportInboxMessage(args: {
  messageId: string;
  body: string;
}): Promise<{ ok: true } | { error: string }> {
  const id = args.messageId.trim();
  const comment = args.body.trim();
  if (!id) return { error: "Message id is required." };
  if (!comment) return { error: "Reply body is required." };

  const base = mailboxGraphPath();
  return graphPost(`${base}/messages/${encodeURIComponent(id)}/reply`, { comment });
}

/** Clears cached tokens — used in tests only. */
export function resetSupportInboxTokenCacheForTests(): void {
  tokenCache = null;
}
