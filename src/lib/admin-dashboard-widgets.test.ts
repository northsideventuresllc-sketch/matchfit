import { describe, expect, it } from "vitest";
import {
  DEFAULT_ADMIN_DASHBOARD_WIDGETS,
  parseAdminDashboardPreferences,
} from "@/lib/admin-dashboard-widgets";

describe("admin-dashboard-widgets", () => {
  it("returns defaults for empty input", () => {
    expect(parseAdminDashboardPreferences(null).enabledWidgets).toEqual(DEFAULT_ADMIN_DASHBOARD_WIDGETS);
  });

  it("filters unknown widget ids", () => {
    const prefs = parseAdminDashboardPreferences(
      JSON.stringify({ enabledWidgets: ["platform_client_subs", "not_real"] }),
    );
    expect(prefs.enabledWidgets).toEqual(["platform_client_subs"]);
  });
});
