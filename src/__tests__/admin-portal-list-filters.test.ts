import { describe, expect, it } from "vitest";
import {
  ADMIN_REDACTED_EMAIL_LABEL,
  adminPortalClientListWhere,
  adminPortalTrainerListWhere,
  buildAdminPortalClientSqlFilter,
  buildLaunchMetricsClientSqlFilter,
  buildLaunchMetricsTrainerSqlFilter,
  isAdminOwnerTestUsername,
  redactEmailForAdminPortal,
} from "@/lib/admin-portal-list-filters";
import { INTERNAL_SYNTHETIC_EMAIL_SUFFIX, getLaunchExcludeUsernames } from "@/lib/launch-account-counts";

describe("admin portal list filters", () => {
  it("keeps owner test usernames in list filters while excluding synthetic prefixes", () => {
    const clientWhere = adminPortalClientListWhere();
    expect(clientWhere.OR).toEqual(
      expect.arrayContaining([
        { username: { in: ["jbfitness6299"], mode: "insensitive" } },
        {
          NOT: {
            OR: expect.arrayContaining([
              { username: { startsWith: "mfqsc_", mode: "insensitive" } },
              { username: { equals: "twofa_tester", mode: "insensitive" } },
            ]),
          },
        },
      ]),
    );

    const trainerWhere = adminPortalTrainerListWhere();
    expect(trainerWhere.OR).toEqual(
      expect.arrayContaining([{ username: { in: ["coachjonny22"], mode: "insensitive" } }]),
    );
    const fakeOr = (trainerWhere.OR as { NOT?: { OR?: unknown[] } }[]).find((c) => "NOT" in c)?.NOT?.OR;
    expect(fakeOr).toEqual(
      expect.arrayContaining([
        { email: { endsWith: INTERNAL_SYNTHETIC_EMAIL_SUFFIX, mode: "insensitive" } },
        { username: { startsWith: "mfqst_", mode: "insensitive" } },
      ]),
    );
    expect(fakeOr).not.toEqual(
      expect.arrayContaining([{ username: { equals: "coachjonny22", mode: "insensitive" } }]),
    );
  });

  it("redacts email only for owner test accounts", () => {
    expect(isAdminOwnerTestUsername("jbfitness6299", "client")).toBe(true);
    expect(isAdminOwnerTestUsername("coachjonny22", "trainer")).toBe(true);
    expect(isAdminOwnerTestUsername("realuser", "client")).toBe(false);

    expect(redactEmailForAdminPortal("jonnybooth22@gmail.com", "jbfitness6299", "client")).toBe(
      ADMIN_REDACTED_EMAIL_LABEL,
    );
    expect(redactEmailForAdminPortal("northside.ventures.llc@gmail.com", "coachjonny22", "trainer")).toBe(
      ADMIN_REDACTED_EMAIL_LABEL,
    );
    expect(redactEmailForAdminPortal("member@example.com", "realuser", "client")).toBe("member@example.com");
  });

  it("metrics SQL filters exclude owner test accounts (unlike list filters)", () => {
    expect(getLaunchExcludeUsernames("client")).toContain("jbfitness6299");
    expect(getLaunchExcludeUsernames("trainer")).toContain("coachjonny22");

    const clientMetricsSql = buildLaunchMetricsClientSqlFilter("c").strings.join(" ");
    const clientListSql = buildAdminPortalClientSqlFilter().strings.join(" ");
    expect(clientMetricsSql).toContain("NOT IN");
    expect(clientListSql).toMatch(/username.*IN/i);
    expect(clientMetricsSql).not.toMatch(/OR\s*\(\s*LOWER\(c\."username"\)\s*IN/i);

    const trainerMetricsSql = buildLaunchMetricsTrainerSqlFilter("t", "p").strings.join(" ");
    expect(trainerMetricsSql).toContain("NOT IN");
    expect(trainerMetricsSql).not.toMatch(/OR\s*\(\s*LOWER\(t\."username"\)\s*IN/i);
  });
});
