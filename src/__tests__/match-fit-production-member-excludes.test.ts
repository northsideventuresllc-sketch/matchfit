import { describe, expect, it } from "vitest";
import {
  getMatchFitLaunchExcludeClientUsernames,
  getMatchFitLaunchExcludeTrainerUsernames,
} from "@/lib/match-fit-launch-exclude-accounts";
import { getLaunchExcludeEmails } from "@/lib/launch-account-counts";
import {
  MATCH_FIT_EXCLUDE_NON_PRODUCTION_CLIENT_USERNAMES,
  MATCH_FIT_EXCLUDE_NON_PRODUCTION_TRAINER_USERNAMES,
} from "@/lib/match-fit-production-member-excludes";

describe("match-fit production member excludes", () => {
  it("excludes QA portals like jibbyjam22 and coachjonny22 but not owner client jbfitness6299", () => {
    const clientUsernames = getMatchFitLaunchExcludeClientUsernames();
    const trainerUsernames = getMatchFitLaunchExcludeTrainerUsernames();
    const emails = getLaunchExcludeEmails();

    expect(clientUsernames).toEqual(expect.arrayContaining(["jibbyjam22", "jonnybronny22", "twofa_tester"]));
    expect(trainerUsernames).toEqual(expect.arrayContaining(["coachjonny22", "jibbyjam22"]));
    expect(clientUsernames).not.toContain("jbfitness6299");
    expect(emails).not.toContain("jonnybooth22@gmail.com");
    expect(emails).toContain("jb@northsideventuresgroup.com");
  });

  it("documents non-production username lists", () => {
    expect(MATCH_FIT_EXCLUDE_NON_PRODUCTION_CLIENT_USERNAMES).toContain("jibbyjam22");
    expect(MATCH_FIT_EXCLUDE_NON_PRODUCTION_TRAINER_USERNAMES).toContain("coachjonny22");
  });
});
