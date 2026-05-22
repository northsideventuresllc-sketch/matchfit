import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  INTERNAL_SYNTHETIC_EMAIL_SUFFIX,
  getLaunchExcludeEmails,
  isInternalSyntheticMatchFitEmail,
  launchClientCountWhere,
  launchTrainerCountWhere,
} from "@/lib/launch-account-counts";

describe("launch account count exclusions", () => {
  const prev = { ...process.env };

  beforeEach(() => {
    process.env = { ...prev };
    delete process.env.MATCH_FIT_BETA_EXCLUDE_CAP_COUNT_EMAILS;
    delete process.env.MATCH_FIT_INTERNAL_QA_CLIENT_EMAILS;
    delete process.env.MATCH_FIT_INTERNAL_QA_TRAINER_EMAILS;
  });

  afterEach(() => {
    process.env = prev;
  });

  it("detects internal synthetic email domain", () => {
    expect(isInternalSyntheticMatchFitEmail(`mfqa.trainer.abc@internal.match-fit.invalid`)).toBe(true);
    expect(isInternalSyntheticMatchFitEmail("real@example.com")).toBe(false);
  });

  it("merges beta exclude list with internal QA emails", () => {
    process.env.MATCH_FIT_BETA_EXCLUDE_CAP_COUNT_EMAILS = "Staff@Example.com";
    process.env.MATCH_FIT_INTERNAL_QA_TRAINER_EMAILS = "coach@test.com";
    process.env.MATCH_FIT_INTERNAL_QA_CLIENT_EMAILS = "member@test.com";

    expect(getLaunchExcludeEmails("trainer")).toEqual(
      expect.arrayContaining(["staff@example.com", "coach@test.com"]),
    );
    expect(getLaunchExcludeEmails("client")).toEqual(
      expect.arrayContaining(["staff@example.com", "member@test.com"]),
    );
  });

  it("launch count filters exclude synthetic personas and internal emails", () => {
    process.env.MATCH_FIT_INTERNAL_QA_TRAINER_EMAILS = "qa-coach@example.com";

    const trainerWhere = launchTrainerCountWhere();
    expect(trainerWhere.deidentifiedAt).toBeNull();
    expect(trainerWhere.internalQaSyntheticPersona).toBe(false);
    expect(trainerWhere.NOT).toEqual({
      OR: expect.arrayContaining([
        { email: { endsWith: INTERNAL_SYNTHETIC_EMAIL_SUFFIX, mode: "insensitive" } },
        { email: { in: ["qa-coach@example.com"] } },
      ]),
    });

    const clientWhere = launchClientCountWhere();
    expect(clientWhere.internalQaSyntheticPersona).toBe(false);
    expect(clientWhere.NOT).toEqual({
      OR: [{ email: { endsWith: INTERNAL_SYNTHETIC_EMAIL_SUFFIX, mode: "insensitive" } }],
    });
  });
});

describe("beta launch status slot math", () => {
  it("computes remaining client slots from cap minus used", () => {
    const cap = 50;
    const used = 12;
    expect(Math.max(0, cap - used)).toBe(38);
  });
});
