import { describe, expect, it } from "vitest";
import {
  filterOwnerTestIdentities,
  isOwnerTestAccountEmail,
  isOwnerTestAccountIdentity,
  isOwnerTestAccountUsername,
  ownerTestExcludedPendingRegistrationWhere,
  ownerTestExcludedSignupProgressWhere,
} from "@/lib/owner-test-account-exclusion";

describe("owner-test-account-exclusion", () => {
  it("flags jibbyjam22 and owner QA emails", () => {
    expect(isOwnerTestAccountUsername("jibbyjam22", "client")).toBe(true);
    expect(isOwnerTestAccountUsername("jibbyjam22", "trainer")).toBe(true);
    expect(isOwnerTestAccountUsername("kmfitness", "trainer")).toBe(false);
    expect(isOwnerTestAccountEmail("jonnybooth22@gmail.com")).toBe(true);
    expect(isOwnerTestAccountIdentity({ username: "coachjonny22", role: "trainer" })).toBe(true);
  });

  it("builds prisma filters that exclude owner test identities", () => {
    const signupWhere = ownerTestExcludedSignupProgressWhere("trainer");
    expect(signupWhere.NOT?.OR).toEqual(
      expect.arrayContaining([{ username: { equals: "jibbyjam22", mode: "insensitive" } }]),
    );

    const pendingWhere = ownerTestExcludedPendingRegistrationWhere();
    expect(pendingWhere.NOT?.OR).toEqual(
      expect.arrayContaining([{ email: { equals: "jb@match-fit.net", mode: "insensitive" } }]),
    );
  });

  it("filters owner test rows from admin lists", () => {
    const rows = [
      { id: "1", username: "jibbyjam22", email: "x@example.com" },
      { id: "2", username: "realcoach", email: "coach@example.com" },
    ];
    const filtered = filterOwnerTestIdentities(rows, (row) => ({
      username: row.username,
      email: row.email,
      role: "trainer",
    }));
    expect(filtered).toHaveLength(1);
    expect(filtered[0]?.username).toBe("realcoach");
  });
});
