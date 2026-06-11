import { describe, expect, it } from "vitest";
import {
  ADMIN_REDACTED_EMAIL_LABEL,
  adminPendingTrainerWhere,
  adminPortalClientListWhere,
  adminPortalTrainerDirectoryWhere,
  adminPortalTrainerListWhere,
  buildAdminPortalClientSqlFilter,
  buildAdminPortalTrainerSqlFilter,
  buildLaunchMetricsClientSqlFilter,
  buildLaunchMetricsTrainerSqlFilter,
  isAdminOwnerTestUsername,
  redactEmailForAdminPortal,
} from "@/lib/admin-portal-list-filters";
import { INTERNAL_SYNTHETIC_EMAIL_SUFFIX, getLaunchExcludeUsernames } from "@/lib/launch-account-counts";

describe("admin portal list filters", () => {
  it("excludes owner test usernames and synthetic prefixes from list filters", () => {
    const clientWhere = adminPortalClientListWhere();
    const clientFakeOr = (clientWhere.NOT as { OR?: unknown[] })?.OR;
    expect(clientFakeOr).toEqual(
      expect.arrayContaining([
        { username: { startsWith: "mfqsc_", mode: "insensitive" } },
        { username: { equals: "jibbyjam22", mode: "insensitive" } },
        { username: { equals: "jonnybronny22", mode: "insensitive" } },
        { username: { equals: "twofa_tester", mode: "insensitive" } },
      ]),
    );

    const trainerWhere = adminPortalTrainerListWhere();
    const trainerFakeOr = (trainerWhere.NOT as { OR?: unknown[] })?.OR;
    expect(trainerFakeOr).toEqual(
      expect.arrayContaining([
        { email: { endsWith: INTERNAL_SYNTHETIC_EMAIL_SUFFIX, mode: "insensitive" } },
        { username: { startsWith: "mfqst_", mode: "insensitive" } },
        { username: { equals: "coachjonny22", mode: "insensitive" } },
        { username: { equals: "jibbyjam22", mode: "insensitive" } },
      ]),
    );
  });

  it("redacts email only for owner test accounts", () => {
    expect(isAdminOwnerTestUsername("jbfitness6299", "client")).toBe(true);
    expect(isAdminOwnerTestUsername("jibbyjam22", "client")).toBe(true);
    expect(isAdminOwnerTestUsername("coachjonny22", "trainer")).toBe(true);
    expect(isAdminOwnerTestUsername("kmfitness", "trainer")).toBe(false);

    expect(redactEmailForAdminPortal("jonnybooth22@gmail.com", "jbfitness6299", "client")).toBe(
      ADMIN_REDACTED_EMAIL_LABEL,
    );
    expect(redactEmailForAdminPortal("northside.ventures.llc@gmail.com", "coachjonny22", "trainer")).toBe(
      ADMIN_REDACTED_EMAIL_LABEL,
    );
    expect(redactEmailForAdminPortal("member@example.com", "realuser", "client")).toBe("member@example.com");
  });

  it("metrics and list SQL filters both exclude owner test accounts", () => {
    expect(getLaunchExcludeUsernames("client")).toContain("jibbyjam22");
    expect(getLaunchExcludeUsernames("trainer")).toContain("coachjonny22");

    const clientMetricsSql = buildLaunchMetricsClientSqlFilter("c").strings.join(" ");
    const clientListSql = buildAdminPortalClientSqlFilter().strings.join(" ");
    expect(clientMetricsSql).toContain("NOT IN");
    expect(clientListSql).toContain("NOT IN");

    const trainerMetricsSql = buildLaunchMetricsTrainerSqlFilter("t", "p").strings.join(" ");
    const trainerListSql = buildAdminPortalTrainerSqlFilter().strings.join(" ");
    expect(trainerMetricsSql).toContain("NOT IN");
    expect(trainerListSql).toContain("NOT IN");
    expect(trainerListSql).not.toContain("certificationUrl");
  });

  it("directory filter includes deidentified trainers; signup log excludes them", () => {
    expect(adminPortalTrainerListWhere().deidentifiedAt).toBeNull();
    expect(adminPortalTrainerDirectoryWhere().deidentifiedAt).toBeUndefined();
  });

  it("admin pending trainer filter matches onboarding-started trainers without live dashboard", () => {
    const where = adminPendingTrainerWhere();
    expect(where.AND).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ deidentifiedAt: null }),
        {
          NOT: {
            profile: { is: { dashboardActivatedAt: { not: null } } },
          },
        },
        {
          OR: expect.arrayContaining([
            { termsAcceptedAt: { not: null } },
            { profile: { is: { hasSignedTOS: true } } },
          ]),
        },
      ]),
    );
  });
});
