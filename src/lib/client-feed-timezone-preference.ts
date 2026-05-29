import {
  type ClientMatchPreferences,
  normalizeClientFeedTimezones,
} from "@/lib/client-match-preferences";
import { US_BOOKING_TIMEZONE_OPTIONS, normalizeUsBookingTimezone } from "@/lib/us-booking-timezones";

export function clientPrefersVirtualOrDiy(prefs: ClientMatchPreferences): boolean {
  return prefs.deliveryModes.includes("virtual") || prefs.deliveryModes.includes("diy");
}

export function clientHasActiveFeedTimezoneFilter(prefs: ClientMatchPreferences): boolean {
  if (!clientPrefersVirtualOrDiy(prefs)) return false;
  if (prefs.feedTimezoneMode !== "selected") return false;
  return normalizeClientFeedTimezones(prefs.feedTimezones).length > 0;
}

export function clientFeedTimezoneFilterSet(prefs: ClientMatchPreferences): Set<string> | null {
  if (!clientHasActiveFeedTimezoneFilter(prefs)) return null;
  return new Set(normalizeClientFeedTimezones(prefs.feedTimezones));
}

export function trainerBookingTimezoneMatchesClientFeedFilter(
  trainerTimezone: string | null | undefined,
  prefs: ClientMatchPreferences,
): boolean {
  const filter = clientFeedTimezoneFilterSet(prefs);
  if (!filter) return true;
  return filter.has(normalizeUsBookingTimezone(trainerTimezone));
}

export function formatClientFeedTimezonePreferenceSummary(prefs: ClientMatchPreferences): string {
  if (!clientPrefersVirtualOrDiy(prefs) || !clientHasActiveFeedTimezoneFilter(prefs)) {
    return "No preference";
  }
  const labels = normalizeClientFeedTimezones(prefs.feedTimezones).map(
    (tz) => US_BOOKING_TIMEZONE_OPTIONS.find((o) => o.value === tz)?.label ?? tz,
  );
  return labels.join(", ");
}

export function parseFeedTimezoneQuestionAnswer(raw: string): Pick<
  ClientMatchPreferences,
  "feedTimezoneMode" | "feedTimezones"
> {
  const trimmed = raw.trim();
  if (!trimmed || trimmed === "no_preference") {
    return { feedTimezoneMode: "no_preference", feedTimezones: [] };
  }
  const timezones = normalizeClientFeedTimezones(trimmed.split(","));
  if (!timezones.length) {
    return { feedTimezoneMode: "no_preference", feedTimezones: [] };
  }
  return { feedTimezoneMode: "selected", feedTimezones: timezones };
}

export function serializeFeedTimezoneQuestionAnswer(prefs: ClientMatchPreferences): string {
  if (!clientHasActiveFeedTimezoneFilter(prefs)) return "no_preference";
  return normalizeClientFeedTimezones(prefs.feedTimezones).join(",");
}
