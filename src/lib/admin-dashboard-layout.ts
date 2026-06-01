/**
 * Administrator dashboard section registry and layout preferences (client-safe).
 */

export const ADMIN_DASHBOARD_LAYOUT_VERSION = 1 as const;

export const ADMIN_DASHBOARD_SECTION_IDS = [
  "overview-kpis",
  "revenue-snapshot",
  "platform-health",
  "site-traffic",
  "acquisition-funnel",
  "trainer-pipeline",
  "finances-detail",
  "operational-alerts",
  "impersonation-audit",
  "ai-visitor-insights",
  "recent-signups",
  "recent-featured",
  "test-mode",
  "signup-log",
  "member-search",
] as const;

export type AdminDashboardSectionId = (typeof ADMIN_DASHBOARD_SECTION_IDS)[number];

export type AdminDashboardSectionGroup = "Overview" | "Analytics" | "Activity" | "Operations";

export type AdminDashboardSectionMeta = {
  id: AdminDashboardSectionId;
  label: string;
  description: string;
  group: AdminDashboardSectionGroup;
};

export const ADMIN_DASHBOARD_SECTIONS: AdminDashboardSectionMeta[] = [
  {
    id: "overview-kpis",
    label: "Member overview",
    description: "Total members, active clients/trainers, subscribers, and 7-day site visitors.",
    group: "Overview",
  },
  {
    id: "revenue-snapshot",
    label: "Revenue snapshot",
    description: "Lifetime platform revenue and profit by category.",
    group: "Overview",
  },
  {
    id: "platform-health",
    label: "Platform health",
    description: "Stability, security, and composite success rating.",
    group: "Analytics",
  },
  {
    id: "site-traffic",
    label: "Site traffic",
    description: "Page views, visitors, top pages, and link clicks (7 days).",
    group: "Analytics",
  },
  {
    id: "acquisition-funnel",
    label: "Acquisition funnel",
    description: "Signup funnel, logins, and top product actions.",
    group: "Analytics",
  },
  {
    id: "trainer-pipeline",
    label: "Trainer pipeline",
    description: "Onboarding stages from signup through live dashboard.",
    group: "Analytics",
  },
  {
    id: "finances-detail",
    label: "Finances detail",
    description: "Revenue windows, trials, best sellers, and recent transactions.",
    group: "Analytics",
  },
  {
    id: "operational-alerts",
    label: "Operational alerts",
    description: "Background checks, billing grace, safety, and chat warnings.",
    group: "Analytics",
  },
  {
    id: "impersonation-audit",
    label: "Impersonation audit log",
    description: "Recent supervised account access by administrators.",
    group: "Activity",
  },
  {
    id: "ai-visitor-insights",
    label: "AI visitor insights",
    description: "AI analysis of traffic patterns with signup recommendations.",
    group: "Analytics",
  },
  {
    id: "recent-signups",
    label: "Recent signups",
    description: "Latest client and trainer registrations.",
    group: "Activity",
  },
  {
    id: "recent-featured",
    label: "Recent featured",
    description: "Latest homepage featured trainer allocations.",
    group: "Activity",
  },
  {
    id: "test-mode",
    label: "Test mode",
    description: "Toggle sandbox validation mode for the platform.",
    group: "Operations",
  },
  {
    id: "signup-log",
    label: "Signup log",
    description: "Paginated full registration history.",
    group: "Operations",
  },
  {
    id: "member-search",
    label: "Member search",
    description: "Find members and open supervised impersonation sessions.",
    group: "Operations",
  },
];

const SECTION_ID_SET = new Set<string>(ADMIN_DASHBOARD_SECTION_IDS);

export function isAdminDashboardSectionId(value: string): value is AdminDashboardSectionId {
  return SECTION_ID_SET.has(value);
}

export type AdminDashboardLayout = {
  version: typeof ADMIN_DASHBOARD_LAYOUT_VERSION;
  /** Display order; includes hidden sections (hidden sections are omitted on render). */
  order: AdminDashboardSectionId[];
  hidden: AdminDashboardSectionId[];
};

export const DEFAULT_ADMIN_DASHBOARD_LAYOUT: AdminDashboardLayout = {
  version: ADMIN_DASHBOARD_LAYOUT_VERSION,
  order: [...ADMIN_DASHBOARD_SECTION_IDS],
  hidden: [],
};

export function adminDashboardSectionDomId(id: AdminDashboardSectionId): string {
  return `admin-section-${id}`;
}

export function parseAdminDashboardLayout(raw: unknown): AdminDashboardLayout {
  if (!raw || typeof raw !== "object") return { ...DEFAULT_ADMIN_DASHBOARD_LAYOUT };

  const obj = raw as Record<string, unknown>;
  if (obj.version !== ADMIN_DASHBOARD_LAYOUT_VERSION) return { ...DEFAULT_ADMIN_DASHBOARD_LAYOUT };

  const orderRaw = Array.isArray(obj.order) ? obj.order : [];
  const hiddenRaw = Array.isArray(obj.hidden) ? obj.hidden : [];

  const order: AdminDashboardSectionId[] = [];
  for (const item of orderRaw) {
    if (typeof item === "string" && isAdminDashboardSectionId(item) && !order.includes(item)) {
      order.push(item);
    }
  }
  for (const id of ADMIN_DASHBOARD_SECTION_IDS) {
    if (!order.includes(id)) order.push(id);
  }

  const hidden: AdminDashboardSectionId[] = [];
  for (const item of hiddenRaw) {
    if (typeof item === "string" && isAdminDashboardSectionId(item) && !hidden.includes(item)) {
      hidden.push(item);
    }
  }

  return { version: ADMIN_DASHBOARD_LAYOUT_VERSION, order, hidden };
}

export function serializeAdminDashboardLayout(layout: AdminDashboardLayout): string {
  return JSON.stringify(layout);
}

export function isSectionVisible(layout: AdminDashboardLayout, id: AdminDashboardSectionId): boolean {
  return !layout.hidden.includes(id);
}

/** Sections in display order, visible only. */
export function visibleDashboardSections(layout: AdminDashboardLayout): AdminDashboardSectionId[] {
  return layout.order.filter((id) => isSectionVisible(layout, id));
}

export function setSectionVisible(
  layout: AdminDashboardLayout,
  id: AdminDashboardSectionId,
  visible: boolean,
): AdminDashboardLayout {
  const hidden = new Set(layout.hidden);
  if (visible) hidden.delete(id);
  else hidden.add(id);
  return { ...layout, hidden: [...hidden] };
}

export function moveSection(
  layout: AdminDashboardLayout,
  id: AdminDashboardSectionId,
  direction: "up" | "down",
): AdminDashboardLayout {
  const order = [...layout.order];
  const idx = order.indexOf(id);
  if (idx < 0) return layout;
  const swapWith = direction === "up" ? idx - 1 : idx + 1;
  if (swapWith < 0 || swapWith >= order.length) return layout;
  [order[idx], order[swapWith]] = [order[swapWith], order[idx]];
  return { ...layout, order };
}

export function sectionsByGroup(): Record<AdminDashboardSectionGroup, AdminDashboardSectionMeta[]> {
  const out: Record<AdminDashboardSectionGroup, AdminDashboardSectionMeta[]> = {
    Overview: [],
    Analytics: [],
    Activity: [],
    Operations: [],
  };
  for (const section of ADMIN_DASHBOARD_SECTIONS) {
    out[section.group].push(section);
  }
  return out;
}

export const ADMIN_DASHBOARD_LAYOUT_STORAGE_KEY = "mf_admin_dashboard_layout_v1";
