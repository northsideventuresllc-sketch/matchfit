import { describe, expect, it } from "vitest";
import {
  DEFAULT_ADMIN_DASHBOARD_LAYOUT,
  applyLayoutPreset,
  collapseAllVisibleSections,
  expandAllSections,
  parseAdminDashboardLayout,
  setSectionCollapsed,
  setSectionVisible,
  visibleDashboardSections,
} from "@/lib/admin-dashboard-layout";

describe("admin-dashboard-layout", () => {
  it("returns defaults for invalid input", () => {
    expect(parseAdminDashboardLayout(null)).toEqual(DEFAULT_ADMIN_DASHBOARD_LAYOUT);
  });

  it("migrates v1 layouts to v3 with collapse and density defaults", () => {
    const parsed = parseAdminDashboardLayout({
      version: 1,
      order: ["member-search", "overview-kpis"],
      hidden: ["signup-log"],
    });
    expect(parsed.version).toBe(3);
    expect(parsed.order[0]).toBe("member-search");
    expect(parsed.hidden).toContain("signup-log");
    expect(parsed.collapsed).toEqual([]);
    expect(parsed.density).toBe("comfortable");
    expect(parsed.order).toContain("platform-health");
    expect(parsed.order).toContain("background-checks");
    expect(visibleDashboardSections(parsed)).not.toContain("signup-log");
  });

  it("toggles section visibility", () => {
    const hidden = setSectionVisible(DEFAULT_ADMIN_DASHBOARD_LAYOUT, "test-mode", false);
    expect(visibleDashboardSections(hidden)).not.toContain("test-mode");
    const shown = setSectionVisible(hidden, "test-mode", true);
    expect(visibleDashboardSections(shown)).toContain("test-mode");
  });

  it("toggles collapsed state and collapse-all helpers", () => {
    const collapsed = setSectionCollapsed(DEFAULT_ADMIN_DASHBOARD_LAYOUT, "signup-log", true);
    expect(collapsed.collapsed).toContain("signup-log");
    const allCollapsed = collapseAllVisibleSections(DEFAULT_ADMIN_DASHBOARD_LAYOUT);
    expect(allCollapsed.collapsed.length).toBe(visibleDashboardSections(DEFAULT_ADMIN_DASHBOARD_LAYOUT).length);
    const expanded = expandAllSections(allCollapsed);
    expect(expanded.collapsed).toEqual([]);
  });

  it("applies essential preset visibility", () => {
    const preset = applyLayoutPreset(DEFAULT_ADMIN_DASHBOARD_LAYOUT, "essential");
    expect(visibleDashboardSections(preset)).toContain("overview-kpis");
    expect(visibleDashboardSections(preset)).not.toContain("member-search");
  });
});
