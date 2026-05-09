/**
 * Destinations allowed for the client dashboard “Quick Links” card.
 * Same surface area as the client app header / nav except Dashboard and Log out.
 */
export const CLIENT_DASHBOARD_QUICK_LINK_OPTIONS = [
  { id: "fithub", label: "FitHub", settingsLabel: "FitHub", href: "/client/dashboard/fithub" },
  {
    id: "daily_questionnaire",
    label: "Daily questionnaire",
    settingsLabel: "Daily questionnaire",
    href: "/client/dashboard/daily-questionnaire",
  },
  { id: "find_coaches", label: "Find coaches", settingsLabel: "Find coaches", href: "/client/dashboard/find-trainers" },
  { id: "chats", label: "Chats", settingsLabel: "Chats", href: "/client/dashboard/messages" },
  {
    id: "service_management",
    label: "Service Management",
    settingsLabel: "Service Management",
    href: "/client/dashboard/service-management",
  },
  {
    id: "preferences",
    label: "Match Preferences",
    settingsLabel: "Match Preferences",
    href: "/client/dashboard/preferences",
  },
  {
    id: "notifications",
    label: "Notifications",
    settingsLabel: "Notifications",
    href: "/client/dashboard/notifications",
  },
  {
    id: "notification_settings",
    label: "Notification Settings",
    settingsLabel: "Notification Settings",
    href: "/client/dashboard/notification-settings",
  },
  {
    id: "billing",
    label: "Billing Settings",
    settingsLabel: "Billing Settings",
    href: "/client/dashboard/billing",
  },
  {
    id: "profile",
    label: "Preview your profile",
    settingsLabel: "Preview your profile",
    href: "/client/dashboard/profile",
  },
  {
    id: "account_settings",
    label: "Account Settings",
    settingsLabel: "Account Settings",
    href: "/client/settings",
  },
] as const;

export type ClientDashboardQuickLinkId = (typeof CLIENT_DASHBOARD_QUICK_LINK_OPTIONS)[number]["id"];

const ALLOWED = new Set<string>(CLIENT_DASHBOARD_QUICK_LINK_OPTIONS.map((o) => o.id));

export function clientQuickLinkOptionById(id: string): (typeof CLIENT_DASHBOARD_QUICK_LINK_OPTIONS)[number] | undefined {
  return CLIENT_DASHBOARD_QUICK_LINK_OPTIONS.find((o) => o.id === id);
}

/** Parse stored JSON; invalid entries dropped. */
export function parseClientDashboardQuickLinkIdsJson(raw: string | null | undefined): ClientDashboardQuickLinkId[] {
  if (raw == null || !raw.trim()) return [];
  try {
    const v = JSON.parse(raw) as unknown;
    if (!Array.isArray(v)) return [];
    const out: ClientDashboardQuickLinkId[] = [];
    for (const x of v) {
      if (typeof x !== "string" || !ALLOWED.has(x)) continue;
      const id = x as ClientDashboardQuickLinkId;
      if (!out.includes(id)) out.push(id);
      if (out.length >= 4) break;
    }
    return out;
  } catch {
    return [];
  }
}

export function sanitizeClientDashboardQuickLinkIds(input: unknown): ClientDashboardQuickLinkId[] {
  if (!Array.isArray(input)) return [];
  const out: ClientDashboardQuickLinkId[] = [];
  for (const x of input) {
    if (typeof x !== "string" || !ALLOWED.has(x)) continue;
    const id = x as ClientDashboardQuickLinkId;
    if (!out.includes(id)) out.push(id);
    if (out.length >= 4) break;
  }
  return out;
}

export function serializeClientDashboardQuickLinkIds(ids: ClientDashboardQuickLinkId[]): string {
  return JSON.stringify(ids);
}
