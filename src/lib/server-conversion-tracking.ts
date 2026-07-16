import "server-only";
import { createHash, randomUUID } from "crypto";

export type ServerConversionEvent = {
  event: string;
  userId?: string;
  email?: string;
  value?: number;
  currency?: string;
  /** Dedupes browser + server double-fires in Meta Events Manager. */
  eventId?: string;
  eventSourceUrl?: string;
};

export type MetaCapiCredentials = {
  pixelId: string;
  accessToken: string;
  /** True when using META_ADS_ACCESS_TOKEN because META_ACCESS_TOKEN is unset. */
  usedAdsTokenFallback: boolean;
};

function sha256Hex(value: string): string {
  return createHash("sha256").update(value.trim().toLowerCase()).digest("hex");
}

function toGa4EventName(event: string): string {
  return event
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "_")
    .slice(0, 40);
}

/**
 * Resolves Meta CAPI credentials. Prefers dedicated Events Manager token
 * (`META_ACCESS_TOKEN`); falls back to Marketing API system-user token when unset.
 */
export function resolveMetaCapiCredentials(): MetaCapiCredentials | null {
  const pixelId = process.env.META_PIXEL_ID?.trim();
  if (!pixelId) return null;

  const dedicated = process.env.META_ACCESS_TOKEN?.trim();
  if (dedicated) {
    return { pixelId, accessToken: dedicated, usedAdsTokenFallback: false };
  }

  const adsFallback = process.env.META_ADS_ACCESS_TOKEN?.trim();
  if (adsFallback) {
    return { pixelId, accessToken: adsFallback, usedAdsTokenFallback: true };
  }

  return null;
}

/** Maps internal funnel events to Meta standard CAPI event names. */
export function metaCapiEventNameForServerEvent(event: string): string {
  const map: Record<string, string> = {
    client_signup_complete: "Subscribe",
    trainer_signup_started: "Lead",
    trainer_tos_accepted: "CompleteRegistration",
    trainer_profile_complete: "CompleteRegistration",
    // Stripe-backed purchases (server webhook)
    client_membership_purchase: "Purchase",
    client_vip_purchase: "Purchase",
    trainer_service_purchase: "Purchase",
    trainer_registration_fee_purchase: "Purchase",
    trainer_promo_tokens_purchase: "Purchase",
    fp_nudge_pack_purchase: "Purchase",
  };
  return map[event.trim()] ?? event.trim();
}

/**
 * Live Meta CAPI probe — POSTs a single Lead test event. Env present alone is not
 * enough (same lesson as Meta Insights spend sync).
 */
export async function probeMetaCapiAccess(): Promise<{
  ok: boolean;
  detail: string;
  usedAdsTokenFallback: boolean;
}> {
  const creds = resolveMetaCapiCredentials();
  if (!creds) {
    return {
      ok: false,
      detail: "META_PIXEL_ID and META_ACCESS_TOKEN (or META_ADS_ACCESS_TOKEN fallback) are required.",
      usedAdsTokenFallback: false,
    };
  }

  const eventTime = Math.floor(Date.now() / 1000);
  const eventId = `mf_capi_probe_${eventTime}_${randomUUID().slice(0, 8)}`;
  const res = await fetch(
    `https://graph.facebook.com/v21.0/${creds.pixelId}/events?access_token=${encodeURIComponent(creds.accessToken)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        data: [
          {
            event_name: "Lead",
            event_time: eventTime,
            event_id: eventId,
            action_source: "website",
            event_source_url: "https://match-fit.net/",
            user_data: {
              em: [sha256Hex("capi-probe@match-fit.net")],
            },
            custom_data: {
              match_fit_event: "mf_capi_probe",
              content_name: "Match Fit CAPI probe",
            },
          },
        ],
      }),
      cache: "no-store",
    },
  );

  const text = await res.text().catch(() => "");
  let json: { events_received?: number; error?: { message?: string } } = {};
  try {
    json = text ? (JSON.parse(text) as typeof json) : {};
  } catch {
    // non-JSON body
  }

  if (!res.ok || json.error) {
    const msg = json.error?.message ?? (text.slice(0, 180) || `HTTP ${res.status}`);
    return {
      ok: false,
      detail: `${msg} — Generate a Conversions API system-user token in Events Manager → Settings → Conversions API (pixel ${creds.pixelId}).`,
      usedAdsTokenFallback: creds.usedAdsTokenFallback,
    };
  }

  const received = typeof json.events_received === "number" ? json.events_received : 1;
  return {
    ok: true,
    detail: creds.usedAdsTokenFallback
      ? `CAPI accepted probe (${received} event). Using META_ADS_ACCESS_TOKEN fallback — prefer a dedicated META_ACCESS_TOKEN from Events Manager.`
      : `CAPI accepted probe (${received} event) for pixel ${creds.pixelId}.`,
    usedAdsTokenFallback: creds.usedAdsTokenFallback,
  };
}

async function sendMetaCapiEvent(input: ServerConversionEvent): Promise<void> {
  const creds = resolveMetaCapiCredentials();
  if (!creds) return;

  const userData: Record<string, string[]> = {};
  if (input.email) userData.em = [sha256Hex(input.email)];
  if (input.userId) userData.external_id = [sha256Hex(input.userId)];

  const customData: Record<string, number | string> = { match_fit_event: input.event };
  if (typeof input.value === "number") customData.value = input.value;
  if (input.currency) customData.currency = input.currency;

  const eventName = metaCapiEventNameForServerEvent(input.event);
  const eventId = input.eventId?.trim() || `mf_${input.event}_${input.userId ?? "anon"}_${Date.now()}`;

  const payload: Record<string, unknown> = {
    event_name: eventName,
    event_time: Math.floor(Date.now() / 1000),
    event_id: eventId,
    action_source: "website",
    user_data: userData,
    custom_data: customData,
  };
  if (input.eventSourceUrl?.trim()) {
    payload.event_source_url = input.eventSourceUrl.trim();
  }

  const res = await fetch(
    `https://graph.facebook.com/v21.0/${creds.pixelId}/events?access_token=${encodeURIComponent(creds.accessToken)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ data: [payload] }),
    },
  );
  if (!res.ok) {
    console.error("[server-conversion-tracking] Meta CAPI non-OK response", res.status, await res.text().catch(() => ""));
  }
}

async function sendGa4MeasurementProtocolEvent(input: ServerConversionEvent): Promise<void> {
  const measurementId = process.env.GA_MEASUREMENT_ID?.trim();
  const apiSecret = process.env.GA_API_SECRET?.trim();
  if (!measurementId || !apiSecret) return;

  const clientId = input.userId ?? (input.email ? sha256Hex(input.email) : randomUUID());

  const params: Record<string, number | string> = {};
  if (typeof input.value === "number") params.value = input.value;
  if (input.currency) params.currency = input.currency;

  const res = await fetch(
    `https://www.google-analytics.com/mp/collect?measurement_id=${measurementId}&api_secret=${apiSecret}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: clientId,
        events: [{ name: toGa4EventName(input.event), params }],
      }),
    },
  );
  if (!res.ok) {
    console.error(
      "[server-conversion-tracking] GA Measurement Protocol non-OK response",
      res.status,
      await res.text().catch(() => ""),
    );
  }
}

/**
 * Best-effort server-side conversion tracking — fires Meta CAPI and GA4 Measurement
 * Protocol in parallel so ad blockers can't drop these events the way client-side
 * pixel/gtag calls can. Never throws: a tracking failure must never break signup flow.
 */
export async function trackServerConversion(input: ServerConversionEvent): Promise<void> {
  const results = await Promise.allSettled([sendMetaCapiEvent(input), sendGa4MeasurementProtocolEvent(input)]);
  for (const r of results) {
    if (r.status === "rejected") {
      console.error("[server-conversion-tracking] event failed", input.event, r.reason);
    }
  }
}
