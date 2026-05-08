/**
 * Destinations allowed for the trainer dashboard “Quick Links” card.
 * Same surface area as the app header (FitHub, Premium, Notifications) plus the account menu
 * except Dashboard and Log out.
 */
export const TRAINER_DASHBOARD_QUICK_LINK_OPTIONS = [
  { id: "fithub", label: "FITHUB", settingsLabel: "FitHub", href: "/trainer/dashboard/fit-hub" },
  { id: "premium_hub", label: "Premium Hub", settingsLabel: "Premium Hub", href: "/trainer/dashboard/premium" },
  { id: "notifications", label: "Notifications", settingsLabel: "Notifications", href: "/trainer/dashboard/notifications" },
  { id: "chats", label: "Chats", settingsLabel: "Chats", href: "/trainer/dashboard/messages" },
  { id: "billing", label: "Billing Settings", settingsLabel: "Billing Settings", href: "/trainer/dashboard/billing" },
  {
    id: "notification_settings",
    label: "Notification Settings",
    settingsLabel: "Notification Settings",
    href: "/trainer/dashboard/notification-settings",
  },
  {
    id: "account_settings",
    label: "Account Settings",
    settingsLabel: "Account Settings",
    href: "/trainer/dashboard/settings",
  },
  { id: "compliance", label: "Compliance Details", settingsLabel: "Compliance Details", href: "/trainer/dashboard/compliance" },
] as const;

export type TrainerDashboardQuickLinkId = (typeof TRAINER_DASHBOARD_QUICK_LINK_OPTIONS)[number]["id"];

const ALLOWED = new Set<string>(TRAINER_DASHBOARD_QUICK_LINK_OPTIONS.map((o) => o.id));

export function quickLinkOptionById(id: string): (typeof TRAINER_DASHBOARD_QUICK_LINK_OPTIONS)[number] | undefined {
  return TRAINER_DASHBOARD_QUICK_LINK_OPTIONS.find((o) => o.id === id);
}

/** Parse stored JSON; invalid entries dropped. */
export function parseTrainerDashboardQuickLinkIdsJson(raw: string | null | undefined): TrainerDashboardQuickLinkId[] {
  if (raw == null || !raw.trim()) return [];
  try {
    const v = JSON.parse(raw) as unknown;
    if (!Array.isArray(v)) return [];
    const out: TrainerDashboardQuickLinkId[] = [];
    for (const x of v) {
      if (typeof x !== "string" || !ALLOWED.has(x)) continue;
      const id = x as TrainerDashboardQuickLinkId;
      if (!out.includes(id)) out.push(id);
      if (out.length >= 4) break;
    }
    return out;
  } catch {
    return [];
  }
}

export function sanitizeTrainerDashboardQuickLinkIds(input: unknown): TrainerDashboardQuickLinkId[] {
  if (!Array.isArray(input)) return [];
  const out: TrainerDashboardQuickLinkId[] = [];
  for (const x of input) {
    if (typeof x !== "string" || !ALLOWED.has(x)) continue;
    const id = x as TrainerDashboardQuickLinkId;
    if (!out.includes(id)) out.push(id);
    if (out.length >= 4) break;
  }
  return out;
}

export function serializeTrainerDashboardQuickLinkIds(ids: TrainerDashboardQuickLinkId[]): string {
  return JSON.stringify(ids);
}
