"use client";

import type { ClientMatchPreferences } from "@/lib/client-match-preferences";
import { clientPrefersVirtualOrDiy } from "@/lib/client-feed-timezone-preference";
import { US_BOOKING_TIMEZONE_OPTIONS } from "@/lib/us-booking-timezones";

const labelClass = "text-xs font-semibold uppercase tracking-wide text-white/50";

type Props = {
  prefs: ClientMatchPreferences;
  onChange: (next: ClientMatchPreferences) => void;
  compact?: boolean;
};

export function ClientFeedTimezonePreferenceFields({ prefs, onChange, compact = false }: Props) {
  if (!clientPrefersVirtualOrDiy(prefs)) return null;

  function setNoPreference() {
    onChange({
      ...prefs,
      feedTimezoneMode: "no_preference",
      feedTimezones: [],
    });
  }

  function toggleTimezone(value: string) {
    const has = prefs.feedTimezones.includes(value);
    const nextTimezones = has
      ? prefs.feedTimezones.filter((tz) => tz !== value)
      : [...prefs.feedTimezones, value];
    if (!nextTimezones.length) {
      setNoPreference();
      return;
    }
    onChange({
      ...prefs,
      feedTimezoneMode: "selected",
      feedTimezones: nextTimezones,
    });
  }

  return (
    <section className={compact ? "space-y-3" : "space-y-3 rounded-2xl border border-white/[0.06] bg-[#0E1016]/50 p-4"}>
      <div>
        <p className={labelClass}>Coach time zones in scroll &amp; swipe feeds</p>
        <p className="mt-2 text-xs leading-relaxed text-white/45">
          Virtual and DIY coaching often spans time zones. Choose where you are comfortable working with coaches, or leave
          it open to see everyone.
        </p>
      </div>

      <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-white/[0.08] bg-[#12151C]/80 px-4 py-3 text-sm text-white/85">
        <input
          type="radio"
          name="feedTimezoneMode"
          checked={prefs.feedTimezoneMode === "no_preference"}
          onChange={setNoPreference}
          className="mt-1 h-4 w-4 accent-[#FF7E00]"
        />
        <span>
          <span className="font-semibold text-white">No preference</span>
          <span className="mt-1 block text-xs text-white/45">
            Show coaches in all US time zones in your scroll and swipe discovery feeds.
          </span>
        </span>
      </label>

      <div className="space-y-2">
        <p className="text-xs font-semibold text-white/60">Or limit feeds to coaches in these time zones (pick any that work for you):</p>
        <div className="grid gap-2 sm:grid-cols-2">
          {US_BOOKING_TIMEZONE_OPTIONS.map(({ value, label }) => (
            <label
              key={value}
              className="flex cursor-pointer items-center gap-2 rounded-xl border border-white/[0.08] bg-[#12151C]/80 px-3 py-2.5 text-sm text-white/85"
            >
              <input
                type="checkbox"
                checked={prefs.feedTimezoneMode === "selected" && prefs.feedTimezones.includes(value)}
                onChange={() => toggleTimezone(value)}
                className="h-4 w-4 accent-[#FF7E00]"
              />
              {label}
            </label>
          ))}
        </div>
      </div>
    </section>
  );
}
