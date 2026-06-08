import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  getOwnerHiddenLiveClientEmails,
  getOwnerHiddenLiveTrainerEmails,
  isClientHiddenFromPublicMarketplace,
  isTrainerHiddenFromPublicMarketplace,
  publicMarketplaceVisibleClientWhere,
  publicMarketplaceVisibleTrainerWhere,
} from "@/lib/match-fit-public-marketplace-hidden";
import { getLaunchExcludeEmails } from "@/lib/launch-account-counts";

describe("match-fit-public-marketplace-hidden", () => {
  const prev = { ...process.env };

  beforeEach(() => {
    process.env = { ...prev };
    delete process.env.MATCH_FIT_OWNER_HIDDEN_LIVE_CLIENT_EMAILS;
    delete process.env.MATCH_FIT_OWNER_HIDDEN_LIVE_TRAINER_EMAILS;
  });

  afterEach(() => {
    process.env = prev;
  });

  it("includes built-in owner hidden live emails", () => {
    expect(getOwnerHiddenLiveClientEmails()).toContain("northsideofficial100@gmail.com");
    expect(getOwnerHiddenLiveTrainerEmails()).toContain("jb@northsideventures.com");
  });

  it("hides launch-exclude and owner hidden live trainers from public marketplace", () => {
    expect(
      isTrainerHiddenFromPublicMarketplace({
        email: "jb@northsideventures.com",
        username: "coach_jb",
      }),
    ).toBe(true);
    expect(
      isTrainerHiddenFromPublicMarketplace({
        email: "jb@northsideventuresgroup.com",
        username: "coachjonny22",
      }),
    ).toBe(true);
    expect(
      isTrainerHiddenFromPublicMarketplace({
        email: "real@example.com",
        username: "real_coach",
      }),
    ).toBe(false);
  });

  it("hides owner hidden live client from public marketplace", () => {
    expect(
      isClientHiddenFromPublicMarketplace({
        email: "northsideofficial100@gmail.com",
        username: "northside_client",
      }),
    ).toBe(true);
    expect(
      isClientHiddenFromPublicMarketplace({
        email: "member@example.com",
        username: "real_member",
      }),
    ).toBe(false);
  });

  it("owner hidden live emails are not in launch exclude lists (still counted in totals)", () => {
    const launchEmails = getLaunchExcludeEmails();
    expect(launchEmails).not.toContain("northsideofficial100@gmail.com");
    expect(launchEmails).not.toContain("jb@northsideventures.com");
  });

  it("public marketplace visible filters exclude synthetic personas", () => {
    expect(publicMarketplaceVisibleTrainerWhere().NOT).toEqual({
      OR: expect.arrayContaining([{ internalQaSyntheticPersona: true }]),
    });
    expect(publicMarketplaceVisibleClientWhere().NOT).toEqual({
      OR: expect.arrayContaining([{ internalQaSyntheticPersona: true }]),
    });
  });
});
