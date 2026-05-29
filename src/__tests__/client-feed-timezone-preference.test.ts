import { describe, expect, it } from "vitest";
import {
  clientHasActiveFeedTimezoneFilter,
  formatClientFeedTimezonePreferenceSummary,
  parseFeedTimezoneQuestionAnswer,
  trainerBookingTimezoneMatchesClientFeedFilter,
} from "@/lib/client-feed-timezone-preference";
import {
  defaultClientMatchPreferences,
  type ClientMatchPreferences,
} from "@/lib/client-match-preferences";

function prefs(overrides: Partial<ClientMatchPreferences>): ClientMatchPreferences {
  return { ...defaultClientMatchPreferences, ...overrides };
}

describe("client feed timezone preference", () => {
  it("defaults to no preference for virtual clients", () => {
    const p = prefs({ deliveryModes: ["virtual"] });
    expect(clientHasActiveFeedTimezoneFilter(p)).toBe(false);
    expect(formatClientFeedTimezonePreferenceSummary(p)).toBe("No preference");
  });

  it("does not filter when client only uses in-person delivery", () => {
    const p = prefs({
      deliveryModes: ["in_person"],
      feedTimezoneMode: "selected",
      feedTimezones: ["America/Chicago"],
    });
    expect(clientHasActiveFeedTimezoneFilter(p)).toBe(false);
    expect(trainerBookingTimezoneMatchesClientFeedFilter("America/New_York", p)).toBe(true);
  });

  it("filters trainers to selected US time zones", () => {
    const p = prefs({
      deliveryModes: ["virtual", "diy"],
      feedTimezoneMode: "selected",
      feedTimezones: ["America/Chicago", "America/Denver"],
    });
    expect(clientHasActiveFeedTimezoneFilter(p)).toBe(true);
    expect(trainerBookingTimezoneMatchesClientFeedFilter("America/Chicago", p)).toBe(true);
    expect(trainerBookingTimezoneMatchesClientFeedFilter("America/New_York", p)).toBe(false);
    expect(formatClientFeedTimezonePreferenceSummary(p)).toContain("Chicago");
  });

  it("parses questionnaire answers", () => {
    expect(parseFeedTimezoneQuestionAnswer("no_preference")).toEqual({
      feedTimezoneMode: "no_preference",
      feedTimezones: [],
    });
    expect(parseFeedTimezoneQuestionAnswer("America/New_York,America/Chicago")).toEqual({
      feedTimezoneMode: "selected",
      feedTimezones: ["America/New_York", "America/Chicago"],
    });
  });
});
