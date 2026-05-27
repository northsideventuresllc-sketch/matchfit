import { describe, expect, it } from "vitest";
import { hasOnboardingSnapshotChanges, shouldInterceptDashboardNavigation } from "@/lib/trainer-onboarding-unsaved-changes";

describe("trainer onboarding unsaved changes", () => {
  describe("hasOnboardingSnapshotChanges", () => {
    it("returns false before the initial snapshot is captured", () => {
      expect(hasOnboardingSnapshotChanges(null, "{\"step\":1}")).toBe(false);
    });

    it("returns false when snapshots match exactly", () => {
      expect(hasOnboardingSnapshotChanges("{\"step\":1}", "{\"step\":1}")).toBe(false);
    });

    it("returns true when the current snapshot differs from the baseline", () => {
      expect(hasOnboardingSnapshotChanges("{\"step\":1}", "{\"step\":2}")).toBe(true);
    });
  });

  describe("shouldInterceptDashboardNavigation", () => {
    const currentLocationHref = "https://matchfit.test/trainer/onboarding";

    it("intercepts same-origin relative dashboard links", () => {
      expect(shouldInterceptDashboardNavigation("/trainer/dashboard", currentLocationHref)).toBe(true);
      expect(shouldInterceptDashboardNavigation("/trainer/dashboard/", currentLocationHref)).toBe(true);
    });

    it("intercepts same-origin absolute dashboard links", () => {
      expect(
        shouldInterceptDashboardNavigation("https://matchfit.test/trainer/dashboard?tab=profile", currentLocationHref),
      ).toBe(true);
      expect(
        shouldInterceptDashboardNavigation("https://matchfit.test/trainer/dashboard/#summary", currentLocationHref),
      ).toBe(true);
    });

    it("ignores hash-only and missing links", () => {
      expect(shouldInterceptDashboardNavigation("#stay-here", currentLocationHref)).toBe(false);
      expect(shouldInterceptDashboardNavigation(null, currentLocationHref)).toBe(false);
      expect(shouldInterceptDashboardNavigation("", currentLocationHref)).toBe(false);
    });

    it("ignores non-dashboard paths", () => {
      expect(shouldInterceptDashboardNavigation("/trainer/dashboard/settings", currentLocationHref)).toBe(false);
      expect(shouldInterceptDashboardNavigation("/trainer/dashboarding", currentLocationHref)).toBe(false);
      expect(shouldInterceptDashboardNavigation("/trainer/onboarding", currentLocationHref)).toBe(false);
    });

    it("ignores cross-origin links", () => {
      expect(shouldInterceptDashboardNavigation("https://example.com/trainer/dashboard", currentLocationHref)).toBe(false);
    });

    it("fails closed for malformed location inputs", () => {
      expect(shouldInterceptDashboardNavigation("https://matchfit.test/trainer/dashboard", "not-a-valid-url")).toBe(false);
    });

    it("fails closed for malformed target href values", () => {
      expect(shouldInterceptDashboardNavigation("https://%zz/trainer/dashboard", currentLocationHref)).toBe(false);
    });
  });
});
