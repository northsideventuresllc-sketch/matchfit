import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  betaExcludeCapCountEmails,
  betaExcludeCapCountUsernames,
  betaInviteSlotDays,
  betaMaxClients,
  betaMaxTrainers,
  isBetaLaunchGatesEnabled,
} from "@/lib/beta-launch-config";

const envSnapshot = { ...process.env };

describe("beta-launch-config helpers", () => {
  beforeEach(() => {
    process.env = { ...envSnapshot };
    delete process.env.MATCH_FIT_BETA_EXCLUDE_CAP_COUNT_EMAILS;
    delete process.env.MATCH_FIT_BETA_EXCLUDE_CAP_COUNT_USERNAMES;
    delete process.env.MATCH_FIT_BETA_GATES_ENABLED;
    delete process.env.MATCH_FIT_BETA_MAX_TRAINERS;
    delete process.env.MATCH_FIT_BETA_MAX_CLIENTS;
    delete process.env.MATCH_FIT_BETA_INVITE_SLOT_DAYS;
  });

  afterEach(() => {
    process.env = { ...envSnapshot };
  });

  it("normalizes and de-duplicates excluded beta cap emails", () => {
    process.env.MATCH_FIT_BETA_EXCLUDE_CAP_COUNT_EMAILS =
      " Staff@Example.com, , TEAM@EXAMPLE.com,staff@example.com ";

    expect(betaExcludeCapCountEmails()).toEqual(new Set(["staff@example.com", "team@example.com"]));
  });

  it("normalizes and de-duplicates excluded beta cap usernames", () => {
    process.env.MATCH_FIT_BETA_EXCLUDE_CAP_COUNT_USERNAMES = " @CoachOne, memberTwo , coachone, @MemberTwo ";

    expect(betaExcludeCapCountUsernames()).toEqual(new Set(["coachone", "membertwo"]));
  });

  it("enables beta gates for truthy env values only", () => {
    process.env.MATCH_FIT_BETA_GATES_ENABLED = "yes";
    expect(isBetaLaunchGatesEnabled()).toBe(true);

    process.env.MATCH_FIT_BETA_GATES_ENABLED = "1";
    expect(isBetaLaunchGatesEnabled()).toBe(true);

    process.env.MATCH_FIT_BETA_GATES_ENABLED = "true";
    expect(isBetaLaunchGatesEnabled()).toBe(true);

    process.env.MATCH_FIT_BETA_GATES_ENABLED = "false";
    expect(isBetaLaunchGatesEnabled()).toBe(false);
  });

  it("applies defaults when max trainer/client values are invalid", () => {
    process.env.MATCH_FIT_BETA_MAX_TRAINERS = "17";
    process.env.MATCH_FIT_BETA_MAX_CLIENTS = "120";
    expect(betaMaxTrainers()).toBe(17);
    expect(betaMaxClients()).toBe(120);

    process.env.MATCH_FIT_BETA_MAX_TRAINERS = "0";
    process.env.MATCH_FIT_BETA_MAX_CLIENTS = "-10";
    expect(betaMaxTrainers()).toBe(10);
    expect(betaMaxClients()).toBe(50);
  });

  it("parses invite slot days with positive-integer fallback", () => {
    process.env.MATCH_FIT_BETA_INVITE_SLOT_DAYS = "45";
    expect(betaInviteSlotDays()).toBe(45);

    process.env.MATCH_FIT_BETA_INVITE_SLOT_DAYS = "not-a-number";
    expect(betaInviteSlotDays()).toBe(30);
  });
});
