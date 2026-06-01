import { describe, expect, it } from "vitest";
import {
  DEFAULT_ADMIN_DASHBOARD_LAYOUT,
  parseAdminDashboardLayout,
  setSectionVisible,
  visibleDashboardSections,
} from "@/lib/admin-dashboard-layout";

describe("admin-dashboard-layout", () => {
  it("returns defaults for invalid input", () => {
    expect(parseAdminDashboardLayout(null)).toEqual(DEFAULT_ADMIN_DASHBOARD_LAYOUT);
  });

  it("merges unknown section ids and preserves hidden state", () => {
    const parsed = parseAdminDashboardLayout({
      version: 1,
      order: ["member-search", "overview-kpis"],
      hidden: ["signup-log"],
    });
    expect(parsed.order[0]).toBe("member-search");
    expect(parsed.hidden).toContain("signup-log");
    expect(parsed.order).toContain("platform-health");
    expect(visibleDashboardSections(parsed)).not.toContain("signup-log");
  });

  it("toggles section visibility", () => {
    const hidden = setSectionVisible(DEFAULT_ADMIN_DASHBOARD_LAYOUT, "test-mode", false);
    expect(visibleDashboardSections(hidden)).not.toContain("test-mode");
    const shown = setSectionVisible(hidden, "test-mode", true);
    expect(visibleDashboardSections(shown)).toContain("test-mode");
  });
});
