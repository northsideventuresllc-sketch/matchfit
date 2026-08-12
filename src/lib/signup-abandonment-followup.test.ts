import { describe, expect, it } from "vitest";

import {
  isDueForNextSignupFollowup,
  nextSignupFollowupKind,
  signupResumePathForRole,
  SIGNUP_FOLLOWUP_DELAYS_MS,
  SIGNUP_FOLLOWUP_MAX_COUNT,
} from "@/lib/signup-abandonment-followup";

const HOUR = 60 * 60 * 1000;

describe("SIGNUP_FOLLOWUP_DELAYS_MS", () => {
  it("is 1 hour, 24 hours, 72 hours", () => {
    expect(SIGNUP_FOLLOWUP_DELAYS_MS).toEqual([HOUR, 24 * HOUR, 72 * HOUR]);
  });
});

describe("isDueForNextSignupFollowup", () => {
  const now = new Date("2026-08-07T12:00:00.000Z");

  it("is not due before the 1-hour mark for the first follow-up", () => {
    const updatedAt = new Date(now.getTime() - 59 * 60 * 1000);
    expect(isDueForNextSignupFollowup({ followupEmailsSent: 0, updatedAt, now })).toBe(false);
  });

  it("is due at exactly the 1-hour mark for the first follow-up", () => {
    const updatedAt = new Date(now.getTime() - HOUR);
    expect(isDueForNextSignupFollowup({ followupEmailsSent: 0, updatedAt, now })).toBe(true);
  });

  it("is due well past the 1-hour mark for the first follow-up", () => {
    const updatedAt = new Date(now.getTime() - 3 * HOUR);
    expect(isDueForNextSignupFollowup({ followupEmailsSent: 0, updatedAt, now })).toBe(true);
  });

  it("requires 24 hours (not 1) for the second follow-up", () => {
    const updatedAt = new Date(now.getTime() - 2 * HOUR);
    expect(isDueForNextSignupFollowup({ followupEmailsSent: 1, updatedAt, now })).toBe(false);
    const updatedAt24 = new Date(now.getTime() - 24 * HOUR);
    expect(isDueForNextSignupFollowup({ followupEmailsSent: 1, updatedAt: updatedAt24, now })).toBe(true);
  });

  it("requires 72 hours for the third follow-up", () => {
    const updatedAt48 = new Date(now.getTime() - 48 * HOUR);
    expect(isDueForNextSignupFollowup({ followupEmailsSent: 2, updatedAt: updatedAt48, now })).toBe(false);
    const updatedAt72 = new Date(now.getTime() - 72 * HOUR);
    expect(isDueForNextSignupFollowup({ followupEmailsSent: 2, updatedAt: updatedAt72, now })).toBe(true);
  });

  it("is never due once all 3 follow-ups have gone out", () => {
    const longAgo = new Date(now.getTime() - 365 * 24 * HOUR);
    expect(isDueForNextSignupFollowup({ followupEmailsSent: 3, updatedAt: longAgo, now })).toBe(false);
    expect(isDueForNextSignupFollowup({ followupEmailsSent: 4, updatedAt: longAgo, now })).toBe(false);
  });
});

describe("nextSignupFollowupKind", () => {
  it("maps trainer follow-up index to the role-specific kind", () => {
    expect(nextSignupFollowupKind("trainer", 0)).toBe("TRAINER_SIGNUP_FOLLOWUP_1");
    expect(nextSignupFollowupKind("trainer", 1)).toBe("TRAINER_SIGNUP_FOLLOWUP_2");
    expect(nextSignupFollowupKind("trainer", 2)).toBe("TRAINER_SIGNUP_FOLLOWUP_3");
  });

  it("maps client follow-up index to the role-specific kind", () => {
    expect(nextSignupFollowupKind("client", 0)).toBe("CLIENT_SIGNUP_FOLLOWUP_1");
    expect(nextSignupFollowupKind("client", 1)).toBe("CLIENT_SIGNUP_FOLLOWUP_2");
    expect(nextSignupFollowupKind("client", 2)).toBe("CLIENT_SIGNUP_FOLLOWUP_3");
  });

  it("returns null once the sequence is exhausted", () => {
    expect(nextSignupFollowupKind("trainer", SIGNUP_FOLLOWUP_MAX_COUNT)).toBeNull();
    expect(nextSignupFollowupKind("trainer", 99)).toBeNull();
  });
});

describe("signupResumePathForRole", () => {
  it("points trainers back at the trainer signup wizard", () => {
    expect(signupResumePathForRole("trainer")).toBe("/trainer/signup");
  });

  it("points clients back at the client signup form", () => {
    expect(signupResumePathForRole("client")).toBe("/client/sign-up");
  });
});
