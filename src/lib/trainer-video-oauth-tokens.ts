import type { VideoConferenceProviderKey } from "@/lib/trainer-video-oauth-state";

/** Scopes for Microsoft Graph (Outlook calendar + Teams meetings). Used by direct OAuth and must match Supabase Azure provider configuration. */
export const MICROSOFT_GRAPH_OAUTH_SCOPES =
  "openid email profile offline_access Calendars.ReadWrite OnlineMeetings.ReadWrite";

/** Zoom User-managed OAuth: profile + meetings. Used by direct authorize URL and must match Supabase Zoom provider configuration. */
export const TRAINER_ZOOM_SUPABASE_OAUTH_SCOPES = "user:read:user meeting:read meeting:write";

/** Trainer Google OAuth: Calendar events + Meet space creation (refresh token via `access_type=offline` on the authorize URL, not a scope). */
export const GOOGLE_TRAINER_VIDEO_OAUTH_SCOPES = [
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/meetings.space.created",
].join(" ");

function microsoftOAuthTenantSegment(): string {
  const tenant = process.env.MICROSOFT_OAUTH_TENANT_ID?.trim();
  if (tenant && /^[0-9a-f-]{36}$/i.test(tenant)) return tenant;
  return "common";
}

function microsoftAuthorizeEndpoint(): string {
  return `https://login.microsoftonline.com/${microsoftOAuthTenantSegment()}/oauth2/v2.0/authorize`;
}

function microsoftTokenEndpoint(): string {
  return `https://login.microsoftonline.com/${microsoftOAuthTenantSegment()}/oauth2/v2.0/token`;
}

/** Best-effort JWT `exp` for Zoom access tokens when Zoom returns a JWT (opaque tokens return undefined). */
export function zoomAccessTokenExpiresAtMs(accessToken: string | undefined | null): number | undefined {
  if (!accessToken || typeof accessToken !== "string") return undefined;
  const parts = accessToken.split(".");
  if (parts.length < 2) return undefined;
  try {
    const json = Buffer.from(parts[1].replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
    const payload = JSON.parse(json) as { exp?: number };
    if (typeof payload.exp === "number" && Number.isFinite(payload.exp)) {
      return payload.exp * 1000;
    }
  } catch {
    /* ignore */
  }
  return undefined;
}

/** Best-effort JWT `exp` (seconds) for Microsoft access tokens (opaque if undecodable). */
export function microsoftAccessTokenExpiresAtMs(accessToken: string | undefined | null): number | undefined {
  if (!accessToken || typeof accessToken !== "string") return undefined;
  const parts = accessToken.split(".");
  if (parts.length < 2) return undefined;
  try {
    const json = Buffer.from(parts[1].replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
    const payload = JSON.parse(json) as { exp?: number };
    if (typeof payload.exp === "number" && Number.isFinite(payload.exp)) {
      return payload.exp * 1000;
    }
  } catch {
    /* ignore */
  }
  return undefined;
}

export type OAuthTokenBundle = {
  refreshToken: string;
  accessToken?: string;
  expiresAtMs?: number;
};

export function parseOAuthTokenBundle(json: string): OAuthTokenBundle | null {
  try {
    const o = JSON.parse(json) as OAuthTokenBundle;
    if (typeof o.refreshToken !== "string" || !o.refreshToken.trim()) return null;
    return o;
  } catch {
    return null;
  }
}

export function stringifyOAuthTokenBundle(b: OAuthTokenBundle): string {
  return JSON.stringify(b);
}

function oauthRedirectBase(): string | null {
  const u = process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/$/, "");
  return u || null;
}

export function googleOAuthRedirectUri(): string | null {
  const b = oauthRedirectBase();
  return b ? `${b}/api/trainer/oauth/google/callback` : null;
}

export function zoomOAuthRedirectUri(): string | null {
  const b = oauthRedirectBase();
  return b ? `${b}/api/trainer/oauth/zoom/callback` : null;
}

export function microsoftOAuthRedirectUri(): string | null {
  const b = oauthRedirectBase();
  return b ? `${b}/api/trainer/oauth/microsoft/callback` : null;
}

export function googleAuthorizeUrl(state: string): string | null {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID?.trim();
  const redirect = googleOAuthRedirectUri();
  if (!clientId || !redirect) return null;
  const q = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirect,
    response_type: "code",
    access_type: "offline",
    prompt: "consent",
    scope: GOOGLE_TRAINER_VIDEO_OAUTH_SCOPES,
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${q.toString()}`;
}

export function zoomAuthorizeUrl(state: string): string | null {
  const clientId = process.env.ZOOM_OAUTH_CLIENT_ID?.trim();
  const redirect = zoomOAuthRedirectUri();
  if (!clientId || !redirect) return null;
  const scope = encodeURIComponent(TRAINER_ZOOM_SUPABASE_OAUTH_SCOPES);
  return `https://zoom.us/oauth/authorize?response_type=code&client_id=${encodeURIComponent(clientId)}&redirect_uri=${encodeURIComponent(redirect)}&scope=${scope}&state=${encodeURIComponent(state)}`;
}

export function microsoftAuthorizeUrl(state: string): string | null {
  const clientId = process.env.MICROSOFT_OAUTH_CLIENT_ID?.trim();
  const redirect = microsoftOAuthRedirectUri();
  if (!clientId || !redirect) return null;
  const scope = encodeURIComponent(MICROSOFT_GRAPH_OAUTH_SCOPES);
  return `${microsoftAuthorizeEndpoint()}?client_id=${encodeURIComponent(clientId)}&response_type=code&redirect_uri=${encodeURIComponent(redirect)}&response_mode=query&scope=${scope}&state=${encodeURIComponent(state)}`;
}

export async function googleExchangeCode(code: string): Promise<OAuthTokenBundle | { error: string }> {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET?.trim();
  const redirect = googleOAuthRedirectUri();
  if (!clientId || !clientSecret || !redirect) return { error: "Google OAuth is not configured on this server." };
  const body = new URLSearchParams({
    code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirect,
    grant_type: "authorization_code",
  });
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  const j = (await res.json().catch(() => null)) as Record<string, unknown> | null;
  if (!res.ok) {
    const msg = typeof j?.error_description === "string" ? j.error_description : String(j?.error ?? "token_error");
    return { error: msg };
  }
  const refresh = typeof j?.refresh_token === "string" ? j.refresh_token : "";
  if (!refresh) {
    return {
      error:
        "Google did not return a refresh token. Remove Match Fit from your Google Account connections and try Connect again (consent must include offline access).",
    };
  }
  const access = typeof j?.access_token === "string" ? j.access_token : undefined;
  const expSec = typeof j?.expires_in === "number" ? j.expires_in : 3600;
  return {
    refreshToken: refresh,
    accessToken: access,
    expiresAtMs: Date.now() + Math.max(60, expSec) * 1000,
  };
}

export async function zoomExchangeCode(code: string): Promise<OAuthTokenBundle | { error: string }> {
  const clientId = process.env.ZOOM_OAUTH_CLIENT_ID?.trim();
  const clientSecret = process.env.ZOOM_OAUTH_CLIENT_SECRET?.trim();
  const redirect = zoomOAuthRedirectUri();
  if (!clientId || !clientSecret || !redirect) return { error: "Zoom OAuth is not configured on this server." };
  const auth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: redirect,
  });
  const res = await fetch("https://zoom.us/oauth/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: body.toString(),
  });
  const j = (await res.json().catch(() => null)) as Record<string, unknown> | null;
  if (!res.ok) {
    return { error: typeof j?.reason === "string" ? j.reason : String(j?.error ?? "zoom_token_error") };
  }
  const refresh = typeof j?.refresh_token === "string" ? j.refresh_token : "";
  const access = typeof j?.access_token === "string" ? j.access_token : "";
  if (!refresh || !access) return { error: "Zoom token response was incomplete." };
  const expSec = typeof j?.expires_in === "number" ? j.expires_in : 3600;
  const jwtExp = zoomAccessTokenExpiresAtMs(access);
  return {
    refreshToken: refresh,
    accessToken: access,
    expiresAtMs: jwtExp ?? Date.now() + Math.max(60, expSec) * 1000,
  };
}

export async function microsoftExchangeCode(code: string): Promise<OAuthTokenBundle | { error: string }> {
  const clientId = process.env.MICROSOFT_OAUTH_CLIENT_ID?.trim();
  const clientSecret = process.env.MICROSOFT_OAUTH_CLIENT_SECRET?.trim();
  const redirect = microsoftOAuthRedirectUri();
  if (!clientId || !clientSecret || !redirect) return { error: "Microsoft OAuth is not configured on this server." };
  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: "authorization_code",
    code,
    redirect_uri: redirect,
  });
  const res = await fetch(microsoftTokenEndpoint(), {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  const j = (await res.json().catch(() => null)) as Record<string, unknown> | null;
  if (!res.ok) {
    return { error: typeof j?.error_description === "string" ? j.error_description : String(j?.error ?? "ms_token_error") };
  }
  const refresh = typeof j?.refresh_token === "string" ? j.refresh_token : "";
  const access = typeof j?.access_token === "string" ? j.access_token : "";
  if (!refresh || !access) return { error: "Microsoft token response was incomplete." };
  const expSec = typeof j?.expires_in === "number" ? j.expires_in : 3600;
  const jwtExp = microsoftAccessTokenExpiresAtMs(access);
  return {
    refreshToken: refresh,
    accessToken: access,
    expiresAtMs: jwtExp ?? Date.now() + Math.max(60, expSec) * 1000,
  };
}

async function googleRefresh(bundle: OAuthTokenBundle): Promise<OAuthTokenBundle | { error: string }> {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) return { error: "Google OAuth is not configured." };
  const body = new URLSearchParams({
    refresh_token: bundle.refreshToken,
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: "refresh_token",
  });
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  const j = (await res.json().catch(() => null)) as Record<string, unknown> | null;
  if (!res.ok) {
    return { error: typeof j?.error_description === "string" ? j.error_description : "google_refresh_failed" };
  }
  const access = typeof j?.access_token === "string" ? j.access_token : "";
  if (!access) return { error: "Google refresh returned no access token." };
  const expSec = typeof j?.expires_in === "number" ? j.expires_in : 3600;
  return {
    refreshToken: bundle.refreshToken,
    accessToken: access,
    expiresAtMs: Date.now() + Math.max(60, expSec) * 1000,
  };
}

async function zoomRefresh(bundle: OAuthTokenBundle): Promise<OAuthTokenBundle | { error: string }> {
  const clientId = process.env.ZOOM_OAUTH_CLIENT_ID?.trim();
  const clientSecret = process.env.ZOOM_OAUTH_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) return { error: "Zoom OAuth is not configured." };
  const auth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: bundle.refreshToken,
  });
  const res = await fetch("https://zoom.us/oauth/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: body.toString(),
  });
  const j = (await res.json().catch(() => null)) as Record<string, unknown> | null;
  if (!res.ok) {
    return { error: typeof j?.reason === "string" ? j.reason : "zoom_refresh_failed" };
  }
  const access = typeof j?.access_token === "string" ? j.access_token : "";
  const refresh = typeof j?.refresh_token === "string" ? j.refresh_token : bundle.refreshToken;
  if (!access) return { error: "Zoom refresh returned no access token." };
  const expSec = typeof j?.expires_in === "number" ? j.expires_in : 3600;
  const jwtExp = zoomAccessTokenExpiresAtMs(access);
  return {
    refreshToken: refresh,
    accessToken: access,
    expiresAtMs: jwtExp ?? Date.now() + Math.max(60, expSec) * 1000,
  };
}

async function microsoftRefresh(bundle: OAuthTokenBundle): Promise<OAuthTokenBundle | { error: string }> {
  const clientId = process.env.MICROSOFT_OAUTH_CLIENT_ID?.trim();
  const clientSecret = process.env.MICROSOFT_OAUTH_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) return { error: "Microsoft OAuth is not configured." };
  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: "refresh_token",
    refresh_token: bundle.refreshToken,
  });
  const res = await fetch(microsoftTokenEndpoint(), {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  const j = (await res.json().catch(() => null)) as Record<string, unknown> | null;
  if (!res.ok) {
    return { error: typeof j?.error_description === "string" ? j.error_description : "microsoft_refresh_failed" };
  }
  const access = typeof j?.access_token === "string" ? j.access_token : "";
  const refresh = typeof j?.refresh_token === "string" ? j.refresh_token : bundle.refreshToken;
  if (!access) return { error: "Microsoft refresh returned no access token." };
  const expSec = typeof j?.expires_in === "number" ? j.expires_in : 3600;
  const jwtExp = microsoftAccessTokenExpiresAtMs(access);
  return {
    refreshToken: refresh,
    accessToken: access,
    expiresAtMs: jwtExp ?? Date.now() + Math.max(60, expSec) * 1000,
  };
}

const ACCESS_SKEW_MS = 90_000;

export async function ensureFreshAccessToken(
  provider: VideoConferenceProviderKey,
  bundle: OAuthTokenBundle,
): Promise<OAuthTokenBundle | { error: string }> {
  const now = Date.now();
  if (bundle.accessToken && bundle.expiresAtMs && bundle.expiresAtMs - ACCESS_SKEW_MS > now) {
    return bundle;
  }
  if (provider === "GOOGLE") return googleRefresh(bundle);
  if (provider === "ZOOM") return zoomRefresh(bundle);
  return microsoftRefresh(bundle);
}

export async function createGoogleMeetForWindow(args: {
  accessToken: string;
  summary: string;
  start: Date;
  end: Date;
}): Promise<{ joinUrl: string; eventId: string } | { error: string }> {
  const requestId = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  const body = {
    summary: args.summary,
    start: { dateTime: args.start.toISOString() },
    end: { dateTime: args.end.toISOString() },
    conferenceData: {
      createRequest: {
        requestId,
        conferenceSolutionKey: { type: "hangoutsMeet" },
      },
    },
  };
  const res = await fetch(
    "https://www.googleapis.com/calendar/v3/calendars/primary/events?conferenceDataVersion=1",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${args.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    },
  );
  const j = (await res.json().catch(() => null)) as Record<string, unknown> | null;
  if (!res.ok) {
    const apiErr = j?.error;
    const message =
      apiErr && typeof apiErr === "object" && typeof (apiErr as { message?: unknown }).message === "string"
        ? (apiErr as { message: string }).message
        : "google_calendar_event_failed";
    return { error: message };
  }
  const conf = j?.conferenceData as Record<string, unknown> | undefined;
  const entryPoints = conf?.entryPoints as unknown[] | undefined;
  const video = entryPoints?.find(
    (e) => typeof e === "object" && e && (e as { entryPointType?: string }).entryPointType === "video",
  ) as { uri?: string } | undefined;
  const joinUrl = video?.uri && typeof video.uri === "string" ? video.uri : "";
  const eventId = typeof j?.id === "string" ? j.id : "";
  if (!joinUrl.startsWith("https://")) return { error: "Google Meet link was not returned." };
  if (!eventId) return { error: "Google Calendar event id missing." };
  return { joinUrl, eventId };
}

export async function createZoomMeetingForWindow(args: {
  accessToken: string;
  topic: string;
  start: Date;
  end: Date;
}): Promise<{ joinUrl: string; meetingId: string } | { error: string }> {
  const durationMin = Math.max(15, Math.ceil((args.end.getTime() - args.start.getTime()) / 60000));
  const body = {
    topic: args.topic,
    type: 2,
    start_time: args.start.toISOString(),
    duration: durationMin,
    timezone: "UTC",
    settings: { waiting_room: true },
  };
  const res = await fetch("https://api.zoom.us/v2/users/me/meetings", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${args.accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const j = (await res.json().catch(() => null)) as Record<string, unknown> | null;
  if (!res.ok) {
    return { error: typeof j?.message === "string" ? j.message : "zoom_meeting_failed" };
  }
  const joinUrl = typeof j?.join_url === "string" ? j.join_url : "";
  const meetingId = typeof j?.id === "number" ? String(j.id) : typeof j?.id === "string" ? j.id : "";
  if (!joinUrl.startsWith("https://")) return { error: "Zoom join URL missing." };
  if (!meetingId) return { error: "Zoom meeting id missing." };
  return { joinUrl, meetingId };
}

export async function createMicrosoftTeamsMeetingForWindow(args: {
  accessToken: string;
  subject: string;
  start: Date;
  end: Date;
}): Promise<{ joinUrl: string; meetingId: string } | { error: string }> {
  const body = {
    startDateTime: args.start.toISOString(),
    endDateTime: args.end.toISOString(),
    subject: args.subject,
  };
  const res = await fetch("https://graph.microsoft.com/v1.0/me/onlineMeetings", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${args.accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const j = (await res.json().catch(() => null)) as Record<string, unknown> | null;
  if (!res.ok) {
    const msg =
      typeof j?.error === "object" && j?.error && typeof (j.error as { message?: string }).message === "string"
        ? (j.error as { message: string }).message
        : "microsoft_online_meeting_failed";
    return { error: msg };
  }
  const joinUrl = typeof j?.joinWebUrl === "string" ? j.joinWebUrl : "";
  const meetingId = typeof j?.id === "string" ? j.id : "";
  if (!joinUrl.startsWith("https://")) return { error: "Microsoft Teams join URL missing." };
  if (!meetingId) return { error: "Microsoft meeting id missing." };
  return { joinUrl, meetingId };
}
