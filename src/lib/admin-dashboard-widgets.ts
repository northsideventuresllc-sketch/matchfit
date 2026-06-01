/** Dashboard widget identifiers — persisted in `AdminDashboardPreferences.widgetsJson`. */
export const ADMIN_DASHBOARD_WIDGETS = [
  "member_counts",
  "platform_client_subs",
  "premium_trainer_subs",
  "revenue_summary",
  "unique_visitors",
  "top_pages",
  "top_buttons",
  "featured_allocations",
  "impersonation_audit",
  "ai_visitor_insights",
  "recent_signups",
  "signup_log",
  "member_search",
  "test_mode",
] as const;

export type AdminDashboardWidgetId = (typeof ADMIN_DASHBOARD_WIDGETS)[number];

export const DEFAULT_ADMIN_DASHBOARD_WIDGETS: AdminDashboardWidgetId[] = [
  "member_counts",
  "platform_client_subs",
  "premium_trainer_subs",
  "revenue_summary",
  "unique_visitors",
  "top_pages",
  "top_buttons",
  "featured_allocations",
  "impersonation_audit",
  "ai_visitor_insights",
  "recent_signups",
  "signup_log",
  "member_search",
  "test_mode",
];

export type AdminDashboardPreferencesPayload = {
  enabledWidgets: AdminDashboardWidgetId[];
};

export function parseAdminDashboardPreferences(raw: string | null | undefined): AdminDashboardPreferencesPayload {
  if (!raw?.trim()) return { enabledWidgets: [...DEFAULT_ADMIN_DASHBOARD_WIDGETS] };
  try {
    const parsed = JSON.parse(raw) as { enabledWidgets?: unknown };
    if (!Array.isArray(parsed.enabledWidgets)) {
      return { enabledWidgets: [...DEFAULT_ADMIN_DASHBOARD_WIDGETS] };
    }
    const allowed = new Set<string>(ADMIN_DASHBOARD_WIDGETS);
    const enabledWidgets = parsed.enabledWidgets.filter(
      (w): w is AdminDashboardWidgetId => typeof w === "string" && allowed.has(w),
    );
    return { enabledWidgets: enabledWidgets.length > 0 ? enabledWidgets : [...DEFAULT_ADMIN_DASHBOARD_WIDGETS] };
  } catch {
    return { enabledWidgets: [...DEFAULT_ADMIN_DASHBOARD_WIDGETS] };
  }
}

export function serializeAdminDashboardPreferences(prefs: AdminDashboardPreferencesPayload): string {
  return JSON.stringify(prefs);
}

export const ADMIN_DASHBOARD_WIDGET_LABELS: Record<AdminDashboardWidgetId, string> = {
  member_counts: "Member totals & active counts",
  platform_client_subs: "Platform client subscribers",
  premium_trainer_subs: "Premium trainer subscribers",
  revenue_summary: "Platform revenue & profit",
  unique_visitors: "Unique site visitors",
  top_pages: "Top 5 landing pages (unique viewers)",
  top_buttons: "Top 5 buttons / links clicked",
  featured_allocations: "Featured trainer allocations",
  impersonation_audit: "Impersonation audit log",
  ai_visitor_insights: "AI visitor insights & signup tips",
  recent_signups: "Recent signups",
  signup_log: "Full signup log",
  member_search: "Member search & impersonation",
  test_mode: "Test mode toggle",
};
