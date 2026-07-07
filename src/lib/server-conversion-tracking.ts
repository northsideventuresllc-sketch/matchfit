import "server-only";
import { createHash, randomUUID } from "crypto";

export type ServerConversionEvent = {
  event: string;
  userId?: string;
  email?: string;
  value?: number;
  currency?: string;
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

/** Maps internal funnel events to Meta standard CAPI event names. */
export function metaCapiEventNameForServerEvent(event: string): string {
  const map: Record<string, string> = {
    client_signup_complete: "Subscribe",
    trainer_signup_started: "Lead",
    trainer_tos_accepted: "CompleteRegistration",
    trainer_profile_complete: "CompleteRegistration",
  };
  return map[event.trim()] ?? event.trim();
}

async function sendMetaCapiEvent(input: ServerConversionEvent): Promise<void> {
  const pixelId = process.env.META_PIXEL_ID?.trim();
  const accessToken = process.env.META_ACCESS_TOKEN?.trim();
  if (!pixelId || !accessToken) return;

  const userData: Record<string, string[]> = {};
  if (input.email) userData.em = [sha256Hex(input.email)];
  if (input.userId) userData.external_id = [sha256Hex(input.userId)];

  const customData: Record<string, number | string> = { match_fit_event: input.event };
  if (typeof input.value === "number") customData.value = input.value;
  if (input.currency) customData.currency = input.currency;

  const eventName = metaCapiEventNameForServerEvent(input.event);

  const res = await fetch(`https://graph.facebook.com/v21.0/${pixelId}/events?access_token=${accessToken}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      data: [
        {
          event_name: eventName,
          event_time: Math.floor(Date.now() / 1000),
          action_source: "website",
          user_data: userData,
          custom_data: customData,
        },
      ],
    }),
  });
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
