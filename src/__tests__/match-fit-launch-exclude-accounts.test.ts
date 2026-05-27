import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  MATCH_FIT_BUILTIN_LAUNCH_EXCLUDE_EMAILS,
  getMatchFitLaunchExcludeClientUsernames,
  getMatchFitLaunchExcludeEmails,
  getMatchFitLaunchExcludeTrainerUsernames,
} from "@/lib/match-fit-launch-exclude-accounts";

describe("match-fit-launch-exclude-accounts", () => {
  const prev = { ...process.env };

  beforeEach(() => {
    process.env = { ...prev };
    delete process.env.MATCH_FIT_DEV_CLIENT_IDENTIFIER;
    delete process.env.MATCH_FIT_DEV_TRAINER_IDENTIFIER;
    delete process.env.MATCH_FIT_TEST_TRAINER_EMAILS;
    delete process.env.MATCH_FIT_TEST_TRAINER_USERNAMES;
    delete process.env.MATCH_FIT_INTERNAL_QA_CLIENT_EMAILS;
    delete process.env.MATCH_FIT_INTERNAL_QA_TRAINER_EMAILS;
  });

  afterEach(() => {
    process.env = prev;
  });

  it("always excludes built-in owner seed emails without env", () => {
    expect(getMatchFitLaunchExcludeEmails()).toEqual(
      expect.arrayContaining([...MATCH_FIT_BUILTIN_LAUNCH_EXCLUDE_EMAILS]),
    );
  });

  it("merges dev identifiers and test trainer emails from env", () => {
    process.env.MATCH_FIT_DEV_CLIENT_IDENTIFIER = "Member@Dev.com";
    process.env.MATCH_FIT_DEV_TRAINER_IDENTIFIER = "coach@dev.com";
    process.env.MATCH_FIT_TEST_TRAINER_EMAILS = "qa-coach@example.com";
    process.env.MATCH_FIT_TEST_TRAINER_USERNAMES = "demo_coach,other";

    expect(getMatchFitLaunchExcludeEmails()).toEqual(
      expect.arrayContaining(["member@dev.com", "coach@dev.com", "qa-coach@example.com"]),
    );
    expect(getMatchFitLaunchExcludeTrainerUsernames()).toEqual(
      expect.arrayContaining(["coachjonny22", "demo_coach", "other"]),
    );
    expect(getMatchFitLaunchExcludeClientUsernames()).toEqual(
      expect.arrayContaining(["jbfitness6299"]),
    );
  });
});
